// src/src/App.jsx - COMPLETE (Step 5)
import React, { useState } from 'react';
import CanvasBoard from './components/CanvasBoard';
import './App.css';

function App() {
  const [currentTool, setCurrentTool] = useState('brush');
  const [currentColor, setCurrentColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(5);

  // Presence list comes from server via CanvasBoard callback
  const [users, setUsers] = useState([]);

  return (
    <div className="app">
      <header className="header">
        <h1>🎨 Collaborative Canvas</h1>
      </header>

      <div className="main-container">
        <div className="sidebar">
          <div className="tool-panel">
            <h3>Tools</h3>
            <div className="tool-group">
              <button
                className={`tool-btn ${currentTool === 'brush' ? 'active' : ''}`}
                onClick={() => setCurrentTool('brush')}
              >
                🖌️ Brush
              </button>
              <button
                className={`tool-btn ${currentTool === 'eraser' ? 'active' : ''}`}
                onClick={() => setCurrentTool('eraser')}
              >
                🧽 Eraser
              </button>
            </div>

            <div className="color-picker">
              <h4>Color</h4>
              <div className="colors">
                <button
                  className={`color-btn ${currentColor === '#000000' ? 'active' : ''}`}
                  style={{ background: '#000000' }}
                  onClick={() => setCurrentColor('#000000')}
                  title="Black"
                />
                <button
                  className={`color-btn ${currentColor === '#ff0000' ? 'active' : ''}`}
                  style={{ background: '#ff0000' }}
                  onClick={() => setCurrentColor('#ff0000')}
                  title="Red"
                />
                <button
                  className={`color-btn ${currentColor === '#00ff00' ? 'active' : ''}`}
                  style={{ background: '#00ff00' }}
                  onClick={() => setCurrentColor('#00ff00')}
                  title="Green"
                />
                <button
                  className={`color-btn ${currentColor === '#0000ff' ? 'active' : ''}`}
                  style={{ background: '#0000ff' }}
                  onClick={() => setCurrentColor('#0000ff')}
                  title="Blue"
                />
              </div>

              <div
                className="active-color"
                style={{
                  background: currentColor,
                  width: '30px',
                  height: '30px',
                  borderRadius: '4px',
                  border: '2px solid #333',
                  marginTop: '0.5rem'
                }}
              />
            </div>

            <div className="stroke-width">
              <h4>Size</h4>
              <input
                type="range"
                min="1"
                max="30"
                value={strokeWidth}
                onChange={(e) => setStrokeWidth(Number(e.target.value))}
              />
              <span>{strokeWidth}px</span>
            </div>
          </div>

          <div className="users-panel">
            <h3>Online Users</h3>
            <div id="users-list">
              {users.length === 0 ? (
                <p>Connecting...</p>
              ) : (
                users.map((u) => (
                  <p key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 999,
                        background: u.color,
                        display: 'inline-block'
                      }}
                    />
                    <span>{u.name}</span>
                  </p>
                ))
              )}
            </div>
          </div>

          <div className="controls">
            <button className="control-btn" disabled>↶ Undo</button>
            <button className="control-btn" disabled>↷ Redo</button>
            <button className="control-btn clear" disabled>🗑️ Clear</button>
          </div>
        </div>

        <div className="canvas-container">
          <CanvasBoard
            currentTool={currentTool}
            currentColor={currentColor}
            strokeWidth={strokeWidth}
            onUsersUpdate={setUsers}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
