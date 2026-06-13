// socketService.js
import { io } from 'socket.io-client';

// Persistent per-browser session id so the server can recognize us across
// reconnects and page refreshes
let sessionId = localStorage.getItem('sessionId');
if (!sessionId) {
  sessionId = window.crypto && window.crypto.randomUUID
    ? window.crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
  localStorage.setItem('sessionId', sessionId);
}

// In a production build the page is served by the game server itself, so
// connect back to the same origin; in dev the server runs on port 4000 of
// whatever host the page was loaded from (localhost or a LAN IP)
const SERVER_URL = process.env.NODE_ENV === 'production'
  ? window.location.origin
  : `http://${window.location.hostname}:4000`;

const socket = io(SERVER_URL, { auth: { sessionId } });

export { sessionId };
export default socket;
