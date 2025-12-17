/**
 * modules/packs.js - Паки и магазин
 */

import { state, closeModal, openModal } from '../app.js';
import * as ui from './ui.js';
import * as user from './user.js';
import * as cardMod from './cards.js';
import * as decks from './decks.js';

const db = firebase.firestore();

/**
 * Загружить все паки
 */
export async function loadPacks() {
  try {
    const snap = await db.collection('packs').orderBy('price').get();
    state.packs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log('✅ Packs loaded:', state.packs.length);
    
    if (state.packs.length === 0) {
      await initDefaultPacks();
    }
  } catch (e) {
    console.error('Error loading packs:', e);
  }
}

/**
 * Инициализируем тестовые паки
 */
async function initDefaultPacks() {
  try {
    const defaultPacks = [
      { 
        name: 'Начало', 
        price: 25, 
        cardCount: 2, 
        emoji: '🌲', 
        color: '#3b82f6',
        borderColor: '#1e40af',
        rarityWeights: { common: 10 } 
      },
      { 
        name: 'Стартер', 
        price: 50, 
        cardCount: 3, 
        emoji: '⭐', 
        color: '#06b6d4',
        borderColor: '#0369a1',
        rarityWeights: { common: 7, uncommon: 3 } 
      },
      { 
        name: 'Стандарт', 
        price: 100, 
        cardCount: 5, 
        emoji: '🏆', 
        color: '#f59e0b',
        borderColor: '#b45309',
        rarityWeights: { uncommon: 5, rare: 2 } 
      },
      { 
        name: 'Премиум', 
        price: 200, 
        cardCount: 7, 
        emoji: '💎', 
        color: '#a855f7',
        borderColor: '#6d28d9',
        rarityWeights: { rare: 4, mythical: 2, legendary: 1 } 
      },
      { 
        name: 'Легендарный', 
        price: 350, 
        cardCount: 10, 
        emoji: '🌟', 
        color: '#ec4899',
        borderColor: '#831843',
        rarityWeights: { rare: 3, mythical: 3, legendary: 2, ancient: 1 } 
      },
      { 
        name: 'Бессмертный', 
        price: 500, 
        cardCount: 12, 
        emoji: '⚠️', 
        color: '#ef4444',
        borderColor: '#7f1d1d',
        rarityWeights: { mythical: 4, legendary: 3, ancient: 2, exceedingly_rare: 1 } 
      }
    ];
    
    for (const pack of defaultPacks) {
      await db.collection('packs').add(pack);
    }
    
    await loadPacks();
  } catch (e) {
    console.error('Error creating default packs:', e);
  }
}

/**
 * Рендерит магазин паков
 */
export function renderShop() {
  const list = document.getElementById('packs-list');
  if (!list) return;
  list.innerHTML = '';
  
  if (!state.packs.length) {
    list.innerHTML = '<div style="color:var(--text-secondary);">No packs</div>';
    return;
  }
  
  // БЕСПЛАТНЫЙ ПАК В НАЧАЛЕ
  const dailyPack = document.createElement('div');
  dailyPack.style.cssText = `
    min-width: 220px;
    background: linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%);
    border: 3px solid #6ee7b7;
    border-radius: 16px;
    padding: 20px;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    flex-direction: column;
    gap: 12px;
    position: relative;
    overflow: hidden;
    box-shadow: 0 10px 25px -5px rgba(16, 185, 129, 0.3);
    flex-shrink: 0;
  `;
  
  // Анимация фона
  const gradientBg = document.createElement('div');
  gradientBg.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: radial-gradient(circle at 20% 50%, rgba(255,255,255,0.2), transparent);
    pointer-events: none;
  `;
  
  dailyPack.innerHTML = `
    <div style="position:absolute; top:0; right:0; background:#fbbf24; color:#7c2d12; padding:6px 12px; border-radius:0 16px 0 12px; font-size:11px; font-weight:700; z-index:10;">ОБЕСПЛАТНО</div>
    <div style="font-size:48px; text-align:center; margin-top:8px; position:relative; z-index:5;">🎁</div>
    <div style="font-weight:700; font-size:18px; color:#fff; text-align:center; position:relative; z-index:5;">Ежедневный Пак</div>
    <div style="font-size:13px; color:rgba(255,255,255,0.95); text-align:center; position:relative; z-index:5;">3 карты | Каждый день</div>
    <div style="margin-top:auto; text-align:center; font-size:16px; color:#fff; font-weight:700; position:relative; z-index:5;">✨ ОТКРЫТЬ</div>
    <button class="btn" style="width:100%; margin-top:12px; background:#fff; color:#047857; border:none; cursor:pointer; font-weight:700; font-size:14px; padding:10px; border-radius:10px; transition:all 0.3s; position:relative; z-index:5;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">ПОЛУЧИТЬ</button>
  `;
  
  dailyPack.appendChild(gradientBg);
  
  dailyPack.addEventListener('mouseenter', () => {
    dailyPack.style.transform = 'translateY(-12px) scale(1.03)';
    dailyPack.style.boxShadow = '0 25px 35px -5px rgba(16, 185, 129, 0.5)';
  });
  dailyPack.addEventListener('mouseleave', () => {
    dailyPack.style.transform = 'translateY(0) scale(1)';
    dailyPack.style.boxShadow = '0 10px 25px -5px rgba(16, 185, 129, 0.3)';
  });
  
  dailyPack.querySelector('button').addEventListener('click', async (e) => {
    e.stopPropagation();
    await openDailyPack();
  });
  
  list.appendChild(dailyPack);
  
  // ОБЫчНЫЕ ПАКЫ с КАЖДЫМ своим цветом И УЛУЧШЕННЫМ СТИЛЕМ
  state.packs.forEach((pack, idx) => {
    const packColor = pack.color || '#6366f1';
    const packBorderColor = pack.borderColor || packColor;
    const div = document.createElement('div');
    div.style.cssText = `
      min-width: 220px;
      background: linear-gradient(135deg, ${packColor}20 0%, ${packColor}08 100%);
      border: 3px solid ${packBorderColor};
      border-radius: 16px;
      padding: 20px;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      flex-direction: column;
      gap: 12px;
      position: relative;
      overflow: hidden;
      box-shadow: 0 10px 25px -5px rgba(99, 102, 241, 0.1);
      flex-shrink: 0;
      background-clip: padding-box;
    `;
    
    // Внутренний глянец
    const gloss = document.createElement('div');
    gloss.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent, ${packBorderColor}40, transparent);
    `;
    
    div.appendChild(gloss);
    
    div.innerHTML += `
      <div style="font-size:40px; text-align:center; position:relative; z-index:2;">${pack.emoji || '📆'}</div>
      <div style="font-weight:700; font-size:18px; color:${packBorderColor}; text-align:center; position:relative; z-index:2;">${pack.name}</div>
      <div style="font-size:13px; color:var(--text-secondary); text-align:center; position:relative; z-index:2;">${pack.cardCount} карт</div>
      <div style="margin-top:auto; text-align:center; font-size:16px; color:${packBorderColor}; font-weight:700; position:relative; z-index:2;">${pack.price} 💰</div>
      <button class="btn btn-primary" style="width:100%; margin-top:12px; background:linear-gradient(135deg, ${packColor}, ${packBorderColor}); border:none; color:white; font-weight:700; font-size:14px; padding:10px; border-radius:10px; transition:all 0.3s; cursor:pointer;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">ОТКРЫТЬ</button>
    `;
    
    div.addEventListener('mouseenter', () => {
      div.style.transform = 'translateY(-12px) scale(1.02)';
      div.style.boxShadow = `0 25px 35px -5px rgba(99, 102, 241, 0.25)`;
      div.style.background = `linear-gradient(135deg, ${packColor}30 0%, ${packColor}15 100%)`;
    });
    div.addEventListener('mouseleave', () => {
      div.style.transform = 'translateY(0) scale(1)';
      div.style.boxShadow = '0 10px 25px -5px rgba(99, 102, 241, 0.1)';
      div.style.background = `linear-gradient(135deg, ${packColor}20 0%, ${packColor}08 100%)`;
    });
    
    div.querySelector('button').addEventListener('click', (e) => {
      e.stopPropagation();
      openPack(pack);
    });
    
    list.appendChild(div);
  });
  
  // Прокрутка колесом
  list.addEventListener('wheel', (e) => {
    e.preventDefault();
    list.scrollLeft += e.deltaY;
  });
}

/**
 * Открыть бесплатный пак на день
 */
async function openDailyPack() {
  const u = state.currentUser;
  if (!u) return;
  
  const today = new Date().toDateString();
  const lastDaily = u.lastDailyPackDate || '';
  
  if (lastDaily === today) {
    ui.showError('🔄 Пак уже открыт сегодня! Осталось ' + (24 - new Date().getHours()) + ' часов');
    return;
  }
  
  try {
    const rarity = ['common', 'common', 'uncommon'][
      Math.floor(Math.random() * 3)
    ];
    const drawnCards = [];
    
    for (let i = 0; i < 3; i++) {
      const card = pickRandomCardByRarity(rarity);
      if (card) drawnCards.push(card);
    }
    
    if (drawnCards.length === 0) {
      ui.showError('Ошибка');
      return;
    }
    
    const updates = { lastDailyPackDate: today };
    drawnCards.forEach(c => {
      const key = `cards.${c.id}`;
      updates[key] = firebase.firestore.FieldValue.increment(1);
    });
    await db.collection('users').doc(u.uid).update(updates);
    
    drawnCards.forEach(c => {
      u.cards = u.cards || {};
      u.cards[c.id] = (u.cards[c.id] || 0) + 1;
    });
    u.lastDailyPackDate = today;
    
    // ДОБАВЛЯЕМ КАРТЫ В КОЛОДУ СБРОСА
    for (const card of drawnCards) {
      await decks.addCardToDiscardDeck(card.id);
    }
    
    showPackOpeningModal(drawnCards);
    cardMod.renderCollection();
  } catch (e) {
    console.error('Error opening daily pack:', e);
    ui.showError('Ошибка');
  }
}

/**
 * Открыть пак
 */
async function openPack(pack) {
  const u = state.currentUser;
  if (!u) return;
  
  if ((u.currency || 0) < pack.price) {
    ui.showError('💰 Не хватает монет!');
    return;
  }
  
  try {
    const rarityPool = buildRarityPool(pack.rarityWeights);
    const drawnCards = [];
    
    for (let i = 0; i < pack.cardCount; i++) {
      const rarity = pickWeightedRarity(rarityPool);
      const card = pickRandomCardByRarity(rarity);
      if (card) drawnCards.push(card);
    }
    
    if (drawnCards.length === 0) {
      ui.showError('Ошибка открытия пака');
      return;
    }
    
    await db.collection('users').doc(u.uid).update({
      currency: firebase.firestore.FieldValue.increment(-pack.price)
    });
    u.currency -= pack.price;
    
    const updates = {};
    drawnCards.forEach(c => {
      const key = `cards.${c.id}`;
      updates[key] = firebase.firestore.FieldValue.increment(1);
    });
    await db.collection('users').doc(u.uid).update(updates);
    
    drawnCards.forEach(c => {
      u.cards = u.cards || {};
      u.cards[c.id] = (u.cards[c.id] || 0) + 1;
    });
    
    // ДОБАВЛЯЕМ КАРТЫ В КОЛОДУ СБРОСА
    for (const card of drawnCards) {
      await decks.addCardToDiscardDeck(card.id);
    }
    
    showPackOpeningModal(drawnCards);
    
    document.getElementById('coins-display').textContent = u.currency;
    cardMod.renderCollection();
  } catch (e) {
    console.error('Error opening pack:', e);
    ui.showError('Ошибка открытия пака');
  }
}

function buildRarityPool(weights) {
  const pool = [];
  for (const [rarity, weight] of Object.entries(weights)) {
    for (let i = 0; i < weight; i++) pool.push(rarity);
  }
  return pool;
}

function pickWeightedRarity(pool) {
  return pool[Math.floor(Math.random() * pool.length)];
}

function pickRandomCardByRarity(rarity) {
  const cards = state.cards.filter(c => c.rarity === rarity);
  return cards.length ? cards[Math.floor(Math.random() * cards.length)] : null;
}

function showPackOpeningModal(cards) {
  const modal = document.getElementById('pack-opening-modal');
  const container = document.getElementById('pack-animation-container');
  if (!modal || !container) return;
  
  container.innerHTML = '';
  
  cards.forEach((card, idx) => {
    setTimeout(() => {
      const cardDiv = document.createElement('div');
      const rarity = ui.getRarityBadge(card.rarity);
      cardDiv.style.cssText = `
        min-width: 180px;
        background: linear-gradient(135deg, ${rarity.color}22, ${rarity.color}11);
        border: 2px solid ${rarity.color};
        border-radius: 12px;
        padding: 12px;
        display: flex;
        flex-direction: column;
        align-items: center;
        animation: cardReveal 0.5s ease-out;
      `;
      cardDiv.innerHTML = `
        <div style="width:100%; aspect-ratio:155/268; background:var(--bg-tertiary); border-radius:8px; overflow:hidden; margin-bottom:8px;">
          ${card.imageUrl ? `<img src="${card.imageUrl}" style="width:100%; height:100%; object-fit:cover;" />` : '🎨'}
        </div>
        <div style="font-weight:600; font-size:14px; color:var(--text-accent); text-align:center;">${card.title}</div>
        <div style="font-size:11px; color:var(--text-secondary); text-align:center;">${card.artist}</div>
        <div style="margin-top:4px; padding:4px 8px; border-radius:6px; font-size:11px; font-weight:600; background:${rarity.color}15; color:${rarity.color};">${rarity.emoji} ${rarity.name}</div>
      `;
      container.appendChild(cardDiv);
    }, idx * 200);
  });
  
  openModal('pack-opening-modal');
  
  const confirmBtn = document.getElementById('pack-confirm-btn');
  confirmBtn.style.display = 'block';
  confirmBtn.onclick = () => closeModal('pack-opening-modal');
}
