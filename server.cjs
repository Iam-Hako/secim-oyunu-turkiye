const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);

// WebSocket bağlantılarını yapılandır
const io = new Server(server, {
  cors: {
    origin: "*", // Yerel ağdaki herkese açık erişim
    methods: ["GET", "POST"]
  }
});

// Sunucu hafızasındaki odalar (RAM üzerinde tutulur)
const rooms = {};

// Oda listesini lobi için temizleyip döndüren yardımcı fonksiyon
const getPublicRooms = () => {
  return Object.values(rooms).map(r => ({
    id: r.id,
    hostName: r.players[r.host]?.name || 'Bilinmiyor',
    playerCount: Object.keys(r.players).length,
    isStarted: r.gameState !== null
  }));
};

io.on('connection', (socket) => {
  console.log('[+] Yeni bağlantı:', socket.id);

  // Lobi listesini iste
  socket.on('getLobbyRooms', () => {
    socket.emit('lobbyUpdate', getPublicRooms());
  });

  // ODA KUR (HOST)
  socket.on('createRoom', ({ roomId, hostData }) => {
    rooms[roomId] = {
      id: roomId,
      host: socket.id,
      players: { [socket.id]: hostData },
      gameState: null,
      readyFlags: {}
    };
    
    socket.join(roomId);
    socket.emit('roomCreated', roomId);
    io.to(roomId).emit('roomUpdate', rooms[roomId]);
    
    // Tüm dünyaya yeni odayı duyur
    io.emit('lobbyUpdate', getPublicRooms());
    console.log(`[HOST] Oda Kuruldu: ${roomId}`);
  });

  // ODAYA KATIL (CLIENT)
  socket.on('joinRoom', ({ roomId, playerData }) => {
    if (rooms[roomId]) {
      if (Object.keys(rooms[roomId].players).length >= 8) {
        socket.emit('error', 'Oda kapasitesi dolu (Max: 8)');
        return;
      }
      
      rooms[roomId].players[socket.id] = playerData;
      socket.join(roomId);
      io.to(roomId).emit('roomUpdate', rooms[roomId]);
      
      if(rooms[roomId].gameState) {
          socket.emit('gameStateSync', rooms[roomId].gameState);
      }
      
      io.emit('lobbyUpdate', getPublicRooms());
      console.log(`[Oda: ${roomId}] Yeni katılımcı: ${socket.id}`);
    } else {
      socket.emit('error', 'Oda bulunamadı!');
    }
  });

  // STATE SENKRONİZASYONU (Sadece Host'tan gelir)
  socket.on('syncGameState', ({ roomId, state }) => {
    if (rooms[roomId] && rooms[roomId].host === socket.id) {
        rooms[roomId].gameState = state;
        socket.to(roomId).emit('gameStateSync', state);
    }
  });

  // BİREYSEL EYLEMLER (Miting, TV, Story vb.)
  socket.on('playerAction', ({ roomId, actionData }) => {
    if (rooms[roomId]) {
      socket.to(roomId).emit('playerActionReceived', { 
        socketId: socket.id, 
        actionData: {
          ...actionData,
          partyId: rooms[roomId].players[socket.id]?.partyId 
        } 
      });
    }
  });

  // HAREKET SENKRONİZASYONU
  socket.on('playerMove', ({ roomId, provinceId }) => {
    if (rooms[roomId]) {
      if (rooms[roomId].players[socket.id]) {
        rooms[roomId].players[socket.id].lastLocation = provinceId;
      }
      socket.to(roomId).emit('playerMoved', { 
        socketId: socket.id, 
        partyId: rooms[roomId].players[socket.id]?.partyId,
        provinceId 
      });
    }
  });

  // GÜN GEÇMEYE HAZIR OLMA DURUMU
  socket.on('setReadyStatus', ({ roomId, isReady }) => {
    if (rooms[roomId]) {
      rooms[roomId].readyFlags[socket.id] = isReady;
      io.to(roomId).emit('readyUpdate', rooms[roomId].readyFlags);
      
      const allReady = Object.keys(rooms[roomId].players).every(pid => rooms[roomId].readyFlags[pid] === true);
      if (allReady) {
        io.to(roomId).emit('allPlayersReady');
        rooms[roomId].readyFlags = {};
      }
    }
  });

  // BAĞLANTI KOPMASI
  socket.on('disconnect', () => {
    for (const roomId in rooms) {
      if (rooms[roomId].players[socket.id]) {
        delete rooms[roomId].players[socket.id];
        delete rooms[roomId].readyFlags[socket.id];
        
        if (Object.keys(rooms[roomId].players).length === 0) {
          delete rooms[roomId];
          console.log(`[TEMİZLİK] Oda kapandı: ${roomId}`);
        } else {
          if (rooms[roomId].host === socket.id) {
             rooms[roomId].host = Object.keys(rooms[roomId].players)[0];
          }
          io.to(roomId).emit('roomUpdate', rooms[roomId]);
        }
        io.emit('lobbyUpdate', getPublicRooms());
      }
    }
    console.log('[-] Bağlantı koptu:', socket.id);
  });
});

const PORT = 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`
=============================================
  TÜRKİYE SEÇİMLERİ - MÜLTİPLAYER SUNUCUSU
  Port: ${PORT} üzerinden yayında...
=============================================
  `);
});
