--Architecture

This document explains how the collaborative canvas works internally — how data moves through the system, how WebSockets are used, how undo/redo is handled, and what decisions were made around performance and conflict handling.

--High-level overview

The application is split into two main parts.

-Frontend (React + Vite)
The frontend is responsible for rendering the drawing canvas and UI. It listens to mouse events, draws on the HTML5 <canvas>, and communicates with the backend using Socket.io to send and receive drawing and cursor updates.

-Backend (Node.js + Socket.io)
The backend manages rooms and connected users. It acts as the source of truth by validating and storing completed drawing actions, and it broadcasts live updates and full canvas snapshots to all clients.

The core concept in the system is a stroke operation. A stroke represents one continuous brush or eraser action and is stored as a list of points along with metadata like color, width, and type.

--Data flow (end-to-end)

Pointer events are captured on the client (mousedown, mousemove, mouseup).
While drawing, the client updates the canvas locally for instant feedback, emits throttled live stroke previews and cursor positions, and finally sends a completed stroke to the server.

The server treats completed strokes as authoritative. Live updates are broadcast to other users but not stored. Final strokes are validated, stored in the room’s operation list, and then broadcast to all clients. Undo and redo operations modify this shared operation list and trigger a full resync.

Clients receive live previews, finalized strokes, or full canvas state updates and redraw accordingly.

--Joining a room

On the frontend, the user provides a name and a room ID. Once the Socket.io connection is established, the client emits a room:join event with this information.

On the backend, the room ID is normalized (trimmed, spaces replaced, and defaulted to lobby if empty). A color is assigned to the user, either from the client or generated deterministically from the socket ID. The server creates the room if it doesn’t exist, adds the user, and sends back the current canvas state. It also broadcasts an updated player list to everyone in the room.

When the client receives the canvas state, it clears the local canvas and replays all stored operations to reconstruct the drawing exactly as it exists on the server.

--Drawing a stroke

When the user presses the mouse button, the client generates a new stroke ID, captures the first point, and configures the canvas context based on whether the user is drawing or erasing. A new path is started immediately.

As the mouse moves, points are added to the current stroke. Very close points are filtered out to reduce jitter and unnecessary network traffic. The canvas is updated locally using requestAnimationFrame to keep rendering smooth. At the same time, the client emits throttled stroke:update events for live previews and cursor:move events for cursor sharing.

When the stroke ends, the client sends a stroke:end event containing the full operation.

The backend broadcasts live stroke updates to other users without storing them. When a stroke ends, the server validates it, adds metadata like user ID and timestamp, stores it in the room’s operation list, clears the redo stack, and broadcasts the finalized stroke to everyone.

Other clients render both live previews and finalized strokes using the same shared drawing helper.

--Cursor updates

While drawing, the client sends cursor positions to the server. The server stores the latest cursor position per user and broadcasts it to the rest of the room. On the frontend, these cursor positions are rendered as small colored indicators so users can see where others are drawing in real time.

--WebSocket protocol

Client → Server events include joining and leaving rooms, sending cursor positions, live stroke updates, finalized strokes, undo/redo actions, and clearing strokes (either per user or for the whole room).

Server → Client events include player list updates, cursor updates, full canvas state syncs, live stroke previews, and finalized stroke broadcasts.

--Undo and redo strategy

Each room maintains two data structures: an ordered list of completed operations and a redo stack.

Undo works globally. When an undo request is received, the most recent operation (regardless of author) is removed from the operation list and pushed onto the redo stack. The server then broadcasts the full canvas state so all clients redraw from the same authoritative history.

Redo reverses this process by moving the most recent operation from the redo stack back into the main operation list and rebroadcasting the canvas state.

There is also a “clear mine” action that removes only the current user’s brush strokes while preserving eraser actions. Both the operation list and redo stack are filtered to stay consistent, followed by a full canvas resync.

Undo and redo are intentionally global to keep the system simple and consistent across all clients.

--Performance decisions

Mouse events fire extremely frequently, so the client batches stroke points, filters out insignificant movement, and throttles network messages. Stroke previews are sent at roughly 30 frames per second, while cursor updates are sent at around 20 frames per second. This significantly reduces bandwidth usage while keeping the drawing experience smooth.

Rendering is also limited to one redraw per animation frame using requestAnimationFrame. The server only stores completed strokes, while clients maintain two conceptual layers: committed strokes from the server and temporary preview strokes. Whenever a full canvas state is received, the client clears the canvas, replays all committed operations in order, and then redraws any active previews.

This approach is simple, reliable, and works well for typical room sizes. More advanced optimizations like snapshots or bitmap layers can be added later if needed.

The backend validates all incoming stroke data to prevent malformed or malicious payloads from affecting shared state.

--Conflict handling

Drawing conflicts are resolved naturally by ordering. Strokes are applied in sequence, so later strokes appear on top of earlier ones. Erasers use destination-out, which removes pixels from whatever has already been drawn.

Multiple users can draw at the same time. Each user sees their own strokes instantly, while remote strokes appear as network updates arrive. Finalized strokes are always appended to the server’s authoritative history.

Undo and redo conflicts are avoided by keeping these actions global. Any undo or redo triggers a full canvas resync so every client stays consistent.

--Summary

The server maintains an authoritative operation log for each room.
The client prioritizes responsiveness by drawing locally while staying in sync through server state replays.
Live previews make collaboration feel real-time, and full history replays guarantee consistency after joins, undo/redo actions, or clears.