import React, { useEffect, useState, useRef, useCallback } from 'react';
import socket from '../socketService';
import { playSound } from '../sound';
import { SKINS, skinFor } from '../skins';
import Train from '../assets/train.png'
import Train2 from '../assets/train2.png'
import Train3 from '../assets/train3.png'
import GunshotHitSfx from '../assets/gunshot_hit-1.wav'
import GunshotMissSfx from '../assets/gunshot_miss-1.wav'
import WalkingSfx from '../assets/walking.wav'
import ClimbSfx from '../assets/climb.wav'
import FailedStandoffSfx from '../assets/failed-standoff.wav'
import TurnSfx from '../assets/turn.wav'
import RecoverSfx from '../assets/recover.wav'

const PLATFORM_IMAGES = [Train, Train2, Train3];

const ROW_CLASS = 'flex flex-row place-items-end justify-center items-stretch top-0';
const PLATFORM_CLASS = 'grow flex place-items-end justify-center unselectable platforms';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Deep-copy a rows structure (array of platforms, each an array of player ids)
const copyRows = (rows) => rows.map((p) => (Array.isArray(p) ? [...p] : p));

// Extract scaleX from a computed transform string (matrix form), defaulting to 1
const getScaleX = (transform) => {
    if (transform && transform.startsWith('matrix')) {
        return Number(transform.match(/matrix\(([^)]+)\)/)[1].split(', ')[0]);
    }
    return 1;
};

// A player's cowboy skin: the server assigns it at join and carries it in
// the directions entry (slot 4); fall back to the numeric-id mapping
const skinFromEntry = (entry, numericId) => {
    if (entry && typeof entry[4] === 'number') {
        return SKINS[((entry[4] % SKINS.length) + SKINS.length) % SKINS.length];
    }
    return skinFor(numericId);
};

function GameLogic() {
    const [localSpawns, setLocalSpawns] = useState([]);
    const [localTopSpawns, setLocalTopSpawns] = useState([]); // top-row occupancy, for rendering restored games
    const [localDirections, setLocalDirections] = useState([]);
    const localBotRef = useRef(localSpawns);
    const localTopRef = useRef([])
    const localDirectionsRef = useRef(localDirections);
    // Deaths registered the moment they happen (flipStatus only flips the
    // directions map after a 2s animation delay)
    const deadNumericRef = useRef(new Set());
    // Players who are knocked down: can't be shot, and their next move is
    // spent standing back up (unless it's a Standoff)
    const downedRef = useRef(new Set());

    // The directions entry (value array) for a numeric in-game player ID
    const entryOf = (numericId) =>
        Object.values(localDirectionsRef.current || {}).find((value) => Array.isArray(value) && value[0] === numericId) || null;

    // Resolve a numeric in-game player ID to its socket id via the directions map
    const socketIdOf = (numericId) => {
        const entry = Object.entries(localDirectionsRef.current || {}).find(([key, value]) => value[0] === numericId);
        return entry ? entry[0] : null;
    };

    const skinOf = (numericId) => skinFromEntry(entryOf(numericId), numericId);

    // Broadcast an in-game event locally so UI components (e.g. the events feed) can react
    const dispatchGameEvent = (detail) => {
        window.dispatchEvent(new CustomEvent('gameEvent', { detail }));
    };

    // Tell the UI whether a round is playing out and whose move is being applied
    const setRoundState = (running, turn) => {
        window.dispatchEvent(new CustomEvent('roundState', { detail: { running, turn } }));
    };

    useEffect(() => {
        // IMPORTANT: the refs the game simulation works on must be COPIES of
        // the React state. The simulation mutates them as players act, and if
        // state shared the same objects the rendered tree would change
        // mid-game — React would then fight moveElement's manual DOM moves
        // (removeChild crashes). State stays a frozen snapshot of game start
        // (or the restored state) while the animation owns the board.
        const handleSetSpawns = (GlobalSpawns) => {
            setLocalSpawns(GlobalSpawns);
            localBotRef.current = copyRows(GlobalSpawns);
            // Size the (empty) top row to match so climbing never indexes an
            // undefined platform — covers both game start and refresh/rejoin
            if (localTopRef.current.length !== GlobalSpawns.length) {
                localTopRef.current = GlobalSpawns.map(() => []);
                setLocalTopSpawns(GlobalSpawns.map(() => []));
            }
        };

        // Top-row occupancy from the server (rejoins mid-game get the real
        // current layout, not just empty roofs)
        const handleSetTopSpawns = (TopSpawns) => {
            if (Array.isArray(TopSpawns)) {
                localTopRef.current = copyRows(TopSpawns);
                setLocalTopSpawns(TopSpawns);
            }
        };

        // A player left mid-game (quit, kicked, or grace period expired):
        // strike their cowboy from the board like a death, with a fade-out
        const handlePlayerLeftGame = ({ numericId } = {}) => {
            if (typeof numericId !== 'number') return;
            const strip = (rows) => rows.map((p) => (Array.isArray(p) ? p.filter((id) => id !== numericId) : p));
            localBotRef.current = strip(localBotRef.current);
            localTopRef.current = strip(localTopRef.current);
            deadNumericRef.current.add(numericId);
            downedRef.current.delete(numericId);
            const entry = entryOf(numericId);
            if (entry) entry[3] = 'D';
            const element = document.getElementById(String(numericId));
            if (element) {
                element.style.transition = 'all 0.8s ease';
                element.style.opacity = '0';
                setTimeout(() => element.remove(), 800);
            }
        };

        socket.on('setPlayerDirections', setLocalDirections);
        socket.on('setSpawns', handleSetSpawns);
        socket.on('setTopSpawns', handleSetTopSpawns);
        socket.on('playerLeftGame', handlePlayerLeftGame);

        return () => {
            socket.off('setPlayerDirections', setLocalDirections);
            socket.off('setSpawns', handleSetSpawns);
            socket.off('setTopSpawns', handleSetTopSpawns);
            socket.off('playerLeftGame', handlePlayerLeftGame);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const handleStartRound = async (players) => {
            const maxMoves = Math.max(...Object.values(players).map(moves => moves.length));

            setRoundState(true, null);
            try {
                for (let moveIndex = 0; moveIndex < maxMoves; moveIndex++) {
                    for (const xPlayerId of Object.keys(players)) {
                        // Once only one player is left standing the game is
                        // decided; stop applying the remaining moves
                        const totalPlayers = Object.keys(localDirectionsRef.current || {}).length;
                        if (totalPlayers > 1 && totalPlayers - deadNumericRef.current.size <= 1) {
                            return;
                        }

                        const xPlayerMoves = players[xPlayerId];
                        // This session's character is the numeric id the
                        // directions map assigned to it — NOT its position
                        // in the moves list, which only matches when the
                        // random spawn layout happens to be the identity.
                        // Using the index made moves drive someone else's
                        // cowboy (and mis-check dead/downed status)
                        const sessionProps = (localDirectionsRef.current || {})[xPlayerId];

                        if (sessionProps && moveIndex < xPlayerMoves.length) {
                            const move = xPlayerMoves[moveIndex];
                            setRoundState(true, xPlayerId);
                            applyMove(sessionProps[0], move);
                        }

                        // Delay between moves; dead players' turns are skipped instantly
                        const status = sessionProps ? sessionProps[3] : 'D';
                        if (status !== 'D') {
                            await delay(2500);
                        }
                    }
                }
            } finally {
                // Round is over (or aborted by a win): unlock the UI
                setRoundState(false, null);
                // Persist the round's outcome so a refresh/rejoin restores
                // current positions instead of the initial spawn layout.
                // Every client sends the same simulated result, so last
                // write wins harmlessly.
                socket.emit('syncGameState', {
                    bot: localBotRef.current,
                    top: localTopRef.current,
                    props: localDirectionsRef.current,
                });
            }
        };

        socket.on('StartRound', handleStartRound);

        return () => {
            socket.off('StartRound', handleStartRound);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const applyMove = useCallback((player, move) => {
        const entry = entryOf(player);
        if (!entry || entry.length <= 1) return;

        const VDirection = entry[1]; // L/R facing
        const HDirection = entry[2]; // (T)op or (B)ottom row
        const Status = entry[3]; // (D)ead or (A)live

        if (Status === 'D' || deadNumericRef.current.has(player)) {
            return;
        }

        if (downedRef.current.has(player)) {
            // Downed: the move is spent getting back up...
            downedRef.current.delete(player);
            if (move === 'Standoff') {
                // ...unless it's a Standoff: spring up and retaliate
                dispatchGameEvent({ type: 'standoffUp', actor: socketIdOf(player) });
                findNearestPlayer(player, HDirection);
            } else {
                const element = document.getElementById(player);
                if (element) element.src = skinOf(player).idle;
                playSound(RecoverSfx, 0.6);
                dispatchGameEvent({ type: 'recovered', target: socketIdOf(player), move });
            }
            return;
        }

        switch (move) {
            case 'Forward':
                dispatchGameEvent({ type: 'moved', target: socketIdOf(player) });
                playSound(WalkingSfx, 0.3);
                movePlayer(player, HDirection, VDirection);
                break;
            case 'Shoot':
            case 'Attack': // old name, kept so in-flight moves from stale clients still resolve
                findNearestPlayer(player, HDirection);
                break;
            case 'Turn':
                dispatchGameEvent({ type: 'turned', target: socketIdOf(player) });
                playSound(TurnSfx, 0.6);
                turnPlayer(player)
                break;
            case 'Climb':
                dispatchGameEvent({ type: 'climbed', target: socketIdOf(player) });
                playSound(ClimbSfx, 0.6);
                climbPlayer(player, HDirection, VDirection);
                break;
            case 'Standoff': {
                // Not downed: drop down defensively, primed for a standoff
                downedRef.current.add(player);
                const element = document.getElementById(player);
                if (element) element.src = skinOf(player).wounded;
                playSound(FailedStandoffSfx, 0.7);
                dispatchGameEvent({ type: 'wentDown', target: socketIdOf(player) });
                break;
            }
            default:
                console.log('Unknown move:', move);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const moveElement = useCallback((playerID, newPlatform, vdirection, hdirection, type) => {
        const element = document.getElementById(playerID);
        const isFall = type === 'FellForward' || type === 'FellBack';

        // Climbing crosses rows, everything else stays on the current row
        const onTop = type === 'Climb' ? hdirection === 'B' : hdirection === 'T';
        const targetDiv = document.getElementById((onTop ? 'tp' : 'bp') + newPlatform);

        if (!element || !targetDiv) {
            console.log('Element or targetDiv not found');
            return;
        }
        const currentDiv = element.parentElement
        const indexOfElement = Array.from(currentDiv.children).findIndex(child => child.id === String(playerID));
        // Calculate the current position and the target position
        const rect = element.getBoundingClientRect();
        const targetRect = targetDiv.getBoundingClientRect();

        const minusWidth = (vdirection === 'L' ? 1 : -1) * rect.width / 2;

        // When the mover re-parents onto its new platform the flex layout
        // reflows the bystanders into their final slots; the pre-shift
        // translateX must be released on that same tick or the bystander
        // snaps. Climbs re-parent sooner than walks, so settle on its clock.
        const reparentMs = type === 'Climb' ? 900 : 1500;

        // Animate a bystander sliding over to fill / make room: walk briefly,
        // then settle back to idle with only its facing (scaleX) kept. A
        // downed bystander keeps its wounded sprite — it just slides aside.
        const shiftChild = (child, makeTransform) => {
            const id = Number(child.id);
            const downed = downedRef.current.has(id);
            const baseTransform = window.getComputedStyle(child).transform;
            const scaleX = getScaleX(baseTransform);
            setTimeout(() => {
                const transform = makeTransform(baseTransform, scaleX);
                if (transform) child.style.transform = transform;
                child.style.transition = 'all 0.2s linear';
                if (!downed) child.src = skinOf(id).walk;
            }, 200);
            setTimeout(() => {
                if (!downed) child.src = skinOf(id).idle;
            }, 400);
            setTimeout(() => {
                child.style.transform = `scaleX(${scaleX})`;
                child.style.transition = '';
            }, reparentMs);
        };

        // Close the gap the mover leaves behind on its current platform
        currentDiv.querySelectorAll('img').forEach((child, childIndex) => {
            if (childIndex === indexOfElement) return;
            const shiftDirection = childIndex > indexOfElement ? -1 : 1;
            shiftChild(child, (base) =>
                isFall ? null : `translateX(${Math.abs(minusWidth) * shiftDirection}px) ${base}`
            );
        });

        // Make room on the target platform
        targetDiv.querySelectorAll('img').forEach((child) => {
            if (child === element) return;
            shiftChild(child, (base, scaleX) =>
                `${base} translateX(${(scaleX < 0 ? 1 : -1) * minusWidth}px)`
            );
        });

        // Calculate translate values
        const translateX = (targetRect.left + targetRect.width / 2) - (rect.left + rect.width / 2);
        const translateY = targetRect.bottom - rect.bottom; // Keep vertical position unchanged

        // Get the current transform for the player element
        const currentScale = element.style.transform;

        element.style.transition =
            (type === 'Forward') || (type === 'FellForward') ? 'all 1.5s linear'
            : type === 'Climb' ? 'all 1.4s ease' // a touch slower so the climb reads
            : 'all 1s ease';
        // Falls fly out in the direction of the movement/push (vdirection):
        // for FellForward that's the walker's own heading, for FellBack the
        // shooter's bullet direction — NOT the victim's facing, which points
        // the wrong way when shot from behind
        const fallSign = vdirection === 'L' ? -1 : 1;
        // Set the new transform, keeping the scaleX intact
        if (isFall) {
            element.style.transform = `translate(${500 * fallSign}px, ${translateY}px) ${currentScale}`;
        } else if (targetDiv.childNodes.length > 0) {
            element.style.transform = `translate(${translateX + (minusWidth * targetDiv.childNodes.length)}px, ${translateY}px) ${currentScale}`;
        } else {
            element.style.transform = `translate(${translateX}px, ${translateY}px) ${currentScale}`;
        }

        if (type === 'Forward' || type === 'FellForward') {
            element.src = skinOf(playerID).walk;
        } else if (type === 'Climb') {
            element.src = skinOf(playerID).climb;
        } else if (type === 'Back' || type === 'FellBack') {
            element.src = skinOf(playerID).wounded;
        }

        if (isFall) {
            setTimeout(() => {
                element.remove()
            }, 1500); // Match the duration with CSS transition
        } else {
            // After the move animation, re-parent the element onto its new platform
            setTimeout(() => {
                vdirection === 'R' ? targetDiv.insertBefore(element, targetDiv.firstChild) : targetDiv.appendChild(element);

                element.style.transform = currentScale; // Keep the scale transformation
                element.style.transition = ''; // Reset the transition
                if (type !== 'Back') { // shot survivors stay wounded until they recover
                    element.src = skinOf(playerID).idle;
                }
            }, reparentMs); // Same clock the bystanders settle on
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const turnPlayer = useCallback((playerID) => {
        const entry = entryOf(playerID);
        if (entry && entry.length > 1) {
            entry[1] = entry[1] === 'L' ? 'R' : 'L';
        }

        const element = document.getElementById(playerID);
        if (!element) {
            console.log('Element not found');
            return;
        }

        // Flip the element visually
        const scale = element.style.transform;
        element.style.transition = 'all 0.05s linear';
        element.style.transform = scale === 'scaleX(-1)' ? 'scaleX(1)' : 'scaleX(-1)';

        // Reset the transition after the flip
        setTimeout(() => {
            element.style.transition = '';
        }, 1000);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const movePlayer = useCallback((playerId, hdirection, vdirection) => {
        const rowRef = hdirection === 'T' ? localTopRef : localBotRef;
        const updatedPlatforms = copyRows(rowRef.current);

        for (let i = 0; i < updatedPlatforms.length; i++) {
            if (!updatedPlatforms[i].includes(playerId)) continue;

            const index = updatedPlatforms[i].indexOf(playerId);
            const value = updatedPlatforms[i].splice(index, 1)[0];
            if (vdirection === 'L' && i > 0) {
                moveElement(playerId, i - 1, vdirection, hdirection, 'Forward');
                updatedPlatforms[i - 1].push(value);
            } else if (vdirection === 'R' && i < updatedPlatforms.length - 1) {
                moveElement(playerId, i + 1, vdirection, hdirection, 'Forward');
                updatedPlatforms[i + 1].unshift(value);
            } else {
                // Walked off the edge of the train
                moveElement(playerId, i, vdirection, hdirection, 'FellForward');
                flipStatus(playerId);
                deadNumericRef.current.add(playerId);
                dispatchGameEvent({ type: 'fellOff', target: socketIdOf(playerId), died: true });
            }
            rowRef.current = updatedPlatforms;
            break;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const flipStatus = useCallback((playerId) => {
        const entry = entryOf(playerId);
        if (entry && entry.length > 1) {
            setTimeout(() => {
                entry[3] = entry[3] === 'D' ? 'A' : 'D';
            }, 2000); // wait out the death animation
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const climbPlayer = useCallback((playerId, hdirection, vdirection) => {
        const fromRef = hdirection === 'T' ? localTopRef : localBotRef;
        const toRef = hdirection === 'T' ? localBotRef : localTopRef;
        const fromPlatforms = copyRows(fromRef.current);
        const toPlatforms = copyRows(toRef.current);

        for (let i = 0; i < fromPlatforms.length; i++) {
            if (!fromPlatforms[i].includes(playerId)) continue;

            const index = fromPlatforms[i].indexOf(playerId);
            const value = fromPlatforms[i].splice(index, 1)[0];
            moveElement(playerId, i, vdirection, hdirection, 'Climb');
            if (vdirection === 'L') {
                toPlatforms[i].push(value);
            } else {
                toPlatforms[i].unshift(value);
            }
            fromRef.current = fromPlatforms;
            toRef.current = toPlatforms;
            break;
        }

        // Flip the player's row (T/B) in the directions map
        const entry = entryOf(playerId);
        if (entry && entry.length > 1) {
            entry[2] = entry[2] === 'B' ? 'T' : 'B';
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const knockbackPlayer = useCallback((playerId, vdirection, hdirection, shooterId) => {
        // Delayed so the knockback lands with the shooter's draw animation
        setTimeout(() => {
            const rowRef = hdirection === 'T' ? localTopRef : localBotRef;
            const updatedPlatforms = copyRows(rowRef.current);

            for (let i = 0; i < updatedPlatforms.length; i++) {
                if (!updatedPlatforms[i].includes(playerId)) continue;

                const index = updatedPlatforms[i].indexOf(playerId);
                const value = updatedPlatforms[i].splice(index, 1)[0];
                if (vdirection === 'L' && i > 0) {
                    moveElement(playerId, i - 1, vdirection, hdirection, 'Back');
                    downedRef.current.add(playerId); // survived the shot, but downed
                    updatedPlatforms[i - 1].push(value);
                } else if (vdirection === 'R' && i < updatedPlatforms.length - 1) {
                    moveElement(playerId, i + 1, vdirection, hdirection, 'Back');
                    downedRef.current.add(playerId); // survived the shot, but downed
                    updatedPlatforms[i + 1].unshift(value);
                } else {
                    // Knocked off the edge of the train
                    moveElement(playerId, i, vdirection, hdirection, 'FellBack');
                    flipStatus(playerId);
                    deadNumericRef.current.add(playerId);
                    dispatchGameEvent({ type: 'knockedOff', actor: socketIdOf(shooterId), target: socketIdOf(playerId), died: true });
                }
                rowRef.current = updatedPlatforms;
                break;
            }
        }, 950);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function findNearestPlayer(playerID, hdirection) {
        const entry = entryOf(playerID);
        const Direction = entry ? entry[1] : null; // facing, if available

        const element = document.getElementById(playerID);

        const rows = hdirection === 'T' ? localTopRef.current : localBotRef.current;
        const flattened = rows.flat();

        if (!flattened.includes(playerID)) {
            console.log('INVALID PLAYER ID');
            return;
        }

        const targetIndex = flattened.indexOf(playerID);
        let nearestTarget = null;
        let nearestDistance = Infinity;

        for (let i = 0; i < flattened.length; i++) {
            if (flattened[i] !== playerID) {
                // Downed (or dying) players can't be hit; the shot passes
                // over them to the next player in range
                if (downedRef.current.has(flattened[i]) || deadNumericRef.current.has(flattened[i])) {
                    continue;
                }
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

        if (nearestTarget) {
            if (element) {
                dispatchGameEvent({ type: 'shot', actor: socketIdOf(playerID), target: socketIdOf(nearestTarget) });
                knockbackPlayer(nearestTarget, Direction, hdirection, playerID);
                element.src = skinOf(playerID).draw;
                // Delayed so the bang lands with the draw animation's shot
                // (knockback hits at ~950ms)
                playSound(GunshotHitSfx, 0.8, 280);
            }
        } else {
            dispatchGameEvent({ type: 'missed', actor: socketIdOf(playerID) });
            if (element) element.src = skinOf(playerID).draw;
            playSound(GunshotMissSfx, 0.8, 280);
        }
        setTimeout(() => {
            if (element) element.src = skinOf(playerID).idle;
        }, 1100);
    }

    // Refs get COPIES of the state (see handleSetSpawns): the simulation
    // mutates the refs in place, and sharing objects with state would make
    // the rendered tree shift under React mid-game
    useEffect(() => {
        localBotRef.current = copyRows(localSpawns);
    }, [localSpawns]);

    useEffect(() => {
        localDirectionsRef.current = Object.fromEntries(
            Object.entries(localDirections || {}).map(([key, value]) => [key, Array.isArray(value) ? [...value] : value])
        );
    }, [localDirections]);

    // Draw a character on its current platform. Facing and alive/dead status
    // come from the directions entry matching the numeric id, so restored
    // games render players where (and how) they actually are
    const renderCharacter = (pid) => {
        // Skin comes from this state entry directly — skinOf reads the ref,
        // which isn't synced yet during the game-start render
        const entry = Object.values(localDirections || {}).find((value) => Array.isArray(value) && value[0] === pid);
        if (!entry || entry[3] === 'D') return null;
        const FacingLeft = entry[1] === 'L';
        return (
            <img
                key={pid}
                id={pid}
                src={skinFromEntry(entry, pid).idle}
                alt="Character"
                crossOrigin="anonymous"
                style={{
                    width: '20%',
                    objectFit: 'contain',
                    imageRendering: 'pixelated',
                    transform: FacingLeft ? 'scaleX(-1)' : 'scaleX(1)',
                }}
                className={`place-self-end character`}
            />
        );
    };

    // One row of platforms; the bottom row gets the train artwork, the top
    // row (the roofs) is only occupied via Climb or a restored game
    const renderPlatformRow = (idPrefix, occupantsAt, withImage) => (
        <div className={ROW_CLASS} style={{ width: '100vw' }}>
            {localSpawns.map((spawn, index) => (
                <div key={index} id={idPrefix + index} className={PLATFORM_CLASS}
                    style={{
                        ...(withImage ? { backgroundImage: `url(${PLATFORM_IMAGES[index % PLATFORM_IMAGES.length]})` } : {}),
                        backgroundSize: 'contain',
                        backgroundPosition: 'center bottom',
                        imageRendering: 'pixelated',
                    }}>
                    {(occupantsAt(index) || []).map(renderCharacter)}
                </div>
            ))}
        </div>
    );

    return (
        <div className={`flex flex-col place-items-end justify-center items-stretch top-0 border-b-8 border-stone-800 ${localSpawns.length > 0 ? '' : 'hidden'}`}>
            {renderPlatformRow('tp', (index) => localTopSpawns[index], false)}
            {renderPlatformRow('bp', (index) => (Array.isArray(localSpawns[index]) ? localSpawns[index] : []), true)}
        </div>
    );
}

export default GameLogic;
