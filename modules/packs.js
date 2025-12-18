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
 * Загружать все паки
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
        emoji: '🌢', 
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
        emoji: '🎆', 
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
 * 🔥 НОВОЕ: Вычисляет гарантии редкостей на основе rarityWeights
 */
function calculateGuarantees(rarityWeights, cardCount) {
  if (!rarityWeights || !cardCount) return [];
  
  const guarantees = [];
  const total = Object.values(rarityWeights).reduce((a, b) => a + b, 0);
  
  const rarityEmojis = {
    common: '🗑',
    uncommon: '🎯',
    rare: '🏆',
    mythical: '💎',
    legendary: '⭐',
    ancient: '🔥',
    exceedingly_rare: '✨',
    immortal: '👑'
  };
  
  const rarityNames = {
    common: 'Обычная',
    uncommon: 'Необычная',
    rare: 'Редкая',
    mythical: 'Мифическая',
    legendary: 'Легендарная',
    ancient: 'Древняя',
    exceedingly_rare: 'Осколбительно редкая',
    immortal: 'Бессмертная'
  };
  
  for (const [rarity, weight] of Object.entries(rarityWeights)) {
    const percentage = Math.round((weight / total) * 100);
    const expectedCount = Math.round((weight / total) * cardCount * 10) / 10;
    
    guarantees.push({
      rarity,
      percentage,
      expectedCount,
      emoji: rarityEmojis[rarity] || '❓',
      name: rarityNames[rarity] || rarity
    });
  }
  
  return guarantees.sort((a, b) => b.percentage - a.percentage);
}

/**
 * 🔥 НОВОЕ: Рендерит гарантии редкостей
 */
function renderGuarantees(pack) {
  const guarantees = calculateGuarantees(pack.rarityWeights, pack.cardCount);
  
  return `
    <div style="font-size:11px; color:var(--text-secondary); margin-top:8px; padding:8px; background:rgba(0,0,0,0.2); border-radius:8px;">
      <div style="font-weight:600; color:var(--text); margin-bottom:6px;">📊 Гарантии:</div>
      ${guarantees.map(g => `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:3px;">
          <span>${g.emoji} ${g.name}</span>
          <span style="color:var(--text-accent); font-weight:600;">${g.percentage}%</span>
        </div>
      `).join('')}
    </div>
  `;
}

/**
 * 🔥 НОВОЕ: Вычисляет время до следующего бесплатного пака
 */
function calculateTimeUntilFreepack() {
  const u = state.currentUser;
  if (!u) return null;
  
  const lastDaily = u.lastDailyPackDate;
  if (!lastDaily) return null; // Первый раз - доступен
  
  // lastDaily = "Thu Dec 18 2025" (toDateString format)
  const lastDate = new Date(lastDaily);
  const now = new Date();
  
  // Устанавливаем оба на начало дня для корректного сравнения
  lastDate.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  
  const diffTime = now - lastDate;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays >= 1) return null; // Доступен!
  
  // Вычисляем когда будет доступен (завтра в 00:00)
  const nextDay = new Date();
  nextDay.setDate(nextDay.getDate() + 1);
  nextDay.setHours(0, 0, 0, 0);
  
  const timeUntil = nextDay - new Date();
  const hours = Math.floor(timeUntil / (1000 * 60 * 60));
  const minutes = Math.floor((timeUntil % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeUntil % (1000 * 60)) / 1000);
  
  return { hours, minutes, seconds, timeMs: timeUntil };
}

/**
 * 🔥 НОВОЕ: Обновляет таймер каждую секунду
 */
let timerInterval = null;

function startFreePkTimer() {
  if (timerInterval) clearInterval(timerInterval);
  
  timerInterval = setInterval(() => {
    const timeData = calculateTimeUntilFreepack();
    const timerEl = document.getElementById('free-pack-timer');
    const button = document.getElementById('free-pack-button');
    
    if (!timerEl || !button) {
      clearInterval(timerInterval);
      return;
    }
    
    if (!timeData) {
      // Доступен!
      timerEl.innerHTML = '✨ ДОСТУПЕН СЕЙЧАС';
      timerEl.style.color = '#10b981';
      button.disabled = false;
      button.style.opacity = '1';
      button.style.cursor = 'pointer';
      clearInterval(timerInterval);
    } else {
      // Недоступен, показываем таймер
      timerEl.textContent = `${String(timeData.hours).padStart(2, '0')}:${String(timeData.minutes).padStart(2, '0')}:${String(timeData.seconds).padStart(2, '0')}`;
      timerEl.style.color = '#ef4444';
      button.disabled = true;
      button.style.opacity = '0.5';
      button.style.cursor = 'not-allowed';
    }
  }, 1000);
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
  const timeData = calculateTimeUntilFreepack();
  const dailyPack = document.createElement('div');
  dailyPack.style.cssText = `
    min-width: 220px;
    background: linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%);
    border: 3px solid #6ee7b7;
    border-radius: 16px;
    padding: 20px;
    cursor: ${timeData ? 'not-allowed' : 'pointer'};
    transition: all 0.3s ease;
    display: flex;
    flex-direction: column;
    gap: 12px;
    position: relative;
    overflow: hidden;
    box-shadow: 0 10px 25px -5px rgba(16, 185, 129, 0.3);
    flex-shrink: 0;
    opacity: ${timeData ? '0.6' : '1'};
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
    <div style="position:absolute; top:0; right:0; background:#fbbf24; color:#7c2d12; padding:6px 12px; border-radius:0 16px 0 12px; font-size:11px; font-weight:700; z-index:10;">БЕСПЛАТНО</div>
    <div style="font-size:48px; text-align:center; margin-top:8px; position:relative; z-index:5;">🎁</div>
    <div style="font-weight:700; font-size:18px; color:#fff; text-align:center; position:relative; z-index:5;">Ежедневный Пак</div>
    <div style="font-size:13px; color:rgba(255,255,255,0.95); text-align:center; position:relative; z-index:5;">3 карты | Каждый день</div>
    
    <!-- 🔥 ТАЙМЕР -->
    <div id="free-pack-timer" style="text-align:center; font-size:18px; font-weight:700; color:#10b981; font-family:monospace; position:relative; z-index:5;">
      ${timeData ? `${String(timeData.hours).padStart(2, '0')}:${String(timeData.minutes).padStart(2, '0')}:${String(timeData.seconds).padStart(2, '0')}` : '✨ ДОСТУПЕН'}
    </div>
    
    <!-- 🔥 ГАРАНТИИ -->
    <div style="font-size:11px; color:rgba(255,255,255,0.9); margin-top:8px; padding:8px; background:rgba(0,0,0,0.3); border-radius:8px;">
      <div style="font-weight:600; margin-bottom:4px;">📊 Гарантии:</div>
      <div>🗑 Обычная: 66%</div>
      <div>🎯 Необычная: 33%</div>
    </div>
    
    <button id="free-pack-button" class="btn" style="width:100%; margin-top:12px; background:#fff; color:#047857; border:none; cursor:${timeData ? 'not-allowed' : 'pointer'}; font-weight:700; font-size:14px; padding:10px; border-radius:10px; transition:all 0.3s; position:relative; z-index:5; opacity:${timeData ? '0.6' : '1'};" onmouseover="!this.disabled && (this.style.transform='scale(1.05)')" onmouseout="!this.disabled && (this.style.transform='scale(1)')">${timeData ? '🔒 ЗАКРЫТО' : 'ПОЛУЧИТЬ'}</button>
  `;
  
  dailyPack.appendChild(gradientBg);
  
  dailyPack.querySelector('button').addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!timeData) await openDailyPack();
  });
  
  list.appendChild(dailyPack);
  
  // Начнём обновлять таймер
  startFreePkTimer();
  
  // ОБЫЧНЫЕ ПАКЫ с КАЖДЫМ своим цветом
  state.packs.forEach((pack, idx) => {
    const packColor = pack.color || '#6366f1';
    const packBorderColor = pack.borderColor || packColor;
    const userCoins = state.currentUser?.currency || 0;
    const canAfford = userCoins >= pack.price;
    
    const div = document.createElement('div');
    div.style.cssText = `
      min-width: 220px;
      background: linear-gradient(135deg, ${packColor}20 0%, ${packColor}08 100%);
      border: 3px solid ${packBorderColor};
      border-radius: 16px;
      padding: 20px;
      cursor: ${canAfford ? 'pointer' : 'not-allowed'};
      transition: all 0.3s ease;
      display: flex;
      flex-direction: column;
      gap: 12px;
      position: relative;
      overflow: hidden;
      box-shadow: 0 10px 25px -5px rgba(99, 102, 241, 0.1);
      flex-shrink: 0;
      background-clip: padding-box;
      opacity: ${canAfford ? '1' : '0.4'};
      filter: ${canAfford ? 'none' : 'grayscale(80%)'};
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
    
    // Вычисляем гарантии
    const guarantees = calculateGuarantees(pack.rarityWeights, pack.cardCount);
    const guaranteeHtml = guarantees
      .slice(0, 3) // Показываем только топ-3
      .map(g => `<div style="display:flex; justify-content:space-between; margin-bottom:2px;"><span>${g.emoji}</span><span>${g.percentage}%</span></div>`)
      .join('');
    
    div.innerHTML += `
      <div style="font-size:40px; text-align:center; position:relative; z-index:2;">${pack.emoji || '📅'}</div>
      <div style="font-weight:700; font-size:18px; color:${packBorderColor}; text-align:center; position:relative; z-index:2;">${pack.name}</div>
      <div style="font-size:13px; color:var(--text-secondary); text-align:center; position:relative; z-index:2;">${pack.cardCount} карт</div>
      <div style="margin-top:auto; text-align:center; font-size:16px; color:${packBorderColor}; font-weight:700; position:relative; z-index:2;">${pack.price} 💰</div>
      
      <!-- 🔥 ГАРАНТИИ -->
      <div style="font-size:11px; color:var(--text-secondary); margin-top:8px; padding:8px; background:rgba(0,0,0,0.2); border-radius:8px; position:relative; z-index:2;">
        <div style="font-weight:600; color:var(--text); margin-bottom:4px;">📊 Гарантии:</div>
        ${guaranteeHtml}
      </div>
      
      <button class="btn btn-primary" style="width:100%; margin-top:12px; background:linear-gradient(135deg, ${packColor}, ${packBorderColor}); border:none; color:white; font-weight:700; font-size:14px; padding:10px; border-radius:10px; transition:all 0.3s; cursor:${canAfford ? 'pointer' : 'not-allowed'};" onmouseover="this.style.transform='${canAfford ? 'scale(1.05)' : 'scale(1)'}' " onmouseout="this.style.transform='scale(1)'" ${!canAfford ? 'disabled' : ''}>${canAfford ? 'ОТКРЫТЬ' : '💰 Недостаточно'}</button>
    `;
    
    if (canAfford) {
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
    }
    
    div.querySelector('button').addEventListener('click', (e) => {
      e.stopPropagation();
      if (canAfford) openPack(pack);
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
    ui.showError('🔄 Пак уже открыт сегодня! Закрывается через: ' + calculateTimeUntilFreepack());
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
    
    // ОБНОВЛЯЕМ ONLY lastDailyPackDate
    await db.collection('users').doc(u.uid).update({
      lastDailyPackDate: today
    });
    u.lastDailyPackDate = today;
    
    // ДОБАВЛЯЕМ КАРТЫ В КОЛОДУ СБРОСА
    for (const card of drawnCards) {
      await decks.addCardToDiscardDeck(card.id);
    }
    
    showPackOpeningModal(drawnCards);
    cardMod.renderCollection();
    decks.renderDecks();
    renderShop(); // Обновляем магазин (таймер)
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
    
    // Вычитаем монеты
    await db.collection('users').doc(u.uid).update({
      currency: firebase.firestore.FieldValue.increment(-pack.price)
    });
    u.currency -= pack.price;
    
    // ДОБАВЛЯЕМ КАРТЫ В КОЛОДУ СБРОСА
    for (const card of drawnCards) {
      await decks.addCardToDiscardDeck(card.id);
    }
    
    showPackOpeningModal(drawnCards);
    
    document.getElementById('coins-display').textContent = u.currency;
    cardMod.renderCollection();
    decks.renderDecks();
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
