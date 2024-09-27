import React, { useEffect, useRef, useState } from 'react';
import Moves from './Moves';
import socket from '../socketService'; // Import your socket service
import GameLogic from './GameLogic';

function Lobby({ roomId, nickname }) {
    const phaserGameRef = useRef(null);
    const [isFirstPlayer, setIsFirstPlayer] = useState(false);
    const [playerCount, setPlayerCount] = useState(0);
    const [spawnPlayers, setSpawnPlayers] = useState(null); // Add state to hold the SpawnPlayers function
    const [gameStarted, setGameStarted] = useState(false);
    

    useEffect(() => {
        // Update player count
        socket.on('updatePlayerCount', (PlayerCount) => {
            console.log('Player count received:', PlayerCount);
            setPlayerCount(PlayerCount);
        });

        // Listen for firstPlayer event from the server
        socket.on('firstPlayer', (isFirst) => {
            setIsFirstPlayer(isFirst);
        });

        // Cleanup on unmount
        return () => {
            if (phaserGameRef.current) {
                phaserGameRef.current.destroy(true);
            }
            socket.off('firstPlayer');
        };
    }, []);

    const handleLockIn = (nextMoves) => {
        console.log("Next Moves Locked In:", nextMoves);
        // Add more logic here as needed
    };

    const startGame = () => {
        console.log("Game is starting...");
        if (spawnPlayers) {
            spawnPlayers(playerCount); // Call SpawnPlayers with playerCount
        }
        setGameStarted(true);
    };
    socket.on(startGame)
    return (
        <div className='flex flex-col justify-center' style={{ padding: '20px', backgroundColor: '#421ced', width: '100vw', height: '100vh', zIndex: 9000}}>
            <div className="flex flex-col justify-start place-items-center" style={{ padding: '20px', backgroundColor: '#421ced' }}>
                <div className='absolute top-0 m-6 mt-2 font-bold rounded-2xl p-4 flex justify-center bg-blue-900 text-white'>
                    <h2>Welcome, {nickname}! You are in room "{roomId}".</h2>
                </div>
            </div>
            <div className={`flex flex-col justify-center place-items-center ${gameStarted ? '' : ''}`}>
                <div className='flex flex-row w-full h-full justify-center place-items-center'
                style={{width: '100vw'}}>
                <GameLogic setSpawnPlayers={setSpawnPlayers} /> {/* Pass down setSpawnPlayers */}
                </div>
                <Moves onLockIn={handleLockIn} />
            </div>
            <div className="flex flex-row justify-center place-items-center">
                {isFirstPlayer && (
                    <button
                        onClick={startGame}
                        className={`m-6 mt-0 font-bold rounded-2xl p-2 ${gameStarted ? '' : ''}`}
                        style={{ backgroundColor: 'rgb(42 18 149)', color: 'white', width: '200px' }}>
                        Start Game ({playerCount})
                    </button>
                )}
            </div>
        </div>
    );
}

export default Lobby;
