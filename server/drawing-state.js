// server/drawing-state.js

function addOperation(room, operation) {
  room.operations.push(operation);
  room.undone = [];
}

function undo(room) {
  if (!room.operations.length) return null;
  const op = room.operations.pop();
  room.undone.push(op);
  return op;
}

function redo(room) {
  if (!room.undone.length) return null;
  const op = room.undone.pop();
  room.operations.push(op);
  return op;
}

function clear(room) {
  room.operations = [];
  room.undone = [];
}

module.exports = {
  addOperation,
  undo,
  redo,
  clear
};
