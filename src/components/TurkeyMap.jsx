import { useMemo, useState, useCallback } from 'react';
import { PROVINCES, getLeadingParty } from '../data/provinces';
import { PARTIES, getPartyById } from '../data/parties';
import turkeyGeo from '../data/turkey-geo.json';
import './TurkeyMap.css';

// Simple Mercator projection for Turkey region
function project(lon, lat) {
  // Turkey roughly spans lon: 26-45, lat: 36-42
  const x = (lon - 25.5) * 45;
  const y = (42.5 - lat) * 65;
  return [x, y];
}

// Convert GeoJSON coordinates to SVG path
function coordsToPath(coords) {
  return coords
    .map((ring, ringIdx) => {
      const points = ring.map(([lon, lat]) => {
        const [x, y] = project(lon, lat);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      });
      return `M${points.join('L')}Z`;
    })
    .join(' ');
}

function featureToPath(feature) {
  const { type, coordinates } = feature.geometry;
  if (type === 'Polygon') {
    return coordsToPath(coordinates);
  } else if (type === 'MultiPolygon') {
    return coordinates.map(poly => coordsToPath(poly)).join(' ');
  }
  return '';
}

// Match GeoJSON feature to province data by name or ID
function matchProvince(feature) {
  const geoName = feature.properties.name;
  
  // Normalizasyon fonksiyonu
  const norm = (s) => s?.toLowerCase()
    .replace(/afyon/g, 'afyonkarahisar')
    .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g')
    .trim();

  const normGeo = norm(geoName);

  // 1. İsimle eşleştir
  let province = PROVINCES.find(p => norm(p.name) === normGeo);
  if (province) return province;

  // 2. Eksik harf/yanlış kodlama durumları için (örn. Istanbul -> stanbul)
  province = PROVINCES.find(p => normGeo && norm(p.name).includes(normGeo) || normGeo.includes(norm(p.name)));
  if (province) return province;

  return null;
}

// Calculate centroid of the largest polygon of a GeoJSON feature to ensure markers stay on main landmass
function getCentroid(feature) {
  const { type, coordinates } = feature.geometry;
  if (!coordinates || coordinates.length === 0) return null;

  let bestRing = null;
  
  if (type === 'Polygon') {
    bestRing = coordinates[0];
  } else if (type === 'MultiPolygon') {
    // Find the polygon with the largest bounding box area (proxy for actual area)
    let maxArea = -1;
    coordinates.forEach(poly => {
      const ring = poly[0];
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      ring.forEach(([lon, lat]) => {
        const [x, y] = project(lon, lat);
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      });
      const area = (maxX - minX) * (maxY - minY);
      if (area > maxArea) {
        maxArea = area;
        bestRing = ring;
      }
    });
  }

  if (!bestRing) return null;

  // Calculate average of points in the best ring
  let x = 0, y = 0;
  bestRing.forEach(([lon, lat]) => {
    const [px, py] = project(lon, lat);
    x += px;
    y += py;
  });
  
  return { x: x / bestRing.length, y: y / bestRing.length };
}

export default function TurkeyMap({
  provinceVotes,
  selectedProvince,
  onProvinceClick,
  onProvinceHover,
  playerPartyId,
  aiActions = [],
  aiState = {},
  playerActions = [],
  playerLocation,
  offices = {},
  activeRallies = [],
  viewMode, // Central state from props
  setViewMode, // Central state setter from props
  remotePlayers = {}, // Diğer oyuncuların konumları
}) {
  const [tooltip, setTooltip] = useState(null);

  // Pre-process features once
  const features = useMemo(() => {
    return turkeyGeo.features.map(feature => {
      const province = matchProvince(feature);
      const centroid = getCentroid(feature);
      return {
        feature,
        province,
        path: featureToPath(feature),
        calculatedCenter: centroid,
      };
    });
  }, []);

  // Tüm partilerin ofislerini YENİ hibrit merkezlere göre hesapla
  const officeMarkers = useMemo(() => {
    const markers = [];
    Object.entries(offices).forEach(([partyId, provinceMap]) => {
      const party = getPartyById(partyId);
      Object.entries(provinceMap).forEach(([pid, level]) => {
        const feat = features.find(f => f.province?.id === parseInt(pid));
        if (feat && level > 0 && feat.calculatedCenter) {
          markers.push({
            id: `office-${partyId}-${pid}`,
            x: feat.calculatedCenter.x,
            y: feat.calculatedCenter.y + 10,
            color: party?.color || '#fff',
            partyName: party?.shortName || '-',
            level
          });
        }
      });
    });
    return markers;
  }, [offices, features]);

  // Mitingleri YENİ robust merkezlere ve pusula tipi dağılıma göre hesapla
  const rallyMarkers = useMemo(() => {
    const markers = [];
    const provinceCounts = {};

    const getRadialJitter = (count) => {
      const dist = 30;
      const offsets = [
        { dx: 0, dy: 0, labelY: -12 },
        { dx: 0, dy: -dist, labelY: -12},
        { dx: 0, dy: dist, labelY: 20 },
        { dx: dist, dy: 0, labelY: -12 },
        { dx: -dist, dy: 0, labelY: -12 },
      ];
      return offsets[count % offsets.length];
    };

    const processRally = (action, isPlayer, partyColor, partyName) => {
      const feat = features.find(f => f.province?.name === action.provinceName);
      if (feat && feat.calculatedCenter) {
        const count = provinceCounts[feat.province.id] || 0;
        const { dx, dy, labelY } = getRadialJitter(count);
        provinceCounts[feat.province.id] = count + 1;

        markers.push({
          id: `${isPlayer ? 'p' : 'ai'}-${action.day || 0}-${feat.province.id}-${count}`,
          x: feat.calculatedCenter.x + dx,
          y: feat.calculatedCenter.y + dy,
          labelOffset: labelY,
          color: partyColor,
          partyName: partyName,
          isPlayer
        });
      }
    };

    playerActions.filter(a => a.type === 'rally').forEach(action => {
      const party = getPartyById(playerPartyId);
      processRally(action, true, party?.color || '#fff', party?.shortName || 'Sizin');
    });

    aiActions.filter(a => a.type === 'rally').forEach(action => {
      processRally(action, false, action.color, action.partyName || 'Rakip');
    });

    return markers.slice(-15);
  }, [playerActions, aiActions, playerPartyId, features]);

  // Tüm partilerin ANLIK konumlarını (Heyet/Araç) hesapla
  const partyPresenceMarkers = useMemo(() => {
    const markers = [];
    const cityPopCount = {};

    // Ofset hesaplayıcı (Şehir içindeki yığılmayı önler)
    const getCityOffset = (cid) => {
      const count = cityPopCount[cid] || 0;
      cityPopCount[cid] = count + 1;
      const angle = (count * 137.5) * (Math.PI / 180); // Altın oran dağılımı
      const r = count === 0 ? 0 : 18; 
      return { 
        dx: Math.cos(angle) * r, 
        dy: Math.sin(angle) * r 
      };
    };

    // 1. AI PARTİLERİ
    Object.entries(aiState).forEach(([pid, ai]) => {
      const party = getPartyById(pid);
      if (ai.lastLocation && party) {
        const feat = features.find(f => f.province?.id === ai.lastLocation);
        if (feat && feat.calculatedCenter) {
          const { dx, dy } = getCityOffset(ai.lastLocation);
          markers.push({
            id: `presence-${pid}`,
            x: feat.calculatedCenter.x + dx,
            y: feat.calculatedCenter.y + dy,
            color: party.color,
            name: party.shortName,
            isPlayer: false
          });
        }
      }
    });

    // 2. ONLINE RAKİP OYUNCULAR (Live Multiplayer)
    Object.entries(remotePlayers).forEach(([sid, data]) => {
      // Kendimizi presenceMarkers'dan hariç tut (playerMarker/Parti Aracı zaten var)
      if (sid === (window.socketId || '')) return; 
      
      const party = getPartyById(data.partyId);
      if (data.provinceId && party) {
        const feat = features.find(f => f.province?.id === parseInt(data.provinceId));
        if (feat && feat.calculatedCenter) {
          const { dx, dy } = getCityOffset(parseInt(data.provinceId));
          markers.push({
            id: `remote-${sid}`,
            x: feat.calculatedCenter.x + dx,
            y: feat.calculatedCenter.y + dy,
            color: party.color,
            name: party.shortName,
            abbr: party.abbr,
            isRemote: true
          });
        }
      }
    });
    
    return markers;
  }, [aiState, features, remotePlayers]);

  // Oyuncunun mevcut konumu (Parti Aracı)
  const curLocProvince = useMemo(() => {
    const feat = features.find(f => f.province?.id === playerLocation);
    if (feat && feat.calculatedCenter) {
      return { 
        name: feat.province.name,
        x: feat.calculatedCenter.x,
        y: feat.calculatedCenter.y
      };
    }
    return null;
  }, [playerLocation, features]);

  // Calculate province colors
  const provinceColors = useMemo(() => {
    if (!provinceVotes) return {};
    const colors = {};
    PROVINCES.forEach(p => {
      const votes = provinceVotes[p.id];
      if (votes) {
        const party = getLeadingParty(votes, PARTIES);
        if (party) {
          colors[p.id] = {
            color: party.color || '#444',
            partyId: party.id,
            vote: votes[party.id],
          };
        }
      }
    });
    return colors;
  }, [provinceVotes]);

  const handleMouseEnter = useCallback((province, e) => {
    if (!province) return;
    const votes = provinceVotes?.[province.id];
    if (!votes) return;

    const sorted = Object.entries(votes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    setTooltip({
      province,
      x: e.clientX,
      y: e.clientY,
      topParties: sorted.map(([pid, vote]) => ({
        party: getPartyById(pid),
        vote,
      })),
    });
    onProvinceHover?.(province.id);
  }, [provinceVotes, onProvinceHover]);

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  const handleMouseMove = useCallback((e) => {
    setTooltip(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
  }, []);

  return (
    <div className="turkey-map-container" onMouseMove={handleMouseMove}>
      {/* MAP VIEW SWITCHER */}
      <div className="map-view-switcher">
        <button 
          className={`view-btn ${viewMode === 'votes' ? 'active' : ''}`}
          onClick={() => setViewMode('votes')}
        >
          <span className="v-icon">📊</span> SİYASİ
        </button>
        <button 
          className={`view-btn ${viewMode === 'radar' ? 'active' : ''}`}
          onClick={() => setViewMode('radar')}
        >
          <span className="v-icon">🛰️</span> RADAR
        </button>
        <button 
          className={`view-btn ${viewMode === 'logistics' ? 'active' : ''}`}
          onClick={() => setViewMode('logistics')}
        >
          <span className="v-icon">🏢</span> OFİS
        </button>
      </div>

      <svg
        viewBox="-10 -10 920 520"
        className="turkey-map-svg"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <filter id="glow-selected">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="bus-glow">
            <feGaussianBlur stdDeviation="3" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="office-glow">
            <feGaussianBlur stdDeviation="2" result="glow" />
          </filter>
        </defs>

        {/* Province paths */}
        <g className="provinces-layer">
          {features.map(({ feature, province, path }) => {
            if (!province) return null;
            const c = provinceColors[province.id];
            const isSelected = selectedProvince === province.id;
            const isAtBus = playerLocation === province.id;
            
            // MODA GÖRE RENKLENDİRME: 'votes' modunda değilsek nötr renk kullan
            const color = viewMode === 'votes' ? (c?.color || '#333') : '#1e293b';
            
            const isPlayerProvince = c?.partyId === playerPartyId;

            return (
              <path
                key={province.id}
                d={path}
                fill={color}
                stroke="rgba(0,0,0,0.5)"
                strokeWidth={isSelected ? 2 : 0.5}
                className={`province-path ${isSelected ? 'selected' : ''} ${isPlayerProvince ? 'player' : ''} ${isAtBus ? 'has-bus' : ''} ${viewMode !== 'votes' ? 'neutral' : ''}`}
                style={{
                  filter: isSelected ? 'url(#glow-selected)' : undefined,
                  cursor: 'pointer',
                }}
                onClick={() => onProvinceClick?.(province.id)}
                onMouseEnter={(e) => handleMouseEnter(province, e)}
                onMouseLeave={handleMouseLeave}
              />
            );
          })}
        </g>

        {/* Rally Indicators Overlay - SADECE RADAR MODUNDA */}
        {viewMode === 'radar' && (
          <g className="rallies-layer">
            {rallyMarkers.map(m => (
              <g key={m.id} transform={`translate(${m.x}, ${m.y})`}>
                <circle r="8" fill={m.color} className="rally-pulse" />
                <circle r="4" fill="white" className="rally-dot" />
                <text y={m.labelOffset} textAnchor="middle" fontSize="8" fill="white" fontWeight="bold" className="rally-label">
                  {m.partyName}
                </text>
              </g>
            ))}
          </g>
        )}

        {/* ANLIK PARTİ KONUMLARI (RADAR) - SADECE RADAR MODUNDA */}
        {viewMode === 'radar' && (
          <g className="presence-layer">
            {partyPresenceMarkers.map(m => (
              <g key={m.id} transform={`translate(${m.x}, ${m.y})`}>
                <circle 
                   r={m.isRemote ? "7" : "5"} 
                   fill={m.color} 
                   stroke="white" 
                   strokeWidth={m.isRemote ? "2" : "1.5"} 
                   className={`presence-dot ${m.isRemote ? 'pulse-anim' : ''}`} 
                />
                <g transform={`translate(0, ${m.isRemote ? -15 : -12})`}>
                  <rect 
                    x={m.isRemote ? "-22" : "-18"} 
                    y="-7" 
                    width={m.isRemote ? "44" : "36"} 
                    height="12" 
                    rx="3" 
                    fill="rgba(15, 23, 42, 0.85)" 
                    className="presence-label-bg" 
                  />
                  <text textAnchor="middle" y="2" fill="white" fontSize={m.isRemote ? "8" : "7"} fontWeight="900" className="presence-text">
                    {m.isRemote ? m.abbr : m.name}
                  </text>
                </g>
              </g>
            ))}
          </g>
        )}

        {/* Election Offices Overlay - SADECE LOJİSTİK MODUNDA */}
        {viewMode === 'logistics' && (
          <g className="offices-layer">
            {officeMarkers.map(o => (
              <g key={o.id} transform={`translate(${o.x - 10}, ${o.y - 10})`}>
                <rect width="20" height="20" rx="4" fill="rgba(255,255,255,0.9)" filter="url(#office-glow)" />
                <text x="10" y="14" textAnchor="middle" fontSize="12">🏢</text>
              </g>
            ))}
          </g>
        )}

        {/* Election Bus (Player Location) */}
        {curLocProvince && (
          <g className="player-bus-layer" transform={`translate(${curLocProvince.x}, ${curLocProvince.y})`}>
            {/* Dramatik Dış Halka */}
            <circle r="15" fill="rgba(251, 191, 36, 0.3)" className="bus-outer-pulse" />
            
            {/* Araba/Otobüs İkonu (Daha İyi Detay) */}
            <g filter="url(#bus-glow)" className="bus-icon-group">
              {/* Gövde */}
              <rect x="-12" y="-7" width="24" height="14" rx="3" fill="#fbbf24" stroke="#bf8f00" strokeWidth="1" />
              {/* Camlar */}
              <rect x="-9" y="-5" width="6" height="5" fill="#1e293b" rx="1" />
              <rect x="0" y="-5" width="9" height="5" fill="#1e293b" rx="1" />
              {/* Şeritler */}
              <rect x="-12" y="1" width="24" height="2" fill="rgba(0,0,0,0.1)" />
              {/* Tekerlekler */}
              <circle cx="-7" cy="7" r="3" fill="#111" />
              <circle cx="7" cy="7" r="3" fill="#111" />
              <circle cx="-7" cy="7" r="1.5" fill="#666" />
              <circle cx="7" cy="7" r="1.5" fill="#666" />
            </g>
            
            {/* Etiket */}
            <g transform="translate(0, -22)">
              <rect x="-40" y="-8" width="80" height="16" rx="8" fill="rgba(251, 191, 36, 0.9)" />
              <text textAnchor="middle" y="3.5" fill="#000" fontWeight="900" fontSize="9" letterSpacing="0.5">PARTİ ARACI</text>
            </g>
          </g>
        )}
      </svg>

      {/* Harita Lejantı - DİNAMİK */}
      <div className="map-legend">
        {viewMode === 'votes' && (
          <div className="legend-item">
            <div className="legend-icon-wrap">
              <div className="l-circle-dot" style={{ background: '#3b82f6' }} />
            </div>
            <div className="legend-text">
              <span className="l-label">SİYASİ RENKLER</span>
              <span className="l-desc">İlde önde olan partinin rengi</span>
            </div>
          </div>
        )}

        {viewMode === 'radar' && (
          <>
            <div className="legend-item">
              <div className="legend-icon-wrap">
                <div className="l-circle-pulse" />
                <div className="l-circle-dot" />
              </div>
              <div className="legend-text">
                <span className="l-label">SON MİTİNGLER</span>
                <span className="l-desc">Meydan hareketliliği</span>
              </div>
            </div>
            <div className="legend-item">
              <div className="legend-icon-wrap">
                <div className="l-circle-dot" style={{ border: '1.5px solid white' }} />
              </div>
              <div className="legend-text">
                <span className="l-label">PARTİ KONUMLARI</span>
                <span className="l-desc">Rakiplerin anlık yerleri</span>
              </div>
            </div>
          </>
        )}

        {viewMode === 'logistics' && (
          <div className="legend-item">
            <div className="legend-icon-wrap">
               <div className="l-office-box">🏢</div>
            </div>
            <div className="legend-text">
              <span className="l-label">SEÇİM OFİSLERİ</span>
              <span className="l-desc">Kurumsal merkez binaları</span>
            </div>
          </div>
        )}

        <div className="legend-item">
          <div className="legend-icon-wrap">
             <div className="l-bus-icon">🚌</div>
          </div>
          <div className="legend-text">
            <span className="l-label">PARTİ ARACI</span>
            <span className="l-desc">Sizin anlık konumunuz</span>
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="map-tooltip"
          style={{
            left: tooltip.x + 15,
            top: tooltip.y - 10,
          }}
        >
          <div className="tooltip-header">
            <span className="tooltip-plate">{tooltip.province.plate}</span>
            <h4>{tooltip.province.name}</h4>
          </div>
          <div className="tooltip-pop">
            Nüfus: {tooltip.province.population.toLocaleString('tr-TR')}
          </div>
          <div className="tooltip-parties">
            {tooltip.topParties.map(({ party, vote }) => (
              <div key={party?.id} className="tooltip-party-row">
                <img src={party?.logo} className="tooltip-party-logo" alt="" />
                <span className="tooltip-party-name">{party?.shortName}</span>
                <span className="tooltip-party-vote">%{vote.toFixed(1)}</span>
                <div className="tooltip-bar-bg">
                  <div
                    className="tooltip-bar-fill"
                    style={{ width: `${vote}%`, background: party?.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
