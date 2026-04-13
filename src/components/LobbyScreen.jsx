import React, { useState, useEffect } from 'react';
import { socket, connectSocket, updateSocketUrl } from '../services/socket';
import { getAllParties } from '../data/parties';
import './MainMenu.css'; // İlgili stilleri MainMenu'den alacağız veya altına ekleriz

export default function LobbyScreen({ onBack, onStartMultiplayer }) {
  const [inRoom, setInRoom] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [roomData, setRoomData] = useState(null);
  const [lobbyRooms, setLobbyRooms] = useState([]);
  const [selectedPartyId, setSelectedPartyId] = useState(null);
  const [playerName, setPlayerName] = useState('Oyuncu_' + Math.floor(Math.random() * 1000));
  const [errorMsg, setErrorMsg] = useState('');

  const allParties = getAllParties();

  useEffect(() => {
    connectSocket();

    socket.on('roomCreated', (id) => {
      setRoomId(id);
      setInRoom(true);
      setErrorMsg('');
    });

    socket.on('roomUpdate', (data) => {
      setRoomData(data);
      setInRoom(true);
      setRoomId(data.id);
    });

    socket.on('lobbyUpdate', (rooms) => {
      setLobbyRooms(rooms);
    });

    socket.on('error', (msg) => {
      setErrorMsg(msg);
    });

    // Lobi listesini çek
    socket.emit('getLobbyRooms');

    return () => {
      socket.off('roomCreated');
      socket.off('roomUpdate');
      socket.off('lobbyUpdate');
      socket.off('error');
    };
  }, []);

  const handleCreateRoom = () => {
    const newRoomId = Math.random().toString(36).substring(2, 6).toUpperCase();
    const partyObj = allParties.find(p => p.id === selectedPartyId) || null;
    const hostData = { name: playerName, partyId: selectedPartyId, partyObj };
    socket.emit('createRoom', { roomId: newRoomId, hostData });
  };

  const handleJoinRoom = (targetCode) => {
    const code = targetCode || joinCode;
    if (!code) return;
    const partyObj = allParties.find(p => p.id === selectedPartyId) || null;
    const playerData = { name: playerName, partyId: selectedPartyId, partyObj };
    socket.emit('joinRoom', { roomId: code.toUpperCase(), playerData });
  };

  const handleStartGame = () => {
    if (!selectedPartyId) {
      setErrorMsg("Lütfen bir parti seçin!");
      return;
    }
    onStartMultiplayer(roomData, selectedPartyId);
  };

  if (inRoom && roomData) {
    const isHost = roomData.host === socket.id;
    return (
      <div className="lobby-room-container animate-in" style={{ padding: '40px', textAlign: 'center' }}>
        <div className="status-badge" style={{ background: '#3b82f6', color: 'white' }}>ODA KODU: {roomData.id}</div>
        <h2>Siyasi Karargah</h2>
        <div style={{ marginTop: '30px', display: 'flex', gap: '20px', flexDirection: 'column' }}>
           <div style={{ background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '10px' }}>
              <h3>Lobi Oyuncuları ({Object.keys(roomData.players).length}/8)</h3>
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {Object.entries(roomData.players).map(([sid, data]) => {
                  const p = allParties.find(party => party.id === data.partyId);
                  return (
                    <li key={sid} style={{ margin: '10px 0', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '1.4rem' }}>{sid === roomData.host ? '👑' : '👤'}</span>
                      <strong style={{ color: sid === socket.id ? '#60a5fa' : 'white' }}>{data.name}</strong> 
                      <span style={{ opacity: 0.7 }}>{p ? ` [${p.abbr}]` : ' (Parti Seçiyor...)'}</span>
                    </li>
                  )
                })}
              </ul>
           </div>

           <div style={{ background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '10px' }}>
             <h3>Partini Seç</h3>
             <select 
                value={selectedPartyId || ''} 
                onChange={(e) => setSelectedPartyId(e.target.value)}
                style={{ padding: '12px', width: '100%', borderRadius: '8px', background: '#1e293b', color: 'white', border: '1px solid #334155' }}
             >
               <option value="">-- Bir Parti Seçin --</option>
               {allParties.map(p => (
                 <option key={p.id} value={p.id}>{p.name} ({p.abbr})</option>
               ))}
             </select>
           </div>
           
           <div style={{ marginTop: '20px' }}>
            {isHost ? (
               <button className="launch-btn active" onClick={handleStartGame}>
                  Çok Oyunculu Oyunu Başlat
               </button>
            ) : (
               <div style={{ padding: '20px', background: 'rgba(168, 85, 247, 0.1)', borderRadius: '10px', color: '#a855f7' }}>
                  Hostun oyunu başlatması bekleniyor...
               </div>
            )}
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="multiplayer-lobby-screen animate-in">
      <div className="lobby-header">
        <span className="status-badge" style={{ background: '#10b981' }}>CANLI SUNUCULAR</span>
        <h2>Çok Oyunculu Meydanlar</h2>
        <p>Açık bir odaya katılın veya arkadaşlarınız için yenisini kurun.</p>
      </div>

      <div style={{ marginTop: '30px', display: 'flex', gap: '20px', flexDirection: 'column' }}>
        {errorMsg && <div style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '10px', borderRadius: '5px' }}>{errorMsg}</div>}
        
        <div>
          <label style={{ display: 'block', marginBottom: '10px', color: '#94a3b8' }}>Oyuncu İsminiz</label>
          <input 
            type="text" 
            value={playerName} 
            onChange={(e) => setPlayerName(e.target.value)}
            style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: 'white' }}
          />
        </div>

        {/* LOBİ LİSTESİ */}
        <div className="active-rooms-lobby" style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <h3 style={{ marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             Açık Odalar 
             <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{lobbyRooms.length} Oda Bulundu</span>
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '200px', overflowY: 'auto' }}>
            {lobbyRooms.length === 0 ? (
               <div style={{ textAlign: 'center', opacity: 0.5, padding: '20px' }}>Şu an açık oda yok, bir tane kurun!</div>
            ) : lobbyRooms.map(room => (
              <div 
                key={room.id} 
                onClick={() => handleJoinRoom(room.id)}
                style={{ 
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                  padding: '12px 20px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px',
                  cursor: 'pointer', transition: 'all 0.2s'
                }}
                className="lobby-room-item"
              >
                <div>
                   <span style={{ fontWeight: 'bold', color: '#60a5fa' }}>{room.id}</span>
                   <span style={{ marginLeft: '10px', fontSize: '0.9rem', opacity: 0.8 }}>{room.hostName}'in Odası</span>
                </div>
                <div style={{ fontSize: '0.85rem' }}>
                   {room.playerCount}/8 Oyuncu {room.isStarted && '• Başladı'}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
            <h3>Yeni Oda Kur</h3>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '15px' }}>Siz kurun, arkadaşlarınız listeden katılsın.</p>
            <button className="launch-btn active" onClick={handleCreateRoom}>Oda Kur</button>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
            <h3>Koda Göre Katıl</h3>
             <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
               <input 
                  type="text" 
                  placeholder="KOD" 
                  maxLength={4}
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '10px', background: 'transparent', color: 'white', textAlign: 'center', fontSize: '1.2rem', textTransform: 'uppercase' }}
                />
                <button 
                  className="launch-btn" 
                  style={{ background: joinCode.length === 4 ? '#3b82f6' : '#333' }}
                  onClick={() => handleJoinRoom()}
                  disabled={joinCode.length !== 4}
                >
                  GİR
                </button>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
