
import React, { useState } from "react";

const JoinRoom = ({ onJoin }) => {
  const [userName, setUserName] = useState("");
  const [roomId, setRoomId] = useState("");
  const [password, setPassword] = useState("");

  const submit = (e) => {
    e.preventDefault();
    onJoin?.({
      userName: userName.trim(),
      roomId: roomId.trim(),
      password
    });
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f5f5f5" }}>
      <form
        onSubmit={submit}
        style={{
          width: 360,
          background: "white",
          padding: 24,
          borderRadius: 12,
          border: "1px solid #ddd",
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)"
        }}
      >
        <h2 style={{ marginBottom: 16 }}>Join a room</h2>

        <label style={{ display: "block", marginBottom: 6 }}>Name</label>
        <input
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          placeholder="e.g. Aman"
          style={{ width: "100%", padding: 10, marginBottom: 12 }}
        />

        <label style={{ display: "block", marginBottom: 6 }}>Room ID</label>
        <input
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          placeholder="e.g. testroom"
          style={{ width: "100%", padding: 10, marginBottom: 12 }}
        />

        <label style={{ display: "block", marginBottom: 6 }}>Room password (optional)</label>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Leave empty if none"
          style={{ width: "100%", padding: 10, marginBottom: 16 }}
        />

        <button
          type="submit"
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 8,
            border: "none",
            background: "#007bff",
            color: "white",
            fontWeight: 700,
            cursor: "pointer"
          }}
        >
          Enter Room
        </button>
      </form>
    </div>
  );
};

export default JoinRoom;
