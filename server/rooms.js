// server/rooms.js
const rooms = new Map();

/**
 * Room shape:
 * {
 *   id: string,
 *   users: Map<socketId, { id, name, color, cursor: {x,y}|null, joinedAt }>,
 *   operations: Array<any>,
 *   undone: Array<any>
 * }
 */

function createRoom(roomId) {
  return {
    id: roomId,
    users: new Map(),
    operations: [],
    undone: []
  };
}

function getOrCreateRoom(roomId) {
  const id = roomId || "default";
  if (!rooms.has(id)) rooms.set(id, createRoom(id));
  return rooms.get(id);
}

function getRoom(roomId) {
  return rooms.get(roomId);
}

function removeRoomIfEmpty(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  if (room.users.size === 0) rooms.delete(roomId);
}

function addUser(roomId, user) {
  const room = getOrCreateRoom(roomId);
  room.users.set(user.id, user);
  return room;
}

function removeUser(roomId, socketId) {
  const room = rooms.get(roomId);
  if (!room) return null;
  const user = room.users.get(socketId) || null;
  room.users.delete(socketId);
  removeRoomIfEmpty(roomId);
  return user;
}

function updateCursor(roomId, socketId, cursor) {
  const room = rooms.get(roomId);
  if (!room) return null;
  const user = room.users.get(socketId);
  if (!user) return null;
  user.cursor = cursor;
  room.users.set(socketId, user);
  return user;
}

function listUsers(roomId) {
  const room = rooms.get(roomId);
  if (!room) return [];
  return Array.from(room.users.values());
}

module.exports = {
  getOrCreateRoom,
  getRoom,
  addUser,
  removeUser,
  updateCursor,
  listUsers
};
