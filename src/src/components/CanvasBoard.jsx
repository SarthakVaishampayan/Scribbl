/* eslint-disable react-hooks/refs */
/* eslint-disable react-hooks/immutability */
// D:\project\collaborative canvas\src\src\components\CanvasBoard.jsx
import React, { useEffect, useRef, useCallback, useState, useMemo } from "react";
import io from "socket.io-client";
import { v4 as uuidv4 } from "uuid";

const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 600;

const CURSOR_EMIT_MS = 16; // ~60fps
const LIVE_EMIT_MS = 33;   // ~30fps
const MIN_DIST = 2.5;

const CanvasBoard = ({ currentTool, currentColor, strokeWidth, onUsersUpdate }) => {
  const baseCanvasRef = useRef(null);
  const liveCanvasRef = useRef(null);

  const baseCtxRef = useRef(null);
  const liveCtxRef = useRef(null);

  const socketRef = useRef(null);
  const didInitSocketRef = useRef(false);

  const [users, setUsers] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);

  const strokeIdRef = useRef(null);
  const pointsRef = useRef([]);
  const lastPointRef = useRef(null);

  const lastCursorEmitRef = useRef(0);
  const lastLiveEmitRef = useRef(0);

  const remoteLiveMapRef = useRef(new Map());

  const eraserCursor = useMemo(() => {
    const size = Math.max(strokeWidth * 2, 16);
    const halfSize = size / 2;

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <circle cx="${halfSize}" cy="${halfSize}" r="${halfSize - 2}"
          fill="rgba(255,255,255,0.45)"
          stroke="%23ff4444"
          stroke-width="2"
          stroke-dasharray="4,2" />
      </svg>
    `;

    const encoded = encodeURIComponent(svg.trim());
    return `url("data:image/svg+xml,${encoded}") ${halfSize} ${halfSize}, auto`;
  }, [strokeWidth]);

  const getMousePos = useCallback((e) => {
    const rect = baseCanvasRef.current.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) * CANVAS_WIDTH) / rect.width,
      y: ((e.clientY - rect.top) * CANVAS_HEIGHT) / rect.height
    };
  }, []);

  const drawOperation = useCallback((context, op) => {
    if (!context || !op?.points || op.points.length < 2) return;

    context.save();

    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = op.width || 5;

    if (op.type === "eraser") {
      context.globalCompositeOperation = "destination-out";
      context.strokeStyle = "#ffffff";
    } else {
      context.globalCompositeOperation = "source-over";
      context.strokeStyle = op.color || "#000000";
    }

    context.beginPath();
    context.moveTo(op.points[0].x, op.points[0].y);
    for (let i = 1; i < op.points.length; i++) {
      context.lineTo(op.points[i].x, op.points[i].y);
    }
    context.stroke();

    context.restore();
  }, []);

  const redrawLiveOverlay = useCallback(() => {
    const liveCtx = liveCtxRef.current;
    if (!liveCtx) return;

    liveCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Only draw brush strokes on overlay (erasers go to base canvas)
    for (const op of remoteLiveMapRef.current.values()) {
      if (op.type !== "eraser") {
        drawOperation(liveCtx, op);
      }
    }
  }, [drawOperation]);

  useEffect(() => {
    const base = baseCanvasRef.current;
    const live = liveCanvasRef.current;
    if (!base || !live) return;

    base.width = CANVAS_WIDTH;
    base.height = CANVAS_HEIGHT;
    live.width = CANVAS_WIDTH;
    live.height = CANVAS_HEIGHT;

    const baseCtx = base.getContext("2d");
    baseCtx.lineCap = "round";
    baseCtx.lineJoin = "round";
    baseCtx.fillStyle = "#ffffff";
    baseCtx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const liveCtx = live.getContext("2d");
    liveCtx.lineCap = "round";
    liveCtx.lineJoin = "round";

    baseCtxRef.current = baseCtx;
    liveCtxRef.current = liveCtx;
  }, []);

  useEffect(() => {
    if (didInitSocketRef.current) return;
    didInitSocketRef.current = true;

    const socket = io("http://localhost:5000");
    socketRef.current = socket;

    socket.on("connect", () => {
      const randomName = `User-${socket.id.slice(0, 4)}`;
      socket.emit("joinRoom", { roomId: "default", userName: randomName });
    });

    socket.on("usersUpdate", (usersList) => {
      setUsers(usersList);
      if (typeof onUsersUpdate === "function") onUsersUpdate(usersList);
    });

    socket.on("cursorUpdate", ({ userId, cursor }) => {
      setUsers((prev) => {
        const next = prev.map((u) => (u.id === userId ? { ...u, cursor } : u));
        if (typeof onUsersUpdate === "function") onUsersUpdate(next);
        return next;
      });
    });

    socket.on("canvasState", (operations) => {
      const baseCtx = baseCtxRef.current;
      if (!baseCtx) return;

      baseCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      baseCtx.fillStyle = "#ffffff";
      baseCtx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      operations.forEach((op) => drawOperation(baseCtx, op));

      remoteLiveMapRef.current.clear();
      redrawLiveOverlay();
    });

    socket.on("strokeCreated", (opToStore) => {
      const baseCtx = baseCtxRef.current;
      if (!baseCtx) return;

      drawOperation(baseCtx, opToStore);

      const key = `${opToStore.userId}:${opToStore.id}`;
      remoteLiveMapRef.current.delete(key);
      redrawLiveOverlay();
    });

    // UPDATED: Handle live strokes (brush on overlay, eraser on base)
    socket.on("strokeLive", ({ userId, op }) => {
      if (!userId || !op?.id) return;
      if (userId === socket.id) return;

      const key = `${userId}:${op.id}`;
      
      if (op.type === "eraser") {
        // ERASER: Apply directly to base canvas (live preview)
        const baseCtx = baseCtxRef.current;
        if (baseCtx) {
          drawOperation(baseCtx, op);
        }
        // Don't store in map (no need to redraw on overlay)
      } else {
        // BRUSH: Store and draw on overlay
        const existing = remoteLiveMapRef.current.get(key);

        if (!existing) {
          remoteLiveMapRef.current.set(key, { ...op, points: [...op.points] });
        } else {
          const last = existing.points[existing.points.length - 1];
          const incoming = op.points || [];
          const startIdx =
            last && incoming[0] && last.x === incoming[0].x && last.y === incoming[0].y ? 1 : 0;
          existing.points.push(...incoming.slice(startIdx));
        }

        redrawLiveOverlay();
      }
    });

    socket.on("strokeLiveEnd", ({ userId, strokeId }) => {
      if (!userId) return;

      if (strokeId === "*") {
        for (const key of remoteLiveMapRef.current.keys()) {
          if (key.startsWith(`${userId}:`)) remoteLiveMapRef.current.delete(key);
        }
      } else {
        remoteLiveMapRef.current.delete(`${userId}:${strokeId}`);
      }

      redrawLiveOverlay();
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      didInitSocketRef.current = false;
    };
  }, [drawOperation, redrawLiveOverlay, onUsersUpdate]);

  const emitCursorThrottled = useCallback((x, y) => {
    const now = Date.now();
    if (now - lastCursorEmitRef.current < CURSOR_EMIT_MS) return;
    lastCursorEmitRef.current = now;
    socketRef.current?.emit("cursorMove", { x, y });
  }, []);

  const shouldAddPoint = (p) => {
    if (!lastPointRef.current) return true;
    const dx = p.x - lastPointRef.current.x;
    const dy = p.y - lastPointRef.current.y;
    return Math.sqrt(dx * dx + dy * dy) >= MIN_DIST;
  };

  const startDrawing = useCallback(
    (e) => {
      const ctx = baseCtxRef.current;
      if (!ctx) return;

      setIsDrawing(true);

      const pos = getMousePos(e);
      strokeIdRef.current = uuidv4();
      pointsRef.current = [pos];
      lastPointRef.current = pos;

      ctx.lineWidth = strokeWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (currentTool === "brush") {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = currentColor;
      } else {
        ctx.globalCompositeOperation = "destination-out";
        ctx.strokeStyle = "#ffffff";
      }

      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);

      emitCursorThrottled(pos.x, pos.y);
    },
    [getMousePos, currentTool, currentColor, strokeWidth, emitCursorThrottled]
  );

  const draw = useCallback(
    (e) => {
      if (!isDrawing) return;
      const ctx = baseCtxRef.current;
      if (!ctx) return;

      const pos = getMousePos(e);

      if (!shouldAddPoint(pos)) {
        emitCursorThrottled(pos.x, pos.y);
        return;
      }

      const prev = lastPointRef.current;
      lastPointRef.current = pos;

      pointsRef.current = [...pointsRef.current, pos];

      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();

      // Live segment emit (works for BOTH brush and eraser now)
      const now = Date.now();
      if (prev && now - lastLiveEmitRef.current >= LIVE_EMIT_MS) {
        lastLiveEmitRef.current = now;
        socketRef.current?.emit("strokeLive", {
          id: strokeIdRef.current,
          type: currentTool,      // "brush" or "eraser"
          color: currentColor,
          width: strokeWidth,
          points: [prev, pos]
        });
      }

      emitCursorThrottled(pos.x, pos.y);
    },
    [isDrawing, getMousePos, currentTool, currentColor, strokeWidth, emitCursorThrottled]
  );

  const stopDrawing = useCallback(() => {
    if (!isDrawing) return;
    setIsDrawing(false);

    const pts = pointsRef.current;
    if (!pts || pts.length < 2) {
      pointsRef.current = [];
      strokeIdRef.current = null;
      lastPointRef.current = null;
      return;
    }

    const finalOp = {
      id: strokeIdRef.current,
      type: currentTool,
      color: currentColor,
      width: strokeWidth,
      points: pts
    };

    socketRef.current?.emit("strokeEnd", finalOp);

    pointsRef.current = [];
    strokeIdRef.current = null;
    lastPointRef.current = null;
  }, [isDrawing, currentTool, currentColor, strokeWidth]);

  useEffect(() => {
    const canvas = baseCanvasRef.current;
    if (!canvas) return;

    canvas.addEventListener("mousedown", startDrawing);
    canvas.addEventListener("mousemove", draw);
    canvas.addEventListener("mouseup", stopDrawing);
    canvas.addEventListener("mouseleave", stopDrawing);

    return () => {
      canvas.removeEventListener("mousedown", startDrawing);
      canvas.removeEventListener("mousemove", draw);
      canvas.removeEventListener("mouseup", stopDrawing);
      canvas.removeEventListener("mouseleave", stopDrawing);
    };
  }, [startDrawing, draw, stopDrawing]);

  return (
    <div className="canvas-wrapper" style={{ position: "relative", width: "1000px", height: "600px" }}>
      <canvas
        ref={baseCanvasRef}
        className="canvas-board"
        style={{
          border: "2px solid #ddd",
          borderRadius: "8px",
          cursor: currentTool === "eraser" ? eraserCursor : "crosshair",
          background: "white",
          position: "absolute",
          left: 0,
          top: 0
        }}
      />

      <canvas
        ref={liveCanvasRef}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          pointerEvents: "none"
        }}
      />

      <div className="cursor-overlay">
        {users
          .filter((u) => u.id !== socketRef.current?.id)
          .filter((u) => u.cursor)
          .map((u) => (
            <div
              key={u.id}
              className="remote-cursor"
              style={{
                left: `${u.cursor.x}px`,
                top: `${u.cursor.y}px`,
                background: u.color,
                color: "white"
              }}
              title={u.name}
            >
              {u.name.slice(0, 2).toUpperCase()}
            </div>
          ))}
      </div>
    </div>
  );
};

export default CanvasBoard;
