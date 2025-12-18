/**
 * modules/cards.js - Карты и коллекция
 */

import { state, closeModal, openModal } from '../app.js';
import * as ui from './ui.js';
import * as decks from './decks.js';

const db = firebase.firestore();

/**
 * 💎 ЦЕНЫ ЗА ПОРВАННЫЕ КАРТЫ (калиброванные под градацию 30%→80%)
 */
const TEAR_PRICES = {
  common:           { base: 1,   ratingMultiplier: 0.20 },
  uncommon:         { base: 2,   ratingMultiplier: 0.50 },
  rare:             { base: 3,   ratingMultiplier: 0.29 },
  mythical:         { base: 7,   ratingMultiplier: 0.26 },
  legendary:        { base: 12,  ratingMultiplier: 0.20 },
  ancient:          { base: 20,  ratingMultiplier: 0.30 },
  exceedingly_rare: { base: 45,  ratingMultiplier: 1.00 },
  immortal:         { base: 100, ratingMultiplier: 1.30 }
};

/**
 * 💎 Вычисляет цену за порванную карту
 */
function calculateTearPrice(card) {
  if (!card || !card.rarity) return 0;
  
  const priceData = TEAR_PRICES[card.rarity];
  if (!priceData) return 0;
  
  const cardRating = calculateCardRating(card);
  const price = priceData.base + (cardRating * priceData.ratingMultiplier);
  
  return Math.round(price);
}

/**
 * Вычисляет рейтинг карты (0-100)
 */
function calculateCardRating(card) {
  if (!card.power) return 0;
  const { resonance = 0, virtuosity = 0, profundity = 0, harmony = 0 } = card.power;
  return Math.round((resonance + virtuosity + profundity + harmony) / 4 * 10);
}

/**
 * Загружает карты из мастер-коллекции
 */
export async function loadCards() {
  console.log('🎠 Loading cards...');
  try {
    const snap = await db.collection('masterCards')
      .orderBy('createdAt', 'desc')
      .limit(1000)
      .get();
    
    state.cards = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log(`✅ Loaded ${state.cards.length} cards`);
  } catch (e) {
    console.error('Error loading cards:', e);
    ui.showError('Error loading cards');
  }
}

/**
 * Получить карту по ID
 */
function getCard(cardId) {
  return state.cards.find(c => c.id === cardId);
}

/**
 * ПРАВИЛЬНАЯ ЛОГИКА СЧЁТЧИКОВ
 * ВСЕГО = сумма карт ВО ВСЕХ КОЛОДАХ (включая сброс)
 * УНИКАЛЬНЫЕ = разные cardId ВО ВСЕХ КОЛОДАХ (включая сброс)
 */
function calculateStats() {
  const decksObj = state.currentUser?.decks || {};
  
  let totalInAllDecks = 0;
  const uniqueCardIds = new Set();
  
  for (const deck of Object.values(decksObj)) {
    for (const [cardId, count] of Object.entries(deck.cards || {})) {
      totalInAllDecks += count;
      uniqueCardIds.add(cardId);
    }
  }
  
  return { 
    total: totalInAllDecks,
    unique: uniqueCardIds.size
  };
}

/**
 * Определяет кол-во и доступность карты в колодах
 */
function getCardStatsInDecks(cardId) {
  const decksObj = state.currentUser?.decks || {};
  const inDecks = [];
  let totalInAllDecks = 0;
  
  for (const [deckId, deck] of Object.entries(decksObj)) {
    if (deck.isDiscardDeck) continue;
    const count = deck.cards?.[cardId] || 0;
    if (count > 0) {
      inDecks.push({ name: deck.name, count, deckId });
      totalInAllDecks += count;
    }
  }
  
  return {
    inDecks,
    inDecksTotal: totalInAllDecks
  };
}

/**
 * Рендерит коллекцию карт (по ПРОСМАТРИВАЕМОЙ колоде)
 */
export function renderCollection() {
  const grid = document.getElementById('cards-grid');
  const filter = document.getElementById('rarity-filter')?.value || '';
  
  if (!grid) return;
  grid.innerHTML = '';

  const decksObj = state.currentUser?.decks || {};
  const viewingDeckId = decks.getViewingDeckId?.() || null;
  const activeDeckId = decks.activeDeckId || null;

  let viewingDeck = viewingDeckId ? decksObj[viewingDeckId] : null;

  // Если viewingDeckId не задан или указывает в никуда — падаем обратно на активную
  if (!viewingDeck && activeDeckId) {
    viewingDeck = decksObj[activeDeckId];
  }

  let userCardIds = [];
  let title = 'Вся коллекция';

  if (viewingDeck) {
    userCardIds = Object.keys(viewingDeck.cards || {});
    if (viewingDeck.isDiscardDeck) {
      title = '🗑 Карты без колод';
    } else {
      title = `🎴 ${viewingDeck.name}`;
    }
  } else {
    // Фоллбек: все карты из всех колод
    const allCardIds = new Set();
    for (const deck of Object.values(decksObj)) {
      for (const cardId of Object.keys(deck.cards || {})) {
        allCardIds.add(cardId);
      }
    }
    userCardIds = Array.from(allCardIds);
  }
  
  let headerEl = document.getElementById('collection-deck-title');
  if (!headerEl) {
    headerEl = document.createElement('div');
    headerEl.id = 'collection-deck-title';
    headerEl.style.cssText = 'font-size:16px; font-weight:700; color:var(--text-accent); margin-bottom:12px;';
    grid.parentElement.insertBefore(headerEl, grid);
  }
  headerEl.textContent = title;
  
  let cards = userCardIds.map(id => getCard(id)).filter(c => c);
  
  if (filter) cards = cards.filter(c => c.rarity === filter);

  if (!cards.length) {
    grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; color:var(--text-secondary); padding:40px;">🤷 No cards found</div>';
    updateStats();
    return;
  }

  cards.forEach(card => {
    let countInDisplay = 0;

    if (viewingDeck) {
      // Количество карт именно в просматриваемой колоде
      countInDisplay = viewingDeck.cards?.[card.id] || 0;
    } else if (activeDeckId && decksObj[activeDeckId]) {
      // Фоллбек — активная колода
      countInDisplay = decksObj[activeDeckId].cards?.[card.id] || 0;
    } else {
      // Ещё один фоллбек — сумма по всем колодам
      for (const deck of Object.values(decksObj)) {
        countInDisplay += deck.cards?.[card.id] || 0;
      }
    }
    
    const el = createCardElement(card, countInDisplay);
    grid.appendChild(el);
  });

  updateStats(viewingDeck);
  initTiltEffect();
}

/**
 * Создаёт элемент карты
 */
function createCardElement(card, count) {
  const div = document.createElement('div');
  div.className = 'card-item';
  div.setAttribute('data-tilt', 'true');
  div.setAttribute('data-card-id', card.id);
  div.setAttribute('data-rarity', card.rarity);
  div.style.cursor = 'pointer';
  
  const rarity = ui.getRarityBadge(card.rarity);
  const params = `💓${card.power?.resonance || 0} 🎯${card.power?.virtuosity || 0} 🧠${card.power?.profundity || 0} ⚖${card.power?.harmony || 0}`;
  
  div.innerHTML = `
    <div class="card-image" style="position:relative; overflow:hidden;">
      <div style="position:absolute; top:0; left:0; right:0; padding:6px 4px; background:rgba(50, 50, 50, 0.9); font-size:10px; font-weight:600; color:#d0d0d0; text-shadow:0 1px 3px rgba(0,0,0,0.95); z-index:10; border-bottom:1px solid rgba(200,200,200,0.15);">${params}</div>
      <div style="position:absolute; top:4px; right:4px; z-index:11; background:rgba(30,30,30,0.8); padding:3px 6px; border-radius:4px; font-size:11px; font-weight:600; color:${rarity.color}; border:1px solid ${rarity.color};">${count}</div>
      ${card.imageUrl ? `<img src="${card.imageUrl}" alt="${card.title}" style="width:100%; height:100%; object-fit:cover; object-position:center;" />` : '🎨'}
    </div>
    <div class="card-body" style="display:flex; flex-direction:column; min-height:0;">
      <div class="card-title" style="flex:1; overflow:hidden; display:flex; align-items:center; font-size:clamp(6px, 2.8vw, 11px); word-break:break-word; line-height:1.2;">${ui.sanitizeHTML(card.title)}</div>
      <div style="display:flex; justify-content:space-between; font-size:10px; color:var(--text-secondary); margin-bottom:6px; min-height:14px;">
        <span style="overflow:hidden; text-overflow:ellipsis;">${ui.sanitizeHTML(card.artist)}</span>
        <span>${card.year}</span>
      </div>
      <div class="card-rarity" style="background:${rarity.color}15; border-color:${rarity.color}; color:${rarity.color}; white-space:nowrap; text-align:center; font-size:10px;">
        ${rarity.emoji} ${rarity.name}
      </div>
    </div>
  `;
  
  div.style.borderColor = rarity.color;
  div.addEventListener('click', () => showCardDetail(card, count));
  
  return div;
}

/**
 * Инициализирует 3D Tilt
 */
function initTiltEffect() { /* ... без изменений ... */ }

// ... остальной код файла без изменений ...

/**
 * 🔥 ОБНОВЛЕНО: Обновляет статистику
 * Теперь показывает рейтинг ПРОСМАТРИВАЕМОЙ колоды
 */
function updateStats(viewingDeckOverride) {
  const { total, unique } = calculateStats();
  const decksObj = state.currentUser?.decks || {};

  let currentRating = 0;
  let viewingDeck = viewingDeckOverride;

  if (!viewingDeck) {
    const viewingDeckId = decks.getViewingDeckId?.() || null;
    if (viewingDeckId && decksObj[viewingDeckId]) {
      viewingDeck = decksObj[viewingDeckId];
    }
  }

  if (viewingDeck) {
    currentRating = decks.calculateDeckRating(viewingDeck.cards || {});
  } else {
    const activeDeckId = decks.activeDeckId || null;
    if (activeDeckId && decksObj[activeDeckId]) {
      currentRating = decks.calculateDeckRating(decksObj[activeDeckId].cards || {});
    }
  }
  
  const totalEl = document.getElementById('stat-total-cards');
  const uniqueEl = document.getElementById('stat-unique-cards');
  const ratingEl = document.getElementById('max-rating');
  
  if (totalEl) totalEl.textContent = total;
  if (uniqueEl) uniqueEl.textContent = unique;
  if (ratingEl) ratingEl.textContent = Math.round(currentRating);
}

export { initTiltEffect };
