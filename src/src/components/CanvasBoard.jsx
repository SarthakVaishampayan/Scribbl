/* eslint-disable react-hooks/immutability */
// src/src/components/CanvasBoard.jsx
import React, {
  useEffect,
  useRef,
  useCallback,
  useState,
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
    const socketRef = useRef(null);

    const [ctx, setCtx] = useState(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentPoints, setCurrentPoints] = useState([]);
    const [currentStrokeId, setCurrentStrokeId] = useState(null);
    const [players, setPlayers] = useState([]);

    const CANVAS_WIDTH = 1000;
    const CANVAS_HEIGHT = 600;

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
      for (let i = 1; i < op.points.length; i++) context.lineTo(op.points[i].x, op.points[i].y);
      context.stroke();
      context.restore();
    }, []);

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
      setCtx(context);

      clearCanvas(context);
    }, [clearCanvas]);

    useEffect(() => {
      socketRef.current = io(SOCKET_URL);

      socketRef.current.on("room:players", ({ players: serverPlayers }) => {
        setPlayers(serverPlayers || []);
        if (typeof onPlayersUpdate === "function") onPlayersUpdate(serverPlayers || []);
      });

      socketRef.current.on("cursor:update", ({ userId, cursor }) => {
        setPlayers((prev) => {
          const next = prev.map((p) => (p.id === userId ? { ...p, cursor } : p));
          if (typeof onPlayersUpdate === "function") onPlayersUpdate(next);
          return next;
        });
      });

      socketRef.current.on("canvas:state", ({ operations }) => {
        if (!ctx) return;
        clearCanvas(ctx);
        (operations || []).forEach((op) => drawOperation(ctx, op));
      });

      socketRef.current.on("stroke:update", ({ operation }) => {
        if (!ctx) return;
        drawOperation(ctx, operation);
      });

      socketRef.current.on("stroke:created", ({ operation }) => {
        if (!ctx) return;
        drawOperation(ctx, operation);
      });

      return () => {
        socketRef.current?.disconnect();
      };
    }, [ctx, clearCanvas, drawOperation, onPlayersUpdate]);

    useEffect(() => {
      if (!socketRef.current) return;
      if (!roomId) return;

      if (ctx) clearCanvas(ctx);

      socketRef.current.emit("room:join", { roomId, userName });
    }, [roomId, userName, ctx, clearCanvas]);

    const getMousePos = useCallback((e) => {
      const rect = canvasRef.current.getBoundingClientRect();
      return {
        x: ((e.clientX - rect.left) * CANVAS_WIDTH) / rect.width,
        y: ((e.clientY - rect.top) * CANVAS_HEIGHT) / rect.height
      };
    }, []);

    const startDrawing = useCallback(
      (e) => {
        if (!ctx) return;
        if (!roomId || roomId === "lobby") return;

        setIsDrawing(true);
        const pos = getMousePos(e);
        const strokeId = uuidv4();
        setCurrentStrokeId(strokeId);
        setCurrentPoints([pos]);

        if (currentTool === "brush") {
          ctx.strokeStyle = currentColor;
          ctx.lineWidth = strokeWidth;
          ctx.globalCompositeOperation = "source-over";
        } else {
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = strokeWidth;
          ctx.globalCompositeOperation = "destination-out";
        }

        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
      },
      [ctx, roomId, getMousePos, currentTool, currentColor, strokeWidth]
    );

    const draw = useCallback(
      (e) => {
        if (!isDrawing || !ctx || currentPoints.length === 0) return;

        const pos = getMousePos(e);
        const points = [...currentPoints, pos];
        setCurrentPoints(points);

        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();

        if (points.length % 3 === 0) {
          socketRef.current?.emit("stroke:update", {
            id: currentStrokeId,
            type: currentTool,
            color: currentColor,
            width: strokeWidth,
            points
          });
        }

        socketRef.current?.emit("cursor:move", { x: pos.x, y: pos.y });
      },
      [isDrawing, ctx, currentPoints, currentStrokeId, currentTool, currentColor, strokeWidth, getMousePos]
    );

    const stopDrawing = useCallback(() => {
      if (!isDrawing || currentPoints.length < 2) {
        setIsDrawing(false);
        setCurrentPoints([]);
        setCurrentStrokeId(null);
        return;
      }

      setIsDrawing(false);

      const operation = {
        id: currentStrokeId,
        type: currentTool,
        color: currentColor,
        width: strokeWidth,
        points: currentPoints
      };

      socketRef.current?.emit("stroke:end", operation);
      setCurrentPoints([]);
      setCurrentStrokeId(null);
    }, [isDrawing, currentStrokeId, currentTool, currentColor, strokeWidth, currentPoints]);

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

    return (
      <div className="canvas-wrapper" style={{ position: "relative", width: "1000px", height: "600px" }}>
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
          {players
            .filter((p) => p.id !== socketRef.current?.id)
            .filter((p) => p.cursor)
            .map((p) => (
              <div
                key={p.id}
                className="remote-cursor"
                style={{
                  left: `${p.cursor.x}px`,
                  top: `${p.cursor.y}px`,
                  background: p.color,
                  color: "white"
                }}
                title={p.name}
              >
                {p.name.slice(0, 2).toUpperCase()}
              </div>
            ))}
        </div>
      </div>
    );
  }
);

export default CanvasBoard;
