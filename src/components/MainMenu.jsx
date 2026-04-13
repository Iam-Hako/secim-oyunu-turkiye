import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllParties, getCustomParties } from '../data/parties';
import CustomPartyModal from './CustomPartyModal';
import LobbyScreen from './LobbyScreen';
import './MainMenu.css';

export default function MainMenu({ onStartGame, initialStep = 0, initialMode = null }) {
  const navigate = useNavigate();
  const [selectedParty, setSelectedParty] = useState(null);
  const [hoveredParty, setHoveredParty] = useState(null);
  const [menuStep, setMenuStep] = useState(initialStep); // 0: Mode Select, 1: Party/Lobby Select
  const [gameMode, setGameMode] = useState(initialMode); // 'single' or 'multi'
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [allParties, setAllParties] = useState(getAllParties());
  const [connectionStatus, setConnectionStatus] = useState('connecting'); // 'connecting', 'connected', 'error'
  const [dots, setDots] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [socketInited, setSocketInited] = useState(false);

  // Nokta animasyonu (Connecting için)
  useEffect(() => {
    if (connectionStatus !== 'connecting') return;
    const interval = setInterval(() => {
      setDots(prev => (prev.length >= 3 ? '' : prev + '.'));
    }, 500);
    return () => clearInterval(interval);
  }, [connectionStatus]);

  // Socket Durum Takibi
  useEffect(() => {
    const onConnect = () => {
      setConnectionStatus('connected');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    };
    const onConnectError = () => setConnectionStatus('error');
    const onDisconnect = () => setConnectionStatus('connecting');

    import('../services/socket').then(({ socket }) => {
      if (socket.connected) {
        setConnectionStatus('connected');
      } else {
        setConnectionStatus('connecting');
      }
      
      socket.on('connect', onConnect);
      socket.on('connect_error', onConnectError);
      socket.on('disconnect', onDisconnect);
      setSocketInited(true);
    });

    return () => {
      import('../services/socket').then(({ socket }) => {
        socket.off('connect', onConnect);
        socket.off('connect_error', onConnectError);
        socket.off('disconnect', onDisconnect);
      });
    };
  }, []);

  useEffect(() => {
    setMenuStep(initialStep);
    setGameMode(initialMode);
  }, [initialStep, initialMode]);

  const selectedData = useMemo(() => 
    allParties.find(p => p.id === (hoveredParty || selectedParty)),
    [allParties, hoveredParty, selectedParty]
  );

  const handleCreateParty = (newParty) => {
    const existingCustom = getCustomParties();
    const updatedCustom = [...existingCustom, newParty];
    localStorage.setItem('custom_parties', JSON.stringify(updatedCustom));
    setAllParties(getAllParties());
    setShowCustomModal(false);
    setSelectedParty(newParty.id);
  };

  const handleStart = () => {
    if (selectedParty) {
      onStartGame(selectedParty);
      navigate('/game');
    }
  };

  const handleStartMultiplayer = (roomData, partyId) => {
    // Burada hem odayı hem partiyi oyuna aktararak tam oyun başlatılacak
    onStartGame(partyId, roomData);
    navigate('/game');
  };

  const selectMode = (mode) => {
    setGameMode(mode);
    setMenuStep(1);
    navigate(`/${mode}player`);
  };

  const goBack = () => {
    setMenuStep(0);
    setGameMode(null);
    navigate('/');
  };

  return (
    <div className="main-menu-v2">
      <div className="blobs-container">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>
      </div>
      
      <div className="menu-glass-container">
        {/* SIDEBAR: Her iki adımda da sabit durabilir veya değişebilir */}
        <div className="menu-sidebar">
          <div className="brand">
            <span className="brand-badge">2026</span>
            <h1 className="brand-title">TÜRKİYE<br/>SEÇİMİ</h1>
            <p className="brand-desc">
              {menuStep === 0 
                ? "Siyasetin kalbine yolculuk başlasın. Hangi meydanda yarışmak istersiniz?"
                : gameMode === 'single'
                ? "Demokrasi sandıktan başlar. Kendi hikayeni yazmaya hazır mısın?"
                : "Rakiplerinle meydanlarda karşılaşmaya hazır mısın?"}
            </p>
          </div>

          <div className="selection-preview">
            {menuStep === 0 ? (
              <div className="mode-welcome-icon animate-in">🏛️</div>
            ) : gameMode === 'single' ? (
              selectedData ? (
                <div className="preview-card animate-in">
                    <div className="preview-logo-box" style={{ '--party-color': selectedData.color }}>
                      <img 
                        src={selectedData.logo} 
                        alt={selectedData.name} 
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                      <div className="logo-fallback" style={{ display: 'none' }}>
                        {selectedData.abbr}
                      </div>
                    </div>
                  <h2 className="preview-name">{selectedData.name}</h2>
                  <p className="preview-desc">{selectedData.description}</p>
                  <div className="preview-leader">
                    <span className="label">Lider</span>
                    <span className="value">{selectedData.leader}</span>
                  </div>
                  <div className="preview-status-row">
                    <div className="anket-box">
                      <span className="anket-val">%{selectedData.initialVote}</span>
                      <span className="anket-label">ANKET</span>
                    </div>
                    <div className="ideology-badge" style={{ '--party-color': selectedData.color }}>
                      {selectedData.ideology}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="preview-empty">
                  <div className="pulse-icon">🗳️</div>
                  <p>Başlamak için bir parti seçin</p>
                </div>
              )
            ) : (
              <div className="lobby-preview animate-in">
                <div className={`lobby-icon ${connectionStatus}`}>🌐</div>
                <div className="connection-text-wrap">
                  {connectionStatus === 'connecting' && (
                    <p style={{ color: '#94a3b8' }}>Sunuculara Bağlanılıyor{dots}</p>
                  )}
                  {connectionStatus === 'connected' && (
                    showSuccess ? (
                      <p style={{ color: '#10b981', fontWeight: 'bold' }}>✓ Sunuculara başarıyla bağlanıldı!</p>
                    ) : (
                      <>
                        <p style={{ color: '#60a5fa', fontSize: '0.8rem', opacity: 0.7 }}>Sunucu Durumu: Aktif</p>
                        <p style={{ color: 'white', fontWeight: 'bold' }}>Sunucu: EU #1</p>
                      </>
                    )
                  )}
                  {connectionStatus === 'error' && (
                    <p style={{ color: '#ef4444', fontSize: '0.9rem' }}>
                      🚫 Sunuculara bağlanmakta sorun yaşanıyor. Lütfen daha sonra tekrar deneyin.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {menuStep === 1 && gameMode === 'single' && (
            <button
              className={`launch-btn ${selectedParty ? 'active' : ''}`}
              onClick={handleStart}
              disabled={!selectedParty}
            >
              <span>Kampanyayı Başlat</span>
              <div className="btn-glow"></div>
            </button>
          )}

          {menuStep === 1 && (
            <button className="back-btn" onClick={() => setMenuStep(0)}>
              ↩ Mod Seçimine Dön
            </button>
          )}
        </div>

        {/* MAIN CONTENT AREA */}
        <div className="menu-main-content">
          {menuStep === 0 ? (
            <div className="mode-selection-screen animate-in">
              <div className="mode-header">
                <h2>Seçim Modunu Belirle</h2>
                <p>Türkiye'nin geleceğini nasıl şekillendireceksin?</p>
              </div>
              
              <div className="mode-cards-grid">
                <div className="mode-card single" onClick={() => selectMode('single')}>
                  <div className="mode-card-icon">👤</div>
                  <div className="mode-card-info">
                    <h3>Tek Oyunculu</h3>
                    <p>Yapay Zekaya karşı 81 ilde amansız bir beka mücadelesine gir.</p>
                  </div>
                  <div className="mode-card-badge">KLASİK</div>
                </div>

                <div className="mode-card multi" onClick={() => selectMode('multi')}>
                  <div className="mode-card-icon">👥</div>
                  <div className="mode-card-info">
                    <h3>Çok Oyunculu</h3>
                    <p>Gerçek oyuncularla aynı haritada ittifaklar kur veya meydan oku.</p>
                  </div>
                  <div className="mode-card-badge pro">AKTİF</div>
                </div>
              </div>
            </div>
          ) : gameMode === 'single' ? (
            <div className="party-selector-grid animate-in">
              <div className="grid-header">
                <h3>Siyasi Partiler</h3>
                <span>{allParties.length} aday mevcut</span>
              </div>
              <div className="parties-scroll">
                {allParties.map(party => (
                  <div
                    key={party.id}
                    className={`party-modern-card ${selectedParty === party.id ? 'active' : ''} ${hoveredParty === party.id ? 'hover' : ''}`}
                    style={{ '--party-color': party.color }}
                    onClick={() => setSelectedParty(party.id)}
                    onMouseEnter={() => setHoveredParty(party.id)}
                    onMouseLeave={() => setHoveredParty(null)}
                  >
                    <div className="card-bg"></div>
                    <div className="card-content">
                      <div className="party-image-box">
                        <img 
                          src={party.logo} 
                          alt={party.shortName} 
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                        <div className="logo-fallback-sm" style={{ display: 'none' }}>
                          {party.abbr}
                        </div>
                      </div>
                      <div className="party-summary">
                        <span className="p-abbr">{party.abbr}</span>
                        <span className="p-name">{party.shortName}</span>
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* KENDİ PARTİNİ KUR KARTI */}
                <div 
                  className="party-modern-card custom-add-card"
                  onClick={() => setShowCustomModal(true)}
                >
                   <div className="card-bg"></div>
                   <div className="card-content">
                      <div className="party-image-box empty">
                         <span className="plus-icon">+</span>
                      </div>
                      <div className="party-summary">
                         <span className="p-abbr">YENİ</span>
                         <span className="p-name">Kendi Partini Kur</span>
                      </div>
                   </div>
                </div>
              </div>
            </div>
          ) : (
            <LobbyScreen 
              onBack={() => setMenuStep(0)} 
              onStartMultiplayer={handleStartMultiplayer} 
            />
          )}
        </div>
      </div>

      {showCustomModal && (
        <CustomPartyModal 
          onSave={handleCreateParty} 
          onClose={() => setShowCustomModal(false)} 
        />
      )}
    </div>
  );
}
