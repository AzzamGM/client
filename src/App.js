// App.js
import React, { useState } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import JoinMenu from './components/JoinMenu';
import Lobby from './components/Lobby';
import SoundControl from './components/SoundControl';
import preloadAssets from './preloadAssets';

// Start fetching sprites immediately — usually done before a game begins
preloadAssets();

function App() {
  const [nickname, setNickname] = useState(localStorage.getItem('nickname') || '');

  // Function to store room ID and nickname in localStorage
  const handleJoinRoom = (roomId, nickname) => {
    localStorage.setItem('roomId', roomId);
    localStorage.setItem('nickname', nickname);
    setNickname(nickname);
  };

  const handleRename = (newName) => {
    localStorage.setItem('nickname', newName);
    setNickname(newName);
  };

  return (
    <Router>
      <div className="app-screen flex flex-col justify-center items-center theme-saloon" style={{ padding: '20px' }}>
        <Routes>
          <Route path="/" element={<JoinMenu onJoinRoom={handleJoinRoom} />} />
          <Route path="/lobby/:roomId" element={<Lobby nickname={nickname} onRename={handleRename} />} />
          <Route path="/lobby" element={<Navigate to="/" />} />
        </Routes>
        <SoundControl />
      </div>
    </Router>
  );
}

export default App;
