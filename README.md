"# Collaborative Canvas

A real-time, multi-user drawing board built with React (Vite) on the frontend and Node.js + Socket.io on the backend.  
Multiple users can draw together in the same room, see each others’ cursors, and manage their own undo/redo history.

---

## Getting Started

### Prerequisites

- Node.js (LTS recommended)
- npm

### Install dependencies

From the project root:

```bash
# Installs root dev tools AND (via postinstall) installs ./src and ./server deps
npm install
```

### Run the app

From the project root:

```bash
npm start
```

This will:

- Start the backend on `http://localhost:5000`
- Start the React/Vite frontend on `http://localhost:5173`

You can also run them separately:

```bash
# In one terminal (from root)
npm run server

# In another terminal (from root)
npm run client
```

By default, the frontend connects to `http://localhost:5000` (via fallback in code).  
To point the frontend to a different backend, create a `.env` file in `src/`:

```bash
VITE_SOCKET_URL=https://your-backend-url
```

---

## Project Structure

```text
.
├── server/               # Node + Socket.io backend
│   ├── server.js         # Express + Socket.io setup and event handlers
│   ├── rooms.js          # Room and user tracking (who is in which room)
│   └── drawing-state.js  # Canvas operation history + undo/redo logic
│
├── src/                  # React + Vite frontend
│   ├── index.html
│   └── src/
│       ├── App.jsx
│       ├── components/
│       │   ├── CanvasBoard.jsx  # Core drawing + WebSocket client
│       │   └── JoinRoom.jsx     # Room / user joining UI
│       └── main.jsx
│
├── package.json          # Root scripts (dev, server, client)
├── ARCHITECTURE.md       # Protocol, data flow, and design decisions
└── README.md             # You are here
```

---

## How It Works (Short Version)

- The frontend renders an HTML5 `<canvas>` and listens to mouse events.
- As the user draws:
  - The canvas updates **locally** for instant feedback.
  - Batched stroke updates are sent over WebSockets to the backend.
- The backend:
  - Manages **rooms** and **connected users**.
  - Validates and stores completed strokes in a per-room operation history.
  - Broadcasts live stroke updates and full canvas state to clients in the room.
- Other clients:
  - Receive live “stroke in progress” and “stroke finished” events.
  - Draw those strokes onto their local canvas to stay in sync.

See `ARCHITECTURE.md` for the detailed data flow and WebSocket protocol.

---

## Using the App

### Join a room

- Open `http://localhost:5173` in your browser.
- Enter a user name and a room ID.
  - Room IDs are normalized on the server (spaces → dashes); an empty room ID falls back to `"lobby"`.
- Open a second window/device and join the same room ID to collaborate.

### Drawing

- **Brush**: draw colored strokes
- **Eraser**: erase by cutting out from existing strokes
- **Color** and **stroke width** are configurable in the UI and used in the operation payloads.

As you draw:

- Other users see your stroke appear in (near) real-time.
- You see colored cursor badges showing where other users are drawing.

### Undo / Redo / Clear Mine

The canvas component exposes controls (wired via `useImperativeHandle`) for:

- **Undo**: removes the **most recent stroke in the room** (global timeline)
- **Redo**: restores the most recently undone stroke (global timeline)
- **Clear Mine**: removes all your brush strokes in the room (eraser strokes are retained)

Note: **Undo/redo are global** and affect the shared room timeline (explained in `ARCHITECTURE.md`).

---

## Testing with Multiple Users

To simulate multiple users:

1. Start the app (`npm run dev`).
2. Open `http://localhost:5173` in:
   - Two different browsers (e.g., Chrome and Firefox), or
   - A normal window + an incognito/private window.
3. Join the same room ID from both windows.

Suggested tests:

- Draw at the same time in overlapping areas and observe how strokes/erasers interact.
- Undo and redo from one user while another continues drawing.
- Watch the cursor badges move as the other user draws.

---

## Configuration

### Backend environment variables

- `PORT` — server port (default: `5000`)
- `CORS_ORIGIN` — comma-separated list of allowed origins (default: `http://localhost:5173`)

### Frontend environment variables

- `VITE_SOCKET_URL` — backend base URL (default: `http://localhost:5000`)

---

## Known Limitations / Trade-offs

- **Per-user undo/redo**
  - Undo/redo affects only the user’s own strokes, not a global shared timeline.
  - This avoids one user unexpectedly removing another user’s work, but differs from a strict “global undo” model.
- **In-memory state only**
  - Room state is kept in memory in the Node process.
  - Restarting the server clears all rooms and drawings; there is no persistence layer yet.
- **No authentication**
  - Users are identified by socket ID and a display name.
- **Desktop-focused**
  - Main interaction is mouse-based; touch/mobile support isn’t fully optimized yet.

---

## Time Spent

Fill this in with your actual time:

- Backend (rooms, state, undo/redo, validation): _[fill in]_
- Frontend (canvas drawing, UI, sockets): _[fill in]_
- Documentation and polish: _[fill in]_

---

## Future Improvements

- Global (multi-user) undo/redo timeline with clear conflict policies
- Touch support and improved mobile layout
- Persistence (save/load room sessions)
- Performance metrics (FPS/latency indicators)
- More tools (shapes, text, selection)
" 
