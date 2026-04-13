import React, { useState } from 'react';
import './CustomPartyModal.css';

export default function CustomPartyModal({ onSave, onClose }) {
  const [formData, setFormData] = useState({
    name: '',
    shortName: '',
    abbr: '',
    leader: '',
    ideology: '',
    color: '#3b82f6',
    leftRight: 50, // 0: Sol, 100: Sağ
    logo: null
  });

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 1024 * 1024) {
        alert("Dosya boyutu çok büyük! Lütfen 1MB'dan küçük bir görsel seçin.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, logo: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.shortName || !formData.abbr || !formData.logo) {
      alert("Lütfen tüm zorunlu alanları (İsim, Kısaltma, Logo) doldurun.");
      return;
    }

    const customParty = {
      ...formData,
      id: 'custom_' + Date.now(),
      colorLight: formData.color + '88',
      colorDark: formData.color,
      initialVote: 1.0,
      description: `${formData.ideology} çizgisinde yeni bir siyasi hareket.`,
      slogan: 'Yeni bir gelecek için!',
      aiStrategy: 'balanced',
      founded: new Date().getFullYear(),
      seats: 0,
      strengths: ['marmara'],
      weaknesses: []
    };

    onSave(customParty);
  };

  return (
    <div className="custom-modal-overlay">
      <div className="custom-modal-content animate-pop">
        <div className="modal-header">
          <h2>Kendi Partini Kur</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="custom-party-form">
          <div className="form-grid">
            {/* Logo Section */}
            <div className="logo-upload-section">
              <div className="logo-preview-circle" style={{ backgroundColor: formData.color }}>
                {formData.logo ? (
                  <img src={formData.logo} alt="Logo Önizleme" />
                ) : (
                  <span className="logo-placeholder">LOGO</span>
                )}
              </div>
              <label className="upload-btn">
                Logo Yükle
                <input type="file" accept="image/*" onChange={handleLogoChange} hidden />
              </label>
            </div>

            {/* Inputs */}
            <div className="inputs-section">
              <div className="form-group">
                <label>Parti Tam Adı *</label>
                <input 
                  type="text" 
                  value={formData.name} 
                  onChange={e => setFormData(prev => ({...prev, name: e.target.value}))}
                  placeholder="Örn: Yeni Vizyon Partisi"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Kısa Ad *</label>
                  <input 
                    type="text" 
                    value={formData.shortName} 
                    onChange={e => setFormData(prev => ({...prev, shortName: e.target.value}))}
                    placeholder="Örn: Yeni Vizyon"
                  />
                </div>
                <div className="form-group">
                  <label>Kısaltma *</label>
                  <input 
                    type="text" 
                    value={formData.abbr} 
                    onChange={e => setFormData(prev => ({...prev, abbr: e.target.value}))}
                    placeholder="Örn: YVP"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Lider İsmi</label>
                <input 
                  type="text" 
                  value={formData.leader} 
                  onChange={e => setFormData(prev => ({...prev, leader: e.target.value}))}
                  placeholder="Adınız ve Soyadınız"
                />
              </div>

              <div className="form-group">
                <label>Renk Seçimi</label>
                <input 
                  type="color" 
                  value={formData.color} 
                  onChange={e => setFormData(prev => ({...prev, color: e.target.value}))}
                  className="color-input"
                />
              </div>
            </div>
          </div>

          <div className="ideology-section">
            <div className="form-group">
              <label>İdeoloji / Siyasi Çizgi</label>
              <input 
                type="text" 
                value={formData.ideology} 
                onChange={e => setFormData(prev => ({...prev, ideology: e.target.value}))}
                placeholder="Örn: Liberal Sosyalist, Muhafazakar vb."
              />
            </div>

            <div className="form-group">
              <div className="slider-labels">
                <span>SOL</span>
                <span>MERKEZ</span>
                <span>SAĞ</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={formData.leftRight} 
                onChange={e => setFormData(prev => ({...prev, leftRight: parseInt(e.target.value)}))}
                className="stance-slider"
              />
            </div>
          </div>

          <button type="submit" className="save-party-btn">Partiyi Kur ve Meydanlara İn</button>
        </form>
      </div>
    </div>
  );
}
