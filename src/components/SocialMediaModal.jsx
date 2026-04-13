import React, { useState, useEffect, useRef } from 'react';
import { getPartyById } from '../data/parties';
import './SocialMediaModal.css';

export default function SocialMediaModal({ 
  isOpen, 
  onClose, 
  posts = [], 
  stories = [],
  createPost, 
  likePost,
  shareStory,
  generateAIContent, 
  followerCount = 0,
  playerPartyId,
  currentDay,      // NEW
  lastStoryDay      // NEW
}) {
  const [activeTab, setActiveTab] = useState('feed'); // 'feed' or 'profile'
  const [showCreate, setShowCreate] = useState(false);
  const [newPostText, setNewPostText] = useState('');
  const [postType, setPostType] = useState('policy');
  const [isGenerating, setIsGenerating] = useState(false); // Loading state
  const [pendingImageUrl, setPendingImageUrl] = useState(null); // YENİ: AI tarafından seçilen pending görsel
  
  const [activeStory, setActiveStory] = useState(null);
  const [storyProgress, setStoryProgress] = useState(0);
  const [heartAnim, setHeartAnim] = useState({ active: false, x: 0, y: 0 });

  // Story Share Flow
  const [showShareChoice, setShowShareChoice] = useState(false);
  const [isManual, setIsManual] = useState(false);
  const [customStory, setCustomStory] = useState('');

  const isLimitReached = currentDay === lastStoryDay;

  const handleAutoShare = async () => {
    if (isLimitReached) return;
    setIsGenerating(true);
    try {
      const lastPlayerPost = [...posts].reverse().find(p => p.isPlayer);
      const context = lastPlayerPost ? `Son paylaşımım şuydu: "${lastPlayerPost.text}". Buna benzer veya bunu tamamlayan bir story yaz.` : "Seçmenlere genel bir selam.";
      
      const aiResult = await generateAIContent('story', context);
      if (aiResult && aiResult.text) {
        shareStory(aiResult.text, lastPlayerPost?.type || 'visit', aiResult.imageUrl);
        setShowShareChoice(false);
      }
    } catch (e) {
      console.error("AutoShare AI Error:", e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAISuggestion = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      const typeMap = {
        'policy': 'Yeni bir vaat ve halka hizmet sözü',
        'rally': 'Miting sonrası coşku ve teşekkür',
        'visit': 'Esnaf ziyareti ve halkın dertlerini dinleme',
        'attack': 'Rakiplerin vizyonsuzluğuna sert eleştiri'
      };
      const aiResult = await generateAIContent('post', typeMap[postType] || 'Genel paylaşım');
      if (aiResult) {
        setNewPostText(aiResult.text);
        setPendingImageUrl(aiResult.imageUrl);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleManualShare = () => {
    if (!customStory.trim() || isLimitReached) return;
    shareStory(customStory, 'policy');
    setCustomStory('');
    setIsManual(false);
    setShowShareChoice(false);
  };

  const storyTimerRef = useRef(null);
  const storiesRef = useRef(null); // DRAG SCROLL REF
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  // DRAG SCROLL LOGIC
  const handleMouseDown = (e) => {
    setIsDragging(true);
    setStartX(e.pageX - storiesRef.current.offsetLeft);
    setScrollLeft(storiesRef.current.scrollLeft);
  };

  const handleMouseLeave = () => setIsDragging(false);
  const handleMouseUp = () => setIsDragging(false);

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - storiesRef.current.offsetLeft;
    const walk = (x - startX) * 2; // Scroll speed
    storiesRef.current.scrollLeft = scrollLeft - walk;
  };

  useEffect(() => {
    if (activeStory) {
      setStoryProgress(0);
      storyTimerRef.current = setInterval(() => {
        setStoryProgress(prev => {
          if (prev >= 100) {
            clearInterval(storyTimerRef.current);
            setActiveStory(null);
            return 100;
          }
          return prev + 2; 
        });
      }, 100);
    } else {
      clearInterval(storyTimerRef.current);
    }
    return () => clearInterval(storyTimerRef.current);
  }, [activeStory]);

  if (!isOpen) return null;

  const handleCreate = () => {
    if (!newPostText.trim()) return;
    createPost(postType, newPostText, pendingImageUrl);
    setNewPostText('');
    setPendingImageUrl(null);
    setShowCreate(false);
  };

  const handleDoubleTap = (e, postId) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    setHeartAnim({ active: true, x, y });
    likePost(postId);
    setTimeout(() => setHeartAnim({ active: false, x: 0, y: 0 }), 800);
  };

  const playerParty = getPartyById(playerPartyId);

  return (
    <div className="insta-overlay" onClick={onClose}>
      <div className="iphone-frame" onClick={e => e.stopPropagation()}>
        <div className="iphone-screen shadow-lg">
          
          {/* Status Bar */}
          <div className="iphone-status-bar">
            <span className="time">19:27</span>
            <div className="status-icons">📶 5G 🔋</div>
          </div>

          {activeTab === 'feed' ? (
            <>
              {/* Header */}
              <div className="insta-header">
                <h1 className="insta-logo">InstaSeçim</h1>
                <div className="header-actions">
                  <span className="h-icon" onClick={() => setShowCreate(true)}>➕</span>
                  <span className="h-icon">❤️</span>
                  <span className="h-icon">💬</span>
                </div>
              </div>

              {/* Stories with Drag Scroll */}
              <div 
                className="insta-stories"
                ref={storiesRef}
                onMouseDown={handleMouseDown}
                onMouseLeave={handleMouseLeave}
                onMouseUp={handleMouseUp}
                onMouseMove={handleMouseMove}
                style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
              >
                <div className="story-item yours" onClick={() => setShowShareChoice(true)}>
                  <div className="story-circle">
                    <img src={playerParty?.logo} alt="" />
                    <span className="plus">+</span>
                  </div>
                  <span className="story-name">Sen</span>
                </div>
                {stories.map((s) => (
                  <div key={s.partyId} className="story-item" onClick={() => setActiveStory(s)}>
                    <div className="story-circle ring">
                      <img src={s.logo} alt="" />
                    </div>
                    <span className="story-name">{s.partyName}</span>
                  </div>
                ))}
              </div>

              {/* Feed */}
              <div className="insta-feed">
                {posts.length === 0 ? (
                  <div className="empty-feed">
                     <p>Henüz ralli veya paylaşım yok.</p>
                  </div>
                ) : (
                  posts.map(post => (
                    <div key={post.id} className="feed-post" onDoubleClick={(e) => handleDoubleTap(e, post.id)}>
                      <div className="post-header">
                        <img src={post.logo} className="post-author-logo" alt="" />
                        <div className="post-author-info">
                          <span className="author-name">{post.partyName}</span>
                          <span className="author-loc">Türkiye • {post.timestamp}</span>
                        </div>
                      </div>
                      
                      <div className={`post-image-area type-${post.type}`}>
                         {post.imageUrl ? (
                           <img 
                              src={post.imageUrl} 
                              className="post-main-img" 
                              alt="Post content" 
                              onError={(e) => {
                                e.target.style.display = 'none'; // Yüklenemezse gizle, placeholder kalsın
                              }}
                           />
                         ) : (
                           <div className="post-image-placeholder">
                              <div className="post-overlay-content">
                                 <span className="type-badge">{post.type?.toUpperCase()}</span>
                                 <h2>{post.partyName}</h2>
                              </div>
                           </div>
                         )}
                         {post.liked && <div className="post-heart-overlay">❤️</div>}
                      </div>

                      <div className="post-actions">
                         <div className="left-actions">
                            <span className={`act-icon ${post.liked ? 'liked' : ''}`} onClick={() => likePost(post.id)}>
                              {post.liked ? '❤️' : '🤍'}
                            </span>
                            <span className="act-icon">💬</span>
                            <span className="act-icon">✈️</span>
                         </div>
                         <span className="act-icon">🔖</span>
                      </div>

                      <div className="post-content">
                         <p className="likes-count">{post.likes.toLocaleString()} beğenme</p>
                         <p className="post-text"><b>{post.partyName}</b> {post.text}</p>
                         <p className="comments-link">{post.commentsCount || 0} yorum</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            /* Profile View */
            <div className="insta-profile animate-slide-in">
               <div className="profile-stats-row">
                  <div className="profile-avatar">
                     <img src={playerParty?.logo} alt="" />
                  </div>
                  <div className="stat-box">
                    <span className="s-val">{posts.filter(p => p.isPlayer).length}</span>
                    <span className="s-lbl">Gönderi</span>
                  </div>
                  <div className="stat-box">
                    <span className="s-val">{(followerCount / 1000).toFixed(1)}K</span>
                    <span className="s-lbl">Takipçi</span>
                  </div>
                  <div className="stat-box">
                    <span className="s-val">0</span>
                    <span className="s-lbl">Takip</span>
                  </div>
               </div>
               <div className="profile-bio">
                  <p className="p-name">{playerParty?.name}</p>
                  <p className="p-text">{playerParty?.slogan}</p>
               </div>
               <div className="profile-actions">
                  <button className="p-btn">Profili Düzenle</button>
                  <button className="p-btn">Arşiv</button>
               </div>
               <div className="profile-grid">
                  {posts.filter(p => p.isPlayer).map(p => (
                    <div key={p.id} className={`grid-item type-${p.type}`}></div>
                  ))}
               </div>
            </div>
          )}

          {/* Nav */}
          <div className="insta-nav">
             <span className={`nav-icon ${activeTab === 'feed' ? 'active' : ''}`} onClick={() => setActiveTab('feed')}>🏠</span>
             <span className="nav-icon">🔍</span>
             <span className="nav-icon">🎞️</span>
             <span className="nav-icon">❤️</span>
             <img 
               src={playerParty?.logo} 
               className={`nav-profile ${activeTab === 'profile' ? 'active' : ''}`} 
               onClick={() => setActiveTab('profile')} 
               alt=""
             />
          </div>

          {/* STORY OVERLAY - PREMIUM REWRITE */}
          {activeStory && (
            <div className="story-overlay fade-in" onClick={(e) => {
              const x = e.clientX;
              const width = window.innerWidth;
              const currentIdx = stories.findIndex(s => s.partyId === activeStory.partyId);
              if (x > width / 2) {
                // Next
                if (currentIdx < stories.length - 1) setActiveStory(stories[currentIdx + 1]);
                else setActiveStory(null);
              } else {
                // Prev
                if (currentIdx > 0) setActiveStory(stories[currentIdx - 1]);
              }
            }}>
               <div className="story-top">
                  <div className="story-progress-container multiple">
                    {stories.map((_, i) => {
                      const currentIdx = stories.findIndex(s => s.partyId === activeStory.partyId);
                      let width = "0%";
                      if (i < currentIdx) width = "100%";
                      else if (i === currentIdx) width = `${storyProgress}%`;
                      return (
                        <div key={i} className="story-progress-segment">
                          <div className="story-progress-bar" style={{ width }}></div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="story-user-info">
                     <div className="s-user-avatar">
                        <img src={activeStory.logo} alt="" />
                     </div>
                     <div className="s-user-text">
                        <span className="s-user-name">{activeStory.partyName}</span>
                        <span className="s-user-time">1s</span>
                     </div>
                     <span className="s-close" onClick={(e) => { e.stopPropagation(); setActiveStory(null); }}>✕</span>
                  </div>
               </div>
               
               <div 
                 className={`story-content premium type-${activeStory.type}`}
                 style={{ 
                   background: activeStory.imageUrl 
                     ? `url(${activeStory.imageUrl}) center/cover no-repeat` 
                     : `linear-gradient(180deg, ${getPartyById(activeStory.partyId)?.color || '#333'} 0%, #000 100%)` 
                 }}
               >
                  {/* Subtle Background Pattern instead of giant logo */}
                  <div className="story-bg-logo">
                    <img src={activeStory.logo} alt="" />
                  </div>

                  <div className="story-text-container animate-float-up">
                      <span className="story-location-badge">📍 {activeStory.provinceName}</span>
                      <h2 className="story-main-message">"{activeStory.text}"</h2>
                      <div className="story-bottom-action">Cevap ver...</div>
                  </div>
               </div>
            </div>
          )}

          {/* STORY SHARE CHOICE OVERLAY */}
          {showShareChoice && (
            <div className="share-choice-overlay fade-in">
               <div className="share-choice-card animate-float-up">
                  <div className="choice-header">
                     <h3>Hikayenle Fark Yarat</h3>
                     <span className="close" onClick={() => { setShowShareChoice(false); setIsManual(false); }}>✕</span>
                  </div>
                  
                  {!isManual ? (
                    <div className="choice-options">
                       {isLimitReached && (
                         <div className="limit-alert" style={{ color: '#ff4d4d', fontSize: '0.85rem', textAlign: 'center', marginBottom: '15px', fontWeight: 'bold' }}>
                            🛑 Bugunluk story limitiniz doldu! <br/>Yarın tekrar paylaşabilirsiniz.
                         </div>
                       )}
                       <button 
                         className={`choice-btn auto ${isGenerating ? 'loading' : ''} ${isLimitReached ? 'disabled' : ''}`} 
                         onClick={handleAutoShare}
                         disabled={isGenerating || isLimitReached}
                       >
                          <div className="icon">{isGenerating ? '🤖' : '✨'}</div>
                          <div className="text">
                             <strong>{isGenerating ? 'Grok Yazıyor...' : 'Grok ile Hazırla'}</strong>
                             <span>{isLimitReached ? 'Yarın tekrar deneyin' : 'Son aksiyonuna göre özel AI hikayesi'}</span>
                          </div>
                       </button>
                       <button 
                         className={`choice-btn manual ${isLimitReached ? 'disabled' : ''}`} 
                         onClick={() => !isLimitReached && setIsManual(true)}
                         disabled={isLimitReached}
                       >
                          <div className="icon">✍️</div>
                          <div className="text">
                             <strong>Kendin Yaz</strong>
                             <span>{isLimitReached ? 'Limit doldu' : 'Seçmenlerine doğrudan seslen'}</span>
                          </div>
                       </button>
                    </div>
                  ) : (
                    <div className="choice-manual-input">
                       <textarea 
                          placeholder="Bugün bir tarih yazmaya hazır mısın?"
                          value={customStory}
                          onChange={(e) => setCustomStory(e.target.value)}
                       />
                       <button className="send-story-btn" onClick={handleManualShare}>
                          Paylaş
                       </button>
                    </div>
                  )}
               </div>
            </div>
          )}

          {/* CREATE OVERLAY - THE BEAUTIFUL ONE */}
          {showCreate && (
            <div className="create-overlay">
               <div className="create-header">
                  <span className="close" onClick={() => setShowCreate(false)}>✕</span>
                  <h3>YENİ PAYLAŞIM</h3>
                  <span className="share" onClick={handleCreate}>Paylaş</span>
               </div>
               <div className="create-content">
                  <div className="ai-assist-box">
                     <button 
                       className={`ai-magic-btn ${isGenerating ? 'animating' : ''}`}
                       onClick={handleAISuggestion}
                       disabled={isGenerating}
                     >
                       {isGenerating ? '🤖 Grok Düşünüyor...' : '✨ Grok ile Zekice Yaz'}
                     </button>
                  </div>

                  <div className="create-preview-area">
                    {pendingImageUrl && (
                      <div className="pending-img-container">
                        <img src={pendingImageUrl} alt="AI Generated" />
                        <span className="remove-img" onClick={() => setPendingImageUrl(null)}>✕</span>
                      </div>
                    )}
                    <textarea 
                      placeholder="Seçmenlerine bir mesaj yaz veya Grok'tan yardım al..."
                      value={newPostText}
                      onChange={e => setNewPostText(e.target.value)}
                    />
                  </div>
                  
                  <div className="type-selector">
                     <p>İÇERİK TÜRÜ SEÇ</p>
                     <div className="type-grid">
                        <button className={postType === 'policy' ? 'active' : ''} onClick={() => setPostType('policy')}>
                           📜<br/>Vaat
                        </button>
                        <button className={postType === 'rally' ? 'active' : ''} onClick={() => setPostType('rally')}>
                           📢<br/>Miting
                        </button>
                        <button className={postType === 'visit' ? 'active' : ''} onClick={() => setPostType('visit')}>
                           🤝<br/>Ziyaret
                        </button>
                        <button className={postType === 'attack' ? 'active' : ''} onClick={() => setPostType('attack')}>
                           💥<br/>Eleştiri
                        </button>
                     </div>
                  </div>
                  <div className="cost-info">
                     💰 PAYLAŞIM BEDELİ: 800.000 ₺
                  </div>
               </div>
            </div>
          )}

          {/* Heart Anim */}
          {heartAnim.active && (
            <div className="floating-heart" style={{ left: heartAnim.x - 75, top: heartAnim.y - 75 }}>❤️</div>
          )}

        </div>
      </div>
    </div>
  );
}
