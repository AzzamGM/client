// socketService.js
import { io } from 'socket.io-client';

const socket = io('http://localhost:4000'); // Adjust the URL as needed

export default socket;
