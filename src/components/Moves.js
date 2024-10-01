// Moves.js
import React, { useEffect, useRef, useState } from 'react';
import Muuri from 'muuri';
import './style.css'; // Ensure this file is correctly linked
import socket from '../socketService'; // Import the socket instance

const Moves = ({ onLockIn }) => {
  const dragContainerRef = useRef(null);
  const columnGrids = useRef([]);
  const availableMovesGrid = useRef(null);
  const nextMovesGrid = useRef(null);
  const availableMoves = useRef(['Forward', 'Forward', 'Attack', 'Turn', 'Climb']);
  const nextMoves = useRef([]);
  const MAX_NEXT_MOVES = 3;
  const isMaxRef = useRef(false);
  const currentNextMoves = useRef(MAX_NEXT_MOVES); 
  const [, forceUpdate] = useState();



  useEffect(() => {
    const itemContainers = Array.from(document.querySelectorAll('.board-column-content'));
    let boardGrid;

    itemContainers.forEach((container, index) => {
      const grid = new Muuri(container, {
        items: '.board-item',
        dragEnabled: index === 0 ? !isMaxRef.current : true,
        dragSort: () => columnGrids.current,
        dragContainer: dragContainerRef.current,
        dragAutoScroll: {
          targets: (item) => [
            { element: window, priority: 0 },
            { element: item.getGrid().getElement().parentNode, priority: 1 },
          ],
        },
      })
      .on('dragInit', (item) => {
        item.getElement().style.width = item.getWidth() + 'px';
        item.getElement().style.height = item.getHeight() + 'px';
      })
      .on('dragReleaseEnd', (item) => { 
        const nextColumn = document.querySelector('.next-moves .board-column-content');
        const currentNextItems = nextColumn.children.length;
        const maxReached = currentNextItems >= MAX_NEXT_MOVES;

        if (!maxReached) {
          item.getGrid().refreshItems([item]);
          item.getElement().style.width = '';
          item.getElement().style.height = '';
        } else {
          const originalContainer = item.getGrid().getElement();
          item.getGrid().move(item, originalContainer);
        }

        isMaxRef.current = maxReached;
        currentNextMoves.current = MAX_NEXT_MOVES - currentNextItems;
        forceUpdate((s) => !s);
      });

      if (index === 0) {
        availableMovesGrid.current = grid;
      } else {
        nextMovesGrid.current = grid;
      }
      columnGrids.current.push(grid);
    });

    boardGrid = new Muuri('.board', {
      dragEnabled: false,
    });

    return () => {
      columnGrids.current.forEach(grid => grid.destroy());
      boardGrid.destroy();
    };
  }, []);

  const handleLockIn = () => {
    const nextColumnItems = nextMovesGrid.current.getItems().map(item => item.getElement().innerText);
    nextMoves.current = nextColumnItems.slice(0, MAX_NEXT_MOVES);
    onLockIn(nextMoves.current);
  
    // Emit the moves to the server
    socket.emit('lockInMoves', nextMoves.current);
  };

  return (
    <div className="flex flex-col w-48 mt-3"> {/* Changed from w-96 to w-48 */}
      <div className='flex flex-row'>
        <div ref={dragContainerRef} className="drag-container"></div>
        <div className="board flex-1">
          <div className={`board-column available-moves ${isMaxRef.current ? 'pointer-events-none opacity-50' : ''}`}>
            <div className="board-column-container">
              <div className="board-column-header bg-green-500">Moves</div>
              <div className="board-column-content-wrapper">
                <div className="board-column-content">
                  {availableMoves.current.map((move, i) => (
                    <div key={i} className="board-item text-center">
                      <div className="board-item-content">
                        <span>{move}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="board flex-1">
          <div className="board-column next-moves">
            <div className="board-column-container">
              <div className={`board-column-header ${isMaxRef.current ? 'bg-red-600' : 'bg-yellow-400'}`}>Next ({currentNextMoves.current})</div>
              <div className="board-column-content-wrapper">
                <div className="board-column-content"></div>
              </div>
            </div>
          </div>
        </div>
        <div ref={dragContainerRef} className="drag-container"></div>
      </div>
  
      <div className="flex flex-col p-2 justify-center items-center"> {/* Reduced padding */}
        <button 
          className={`m-4 mt-0 font-bold rounded-2xl p-1 ${isMaxRef.current ? '' : 'pointer-events-none opacity-50'}`} // Adjusted padding
          style={{ backgroundColor: 'rgb(42 18 149)', color: 'white', width: '100px' }} // Adjusted width
          onClick={handleLockIn}
        >
          Lock In
        </button>
      </div>
    </div>
  );
  
};

export default Moves;
