// server/drawing-state.js
//
// Canvas state is represented as an ordered list of stroke operations.
// For strict global undo/redo we treat this list as a timeline:
// - undo() removes the most recent operation (regardless of author)
// - redo() restores the most recently undone operation

function ensureRedoStack(room) {
  if (!Array.isArray(room.redoStack)) room.redoStack = [];
}

// Add a new operation to the end of the timeline.
// Global redo stack is cleared when any new operation is appended (standard editor behavior).
function addOperation(room, operation) {
  room.operations.push(operation);
  ensureRedoStack(room);
  // Any new draw invalidates redo history, otherwise redo could re-apply
  // operations that are no longer "after" the current timeline head.
  room.redoStack = [];
}

// Global undo: remove the latest operation (whoever drew it).
function undo(room) {
  if (!room.operations.length) return null;
  ensureRedoStack(room);

  const op = room.operations.pop();
  room.redoStack.push(op);
  return op;
}

// Global redo: restore the most recently undone operation.
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
