// Central sound effects with a master volume and mute toggle persisted across
// sessions. Sounds are decoded into Web Audio buffers up front (see
// preloadSounds) so playback is instant — over a network a fresh `new Audio`
// would stall fetching the file the first time, making the bang land late.
// Playing from a buffer also lets overlapping shots/steps mix freely.
// Browsers block audio before the first user interaction — fail silently.
let muted = localStorage.getItem('soundMuted') === '1';
let masterVolume = (() => {
  const stored = parseFloat(localStorage.getItem('soundVolume'));
  return Number.isFinite(stored) ? Math.min(1, Math.max(0, stored)) : 1;
})();

export const isMuted = () => muted;
export const getVolume = () => masterVolume;

export const setMuted = (value) => {
  muted = !!value;
  localStorage.setItem('soundMuted', muted ? '1' : '0');
};

export const setVolume = (value) => {
  masterVolume = Math.min(1, Math.max(0, value));
  localStorage.setItem('soundVolume', String(masterVolume));
};

// One shared AudioContext, created lazily. Decoded clips are keyed by their src
let audioCtx = null;
const buffers = new Map(); // src -> AudioBuffer

const getCtx = () => {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) audioCtx = new Ctx();
  }
  return audioCtx;
};

// Browsers start the context suspended until a user gesture; resume on the
// first interaction so the first scheduled sound isn't dropped
const resume = () => {
  const ctx = getCtx();
  if (ctx && ctx.state === 'suspended') ctx.resume();
};
['pointerdown', 'keydown', 'touchstart'].forEach((evt) =>
  window.addEventListener(evt, resume)
);

// Fetch + decode each clip once so playSound can fire it with no network/decode
// latency. Anything that fails to load falls back to a plain Audio element.
export const preloadSounds = (sources) => {
  const ctx = getCtx();
  if (!ctx) return Promise.resolve();
  return Promise.all(
    sources.map(async (src) => {
      if (buffers.has(src)) return;
      try {
        const response = await fetch(src);
        const data = await response.arrayBuffer();
        buffers.set(src, await ctx.decodeAudioData(data));
      } catch {
        // Leave it unbuffered; playSound will use the Audio fallback
      }
    })
  );
};

export const playSound = (src, volume = 1, delayMs = 0) => {
  const fire = () => {
    // Checked at fire time so muting also silences already-scheduled bangs
    if (muted || masterVolume <= 0) return;
    const gainValue = Math.min(1, Math.max(0, volume * masterVolume));

    const ctx = getCtx();
    const buffer = buffers.get(src);
    if (ctx && buffer) {
      if (ctx.state === 'suspended') ctx.resume();
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = gainValue;
      source.connect(gain).connect(ctx.destination);
      source.start();
      return;
    }

    // Not preloaded (decode failed, or first play before preload finished)
    const audio = new Audio(src);
    audio.volume = gainValue;
    audio.play().catch(() => { });
  };
  if (delayMs > 0) {
    setTimeout(fire, delayMs);
  } else {
    fire();
  }
};
