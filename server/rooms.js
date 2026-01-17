// D:\project\collaborative canvas\server\rooms.js
const rooms = new Map();

const getOrCreateRoom = (roomId) => {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      users: new Map(),
      operations: [],
      redoStacks: new Map() // userId -> [op, op, ...]
    });
  }
  return rooms.get(roomId);
};

const addUser = (roomId, user) => {
  const room = getOrCreateRoom(roomId);
  room.users.set(user.id, user);
  if (!room.redoStacks.has(user.id)) room.redoStacks.set(user.id, []);
};

const removeUser = (roomId, userId) => {
  const room = getOrCreateRoom(roomId);
  room.users.delete(userId);
  // keeping redo stack is fine; optional cleanup:
  // room.redoStacks.delete(userId);
};

const updateCursor = (roomId, userId, cursor) => {
  const room = getOrCreateRoom(roomId);
  const user = room.users.get(userId);
  if (user) user.cursor = cursor;
};

const listUsers = (roomId) => {
  const room = getOrCreateRoom(roomId);
  return Array.from(room.users.values());
};

module.exports = {
  getOrCreateRoom,
  addUser,
  removeUser,
  updateCursor,
  listUsers
};
