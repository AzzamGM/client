import React, { useEffect, useState, useRef, useCallback } from 'react';
import socket from '../socketService'; // Import your socket service
import Shoot from '../assets/CowBoyDraw.gif'
import Idle from '../assets/CowBoyIdle.gif'
import Walk from '../assets/CowBoyWalk.gif'
import Jump from '../assets/CowBoyJump.gif'
import Wounded from '../assets/CowBoyWounded.gif'
import Train from '../assets/train.png'
import Train2 from '../assets/train2.png'
import Train3 from '../assets/train3.png'
function GameLogic({ setSpawnPlayers }) {
    const [gameStarted, setGameStarted] = useState(false);
    const [roundStarted, setRoundStarted] = useState(false);
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const [platformCount, setPlatformCount] = useState();

    const [localSpawns, setLocalSpawns] = useState([]);
    const [localDirections, setLocalDirections] = useState([]);
    const localSpawnsRef = useRef(localSpawns);
    const localDirectionsRef = useRef(localDirections);

    const [platformSet, setPlatformSet] = useState(false);

    const CharShoot = Shoot
    const CharIdle = Idle
    const CharWalk = Walk
    const CharJump = Jump
    const CharWounded = Wounded
    const platform1 = Train
    const platform2 = Train2
    const platform3 = Train3


  useEffect(() => {
        const spawnPlayers = (xPlayers) => {
            const spawns = Array.from({ length: xPlayers + 2 }, () => []);
            setPlatformCount(xPlayers + 2);
            const spawnAreas = Array.from({ length: xPlayers }, (_, i) => i + 1);

            for (let i = 0; i < xPlayers; i++) {
                const randomIndex = Math.floor(Math.random() * spawnAreas.length);
                const spawnPlayer = spawnAreas[randomIndex];

                spawns[spawnPlayer].push(i + 1); // Use i + 1 as the player ID
                spawnAreas.splice(randomIndex, 1);
            }
            socket.emit('startGame', spawns); // Emit the final structure
        };

        setSpawnPlayers(() => spawnPlayers);

        const handleSetSpawns = (GlobalSpawns) => {
            console.log('Global spawns received:', GlobalSpawns);
            setLocalSpawns(GlobalSpawns); // Mark that spawns have been set
            localSpawnsRef.current = GlobalSpawns; // Update the ref as well
            console.log('Local spawns:', localSpawnsRef.current)

        };

        socket.on('setPlayerDirections', setLocalDirections);
        socket.on('setSpawns', handleSetSpawns);

        // Cleanup listener on unmount
        return () => {
            socket.off('setPlayerDirections', setLocalDirections);
            socket.off('setSpawns', handleSetSpawns);
        };
    }, [setSpawnPlayers]); // Add spawnsSet to dependency array

    useEffect(() => {
        const handleUpdatePlayers = (players) => {
            //console.log('Updated players:', players);
            //console.log('Player count was received:', Object.keys(players).length);

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
                        await delay(2500); // Delay of 500 milliseconds (adjust as needed)
                    }
                }
    
                //setRoundStarted(false); // Reset round started flag after completing the round
            }
        };
    
        socket.on('StartRound', handleStartRound);
        
        return () => {
            socket.off('StartRound', handleStartRound);
        };
    }, [roundStarted]);
    
    const applyMove = useCallback((player, playerId, moveNumber, move) => {
        // Ensure the latest state values are used
        const currentLocalSpawns = localSpawnsRef.current;
        // const currentLocalDirections = localDirectionsRef.current;
    
        if (localDirectionsRef.current) {
            const directionEntry = Object.entries(localDirectionsRef.current).find(([key, value]) => value[0] === player);
            
            if (directionEntry && directionEntry[1].length > 1) {
                const Direction = directionEntry[1][1]; // Get the direction if available
                const flattened = currentLocalSpawns.flat();
                const targetIndex = flattened.indexOf(player);
    
                console.log(`Player ${player} Move ${moveNumber}: ${move}`);
                if (targetIndex === -1) {
                    console.log(`Player ${player} is already dead.`);
                    return;
                } else {
                    switch (move) {
                        case 'Forward':
                            movePlayer(localSpawnsRef.current, player, Direction);
                            console.log(Direction);
                            break;
                        case 'Attack':
                            findNearestPlayer(player);
                            console.log('ATTACKED');
                            break;
                        case 'Turn':
                            turnPlayer(player)
                            break;
                        default:
                            console.log('Unknown move:', move);
                            
                    }
                    console.log(localSpawnsRef.current)
                }
            }
        }
    }, []);

    const moveElement = useCallback((playerID, newPlatform, Direction, type) => {
        const element = document.getElementById(playerID);
        const targetDiv = document.getElementById('p' + newPlatform);
        const currentDiv = element.parentElement
        const indexOfElement = Array.from(currentDiv.children).findIndex(child => child.id === String(playerID));
        if (!element || !targetDiv) {
            console.log('Element or targetDiv not found');
            return;
        }
        // Calculate the current position and the target position
        const rect = element.getBoundingClientRect();
        const targetRect = targetDiv.getBoundingClientRect();
        
        let minusWidth = element.getBoundingClientRect().width;
    
        if (Direction === 'L') {
            minusWidth = element.getBoundingClientRect().width / 2;
        } else {
            minusWidth = -element.getBoundingClientRect().width / 2;
        }

        // Shift all current child divs to the left or right

        const currnetChildDivs = currentDiv.querySelectorAll('img');
        currnetChildDivs.forEach((child, childIndex) => {
            const currentChildTransform = window.getComputedStyle(child).transform;
            console.log(indexOfElement, childIndex)
            if(childIndex !== indexOfElement) {       

            
            let shiftDirection = 1 // if index of tyhis child
            setTimeout(() => {

                if (childIndex > indexOfElement) {
                    // Apply a different transformation or effect if the indices match
                    shiftDirection = -1
                } else {
                    shiftDirection = 1
                }

                let scaleX = 1; // Default to positive scale
                if (currentChildTransform && currentChildTransform.startsWith('matrix')) {
                    const matrixValues = currentChildTransform.match(/matrix\(([^)]+)\)/)[1].split(', ').map(Number);
                    scaleX = matrixValues[0]; // First value is scaleX
                }



                // Calculate the adjustment based on the scale
                //(scaleX < 0 ? 1 : -1)
                const adjustment = (scaleX < 0 ? 1 : 1) * Math.abs(minusWidth) * shiftDirection;
                
                console.log(`adjustment: ${adjustment}, for child ${childIndex}, ${child.id}`);
                // Apply the translateX transformation
                child.style.transform = `translateX(${adjustment}px) ${currentChildTransform} `;
                child.style.transition = `all 0.2s linear`; 
                child.src = CharWalk;
            }, 200);
            setTimeout(() => {
                child.src = CharIdle;
            }, 400);
            setTimeout(() => {
                let scaleX = 1; // Default to positive scale
                if (currentChildTransform && currentChildTransform.startsWith('matrix')) {
                    const matrixValues = currentChildTransform.match(/matrix\(([^)]+)\)/)[1].split(', ').map(Number);
                    scaleX = matrixValues[0]; // First value is scaleX
                }
                child.style.transform = `scaleX(${scaleX})`; 
                child.style.transition = ``;
            }, 1500);
        }
        else{
            return
        }
        })










        // Shift all target child divs to the left or right
        const childDivs = targetDiv.querySelectorAll('img');
        childDivs.forEach(child => {
            const currentChildTransform = window.getComputedStyle(child).transform;
            setTimeout(() => {
            // Extract scaleX from the current transform if it's in matrix form
            let scaleX = 1; // Default to positive scale
            if (currentChildTransform && currentChildTransform.startsWith('matrix')) {
                const matrixValues = currentChildTransform.match(/matrix\(([^)]+)\)/)[1].split(', ').map(Number);
                scaleX = matrixValues[0]; // First value is scaleX
            }
    
            // Calculate the adjustment based on the scale
            const adjustment = (scaleX < 0 ? 1 : -1) * minusWidth;
    
            // Apply the translateX transformation
            child.style.transform = `${currentChildTransform} translateX(${adjustment}px)`;
            child.style.transition = `all 0.2s linear`; 
    
            child.src = CharWalk;
            }, 200);
            // Reset image after a brief period
            setTimeout(() => {          
                child.src = CharIdle;
            }, 400);
    
            // Reset the transform after a delay
            setTimeout(() => {
                let scaleX = 1; // Default to positive scale
                if (currentChildTransform && currentChildTransform.startsWith('matrix')) {
                    const matrixValues = currentChildTransform.match(/matrix\(([^)]+)\)/)[1].split(', ').map(Number);
                    scaleX = matrixValues[0]; // First value is scaleX
                }
                child.style.transform = `scaleX(${scaleX})`; 
                child.style.transition = ``;

            }, 1500); // Match with the transition duration
        });
    





        // Calculate translate values
        const translateX = (targetRect.left + targetRect.width / 2) - (rect.left + rect.width / 2);
        const translateY = targetRect.bottom - rect.bottom; // Keep vertical position unchanged
    
        // Get the current transform for the player element
        const currentScale = element.style.transform;
    
        element.style.transition = (type === 'Forward') ? 'all 1.5s linear' : 'all 1s ease';
    
        // Set the new transform, keeping the scaleX intact
        if (targetDiv.childNodes.length > 0) {
            element.style.transform = `translate(${translateX + (minusWidth * (targetDiv.childNodes.length))}px, ${translateY}px) ${currentScale}`;
        } else {
            element.style.transform = `translate(${translateX}px, ${translateY}px) ${currentScale}`;
        }
    
        type === 'Forward' ? element.src = CharWalk : element.src = CharWounded;
    
        // After a delay, append the element to the new platform
        setTimeout(() => {
            Direction === 'R' ? targetDiv.insertBefore(element, targetDiv.firstChild) : targetDiv.appendChild(element);
            
            // Maintain the existing scale transformation
            element.style.transform = currentScale; // Keep the scale transformation
            element.style.transition = ``; // Reset the transition
            if (type === 'Forward') {
                element.src = CharIdle;
            }
        }, 1500); // Match the duration with CSS transition
    }, []);
    
    
    
    const turnPlayer = useCallback((playerID) => {
        const currentLocalDirections = localDirectionsRef.current;

        // Ensure we have the current directions
        if (currentLocalDirections) {
            const directionEntry = Object.entries(currentLocalDirections).find(([key, value]) => value[0] === playerID);
            
            if (directionEntry && directionEntry[1].length > 1) {
                const currentDirection = directionEntry[1][1]; // Get the current direction
                
                // Toggle direction
                const newDirection = currentDirection === 'L' ? 'R' : 'L';
                
                // Update the direction in localDirectionsRef
                directionEntry[1][1] = newDirection; // Set the new direction
    
                console.log(`Player ${playerID} direction turned from ${currentDirection} to ${newDirection}`);
            }
        }
    
        const element = document.getElementById(playerID);
        
        if (!element) {
            console.log('Element not found');
            return;
        }
        
        // Flip the element visually
        const scale = element.style.transform;
        const transition = element.style.transition;

        element.style.transition = 'all 0.05s linear'; 
  
        scale === 'scaleX(-1)' ? element.style.transform = 'scaleX(1)' :  element.style.transform = 'scaleX(-1)';

        // Reset the transition immediately after the flip
        setTimeout(() => {
            element.style.transition = `transition`
            console.log(element.style.transform);
        }, 1000);
    }, []);
    
    

const movePlayer = useCallback((Platforms, playerId, direction) => {
    // Create a deep copy of Platforms to avoid direct modification
    const updatedPlatforms = Platforms.map(platform => [...platform]); // Shallow copy of each platform
    
    for (let i = 0; i < updatedPlatforms.length; i++) {
        if (updatedPlatforms[i].includes(playerId)) {
            const index = updatedPlatforms[i].indexOf(playerId);
            const value = updatedPlatforms[i].splice(index, 1)[0]; // Remove playerId
            if (direction === 'L' && i > 0) {
                moveElement(playerId, i - 1, direction, 'Forward');
                updatedPlatforms[i - 1].push(value); // Move left
                console.log(`${playerId} moved L (${i} to ${i - 1})`);
            } else if (direction === 'R' && i < updatedPlatforms.length - 1) {
                moveElement(playerId, i + 1, direction, 'Forward');
                updatedPlatforms[i + 1].unshift(value); // Move right
                console.log(`${playerId} moved R (${i} to ${i + 1})`);
            } else {
                console.log(playerId, ' fell off the platforms');
            }
            localSpawnsRef.current = updatedPlatforms
            break;
        }
    } // Update state with the new platformsw
}, []);

const knockbackPlayer = useCallback((Platforms, playerId, Direction) => {
    // Create a deep copy of Platforms to avoid direct modification
    const updatedPlatforms = Platforms.map(platform => [...platform]); // Shallow copy of each platform

    setTimeout(() => {
        
  
    for (let i = 0; i < updatedPlatforms.length; i++) {
        if (updatedPlatforms[i].includes(playerId)) {
            const index = updatedPlatforms[i].indexOf(playerId);
            const value = updatedPlatforms[i].splice(index, 1)[0]; // Remove playerId
            if (Direction === 'L' && i > 0) {
                moveElement(playerId, i - 1, Direction, 'Back');
                updatedPlatforms[i - 1].push(value); // Move left
                console.log(`${playerId} was shot L (${i} to ${i - 1})`);
            } else if (Direction === 'R' && i < updatedPlatforms.length - 1) {
                moveElement(playerId, i + 1, Direction, 'Back');
                updatedPlatforms[i + 1].unshift(value); // Move right
                console.log(`${playerId} was shot R (${i} to ${i + 1})`);
            }
            localSpawnsRef.current = updatedPlatforms
            break;
        }
    } // Update state with the new platformsw
}, 950);
}, []);

    
    function findNearestPlayer(playerID) {
        const currentLocalSpawns = localSpawnsRef.current;
        const currentLocalDirections = localDirectionsRef.current;
    
        const directionEntry = Object.entries(currentLocalDirections).find(([key, value]) => value[0] === playerID);
        const Direction = directionEntry ? directionEntry[1][1] : null; // Get the direction if available
    
        const element = document.getElementById(playerID);
        console.log('current local spawns: ', currentLocalSpawns, ' current directions: ', currentLocalDirections);
    
        if (!currentLocalSpawns || currentLocalSpawns.length === 0) {
            console.log('localSpawns is empty');
            return;
        }
    
        if (!currentLocalDirections || Object.keys(currentLocalDirections).length === 0) {
            console.log('localDirections is empty');
            return;
        }
    
        const flattened = currentLocalSpawns.flat();
    
        if (!flattened.includes(playerID)) {
            console.log('INVALID PLAYER ID');
            return;
        }
    
        const targetIndex = flattened.indexOf(playerID);
        let nearestTarget = null;
        let nearestDistance = Infinity;
    
        for (let i = 0; i < flattened.length; i++) {
            if (flattened[i] !== playerID) {
                const distance = Math.abs(i - targetIndex);
                // Only consider players based on direction
                if ((Direction === 'R' && i > targetIndex) || (Direction === 'L' && i < targetIndex)) {
                    if (distance < nearestDistance) {
                        nearestDistance = distance;
                        nearestTarget = flattened[i];
                    }
                }
            }
        }
        localSpawnsRef.current = currentLocalSpawns;
        if (nearestTarget) {
            if (element) {
                knockbackPlayer(currentLocalSpawns, nearestTarget, Direction);
                element.src = CharShoot; // Ensure CharShoot is defined

            }
        } else {
            console.log('NO NEAREST TARGET FOUND');
            return null;
        }
        setTimeout(() => {
            element.src = CharIdle;
        }, 1100);

    }
    

    
    useEffect(() => {    
        localSpawnsRef.current = localSpawns;
    }, [localSpawns]);
    
    useEffect(() => {    
        localDirectionsRef.current = localDirections;
        console.log(localDirectionsRef.current)
    }, [localDirections]);


    const style = {
    objectFit: 'contain',// Adding transition for smooth movement
    backgroundRepeat: 'no-repeat',
    height: '300px',
    width: '300px'
};
    return (
    <div className='flex flex-row place-items-end justify-center items-stretch top-0'
    style={{width: '100vw'}}>
        {/* Creating multiple divs */}
        {localSpawns.map((spawn, index) => {   let rndtrain;
        let rndplatform;
        const platformIndex = index % 3 + 1; 
        switch (platformIndex) {
            case 1:
                rndplatform = platform1;
                break;
            case 2:
                rndplatform = platform2;
                break;
            case 3:
                rndplatform = platform3;
                break;
            default:
                rndplatform = platform1;
                break
        }

            if (spawn > 0) {
                const keys = Object.keys(localDirections);
                const direction = localDirections[keys[index - 1]];

                // Check if direction is not null
                if (direction) {
                    const FacingLeft = direction[1] === 'L';
                    const PlayerID = direction[0];
                    return (
                        <div key={index} id={'p'+index} className={`grow flex place-items-end justify-center character`}
                        style={{backgroundImage: `url(${rndplatform})`, 
                        backgroundSize: 'contain',
                        backgroundPosition: 'center bottom',
                        imageRendering: 'pixelated',
                        ...style
                        }}>
                            <img 
                                id={PlayerID} 
                                src={CharIdle} 
                                alt="Character" 
                                crossOrigin="anonymous" 
                                style={{ 
                                    width: '20%', 
                                    objectFit: 'contain',
                                    imageRendering: 'pixelated',
                                    transform: FacingLeft ? 'scaleX(-1)' : 'scaleX(1)',
                                    //filter: PlayerID===1 ? `hue-rotate(0deg)` : `hue-rotate(${PlayerID*90}deg)`,
                                }} 
                                className={`place-self-end character`}
                                //className={`place-self-end ${isMoving ? 'moving' : ''}`}
                            />
                        </div>
                    );
                }
            } else {         
                return (
                    <div key={index} id={'p'+index} className={`grow flex place-items-end justify-center unselectable`}
                    style={{backgroundImage: `url(${rndplatform})`, 
                    backgroundSize: 'contain',
                    backgroundPosition: 'center bottom',
                    imageRendering: 'pixelated',
                    ...style
                    }}> 
        
                    </div>
                );
            }
})}


    </div>
    ); // No UI needed for this component
}

export default GameLogic;
