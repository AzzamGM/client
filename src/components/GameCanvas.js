// GameCanvas.js
import React, { useEffect, useRef } from 'react';

const GameCanvas = ({ localSpawns, localDirections }) => {
    const canvasRef = useRef(null);
    
    // Adjust canvas size to match existing board dimensions
    const canvasWidth = 300 * localSpawns.length; // Adjust based on number of platforms
    const canvasHeight = 300; // Match height of the platform

    useEffect(() => {
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        const draw = () => {
            context.clearRect(0, 0, canvas.width, canvas.height);

            localSpawns.forEach((spawn, index) => {
                // Draw platforms
                context.fillStyle = index % 2 === 0 ? '#B0C4DE' : '#4682B4';
                context.fillRect(index * 300, 200, 300, 20); // Adjust for platform size

                // Draw players
                if (spawn > 0) {
                    const direction = localDirections[index];
                    const x = index * 300 + 10; // Player position on platform
                    const y = 180; // Player position above the platform
                    const imgSrc = direction ? (direction[1] === 'L' ? '/path/to/walk_left.png' : '/path/to/walk_right.png') : '/path/to/idle.png';
                    const img = new Image();
                    img.src = imgSrc;
                    img.onload = () => {
                        context.drawImage(img, x, y, 40, 40); // Player size
                    };
                }
            });
        };

        const gameLoop = () => {
            draw();
            requestAnimationFrame(gameLoop);
        };

        gameLoop();

        return () => {
            // Cleanup if necessary
        };
    }, [localSpawns, localDirections]);

    return (
        <canvas
            ref={canvasRef}
            width={canvasWidth}
            height={canvasHeight}
            style={{ border: '1px solid black' }}
        />
    );
};

export default GameCanvas;
