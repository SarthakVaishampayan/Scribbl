"# Architecture

This document explains how the collaborative canvas works under the hood:  
data flow, WebSocket protocol, undo/redo strategy, performance decisions, and how conflicts are handled.

---

## High-Level Overview

The app is split into two main pieces:

- **Frontend (React + Vite)**
  - Renders the drawing canvas and UI.
  - Listens to mouse events and updates the HTML5 `<canvas>`.
  - Connects to the backend via Socket.io and sends/receives drawing and cursor events.

- **Backend (Node.js + Socket.io)**
  - Manages rooms and users.
  - Validates and stores completed stroke operations as the source of truth.
  - Broadcasts live drawing updates and full canvas state snapshots to clients.

The key abstraction is a **stroke operation**: one continuous brush or eraser stroke drawn by a user, represented as a list of points plus metadata.

---

## Data Flow Diagram (end-to-end)

```text
Pointer events (client)
  └─ mousedown/mousemove/mouseup
      ├─ local preview update (requestAnimationFrame render)
      ├─ emit stroke:update (throttled ~30fps)
      ├─ emit cursor:move (throttled)
      └─ emit stroke:end (final operation)

Socket.io (server: authoritative room timeline)
  ├─ stroke:update  ──► broadcast preview to other clients (not stored)
  ├─ stroke:end     ──► validate + append to room.operations + clear redo stack
  ├─ canvas:undo    ──► pop last op from room.operations -> push to room.redoStack
  └─ canvas:redo    ──► pop from room.redoStack -> push back to room.operations

Clients (sync)
  ├─ stroke:update  ──► store preview by strokeId -> rAF redraw
  ├─ stroke:created ──► move from preview -> committed ops -> rAF redraw
  └─ canvas:state   ──► replace committed ops -> clear previews -> rAF redraw
```

---

## Data Flow

### 1. Joining a room

**Frontend**

1. User enters:
   - `userName`
   - `roomId` (example: `room-123`)
2. Client opens a Socket.io connection to the backend.
3. Client emits:

```js
socket.emit("room:join", { roomId, userName });
```

**Backend**

1. Normalizes the `roomId`:
   - Trims, replaces spaces with dashes, defaults to `lobby` if empty.
2. Picks a user color:
   - Uses the client-provided color if present, otherwise chooses a deterministic `hsl(...)` based on socket ID.
3. Creates or fetches the room via `getOrCreateRoom(roomId)`.
4. Adds the user to `room.users`.
5. Sends the current canvas state:

```js
socket.emit("canvas:state", { roomId, operations: room.operations });
```

6. Broadcasts the updated player list:

```js
io.to(roomId).emit("room:players", { roomId, players: getPlayers(roomId) });
```

**Frontend (on join)**

- Clears the local canvas.
- Replays every operation from `canvas:state` to reconstruct the current drawing.

---

### 2. Drawing a stroke

**Frontend**

1. On `mousedown`:
   - Generates a new stroke ID (`uuidv4()`).
   - Captures the first point in canvas coordinates.
   - Configures the canvas context:
     - Brush: `globalCompositeOperation = "source-over"`
     - Eraser: `globalCompositeOperation = "destination-out"`
   - Starts the path with `beginPath()`.

2. On `mousemove` while drawing:
   - Adds new points to the current stroke.
   - Filters points that are too close together (reduces jitter + event spam).
   - Updates local preview state and renders on the next animation frame (`requestAnimationFrame`).
   - Emits a live preview update (throttled, ~30fps):

```js
socket.emit("stroke:update", {
  id,
  type,   // "brush" | "eraser"
  color,
  width,
  points  // [{ x, y }, ...]
});
```

   - Also emits cursor position:

```js
socket.emit("cursor:move", { x, y });
```

3. On `mouseup` / `mouseleave`:
   - Finalizes the operation and emits:

```js
socket.emit("stroke:end", { id, type, color, width, points });
```

**Backend**

- On `stroke:update`:
  - Validates the payload shape.
  - Broadcasts to everyone else in the room (preview only; not stored):

```js
socket.to(roomId).emit("stroke:update", { operation });
```

- On `stroke:end`:
  - Validates, enriches with `userId` + `timestamp`, stores into `room.operations`.
  - Broadcasts finalized operation:

```js
io.to(roomId).emit("stroke:created", { roomId, operation: opToStore });
```

**Other clients**

- On `stroke:update` and `stroke:created`, they render the operation via a shared `drawOperation(...)` helper.

---

### 3. Cursor updates

**Frontend**

- Emits `cursor:move` as the user draws.

**Backend**

- Stores the latest cursor position on the user record in the room.
- Broadcasts to others:

```js
socket.to(roomId).emit("cursor:update", { userId: socket.id, cursor: { x, y } });
```

**Frontend**

- Stores cursor data inside a `players` list and renders a small colored badge overlay for each remote user.

---

## WebSocket Protocol

### Client → Server

- **`room:join`**  
  Payload: `{ roomId: string, userName: string }`  
  Join (or create) a room; server responds with canvas state + player list.

- **`room:leave`**  
  Payload: none  
  Leave the current room.

- **`cursor:move`**  
  Payload: `{ x: number, y: number }`  
  Send cursor position in canvas coordinates.

- **`stroke:update`**  
  Payload: `{ id, type, color, width, points[] }`  
  Live stroke preview updates; not stored in history.

- **`stroke:end`**  
  Payload: `{ id, type, color, width, points[] }`  
  Final stroke operation; stored in history and broadcast.

- **`canvas:undo`**  
  Payload: none  
  Undo the user’s most recent stroke in this room.

- **`canvas:redo`**  
  Payload: none  
  Redo the user’s most recently undone stroke.

- **`canvas:clearMine`**  
  Payload: none  
  Remove all brush strokes authored by this user in the room (erasers are preserved).

- **`canvas:clear`** (optional, not used by UI)  
  Payload: none  
  Clears all operations in the room.

---

### Server → Client

- **`room:players`**  
  Payload: `{ roomId, players: Array<{ id, name, color, cursor? }> }`  
  Broadcast of who is currently in the room (and their color / cursor).

- **`cursor:update`**  
  Payload: `{ userId, cursor: { x, y } }`  
  Cursor update for a specific remote user.

- **`canvas:state`**  
  Payload: `{ roomId, operations: Operation[] }`  
  Full authoritative operation history (used on join + undo/redo + clear).

- **`stroke:update`**  
  Payload: `{ operation }`  
  Live, in-progress stroke segments from another user.

- **`stroke:created`**  
  Payload: `{ roomId, operation }`  
  Finalized stroke operation appended to history.

---

## Undo/Redo Strategy

### Data structures

Each room maintains:

- `operations: Operation[]`  
  The authoritative history of completed strokes.

- `redoStack: Operation[]`  
  A **global** redo stack for the room (operations removed from the end of `operations`).

### Undo (global)

When a client emits `canvas:undo`:

1. Pop the most recent operation from `room.operations` (regardless of author).
2. Push it onto `room.redoStack`.
3. Broadcast a full `canvas:state` to all clients so everyone redraws from the same authoritative timeline.

### Redo (global)

When a client emits `canvas:redo`:

1. Pop the most recent entry from `room.redoStack`.
2. Push it back into `room.operations`.
3. Broadcast `canvas:state` to resync.

### Clear mine

`canvas:clearMine` filters `room.operations` to remove only that user’s brush strokes (keeps eraser operations), and also filters `room.redoStack` to keep the redo stack consistent. Then it broadcasts `canvas:state`.

### Conflict policy for global undo/redo

- Undo/redo is **global** by design: if User A hits undo, they may undo User B’s last stroke if that was the latest operation.
- Consistency is maintained by the server broadcasting `canvas:state` after every undo/redo, so every client rebuilds the canvas from the same operation list.

---

## Performance Decisions

### Batching stroke points

Mouse move events can fire very frequently. The client:

- Filters points that are too close together (distance threshold scales with stroke width)
- Sends `stroke:update` at most ~30fps (throttled)
- Sends `cursor:move` at most ~20fps (throttled)

Trade-offs:

- Fewer network messages and lower bandwidth usage
- Slightly reduced remote granularity, still visually smooth

### Canvas rendering approach

- Each client renders at most once per animation frame (`requestAnimationFrame`) to avoid over-drawing on high-frequency events.
- The server stores only completed strokes (`stroke:end`) as the source of truth.
- Clients keep two conceptual layers:
  - **Committed layer**: `room.operations` (authoritative)
  - **Preview layer**: in-progress strokes (by `strokeId`) that should not permanently mutate the committed layer
- On `canvas:state`, clients clear and replay the entire committed operation list in order, then paint previews on top.

This is simple and reliable for typical room sizes. For huge histories, future optimizations could include snapshotting, chunked layers, or server-provided bitmaps.

### Server-side validation

The backend validates operation payloads before broadcasting/storing:

- Allowed types (`brush` / `eraser`)
- Valid `id`, `color`, and sane `width`
- Finite numeric points (`x`, `y`)

This protects shared state from malformed or malicious events.

---

## Conflict Resolution

### Overlapping drawing

- Operations are applied in order; later strokes render on top of earlier strokes (“painter’s algorithm”).
- Eraser strokes use `destination-out`, so they cut out pixels from what has already been drawn.

### Simultaneous drawing + network latency

- Multiple users can draw simultaneously.
- Each user sees their own stroke immediately (local-first rendering).
- Remote updates appear as messages arrive; finalized operations are appended to the server history.

### Undo/redo conflicts

Because undo/redo is per-user, users do not directly undo other users’ actions.  
When undo/redo happens, the server broadcasts `canvas:state` and clients redraw from the authoritative operation history.

---

## Summary

- The backend is the authoritative operation log per room.
- The frontend draws locally for responsiveness and stays consistent by replaying server history.
- Live previews (`stroke:update`) make remote drawing feel real-time.
- History replay keeps all clients synchronized after undo/redo and user joins.
" 
