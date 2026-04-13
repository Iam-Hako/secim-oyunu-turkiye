import { io } from 'socket.io-client';

let SERVER_URL = 'http://localhost:3001';
const GLOBAL_SERVER_URL = 'http://95.70.201.141:3001';

export const socket = io(SERVER_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

export const updateSocketUrl = (target) => {
  let formattedUrl = '';
  if (target === 'global') {
    formattedUrl = GLOBAL_SERVER_URL;
  } else if (target === 'localhost') {
    formattedUrl = 'http://localhost:3001';
  } else {
    formattedUrl = target.startsWith('http') ? target : `http://${target}:3001`;
  }
  
  socket.io.uri = formattedUrl;
  console.log(`[Socket] Hedef sunucu: ${formattedUrl}`);
};

export const connectSocket = () => {
  if (!socket.connected) {
    socket.connect();
  }
};

export const disconnectSocket = () => {
  if (socket.connected) {
    socket.disconnect();
  }
};
