import React, { useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import socket from '../socketService'; // Import your socket service
import HowToPlayButton from './HowToPlay';

function JoinMenu({ onJoinRoom }) {
  const [nickname, setNickname] = useState(localStorage.getItem('nickname') || '');
  const [joinCode, setJoinCode] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [nameError, setNameError] = useState(false);
  const location = useLocation();
  // 'empty' = joined without a code; 'notfound' = the Lobby bounced us back
  // because the code doesn't exist
  const [codeError, setCodeError] = useState(location.state && location.state.lobbyNotFound ? 'notfound' : null);
  const [searchParams] = useSearchParams();
  // Code carried over from an invite link (/lobby/CODE redirects here when no nickname is set)
  const inviteCode = (searchParams.get('room') || '').toUpperCase();
  const navigate = useNavigate();

  const goToLobby = (code) => {
    onJoinRoom(code, nickname);
    navigate(`/lobby/${code}`);
  };

  // Flag the nickname field when a join/create is attempted without one
  const requireName = () => {
    if (!nickname.trim()) {
      setNameError(true);
      return false;
    }
    return true;
  };

  const createLobby = () => {
    if (!requireName()) return;
    // The server generates a unique room code and sends it back; an empty
    // password means a public lobby
    socket.emit('createRoom', { nickname, password: createPassword }, (code) => {
      goToLobby(code);
    });
  };

  const joinLobby = (code) => {
    if (!requireName()) return;
    const trimmed = (code || '').toUpperCase().trim();
    if (!trimmed) {
      setCodeError('empty');
      return;
    }
    goToLobby(trimmed);
  };

  return (
    <div>
      <div className="flex justify-center mb-2">
        <HowToPlayButton />
      </div>
      <div className="rounded-t-2xl p-2 flex font-bold unselectable justify-center" style={{ backgroundColor: 'var(--header)', color: 'var(--text-light)', border: 'var(--card-border)', borderBottom: 'none' }}>
        <h1>{inviteCode ? `Join lobby ${inviteCode}` : 'Play'}</h1>
      </div>
      <div className="rounded-b-2xl flex flex-col justify-center items-center" style={{ overflowY: 'auto', padding: '2px', backgroundColor: 'var(--panel)', border: 'var(--card-border)', borderTop: 'none' }}>

        <div className="flex flex-col p-3 justify-center items-center">
          <label className="font-bold">Nickname</label>
          <input
            type="text"
            placeholder="Enter your nickname"
            value={nickname}
            onChange={(e) => { setNickname(e.target.value); setNameError(false); }}
            style={{ width: '200px', height: '40px' }}
            className={`m-2 rounded-2xl py-2 px-3 ${nameError ? 'input-error' : ''}`}
          />
          {nameError && (
            <div className="font-bold mb-2" style={{ color: 'var(--danger)', fontSize: '13px' }}>
              Enter a nickname first, partner!
            </div>
          )}
          {!inviteCode && (
            <input
              type="password"
              placeholder="Password (optional)"
              value={createPassword}
              onChange={(e) => setCreatePassword(e.target.value)}
              style={{ width: '200px', height: '40px' }}
              className="m-2 mt-0 rounded-2xl py-2 px-3"
            />
          )}
            {inviteCode ? (
          <button
            onClick={() => joinLobby(inviteCode)}
            className="m-3 mt-0 font-bold rounded-2xl p-2 btn-3d btn-3d-header"
            style={{ backgroundColor: 'var(--header)', color: 'var(--text-light)', width: '200px' }}>
            Join Lobby {inviteCode}
          </button>
        ) : (
          <button
            onClick={createLobby}
            className="m-3 mt-0 font-bold rounded-2xl p-2 btn-3d btn-3d-header"
            style={{ backgroundColor: 'var(--header)', color: 'var(--text-light)', width: '200px' }}>
            Create Lobby
          </button>
        )}
        </div>

      

        <div className="font-bold" style={{ color: 'var(--muted)' }}>or</div>

        <div className="flex flex-col p-3 pt-0 justify-center items-center">
          <input
            type="text"
            placeholder="Enter a lobby code"
            value={joinCode}
            onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setCodeError(null); }}
            onKeyDown={(e) => e.key === 'Enter' && joinLobby(joinCode)}
            style={{ width: '200px', height: '40px', textTransform: 'uppercase' }}
            className={`m-2 rounded-2xl py-2 px-3 ${codeError ? 'input-error' : ''}`}
          />
          {codeError && (
            <div className="font-bold mb-2" style={{ color: 'var(--danger)', fontSize: '13px' }}>
              {codeError === 'empty' ? 'Enter a lobby code first, partner!' : "That lobby doesn't exist, partner!"}
            </div>
          )}
          <button
            onClick={() => joinLobby(joinCode)}
            className="m-2 mt-0 font-bold rounded-2xl p-2 btn-3d btn-3d-header"
            style={{ backgroundColor: 'var(--header)', color: 'var(--text-light)', width: '200px' }}>
            Join with Code
          </button>
        </div>
      </div>
    </div>
  );
}

export default JoinMenu;
