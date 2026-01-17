/* eslint-disable react-hooks/immutability */
// src/src/components/CanvasBoard.jsx - COMPLETE (Step 6)
import React, { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import io from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';

const CanvasBoard = ({ currentTool, currentColor, strokeWidth, onUsersUpdate }) => {
  const canvasRef = useRef(null);
  const socketRef = useRef(null);

  const [ctx, setCtx] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState([]);
  const [users, setUsers] = useState([]);

  const CANVAS_WIDTH = 1000;
  const CANVAS_HEIGHT = 600;

  // Dynamic eraser cursor (size changes with strokeWidth)
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

  const drawOperation = useCallback((context, op) => {
    if (!context || !op?.points || op.points.length < 2) return;

    context.save();

    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.lineWidth = op.width || 5;

    if (op.type === 'eraser') {
      context.globalCompositeOperation = 'destination-out';
      context.strokeStyle = '#ffffff';
    } else {
      context.globalCompositeOperation = 'source-over';
      context.strokeStyle = op.color || '#000000';
    }

    context.beginPath();
    context.moveTo(op.points[0].x, op.points[0].y);

    for (let i = 1; i < op.points.length; i++) {
      context.lineTo(op.points[i].x, op.points[i].y);
    }

    context.stroke();
    context.restore();
  }, []);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    const context = canvas.getContext('2d');
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    setCtx(context);
  }, []);

  // Socket connection + presence + strokes
  useEffect(() => {
    socketRef.current = io('http://localhost:5000');

    socketRef.current.on('connect', () => {
      const randomName = `User-${socketRef.current.id.slice(0, 4)}`;
      socketRef.current.emit('joinRoom', {
        roomId: 'default',
        userName: randomName
      });
    });

    socketRef.current.on('usersUpdate', (usersList) => {
      setUsers(usersList);
      if (typeof onUsersUpdate === 'function') onUsersUpdate(usersList);
    });

    socketRef.current.on('cursorUpdate', ({ userId, cursor }) => {
      setUsers((prev) => {
        const next = prev.map((u) => (u.id === userId ? { ...u, cursor } : u));
        if (typeof onUsersUpdate === 'function') onUsersUpdate(next);
        return next;
      });
    });

    // When you join, server can send existing ops (later steps will replay all)
    socketRef.current.on('canvasState', (operations) => {
      if (!ctx) return;
      // For now: draw them directly in order
      operations.forEach((op) => drawOperation(ctx, op));
    });

    // NEW: server broadcasts every new stroke to all users
    socketRef.current.on('strokeCreated', (op) => {
      if (!ctx) return;
      drawOperation(ctx, op);
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [ctx, drawOperation, onUsersUpdate]);

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

      setIsDrawing(true);
      const pos = getMousePos(e);
      setCurrentPoints([pos]);

      if (currentTool === 'brush') {
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = strokeWidth;
        ctx.globalCompositeOperation = 'source-over';
      } else {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = strokeWidth;
        ctx.globalCompositeOperation = 'destination-out';
      }

      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    },
    [ctx, getMousePos, currentTool, currentColor, strokeWidth]
  );

  const draw = useCallback(
    (e) => {
      if (!isDrawing || !ctx || currentPoints.length === 0) return;

      const pos = getMousePos(e);
      const points = [...currentPoints, pos];
      setCurrentPoints(points);

      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();

      socketRef.current?.emit('cursorMove', { x: pos.x, y: pos.y });
    },
    [isDrawing, ctx, currentPoints, getMousePos]
  );

  const stopDrawing = useCallback(() => {
    if (!isDrawing || currentPoints.length < 2) {
      setIsDrawing(false);
      setCurrentPoints([]);
      return;
    }

    setIsDrawing(false);

    const operation = {
      id: uuidv4(),
      type: currentTool, // 'brush' | 'eraser'
      color: currentColor,
      width: strokeWidth,
      points: currentPoints
    };

    // NEW: Send operation to server so everyone else gets it
    socketRef.current?.emit('strokeEnd', operation);

    setCurrentPoints([]);
  }, [isDrawing, currentTool, currentColor, strokeWidth, currentPoints]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseleave', stopDrawing);

    return () => {
      canvas.removeEventListener('mousedown', startDrawing);
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('mouseup', stopDrawing);
      canvas.removeEventListener('mouseleave', stopDrawing);
    };
  }, [startDrawing, draw, stopDrawing]);

  return (
    <div className="canvas-wrapper" style={{ position: 'relative', width: '1000px', height: '600px' }}>
      <canvas
        ref={canvasRef}
        className="canvas-board"
        style={{
          border: '2px solid #ddd',
          borderRadius: '8px',
          cursor: currentTool === 'eraser' ? eraserCursor : 'crosshair',
          background: 'white'
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
                color: 'white'
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
