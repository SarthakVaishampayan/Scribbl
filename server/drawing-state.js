// D:\project\collaborative canvas\server\drawing-state.js

const MAX_OPS = 1500;

function ensureRedoStack(room, userId) {
  if (!room.redoStacks) room.redoStacks = new Map();
  if (!room.redoStacks.has(userId)) room.redoStacks.set(userId, []);
  return room.redoStacks.get(userId);
}

function addOperation(room, operation) {
  room.operations.push(operation);

  // New action clears redo for that user
  if (operation.userId) {
    const redo = ensureRedoStack(room, operation.userId);
    redo.length = 0;
  }

  if (room.operations.length > MAX_OPS) {
    room.operations.splice(0, room.operations.length - MAX_OPS);
  }
}

function undoLastByUser(room, userId) {
  const redo = ensureRedoStack(room, userId);

  for (let i = room.operations.length - 1; i >= 0; i--) {
    const op = room.operations[i];
    if (op.userId === userId) {
      const [removed] = room.operations.splice(i, 1);
      redo.push(removed);
      return removed;
    }
  }
  return null;
}

function redoLastByUser(room, userId) {
  const redo = ensureRedoStack(room, userId);
  const op = redo.pop();
  if (!op) return null;

  room.operations.push(op);
  return op;
}

/**
 * STEP 10 (adjusted):
 * Clear ONLY my brush strokes.
 * Keep my eraser ops so erased parts stay erased after replay.
 */
function clearMyBrushStrokes(room, userId) {
  const before = room.operations.length;

  room.operations = room.operations.filter(
    (op) => !(op.userId === userId && op.type === "brush")
  );

  // Also remove brush ops from redo stack so user can't "redo" cleared drawings
  const redo = ensureRedoStack(room, userId);
  const kept = redo.filter((op) => op.type !== "brush");
  redo.splice(0, redo.length, ...kept);

  return before - room.operations.length;
}

module.exports = {
  addOperation,
  undoLastByUser,
  redoLastByUser,
  clearMyBrushStrokes
};
