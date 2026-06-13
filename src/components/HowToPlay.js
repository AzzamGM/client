// Shared "How to Play" modal: game rules + what every move does.
// Used from the main menu, the pre-game lobby, and the in-game "?" button.
import React, { useState } from 'react';
import './style.css';

export function HowToPlayModal({ onClose }) {
  return (
    <div className='help-overlay' onClick={onClose}>
      <div className='help-modal' onClick={(e) => e.stopPropagation()}>
        <div className='board-column-header flex flex-row items-center' style={{ backgroundColor: 'var(--success)', padding: '0' }}>
          <span className='flex-1 text-center' style={{ paddingLeft: '30px' }}>How to Play</span>
          <button
            onClick={onClose}
            className='font-bold'
            style={{ width: '30px', height: '30px', color: 'var(--text-light)' }}
            aria-label='Close'>
            ✕
          </button>
        </div>
        <div className='help-modal-body'>
          <div className='help-section-title'>The game</div>
          <div><strong>Goal:</strong> be the last gunslinger standing by pushing everyone else off the train.</div>
          <div>Every round, drag <strong>3 moves</strong> into the <strong>Next</strong> column and hit <strong>Lock In</strong>.</div>
          <div>When shooting someone on your level, they become <strong>downed</strong> and are knocked back a car (or clean off the train).</div>
          <div>While <strong>downed</strong> bullets go over their heads — but their next move is skipped (to recover). </div>
          <div>When everyone locks in, all moves play out one at a time in turn order.</div>
          <div>Fall off the train — shot off or walking off an edge — and you're out. The last one standing wins.</div>
          <div className='help-section-title'>The moves</div>
          <div><strong>Forward</strong> — walk one car in the direction you're facing. Walking past the last car means falling off the train!</div>
          <div><strong>Attack</strong> — shoot the nearest player you're facing on your level. They're knocked back a car — or clean off the train if there's nothing behind them. Downed players can't be hit.</div>
          <div><strong>Standoff (while downed)</strong> — recover AND perform a quick <strong>shot</strong>.</div>
          <div><strong>Standoff (while NOT downed)</strong> — a failed standoff <strong>downs</strong> you.</div>
          <div><strong>Turn</strong> — turn around to face the other direction.</div>
          <div><strong>Climb</strong> — climbs upwards/downwards changing levels.</div>
        </div>
      </div>
    </div>
  );
}

// Drop-in button that opens the modal; styled like the other menu buttons.
// `compact` matches the in-game Lock In button's footprint
export default function HowToPlayButton({ compact = false }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`m-2 mt-0 font-bold rounded-2xl ${compact ? 'p-1' : 'p-2'} btn-3d btn-3d-orange`}
        style={{
          backgroundColor: '#d97f2a',
          color: '#fff4e3',
          // compact: Lock In's font and height; width hugs the label
          width: compact ? undefined : '200px',
          height: compact ? '32px' : undefined,
          padding: compact ? '4px 12px' : undefined,
          whiteSpace: 'nowrap',
        }}>
        How to Play
      </button>
      {open && <HowToPlayModal onClose={() => setOpen(false)} />}
    </>
  );
}
