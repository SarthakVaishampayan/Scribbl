
const rooms = new Map();


function createRoom(roomId) {
  return {
    id: roomId,
    users: new Map(),
    operations: [],
    redoStack: []
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


  if (room.users.size === 0 && roomId !== "lobby") {
    rooms.delete(roomId);
  }
}

module.exports = {
  getOrCreateRoom,
  getRoom,
  removeUserFromRoom
};
