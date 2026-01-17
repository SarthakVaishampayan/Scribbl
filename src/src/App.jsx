// D:\project\collaborative canvas\src\src\App.jsx
import React, { useState } from 'react';
import CanvasBoard from './components/CanvasBoard';
import './App.css';

function App() {
  const [currentTool, setCurrentTool] = useState('brush');
  const [currentColor, setCurrentColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(5);
  const [users, setUsers] = useState([]);

  // NEW: Auto-switch to brush when color is selected
  const handleColorChange = (color) => {
    setCurrentColor(color);
    if (currentTool === 'eraser') {
      setCurrentTool('brush'); // Auto-activate brush
    }
  };

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
                  onClick={() => handleColorChange('#000000')}
                  title="Black"
                />
                <button
                  className={`color-btn ${currentColor === '#ff0000' ? 'active' : ''}`}
                  style={{ background: '#ff0000' }}
                  onClick={() => handleColorChange('#ff0000')}
                  title="Red"
                />
                <button
                  className={`color-btn ${currentColor === '#00ff00' ? 'active' : ''}`}
                  style={{ background: '#00ff00' }}
                  onClick={() => handleColorChange('#00ff00')}
                  title="Green"
                />
                <button
                  className={`color-btn ${currentColor === '#0000ff' ? 'active' : ''}`}
                  style={{ background: '#0000ff' }}
                  onClick={() => handleColorChange('#0ff0ff')}
                  title="Blue"
                />
                <button
                  className={`color-btn ${currentColor === '#ffff00' ? 'active' : ''}`}
                  style={{ background: '#ffff00' }}
                  onClick={() => handleColorChange('#ffff00')}
                  title="Yellow"
                />
                <button
                  className={`color-btn ${currentColor === '#ff00ff' ? 'active' : ''}`}
                  style={{ background: '#ff00ff' }}
                  onClick={() => handleColorChange('#ff00ff')}
                  title="Magenta"
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
