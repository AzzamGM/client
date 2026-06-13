// Six distinct cowboy skins. A player's numeric in-game id picks their set —
// those ids are shuffled at game start, so skins are effectively random per
// game while every client agrees on who wears what.
import Avatar1 from './assets/CowBoyAvatar.png';
import Avatar2 from './assets/CowBoyAvatar2.png';
import Avatar3 from './assets/CowBoyAvatar3.png';
import Avatar4 from './assets/CowBoyAvatar4.png';
import Avatar5 from './assets/CowBoyAvatar5.png';
import Avatar6 from './assets/CowBoyAvatar6.png';
import Idle1 from './assets/CowBoyIdle.gif';
import Idle2 from './assets/CowBoyIdle2.gif';
import Idle3 from './assets/CowBoyIdle3.gif';
import Idle4 from './assets/CowBoyIdle4.gif';
import Idle5 from './assets/CowBoyIdle5.gif';
import Idle6 from './assets/CowBoyIdle6.gif';
import Walk1 from './assets/CowBoyWalk.gif';
import Walk2 from './assets/CowBoyWalk2.gif';
import Walk3 from './assets/CowBoyWalk3.gif';
import Walk4 from './assets/CowBoyWalk4.gif';
import Walk5 from './assets/CowBoyWalk5.gif';
import Walk6 from './assets/CowBoyWalk6.gif';
import Climb1 from './assets/CowBoyClimb.gif';
import Climb2 from './assets/CowBoyClimb2.gif';
import Climb3 from './assets/CowBoyClimb3.gif';
import Climb4 from './assets/CowBoyClimb4.gif';
import Climb5 from './assets/CowBoyClimb5.gif';
import Climb6 from './assets/CowBoyClimb6.gif';
import Draw1 from './assets/CowBoyDraw.gif';
import Draw2 from './assets/CowBoyDraw2.gif';
import Draw3 from './assets/CowBoyDraw3.gif';
import Draw4 from './assets/CowBoyDraw4.gif';
import Draw5 from './assets/CowBoyDraw5.gif';
import Draw6 from './assets/CowBoyDraw6.gif';
import Wounded1 from './assets/CowBoyWounded.gif';
import Wounded2 from './assets/CowBoyWounded2.gif';
import Wounded3 from './assets/CowBoyWounded3.gif';
import Wounded4 from './assets/CowBoyWounded4.gif';
import Wounded5 from './assets/CowBoyWounded5.gif';
import Wounded6 from './assets/CowBoyWounded6.gif';

export const SKINS = [
  { avatar: Avatar1, idle: Idle1, walk: Walk1, climb: Climb1, draw: Draw1, wounded: Wounded1 },
  { avatar: Avatar2, idle: Idle2, walk: Walk2, climb: Climb2, draw: Draw2, wounded: Wounded2 },
  { avatar: Avatar3, idle: Idle3, walk: Walk3, climb: Climb3, draw: Draw3, wounded: Wounded3 },
  { avatar: Avatar4, idle: Idle4, walk: Walk4, climb: Climb4, draw: Draw4, wounded: Wounded4 },
  { avatar: Avatar5, idle: Idle5, walk: Walk5, climb: Climb5, draw: Draw5, wounded: Wounded5 },
  { avatar: Avatar6, idle: Idle6, walk: Walk6, climb: Climb6, draw: Draw6, wounded: Wounded6 },
];

// Numeric ids are 1-based; anything missing falls back to the first skin
export const skinFor = (numericId) => SKINS[(((numericId || 1) - 1) % SKINS.length + SKINS.length) % SKINS.length];
