/* eslint-disable react-hooks/immutability */
// src/src/components/CanvasBoard.jsx
import React, {
  useEffect,
  useRef,
  useCallback,
  useMemo,
  forwardRef,
  useImperativeHandle
} from "react";
import io from "socket.io-client";
import { v4 as uuidv4 } from "uuid";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

const CanvasBoard = forwardRef(
  ({ roomId, userName, currentTool, currentColor, strokeWidth, onPlayersUpdate }, ref) => {
    const canvasRef = useRef(null);
    const wrapperRef = useRef(null);
    const socketRef = useRef(null);

    // Canvas and rendering state are held in refs to avoid re-rendering at pointer frequency.
    const ctxRef = useRef(null);
    const isDrawingRef = useRef(false);
    const currentStrokeIdRef = useRef(null);
    const currentPointsRef = useRef([]);

    // Authoritative committed operations (from server) + live previews (in-progress strokes).
    const committedOpsRef = useRef([]);
    const previewByStrokeIdRef = useRef(new Map()); // strokeId -> operation

    const playersRef = useRef([]);
    const [, forceUiUpdate] = React.useReducer((x) => x + 1, 0);

    const CANVAS_WIDTH = 1000;
    const CANVAS_HEIGHT = 600;

    const rafIdRef = useRef(null);
    const lastCursorSentAtRef = useRef(0);
    const lastStrokeUpdateSentAtRef = useRef(0);
    const [connectionStatus, setConnectionStatus] = React.useState("connecting"); // connecting | connected | disconnected

    const eraserCursor = useMemo(() => {
      const size = Math.max(strokeWidth * 2, 16);
      const half = size / 2;

      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
          <circle cx="${half}" cy="${half}" r="${half - 2}"
            fill="rgba(255,255,255,0.45)"
            stroke="%23000000"
            stroke-width="2"
            stroke-dasharray="4,2" />
        </svg>
      `;
      const encoded = encodeURIComponent(svg.trim());
      return `url("data:image/svg+xml,${encoded}") ${half} ${half}, auto`;
    }, [strokeWidth]);

    const clearCanvas = useCallback((context) => {
      if (!context) return;
      context.save();
      context.globalCompositeOperation = "source-over";
      context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      context.restore();
    }, []);

    // Simple path smoothing: quadratic curves between midpoints.
    // This improves visual smoothness without a heavy algorithm.
    function strokePath(context, points) {
      if (!points || points.length < 2) return;

      context.beginPath();
      context.moveTo(points[0].x, points[0].y);

      if (points.length === 2) {
        context.lineTo(points[1].x, points[1].y);
        return;
      }

      for (let i = 1; i < points.length - 1; i++) {
        const curr = points[i];
        const next = points[i + 1];
        const midX = (curr.x + next.x) / 2;
        const midY = (curr.y + next.y) / 2;
        context.quadraticCurveTo(curr.x, curr.y, midX, midY);
      }
      const last = points[points.length - 1];
      context.lineTo(last.x, last.y);
    }

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

      strokePath(context, op.points);
      context.stroke();
      context.restore();
    }, []);

    const scheduleRender = useCallback(() => {
      if (rafIdRef.current != null) return;
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        const context = ctxRef.current;
        if (!context) return;

        clearCanvas(context);

        // 1) Draw committed operations (authoritative)
        for (const op of committedOpsRef.current) drawOperation(context, op);

        // 2) Draw all in-progress previews last
        for (const op of previewByStrokeIdRef.current.values()) drawOperation(context, op);
      });
    }, [clearCanvas, drawOperation]);

    // Expose undo/redo/clearMine to parent
    useImperativeHandle(ref, () => ({
      undo() {
        socketRef.current?.emit("canvas:undo");
      },
      redo() {
        socketRef.current?.emit("canvas:redo");
      },
      clearMine() {
        socketRef.current?.emit("canvas:clearMine");
      }
    }));

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;

      const context = canvas.getContext("2d");
      context.lineCap = "round";
      context.lineJoin = "round";
      ctxRef.current = context;

      clearCanvas(context);
    }, [clearCanvas]);

    useEffect(() => {
      // Socket lifecycle + basic error handling (no app behavior changes; UI-only status).
      socketRef.current = io(SOCKET_URL, { transports: ["websocket", "polling"] });

      socketRef.current.on("connect", () => setConnectionStatus("connected"));
      socketRef.current.on("disconnect", () => setConnectionStatus("disconnected"));
      socketRef.current.on("connect_error", () => setConnectionStatus("disconnected"));

      socketRef.current.on("room:players", ({ players: serverPlayers }) => {
        playersRef.current = serverPlayers || [];
        if (typeof onPlayersUpdate === "function") onPlayersUpdate(playersRef.current);
        forceUiUpdate();
      });

      socketRef.current.on("cursor:update", ({ userId, cursor }) => {
        playersRef.current = (playersRef.current || []).map((p) =>
          p.id === userId ? { ...p, cursor } : p
        );
        if (typeof onPlayersUpdate === "function") onPlayersUpdate(playersRef.current);
        forceUiUpdate();
      });

      socketRef.current.on("canvas:state", ({ operations }) => {
        committedOpsRef.current = operations || [];
        previewByStrokeIdRef.current = new Map();
        scheduleRender();
      });

      socketRef.current.on("stroke:update", ({ operation }) => {
        if (!operation?.id) return;
        // Store preview (so we don't permanently draw it and then draw again on finalize)
        previewByStrokeIdRef.current.set(operation.id, operation);
        scheduleRender();
      });

      socketRef.current.on("stroke:created", ({ operation }) => {
        if (!operation?.id) return;
        // Remove preview and commit operation to the authoritative layer
        previewByStrokeIdRef.current.delete(operation.id);
        committedOpsRef.current = [...committedOpsRef.current, operation];
        scheduleRender();
      });

      return () => {
        socketRef.current?.disconnect();
      };
    }, [drawOperation, onPlayersUpdate, scheduleRender]);

    useEffect(() => {
      if (!socketRef.current) return;
      if (!roomId) return;

      scheduleRender();

      socketRef.current.emit("room:join", { roomId, userName });
    }, [roomId, userName, scheduleRender]);

    const getMousePos = useCallback((e) => {
      const rect = canvasRef.current.getBoundingClientRect();
      return {
        x: ((e.clientX - rect.left) * CANVAS_WIDTH) / rect.width,
        y: ((e.clientY - rect.top) * CANVAS_HEIGHT) / rect.height
      };
    }, []);

    const startDrawing = useCallback(
      (e) => {
        const ctx = ctxRef.current;
        if (!ctx) return;
        if (!roomId || roomId === "lobby") return;

        const pos = getMousePos(e);
        const strokeId = uuidv4();
        isDrawingRef.current = true;
        currentStrokeIdRef.current = strokeId;
        currentPointsRef.current = [pos];

        // Put local stroke into the preview map immediately so rendering is unified.
        previewByStrokeIdRef.current.set(strokeId, {
          id: strokeId,
          type: currentTool,
          color: currentColor,
          width: strokeWidth,
          points: [pos]
        });
        scheduleRender();
      },
      [roomId, getMousePos, currentTool, currentColor, strokeWidth, scheduleRender]
    );

    const draw = useCallback(
      (e) => {
        const ctx = ctxRef.current;
        if (!ctx) return;
        if (!isDrawingRef.current) return;
        if (!currentStrokeIdRef.current) return;

        const pos = getMousePos(e);
        const points = currentPointsRef.current;
        const last = points[points.length - 1];

        // Point filtering to reduce noise and event frequency (helps CPU + network).
        // Threshold scales with stroke width to avoid "gaps" on thick strokes.
        const minDist = Math.max(0.5, strokeWidth * 0.15);
        const dx = pos.x - last.x;
        const dy = pos.y - last.y;
        if (dx * dx + dy * dy < minDist * minDist) return;

        const nextPoints = [...points, pos];
        currentPointsRef.current = nextPoints;

        // Update local preview and schedule a render on the next animation frame.
        previewByStrokeIdRef.current.set(currentStrokeIdRef.current, {
          id: currentStrokeIdRef.current,
          type: currentTool,
          color: currentColor,
          width: strokeWidth,
          points: nextPoints
        });
        scheduleRender();

        const now = performance.now();

        // Batch stroke updates (streaming strategy): send at most ~30fps.
        if (now - lastStrokeUpdateSentAtRef.current > 33) {
          lastStrokeUpdateSentAtRef.current = now;
          socketRef.current?.emit("stroke:update", {
            id: currentStrokeIdRef.current,
            type: currentTool,
            color: currentColor,
            width: strokeWidth,
            points: nextPoints
          });
        }

        // Throttle cursor updates separately.
        if (now - lastCursorSentAtRef.current > 50) {
          lastCursorSentAtRef.current = now;
          socketRef.current?.emit("cursor:move", { x: pos.x, y: pos.y });
        }
      },
      [currentTool, currentColor, strokeWidth, getMousePos, scheduleRender]
    );

    const stopDrawing = useCallback(() => {
      const strokeId = currentStrokeIdRef.current;
      const points = currentPointsRef.current;
      if (!strokeId || points.length < 2) {
        isDrawingRef.current = false;
        currentPointsRef.current = [];
        currentStrokeIdRef.current = null;
        if (strokeId) previewByStrokeIdRef.current.delete(strokeId);
        scheduleRender();
        return;
      }

      isDrawingRef.current = false;

      const operation = {
        id: strokeId,
        type: currentTool,
        color: currentColor,
        width: strokeWidth,
        points
      };

      socketRef.current?.emit("stroke:end", operation);
      // Keep preview until server confirms stroke:created (authoritative commit).
      currentPointsRef.current = [];
      currentStrokeIdRef.current = null;
      scheduleRender();
    }, [currentTool, currentColor, strokeWidth, scheduleRender]);

    useEffect(() => {
      const canvas = canvasRef.current;
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

    const toCssPos = useCallback((cursor) => {
      const wrapper = wrapperRef.current;
      if (!wrapper || !cursor) return null;
      const rect = wrapper.getBoundingClientRect();
      return {
        left: (cursor.x / CANVAS_WIDTH) * rect.width,
        top: (cursor.y / CANVAS_HEIGHT) * rect.height
      };
    }, []);

    return (
      <div
        ref={wrapperRef}
        className="canvas-wrapper"
        style={{ position: "relative", width: "1000px", height: "600px" }}
      >
        {connectionStatus !== "connected" && (
          <div
            style={{
              position: "absolute",
              left: 12,
              top: 12,
              zIndex: 20,
              padding: "8px 10px",
              borderRadius: 10,
              background: "rgba(0,0,0,0.65)",
              color: "white",
              fontSize: 12,
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(255,255,255,0.18)"
            }}
          >
            {connectionStatus === "connecting" ? "Connecting…" : "Disconnected. Reconnecting…"}
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="canvas-board"
          style={{
            border: "2px solid #ddd",
            borderRadius: "8px",
            cursor: currentTool === "eraser" ? eraserCursor : "crosshair",
            background: "white"
          }}
        />

        <div className="cursor-overlay">
          {(playersRef.current || [])
            .filter((p) => p.id !== socketRef.current?.id)
            .filter((p) => p.cursor)
            .map((p) => {
              const cssPos = toCssPos(p.cursor);
              if (!cssPos) return null;
              return (
                <div
                  key={p.id}
                  className="remote-cursor"
                  style={{
                    left: `${cssPos.left}px`,
                    top: `${cssPos.top}px`,
                    background: p.color,
                    color: "white"
                  }}
                  title={p.name}
                >
                  {p.name.slice(0, 2).toUpperCase()}
                </div>
              );
            })}
        </div>
      </div>
    );
  }
);

export default CanvasBoard;
