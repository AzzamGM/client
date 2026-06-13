// Preload the heavy game sprites once so characters don't pop in late when
// the game starts — by the time the board renders, everything is cached.
// Sound effects get decoded here too so the first shot/step/climb fires
// instantly instead of stalling on a network fetch (noticeable over a tunnel).
import { SKINS } from './skins';
import { preloadSounds } from './sound';
import Train from './assets/train.png';
import Train2 from './assets/train2.png';
import Train3 from './assets/train3.png';
import GunshotHitSfx from './assets/gunshot_hit-1.wav';
import GunshotMissSfx from './assets/gunshot_miss-1.wav';
import WalkingSfx from './assets/walking.wav';
import ClimbSfx from './assets/climb.wav';
import FailedStandoffSfx from './assets/failed-standoff.wav';
import TurnSfx from './assets/turn.wav';
import RecoverSfx from './assets/recover.wav';
import StandoffSfx from './assets/standoff.wav';
import WinSfx from './assets/win-1.mp3';

const IMAGE_SOURCES = [
  Train,
  Train2,
  Train3,
  ...SKINS.flatMap((skin) => [skin.avatar, skin.idle, skin.walk, skin.climb, skin.draw, skin.wounded]),
];

const SOUND_SOURCES = [
  GunshotHitSfx,
  GunshotMissSfx,
  WalkingSfx,
  ClimbSfx,
  FailedStandoffSfx,
  TurnSfx,
  RecoverSfx,
  StandoffSfx,
  WinSfx,
];

let promise = null;

const preloadAssets = () => {
  if (!promise) {
    const images = IMAGE_SOURCES.map(
      (src) =>
        new Promise((resolve) => {
          const img = new Image();
          // A failed asset shouldn't hold the loading screen hostage
          img.onload = resolve;
          img.onerror = resolve;
          img.src = src;
        })
    );
    promise = Promise.all([...images, preloadSounds(SOUND_SOURCES)]);
  }
  return promise;
};

export default preloadAssets;
