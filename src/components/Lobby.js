import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Moves from './Moves';
import socket, { sessionId } from '../socketService'; // Import your socket service
import GameLogic from './GameLogic';
import { playSound } from '../sound';
import { SKINS, skinFor } from '../skins';
import WinSfx from '../assets/win-1.mp3';
import StandoffSfx from '../assets/standoff.wav';
import preloadAssets from '../preloadAssets';
import HowToPlayButton from './HowToPlay';
import './style.css';

// Live action banner: the move name shown as "{Name} used {move}"
const ACTION_LABELS = {
    shot: 'Shoot',
    missed: 'Shoot',
    knockedOff: 'Shoot',
    fellOff: 'Forward',
    moved: 'Forward',
    turned: 'Turn',
    climbed: 'Climb',
    wentDown: 'Standoff (injured himself)',
    standoffUp: 'Standoff',
    recovered: 'recovered',
};

const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th'];

function Lobby({ nickname, onRename }) {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const [isFirstPlayer, setIsFirstPlayer] = useState(false);
    const [playerCount, setPlayerCount] = useState(0);
    const [gameStarted, setGameStarted] = useState(false);
    const [lobbyPlayers, setLobbyPlayers] = useState([]); // [{ id, nickname, ready, connected, number }]
    const [playerListMinimized, setPlayerListMinimized] = useState(false);
    const [deadPlayers, setDeadPlayers] = useState([]); // session ids of dead players
    const [gameEvents, setGameEvents] = useState([]);
    const [eventsMinimized, setEventsMinimized] = useState(false);
    const [inviteCopied, setInviteCopied] = useState(false);
    const [wasKicked, setWasKicked] = useState(false);
    const [joinError, setJoinError] = useState(null);
    const [gameKey, setGameKey] = useState(0); // bump to remount GameLogic with fresh state
    const [roundRunning, setRoundRunning] = useState(false);
    const [currentTurn, setCurrentTurn] = useState(null); // session id of the player whose move is playing
    const [editingName, setEditingName] = useState(false);
    const [nameInput, setNameInput] = useState('');
    const [starting, setStarting] = useState(false); // Start pressed, waiting for the server's spawn echo
    const [lockedIn, setLockedIn] = useState(false); // moves submitted; board stays locked until the round plays
    const [liveAction, setLiveAction] = useState(null); // { id, type, key } for the top action banner
    const [standoff, setStandoff] = useState(null); // the two finalists while the banner plays
    const standoffShownRef = useRef(false); // fire the flourish once per game
    const winSoundPlayedRef = useRef(false); // play the win jingle once per game
    const [needPassword, setNeedPassword] = useState(false); // lobby wants a password before letting us in
    const [passwordWrong, setPasswordWrong] = useState(false); // last attempt was rejected
    const [passwordInput, setPasswordInput] = useState('');
    const passwordRef = useRef(''); // accepted password, re-sent on auto-rejoins
    const [assetsReady, setAssetsReady] = useState(false); // game sprites cached
    const lobbyPlayersRef = useRef([]);
    const eventsListRef = useRef(null);
    const gameStartedRef = useRef(false);
    const startingPlayerCountRef = useRef(0); // how many players the current game began with
    const roundCounterRef = useRef(0); // for the "Round N" dividers in the event log
    const roundActiveRef = useRef(false); // roundState fires per turn; divider only on the round's first

    // Hold the loading screen until the sprites are cached, so characters
    // appear instantly when the game starts (usually already done by now —
    // App kicks the preload off at startup)
    useEffect(() => {
        let cancelled = false;
        preloadAssets().then(() => {
            if (!cancelled) setAssetsReady(true);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    // Arrived via URL without a nickname: go pick one, keeping the room code
    useEffect(() => {
        if (!nickname) {
            navigate(`/?room=${roomId}`);
        }
    }, [nickname, roomId, navigate]);


    useEffect(() => {
        // Update player count
        socket.on('updatePlayerCount', setPlayerCount);

        // Update the list of players in the lobby
        socket.on('updatePlayerList', (playerList) => {
            lobbyPlayersRef.current = playerList;
            setLobbyPlayers(playerList);
        });

        // Listen for firstPlayer event from the server. It only arrives on a
        // successful join, so it also dismisses the password prompt
        socket.on('firstPlayer', (isFirst) => {
            setIsFirstPlayer(isFirst);
            setNeedPassword(false);
        });

        // The lobby is password-protected; the flag says whether an actual
        // attempt was wrong (vs none supplied yet)
        socket.on('passwordRequired', (wasWrong) => {
            setNeedPassword(true);
            setPasswordWrong(!!wasWrong);
        });

        // Spawns arriving means the game started (covers non-leader clients
        // and mid-game rejoins)
        const handleSpawnsReceived = (spawns) => {
            // The spawn layout lists every participating player, so its count
            // is the authoritative "players at game start"
            if (Array.isArray(spawns)) {
                startingPlayerCountRef.current = spawns.flat().length;
            }
            gameStartedRef.current = true;
            setGameStarted(true);
            setStarting(false);
        };
        socket.on('setSpawns', handleSpawnsReceived);

        // Kicked by the lobby leader
        socket.on('kicked', () => {
            setWasKicked(true);
        });

        // Connection happenings (join/leave/kick/disconnect/...) go into the
        // event log alongside the in-game events
        socket.on('roomEvent', (detail) => {
            if (!detail || !detail.type) return;
            setGameEvents((prev) => [...prev, { type: 'room', kind: detail.type, actor: detail.nickname, target: detail.to }]);
        });

        // Couldn't enter the room (e.g. game already started)
        socket.on('joinError', (reason) => {
            setJoinError(reason);
        });

        // The lobby code doesn't exist (typo'd URL, stale link, or the
        // server restarted): back to the menu, which shows the error
        socket.on('lobbyNotFound', () => {
            navigate('/', { state: { lobbyNotFound: true } });
        });

        // Back to the lobby for a fresh game
        socket.on('gameReset', () => {
            gameStartedRef.current = false;
            setGameStarted(false);
            setDeadPlayers([]);
            setGameEvents([]);
            setRoundRunning(false);
            setCurrentTurn(null);
            standoffShownRef.current = false;
            setStandoff(null);
            winSoundPlayedRef.current = false;
            setLockedIn(false);
            setLiveAction(null);
            setStarting(false);
            roundCounterRef.current = 0;
            roundActiveRef.current = false;
            setGameKey((key) => key + 1);
        });

        // In-game events dispatched by GameLogic (shots, knock-offs, falls)
        const handleGameEvent = (e) => {
            // The old game's simulation can still be winding down after a
            // reset; ignore its stragglers so nobody dies in the new lobby
            if (!gameStartedRef.current) return;
            const { type, actor, target, died, move } = e.detail;
            const nameOf = (id) => {
                const player = lobbyPlayersRef.current.find((p) => p.id === id);
                return player ? player.nickname : 'Someone';
            };
            if (type) {
                setGameEvents((prev) => [...prev, { type, actor: nameOf(actor), target: nameOf(target), move }]);
                // Feed the live action banner (subject = whoever acted)
                setLiveAction({ id: actor || target, type, move, key: Date.now() + Math.random() });
            }
            if (died && target) {
                setDeadPlayers((prev) => (prev.includes(target) ? prev : [...prev, target]));
                // Let the server know so dead players stop counting towards ready checks
                socket.emit('playerDied', target);
            }
        };
        window.addEventListener('gameEvent', handleGameEvent);

        // Round progress dispatched by GameLogic: lock the moves board while
        // moves are playing out and highlight whose move it is
        const handleRoundState = (e) => {
            if (!gameStartedRef.current) return;
            setRoundRunning(e.detail.running);
            setCurrentTurn(e.detail.turn);
            // The round is playing: release the lock-in hold (roundRunning
            // keeps the board disabled until the round finishes)
            if (e.detail.running) {
                setLockedIn(false);
                // First signal of this round: drop a divider into the log
                if (!roundActiveRef.current) {
                    roundActiveRef.current = true;
                    roundCounterRef.current += 1;
                    setGameEvents((prev) => [...prev, { type: 'divider', round: roundCounterRef.current }]);
                }
            } else {
                roundActiveRef.current = false;
            }
        };
        window.addEventListener('roundState', handleRoundState);

        // Cleanup on unmount
        return () => {
            socket.off('updatePlayerCount');
            socket.off('updatePlayerList');
            socket.off('firstPlayer');
            socket.off('setSpawns', handleSpawnsReceived); // GameLogic has its own setSpawns listener
            socket.off('kicked');
            socket.off('roomEvent');
            socket.off('joinError');
            socket.off('passwordRequired');
            socket.off('lobbyNotFound');
            socket.off('gameReset');
            window.removeEventListener('gameEvent', handleGameEvent);
            window.removeEventListener('roundState', handleRoundState);
        };
    }, []);

    // Keep the event log pinned to the latest entry (also on re-open,
    // since minimizing unmounts the list)
    useEffect(() => {
        if (eventsListRef.current) {
            eventsListRef.current.scrollTop = eventsListRef.current.scrollHeight;
        }
    }, [gameEvents, eventsMinimized]);

    // The live action banner clears itself shortly after each event
    useEffect(() => {
        if (!liveAction) return;
        const timer = setTimeout(() => setLiveAction(null), 2300);
        return () => clearTimeout(timer);
    }, [liveAction]);

    // "Final Standoff" flourish the moment exactly two gunslingers remain
    // (also fires at game start for a 1v1 — the whole game is a standoff)
    useEffect(() => {
        if (!gameStarted) return;
        const alive = lobbyPlayers.filter((p) => !(p.dead || deadPlayers.includes(p.id)));
        if (alive.length === 2 && !standoffShownRef.current) {
            standoffShownRef.current = true;
            setStandoff(alive);
            playSound(StandoffSfx, 0.7);
        }
    }, [gameStarted, lobbyPlayers, deadPlayers]);

    // The flourish dismisses itself; it's pointer-events:none so it never
    // blocks play even while visible
    useEffect(() => {
        if (!standoff) return;
        const timer = setTimeout(() => setStandoff(null), 4200);
        return () => clearTimeout(timer);
    }, [standoff]);

    // Join the room on mount, and rejoin automatically whenever the
    // connection drops and comes back (also covers page refreshes)
    useEffect(() => {
        if (!roomId || !nickname || wasKicked || joinError) return;
        // hasState tells the server not to re-send the game snapshot when our
        // local game is still running (a transient reconnect), which would
        // reset the board for this player
        const join = () => socket.emit('joinRoom', { roomId, nickname, hasState: gameStartedRef.current, password: passwordRef.current || undefined });
        if (socket.connected) {
            join();
        }
        socket.on('connect', join);
        return () => {
            socket.off('connect', join);
        };
    }, [roomId, nickname, wasKicked, joinError]);

    const copyInvite = () => {
        navigator.clipboard.writeText(roomId).then(() => {
            setInviteCopied(true);
            setTimeout(() => setInviteCopied(false), 2000);
        });
    };

    const leaveLobby = () => {
        socket.emit('leaveRoom');
        navigate('/');
    };

    const submitPassword = () => {
        const pwd = passwordInput.trim();
        if (!pwd) return;
        passwordRef.current = pwd;
        socket.emit('joinRoom', { roomId, nickname, hasState: gameStartedRef.current, password: pwd });
    };

    const kickPlayer = (playerId) => {
        socket.emit('kickPlayer', playerId);
    };

    const confirmRename = () => {
        const trimmed = nameInput.trim();
        if (trimmed && trimmed !== nickname) {
            // Updating the nickname re-emits joinRoom, which renames us
            // server-side and broadcasts the new player list
            onRename(trimmed);
        }
        setEditingName(false);
    };

    const handleLockIn = () => {
        // One lock-in per round: freeze the board until the round plays out
        setLockedIn(true);
    };

    const startGame = () => {
        if (starting) return;
        // Don't flip to the game view yet — that happens when the server
        // echoes setSpawns, so the platforms and UI appear together instead
        // of a platform-less flash during the round-trip. The server builds
        // the spawn layout from its own roster, so we just say "go".
        setStarting(true);
        socket.emit('startGame');
    };

    // Until the first player list arrives we're still connecting/joining,
    // and until the sprites are cached the game would render half-loaded;
    // the UI shows only the loading screen instead of half-built chrome.
    // (GameLogic stays mounted but hidden — it must not miss the restore
    // events the server sends before the player list.)
    const lobbyReady = lobbyPlayers.length > 0 && assetsReady;

    const self = lobbyPlayers.find((p) => p.id === sessionId);
    const selfDead = (self && self.dead) || deadPlayers.includes(sessionId);

    // Last one standing wins; compare against the count at game start so wins
    // by kick/leave (which shrink the list) still register
    const alivePlayers = lobbyPlayers.filter((p) => !(p.dead || deadPlayers.includes(p.id)));
    const winner = gameStarted && startingPlayerCountRef.current > 1 && alivePlayers.length === 1 ? alivePlayers[0] : null;

    // Victory jingle when the win overlay appears (winner decided and the
    // round's animations finished playing out)
    useEffect(() => {
        if (winner && !roundRunning && !winSoundPlayedRef.current) {
            winSoundPlayedRef.current = true;
            playSound(WinSfx, 0.8);
        }
    }, [winner, roundRunning]);

    // Same skin as the in-game character: the server assigns a random unused
    // skin to every player (owner included) the moment they join
    const avatarFor = (player, index) => {
        if (typeof player.skin === 'number') {
            return SKINS[((player.skin % SKINS.length) + SKINS.length) % SKINS.length].avatar;
        }
        // Older server without skins: fall back to number/join order
        const playerNumber = typeof player.number === 'number' ? player.number : index + 1;
        return skinFor(playerNumber).avatar;
    };

    const renderPlayerRow = (player, index, withKick) => {
        const isDead = player.dead || deadPlayers.includes(player.id);
        const isAway = player.connected === false;
        const mark = isDead ? '💀' : (player.ready ? '✔' : '○');
        const markColor = isDead ? 'var(--danger)' : (player.ready ? 'var(--success)' : 'var(--muted)');
        const avatar = avatarFor(player, index);
        const isTurn = roundRunning && player.id === currentTurn;
        const isSelf = player.id === sessionId;
        return (
            <li key={player.id} className='flex flex-row items-center' style={{ fontSize: '14px', color: (isDead || isAway) ? 'var(--muted)' : 'inherit', fontStyle: isAway ? 'italic' : 'normal', padding: '2px 4px', borderRadius: '5px', backgroundColor: isTurn ? 'var(--highlight)' : 'transparent' }}>
                <span style={{ color: isTurn ? 'var(--accent)' : markColor, marginRight: '6px' }}>{isTurn ? '▶' : mark}</span>
                {/* The server orders the list by turn order once the game
                    starts; the chip makes that visible (gold = goes first) */}
                {gameStarted && (
                    <span
                        className='turn-chip'
                        title={index === 0 ? 'Goes first' : `Goes ${ORDINALS[index] || `${index + 1}th`}`}
                        style={index === 0 ? { backgroundColor: 'var(--accent)', color: 'var(--accent-text)' } : {}}>
                        {ORDINALS[index] || `${index + 1}th`}
                    </span>
                )}
                {isSelf && editingName ? (
                    <input
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') confirmRename();
                            if (e.key === 'Escape') setEditingName(false);
                        }}
                        autoFocus
                        maxLength={20}
                        className='flex-1'
                        style={{ width: '90px', minWidth: 0, fontSize: '13px', borderRadius: '4px', padding: '0 4px', border: '1px solid var(--muted)' }}
                    />
                ) : (
                    <span className='flex-1 text-nudge'>
                        {player.nickname}{isSelf ? <strong> (you)</strong> : ''}{isAway ? ' (disconnected)' : ''}
                        {player.wins > 0 && (
                            <strong
                                title={`${player.wins} win${player.wins === 1 ? '' : 's'} in this room`}
                                style={{ color: 'var(--accent)', marginLeft: '4px' }}>
                                ★{player.wins}
                            </strong>
                        )}
                    </span>
                )}
                {isSelf ? (
                    <>
                        {!gameStarted && (editingName ? (
                            <button
                                onClick={confirmRename}
                                className='font-bold row-icon-btn'
                                style={{ color: 'var(--success)', marginLeft: '6px' }}
                                title='Save name'>
                                <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round'>
                                    <polyline points='20 6 9 17 4 12' />
                                </svg>
                            </button>
                        ) : (
                            <button
                                onClick={() => { setNameInput(nickname); setEditingName(true); }}
                                className='font-bold row-icon-btn'
                                style={{ color: 'var(--accent)' }}
                                title='Rename'>
                                <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round'>
                                    <path d='M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z' />
                                </svg>
                            </button>
                        ))}
                        <button
                            onClick={leaveLobby}
                            className='font-bold row-icon-btn'
                            style={{ color: 'var(--danger)' }}
                            title='Leave lobby'>
                            <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round'>
                                <path d='M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4' />
                                <polyline points='16 17 21 12 16 7' />
                                <line x1='21' y1='12' x2='9' y2='12' />
                            </svg>
                        </button>
                    </>
                ) : (withKick && isFirstPlayer && (
                    <button
                        onClick={() => kickPlayer(player.id)}
                        className='font-bold row-icon-btn'
                        style={{ color: 'var(--danger)' }}
                        title='Kick player'>
                        ✕
                    </button>
                ))}
                <img
                    src={avatar}
                    alt=''
                    style={{ width: '36px', height: '36px', objectFit: 'contain', imageRendering: 'pixelated', filter: isDead ? 'grayscale(100%)' : 'none', marginLeft: '8px', borderRadius: '5px', backgroundColor: 'var(--avatar-bg)' }}
                />
            </li>
        );
    };

    return (
        <div className={`app-screen flex flex-col justify-start ${gameStarted ? 'in-game' : ''}`} style={{ padding: '20px' }}>
            {lobbyReady && !gameStarted && (
                <div className="flex flex-col justify-start place-items-center" style={{ padding: '20px', zIndex: '9000' }}>
                    <div className='welcome-banner absolute top-0 m-6 mt-2 font-bold rounded-2xl p-4 flex justify-center unselectable' style={{ backgroundColor: 'var(--header)', color: 'var(--text-light)' }}>
                        <h2>You are in room "{roomId}".</h2>
                    </div>
                </div>
            )}
            {lobbyReady && !gameStarted && (
                <button
                    onClick={copyInvite}
                    className='copy-invite-btn font-bold rounded-2xl px-4 py-1 text-white'>
                    {inviteCopied ? 'Code copied!' : 'Copy code'}
                </button>
            )}
            {lobbyReady && gameStarted && (playerListMinimized ? (
                <button
                    onClick={() => setPlayerListMinimized(false)}
                    className='side-toggle side-toggle-left font-bold text-white'>
                    +
                </button>
            ) : (
                <div className='side-panel side-panel-left'>
                    <div className='board-column-header flex flex-row items-center' style={{ backgroundColor: 'var(--header)', padding: '0' }}>
                        <button
                            onClick={() => setPlayerListMinimized(true)}
                            className='font-bold text-white'
                            style={{ width: '30px', height: '30px' }}>
                            -
                        </button>
                        <span className='flex-1 text-center' style={{ paddingRight: '30px' }}>Players ({lobbyPlayers.length})</span>
                    </div>
                    <div style={{ background: 'var(--panel)', borderRadius: '0 0 5px 5px', padding: '4px 10px' }}>
                        <ul>
                            {lobbyPlayers.map((player, index) => renderPlayerRow(player, index, true))}
                        </ul>
                    </div>
                </div>
            ))}
            {lobbyReady && gameStarted && (eventsMinimized ? (
                <button
                    onClick={() => setEventsMinimized(false)}
                    className='side-toggle side-toggle-right font-bold text-white'>
                    +
                </button>
            ) : (
                <div className='side-panel side-panel-right'>
                    <div className='board-column-header flex flex-row items-center' style={{ backgroundColor: 'var(--header)', padding: '0' }}>
                        <span className='flex-1 text-center' style={{ paddingLeft: '30px' }}>Events</span>
                        <button
                            onClick={() => setEventsMinimized(true)}
                            className='font-bold text-white'
                            style={{ width: '30px', height: '30px' }}>
                            -
                        </button>
                    </div>
                    <div ref={eventsListRef} style={{ background: 'var(--panel)', borderRadius: '0 0 5px 5px', padding: '4px 10px', maxHeight: '220px', overflowY: 'auto' }}>
                        {gameEvents.length === 0 ? (
                            <div style={{ fontSize: '14px', color: 'var(--muted)' }}>Nothing has happened yet...</div>
                        ) : (
                            gameEvents.map((event, index) => (
                                <div key={index} style={{ fontSize: '14px' }}>
                                    {event.type === 'shot' && <><strong>{event.actor}</strong> shot <strong>{event.target}</strong> <strong>(Shoot)</strong></>}
                                    {event.type === 'missed' && <><strong>{event.actor}</strong> shot the air <strong>(Shoot)</strong></>}
                                    {event.type === 'knockedOff' && <span style={{ color: 'var(--danger)' }}><strong>{event.actor}</strong> knocked <strong>{event.target}</strong> off the train <strong>(Shoot)</strong></span>}
                                    {event.type === 'fellOff' && <span style={{ color: 'var(--danger)' }}><strong>{event.target}</strong> walked off the edge <strong>(Forward)</strong></span>}
                                    {event.type === 'moved' && <><strong>{event.target}</strong> walked <strong>(Forward)</strong></>}
                                    {event.type === 'turned' && <><strong>{event.target}</strong> turned around <strong>(Turn)</strong></>}
                                    {event.type === 'climbed' && <><strong>{event.target}</strong> climbed <strong>(Climb)</strong></>}
                                    {event.type === 'wentDown' && <><strong>{event.target}</strong> downed himself <strong>(Standoff)</strong></>}
                                    {event.type === 'recovered' && <><strong>{event.target}</strong> recovered{event.move ? <> (skipped <strong>{event.move}</strong>)</> : ''}</>}
                                    {event.type === 'standoffUp' && <><strong>{event.actor}</strong> sprang up shooting <strong>(Standoff)</strong></>}
                                    {event.type === 'divider' && (
                                        <div className='event-divider'><span>Round {event.round}</span></div>
                                    )}
                                    {event.type === 'room' && (
                                        <span style={{ color: 'var(--success)', fontStyle: 'italic' }}>
                                            {event.kind === 'joined' && <><strong>{event.actor}</strong> joined</>}
                                            {event.kind === 'left' && <><strong>{event.actor}</strong> left</>}
                                            {event.kind === 'kicked' && <><strong>{event.actor}</strong> was kicked</>}
                                            {event.kind === 'disconnected' && <><strong>{event.actor}</strong> disconnected</>}
                                            {event.kind === 'reconnected' && <><strong>{event.actor}</strong> reconnected</>}
                                            {event.kind === 'renamed' && <><strong>{event.actor}</strong> is now <strong>{event.target}</strong></>}
                                        </span>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            ))}
            <div className={`flex flex-col justify-center place-items-center ${lobbyReady ? '' : 'hidden'}`}>
                <div className='flex flex-row w-full h-full justify-center place-items-center'
                style={{width: '100vw'}}>
                <GameLogic key={gameKey} />
                </div>
                {gameStarted && (
                    <div className={(selfDead || roundRunning || winner || lockedIn) ? 'pointer-events-none opacity-50' : ''}>
                        <Moves onLockIn={handleLockIn} disabled={!!(selfDead || roundRunning || winner || lockedIn)} />
                    </div>
                )}
                {gameStarted && lockedIn && !roundRunning && !winner && !selfDead && (
                    <div className='waiting-msg unselectable'>
                        Moves locked in — waiting for the other gunslingers…
                        ({alivePlayers.filter((p) => p.ready).length}/{alivePlayers.length} ready)
                    </div>
                )}
                {gameStarted && selfDead && !winner && (
                    <div className='waiting-msg unselectable'>
                        💀 You're out, partner — watching the rest of the duel
                    </div>
                )}
            </div>
            {liveAction && (() => {
                // Top-center pop-up: who's acting and which move they used
                const subject = lobbyPlayers.find((p) => p.id === liveAction.id);
                if (!subject) return null;
                const label = ACTION_LABELS[liveAction.type] || liveAction.type;
                return (
                    <div key={liveAction.key} className='live-action-banner unselectable'>
                        <img
                            src={avatarFor(subject, Math.max(lobbyPlayers.indexOf(subject), 0))}
                            alt=''
                            style={{ width: '36px', height: '36px', objectFit: 'contain', imageRendering: 'pixelated', borderRadius: '50%', backgroundColor: 'var(--avatar-bg)' }}
                        />
                        <span>
                            <strong>{subject.nickname}</strong>
                            {liveAction.type === 'recovered' ? ' ' : ' used '}
                              {liveAction.type === 'recovered' ? `${label}` : <strong style={{ color: 'var(--accent)' }}>{label}</strong>}
                            {liveAction.type === 'recovered' && liveAction.move && <> (skipped <strong style={{ color: 'var(--accent)' }}>{liveAction.move}</strong>)</>}
                        </span>
                    </div>
                );
            })()}
            {!lobbyReady && !wasKicked && !joinError && !needPassword && (
                <div className='screen-overlay flex flex-col justify-center place-items-center' style={{ zIndex: '9090' }}>
                    <div className='loading-star'>★</div>
                    <div className='loading-text'>Saddling up…</div>
                </div>
            )}
            {standoff && !winner && (
                <div className='standoff-overlay'>
                    <div className='standoff-vignette'></div>
                    <div className='standoff-content'>
                        <div className='standoff-title'>Final Standoff</div>
                        <div className='standoff-vs'>
                            <div className='standoff-duelist'>
                                <img
                                    src={avatarFor(standoff[0], Math.max(lobbyPlayers.indexOf(standoff[0]), 0))}
                                    alt=''
                                    className='standoff-avatar'
                                />
                                <div className='standoff-name'>{standoff[0].nickname}</div>
                            </div>
                            <div className='standoff-vs-text'>VS</div>
                            <div className='standoff-duelist'>
                                <img
                                    src={avatarFor(standoff[1], Math.max(lobbyPlayers.indexOf(standoff[1]), 0))}
                                    alt=''
                                    className='standoff-avatar standoff-avatar-flip'
                                />
                                <div className='standoff-name'>{standoff[1].nickname}</div>
                            </div>
                        </div>
                        <div className='standoff-subtitle'>only one walks away…</div>
                    </div>
                </div>
            )}
            {winner && !roundRunning && !joinError && !wasKicked && (
                <div className='screen-overlay flex flex-col justify-center place-items-center'
                    style={{ zIndex: '9050' }}>
                    <div className='wanted-poster'>
                        <div className='wanted-title'>Wanted</div>
                        <div className='wanted-subtitle'>★ Alive &amp; Dangerous ★</div>
                        <img
                            src={avatarFor(winner, Math.max(lobbyPlayers.indexOf(winner), 0))}
                            alt=''
                            className='wanted-portrait'
                        />
                        <div className='wanted-name'>{winner.nickname}{winner.id === sessionId ? ' (you)' : ''}</div>
                        <div className='wanted-caption'>the last one standing</div>
                        <div className='wanted-reward'>Reward&nbsp;&nbsp;$5,000</div>
                        <button
                            onClick={() => socket.emit('resetGame')}
                            className='font-bold rounded-2xl p-2 btn-3d btn-3d-header'
                            style={{ backgroundColor: 'var(--header)', color: 'var(--text-light)', width: '160px', marginTop: '12px' }}>
                            Play again
                        </button>
                    </div>
                </div>
            )}
            {joinError && (
                <div className='screen-overlay flex flex-col justify-center place-items-center'
                    style={{ zIndex: '9100' }}>
                    <div style={{ width: '280px', userSelect: 'none' }}>
                        <div className='board-column-header' style={{ backgroundColor: 'var(--header)' }}>
                            Can't join lobby
                        </div>
                        <div className='flex flex-col place-items-center' style={{ background: 'var(--panel)', borderRadius: '0 0 5px 5px', padding: '12px 10px' }}>
                            <div style={{ fontSize: '14px', marginBottom: '10px', textAlign: 'center' }}>{joinError}</div>
                            <button
                                onClick={() => navigate('/')}
                                className='font-bold rounded-2xl p-2 btn-3d btn-3d-header'
                                style={{ backgroundColor: 'var(--header)', color: 'var(--text-light)', width: '160px' }}>
                                Back to menu
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {needPassword && !wasKicked && !joinError && (
                <div className='screen-overlay flex flex-col justify-center place-items-center'
                    style={{ zIndex: '9100' }}>
                    <div style={{ width: '280px', userSelect: 'none' }}>
                        <div className='board-column-header' style={{ backgroundColor: 'var(--header)' }}>
                            Private lobby
                        </div>
                        <div className='flex flex-col place-items-center' style={{ background: 'var(--panel)', borderRadius: '0 0 5px 5px', padding: '12px 10px' }}>
                            <div style={{ fontSize: '14px', marginBottom: '8px', textAlign: 'center' }}>
                                This lobby needs a password to enter.
                            </div>
                            <input
                                type='password'
                                placeholder='Password'
                                value={passwordInput}
                                onChange={(e) => { setPasswordInput(e.target.value); setPasswordWrong(false); }}
                                onKeyDown={(e) => e.key === 'Enter' && submitPassword()}
                                autoFocus
                                className={`rounded-2xl py-2 px-3 ${passwordWrong ? 'input-error' : ''}`}
                                style={{ width: '200px', height: '40px', marginBottom: '8px' }}
                            />
                            {passwordWrong && (
                                <div className='font-bold' style={{ color: 'var(--danger)', fontSize: '13px', marginBottom: '8px' }}>
                                    Wrong password, partner.
                                </div>
                            )}
                            <button
                                onClick={submitPassword}
                                className='font-bold rounded-2xl p-2 btn-3d btn-3d-header'
                                style={{ backgroundColor: 'var(--header)', color: 'var(--text-light)', width: '160px', marginBottom: '14px' }}>
                                Join
                            </button>
                            <button
                                onClick={() => navigate('/')}
                                className='font-bold rounded-2xl p-2 btn-3d btn-3d-danger mb-4'
                                style={{ backgroundColor: 'var(--danger)', color: 'var(--text-light)', width: '160px' }}>
                                Back to menu
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {wasKicked && (
                <div className='screen-overlay flex flex-col justify-center place-items-center'
                    style={{ zIndex: '9100' }}>
                    <div style={{ width: '260px', userSelect: 'none' }}>
                        <div className='board-column-header' style={{ backgroundColor: 'var(--header)' }}>
                            You were kicked
                        </div>
                        <div className='flex flex-col place-items-center' style={{ background: 'var(--panel)', borderRadius: '0 0 5px 5px', padding: '12px 10px' }}>
                            <div style={{ fontSize: '14px', marginBottom: '10px' }}>The lobby leader kicked you from the room.</div>
                            <button
                                onClick={() => navigate('/')}
                                className='font-bold rounded-2xl p-2 btn-3d btn-3d-header'
                                style={{ backgroundColor: 'var(--header)', color: 'var(--text-light)', width: '120px' }}>
                                oh.. :(
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {lobbyReady && !gameStarted && (
                <div className='flex flex-col flex-1 justify-center place-items-center' style={{ zIndex: '9001' }}>
                    <div className='mb-2'>
                        <HowToPlayButton />
                    </div>
                    <div style={{ width: '260px', userSelect: 'none' }}>
                        <div className='board-column-header' style={{ backgroundColor: 'var(--header)' }}>
                            Players ({lobbyPlayers.length})
                        </div>
                        <div style={{ background: 'var(--panel)', borderRadius: '0 0 5px 5px', padding: '6px 10px 16px' }}>
                            <ul>
                                {lobbyPlayers.map((player, index) => renderPlayerRow(player, index, true))}
                            </ul>
                            <div className='flex flex-col place-items-center gap-1' style={{ borderTop: '2px solid var(--muted)', marginTop: '10px', paddingTop: '14px' }}>
                                {isFirstPlayer ? (
                                    <button
                                        onClick={startGame}
                                        className={`m-2 mt-0 font-bold rounded-2xl p-2 btn-3d btn-3d-accent ${starting ? 'btn-3d-pressed pointer-events-none' : ''}`}
                                        style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-text)', width: '200px' }}>
                                        {starting ? 'Starting…' : `Start Game (${playerCount})`}
                                    </button>
                                ) : (
                                    <div className='host-wait-msg unselectable'>
                                        {starting || gameStarted ? 'Starting…' : 'Waiting for host to start…'}
                                    </div>
                                )}
                                <button
                                    onClick={leaveLobby}
                                    className='m-2 mt-0 font-bold rounded-2xl p-2 btn-3d btn-3d-danger'
                                    style={{ backgroundColor: 'var(--danger)', color: 'var(--text-light)', width: '200px' }}>
                                    Leave
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Lobby;
