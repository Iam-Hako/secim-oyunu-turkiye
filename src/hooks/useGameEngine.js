import { useState, useCallback, useRef, useEffect } from 'react';
import { getAllParties, getPartyById } from '../data/parties';
import { PROVINCES, getProvinceById, calculateInitialVotes, getLeadingParty } from '../data/provinces';
import { getRandomEvents } from '../data/events';
import { socket } from '../services/socket';
import { getRealInternetImage } from '../data/partyGallery';

const TOTAL_DAYS = 60;
const EVENTS_PER_DAY = 3;
const RALLY_TIMER = 30; // Saniye

const API_BASE_URL = 'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent';

// --- HİPER-ÜRETKEN YEREL ZEKA AYARLARI ---
// Ekonomik Ayarlar (Gerçekçi & Pahalı Mod)
const START_BUDGET = 20000000; // 20M Giriş
const BASE_DAILY_INCOME = 300000;
const OFFICE_BUILD_COST = 12000000;
const OFFICE_INCOME = 400000;
const OFFICE_MAINTENANCE_COST = 100000; 
const RALLY_BASE_COST = 5000000; // 5M Sabit
const TRAVEL_BASE_COST = 300000; // 300k Baz
const EXTRA_ACTION_COST = 5000000;
const TV_COST = 4000000;
const SOCIAL_MEDIA_COST = 800000;

// Dinamik Maliyet Hesaplayıcıları
const getRallyCost = (provinceId) => {
  // Kullanıcı isteği: Tüm şehirler 5M
  return RALLY_BASE_COST;
};

const getTravelCost = (fromId, toId) => {
  if (fromId === toId) return 0;
  const dist = getDistance(fromId, toId);
  // Daha dengeli seyahat maliyeti
  return Math.round(TRAVEL_BASE_COST + (dist * 15000)); 
};

// AI Strateji Sabitleri
const AI_ACTION_CHANCE = 0.6;

function createInitialState(playerPartyId, multiplayerData = null) {
  const initialProvinceVotes = calculateInitialVotes(PROVINCES, getAllParties());

  const aiState = {};
  getAllParties().filter(p => p.id !== playerPartyId).forEach(p => {
    aiState[p.id] = {
      budget: START_BUDGET, // AI da 20M ile başlar
      ralliesHeld: 0,
      lastLocation: p.id === 'ak_parti' ? 6 : (p.id === 'chp' ? 34 : Math.floor(Math.random() * 81) + 1), // Başlangıç noktaları
      strategy: p.aiStrategy || 'balanced',
      momentum: 0
    };
  });

  const nationalVotes = recalcNationalVotes(initialProvinceVotes);

  return {
    playerPartyId,
    isMultiplayer: !!multiplayerData,
    roomId: multiplayerData?.id || null,
    hostId: multiplayerData?.host || null,
    roomPlayers: multiplayerData?.players || {},
    currentDay: TOTAL_DAYS,
    phase: 'playing',
    budget: START_BUDGET,
    playerLocation: 6,
    offices: { [playerPartyId]: {} },
    provinceVotes: initialProvinceVotes,
    nationalVotes: nationalVotes,
    dailyEvents: [],
    eventLog: [],
    aiState,
    aiActions: [],
    playerActions: [],
    usedEventIds: [],
    selectedProvince: null,
    ralliesThisTurn: 0,
    maxRallies: 2,
    showEvents: false,
    showSettings: false,
    lastStoryDay: 0,
    rallyInteraction: { 
      active: false, 
      subPhase: 'topic', 
      topic: '',
      questions: [], 
      currentIndex: 0, 
      responses: [],
      satisfaction: 50,
      timeLeft: RALLY_TIMER,
      provinceId: null,
      isAiLoading: false,
      aiStatus: 'local-ai',
      lastChange: 0
    },
    dailyIncome: 0,
    dailyExpenses: 0,
    posts: [], 
    stories: getAllParties().filter(p => p.id !== playerPartyId).map(p => ({
      partyId: p.id,
      partyName: p.shortName,
      logo: p.logo,
      provinceName: 'Türkiye',
      type: 'visit',
      text: 'Seçim maratonuna başladık! Hazırız.'
    })),
    followerCount: 50000, 
    socialMediaOpen: false, 
    remotePlayers: {}, // Diğer canlı oyuncuların konumları {socketId: {partyId, provinceId}}
    readyStatus: {}, // Kimler günü tamamla dedi {socketId: bool}
    allReady: false  // Herkes hazır mı?
  };
}

function recalcNationalVotes(provinceVotes) {
  const nationalVotes = {};
  getAllParties().forEach(p => { nationalVotes[p.id] = 0; });
  let totalPop = 0;
  PROVINCES.forEach(province => {
    const votes = provinceVotes[province.id];
    if (!votes) return;
    Object.entries(votes).forEach(([partyId, vote]) => {
      nationalVotes[partyId] += vote * province.population;
    });
    totalPop += province.population;
  });
  Object.keys(nationalVotes).forEach(partyId => {
    nationalVotes[partyId] /= totalPop;
  });
  return nationalVotes;
}

function getDistance(id1, id2) {
  const p1 = PROVINCES.find(p => p.id === id1);
  const p2 = PROVINCES.find(p => p.id === id2);
  if (!p1 || !p2) return 100;
  const dx = p1.cx - p2.cx;
  const dy = p1.cy - p2.cy;
  return Math.sqrt(dx * dx + dy * dy);
}

// Oy dağılımını güncelle
function applyVoteChange(provinceVotes, provinceId, partyId, amount) {
  const newVotes = { ...provinceVotes };
  const pVotes = { ...newVotes[provinceId] };

  pVotes[partyId] = Math.max(0.1, (pVotes[partyId] || 0) + amount);

  const others = Object.keys(pVotes).filter(k => k !== partyId);
  const othersTotal = others.reduce((s, k) => s + pVotes[k], 0);
  const targetOthersTotal = 100 - pVotes[partyId];

  if (othersTotal > 0 && targetOthersTotal > 0) {
    const scale = targetOthersTotal / othersTotal;
    others.forEach(k => {
      pVotes[k] = Math.max(0.1, pVotes[k] * scale);
    });
  }

  const total = Object.values(pVotes).reduce((s, v) => s + v, 0);
  Object.keys(pVotes).forEach(k => {
    pVotes[k] = (pVotes[k] / total) * 100;
  });

  newVotes[provinceId] = pVotes;
  return newVotes;
}

// AI sırasını çalıştır (Stratejik, Bütçe ve Mesafe Odaklı)
function runAIActions(state) {
  let newVotes = { ...state.provinceVotes };
  Object.keys(newVotes).forEach(k => { newVotes[k] = { ...newVotes[k] }; });
  
  const aiActions = [];
  const newAIState = { ...state.aiState };
  const newOffices = { ...state.offices };

  // Çok oyunculu modda diğer oyuncuların partilerini AI kontrolünden çıkar
  const remotePlayerPartyIds = Object.values(state.remotePlayers || {}).map(p => p.partyId);
  const excludedParties = [state.playerPartyId, ...remotePlayerPartyIds];

  getAllParties()
    .filter(p => !excludedParties.includes(p.id)) // Gerçek oyuncuları atla
    .forEach(party => {
    const ai = { ...newAIState[party.id] };
    if (!ai || ai.budget < 1000000) return; // Parası biten AI yatar

    if (Math.random() > AI_ACTION_CHANCE) return;

    const partyOffices = newOffices[party.id] || {};
    
    // 1. Ofis İnşası (Para bolsa - Sabit 12M)
    if (ai.budget >= OFFICE_BUILD_COST && Math.random() < 0.2) {
      const targetProv = PROVINCES
        .filter(p => !partyOffices[p.id])
        .sort((a, b) => b.population - a.population)[0];
      
      if (targetProv) {
        ai.budget -= OFFICE_BUILD_COST;
        newOffices[party.id] = { ...partyOffices, [targetProv.id]: 1 };
        aiActions.push({ type: 'office', partyId: party.id, partyName: party.shortName, provinceName: targetProv.name, color: party.color });
      }
    }

    // 2. Miting ve Seyahat Konvoyu (Dinamik Maliyet)
    // AI en güçlü olduğu VEYA en ucuz miting yapabileceği yerleri seçer
    const affordableProvinces = PROVINCES.filter(p => {
       const rallyC = getRallyCost(p.id);
       const travelC = ai.lastLocation ? getTravelCost(ai.lastLocation, p.id) : 0;
       return (rallyC + travelC) <= ai.budget;
    });

    if (affordableProvinces.length > 0 && Math.random() < 0.7) {
      const targetProv = affordableProvinces[Math.floor(Math.random() * affordableProvinces.length)];
      const rallyCost = getRallyCost(targetProv.id);
      const travelCost = ai.lastLocation ? getTravelCost(ai.lastLocation, targetProv.id) : 0;
      const totalCost = rallyCost + travelCost;

      ai.budget -= totalCost;
      ai.lastLocation = targetProv.id;
      
      const boost = 0.4 + Math.random() * 0.5;
      newVotes = applyVoteChange(newVotes, targetProv.id, party.id, boost);
      ai.ralliesHeld += 1;

      aiActions.push({ 
        type: 'rally', 
        partyId: party.id, 
        partyName: party.shortName, 
        provinceName: targetProv.name, 
        color: party.color 
      });
    }

    // 3. Medya (Sabitler)
    if (ai.budget >= TV_COST && Math.random() < 0.1) {
      ai.budget -= TV_COST;
      PROVINCES.forEach(p => { newVotes = applyVoteChange(newVotes, p.id, party.id, 0.05); });
      aiActions.push({ type: 'tv', partyId: party.id, partyName: party.shortName, color: party.color });
    }

    newAIState[party.id] = ai;
  });

  return { newVotes, aiActions, newAIState, newOffices };
}

// --- HİPER-ÜRETKEN YEREL ZEKA MOTORU (Sınırsız ve Şeffaf) ---

const norm = (s) => {
  if (!s) return "";
  return s.toLowerCase()
    .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u')
    .replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .trim();
};

const cleanUserInput = (text) => {
  if (!text) return "Genel Türkiye Gündemi";
  const stops = [
    "bugün", "konuşalım", "konuşacağız", "bahsedelim", "ele alacağız", "yapılacaklar", 
    "vaatlerimiz", "planlarımız", "hakkında", "konusu", "meselesi", "ilgili", "dair",
    "yapacağız", "edeceğiz", "söyleyeceğiz"
  ];
  let cleaned = text.toLowerCase().trim();
  stops.forEach(s => {
    const regex = new RegExp(`\\b${s}\\b`, 'g');
    cleaned = cleaned.replace(regex, "");
  });
  return cleaned.replace(/\s\s+/g, ' ').trim() || "Genel Türkiye Gündemi";
};

// --- GROQ (LLAMA 3.1) GERÇEK YAPAY ZEKA MOTORU ---
async function fetchGroqQuestions(topicRaw, leaderName, partyName, partyContext) {
  try {
    const prompt = `Sen bir Türkiye Seçim Simülasyonu oyununda 'Miting Meydanı' Analizcisisin.
Oyuncu şu an ${partyName} lideri ${leaderName} olarak konuşuyor.
PARTİ KİMLİĞİ: ${partyContext.ideology} bir parti olan ${partyName}, ${partyContext.description} Sloganı: "${partyContext.slogan}".

Oyuncunun miting konusu: "${topicRaw}".

Lütfen aşağıdaki özelliklere sahip 3 farklı soru üret:
1. Soru (DESTEKÇİ): Partinin ${partyContext.ideology} çizgisine sadık, oyuncuya güvenen ama somut vaat bekleyen bir partili.
2. Soru (KARARSIZ): "Siz ${partyContext.ideology} olduğunuzu söylüyorsunuz ama..." diyerek partinin vizyonuyla halkın gerçek dertlerini (kira, enflasyon vb.) karşılaştıran vatandaş.
3. Soru (MUHALİF): Partinin geçmişine veya ideolojisindeki çelişkilere vurgu yapan, çok sert ve terleten gazeteci/trol.

ÖNEMLİ KURALLAR:
- Partinin kimliğini (İdeolojisini ve sloganını) bilerek soru sor. Saçma ve generik sorulardan kaçın.
- Eğer konu çok kısıtlıysa, partinin ideolojisiyle ters düşen bir güncel sorunu (Örn: Sol parti ise işçi hakları, sağ parti ise muhafazakar değerler) masaya yatır.
- Yanıtını SADECE aşağıdaki JSON dizisi olarak ver:
[
  { "text": "Persona İsim: Soru metni", "keywords": ["cevapta", "aranacak", "kelimeler"] },
  { "text": "Persona İsim: Soru metni", "keywords": ["kelime1"] },
  { "text": "Persona İsim: Soru metni", "keywords": ["kelime2"] }
]`;

    // --- HYBRID AI FETCH (Local & Production Support) ---
    let data;
    const localKey = import.meta.env.VITE_GROQ_API_KEY;

    if (localKey) {
      // LOCAL DEVELOPMENT: Direct Groq Call
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localKey}`
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.8,
          response_format: { type: "json_object" }
        })
      });
      data = await response.json();
    } else {
      // PRODUCTION: Secure Proxy Call
      const response = await fetch('/api/generateContent', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt })
      });
      data = await response.json();
    }

    if (data.error) throw new Error(data.error);
    let content = data?.choices?.[0]?.message?.content || "{}";
    
    // Markdown bloklarını (```json ... ```) ve başındaki/sonundaki boşlukları temizle
    content = content.replace(/```json/g, "").replace(/```/g, "").trim();
    
    // Eğer YZ başında metinle ("İşte sorular:") başladıysa, ilk '{' veya '[' karakterini bul
    const firstBrace = content.indexOf('{');
    const firstBracket = content.indexOf('[');
    let startIndex = -1;
    
    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) startIndex = firstBrace;
    else if (firstBracket !== -1) startIndex = firstBracket;
    
    if (startIndex !== -1) {
      const lastBrace = content.lastIndexOf('}');
      const lastBracket = content.lastIndexOf(']');
      const endIndex = Math.max(lastBrace, lastBracket);
      if (endIndex !== -1) {
        content = content.substring(startIndex, endIndex + 1);
      }
    }

    const parsed = JSON.parse(content);
    
    // JSON bazen doğrudan dizi, bazen 'questions' anahtarı altında gelebilir
    let questions = Array.isArray(parsed) ? parsed : (parsed.questions || Object.values(parsed).find(v => Array.isArray(v)));
    
    if (!questions || questions.length === 0) {
      throw new Error("Yapay Zeka geçerli bir soru dizisi üretemedi. Lütfen tekrar deneyin.");
    }

    return questions.map(q => ({
      text: q.text || "Yapay Zeka soru metni oluşturamadı.",
      keywords: Array.isArray(q.keywords) ? q.keywords : ["turkiye", "hizmet"]
    })).slice(0, 3);
  } catch (error) {
    console.error("Groq Hatası, Yerel Zekaya Dönülüyor:", error);
    throw error;
  }
}

export function useGameEngine() {
  // Başlangıçta localStorage'da kayıtlı oyun varsa onu yükle
  const [state, setState] = useState(() => {
    const saved = localStorage.getItem('secim_oyunu_save_v1');
    return saved ? JSON.parse(saved) : null;
  });

  // Her state değişiminde otomatik kaydet
  useEffect(() => {
    if (state) {
      localStorage.setItem('secim_oyunu_save_v1', JSON.stringify(state));
    } else {
      localStorage.removeItem('secim_oyunu_save_v1');
    }
  }, [state]);

  const usedEventIdsRef = useRef([]);
  const timerRef = useRef(null);

  // AI SOCIAL CONTENT GENERATOR (Bundle)
  const generateSocialContent = useCallback(async (isInitial = false, overrideId = null) => {
    try {
      const activePid = overrideId || state?.playerPartyId || 'none';
      
      const targetParties = getAllParties().filter(p => String(p.id).toLowerCase() !== String(activePid).toLowerCase());

      const prompt = `Sen 2026 yılında geçen Türkiye Seçim Simülasyonu oyununda profesyonel bir 'Siyaset İletişimi Uzmanısın'. 
Seçime ${state?.currentDay || 60} gün var. Aşağıdaki partiler için Türk Siyaset Jargonuna %100 UYGUN içerikler üret.

EKONOMİK DURUM: 
- Yıl 2026, Dolar 30-40 TRY bandında. Halkın derdi geçim. Asla "Dolar 14 TL" deme.

İTTİFAK DENGELERİ:
- AKP ve MHP (Cumhur İttifakı) müttefiktir. Birbirlerine asla saldırmazlar. MHP, AKP'ye destek verir. İkisi de muhalefeti (CHP vb.) eleştirir.

KURALLAR:
1. "Kaybettiler" gibi kesin geçmiş zaman kullanma, seçim sürüyor.
2. Her parti için bir 'post' ve bir 'story' metni üret. 
3. Yanıtı SADECE aşağıdaki JSON formatında, parantez içindeki ID'leri ANAHTAR (key) yaparak ver. (ID'leri KÜÇÜK HARF kullan).

PARTİ LİSTESİ:
${targetParties.map(p => `- ${p.shortName} (ID: ${p.id}, İdeoloji: ${p.ideology})`).join('\n')}

ÖRNEK YANIT FORMATI:
{
  "akp": { "post": "Hizmet siyasetiyle Türkiye Yüzyılı'na!", "story": "Meydanlar dolup taşıyor.", "type": "rally" },
  "mhp": { "post": "Cumhur İttifakı ile sarsılmaz yarınlara!", "story": "Ankara kalesi sapasağlam.", "type": "visit" }
}

DİKKAT: JSON dışında hiçbir açıklama yapma. Her partinin kendi ID'sini anahtar olarak kullan.`;

      let data;
      const localKey = import.meta.env.VITE_GROQ_API_KEY;
      const chatOptions = {
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: "Sen bir Türk siyasetçisisin. Yanıtlarını sadece JSON olarak ver." },
          { role: "user", content: prompt }
        ],
        temperature: 0.8,
        response_format: { type: "json_object" }
      };

      if (localKey) {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localKey}` },
          body: JSON.stringify(chatOptions)
        });
        if (!response.ok) throw new Error("Groq API error");
        data = await response.json();
      } else {
        const response = await fetch('/api/generateContent', {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, options: chatOptions })
        });
        if (!response.ok) throw new Error("Internal API error");
        data = await response.json();
      }

      const results = JSON.parse(data?.choices?.[0]?.message?.content || "{}");
      const aiPosts = [];
      const aiStories = [];

      getAllParties().forEach(p => {
        if (String(p.id).toLowerCase() === String(activePid).toLowerCase()) return;

        // More aggressive key matching
        const res = results[p.id] || results[p.id.toLowerCase()] || results[Object.keys(results).find(k => k.toLowerCase() === p.id.toLowerCase())] || {};
        
        if (!res.post && !res.story) return; // Sadece Groq'tan veri gelirse ilerle

        const ai = state?.aiState[p.id] || {};
        const prov = PROVINCES.find(pr => pr.id === ai.lastLocation);
        const likesCount = Math.floor(Math.random() * 20000) + 5000;

        if (!isInitial && res.post) {
          aiPosts.push({
            id: Math.random(),
            partyId: p.id,
            partyName: p.shortName,
            logo: p.logo,
            text: res.post,
            imageUrl: getRealInternetImage(p.id, res.type), // İnternetten gerçek foto çek
            type: res.type || 'visit',
            likes: likesCount,
            shares: Math.floor(likesCount/10),
            commentsCount: Math.floor(likesCount/25),
            day: state?.currentDay,
            timestamp: "11:00",
            isPlayer: false
          });
        }

        if (res.story) {
          aiStories.push({
            partyId: p.id,
            partyName: p.shortName,
            logo: p.logo,
            provinceName: prov?.name || 'Türkiye',
            type: res.type || 'visit',
            text: res.story,
            imageUrl: getRealInternetImage(p.id, res.type) // İnternetten gerçek foto çek
          });
        }
      });

      return { aiPosts, aiStories };
    } catch (e) {
      console.warn("AI Social Error:", e);
      return { aiPosts: [], aiStories: [] };
    }
  }, [state?.currentDay, state?.playerPartyId, state?.aiState]);

  // PLAYER AI GENERATOR
  const generatePlayerSocialAI = useCallback(async (type, context = "") => {
    try {
      if (!state) return null;
      const playerParty = getAllParties().find(p => p.id === state.playerPartyId);
      const currentLocation = PROVINCES.find(p => p.id === state.playerLocation);
      
      const prompt = `Sen ${playerParty.name} (${playerParty.shortName}) Genel Başkanısın. 
Şu an ${currentLocation.name} şehrindesin. İdeolojin: ${playerParty.ideology}.
İstek: ${type === 'story' ? 'Instagram Story' : 'Instagram Post'} metni üret. 
Konu/Bağlam: ${context || 'Genel seçim çalışması ve halkla kucaklaşma'}.

Kurallar:
- Maksimum ${type === 'story' ? '12' : '25'} kelime.
- Karizmatik, iddialı ve siyasi jargonlu olsun.
- Emoji ve hashtag ekle.
- SADECE aşağıdaki JSON formatında yanıt ver (Başka metin ekleme):
{
  "text": "Buraya post metni gelecek",
  "keywords": "internet araması için 3 adet İngilizce virgülle ayrılmış kelime (Örn: politics, rally, crowd)"
}
`;

      const localKey = import.meta.env.VITE_GROQ_API_KEY;
      const chatOptions = {
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.9
      };

      let data;
      if (localKey) {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localKey}` },
          body: JSON.stringify(chatOptions)
        });
        data = await response.json();
      } else {
        const response = await fetch('/api/generateContent', {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, options: chatOptions })
        });
        data = await response.json();
      }

      let content = data?.choices?.[0]?.message?.content || "";
      // JSON temizliği (bazı AI'lar ```json ... ``` ekler)
      content = content.replace(/```json/g, "").replace(/```/g, "").trim();
      
      try {
        const parsed = JSON.parse(content);
        const imageUrl = getRealInternetImage(state?.playerPartyId || 'akp', type);
        
        return {
          text: parsed.text || "Seçim maratonu devam ediyor!",
          imageUrl: imageUrl
        };
      } catch (e) {
        // Parse hatası olursa fallback
        return {
          text: content.replace(/"/g, ''),
          imageUrl: `https://loremflickr.com/800/800/politics,election`
        };
      }
    } catch (e) {
      console.error("Player AI Error:", e);
      return null;
    }
  }, [state?.playerPartyId, state?.playerLocation]);
  
  // DAILY BULLETIN GENERATOR
  const generateDailyBulletinAI = useCallback(async (dayData) => {
    try {
      const { day, playerActions, aiActions, events, playerPartyId } = dayData;
      const playerParty = getAllParties().find(p => p.id === playerPartyId);
      
      const prompt = `Sen Türkiye'nin en saygın siyasi analiz yazarlarından birisin. 
Seçime ${day} gün kaldı. Bugünün siyasi özetini "Meydan Gazetesi" için yazıyorsun.

GÜNÜN VERİLERİ:
- Oyuncunun Hamleleri (${playerParty.shortName}): ${JSON.stringify(playerActions)}
- Rakiplerin Hamleleri: ${JSON.stringify(aiActions)}
- Ülke Geneli Olaylar: ${JSON.stringify(events.map(e => e.title))}

GÖREV:
Yukarıdaki verileri analiz et ve sanki o gün gerçekten yaşanmış gibi tutarlı, heyecanlı ve gerçekçi bir başyazı/bülten yaz.
- Oyuncunun ve rakiplerin hamlelerini birbiriyle ilişkilendir (Örn: "Cevap gecikmedi", "Hamleyi kırmak için Z şehrine gitti").
- Olayların halk üzerindeki etkisini dile getir.
- Maksimum 80 kelime.
- Karizmatik ve tarafsız bir analiz dili kullan.
- En sonda iddialı bir slogan/manşetle bitir.

SADECE Türkçe metni döndür (JSON değil).
`;

      const localKey = import.meta.env.VITE_GROQ_API_KEY;
      const chatOptions = {
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.8
      };

      let data;
      if (localKey) {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localKey}` },
          body: JSON.stringify(chatOptions)
        });
        data = await response.json();
      } else {
        const response = await fetch('/api/generateContent', {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, options: chatOptions })
        });
        data = await response.json();
      }

      return data?.choices?.[0]?.message?.content || "Seçim maratonunda kritik bir gün daha geride kaldı. Meydanlar hareketli...";
    } catch (e) {
      console.error("Bulletin AI Error:", e);
      return "Siyasetin nabzı yüksek! Liderler arasındaki amansız yarış tüm hızıyla devam ediyor.";
    }
  }, []);

  // AI EVENTS GENERATOR
  const generateAIEvents = useCallback(async (day, playerActions, aiActions, playerPartyId) => {
    try {
      const playerParty = getAllParties().find(p => p.id === playerPartyId);
      const prompt = `Sen 2026 yılında geçen Türkiye siyaset simülasyonu için "Günlük Olay" motorusun. 
Seçime ${day} gün kaldı. 

KESİN KURALLAR:
1. EKONOMİ: Yıl 2026. Dolar kuru 30-40 TRY bandında. (Kesinlikle 14-15 TL gibi eski rakamlar kullanma!).
2. SİYASET: AKP ve MHP müttefiktir (Cumhur İttifakı). MHP lideri asla "AKP oy kaybetmeli" demez, aksine ittifakın başarısını savunur.
3. FORMAT: Sadece 3 adet haber üret. Parti ID'leri KESİNLİKLE KÜÇÜK HARF olmalı (akp, chp, mhp...).
4. ETKİLER: +0.5 ile -1.5 arasında mantıklı etkiler ver.

SADECE aşağıdaki formatta bir JSON dizisi döndür:
[
  {
    "id": "ai_e1",
    "category": "EKONOMI",
    "title": "Haber Başlığı",
    "description": "Detaylı haber metni",
    "effects": { "akp": -0.5, "chp": 0.3 }
  }
]
`;

      const localKey = import.meta.env.VITE_GROQ_API_KEY;
      const chatOptions = {
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        response_format: { type: "json_object" }
      };

      let data;
      if (localKey) {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localKey}` },
          body: JSON.stringify(chatOptions)
        });
        data = await response.json();
      } else {
        const response = await fetch('/api/generateContent', {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, options: chatOptions })
        });
        data = await response.json();
      }

      const content = data?.choices?.[0]?.message?.content || "[]";
      let parsed = JSON.parse(content);
      if (parsed.events) parsed = parsed.events;
      if (!Array.isArray(parsed)) parsed = [parsed];
      
      return parsed.slice(0, 3);
    } catch (e) {
      console.error("AI Events Error:", e);
      return [];
    }
  }, []);

  const startGame = useCallback((playerPartyId, multiplayerData = null) => {
    const initialState = createInitialState(playerPartyId, multiplayerData);
    usedEventIdsRef.current = [];
    setState(initialState);

    // Trigger initial AI content for Day 60 immediately
    setTimeout(() => {
      generateSocialContent(true, playerPartyId).then(({ aiStories }) => {
        setState(curr => curr ? { ...curr, stories: aiStories } : curr);
      });
    }, 1000);
  }, [generateSocialContent]);

  const shareStory = useCallback((text, type = 'visit', imageUrl = null) => {
    setState(prev => {
      if (!prev) return prev;
      
      // GÜNLÜK LİMİT KONTROLÜ
      if (prev.lastStoryDay === prev.currentDay) {
        alert("Günde sadece 1 story paylaşabilirsiniz! Yarın tekrar deneyin. ⏳");
        return prev;
      }

      const playerParty = getAllParties().find(p => p.id === prev.playerPartyId);
      const newStory = {
        partyId: prev.playerPartyId,
        partyName: playerParty?.shortName || 'Sen',
        logo: playerParty?.logo,
        provinceName: PROVINCES.find(p => p.id === prev.playerLocation)?.name || 'Türkiye',
        type: type,
        text: text,
        imageUrl: imageUrl,
        isPlayer: true
      };

      // MULTIPLAYER SYNC
      if (prev.isMultiplayer && prev.roomId) {
        socket.emit('playerAction', {
          roomId: prev.roomId,
          actionData: { 
            type: 'story', 
            ...newStory 
          }
        });
      }
      
      return {
        ...prev,
        lastStoryDay: prev.currentDay, 
        stories: [newStory, ...prev.stories]
      };
    });
  }, []);


  // Seyahat Et (Dinamik & Pahalı)
  const travelTo = useCallback((provinceId) => {
    setState(prev => {
      if (!prev || prev.phase !== 'playing') return prev;
      
      const cost = getTravelCost(prev.playerLocation, provinceId);
      
      if (prev.budget < cost) {
        alert("Bütçe yetersiz! Bu seyahatin maliyeti: " + cost.toLocaleString() + " ₺");
        return prev;
      }

      return {
        ...prev,
        budget: prev.budget - cost,
        playerLocation: provinceId,
        selectedProvince: provinceId,
        dailyExpenses: prev.dailyExpenses + cost
      };
    });
  }, []);

  // Ofis İnşa Et
  const buildOffice = useCallback(() => {
    setState(prev => {
      const provinceId = prev.selectedProvince;
      const playerPartyId = prev.playerPartyId;
      if (!prev || !provinceId || prev.phase !== 'playing') return prev;
      
      if (prev.playerLocation !== provinceId) {
        alert("Sadece bulunduğunuz şehirde ofis kurabilirsiniz!");
        return prev;
      }
      
      if (prev.budget < OFFICE_BUILD_COST) {
        alert("Bütçe yetersiz! Ofis maliyeti: " + OFFICE_BUILD_COST.toLocaleString() + " ₺");
        return prev;
      }

      const partyOffices = prev.offices[playerPartyId] || {};
      const currentLvl = partyOffices[provinceId] || 0;
      return {
        ...prev,
        budget: prev.budget - OFFICE_BUILD_COST,
        offices: { 
          ...prev.offices, 
          [playerPartyId]: { ...partyOffices, [provinceId]: currentLvl + 1 }
        },
        dailyExpenses: prev.dailyExpenses + OFFICE_BUILD_COST
      };
    });
  }, []);

  // Ekstra Aksiyon Al
  const buyActionPoint = useCallback(() => {
    setState(prev => {
      if (!prev || prev.budget < EXTRA_ACTION_COST) return prev;
      return {
        ...prev,
        budget: prev.budget - EXTRA_ACTION_COST,
        maxRallies: prev.maxRallies + 1,
        dailyExpenses: prev.dailyExpenses + EXTRA_ACTION_COST
      };
    });
  }, []);

  // Mitingi Başlat
  const startRallyInteraction = useCallback((provinceId) => {
    setState(prev => {
      if (!prev || prev.phase !== 'playing' || prev.ralliesThisTurn >= prev.maxRallies) return prev;
      if (prev.playerLocation !== provinceId) return prev;
      
      const cost = getRallyCost(provinceId);
      if (prev.budget < cost) {
        alert(`Bütçe yetersiz! ${PROVINCES.find(p => p.id === provinceId)?.name} mitingi için ${cost.toLocaleString()} ₺ gerekiyor.`);
        return prev;
      }

      return {
        ...prev,
        phase: 'rally_interaction',
        rallyInteraction: { 
          ...prev.rallyInteraction,
          active: true, 
          subPhase: 'topic', 
          provinceId,
          timeLeft: RALLY_TIMER,
          currentIndex: 0,
          responses: [],
          topic: ''
        }
      };
    });

    if (state?.isMultiplayer) {
      socket.emit('playerAction', { 
        roomId: state.roomId, 
        actionData: { type: 'rally', provinceId, partyId: state.playerPartyId } 
      });
    }
  }, [state?.isMultiplayer, state?.roomId, state?.playerPartyId]);

  // Konu Belirle ve Groq (Llama 3.3) İle Soruları Üret
  const submitRallyTopic = useCallback(async (topicText) => {
    if (!state) return;
    
    setState(prev => ({
      ...prev,
      rallyInteraction: { 
        ...prev.rallyInteraction, 
        isAiLoading: true, 
        topic: topicText,
        satisfaction: 50
      }
    }));

    try {
      const playerParty = getAllParties().find(p => p.id === state.playerPartyId);
      const leaderName = playerParty?.leader || "Başkan";
      const partyName = playerParty?.name || "Parti";
      const partyContext = {
        ideology: playerParty?.ideology || "Genel Siyasi",
        description: playerParty?.description || "",
        slogan: playerParty?.slogan || ""
      };

      const questions = await fetchGroqQuestions(topicText, leaderName, partyName, partyContext);
      
      setState(prev => ({
        ...prev,
        rallyInteraction: {
          ...prev.rallyInteraction,
          subPhase: 'answering',
          questions,
          currentIndex: 0,
          isAiLoading: false,
          aiStatus: 'groq-ai'
        }
      }));
    } catch (e) {
      console.error("AI Hatası:", e);
      setState(prev => ({
        ...prev,
        rallyInteraction: {
          ...prev.rallyInteraction,
          isAiLoading: false
        }
      }));
      alert("Halkın sesini şu an duyamıyoruz (Hata: " + e.message + "). Lütfen tekrar deneyin.");
    }
  }, [state?.playerPartyId, state?.phase]);
  const submitRallyAnswer = useCallback((answerText) => {
    setState(prev => {
      if (!prev || !prev.rallyInteraction.active) return prev;

      const ri = prev.rallyInteraction;
      const q = ri.questions[ri.currentIndex];
      const rallyCost = getRallyCost(ri.provinceId);
      
      // Dinamik Analiz Motoru
      let score = 0.3;
      const text = norm(answerText);
      const topicWords = norm(ri.topic).split(' ').filter(w => w.length > 3);
      
      // KORUMA: Keywords dizisi yoksa veya bozuksa çökmesini engelle
      const keywords = Array.isArray(q?.keywords) ? q.keywords : [];
      
      keywords.forEach(kw => { if (text.includes(norm(kw))) score += 0.2; });
      topicWords.forEach(tw => { if (text.includes(tw)) score += 0.1; });
      if (text.length > 60) score += 0.2;
      
      const newResponses = [...ri.responses, score];
      const isLast = ri.currentIndex >= ri.questions.length - 1;

      const currentAvg = Math.min(100, Math.round((newResponses.reduce((a, b) => a + b, 0) / newResponses.length) * 100));

      if (isLast) {
        let boostAmount = ( (currentAvg / 100) - 0.4) * 1.5; 
        if (prev.offices[ri.provinceId]) boostAmount *= 1.3;

        let newVotes = applyVoteChange(prev.provinceVotes, ri.provinceId, prev.playerPartyId, boostAmount);
        
        return {
          ...prev,
          provinceVotes: newVotes,
          nationalVotes: recalcNationalVotes(newVotes),
          budget: prev.budget - rallyCost,
          ralliesThisTurn: prev.ralliesThisTurn + 1,
          dailyExpenses: prev.dailyExpenses + rallyCost,
          playerActions: [...prev.playerActions, { 
            type: 'rally', 
            provinceName: PROVINCES.find(p => p.id === ri.provinceId)?.name,
            day: prev.currentDay 
          }],
          rallyInteraction: {
            ...ri,
            subPhase: 'results',
            responses: newResponses,
            satisfaction: currentAvg,
            lastChange: currentAvg - ri.satisfaction
          }
        };
      } else {
        return {
          ...prev,
          rallyInteraction: {
            ...ri,
            currentIndex: ri.currentIndex + 1,
            responses: newResponses,
            satisfaction: currentAvg,
            lastChange: currentAvg - ri.satisfaction,
            timeLeft: RALLY_TIMER
          }
        };
      }
    });
  }, []);

  const finishRally = useCallback(() => {
    setState(prev => ({
      ...prev,
      phase: 'playing',
      rallyInteraction: { ...prev.rallyInteraction, active: false }
    }));
  }, []);


  const tvAppearance = useCallback(() => {
    setState(prev => {
      if (!prev || prev.phase !== 'playing' || prev.ralliesThisTurn >= prev.maxRallies) return prev;
      if (prev.budget < TV_COST) return prev; // TV pahalı

      let newVotes = { ...prev.provinceVotes };
      Object.keys(newVotes).forEach(k => { newVotes[k] = { ...newVotes[k] }; });
      PROVINCES.forEach(p => { newVotes = applyVoteChange(newVotes, p.id, prev.playerPartyId, 0.25); });

      return {
        ...prev,
        budget: prev.budget - TV_COST,
        provinceVotes: newVotes,
        nationalVotes: recalcNationalVotes(newVotes),
        ralliesThisTurn: prev.ralliesThisTurn + 1,
        dailyExpenses: prev.dailyExpenses + TV_COST,
        playerActions: [...prev.playerActions, { type: 'tv', day: prev.currentDay }]
      };
    });
  }, []);

  const toggleSocialMedia = useCallback(() => {
    setState(prev => ({ ...prev, socialMediaOpen: !prev.socialMediaOpen }));
  }, []);

  const likePost = useCallback((postId) => {
    setState(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        posts: prev.posts.map(p => {
          if (p.id === postId) {
            const isAlreadyLiked = p.liked;
            return {
              ...p,
              liked: !isAlreadyLiked,
              likes: isAlreadyLiked ? p.likes - 1 : p.likes + 1
            };
          }
          return p;
        })
      };
    });
  }, []);

  const createPost = useCallback((type, message, imageUrl = null) => {
    setState(prev => {
      if (!prev || prev.phase !== 'playing' || prev.ralliesThisTurn >= prev.maxRallies) return prev;
      if (prev.budget < SOCIAL_MEDIA_COST) {
        alert("Bütçe yetersiz! Paylaşım maliyeti: " + SOCIAL_MEDIA_COST.toLocaleString() + " ₺");
        return prev;
      }

      const playerParty = getAllParties().find(p => p.id === prev.playerPartyId);
      const likes = Math.floor(Math.random() * 50000) + 10000;
      const shares = Math.floor(likes / 10);
      
      const newPost = {
        id: Date.now(),
        partyId: prev.playerPartyId,
        partyName: playerParty?.shortName,
        logo: playerParty?.logo,
        text: message,
        imageUrl: imageUrl,
        type: type, 
        likes,
        shares,
        commentsCount: Math.floor(likes / 25),
        day: prev.currentDay,
        timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
        isPlayer: true
      };

      // MULTIPLAYER SYNC
      if (prev.isMultiplayer && prev.roomId) {
        socket.emit('playerAction', {
          roomId: prev.roomId,
          actionData: { 
            type: 'post', 
            ...newPost 
          }
        });
      }

      let newVotes = { ...prev.provinceVotes };
      Object.keys(newVotes).forEach(k => { newVotes[k] = { ...newVotes[k] }; });
      
      let followerBoost = Math.floor(Math.random() * 5000) + 1000;

      if (type === 'policy') {
        PROVINCES.forEach(p => { newVotes = applyVoteChange(newVotes, p.id, prev.playerPartyId, 0.12); });
        followerBoost *= 2;
      } else {
        PROVINCES.filter(p => p.population > 800000).forEach(p => { 
          newVotes = applyVoteChange(newVotes, p.id, prev.playerPartyId, 0.18); 
        });
      }

      return {
        ...prev,
        budget: prev.budget - SOCIAL_MEDIA_COST,
        posts: [newPost, ...prev.posts].slice(0, 50),
        followerCount: (prev.followerCount || 0) + followerBoost,
        provinceVotes: newVotes,
        nationalVotes: recalcNationalVotes(newVotes),
        ralliesThisTurn: prev.ralliesThisTurn + 1,
        dailyExpenses: prev.dailyExpenses + SOCIAL_MEDIA_COST,
        playerActions: [...prev.playerActions, { type: 'social_media', day: prev.currentDay }]
      };
    });
  }, []);

  const advanceDay = useCallback((bypassMultiplayer = false) => {
    setState(prev => {
      if (!prev) return prev;
      
      // Bekleme ekranındayken veya oyun fazındayken ilerleyebiliriz
      if (prev.phase !== 'playing' && !bypassMultiplayer) return prev;

      if (prev.isMultiplayer && !bypassMultiplayer) {
        socket.emit('setReadyStatus', { roomId: prev.roomId, isReady: true });
        // Sadece Host oyunu hesaplayacak, biz sadece hazır olduğumuzu iletip beklemeye geçiyoruz.
        return { ...prev, isReadyForNextDay: true };
      }

      // ... existing income/AI logic ...
      const calculateIncome = (pId, currentVotes) => {
        const partyOffices = prev.offices[pId] || {};
        const officeCount = Object.values(partyOffices).reduce((s, v) => s + v, 0);
        const voteHelp = Math.round(currentVotes[pId] * 5000000);
        const maintenance = officeCount * OFFICE_MAINTENANCE_COST;
        return BASE_DAILY_INCOME + (officeCount * OFFICE_INCOME) + voteHelp - maintenance;
      };

      const playerIncome = calculateIncome(prev.playerPartyId, prev.nationalVotes);
      const newAIState = { ...prev.aiState };
      Object.keys(newAIState).forEach(aiId => {
        const ai = { ...newAIState[aiId] };
        ai.budget += calculateIncome(aiId, prev.nationalVotes);
        newAIState[aiId] = ai;
      });

      const events = getRandomEvents(EVENTS_PER_DAY, usedEventIdsRef.current);
      usedEventIdsRef.current = [...usedEventIdsRef.current, ...events.map(e => e.id)];

      let newVotes = { ...prev.provinceVotes };
      Object.keys(newVotes).forEach(k => { newVotes[k] = { ...newVotes[k] }; });
      
      events.forEach(event => {
        Object.entries(event.effects || {}).forEach(([partyId, effect]) => {
          const targetProvinces = event.region ? PROVINCES.filter(p => p.region === event.region) : PROVINCES;
          targetProvinces.forEach(province => { 
            newVotes = applyVoteChange(newVotes, province.id, partyId, effect * (0.8 + Math.random() * 0.4)); 
          });
        });
      });

      const aiResult = runAIActions({ ...prev, aiState: newAIState, provinceVotes: newVotes });
      const newDay = prev.currentDay - 1;
      const passiveFollowers = Math.floor(prev.nationalVotes[prev.playerPartyId] * 5000);

      const nextState = {
        ...prev,
        currentDay: newDay,
        phase: 'events',
        showEvents: true,
        budget: prev.budget + playerIncome,
        dailyIncome: playerIncome,
        provinceVotes: aiResult.newVotes,
        nationalVotes: recalcNationalVotes(aiResult.newVotes),
        dailyEvents: [], // AI gelene kadar boş
        aiActions: aiResult.aiActions,
        aiState: aiResult.newAIState,
        offices: aiResult.newOffices,
        isBulletinLoading: true,
        dailyBulletin: null,
        followerCount: (prev.followerCount || 50000) + passiveFollowers,
        ralliesThisTurn: 0,
        dailyExpenses: 0,
        eventLog: [...prev.eventLog, { day: prev.currentDay, events: [], aiActions: aiResult.aiActions }]
      };

      // ASYNC CONTENT GENERATION
      const yesterdayActions = nextState.playerActions.filter(a => a.day === prev.currentDay);
      
      Promise.all([
        generateSocialContent(),
        generateAIEvents(newDay, yesterdayActions, aiResult.aiActions, prev.playerPartyId),
        generateDailyBulletinAI({
          day: newDay,
          playerActions: yesterdayActions,
          aiActions: aiResult.aiActions,
          events: [], 
          playerPartyId: prev.playerPartyId
        })
      ]).then(([social, aiEvents, bulletin]) => {
        setState(curr => {
          if (!curr) return curr;
          let finalVotes = { ...curr.provinceVotes };
          aiEvents.forEach(event => {
            Object.entries(event.effects || {}).forEach(([rawPartyId, effect]) => {
              const partyId = rawPartyId.toLowerCase().trim(); // HATA ÖNLEME: Lowercase ve boşluk temizliği
              PROVINCES.forEach(province => {
                finalVotes = applyVoteChange(finalVotes, province.id, partyId, effect * 0.1); 
              });
            });
          });

          return { 
             ...curr, 
             stories: social.aiStories,
             posts: [...social.aiPosts, ...curr.posts].slice(0, 100),
             dailyEvents: aiEvents,
             dailyBulletin: bulletin,
             isBulletinLoading: false,
             provinceVotes: finalVotes,
             nationalVotes: recalcNationalVotes(finalVotes)
          };
        });
      });

      return nextState;
    });
  }, [generateSocialContent, generateDailyBulletinAI, generateAIEvents]);


  const dismissEvents = useCallback(() => {
    setState(prev => {
      if (!prev) return prev;
      return { ...prev, phase: prev.currentDay <= 0 ? 'results' : 'playing', showEvents: false };
    });
  }, []);

  const selectProvince = useCallback((provinceId) => {
    setState(prev => prev ? { ...prev, selectedProvince: provinceId } : prev);
  }, []);

  const getElectionResults = useCallback(() => {
    if (!state) return null;
    let totalSeats = 600;
    const partySeats = {};
    getAllParties().forEach(p => { partySeats[p.id] = 0; });
    const provinceWinners = {};
    PROVINCES.forEach(province => {
      const votes = state.provinceVotes[province.id];
      if (!votes) return;
      const winner = getLeadingParty(votes, getAllParties());
      provinceWinners[province.id] = winner;
      const seatsForProvince = Math.max(1, Math.round(province.population / 150000));
      if (winner) {
        partySeats[winner.id] = (partySeats[winner.id] || 0) + seatsForProvince;
      }
    });
    const currentTotalSeats = Object.values(partySeats).reduce((s, v) => s + v, 0);
    const seatScale = totalSeats / currentTotalSeats;
    Object.keys(partySeats).forEach(k => { partySeats[k] = Math.round(partySeats[k] * seatScale); });
    return { provinceWinners, partySeats, nationalVotes: state.nationalVotes, winner: Object.entries(partySeats).sort((a, b) => b[1] - a[1])[0]?.[0] };
  }, [state]);

  const toggleSettings = useCallback(() => {
    setState(prev => ({ ...prev, showSettings: !prev.showSettings }));
  }, [setState]);

  const saveGame = useCallback(() => {
    try {
      localStorage.setItem('secim_oyunu_save_v1', JSON.stringify(state));
      alert('Oyun başarıyla kaydedildi! 💾');
    } catch (err) {
      console.error('Save failed', err);
      alert('Kayıt başarısız oldu.');
    }
  }, [state]);

  const loadGame = useCallback(() => {
    try {
      const saved = localStorage.getItem('secim_oyunu_save_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        setState({ ...parsed, showSettings: false });
        alert('Oyun başarıyla yüklendi! 📂');
      } else {
        alert('Kayıtlı oyun bulunamadı.');
      }
    } catch (err) {
      console.error('Load failed', err);
      alert('Yükleme sırasında hata oluştu.');
    }
  }, [setState]);

  // Oyunu Sıfırla
  const resetGame = useCallback(() => {
    setState(null);
    localStorage.removeItem('secim_oyunu_save_v1');
    window.location.href = '/';
  }, []);

  // --- Miting Sorusu Süreç Yönetimi (Timer & Auto-Advance) ---
  useEffect(() => {
    let interval = null;
    
    if (state?.rallyInteraction.active && state.rallyInteraction.subPhase === 'answering' && state.rallyInteraction.timeLeft > 0) {
      interval = setInterval(() => {
        setState(prev => {
          if (!prev || prev.rallyInteraction.timeLeft <= 0) return prev;
          return {
            ...prev,
            rallyInteraction: { 
              ...prev.rallyInteraction, 
              timeLeft: prev.rallyInteraction.timeLeft - 1 
            }
          };
        });
      }, 1000);
    } else if (state?.rallyInteraction.active && state.rallyInteraction.subPhase === 'answering' && state.rallyInteraction.timeLeft === 0) {
      submitRallyAnswer("..."); 
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [state?.rallyInteraction.active, state?.rallyInteraction.subPhase, state?.rallyInteraction.timeLeft === 0, submitRallyAnswer]);

  // --- MULTIPLAYER SYNC LISTENERS ---
  useSocketSync(state, setState, advanceDay);

  return { 
    state, 
    startGame, 
    organizeRally: startRallyInteraction,
    travelTo,
    buildOffice,
    buyActionPoint,
    submitRallyTopic,
    submitRallyAnswer,
    finishRally,
    tvAppearance, 
    advanceDay, 
    dismissEvents, 
    selectProvince, 
    getElectionResults,
    toggleSettings, 
    saveGame,       
    loadGame,
    resetGame,
    generatePlayerSocialAI,
    socialMediaOpen: state?.socialMediaOpen,
    toggleSocialMedia,
    createPost,
    likePost,
    shareStory,
    stories: state?.stories,
    followerCount: state?.followerCount,
  };
}

// MULTIPLAYER SYNC HELPERS
function useSocketSync(state, setState, advanceDay) {
  useEffect(() => {
    if (!state?.isMultiplayer) return;

    // 1. DİNLEYİCİLER (Listeners)
    const handleAllReady = () => {
      if (state.hostId === socket.id) {
        advanceDay(true); 
      }
    };

    const handleStateSync = (newState) => {
      // Host'un state'ini al ama kendi parti kimliğini ve konumunu koru (opsiyonel)
      setState(prev => ({ ...newState, playerPartyId: prev.playerPartyId }));
    };

    const handlePlayerMoved = ({ socketId, partyId, provinceId }) => {
      setState(prev => ({
        ...prev,
        remotePlayers: { ...prev.remotePlayers, [socketId]: { partyId, provinceId } }
      }));
    };

    const handlePlayerAction = ({ socketId, actionData }) => {
      console.log(`[Multiplayer] Diğer oyuncu hamlesi:`, actionData);
      
      if (actionData.type === 'story') {
        setState(prev => ({
          ...prev,
          stories: [actionData, ...prev.stories]
        }));
      } else if (actionData.type === 'post') {
        setState(prev => ({
          ...prev,
          posts: [actionData, ...prev.posts].slice(0, 100)
        }));
      }

      // Aksiyon loguna ekle (Aksiyon Paneli için)
      setState(prev => ({
        ...prev,
        playerActions: [...prev.playerActions, { 
          ...actionData, 
          socketId, 
          day: prev.currentDay,
          isRemote: true 
        }]
      }));
    };

    const handleReadyUpdate = (status) => {
      setState(prev => ({ ...prev, readyStatus: status }));
    };

    socket.on('allPlayersReady', handleAllReady);
    socket.on('gameStateSync', handleStateSync);
    socket.on('playerMoved', handlePlayerMoved);
    socket.on('playerActionReceived', handlePlayerAction);
    socket.on('readyUpdate', handleReadyUpdate);

    return () => {
      socket.off('allPlayersReady', handleAllReady);
      socket.off('gameStateSync', handleStateSync);
      socket.off('playerMoved', handlePlayerMoved);
      socket.off('playerActionReceived', handlePlayerAction);
      socket.off('readyUpdate', handleReadyUpdate);
    };
  }, [state?.isMultiplayer, state?.hostId, advanceDay]);

  // 2. YAYINCILAR (Emitters)
  
  // State Sync (Sadece Host)
  useEffect(() => {
    if (state?.isMultiplayer && state.hostId === socket.id && state.roomId) {
      socket.emit('syncGameState', { roomId: state.roomId, state });
    }
  }, [state]);

  // Hareket Sync
  useEffect(() => {
    if (state?.isMultiplayer && state.playerLocation && state.roomId) {
       socket.emit('playerMove', { roomId: state.roomId, provinceId: state.playerLocation });
    }
  }, [state?.playerLocation, state?.isMultiplayer, state?.roomId]);
}

