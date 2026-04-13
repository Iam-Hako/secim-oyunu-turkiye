
// Türkiye Siyaseti Gerçek İnternet Fotoğrafları Kütüphanesi (Wikipedia/Wikimedia Kaynaklı)
export const PARTY_GALLERY = {
  akp: [
    "https://upload.wikimedia.org/wikipedia/commons/d/de/Yenikap%C4%B1_Miting_Alanı_%282014%29.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/AK_Party_Rally_Istanbul_2015.jpg/1280px-AK_Party_Rally_Istanbul_2015.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/b/b5/AKP_Istanbul_rally_2013.jpg"
  ],
  chp: [
    "https://upload.wikimedia.org/wikipedia/commons/c/c5/CHP_Mitingi_G%C3%BCndo%C4%9Fdu_Meydan%C4%B1.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/CHP_Maltepe_Mitingi_2022.jpg/1280px-CHP_Maltepe_Mitingi_2022.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/9/9f/CHP_İzmir_Mitingi_2015.jpg"
  ],
  mhp: [
    "https://upload.wikimedia.org/wikipedia/commons/6/6c/MHP_Konya_Mitingi.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/MHP_Büyük_İstanbul_Mitingi.jpg/1280px-MHP_Büyük_İstanbul_Mitingi.jpg"
  ],
  iyi: [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Iyi_Parti_rally.jpg/1280px-Iyi_Parti_rally.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/İYİ_Parti_Gençlik_Kolları.jpg/1280px-İYİ_Parti_Gençlik_Kolları.jpg"
  ],
  dem: [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/HDP_rally_in_Istanbul.jpg/1280px-HDP_rally_in_Istanbul.jpg"
  ],
  ldp: [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Iyi_Parti_rally.jpg/1280px-Iyi_Parti_rally.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Turkish_Flag_in_the_Wind.jpg/1280px-Turkish_Flag_in_the_Wind.jpg"
  ],
  tkp: [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Voting_in_Turkey_2.jpg/1280px-Voting_in_Turkey_2.jpg"
  ],
  dsp: [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/TBMM_Ankara.jpg/1280px-TBMM_Ankara.jpg"
  ],
  vatan: [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Turkish_Flag_in_the_Wind.jpg/1280px-Turkish_Flag_in_the_Wind.jpg"
  ],
  // Genel Kategori Görselleri
  generic: [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Voting_in_Turkey_2.jpg/1280px-Voting_in_Turkey_2.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/TBMM_Ankara.jpg/1280px-TBMM_Ankara.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Turkish_Flag_in_the_Wind.jpg/1280px-Turkish_Flag_in_the_Wind.jpg"
  ]
};

/**
 * Parti ID ve aktivite türüne göre internetten gerçek bir fotoğraf URL'si döner.
 */
export function getRealInternetImage(partyId, type = 'rally') {
  const gallery = PARTY_GALLERY[partyId] || PARTY_GALLERY.generic;
  const imageUrl = gallery[Math.floor(Math.random() * gallery.length)];
  
  // URL'yi weserv.nl proxy'si ile sarmala (Hotlinking korumasını aşmak ve optimize etmek için)
  const encodedUrl = encodeURIComponent(imageUrl);
  const proxyUrl = `https://images.weserv.nl/?url=${encodedUrl}&w=800&fit=cover`;
  
  return proxyUrl;
}
