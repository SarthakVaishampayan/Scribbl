// server/server.js - COMPLETE (Step 6)
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const {
  getOrCreateRoom,
  addUser,
  removeUser,
  updateCursor,
  listUsers
} = require("./rooms");

const { addOperation } = require("./drawing-state");

const app = express();
const server = http.createServer(app);

app.use(cors({ origin: "http://localhost:5173" }));

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

app.get("/", (req, res) => {
  res.send("Realtime Collaborative Canvas Backend");
});

function pickColor(input, socketId) {
  if (typeof input === "string" && input.trim()) return input.trim();

  let hash = 0;
  for (let i = 0; i < socketId.length; i++) hash = (hash * 31 + socketId.charCodeAt(i)) >>> 0;
  const hue = hash % 360;
  return `hsl(${hue} 85% 55%)`;
}

function validateOperation(op) {
  if (!op || typeof op !== "object") return false;

  const okType = op.type === "brush" || op.type === "eraser";
  if (!okType) return false;

  if (typeof op.id !== "string" || !op.id) return false;
  if (!Array.isArray(op.points) || op.points.length < 2) return false;

  if (typeof op.width !== "number" || !Number.isFinite(op.width) || op.width <= 0 || op.width > 100) return false;

  // color can be any string for brush; for eraser we still accept but ignore on client
  if (typeof op.color !== "string") return false;

  for (const p of op.points) {
    if (!p) return false;
    const x = Number(p.x);
    const y = Number(p.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  }

  return true;
}

io.on("connection", (socket) => {
  console.log("New client connected", socket.id);

  socket.on("joinRoom", (payload) => {
    const roomId = payload?.roomId || "default";
    const userName = (payload?.userName || "User").toString().slice(0, 20);
    const color = pickColor(payload?.color, socket.id);

    socket.data.roomId = roomId;

    const room = getOrCreateRoom(roomId);

    const user = {
      id: socket.id,
      name: userName,
      color,
      cursor: null,
      joinedAt: Date.now()
    };

    addUser(roomId, user);
    socket.join(roomId);

    socket.emit("canvasState", room.operations);
    io.to(roomId).emit("usersUpdate", listUsers(roomId));
  });

  socket.on("cursorMove", (payload) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const x = Number(payload?.x);
    const y = Number(payload?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;

    updateCursor(roomId, socket.id, { x, y });

    socket.to(roomId).emit("cursorUpdate", {
      userId: socket.id,
      cursor: { x, y }
    });
  });

  // NEW: receive completed strokes
  socket.on("strokeEnd", (operation) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    if (!validateOperation(operation)) return;

    const room = getOrCreateRoom(roomId);

    // Attach author
    const opToStore = {
      ...operation,
      userId: socket.id,
      timestamp: Date.now()
    };

    addOperation(room, opToStore);

    // Broadcast to everyone in room (including sender)
    io.to(roomId).emit("strokeCreated", opToStore);
  });

  socket.on("disconnect", () => {
    const roomId = socket.data.roomId;
    if (roomId) {
      removeUser(roomId, socket.id);
      io.to(roomId).emit("usersUpdate", listUsers(roomId));
    }
    console.log("Client disconnected", socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
