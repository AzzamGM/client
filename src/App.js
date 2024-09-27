// App.js
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import JoinMenu from './components/JoinMenu';
import Lobby from './components/Lobby';
import socket from './socketService'; // Import the socket service

function App() {
  const [roomId, setRoomId] = useState(localStorage.getItem('roomId') || '');
  const [nickname, setNickname] = useState(localStorage.getItem('nickname') || '');

  useEffect(() => {
    // Listen for messages related to the user's room
    socket.on('message', (message) => {
      console.log(message); // Log all relevant messages in the console
    });

    // Cleanup on component unmount
    return () => {
      socket.off('message');
    };
  }, []);

  // Function to store room ID and nickname in localStorage
  const handleJoinRoom = (roomId, nickname) => {
    localStorage.setItem('roomId', roomId);
    localStorage.setItem('nickname', nickname);
    setRoomId(roomId);
    setNickname(nickname);
  };

  // Prevent manual navigation to /lobby if no roomId or nickname is set
  const requireRoomToAccessLobby = (component) => {
    if (!roomId || !nickname) {
      return <Navigate to="/" />;
    }
    return component;
  };

  return (
    <Router>
      <div className="flex flex-col justify-center items-center" style={{ padding: '20px', backgroundColor: '#421ced', width: '100vw', height: '100vh' }}>
        <Routes>
          <Route path="/" element={<JoinMenu onJoinRoom={handleJoinRoom} />} />
          <Route path="/lobby" element={requireRoomToAccessLobby(<Lobby roomId={roomId} nickname={nickname} />)} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
