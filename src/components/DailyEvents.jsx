import { getPartyById } from '../data/parties';
import './DailyEvents.css';

export default function DailyEvents({ 
  events, 
  aiActions, 
  currentDay, 
  onDismiss,
  dailyIncome = 0,
  dailyExpenses = 0,
  dailyBulletin = null,
  isBulletinLoading = false
}) {
  const formatMoney = (val) => new Intl.NumberFormat('tr-TR').format(Math.abs(val)) + ' ₺';

  return (
    <div className="news-overlay">
      <div className="news-container">
        <div className="news-header">
          <div className="breaking-badge">SON DAKİKA</div>
          <div className="news-title-group">
            <h2 className="news-main-title">GÜNLÜK GELİŞMELER (GÜN {60 - currentDay})</h2>
            <p className="news-date-info">Türkiye Siyaset Gündemi - Seçime {currentDay} Gün Kala</p>
          </div>
          <button className="news-close-btn" onClick={onDismiss}>GÜNÜ TAMAMLA ↵</button>
        </div>

        <div className="news-body">
          <div className="news-left-col">
            <section className="news-section events-section">
              <h3 className="section-label">ÜLKE GÜNDEMİ DETAYLARI</h3>
              <div className="events-grid">
                {events.map(event => (
                  <div key={event.id} className="event-news-card">
                    <div className="event-category">{event.category}</div>
                    <h4 className="event-title">{event.title}</h4>
                    <p className="event-desc">{event.description}</p>
                    <div className="event-effects">
                      {Object.entries(event.effects || {}).map(([rawId, effect]) => {
                        const partyId = rawId.toLowerCase().trim();
                        const party = getPartyById(partyId);
                        if (!party) return null; // Bilinmeyen partiyi gösterme (temiz UI)
                        
                        return (
                          <div key={partyId} className="effect-tag" style={{ color: party.color }}>
                            {party.abbr} {effect > 0 ? `+${effect}` : effect}%
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* AI BULLETIN SECTION - NOW BELOW */}
            <section className="news-section bulletin-section">
              <h3 className="section-label">GÜNÜN MANŞETİ & SİYASİ ANALİZ</h3>
              {isBulletinLoading ? (
                <div className="bulletin-loading-card">
                  <div className="loading-spinner"></div>
                  <p>Siyasi analiz hazırlanıyor, meydanlar taranıyor...</p>
                </div>
              ) : (
                <div className="bulletin-card animate-in">
                  <div className="bulletin-quote-icon">“</div>
                  <p className="bulletin-text">{dailyBulletin}</p>
                </div>
              )}
            </section>

            <section className="news-section budget-report-section">
              <h3 className="section-label">GÜNLÜK BÜTÇE RAPORU</h3>
              <div className="budget-report-card">
                <div className="budget-row income">
                  <span className="label">Günlük Gelir:</span>
                  <span className="val">+{formatMoney(dailyIncome)}</span>
                </div>
                <div className="budget-row expense">
                  <span className="label">Günlük Harcama:</span>
                  <span className="val">-{formatMoney(dailyExpenses)}</span>
                </div>
                <div className="budget-row net">
                  <span className="label">Net Durum:</span>
                  <span className="val" style={{ color: (dailyIncome - dailyExpenses) >= 0 ? '#4ade80' : '#ef4444' }}>
                    {formatMoney(dailyIncome - dailyExpenses)}
                  </span>
                </div>
              </div>
            </section>
          </div>

          <aside className="news-section ai-section">
            <h3 className="section-label">RAKİP FAALİYETLERİ</h3>
            <div className="ai-feed">
              {aiActions.length > 0 ? aiActions.map((action, idx) => {
                const party = getPartyById(action.partyId);
                return (
                  <div key={`${action.partyId}_${idx}`} className="ai-action-item" style={{ '--party-color': party?.color }}>
                    <div className="ai-party-icon">
                      <img src={party?.logo} alt="" />
                    </div>
                    <div className="ai-content">
                      <span className="party-name">{action.partyName}</span>
                      <p className="action-text">
                        {action.type === 'rally' && `${action.provinceName} ilinde büyük bir miting düzenledi!`}
                        {action.type === 'tv' && `Ulusal kanalda canlı yayına katılarak vaatlerini paylaştı.`}
                        {action.type === 'social_media' && `Sosyal medyada viral olan yeni bir kampanya başlattı.`}
                        {action.type === 'office' && `${action.provinceName} ilinde yeni bir stratejik merkez kurdu!`}
                      </p>
                    </div>
                  </div>
                );
              }) : (
                <div className="ai-empty">Bugün rakiplerinizden önemli bir hamle gelmedi.</div>
              )}
            </div>
          </aside>
        </div>
        
        {/* ... (news-footer remains same) */}

        <div className="news-footer">
          <div className="ticker-wrap">
            <div className="ticker">
              <span>Halk sandığa gitmek için gün sayıyor...</span>
              <span>Anket sonuçları dalgalanmaya devam ediyor...</span>
              <span>Ekonomi ve dış politika başlıkları seçimin kaderini belirleyecek...</span>
              <span>Liderler meydanlarda kozlarını paylaşıyor...</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
