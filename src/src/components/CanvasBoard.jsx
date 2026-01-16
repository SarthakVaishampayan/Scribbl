/* eslint-disable react-hooks/immutability */
/* eslint-disable no-unused-vars */
// src/src/components/CanvasBoard.jsx
import React, { useEffect, useRef, useCallback, useState } from 'react';
import io from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';

const CanvasBoard = () => {
  const canvasRef = useRef(null);
  const socketRef = useRef(null);
  
  // Canvas state
  const [ctx, setCtx] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState([]);
  const [currentTool, setCurrentTool] = useState('brush');
  const [currentColor, setCurrentColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(5);
  const [users, setUsers] = useState([]);
  
  const CANVAS_WIDTH = 1000;
  const CANVAS_HEIGHT = 600;

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
      const context = canvas.getContext('2d');
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT); // White background
      setCtx(context);
    }
  }, []);

  // Connect to server
  useEffect(() => {
    socketRef.current = io('http://localhost:5000');
    
    socketRef.current.on('connect', () => {
      console.log('✅ Connected:', socketRef.current.id);
      socketRef.current.emit('joinRoom', { 
        roomId: 'default', 
        userName: 'User',
        color: '#ff6b6b' 
      });
    });

    socketRef.current.on('usersUpdate', (usersList) => {
      setUsers(usersList);
    });

    socketRef.current.on('canvasState', (operations) => {
      console.log('📋 Canvas state:', operations);
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  // Mouse position helper
  const getMousePos = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) * CANVAS_WIDTH) / rect.width,
      y: ((e.clientY - rect.top) * CANVAS_HEIGHT) / rect.height
    };
  }, []);

  // Drawing handlers
  const startDrawing = useCallback((e) => {
    if (!ctx) return;
    
    setIsDrawing(true);
    const pos = getMousePos(e);
    
    // Start new stroke
    setCurrentPoints([pos]);
    
    // Set drawing style
    if (currentTool === 'brush') {
      ctx.strokeStyle = currentColor;
      ctx.lineWidth = strokeWidth;
      ctx.globalCompositeOperation = 'source-over';
    } else {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = strokeWidth;
      ctx.globalCompositeOperation = 'destination-out'; // Eraser
    }
    
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }, [ctx, getMousePos, currentTool, currentColor, strokeWidth]);

  const draw = useCallback((e) => {
    if (!isDrawing || !ctx || currentPoints.length === 0) return;
    
    const pos = getMousePos(e);
    const points = [...currentPoints, pos];
    setCurrentPoints(points);
    
    // Draw line segment
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    
    // Send cursor position
    socketRef.current?.emit('cursorMove', { 
      x: pos.x, 
      y: pos.y 
    });
  }, [isDrawing, ctx, currentPoints, getMousePos]);

  const stopDrawing = useCallback(() => {
    if (!isDrawing || currentPoints.length < 2) {
      setIsDrawing(false);
      setCurrentPoints([]);
      return;
    }
    
    setIsDrawing(false);
    
    // Create operation object
    const operation = {
      id: uuidv4(),
      type: currentTool,
      color: currentColor,
      width: strokeWidth,
      points: currentPoints,
      timestamp: Date.now()
    };
    
    console.log('✍️ Stroke complete:', operation);
    
    // TODO: Send to server (Step 6)
    setCurrentPoints([]);
  }, [isDrawing, currentTool, currentColor, strokeWidth, currentPoints]);

  // Event handlers
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
          cursor: currentTool === 'eraser' ? 'grab' : 'crosshair',
          background: 'white'
        }}
      />
      
      {/* Remote cursors overlay */}
      <div className="cursor-overlay">
        {users.map(user => user.cursor && (
          <div 
            key={user.id} 
            className="remote-cursor"
            style={{
              left: `${user.cursor.x}px`,
              top: `${user.cursor.y}px`,
              background: user.color,
              color: 'white'
            }}
          >
            {user.name.slice(0, 2)}
          </div>
        ))}
      </div>
    </div>
  );
};

export default CanvasBoard;
