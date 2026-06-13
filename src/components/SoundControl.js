// Mute toggle + master volume slider, pinned to the bottom-left corner
import React, { useState } from 'react';
import { getVolume, isMuted, setMuted, setVolume } from '../sound';
import './style.css';

export default function SoundControl() {
  const [muted, setMutedState] = useState(isMuted());
  const [volume, setVolumeState] = useState(getVolume());

  const toggleMute = () => {
    setMuted(!muted);
    setMutedState(!muted);
  };

  const handleVolume = (e) => {
    const value = Number(e.target.value) / 100;
    setVolume(value);
    setVolumeState(value);
    // Dragging the slider implies wanting sound back
    if (muted && value > 0) {
      setMuted(false);
      setMutedState(false);
    }
  };

  const silent = muted || volume === 0;

  return (
    <div className='sound-control'>
      <button onClick={toggleMute} className='sound-toggle' title={silent ? 'Unmute' : 'Mute'} aria-label={silent ? 'Unmute' : 'Mute'}>
        {silent ? '🔇' : '🔊'}
      </button>
      <input
        type='range'
        min='0'
        max='100'
        value={muted ? 0 : Math.round(volume * 100)}
        onChange={handleVolume}
        className='sound-slider'
        aria-label='Volume'
      />
    </div>
  );
}
