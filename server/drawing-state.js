

function ensureRedoStack(room) {
  if (!Array.isArray(room.redoStack)) room.redoStack = [];
}


function addOperation(room, operation) {
  room.operations.push(operation);
  ensureRedoStack(room);
  
  room.redoStack = [];
}


function undo(room) {
  if (!room.operations.length) return null;
  ensureRedoStack(room);

  const op = room.operations.pop();
  room.redoStack.push(op);
  return op;
}


function redo(room) {
  ensureRedoStack(room);
  if (!room.redoStack.length) return null;

  const op = room.redoStack.pop();
  room.operations.push(op);
  return op;
}

function clear(room) {
  room.operations = [];
  room.redoStack = [];
}

module.exports = { addOperation, undo, redo, clear };
