import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import socket from '../socketService'; // Import your socket service

function JoinMenu({ onJoinRoom }) {
  const [nickname, setNickname] = useState(localStorage.getItem('nickname') || '');
  const [roomId, setRoomId] = useState(localStorage.getItem('roomId') || '');
  const navigate = useNavigate();

  const joinRoom = () => {
    if (nickname && roomId) {
      // Emit the joinRoom event
      socket.emit('joinRoom', { roomId, nickname });
      
      // Store the room info and navigate to the lobby
      onJoinRoom(roomId, nickname);
      navigate('/lobby');
    }
  };

  return (
    <div>
      <div className="rounded-t-2xl p-2 flex font-bold unselectable justify-center" style={{ backgroundColor: 'rgb(42 18 149)', color: 'white' }}>
        <h1>Join a lobby</h1>
      </div>
      <div className="rounded-b-2xl flex flex-col justify-center items-center" style={{ overflowY: 'auto', border: '0px solid #ccc', padding: '2px', backgroundColor: '#f0f0f0' }}>
        
        <div className="flex flex-col p-3 justify-center items-center">
          <label className="font-bold">Nickname</label>
          <input
            type="text"
            placeholder="Enter your nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            style={{ width: '200px', height: '40px' }}
            className="m-2 rounded-2xl p-2"
          />
        </div>

        <div className="flex flex-col p-3 justify-center items-center">
          <label className="font-bold">Room ID</label>
          <input
            type="text"
            placeholder="Enter room ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            style={{ width: '200px', height: '40px' }}
            className="m-2 rounded-2xl p-2"
          />
        </div>

        <button onClick={joinRoom} className="m-6 mt-0 font-bold rounded-2xl p-2" style={{ backgroundColor: 'rgb(42 18 149)', color: 'white', width: '200px' }}>
          Join Room
        </button>
      </div>
    </div>
  );
}

export default JoinMenu;
