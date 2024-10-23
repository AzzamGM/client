import React, { useEffect, useState, useRef, useCallback } from 'react';
import socket from '../socketService'; // Import your socket service
import Shoot from '../assets/CowBoyDraw.gif'
import Idle from '../assets/CowBoyIdle.gif'
import Walk from '../assets/CowBoyWalk.gif'
import Jump from '../assets/CowBoyJump.gif'
import Climb from '../assets/CowBoyClimb.gif'
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
    const localBotRef = useRef(localSpawns);
    const localTopRef = useRef([])
    const localDirectionsRef = useRef(localDirections);

    const [platformSet, setPlatformSet] = useState(false);

    const CharShoot = Shoot
    const CharIdle = Idle
    const CharWalk = Walk
    const CharJump = Jump
    const CharClimb = Climb
    const CharWounded = Wounded
    const platform1 = Train
    const platform2 = Train2
    const platform3 = Train3


  useEffect(() => {
        const spawnPlayers = (xPlayers) => {
            const spawns = Array.from({ length: xPlayers + 2 }, () => []);
            localTopRef.current = Array.from({ length: xPlayers + 2 }, () => []);
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
            localBotRef.current = GlobalSpawns; // Update the ref as well
            console.log('Local spawns:', localBotRef.current)

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
                        let Status = localDirectionsRef.current[xPlayerId][3]
                        console.log(Status)
                        if(Status !== 'D'){
                        await delay(2500); // Delay of 500 milliseconds (adjust as needed)
                        }
                        else{
                            console.log('Player is dead')
                        }
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
        let currentLocalSpawns = localBotRef.current;
        // const currentLocalDirections = localDirectionsRef.current;
    
        if (localDirectionsRef.current) {
            const directionEntry = Object.entries(localDirectionsRef.current).find(([key, value]) => value[0] === player);
            
            if (directionEntry && directionEntry[1].length > 1) {
                const VDirection = directionEntry[1][1]; // Get the HORIZONTAL direction if available
                const HDirection = directionEntry[1][2]; // Get the VERTICAL direction if available
                const Status = directionEntry[1][3]; // Get the player status: (D)ead or (A)live
                if(HDirection === 'B'){
                    currentLocalSpawns = localBotRef.current;
                }
                else{
                    currentLocalSpawns = localTopRef.current;
                }
                const flattened = currentLocalSpawns.flat();
                const targetIndex = flattened.indexOf(player);
                
                console.log(`Player ${player} Move ${moveNumber}: ${move}`);
                if (Status === 'D') {
                    console.log(`Player ${player} is already dead.`);
                    return;
                } else {
                    switch (move) {
                        case 'Forward':
                            console.log(HDirection)
                            movePlayer(currentLocalSpawns, player, HDirection, VDirection); 
                            break;
                        case 'Attack':
                            findNearestPlayer(player, HDirection);
                            console.log('ATTACKED');
                            break;
                        case 'Turn':
                            turnPlayer(player)
                            break;
                        case 'Climb':
                            climbPlayer(player, HDirection, VDirection);
                            break;
                        default:
                            console.log('Unknown move:', move);
                            
                    }
                    console.log('T: ', localTopRef.current)
                    console.log('B: ', localBotRef.current)
                    console.log('directionEntry: ', directionEntry)
                }
            }
        }
    }, []);

    const moveElement = useCallback((playerID, newPlatform, vdirection, hdirection, type) => {
        console.log('current hdirection: ', hdirection)
        const element = document.getElementById(playerID);
        let targetDiv;

        if (hdirection === 'T') {
            targetDiv = document.getElementById('tp' + newPlatform);
        } else if (hdirection === 'B') {
            targetDiv = document.getElementById('bp' + newPlatform);
        }
        if (hdirection === 'B' && type === 'Climb') {
            targetDiv = document.getElementById('tp' + newPlatform);
        } else if (hdirection === 'T' && type === 'Climb') {
            targetDiv = document.getElementById('bp' + newPlatform);
        }
        
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
    
        if (vdirection === 'L') {
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
                if (type !== 'FellForward' && type !== 'FellBack') {
                    child.style.transform = `translateX(${adjustment}px) ${currentChildTransform} `;
                    console.log('didnt fall')
                }
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
            if(child !== element){
                
            
            
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
        }
    });
    





        // Calculate translate values
        const translateX = (targetRect.left + targetRect.width / 2) - (rect.left + rect.width / 2);
        const translateY = targetRect.bottom - rect.bottom; // Keep vertical position unchanged
    
        // Get the current transform for the player element
        const currentScale = element.style.transform;
    
        element.style.transition = (type === 'Forward') || (type === 'FellForward') ? 'all 1.5s linear' : 'all 1s ease';
        const transformValue = element.style.transform; // Get the transform value
        const scaleXMatch = transformValue.match(/scaleX\(([-+]?\d*\.?\d+)\)/); // Regex to extract scaleX        
        const scaleX = parseFloat(scaleXMatch[1]); // Convert matched value to a number
        // Set the new transform, keeping the scaleX intact
        if (targetDiv.childNodes.length > 0 && type !== 'FellForward' && type !== 'FellBack') {
            element.style.transform = `translate(${translateX + (minusWidth * (targetDiv.childNodes.length))}px, ${translateY}px) ${currentScale}`;
        } else if (type !== 'FellForward' && type !== 'FellBack') {
            element.style.transform = `translate(${translateX}px, ${translateY}px) ${currentScale}`;
        }
        else{
            element.style.transform = `translate(${500*scaleX}px, ${translateY}px) ${currentScale}`;
        }



        if (type === 'Forward' || type === 'FellForward') {
            element.src = CharWalk;
        } else if (type === 'Climb') {
            element.src = CharClimb;
        } else if(type === 'Back' || type === 'FellBack'){ 
            element.src = CharWounded;
        }
        
    
        // After a delay, append the element to the new platform
        if(type === 'Back' || type === 'Forward'){
            setTimeout(() => {
                vdirection === 'R' ? targetDiv.insertBefore(element, targetDiv.firstChild) : targetDiv.appendChild(element);
                
                // Maintain the existing scale transformation
                element.style.transform = currentScale; // Keep the scale transformation
                element.style.transition = ``; // Reset the transition
                if (type === 'Forward') {
                    element.src = CharIdle;
                }
            }, 1500); // Match the duration with CSS transition
        }
        else if(type === 'Climb'){
            setTimeout(() => {
                vdirection === 'R' ? targetDiv.insertBefore(element, targetDiv.firstChild) : targetDiv.appendChild(element);
                
                // Maintain the existing scale transformation
                element.style.transform = currentScale; // Keep the scale transformation
                element.style.transition = ``; // Reset the transition
                element.src = CharIdle;
                
            }, 500); // Match the duration with CSS transition   
        }
        else{
            setTimeout(() => {
                element.remove()           
            }, 1500); // Match the duration with CSS transition   
        }
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
    
    

const movePlayer = useCallback((Platforms, playerId, hdirection, vdirection) => {
    // Create a deep copy of Platforms to avoid direct modification

    let currentBotLocalSpawns = localBotRef.current;
    let currentTopLocalSpawns = localTopRef.current;
    const botUpdatedPlatforms = currentBotLocalSpawns.map(platform => [...platform]); // Shallow copy of each platform
    const topUpdatedPlatforms = currentTopLocalSpawns.map(platform => [...platform]); // Shallow copy of each platform
    if(hdirection === 'B'){
        for (let i = 0; i < botUpdatedPlatforms.length; i++) {
            if (botUpdatedPlatforms[i].includes(playerId)) {
                const index = botUpdatedPlatforms[i].indexOf(playerId);
                const value = botUpdatedPlatforms[i].splice(index, 1)[0]; // Remove playerId
                if (vdirection === 'L' && i > 0) {
                    moveElement(playerId, i - 1, vdirection, hdirection, 'Forward');
                    botUpdatedPlatforms[i - 1].push(value); // Move left
                    console.log(`${playerId} moved L (${i} to ${i - 1})`);
                } else if (vdirection === 'R' && i < botUpdatedPlatforms.length - 1) {
                    moveElement(playerId, i + 1, vdirection, hdirection, 'Forward');
                    botUpdatedPlatforms[i + 1].unshift(value); // Move right
                    console.log(`${playerId} moved R (${i} to ${i + 1})`);
                } else {
                    moveElement(playerId, i, vdirection, hdirection, 'FellForward');
                    flipStatus(playerId);
                    console.log(playerId, ' fell off the platforms');
                }
                localBotRef.current = botUpdatedPlatforms
                break;
            }
        } // Update state with the new platformsw
    }
    else if(hdirection === 'T'){
        for (let i = 0; i < topUpdatedPlatforms.length; i++) {
            if (topUpdatedPlatforms[i].includes(playerId)) {
                const index = topUpdatedPlatforms[i].indexOf(playerId);
                const value = topUpdatedPlatforms[i].splice(index, 1)[0]; // Remove playerId
                if (vdirection === 'L' && i > 0) {
                    moveElement(playerId, i - 1, vdirection, hdirection, 'Forward');
                    topUpdatedPlatforms[i - 1].push(value); // Move left
                    console.log(`${playerId} moved L (${i} to ${i - 1})`);
                } else if (vdirection === 'R' && i < topUpdatedPlatforms.length - 1) {
                    moveElement(playerId, i + 1, vdirection, hdirection, 'Forward');
                    topUpdatedPlatforms[i + 1].unshift(value); // Move right
                    console.log(`${playerId} moved R (${i} to ${i + 1})`);
                } else {
                    moveElement(playerId, i, vdirection, hdirection, 'FellForward');
                    flipStatus(playerId);
                    console.log(playerId, ' fell off the platforms');
                }
                localTopRef.current = topUpdatedPlatforms
                break;
            }
        } // Update state with the new platformsw
    }
}, []);

const flipStatus = useCallback((playerId) => {
    const currentLocalDirections = localDirectionsRef.current;

    // Ensure we have the current directions
    if (currentLocalDirections) {
        const statusEntry = Object.entries(currentLocalDirections).find(([key, value]) => value[0] === playerId);
        
        if (statusEntry && statusEntry[1].length > 1) {
            setTimeout(() => {
                const currentStatus = statusEntry[1][3]; // Get the current direction
                
                // Toggle direction
                const newStatus = currentStatus === 'D' ? 'A' : 'D';
                console.log('new: ', newStatus, 'current: ', currentStatus);
                
                // Update the direction in localDirectionsRef
                statusEntry[1][3] = newStatus; // Set the new direction

                console.log(`Player ${playerId} direction turned from ${currentStatus} to ${newStatus}`);
            }, 2000); // 2-second delay
        }
    }
}, []);


const climbPlayer = useCallback((playerId, hdirection, vdirection) => {
    console.log(hdirection)
    let currentBotLocalSpawns = localBotRef.current;
    let currentTopLocalSpawns = localTopRef.current;
    const botUpdatedPlatforms = currentBotLocalSpawns.map(platform => [...platform]); // Shallow copy of each platform
    const topUpdatedPlatforms = currentTopLocalSpawns.map(platform => [...platform]); // Shallow copy of each platform

    const currentLocalDirections = localDirectionsRef.current;

    // Ensure we have the current directions

    console.log('CLIMB LOG: ', hdirection, vdirection)
    if(hdirection === 'T'){
        for (let i = 0; i < topUpdatedPlatforms.length; i++) {
            if (topUpdatedPlatforms[i].includes(playerId)) {
                const index = topUpdatedPlatforms[i].indexOf(playerId);
                const value = topUpdatedPlatforms[i].splice(index, 1)[0]; // Remove playerId
                if (vdirection === 'L') {
                    moveElement(playerId, i, vdirection, hdirection, 'Climb');
                    botUpdatedPlatforms[i].push(value); 

                } else if (vdirection === 'R') {
                    moveElement(playerId, i, vdirection, hdirection, 'Climb');
                    botUpdatedPlatforms[i].unshift(value);          
                } 
                localBotRef.current = botUpdatedPlatforms
                localTopRef.current = topUpdatedPlatforms
                console.log('moved to bottom', hdirection)
                break;
            }
        }
    } 
    else if(hdirection === 'B'){
        for (let i = 0; i < botUpdatedPlatforms.length; i++) {
            if (botUpdatedPlatforms[i].includes(playerId)) {
                const index = botUpdatedPlatforms[i].indexOf(playerId);
                const value = botUpdatedPlatforms[i].splice(index, 1)[0]; // Remove playerId
                if (vdirection === 'L') {
                    moveElement(playerId, i, vdirection, hdirection, 'Climb');
                    topUpdatedPlatforms[i].push(value); 

                } else if (vdirection === 'R') {
                    moveElement(playerId, i, vdirection, hdirection, 'Climb');
                    topUpdatedPlatforms[i].unshift(value);          
                } 
                localBotRef.current = botUpdatedPlatforms
                localTopRef.current = topUpdatedPlatforms
                console.log('moved to top', hdirection)
                break;
            }
        }
    }    // Update state with the new platformsw
    if (currentLocalDirections) {
        const directionEntry = Object.entries(currentLocalDirections).find(([key, value]) => value[0] === playerId);
        
        if (directionEntry && directionEntry[1].length > 1) {
            const currentHDirection = directionEntry[1][2]; // Get the current direction
            
            // Toggle direction
            const newHDirection = currentHDirection === 'B' ? 'T' : 'B';
            
            // Update the direction in localDirectionsRef
            directionEntry[1][2] = newHDirection; // Set the new direction

            console.log(`Player ${playerId} direction turned from ${currentHDirection} to ${newHDirection}`);
        }
    }
}, []);

const knockbackPlayer = useCallback((playerId, vdirection, hdirection) => {
    let currentBotLocalSpawns = localBotRef.current;
    let currentTopLocalSpawns = localTopRef.current;
    const botUpdatedPlatforms = currentBotLocalSpawns.map(platform => [...platform]); // Shallow copy of each platform
    const topUpdatedPlatforms = currentTopLocalSpawns.map(platform => [...platform]); // Shallow copy of each platform


    setTimeout(() => {
        
    if(hdirection === 'T'){
        for (let i = 0; i < topUpdatedPlatforms.length; i++) {
            if (topUpdatedPlatforms[i].includes(playerId)) {
                const index = topUpdatedPlatforms[i].indexOf(playerId);
                const value = topUpdatedPlatforms[i].splice(index, 1)[0]; // Remove playerId
                if (vdirection === 'L' && i > 0) {
                    moveElement(playerId, i - 1, vdirection, hdirection, 'Back');
                    topUpdatedPlatforms[i - 1].push(value); // Move left
                    console.log(`${playerId} was shot L (${i} to ${i - 1})`);
                } else if (vdirection === 'R' && i < topUpdatedPlatforms.length - 1) {
                    moveElement(playerId, i + 1, vdirection, hdirection, 'Back');
                    topUpdatedPlatforms[i + 1].unshift(value); // Move right
                    console.log(`${playerId} was shot R (${i} to ${i + 1})`);
                }
                else{
                    moveElement(playerId, i, vdirection, hdirection, 'FellBack');
                    flipStatus(playerId);
                    console.log(playerId, ' fell off the platforms');
                }
                localTopRef.current = topUpdatedPlatforms
                localBotRef.current = botUpdatedPlatforms
                break;
            }
        } // Update state with the new platformsw
    }
    else if(hdirection === 'B'){
        for (let i = 0; i < botUpdatedPlatforms.length; i++) {
            if (botUpdatedPlatforms[i].includes(playerId)) {
                const index = botUpdatedPlatforms[i].indexOf(playerId);
                const value = botUpdatedPlatforms[i].splice(index, 1)[0]; // Remove playerId
                if (vdirection === 'L' && i > 0) {
                    moveElement(playerId, i - 1, vdirection, hdirection, 'Back');
                    botUpdatedPlatforms[i - 1].push(value); // Move left
                    console.log(`${playerId} was shot L (${i} to ${i - 1})`);
                } else if (vdirection === 'R' && i < botUpdatedPlatforms.length - 1) {
                    moveElement(playerId, i + 1, vdirection, hdirection, 'Back');
                    botUpdatedPlatforms[i + 1].unshift(value); // Move right
                    console.log(`${playerId} was shot R (${i} to ${i + 1})`);
                }
                else{
                    moveElement(playerId, i, vdirection, hdirection, 'FellBack');
                    flipStatus(playerId);
                    console.log(playerId, ' fell off the platforms');
                }
                localBotRef.current = topUpdatedPlatforms
                localBotRef.current = botUpdatedPlatforms
                break;
            }
        } // Update state with the new platformsw
    }
}, 950);
}, []);

    
    function findNearestPlayer(playerID, hdirection) {
        let currentTopLocalSpawns = localTopRef.current;
        let currentBotLocalSpawns = localBotRef.current;
        const currentLocalDirections = localDirectionsRef.current;
    
        const directionEntry = Object.entries(currentLocalDirections).find(([key, value]) => value[0] === playerID);
        const Direction = directionEntry ? directionEntry[1][1] : null; // Get the direction if available
    
        const element = document.getElementById(playerID);
    

    
        let flattened = currentBotLocalSpawns.flat();
        if(hdirection === 'T'){
            flattened = currentTopLocalSpawns.flat();
        }
    
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
        localBotRef.current = currentBotLocalSpawns;
        localTopRef.current = currentTopLocalSpawns;
        if (nearestTarget) {
            if (element) {
                knockbackPlayer(nearestTarget, Direction, hdirection);  
                element.src = CharShoot; // Ensure CharShoot is defined

            }
        } else {
            console.log('NO NEAREST TARGET FOUND');
            element.src = CharShoot;
        }
        setTimeout(() => {
            element.src = CharIdle;
        }, 1100);

    }
    

    
    useEffect(() => {    
        localBotRef.current = localSpawns;
    }, [localSpawns]);
    
    useEffect(() => {    
        localDirectionsRef.current = localDirections;
        console.log(localDirectionsRef.current)
    }, [localDirections]);


    const style = {

};
    return (
    <div className='flex flex-col place-items-end justify-center items-stretch top-0'>
    <div className='flex flex-row place-items-end justify-center items-stretch top-0'
    style={{width: '100vw'}}>
        {/* Creating multiple divs */}
        {localSpawns.map((spawn, index) => {   
            let rndtrain;
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
                        <div key={index} id={'tp'+index} className={`grow flex place-items-end justify-center platforms `}
                        style={{ 
                        backgroundSize: 'contain',
                        backgroundPosition: 'center bottom',
                        imageRendering: 'pixelated',
                        ...style
                        }}>
                        </div>
                    );
                }
            } else {         
                return (
                    <div key={index} id={'tp'+index} className={`grow flex place-items-end justify-center unselectable platforms`}
                    style={{ 
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
                        <div key={index} id={'bp'+index} className={`grow flex place-items-end justify-center unselectable platforms `}
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
                                    filter: PlayerID===1 ? `hue-rotate(0deg)` : `hue-rotate(${PlayerID*60}deg)`,
                                }} 
                                className={`place-self-end character`}
                                //className={`place-self-end ${isMoving ? 'moving' : ''}`}
                            />
                        </div>
                    );
                }
            } else {         
                return (
                    <div key={index} id={'bp'+index} className={`grow flex place-items-end justify-center unselectable platforms`}
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
        {/*<div className='flex flex-row place-items-end justify-center items-stretch top-0'>
        {localSpawns.map((spawn, index) => {
                    let rndplatform;
                    const platformIndex = index % 3 + 1; 
                    switch (platformIndex) {
                        case 2:
                            rndplatform = platform1;
                            break;
                        case 3:
                            rndplatform = platform2;
                            break;
                        case 1:
                            rndplatform = platform3;
                            break;
                        default:
                            rndplatform = platform1;
                            break
                    }
            return(
                <div key={index} id={'p'+index} className={`grow flex place-items-end justify-center character platforms`}
                        style={{backgroundImage: `url(${rndplatform})`, 
                        backgroundSize: 'contain',
                        backgroundPosition: 'center bottom',
                        imageRendering: 'pixelated',
                        ...style
                        }}>
                        </div>
            )
        })}
        </div>*/}
    </div>
    ); // No UI needed for this component
}

export default GameLogic;
