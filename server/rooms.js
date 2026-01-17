// server/rooms.js
const rooms = new Map();

/**
 * Room shape:
 * {
 *   id: string,
 *   users: Map<socketId, { id, name, color, cursor, joinedAt }>,
 *   operations: Array<any>,
 *   // per-user undo stacks:
 *   undoneByUser: Map<userId, Array<any>>
 * }
 */

function createRoom(roomId) {
  return {
    id: roomId,
    users: new Map(),
    operations: [],
    undoneByUser: new Map()
  };
}

function getOrCreateRoom(roomId) {
  const id = (roomId || "lobby").toString();
  if (!rooms.has(id)) rooms.set(id, createRoom(id));
  return rooms.get(id);
}

function getRoom(roomId) {
  return rooms.get(roomId);
}

function removeUserFromRoom(roomId, socketId) {
  const room = rooms.get(roomId);
  if (!room) return;

  room.users.delete(socketId);
  if (room.undoneByUser) {
    room.undoneByUser.delete(socketId);
  }

  // If no users left, drop room to free memory
  if (room.users.size === 0 && roomId !== "lobby") {
    rooms.delete(roomId);
  }
}

module.exports = {
  getOrCreateRoom,
  getRoom,
  removeUserFromRoom
};
