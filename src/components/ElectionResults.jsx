import { useMemo } from 'react';
import { PARTIES, getPartyById } from '../data/parties';
import { PROVINCES, getLeadingParty } from '../data/provinces';
import './ElectionResults.css';

export default function ElectionResults({ state, onRestart }) {
  const results = useMemo(() => {
    if (!state) return null;

    const partySeats = {};
    const partyProvinces = {};
    PARTIES.forEach(p => {
      partySeats[p.id] = 0;
      partyProvinces[p.id] = 0;
    });

    PROVINCES.forEach(province => {
      const votes = state.provinceVotes[province.id];
      if (!votes) return;
      const winner = getLeadingParty(votes, PARTIES);
      if (winner) {
        partyProvinces[winner.id] = (partyProvinces[winner.id] || 0) + 1;
        const seats = Math.max(1, Math.round(province.population / 150000));
        partySeats[winner.id] = (partySeats[winner.id] || 0) + seats;
      }
    });

    const currentTotal = Object.values(partySeats).reduce((s, v) => s + v, 0) || 1;
    const scale = 600 / currentTotal;
    Object.keys(partySeats).forEach(k => {
      partySeats[k] = Math.round(partySeats[k] * scale);
    });

    const sortedParties = PARTIES
      .map(p => ({
        ...p,
        seats: partySeats[p.id] || 0,
        provinces: partyProvinces[p.id] || 0,
        vote: state.nationalVotes?.[p.id] || 0,
      }))
      .sort((a, b) => b.seats - a.seats);

    const winner = sortedParties[0] || PARTIES[0];
    const isPlayerWinner = winner?.id === state.playerPartyId;

    return { sortedParties, winner, isPlayerWinner };
  }, [state]);

  if (!results) return null;

  const { sortedParties, winner, isPlayerWinner } = results;
  const playerParty = getPartyById(state.playerPartyId);

  return (
    <div className="election-night-results">
      <div className="results-backdrop">
        <div className="light-beam"></div>
      </div>
      
      <div className="results-content-wrapper">
        <div className="results-header-box">
          <div className="official-seal">🗳️</div>
          <h1 className="results-title">2026 GENEL SEÇİM SONUÇLARI</h1>
          <p className="results-subtitle">Yüksek Seçim Kurulu Resmî Olmayan Sonuçları</p>
        </div>

        <div className="main-results-grid">
          {/* Winner Card */}
          <div className="winner-hero-card" style={{ '--winner-color': winner.color }}>
            <div className="winner-label">SEÇİMİN GALİBİ</div>
            <div className="winner-logo-circle">
              <img src={winner.logo} alt={winner.name} />
            </div>
            <h2 className="winner-party-name">{winner.name}</h2>
            <div className="winner-leader-row">
              <span className="leader-title">Genel Başkan</span>
              <span className="leader-name">{winner.leader}</span>
            </div>
            
            <div className="winner-metrics">
              <div className="metric">
                <span className="m-val">{winner.seats}</span>
                <span className="m-label">Milletvekili</span>
              </div>
              <div className="metric">
                <span className="m-val">%{winner.vote.toFixed(1)}</span>
                <span className="m-label">Toplam Oy</span>
              </div>
              <div className="metric">
                <span className="m-val">{winner.provinces}</span>
                <span className="m-label">İl</span>
              </div>
            </div>
          </div>

          {/* Results Table & Chart */}
          <div className="results-detail-panel">
            <div className="parliament-viz">
              <h3 className="panel-inner-title">TBMM Dağılımı</h3>
              <div className="seat-bar">
                {sortedParties.filter(p => p.seats > 0).map(party => (
                  <div
                    key={party.id}
                    className="seat-segment"
                    style={{
                      width: `${(party.seats / 600) * 100}%`,
                      background: party.color,
                    }}
                    title={`${party.shortName}: ${party.seats}`}
                  />
                ))}
              </div>
              <div className="seat-legend">
                {sortedParties.slice(0, 5).map(p => (
                  <div key={p.id} className="legend-item">
                    <span className="dot" style={{ background: p.color }} />
                    <span className="n">{p.abbr}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="scrollable-table">
              <table className="modern-table">
                <thead>
                  <tr>
                    <th>Sıra</th>
                    <th>Parti</th>
                    <th>Oy Oranı</th>
                    <th>Milletvekili</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedParties.filter(p => p.seats > 0 || p.vote > 0.5).map((party, idx) => (
                    <tr key={party.id} className={party.id === state.playerPartyId ? 'player-highlight' : ''}>
                      <td>{idx + 1}</td>
                      <td className="party-cell">
                        <img src={party.logo} alt="" className="table-logo" />
                        <span>{party.shortName}</span>
                      </td>
                      <td>%{party.vote.toFixed(1)}</td>
                      <td className="seat-cell">{party.seats}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="results-footer-actions">
          <div className="player-summary">
            {isPlayerWinner ? (
              <span className="victory-text">TEBRİKLER! İktidar artık sizin ellerinizde.</span>
            ) : (
              <span className="defeat-text">Güçlü bir kampanya yürüttünüz. Bir sonraki seçimde görüşmek üzere.</span>
            )}
          </div>
          <button className="new-game-btn" onClick={onRestart}>
            YENİ KAMPANYA BAŞLAT
          </button>
        </div>
      </div>
    </div>
  );
}
