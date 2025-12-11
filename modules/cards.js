/**
 * modules/cards.js
 * Обработка карт и коллекций
 * 
 * Ответственность:
 * - Загружа все карты из masterCards
 * - Рендер сетки карт
 * - Расчет силы колоды и рейтинга
 * - Детали карты
 */

import { state, closeModal, openModal } from '../app.js';
import * as ui from './ui.js';

const db = firebase.firestore();

/**
 * Загружает все карты из базы
 */
export async function loadCards() {
  console.log('🎨 Загружаю карты...');
  try {
    const snapshot = await db.collection('masterCards')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();
    
    state.cards = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log(`✔️ Загружено ${state.cards.length} карт`);
  } catch (error) {
    console.error('Ошибка загружки карт:', error);
    ui.showError('Ошибка загружки карт');
  }
}

/**
 * Находит карту по ID
 */
function getCard(cardId) {
  return state.cards.find(card => card.id === cardId);
}

/**
 * Получает количество карт в коллекции пользователя
 */
function getCardCount(cardId) {
  return state.currentUser?.cards[cardId] || 0;
}

/**
 * Обновляет количество карты в коллекции
 */
export async function updateCardCount(cardId, newCount) {
  if (!state.currentUser) return;
  
  try {
    const cards = { ...state.currentUser.cards };
    
    if (newCount > 0) {
      cards[cardId] = newCount;
    } else {
      delete cards[cardId];
    }
    
    state.currentUser.cards = cards;
    
    // Обновляем в Firestore
    await db.collection('users').doc(state.currentUser.uid).update({
      cards
    });
  } catch (error) {
    console.error('Ошибка обновления карты:', error);
  }
}

/**
 * Рендерит сетку карт в коллекции
 */
export function renderCollection() {
  const grid = document.getElementById('cards-grid');
  const rarityFilter = document.getElementById('rarity-filter').value;
  
  // Очистка сетки
  grid.innerHTML = '';
  
  // Фильтрация
  let filteredCards = state.cards;
  if (rarityFilter) {
    filteredCards = state.cards.filter(card => card.rarity === rarityFilter);
  }
  
  if (filteredCards.length === 0) {
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 40px;">🤷 Ни одной карты не найдено</div>';
    return;
  }
  
  // Рендер карт
  filteredCards.forEach(card => {
    const count = getCardCount(card.id);
    const element = createCardElement(card, count);
    grid.appendChild(element);
  });
  
  // Обновляю статистику
  updateCollectionStats();
}

/**
 * Создает DOM-элемент карты
 */
function createCardElement(card, count) {
  const div = document.createElement('div');
  div.className = 'card-item';
  
  // Редкость карты
  const rarity = ui.getRarityBadge(card.rarity);
  const borderColor = rarity.color;
  
  // HTML карты
  div.innerHTML = `
    <div class="card-image">
      ${card.imageUrl ? `<img src="${card.imageUrl}" alt="${card.title}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22%3E%3C/svg%3E'">` : `<div style="font-size: 48px;">🎨</div>`}
    </div>
    <div class="card-body">
      <div class="card-title">${ui.sanitizeHTML(card.title)}</div>
      <div class="card-artist">${ui.sanitizeHTML(card.artist)} (${card.year})</div>
      <div class="card-rarity" style="background-color: ${rarity.color}15; border-color: ${rarity.color}; color: ${rarity.color};">
        ${rarity.emoji} ${rarity.name}
      </div>
      <div class="card-stats">
        <div class="card-stat" style="color: var(--resonance);">💓 ${card.power?.resonance || 0}</div>
        <div class="card-stat" style="color: var(--virtuosity);">🎯 ${card.power?.virtuosity || 0}</div>
        <div class="card-stat" style="color: var(--profundity);">🧠 ${card.power?.profundity || 0}</div>
        <div class="card-stat" style="color: var(--harmony);">⚖️ ${card.power?.harmony || 0}</div>
      </div>
      <div class="card-count" style="border-color: ${borderColor}; color: ${borderColor};">
        ${count} шт.
      </div>
    </div>
  `;
  
  // Обновляем стиль карт по редкости
  div.style.borderColor = borderColor;
  
  // Событие клика
  div.addEventListener('click', () => showCardDetail(card, count));
  
  return div;
}

/**
 * Показывает модальное окно с деталями карты
 */
function showCardDetail(card, count) {
  const modal = document.getElementById('card-detail-modal');
  const rarity = ui.getRarityBadge(card.rarity);
  
  // Заполняем данные
  document.getElementById('modal-card-title').textContent = card.title;
  document.getElementById('modal-card-artist').textContent = card.artist;
  document.getElementById('modal-card-year').textContent = `Год: ${card.year}`;
  document.getElementById('modal-card-description').textContent = card.description;
  
  // Изображение
  const img = document.getElementById('modal-card-image');
  img.src = card.imageUrl || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22%3E%3C/svg%3E';
  
  // Редкость
  const rarityDiv = document.getElementById('modal-card-rarity');
  rarityDiv.innerHTML = `${rarity.emoji} ${rarity.name}`;
  rarityDiv.style.backgroundColor = `${rarity.color}15`;
  rarityDiv.style.borderColor = rarity.color;
  rarityDiv.style.color = rarity.color;
  
  // Параметры
  const params = [
    { id: 'resonance', value: card.power?.resonance || 0, color: 'var(--resonance)' },
    { id: 'virtuosity', value: card.power?.virtuosity || 0, color: 'var(--virtuosity)' },
    { id: 'profundity', value: card.power?.profundity || 0, color: 'var(--profundity)' },
    { id: 'harmony', value: card.power?.harmony || 0, color: 'var(--harmony)' }
  ];
  
  params.forEach(param => {
    document.getElementById(`modal-${param.id}`).textContent = `${param.value}/10`;
    document.getElementById(`modal-${param.id}-bar`).style.width = (param.value * 10) + '%';
  });
  
  // Количество в коллекции
  document.getElementById('modal-card-count').textContent = `В коллекции: ${count} шт.`;
  
  // Открываем модаль
  openModal('card-detail-modal');
}

/**
 * === СИСТЕМА РАСЧЕТА СИЛЫ КОЛОДЫ ===
 * 
 * Рейтинг Колоды = (Уникальность + Сила/10) × Множитель Бонусов
 * 
 * где:
 *   Множитель Бонусов = 1 + Бонус Эр + Бонус Художников + Бонус Редкостей
 */

/**
 * Рассчитывает уникальность коллекции
 */
function calculateUniqueness() {
  const cards = state.currentUser?.cards || {};
  const uniqueCards = Object.keys(cards).length;
  const totalCards = Object.values(cards).reduce((a, b) => a + b, 0);
  
  if (totalCards === 0) return 0;
  
  const uniquenessRatio = uniqueCards / totalCards;
  
  // Бонус за диверсификацию
  let uniquenessBonus = 1.0;
  if (uniqueCards > 20) uniquenessBonus = 1.5;
  else if (uniqueCards > 10) uniquenessBonus = 1.25;
  
  return (uniquenessRatio * 100) * uniquenessBonus;
}

/**
 * Рассчитывает суммарную силу карт
 */
function calculatePower() {
  const cards = state.currentUser?.cards || {};
  const rarityMultipliers = {
    'common': 1.0,
    'uncommon': 1.25,
    'rare': 1.5,
    'mythical': 1.75,
    'legendary': 2.0,
    'ancient': 2.25,
    'exceedingly_rare': 2.5,
    'immortal': 3.0
  };
  
  let totalPower = 0;
  
  Object.entries(cards).forEach(([cardId, count]) => {
    const card = getCard(cardId);
    if (!card) return;
    
    const cardPower = (card.power?.resonance || 0) +
                      (card.power?.virtuosity || 0) +
                      (card.power?.profundity || 0) +
                      (card.power?.harmony || 0);
    
    const multiplier = rarityMultipliers[card.rarity] || 1.0;
    totalPower += cardPower * multiplier * count;
  });
  
  return totalPower / 10;
}

/**
 * Рассчитывает бонус за разнообразие эпох
 */
function calculateEraBonus() {
  const cards = state.currentUser?.cards || {};
  const eraSet = new Set();
  
  Object.keys(cards).forEach(cardId => {
    const card = getCard(cardId);
    if (card) eraSet.add(card.year);
  });
  
  return Math.min(eraSet.size * 0.05, 0.5);
}

/**
 * Рассчитывает бонус за синергию художников
 */
function calculateArtistBonus() {
  const cards = state.currentUser?.cards || {};
  const artistMap = {};
  
  Object.keys(cards).forEach(cardId => {
    const card = getCard(cardId);
    if (card) {
      artistMap[card.artist] = (artistMap[card.artist] || 0) + 1;
    }
  });
  
  const artistsWithMultiple = Object.values(artistMap)
    .filter(count => count >= 2).length;
  
  return Math.min(artistsWithMultiple * 0.1, 0.6);
}

/**
 * Рассчитывает бонус за распределение редкостей
 */
function calculateRarityBonus() {
  const cards = state.currentUser?.cards || {};
  const raritySet = new Set();
  
  Object.keys(cards).forEach(cardId => {
    const card = getCard(cardId);
    if (card) raritySet.add(card.rarity);
  });
  
  return Math.min(raritySet.size * 0.1, 0.8);
}

/**
 * Рассчитывает общий рейтинг колоды
 */
export function calculateDeckRating() {
  const uniqueness = calculateUniqueness();
  const power = calculatePower();
  
  const eraBonus = calculateEraBonus();
  const artistBonus = calculateArtistBonus();
  const rarityBonus = calculateRarityBonus();
  
  const bonusMultiplier = 1 + eraBonus + artistBonus + rarityBonus;
  
  return (uniqueness + power) * bonusMultiplier;
}

/**
 * Получает информацию о разложении рейтинга
 */
export function getDeckRatingBreakdown() {
  return {
    uniqueness: calculateUniqueness(),
    power: calculatePower(),
    eraBonus: calculateEraBonus(),
    artistBonus: calculateArtistBonus(),
    rarityBonus: calculateRarityBonus(),
    total: calculateDeckRating()
  };
}

/**
 * Обновляет статистику коллекции
 */
function updateCollectionStats() {
  const cards = state.currentUser?.cards || {};
  const totalCards = Object.values(cards).reduce((a, b) => a + b, 0);
  const uniqueCards = Object.keys(cards).length;
  const deckRating = calculateDeckRating();
  
  document.getElementById('stat-total-cards').textContent = totalCards;
  document.getElementById('stat-unique-cards').textContent = uniqueCards;
  document.getElementById('stat-deck-rating').textContent = Math.round(deckRating);
}
