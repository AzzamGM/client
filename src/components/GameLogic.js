import React, { useEffect, useState } from 'react';
import socket from '../socketService'; // Import your socket service
import Shoot from '../assets/CowBoyDraw.gif'
import Idle from '../assets/CowBoyIdle.gif'
import Train from '../assets/train.png'
import Train2 from '../assets/train2.png'
function GameLogic({ setSpawnPlayers }) {
    const [gameStarted, setGameStarted] = useState(false);
    const [roundStarted, setRoundStarted] = useState(false);
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const [platformCount, setPlatformCount] = useState();
    const [localSpawns, setLocalSpawns] = useState([])
    const [localDirections, setLocalDirections] = useState([])
    const cowboy1 = Shoot
    const cowboy2 = Idle
    const platform1 = Train
    const platform2 = Train2

    useEffect(() => {
        const handleUpdatePlayers = (players) => {
            console.log('Updated players:', players);
            console.log('Player count was received:', Object.keys(players).length);

            Object.keys(players).forEach((xPlayerId, i) => {
                const xPlayerMoves = players[xPlayerId];

                if (xPlayerMoves.length === 3) {
                    console.log(`Player ${i + 1} (${xPlayerId}) picked moves:`, xPlayerMoves);
                } else {
                    console.log(`Player ${i + 1} (${xPlayerId}) didn't pick yet:`, xPlayerMoves);
                }
            });
        };

        socket.on('updatePlayers', handleUpdatePlayers);
    
        return () => {
            socket.off('updatePlayers', handleUpdatePlayers);
        };
    }, []);

    useEffect(() => {
        const handleStartRound = async (players) => {
            if (!roundStarted) {
                setRoundStarted(true);
                console.log('Round is starting...');
    
                const maxMoves = Math.max(...Object.values(players).map(moves => moves.length));
    
                for (let moveIndex = 0; moveIndex < maxMoves; moveIndex++) {
                    for (const [i, xPlayerId] of Object.entries(Object.keys(players))) {
                        const xPlayerMoves = players[xPlayerId];
    
                        if (moveIndex < xPlayerMoves.length) {
                            const move = xPlayerMoves[moveIndex];
                            applyMove(parseInt(i) + 1, xPlayerId, moveIndex + 1, move);
                        }
    
                        // Delay between iterations
                        await delay(500); // Delay of 500 milliseconds (adjust as needed)
                    }
                }
    
                setRoundStarted(false); // Reset round started flag after completing the round
            }
        };
    
        socket.on('StartRound', handleStartRound);
        
        return () => {
            socket.off('StartRound', handleStartRound);
        };
    }, [roundStarted]);
    

    const applyMove = (player, playerId, moveNumber, move) => {
        console.log(`Player ${player} (${playerId}) Move ${moveNumber}:`, move);
        switch (move) {
            case move === 'Forward':
              
              break;
            case move === 'Shoot':

              break;
            case move === 'Swap':

              break;
            case move === 'Turn':

              break;
            case move === 'x':

              break;
            case move === 'y':
          }
        
    };
    
    function findNearestPlayer(topPlatforms, playerID, direction) {
        const flattened = [];
        for (const item of topPlatforms) {
            if (Array.isArray(item)) {
                flattened.push(...item);
            } else {
                flattened.push(item);
            }
        }

        const targetIndex = flattened.indexOf(playerID);
        if (targetIndex === -1) {
            throw new Error("Target ID not found in topPlatforms");
        }

        let nearestTarget = null;
        let nearestDistance = Infinity;

        for (let i = 0; i < flattened.length; i++) {
            if (flattened[i] !== playerID) {
                const distance = Math.abs(i - targetIndex);
                if (
                    (direction === "left" && i < targetIndex && distance < nearestDistance) ||
                    (direction === "right" && i > targetIndex && distance < nearestDistance)
                ) {
                    nearestDistance = distance;
                    nearestTarget = flattened[i];
                }
            }
        }

        return nearestTarget; // Returns null if no nearest player found
    }

    useEffect(() => {
        const spawnPlayers = (xPlayers) => {
            const spawns = Array.from({ length: xPlayers + 2 }, () => []);
            setPlatformCount(xPlayers + 2)
            const spawnAreas = Array.from({ length: xPlayers }, (_, i) => i + 1);
            console.log("Initial spawn areas:", spawns);

            for (let i = 0; i < xPlayers; i++) {
                const randomIndex = Math.floor(Math.random() * spawnAreas.length);
                const spawnPlayer = spawnAreas[randomIndex];

                spawns[spawnPlayer].push(i + 1); // Use i + 1 as the player ID
                spawnAreas.splice(randomIndex, 1);
                console.log(`Spawned player at area: ${spawnPlayer}`);
            }
            console.log("Final spawns structure:", spawns);
            socket.emit('startGame', spawns); // Emit the final structure
        };

        setSpawnPlayers(() => spawnPlayers);

        const handleSetSpawns = (GlobalSpawns) => {
            if (!gameStarted) {
                console.log('Global spawns received:', GlobalSpawns);
                setLocalSpawns(GlobalSpawns)
                console.log('Local spawns: ', localSpawns)
                setGameStarted(true); // Set the game started flag
            } else {
                setGameStarted(false); // Reset the game started flag if needed
            }
        };
        socket.on('setPlayerDirections', setLocalDirections)
        socket.on('setSpawns', handleSetSpawns);

        // Cleanup listener on unmount
        return () => {
            socket.off('setPlayerDirections', setLocalDirections)
            socket.off('setSpawns', handleSetSpawns);
        };
    }, [setSpawnPlayers, gameStarted]); // Add gameStarted to dependency array

    return (
    <div className='flex flex-row place-items-end justify-center items-stretch'
    style={{width: '100vw'}}>
            {/* Creating multiple divs */}
            {localSpawns.map((spawn, index) => {
    if (spawn > 0) {
        const keys = Object.keys(localDirections);
        const direction = localDirections[keys[index - 1]];

        // Check if direction is not null
        if (direction) {
            const FacingLeft = direction[1] === 'L';
            const PlayerID = direction[0];
            console.log(localDirections);
            return (
                <div key={index} className={`grow m-0 p-4rounded-md flex place-items-end justify-center unselectable`}
                style={{backgroundImage: `url(${platform2})`, 
                backgroundSize: 'contain',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                imageRendering: 'pixelated',
                width: '300px',
                }}>
                    <img 
                        id={PlayerID} 
                        src={cowboy1} 
                        alt="Character" 
                        crossOrigin="anonymous" 
                        style={{ 
                            width: '40%', 
                            objectFit: 'contain', // or 'cover' based on your needs 
                            imageRendering: 'pixelated',
                            transform: FacingLeft ? 'scaleX(-1)' : 'scaleX(1)',
                        }} 
                        className={`place-self-end`}
                    />       
                </div>
            );
        } else {
            // Handle the case where direction is null
            return (
                <div key={index} className={`grow m-0 p-4rounded-md flex place-items-end justify-center unselectable`}
                style={{backgroundImage: `url(${platform2})`, 
                backgroundSize: 'contain',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                imageRendering: 'pixelated',
                width: '300px',
                }}>   
                </div>
            );
        }
    } else {
        return (
            <div key={index} className={`grow m-0 p-4rounded-md flex place-items-end justify-center unselectable`}
            style={{backgroundImage: `url(${platform1})`, 
            backgroundSize: 'contain',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            imageRendering: 'pixelated',
            width: '300px',
            }}>   
            </div>
        );
    }
})}

    </div>
    ); // No UI needed for this component
}

export default GameLogic;
