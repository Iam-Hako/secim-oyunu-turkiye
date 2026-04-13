import React from 'react';
import './SettingsModal.css';

export default function SettingsModal({ onSave, onLoad, onRestart, onClose }) {
  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={e => e.stopPropagation()}>
        <div className="settings-header">
          <h2>HAREKAT AYARLARI</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="settings-content">
          <p className="settings-info">
            Mevcut kampanya verilerinizi kaydedebilir veya daha önce sakladığınız bir harekatı geri yükleyebilirsiniz.
          </p>
          
          <div className="settings-actions">
            <button className="settings-btn save" onClick={onSave}>
              <span className="icon">💾</span>
              <div className="btn-txt">
                <span className="main">İLERLEMEYİ KAYDET</span>
                <span className="sub">Tarayıcı hafızasına saklar</span>
              </div>
            </button>

            <button className="settings-btn load" onClick={onLoad}>
              <span className="icon">📂</span>
              <div className="btn-txt">
                <span className="main">KAYITLI OYUNU YÜKLE</span>
                <span className="sub">Son kaydınıza geri döner</span>
              </div>
            </button>

            <div className="divider"></div>

            <button className="settings-btn restart" onClick={onRestart}>
              <span className="icon">🔄</span>
              <div className="btn-txt">
                <span className="main">YENİ OYUN BAŞLAT</span>
                <span className="sub">Tüm veriler sıfırlanır</span>
              </div>
            </button>
          </div>
        </div>

        <div className="settings-footer">
          <button className="btn-back" onClick={onClose}>HAREKATA DEVAM ET</button>
        </div>
      </div>
    </div>
  );
}
