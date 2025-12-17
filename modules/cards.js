/**
 * modules/cards.js
 * Обработка карт и коллекций
 * 
 * Ответственность:
 * - Загружа все карты из masterCards
 * - Нендер сетки карт из коллекции или активной колоды пользователя
 * - Расчет силы колоды и рейтинга
 * - Открытие нового модального окна с полной информацией
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
      .limit(1000)
      .get();
    
    state.cards = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log(`✔️ Загружено ${state.cards.length} карт`);
  } catch (error) {
    console.error('Ошибка загрузки карт:', error);
    ui.showError('Ошибка загрузки карт');
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
 * Нендерит сетку карт
 * 
 * НОВОЕ:
 * - Обычные пользователи видят карты ИЗ АКТИВНОЙ КОЛОДЫ (если выбрана)
 * - Админы видят ВСЕ созданные карты 
 * - Если нет активной колоды, показываем глобальнюю коллекцию
 */
export function renderCollection() {
  const grid = document.getElementById('cards-grid');
  const rarityFilter = document.getElementById('rarity-filter').value;
  
  // Очистка сетки
  grid.innerHTML = '';
  
  let cardsToDisplay;
  
  // Основная логика: активная колода
  if (state.currentUser?.activeDeckId && state.currentUser.decks?.[state.currentUser.activeDeckId]) {
    // Карты ИЗ активной колоды
    const activeDeck = state.currentUser.decks[state.currentUser.activeDeckId];
    const deckCardIds = Object.keys(activeDeck.cards || {});
    cardsToDisplay = deckCardIds.map(cardId => getCard(cardId)).filter(card => card !== undefined);
  } else if (state.isAdmin) {
    // Админы видят ВСЕ
    cardsToDisplay = state.cards;
  } else {
    // Обычные пользователи - глобальная коллекция
    const userCardIds = Object.keys(state.currentUser?.cards || {});
    cardsToDisplay = userCardIds.map(cardId => getCard(cardId)).filter(card => card !== undefined);
  }
  
  // Применяем фильтр редкости
  let filteredCards = cardsToDisplay;
  if (rarityFilter) {
    filteredCards = cardsToDisplay.filter(card => card.rarity === rarityFilter);
  }
  
  if (filteredCards.length === 0) {
    const message = state.isAdmin 
      ? '📦 Не создано карт' 
      : '🤷 Ни одной карты не найдено';
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 40px;">${message}</div>`;
    return;
  }
  
  // Нендер карт
  filteredCards.forEach(card => {
    // Количество в активной колоде или глобально
    let count;
    if (state.currentUser?.activeDeckId) {
      count = state.currentUser.decks[state.currentUser.activeDeckId].cards[card.id] || 0;
    } else {
      count = getCardCount(card.id);
    }
    
    const element = createCardElement(card, count);
    grid.appendChild(element);
  });
  
  // Обновляю статистику
  updateCollectionStats();
}

/**
 * Создает DOM-элемент карты
 * НОВОЕ: добавлен data-tilt для 3D эффекта
 */
function createCardElement(card, count) {
  const div = document.createElement('div');
  div.className = 'card-item';
  div.setAttribute('data-tilt', 'true');  // для tilted эффекта
  
  // Нередкость карты
  const rarity = ui.getRarityBadge(card.rarity);
  const borderColor = rarity.color;
  
  // Добавляем data-rarity атрибут
  div.setAttribute('data-rarity', card.rarity);
  
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
        ${count > 0 ? `${count} шт.` : (state.isAdmin ? '📋 Превью' : '0 шт.')}
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
 * Показывает новое модальное окно с ПОЛНОЙ информацией карты
 */
function showCardDetail(card, count) {
  const modal = document.getElementById('card-detail-modal');
  if (!modal) return;
  
  const rarity = ui.getRarityBadge(card.rarity);
  
  // Основная информация
  document.getElementById('modal-card-title').textContent = card.title;
  document.getElementById('modal-card-artist').textContent = card.artist;
  document.getElementById('modal-card-year').textContent = `Год: ${card.year}`;
  document.getElementById('modal-card-description').textContent = card.description;
  
  // Изображение
  const img = document.getElementById('modal-card-image');
  img.src = card.imageUrl || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22%3E%3C/svg%3E';
  
  // Клик на изображение - открываем fullscreen
  img.style.cursor = 'pointer';
  img.onclick = () => openFullscreenImage(card.imageUrl);
  
  // Редкость
  const rarityDiv = document.getElementById('modal-card-rarity');
  rarityDiv.innerHTML = `${rarity.emoji} ${rarity.name}`;
  rarityDiv.style.backgroundColor = `${rarity.color}15`;
  rarityDiv.style.borderColor = rarity.color;
  rarityDiv.style.color = rarity.color;
  
  // Параметры (динамически)
  const params = [
    { name: '💓 Резонанс', value: card.power?.resonance || 0, color: 'var(--resonance)' },
    { name: '🎯 Виртуозность', value: card.power?.virtuosity || 0, color: 'var(--virtuosity)' },
    { name: '🧠 Глубина', value: card.power?.profundity || 0, color: 'var(--profundity)' },
    { name: '⚖️ Гармония', value: card.power?.harmony || 0, color: 'var(--harmony)' }
  ];
  
  // Очистим старые параметры и создаем новые
  const paramsContainer = document.getElementById('modal-card-params') || createParamsContainer();
  paramsContainer.innerHTML = '';
  
  params.forEach((param, idx) => {
    const paramEl = document.createElement('div');
    paramEl.style.cssText = `margin-bottom: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; align-items: center;`;
    
    const label = document.createElement('div');
    label.style.cssText = `font-size: 12px; font-weight: 600; color: ${param.color};`;
    label.textContent = param.name;
    
    const bar = document.createElement('div');
    bar.style.cssText = `height: 8px; background-color: var(--bg-tertiary); border-radius: 4px; overflow: hidden;`;
    
    const fill = document.createElement('div');
    fill.style.cssText = `height: 100%; background-color: ${param.color}; width: ${(param.value / 10) * 100}%; border-radius: 4px; transition: width 0.3s ease;`;
    
    const value = document.createElement('div');
    value.style.cssText = `text-align: right; font-weight: 600; font-size: 12px; color: ${param.color};`;
    value.textContent = `${param.value}/10`;
    
    bar.appendChild(fill);
    paramEl.appendChild(label);
    paramEl.appendChild(bar);
    paramEl.appendChild(value);
    paramsContainer.appendChild(paramEl);
  });
  
  // Количество в контексте
  const countText = state.isAdmin && count === 0 
    ? `📋 создана админом` 
    : (state.currentUser?.activeDeckId 
      ? `В колоде: ${count} шт.` 
      : `В коллекции: ${count} шт.`);
  document.getElementById('modal-card-count').textContent = countText;
  
  // Открываем модаль
  openModal('card-detail-modal');
}

/**
 * Открывает изображение на полный экран
 */
function openFullscreenImage(imageUrl) {
  const fullscreenModal = document.getElementById('modal-fullscreen-image') || createFullscreenModal();
  fullscreenModal.style.display = 'flex';
  const img = fullscreenModal.querySelector('img');
  img.src = imageUrl;
}

/**
 * Создает контейнер для параметров
 */
function createParamsContainer() {
  const container = document.createElement('div');
  container.id = 'modal-card-params';
  const modalContent = document.querySelector('.modal-content');
  if (modalContent && modalContent.querySelector('#modal-card-count')) {
    const before = modalContent.querySelector('#modal-card-count').parentElement;
    before.parentElement.insertBefore(container, before);
  }
  return container;
}

/**
 * создает полноэкранное окно для изображения
 */
function createFullscreenModal() {
  const modal = document.createElement('div');
  modal.id = 'modal-fullscreen-image';
  modal.className = 'modal-fullscreen-image';
  modal.innerHTML = `
    <button class="modal-fullscreen-close">✕</button>
    <img src="" alt="fullscreen">
  `;
  
  modal.querySelector('.modal-fullscreen-close').addEventListener('click', () => {
    modal.style.display = 'none';
  });
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.style.display = 'none';
  });
  
  document.body.appendChild(modal);
  return modal;
}

/**
 * === СИСТЕМА РАСЧЕТА СИЛЫ КОЛОДЫ ===
 * 
 * Рейтинг Колоды = (Уникальность + Сила/10) × Множитель Бонусов
 * 
 * где:
 *   Множитель Бонусов = 1 + Бонус Эр + Бонус Художников + Бонус Нередкостей
 */

/**
 * Получит рейтинг для импорта из user.js
 */
export function calculateDeckRating() {
  return calculateDeckRatingInternal();
}

/**
 * Внутренняя реализация
 */
function calculateDeckRatingInternal() {
  // Определяем какая колода рассчитывается
  let deckCards;
  if (state.currentUser?.activeDeckId && state.currentUser.decks?.[state.currentUser.activeDeckId]) {
    deckCards = state.currentUser.decks[state.currentUser.activeDeckId].cards;
  } else {
    deckCards = state.currentUser?.cards || {};
  }
  
  const uniqueness = calculateUniqueness(deckCards);
  const power = calculatePower(deckCards);
  
  const eraBonus = calculateEraBonus(deckCards);
  const artistBonus = calculateArtistBonus(deckCards);
  const rarityBonus = calculateRarityBonus(deckCards);
  
  const bonusMultiplier = 1 + eraBonus + artistBonus + rarityBonus;
  
  return (uniqueness + power) * bonusMultiplier;
}

/**
 * Получает информацию о разложении рейтинга
 */
export function getDeckRatingBreakdown() {
  let deckCards;
  if (state.currentUser?.activeDeckId && state.currentUser.decks?.[state.currentUser.activeDeckId]) {
    deckCards = state.currentUser.decks[state.currentUser.activeDeckId].cards;
  } else {
    deckCards = state.currentUser?.cards || {};
  }
  
  return {
    uniqueness: calculateUniqueness(deckCards),
    power: calculatePower(deckCards),
    eraBonus: calculateEraBonus(deckCards),
    artistBonus: calculateArtistBonus(deckCards),
    rarityBonus: calculateRarityBonus(deckCards),
    total: calculateDeckRatingInternal()
  };
}

/**
 * Рассчитывает уникальность колоды
 */
function calculateUniqueness(deckCards) {
  const uniqueCards = Object.keys(deckCards).length;
  const totalCards = Object.values(deckCards).reduce((a, b) => a + b, 0);
  
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
function calculatePower(deckCards) {
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
  
  Object.entries(deckCards).forEach(([cardId, count]) => {
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
function calculateEraBonus(deckCards) {
  const eraSet = new Set();
  
  Object.keys(deckCards).forEach(cardId => {
    const card = getCard(cardId);
    if (card) eraSet.add(card.year);
  });
  
  return Math.min(eraSet.size * 0.05, 0.5);
}

/**
 * Рассчитывает бонус за синергию художников
 */
function calculateArtistBonus(deckCards) {
  const artistMap = {};
  
  Object.keys(deckCards).forEach(cardId => {
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
function calculateRarityBonus(deckCards) {
  const raritySet = new Set();
  
  Object.keys(deckCards).forEach(cardId => {
    const card = getCard(cardId);
    if (card) raritySet.add(card.rarity);
  });
  
  return Math.min(raritySet.size * 0.1, 0.8);
}

/**
 * Обновляет статистику коллекции
 */
function updateCollectionStats() {
  let deckCards;
  if (state.currentUser?.activeDeckId && state.currentUser.decks?.[state.currentUser.activeDeckId]) {
    deckCards = state.currentUser.decks[state.currentUser.activeDeckId].cards;
  } else {
    deckCards = state.currentUser?.cards || {};
  }
  
  const totalCards = Object.values(deckCards).reduce((a, b) => a + b, 0);
  const uniqueCards = Object.keys(deckCards).length;
  const deckRating = calculateDeckRatingInternal();
  
  document.getElementById('stat-total-cards').textContent = totalCards;
  document.getElementById('stat-unique-cards').textContent = uniqueCards;
  document.getElementById('stat-deck-rating').textContent = Math.round(deckRating);
}
