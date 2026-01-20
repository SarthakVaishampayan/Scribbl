
import React, { useState, useRef } from "react";
import CanvasBoard from "./components/CanvasBoard";
import "./App.css";

function App() {
  const [currentTool, setCurrentTool] = useState("brush");
  const [currentColor, setCurrentColor] = useState("#000000");
  const [strokeWidth, setStrokeWidth] = useState(5);

  const [players, setPlayers] = useState([]);

  const [screen, setScreen] = useState("lobby");
  const [roomId, setRoomId] = useState("room-1");
  const [userName, setUserName] = useState("User");
  const [activeRoom, setActiveRoom] = useState("lobby");

  const canvasBoardRef = useRef(null);

  const handleUndo = () => {
    canvasBoardRef.current?.undo();
  };

  const handleRedo = () => {
    canvasBoardRef.current?.redo();
  };

  const handleClearMine = () => {
    canvasBoardRef.current?.clearMine();
  };

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <span className="brand-mark">S</span>
          <div className="brand-text">
            <h1>Scribbl- A Collaborative Canvas</h1>
            <p>Draw together in real time.</p>
          </div>
        </div>
        {screen === "canvas" && (
          <div className="header-room-meta">
            <span className="badge">Room: {activeRoom}</span>
            <span className="badge subtle">You: {userName || "Anon"}</span>
          </div>
        )}
      </header>

      {screen === "lobby" ? (
        <div className="lobby">
          <div className="lobby-card">
            <h2 className="lobby-title">Join a collaborative room</h2>
            <p className="lobby-subtitle">
              Choose a name and a room ID, then share the same room ID with your teammates to
              sketch together.
            </p>

            <label className="field">
              <span className="field-label">Name</span>
              <input
                className="field-input"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="e.g. Aman"
              />
            </label>

            <label className="field">
              <span className="field-label">Room ID</span>
              <input
                className="field-input"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="e.g. design-sprint-01"
              />
            </label>

            <button
              className="primary-button"
              onClick={() => {
                setScreen("canvas");
                setActiveRoom(roomId.trim() || "room-1");
              }}
            >
              Enter Canvas
            </button>

            <p className="lobby-hint">No password. Anyone with the same room ID can join.</p>
          </div>
        </div>
      ) : (
        <div className="main-container">
          <div className="sidebar">
            <div className="tool-panel">
              <h3>Room: {activeRoom}</h3>

              <button
                className="control-btn"
                style={{ width: "100%", marginTop: 8 }}
                onClick={() => {
                  setScreen("lobby");
                  setPlayers([]);
                }}
              >
                ⬅ Back to Lobby
              </button>

              <hr style={{ margin: "16px 0" }} />

              <h3>Tools</h3>
              <div className="tool-group">
                <button
                  className={`tool-btn ${currentTool === "brush" ? "active" : ""}`}
                  onClick={() => setCurrentTool("brush")}
                >
                  🖌️ Brush
                </button>
                <button
                  className={`tool-btn ${currentTool === "eraser" ? "active" : ""}`}
                  onClick={() => setCurrentTool("eraser")}
                >
                  🧽 Eraser
                </button>
              </div>

              <div className="color-picker">
                <h4>Color</h4>
                <div className="colors">
                  <button
                    className={`color-btn ${currentColor === "#000000" ? "active" : ""}`}
                    style={{ background: "#000000" }}
                    onClick={() => {
                      setCurrentColor("#000000");
                      setCurrentTool("brush");
                    }}
                    title="Black"
                  />
                  <button
                    className={`color-btn ${currentColor === "#ff0000" ? "active" : ""}`}
                    style={{ background: "#ff0000" }}
                    onClick={() => {
                      setCurrentColor("#ff0000");
                      setCurrentTool("brush");
                    }}
                    title="Red"
                  />
                  <button
                    className={`color-btn ${currentColor === "#00ff00" ? "active" : ""}`}
                    style={{ background: "#00ff00" }}
                    onClick={() => {
                      setCurrentColor("#00ff00");
                      setCurrentTool("brush");
                    }}
                    title="Green"
                  />
                  <button
                    className={`color-btn ${currentColor === "#0000ff" ? "active" : ""}`}
                    style={{ background: "#0000ff" }}
                    onClick={() => {
                      setCurrentColor("#0000ff");
                      setCurrentTool("brush");
                    }}
                    title="Blue"
                  />
                </div>

                <div
                  className="active-color"
                  style={{
                    background: currentColor,
                    width: "30px",
                    height: "30px",
                    borderRadius: "4px",
                    border: "2px solid #333",
                    marginTop: "0.5rem"
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
              <h3>Users in room ({players.length})</h3>
              <div id="users-list">
                {players.length === 0 ? (
                  <p>Connecting...</p>
                ) : (
                  players.map((p) => (
                    <p key={p.id} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 999,
                          background: p.color,
                          display: "inline-block"
                        }}
                      />
                      <span>{p.name}</span>
                    </p>
                  ))
                )}
              </div>
            </div>

            <div className="controls">
              <button className="control-btn" onClick={handleUndo}>
                ↶ Undo
              </button>
              <button className="control-btn" onClick={handleRedo}>
                ↷ Redo
              </button>
              <button className="control-btn clear" onClick={handleClearMine}>
                🗑️ Clear mine
              </button>
            </div>
          </div>

          <div className="canvas-container">
            <CanvasBoard
              ref={canvasBoardRef}
              roomId={activeRoom}
              userName={userName}
              currentTool={currentTool}
              currentColor={currentColor}
              strokeWidth={strokeWidth}
              onPlayersUpdate={setPlayers}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
