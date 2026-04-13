import { PARTIES, getPartyById } from '../data/parties';
import { PROVINCES } from '../data/provinces';
import './ActionPanel.css';

export default function ActionPanel({
  playerPartyId,
  selectedProvince,
  currentDay,
  nationalVotes,
  ralliesThisTurn,
  maxRallies,
  budget,
  playerLocation,
  offices,
  aiState = {},
  aiActions = [],
  playerActions = [],
  viewMode,
  onRally,
  onTV,
  onSocialMedia,
  onAdvanceDay,
  onTravel,
  onBuild,
  onBuyAction,
  provinceVotes,
  onToggleSettings,
}) {
  const playerParty = getPartyById(playerPartyId);
  const selProvince = PROVINCES.find(p => p.id === selectedProvince);
  const curProvince = PROVINCES.find(p => p.id === playerLocation);
  
  const canAct = ralliesThisTurn < maxRallies;
  const isAtLocation = selectedProvince === playerLocation;
  const officeLevel = selectedProvince ? offices[selectedProvince] || 0 : 0;

  const formatMoney = (val) => new Intl.NumberFormat('tr-TR').format(val) + ' ₺';

  return (
    <div className="action-war-room">
      {/* 1. ÜST PANEL: DURUM VE BÜTÇE */}
      <div className="dashboard-section main-status">
        <div className="status-header">
          <div className="status-badge-wrap">
            <div className="badge-live">CANLI HAREKAT MERKEZİ</div>
            <button className="btn-settings-toggle" onClick={onToggleSettings} title="Ayarlar">⚙️</button>
          </div>
          <div className="day-counter">
            <span className="day-label">SEÇİME KALAN</span>
            <span className="day-number">{currentDay} <small>GÜN</small></span>
          </div>
        </div>
        
        <div className="money-card">
          <div className="card-lbl">KAMPANYA BÜTÇESİ</div>
          <div className="card-val">{formatMoney(budget)}</div>
          <div className="budget-progress"><div className="fill" style={{width: '65%'}}/></div>
        </div>
      </div>

      {/* 1.5 National Results Dashboard - REBORN */}
      <div className="dashboard-section national-results">
        <h3 className="section-title-wrap">
          <span className="title-main">TÜRKİYE GENELİ</span>
          <span className="title-sub">GÜNCEL KAMUOYU TAHMİNİ</span>
        </h3>
        <div className="national-grid">
          {Object.entries(nationalVotes || {})
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([pid, vote]) => {
              const party = getPartyById(pid);
              const isPlayer = pid === playerPartyId;
              return (
                <div key={pid} className={`nat-row ${isPlayer ? 'player-row' : ''}`}>
                  <div className="nat-meta">
                    <img src={party?.logo} className="nat-p-logo" alt="" />
                    <span className="nat-p-abbr">{party?.shortName}</span>
                    <span className="nat-p-val">%{vote.toFixed(1)}</span>
                  </div>
                  <div className="nat-bar-bg">
                    <div 
                      className="nat-bar-fill" 
                      style={{ 
                        width: `${vote}%`, 
                        background: party?.color,
                        boxShadow: `0 0 12px ${party?.color}`
                      }} 
                    />
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* 2. KONUM KARTI */}
      <div className="dashboard-section location-status">
        <div className="location-card">
          <div className="loc-icon">📍</div>
          <div className="loc-info">
            <span className="card-lbl">ŞU ANKİ KONUM</span>
            <span className="loc-name">{curProvince?.name || '---'}</span>
          </div>
          <div className="day-counter">
            <span className="day-label">SEÇİME KALAN GÜN</span>
            <span className="day-number">{currentDay}</span>
          </div>
        </div>
      </div>

      {/* 3. PARTİ VE AP */}
      <div className="dashboard-section">
        <div className="party-box" style={{ '--party-color': playerParty?.color }}>
          <div className="party-main-info">
            <div className="p-brand">
              <img src={playerParty?.logo} className="p-logo" alt="" />
              <div className="p-meta">
                <span className="p-abbr">{playerParty?.shortName}</span>
                <span className="p-full">{playerParty?.name}</span>
              </div>
            </div>
            <div className="p-stat">
              <span className="stat-val">%{nationalVotes?.[playerPartyId]?.toFixed(1) || '0.0'}</span>
              <span className="stat-lbl">GENEL OY</span>
            </div>
          </div>
          
          <div className="ap-meter">
            <div className="ap-dots">
              {[...Array(maxRallies)].map((_, i) => (
                <div 
                  key={i} 
                  className={`ap-dot ${i < (maxRallies - ralliesThisTurn) ? 'full' : 'empty'}`}
                />
              ))}
            </div>
            <div className="ap-text">AKSİYON PUANI: {maxRallies - ralliesThisTurn} / {maxRallies}</div>
          </div>
        </div>
      </div>

      {/* 4. DİNAMİK ANALİZ MERKEZİ (MODA GÖRE DEĞİŞİR) */}
      {selectedProvince && (
        <div className="dashboard-section province-analysis fade-in">
          <h3 className="section-title-wrap">
            <span className="title-main">{selProvince?.name} {viewMode === 'votes' ? 'ANALİZİ' : viewMode === 'radar' ? 'İSTİHBARATI' : 'LOJİSTİĞİ'}</span>
            <span className="title-sub">
              {viewMode === 'votes' ? 'YEREL OY VE KAMUOYU' : viewMode === 'radar' ? 'SAHA HAREKETLİLİĞİ' : 'KURUMSAL KALE YAPISI'}
            </span>
          </h3>
          
          {/* MOD 1: SİYASİ ANALİZ (Oylar) */}
          {viewMode === 'votes' && (
            <div className="analysis-table">
              {PARTIES.map(p => {
                 const v = provinceVotes?.[selectedProvince]?.[p.id] || 0;
                 return (
                  <div key={p.id} className={`nat-row ${p.id === playerPartyId ? 'player-row' : ''}`}>
                    <div className="nat-meta">
                      <img src={p.logo} className="nat-p-logo" alt="" />
                      <span className="nat-p-abbr">{p.shortName}</span>
                      <span className="nat-p-val">%{v.toFixed(1)}</span>
                    </div>
                    <div className="nat-bar-bg">
                      <div className="nat-bar-fill" style={{ width: `${v}%`, background: p.color, boxShadow: `0 0 8px ${p.color}` }} />
                    </div>
                  </div>
                 );
              })}
            </div>
          )}

          {/* MOD 2: RADAR İSTİHBARATI (Konumlar ve Ralliler) */}
          {viewMode === 'radar' && (
            <div className="analysis-table radar-intel">
              <div className="intel-sub-title">📍 ŞU AN BURADA OLANLAR</div>
              <div className="intel-presence-grid">
                {/* Oyuncu Buradaysa */}
                {playerLocation === selectedProvince && (
                  <div className="intel-chip player">SİZİN HEYETİNİZ BURADA</div>
                )}
                {/* AI Buradaysa */}
                {Object.entries(aiState).map(([pid, ai]) => {
                  if (ai?.lastLocation === selectedProvince) {
                    const p = getPartyById(pid);
                    return <div key={pid} className="intel-chip ai" style={{'--p-color': p?.color}}>{p?.shortName} HEYETİ BURADA</div>;
                  }
                  return null;
                })}
              </div>

              <div className="intel-sub-title" style={{marginTop: '15px'}}>📢 PARTİ AKSİYONLARI</div>
              <div className="intel-history-list">
                {[...playerActions, ...aiActions]
                  .filter(a => a.type === 'rally' && a.provinceName === selProvince?.name)
                  .slice(-8)
                  .reverse()
                  .map((a, i) => {
                    const party = a.partyId ? getPartyById(a.partyId) : playerParty;
                    return (
                      <div key={i} className="intel-history-row">
                        <span className="h-dot" style={{background: party?.color}}/>
                        <span className="h-party">{party?.shortName}</span>
                        <span className="h-text">{a.isRemote ? 'Miting Yapıyor (Canlı)' : 'Miting Düzenledi'}</span>
                      </div>
                    );
                  })}
                {([...playerActions, ...aiActions].filter(a => a.type === 'rally' && a.provinceName === selProvince?.name).length === 0) && (
                  <div className="empty-intel">Bu bölgede henüz bir çalışma saptanmadı.</div>
                )}
              </div>
            </div>
          )}

          {/* MOD 3: LOJİSTİK KARARGAH (Ofisler) */}
          {viewMode === 'logistics' && (
            <div className="analysis-table logistics-hq">
              <div className="intel-sub-title">🏢 KURULAN OFİSLER</div>
              {PARTIES.map(p => {
                const partyOffices = offices?.[p.id] || {};
                const lvl = partyOffices[selectedProvince] || 0;
                return (
                  <div key={p.id} className="log-office-row">
                    <img src={p.logo} className="nat-p-logo" alt="" />
                    <span className="log-p-name">{p.shortName}</span>
                    <div className="log-lvl-wrap">
                       {lvl > 0 ? [...Array(lvl)].map((_, i) => <span key={i} className="lvl-star">★</span>) : <span className="no-lvl">Yok</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          <div className="province-extra">
            <div className="extra-item">
              <span className="lbl">NÜFUS:</span>
              <span className="val">{selProvince?.population?.toLocaleString()}</span>
            </div>
            <div className="extra-item">
              <span className="lbl">OFİS:</span>
              <span className="val">{offices?.[playerPartyId]?.[selectedProvince] ? `Seviye ${offices[playerPartyId][selectedProvince]}` : 'Yok'}</span>
            </div>
          </div>
        </div>
      )}

      {/* 5. SAHA ÇALIŞMALARI (ANA AKSİYONLAR) */}
      <div className="dashboard-section actions-group">
        <h3 className="group-title">SAHA ÇALIŞMALARI</h3>
        
        {/* MİTİNG: En Önemli Aksiyon */}
        <button
          className={`action-card primary rally ${!isAtLocation ? 'locked' : ''}`}
          disabled={!canAct || !selectedProvince || !isAtLocation || budget < getRallyCost(selectedProvince)}
          onClick={() => selectedProvince && onRally(selectedProvince)}
        >
          <div className="act-icon">📢</div>
          <div className="act-content">
            <span className="act-title">MİTİNG DÜZENLE</span>
            <span className="act-desc">
              {!selectedProvince 
                ? 'Önce haritadan il seçin' 
                : !isAtLocation 
                  ? `${selProvince?.name}'ye seyahat etmelisiniz.` 
                  : `${selProvince?.name} Meydanı - ${formatMoney(getRallyCost(selectedProvince))}`}
            </span>
          </div>
        </button>

        <div className="action-grid-2">
          <button 
            className={`action-card travel ${isAtLocation ? 'locked' : ''}`} 
            disabled={!selectedProvince || isAtLocation || budget < getTravelCost(playerLocation, selectedProvince)}
            onClick={() => onTravel(selectedProvince)}
          >
            <div className="act-icon">✈️</div>
            <div className="iphone-status-bar">
              <span className="time">19:27</span>
              <div className="status-icons">SIGNAL 5G BATT</div>
            </div>
            <div className="act-content">
              <span className="act-title">SEYAHAT</span>
              <span className="act-desc">
                {isAtLocation 
                  ? 'Şu an buradasınız' 
                  : selectedProvince 
                    ? `${formatMoney(getTravelCost(playerLocation, selectedProvince))}`
                    : 'İl Seçin'}
              </span>
            </div>
          </button>
          
          <button 
            className="action-card office" 
            disabled={!selectedProvince || !isAtLocation || budget < 12000000}
            onClick={onBuild}
          >
            <div className="act-icon">🏢</div>
            <div className="act-content">
              <span className="act-title">OFİS KUR</span>
              <span className="act-desc">{budget < 12000000 ? 'Yetersiz Bütçe' : `Maliyet: 12M`}</span>
            </div>
          </button>
        </div>
      </div>

      {/* 5. MEDYA VE KAMPANYA */}
      <div className="dashboard-section actions-group">
        <h3 className="group-title">MEDYA VE DİJİTAL</h3>
        <div className="action-grid-2">
          <button className="action-card media" disabled={!canAct || budget < 4000000} onClick={onTV}>
            <div className="act-icon">📺</div>
            <span className="act-title">TV YAYINI</span>
          </button>
          <button className="action-card media" disabled={!canAct || budget < 800000} onClick={onSocialMedia}>
            <div className="act-icon">📱</div>
            <span className="act-title">INSTASEÇİM</span>
          </button>
        </div>
      </div>

      {/* 6. OPERASYONEL */}
      <div className="dashboard-section actions-group footer-actions">
        <button className="btn-buy-ap" disabled={budget < 5000000} onClick={onBuyAction}>
          ⚡ Ekstra Aksiyon Al (5M ₺)
        </button>
        
        <button className="btn-end-day" onClick={onAdvanceDay}>
          <span>GÜNÜ TAMAMLA VE RAPORU GÖR</span>
          <span className="end-icon">→</span>
        </button>
      </div>
    </div>
  );
}

// UI Tarafında Maliyet Hesaplama Yardımcıları (useGameEngine ile tam senkronize)
function getTravelCost(fromId, toId) {
  if (!fromId || !toId || fromId === toId) return 0;
  const p1 = PROVINCES.find(p => p.id === fromId);
  const p2 = PROVINCES.find(p => p.id === toId);
  if (!p1 || !p2) return 300000;
  const dx = p1.cx - p2.cx;
  const dy = p1.cy - p2.cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return Math.round(300000 + (dist * 15000));
}

function getRallyCost(provinceId) {
  // Kullanıcı isteği: Tüm şehirler 5M sabotajsız sabit
  return 5000000;
}
