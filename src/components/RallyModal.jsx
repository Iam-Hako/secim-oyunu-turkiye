import React, { useState, useEffect } from 'react';
import { PROVINCES } from '../data/provinces';
import './RallyModal.css';

export default function RallyModal({ interaction, party, onTopicSubmit, onAnswer, onFinish, onClose }) {
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    setInputValue('');
  }, [interaction.subPhase, interaction.currentIndex]);

  if (!interaction.active) return null;

  const handleTopicSubmit = (e) => {
    e.preventDefault();
    if (inputValue.trim()) onTopicSubmit(inputValue);
  };

  const handleAnswerSubmit = (e) => {
    e.preventDefault();
    onAnswer(inputValue);
  };

  return (
    <div className="rally-overlay">
      <div className="rally-modal-box" style={{ '--party-color': party.color }}>
        <div className="rally-header">
          <div className="rally-live-badge">
            {interaction.subPhase === 'results' ? 'MİTİNG RAPORU' : 'CANLI YAYIN'}
          </div>
          <div className="rally-title-group">
            <h2 className="rally-title">
              {interaction.provinceId ? (PROVINCES.find(p => p.id === interaction.provinceId)?.name || 'Şehir') : 'Türkiye'} Mitingi
            </h2>
            <div className={`ai-badge ${interaction.aiStatus}`}>
              {interaction.aiStatus === 'ai' ? '🤖 Yapay Zeka Aktif' : 
               interaction.aiStatus === 'groq-ai' ? '🚀 Llama 3.3 Aktif (Groq)' :
               interaction.aiStatus === 'local-ai' ? '⚡ Yerel Zeka (Sınırsız)' : '🧠 Yedek Motor'}
            </div>
          </div>
          {interaction.subPhase === 'answering' && (
            <div className="rally-progress">Soru {interaction.currentIndex + 1} / {interaction.questions.length}</div>
          )}
          {interaction.subPhase !== 'results' && (
            <div className="rally-timer">
              <div className="timer-val">{interaction.timeLeft}s</div>
              <div className="timer-bar">
                <div className="timer-fill" style={{ width: `${(interaction.timeLeft / 30) * 100}%` }} />
              </div>
            </div>
          )}
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="rally-content">
          {interaction.isAiLoading && (
            <div className="ai-loading-step">
              <div className="ai-spinner"></div>
              <h3>Yapay Zeka Soruları Hazırlıyor...</h3>
              <p>Halkın nabzına göre en zorlu sorular kurgulanıyor.</p>
            </div>
          )}

          {!interaction.isAiLoading && interaction.subPhase === 'topic' && (
            <div className="topic-step">
              <h3 className="step-title">Vatandaş sizi bekliyor!</h3>
              <p className="step-desc">Bugün meydanda hangi konuyu ele alacaksınız? (Ekonomi, Eğitim, Sağlık, Tarım vb.)</p>
              <form onSubmit={handleTopicSubmit} className="answer-section">
                <textarea 
                  autoFocus 
                  className="answer-input" 
                  placeholder="Miting konusunu buraya yazın..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                />
                <button type="submit" className="rally-submit-btn">KONUŞMAYI BAŞLAT</button>
              </form>
            </div>
          )}

          {interaction.subPhase === 'answering' && (
            <div className="question-step">
              {/* CANLI ENERJİ GÖSTERGESİ */}
              <div className="live-energy-section">
                <div className="energy-info">
                  <span className="energy-label">Meydanın Enerjisi</span>
                  <div className="energy-stats">
                    <span className="energy-percent">{interaction.satisfaction}%</span>
                    {interaction.lastChange !== 0 && (
                      <span className={`energy-change ${interaction.lastChange > 0 ? 'plus' : 'minus'}`}>
                        {interaction.lastChange > 0 ? `+${interaction.lastChange}` : interaction.lastChange}%
                      </span>
                    )}
                  </div>
                </div>
                <div className="energy-bar-container">
                  <div 
                    className="energy-bar-fill" 
                    style={{ 
                      width: `${interaction.satisfaction}%`,
                      backgroundColor: interaction.satisfaction > 60 ? '#00ff88' : interaction.satisfaction > 30 ? '#ffcc00' : '#ff4444'
                    }} 
                  />
                  <div className="energy-bar-glow" style={{ width: `${interaction.satisfaction}%` }} />
                </div>
              </div>

              <div className="ai-host">
                <div className="host-avatar">🎙️</div>
                <div className="host-speech">
                  <p>{interaction.questions[interaction.currentIndex].text}</p>
                </div>
              </div>
              <form onSubmit={handleAnswerSubmit} className="answer-section">
                <textarea 
                  autoFocus 
                  className="answer-input" 
                  placeholder="Cevabınızı buraya yazın..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                />
                <button type="submit" className="rally-submit-btn">
                  {interaction.currentIndex === interaction.questions.length - 1 ? 'KONUŞMAYI BİTİR' : 'SIRADAKİ SORU'}
                </button>
              </form>
            </div>
          )}

          {interaction.subPhase === 'results' && (
            <div className="results-step">
              <div className="satisfaction-container">
                <div className="satisfaction-ring">
                  <svg viewBox="0 0 100 100">
                    <circle className="ring-bg" cx="50" cy="50" r="45" />
                    <circle 
                      className="ring-fill" 
                      cx="50" cy="50" r="45" 
                      style={{ strokeDasharray: `${interaction.satisfaction * 2.83} 283` }}
                    />
                  </svg>
                  <div className="ring-text">
                    <span className="ring-val">{interaction.satisfaction}%</span>
                    <span className="ring-lbl">Beğeni</span>
                  </div>
                </div>
              </div>
              <div className="result-feedback">
                {interaction.satisfaction > 70 ? "Muazzam bir hitabet! Halk sizi bağrına bastı." : 
                 interaction.satisfaction > 40 ? "Ortalama bir konuşma. Bazı kesimleri ikna ettiniz." : 
                 "Maalesef halk bu konuşmadan ikna olmadı."}
              </div>
              <button onClick={onFinish} className="rally-submit-btn">MEYDANDAN AYRIL</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
