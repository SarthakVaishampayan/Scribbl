// server/server.js
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const { getOrCreateRoom, getRoom, removeUserFromRoom } = require("./rooms");
const { addOperation, undo, redo, clear } = require("./drawing-state");

const app = express();
const server = http.createServer(app);

const allowedOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(",").map(origin => origin.trim())
  : ["http://localhost:5173"];

app.use(cors({ origin: allowedOrigins }));

const io = new Server(server, {
  cors: { origin: allowedOrigins, methods: ["GET", "POST"] }
});

app.get("/", (req, res) => res.send("Realtime Collaborative Canvas Backend"));

function pickColor(input, socketId) {
  if (typeof input === "string" && input.trim()) return input.trim();
  let hash = 0;
  for (let i = 0; i < socketId.length; i++) hash = (hash * 31 + socketId.charCodeAt(i)) >>> 0;
  const hue = hash % 360;
  return `hsl(${hue} 85% 55%)`;
}

function safeRoomId(roomId) {
  const id = (roomId || "").toString().trim();
  if (!id) return "lobby";
  return id.replace(/\s+/g, "-").slice(0, 40);
}

function safeName(name) {
  const n = (name || "User").toString().trim();
  return (n || "User").slice(0, 20);
}

function validateOperation(op) {
  if (!op || typeof op !== "object") return false;
  if (op.type !== "brush" && op.type !== "eraser") return false;
  if (typeof op.id !== "string" || !op.id) return false;
  if (!Array.isArray(op.points) || op.points.length < 1) return false;
  if (typeof op.width !== "number" || !Number.isFinite(op.width) || op.width <= 0 || op.width > 100) return false;
  if (typeof op.color !== "string") return false;

  for (const p of op.points) {
    const x = Number(p?.x);
    const y = Number(p?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  }
  return true;
}

function getPlayers(roomId) {
  const room = getRoom(roomId);
  if (!room) return [];
  return Array.from(room.users.values()).map((u) => ({
    id: u.id,
    name: u.name,
    color: u.color,
    cursor: u.cursor || null
  }));
}

function broadcastPlayers(roomId) {
  io.to(roomId).emit("room:players", { roomId, players: getPlayers(roomId) });
}

function leaveCurrentRoom(socket) {
  const currentRoomId = socket.data.roomId;
  if (!currentRoomId) return;

  removeUserFromRoom(currentRoomId, socket.id);
  socket.leave(currentRoomId);
  socket.data.roomId = null;

  broadcastPlayers(currentRoomId);
}

io.on("connection", (socket) => {
  console.log("client connected", socket.id);

  socket.on("room:join", (payload) => {
    const roomId = safeRoomId(payload?.roomId);
    const name = safeName(payload?.userName);
    const color = pickColor(payload?.color, socket.id);

    leaveCurrentRoom(socket);

    const room = getOrCreateRoom(roomId);
    room.users.set(socket.id, {
      id: socket.id,
      name,
      color,
      cursor: null,
      joinedAt: Date.now()
    });

    socket.data.roomId = roomId;
    socket.join(roomId);

    socket.emit("canvas:state", { roomId, operations: room.operations });
    broadcastPlayers(roomId);

    console.log(`socket ${socket.id} joined room ${roomId}`);
  });

  socket.on("room:leave", () => {
    leaveCurrentRoom(socket);
  });

  socket.on("cursor:move", (payload) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const x = Number(payload?.x);
    const y = Number(payload?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;

    const room = getRoom(roomId);
    if (!room) return;

    const u = room.users.get(socket.id);
    if (!u) return;

    u.cursor = { x, y };
    room.users.set(socket.id, u);

    socket.to(roomId).emit("cursor:update", { userId: socket.id, cursor: { x, y } });
  });

  // Live stroke previews (not stored)
  socket.on("stroke:update", (operation) => {
    const roomId = socket.data.roomId;
    if (!roomId || roomId === "lobby") return;
    if (!validateOperation(operation)) return;

    socket.to(roomId).emit("stroke:update", { operation });
  });

  // Stroke finished: store in history with userId
  socket.on("stroke:end", (operation) => {
    const roomId = socket.data.roomId;
    if (!roomId || roomId === "lobby") return;

    if (!validateOperation(operation)) return;

    const room = getOrCreateRoom(roomId);
    const opToStore = { ...operation, userId: socket.id, timestamp: Date.now() };

    addOperation(room, opToStore);
    io.to(roomId).emit("stroke:created", { roomId, operation: opToStore });
  });

  // Global undo: remove the most recent operation in the room (regardless of author).
  socket.on("canvas:undo", () => {
    const roomId = socket.data.roomId;
    if (!roomId || roomId === "lobby") return;

    const room = getRoom(roomId);
    if (!room) return;

    const undoneOp = undo(room);
    if (undoneOp) {
      io.to(roomId).emit("canvas:state", { roomId, operations: room.operations });
    }
  });

  // Global redo: restore the most recently undone operation in the room.
  socket.on("canvas:redo", () => {
    const roomId = socket.data.roomId;
    if (!roomId || roomId === "lobby") return;

    const room = getRoom(roomId);
    if (!room) return;

    const redoneOp = redo(room);
    if (redoneOp) {
      io.to(roomId).emit("canvas:state", { roomId, operations: room.operations });
    }
  });

  // Clear mine: remove ONLY this user's brush strokes, keep all erasers
  socket.on("canvas:clearMine", () => {
    const roomId = socket.data.roomId;
    const userId = socket.id;
    if (!roomId || roomId === "lobby") return;

    const room = getRoom(roomId);
    if (!room) return;

    room.operations = room.operations.filter(
      (op) => !(op.userId === userId && op.type === "brush")
    );

    // Keep global redo stack consistent too.
    if (Array.isArray(room.redoStack) && room.redoStack.length) {
      room.redoStack = room.redoStack.filter(
        (op) => !(op.userId === userId && op.type === "brush")
      );
    }

    io.to(roomId).emit("canvas:state", { roomId, operations: room.operations });
  });

  // Optional global clear (kept for reference, not used by UI)
  socket.on("canvas:clear", () => {
    const roomId = socket.data.roomId;
    if (!roomId || roomId === "lobby") return;

    const room = getRoom(roomId);
    if (!room) return;

    clear(room);
    io.to(roomId).emit("canvas:state", { roomId, operations: [] });
  });

  socket.on("disconnect", () => {
    leaveCurrentRoom(socket);
    console.log("client disconnected", socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
