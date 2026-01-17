// server/drawing-state.js

// Ensure per-user undo map exists
function ensureUndoneMap(room) {
  if (!room.undoneByUser) {
    room.undoneByUser = new Map();
  }
}

// Add new operation and reset that user's redo stack
function addOperation(room, operation) {
  room.operations.push(operation);
  ensureUndoneMap(room);
  const userId = operation.userId;
  if (!room.undoneByUser.has(userId)) {
    room.undoneByUser.set(userId, []);
  }
  // Clear that user's redo stack when they draw something new
  room.undoneByUser.set(userId, []);
}

// Per-user undo: remove last operation by this user
function undo(room, userId) {
  if (!room.operations.length) return null;
  ensureUndoneMap(room);

  // Find last operation authored by this user, starting from end
  let idx = -1;
  for (let i = room.operations.length - 1; i >= 0; i--) {
    if (room.operations[i].userId === userId) {
      idx = i;
      break;
    }
  }
  if (idx === -1) return null;

  const [op] = room.operations.splice(idx, 1);

  if (!room.undoneByUser.has(userId)) {
    room.undoneByUser.set(userId, []);
  }
  const stack = room.undoneByUser.get(userId);
  stack.push(op);
  room.undoneByUser.set(userId, stack);

  return op;
}

// Per-user redo: restore last undone op of this user
function redo(room, userId) {
  ensureUndoneMap(room);
  const stack = room.undoneByUser.get(userId);
  if (!stack || !stack.length) return null;

  const op = stack.pop();
  room.operations.push(op);
  return op;
}

// Global clear (unused by "clear mine", but kept for completeness)
function clear(room) {
  room.operations = [];
  room.undoneByUser = new Map();
}

module.exports = {
  addOperation,
  undo,
  redo,
  clear
};
