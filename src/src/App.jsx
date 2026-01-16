// src/src/App.jsx
import React from 'react';
import CanvasBoard from './components/CanvasBoard';
import './App.css';

function App() {
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
              <button className="tool-btn active">Brush</button>
              <button className="tool-btn">Eraser</button>
            </div>
            <div className="color-picker">
              <h4>Color</h4>
              <div className="colors">
                <button className="color-btn active" style={{background: '#000'}}></button>
                <button className="color-btn" style={{background: '#ff0000'}}></button>
                <button className="color-btn" style={{background: '#00ff00'}}></button>
                <button className="color-btn" style={{background: '#0000ff'}}></button>
              </div>
            </div>
            <div className="stroke-width">
              <h4>Size</h4>
              <input type="range" min="1" max="20" defaultValue="5" />
            </div>
          </div>
          
          <div className="users-panel">
            <h3>Online Users</h3>
            <div id="users-list">
              <p>You (connecting...)</p>
            </div>
          </div>
          
          <div className="controls">
            <button className="control-btn">Undo</button>
            <button className="control-btn">Redo</button>
            <button className="control-btn clear">Clear</button>
          </div>
        </div>
        
        <div className="canvas-container">
          <CanvasBoard />
        </div>
      </div>
    </div>
  );
}

export default App;
