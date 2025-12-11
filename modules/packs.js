/**
 * modules/packs.js
 * Магазин паков и система открытия
 * 
 * Фичи:
 * - РЕАЛЬНЫЕ монеты
 * - Бесплатное открытие в день (+50 монет)
 * - Награды до человек за новые карты
 */

import { state, openModal, closeModal } from '../app.js';
import * as cards from './cards.js';
import * as ui from './ui.js';
import * as app from '../app.js';

const db = firebase.firestore();

// Дефолтные паки
const DEFAULT_PACKS = [
  {
    id: 'starter',
    name: '🌟 Начинающий пак',
    description: '5 карт для начинающих',
    price: 100,
    cards: 5
  },
  {
    id: 'standard',
    name: '🎯 Нормальный пак',
    description: '10 карт, одна редкая',
    price: 250,
    cards: 10
  },
  {
    id: 'premium',
    name: '💎 Премиум пак',
    description: '15 карт, раритеты всех уровней',
    price: 500,
    cards: 15
  },
  {
    id: 'ultimate',
    name: '👑 Ултимейт пак',
    description: '20 карт, гарантированная легенда',
    price: 1000,
    cards: 20
  }
];

/**
 * Загружает паки
 */
export async function loadPacks() {
  state.packs = DEFAULT_PACKS;
}

/**
 * Отображает магазин паков
 */
export function renderShop() {
  const grid = document.getElementById('packs-grid');
  grid.innerHTML = '';
  
  // Добавляем бесплатное открытие
  const freeOpen = createFreeOpenElement();
  grid.appendChild(freeOpen);
  
  // Обычные паки
  state.packs.forEach(pack => {
    const canAfford = (state.currentUser?.currency || 0) >= pack.price;
    const element = createPackElement(pack, canAfford);
    grid.appendChild(element);
  });
}

/**
 * Создает элемент бесплатного открытия
 */
function createFreeOpenElement() {
  const div = document.createElement('div');
  div.className = 'card-item';
  
  const dailyFreeOpens = state.currentUser?.dailyFreeOpens || 0;
  const canUseToday = dailyFreeOpens > 0;
  
  div.style.cursor = canUseToday ? 'pointer' : 'not-allowed';
  div.style.opacity = canUseToday ? '1' : '0.6';
  div.style.borderColor = canUseToday ? 'var(--rarity-legendary)' : 'var(--border-color)';
  div.style.borderWidth = '2px';
  
  div.innerHTML = `
    <div class="card-image" style="background: linear-gradient(135deg, var(--rarity-legendary), var(--rarity-immortal));
    ">
      <div style="font-size: 48px;">🎉</div>
    </div>
    <div class="card-body">
      <div class="card-title" style="color: var(--rarity-legendary);">БЕСПЛАТНОЕ ОТКРЫТИЕ!</div>
      <div class="card-artist" style="margin: 8px 0;">🎁 Получите 5 случайных карт</div>
      <div style="color: var(--text-secondary); font-size: 12px; margin-bottom: 12px;">🗒 Один раз в день + 50 💎</div>
      <button class="btn btn-primary btn-full" style="margin-top: auto; background: var(--rarity-legendary);" ${canUseToday ? '' : 'disabled'}>
        ${canUseToday ? '🎉 Открыть!' : '⏳ Доступно завтра'}
      </button>
    </div>
  `;
  
  const btn = div.querySelector('.btn');
  if (canUseToday) {
    btn.addEventListener('click', () => openDailyFreeCard());
  }
  
  return div;
}

/**
 * Открыть бесплатную карту на день
 */
async function openDailyFreeCard() {
  const { currentUser } = state;
  if (!currentUser || !currentUser.dailyFreeOpens || currentUser.dailyFreeOpens <= 0) {
    ui.showError('Нет доступных бесплатных открытий');
    return;
  }
  
  try {
    // Выбираем 5 случайных карт
    const selectedCards = selectRandomCards(5, 'common');
    
    if (selectedCards.length === 0) {
      ui.showError('Нет карт для открытия');
      return;
    }
    
    // Обновляем коллекцию карт
    selectedCards.forEach(cardId => {
      currentUser.cards[cardId] = (currentUser.cards[cardId] || 0) + 1;
    });
    
    // Уменьшаем количество бесплатных открытий
    const newDailyFreeOpens = (currentUser.dailyFreeOpens || 1) - 1;
    
    // Начисляем +50 монет за открытие!
    const newCurrency = (currentUser.currency || 0) + 50;
    currentUser.currency = newCurrency;
    currentUser.dailyFreeOpens = newDailyFreeOpens;
    
    // Сохраняем в Firestore
    await db.collection('users').doc(currentUser.uid).update({
      cards: currentUser.cards,
      currency: newCurrency,
      dailyFreeOpens: newDailyFreeOpens
    });
    
    // Обновляем интерфейс
    app.updateUserInterface();
    
    // Показываем модаль
    showPackOpeningAnimation(selectedCards, { name: 'БЕСПЛАТНОЕ ОТКРЫТИЕ!' });
    
    // Проверяем миссии
    app.checkQuestCompletion();
    
  } catch (error) {
    console.error('Ошибка при открытии бесплатной карты:', error);
    ui.showError('Ошибка при открытии');
  }
}

/**
 * Создает DOM-элемент пака
 */
function createPackElement(pack, canAfford) {
  const div = document.createElement('div');
  div.className = 'card-item';
  div.style.cursor = canAfford ? 'pointer' : 'not-allowed';
  div.style.opacity = canAfford ? '1' : '0.6';
  
  div.innerHTML = `
    <div class="card-image" style="background: linear-gradient(135deg, var(--wood-light), var(--wood-dark));">
      <div style="font-size: 48px;">🎁</div>
    </div>
    <div class="card-body">
      <div class="card-title">${pack.name}</div>
      <div class="card-artist" style="margin: 8px 0;">${pack.description}</div>
      <div style="color: var(--text-secondary); font-size: 12px; margin-bottom: 12px;">💰 ${pack.price} 💎 | 🂠 ${pack.cards} карт</div>
      <button class="btn btn-primary btn-full" style="margin-top: auto;" ${canAfford ? '' : 'disabled'}>
        ${canAfford ? '🚫 Открыть' : '❌ Мало монет'}
      </button>
    </div>
  `;
  
  const btn = div.querySelector('.btn');
  if (canAfford) {
    btn.addEventListener('click', () => buyPack(pack));
  }
  
  return div;
}

/**
 * Купить пак (РЕАЛЬНЫЕ монеты)
 */
async function buyPack(pack) {
  const { currentUser } = state;
  if (!currentUser) return;
  
  // Проверяем количество монет
  if ((currentUser.currency || 0) < pack.price) {
    ui.showError('Недостаточно монет');
    return;
  }
  
  try {
    // Выбираем случайные карты
    const selectedCards = selectRandomCards(pack.cards);
    
    if (selectedCards.length === 0) {
      ui.showError('Нет карт для открытия');
      return;
    }
    
    // Обновляем количество монет
    const newCurrency = (currentUser.currency || 0) - pack.price;
    currentUser.currency = newCurrency;
    
    // Обновляем коллекцию карт
    selectedCards.forEach(cardId => {
      currentUser.cards[cardId] = (currentUser.cards[cardId] || 0) + 1;
    });
    
    // Добавляем награду за новые карты (+10 за каждую)
    let reward = 0;
    selectedCards.forEach(cardId => {
      // Проверяем, новая ли это карта для игрока
      const wasNew = !state.currentUser.cards[cardId];
      if (wasNew) reward += 10;
    });
    
    const finalCurrency = newCurrency + reward;
    currentUser.currency = finalCurrency;
    
    // Сохраняем в Firestore
    await db.collection('users').doc(currentUser.uid).update({
      currency: finalCurrency,
      cards: currentUser.cards,
      packsOpened: (state.currentUser.packsOpened || 0) + 1
    });
    
    // Обновляем интерфейс
    app.updateUserInterface();
    
    // Показываем модаль открытия
    showPackOpeningAnimation(selectedCards, pack, reward);
    
    // Проверяем миссии
    app.checkQuestCompletion();
    
  } catch (error) {
    console.error('Ошибка при купке пака:', error);
    ui.showError('Ошибка при купке');
  }
}

/**
 * Выбирает случайные карты учитывая редкость
 */
function selectRandomCards(count, rarityFilter = null) {
  const selected = [];
  const filtered = rarityFilter ? state.cards.filter(c => c.rarity === rarityFilter) : state.cards;
  
  // Выбираем случайные карты
  for (let i = 0; i < count; i++) {
    const randomCard = filtered[Math.floor(Math.random() * filtered.length)];
    if (randomCard) {
      selected.push(randomCard.id);
    }
  }
  
  return selected;
}

/**
 * Показывает анимацию открытия пака
 */
function showPackOpeningAnimation(selectedCardIds, pack, reward = 0) {
  const modal = document.getElementById('pack-opening-modal');
  const container = document.getElementById('pack-animation-container');
  const confirmBtn = document.getElementById('pack-confirm-btn');
  
  // Очистка
  container.innerHTML = '';
  
  // Надпись
  const title = document.createElement('h3');
  title.style.textAlign = 'center';
  title.style.marginBottom = '10px';
  title.textContent = `🎉 ${pack.name}`;
  title.style.color = 'var(--wood-light)';
  container.appendChild(title);
  
  // Награда за новые карты
  if (reward > 0) {
    const rewardDiv = document.createElement('div');
    rewardDiv.style.textAlign = 'center';
    rewardDiv.style.color = 'var(--rarity-legendary)';
    rewardDiv.style.marginBottom = '12px';
    rewardDiv.style.fontSize = '14px';
    rewardDiv.style.fontWeight = 'bold';
    rewardDiv.textContent = `БОНУС: +${reward} 💎 за новые карты!`;
    container.appendChild(rewardDiv);
  }
  
  // Карты
  const cardsDiv = document.createElement('div');
  cardsDiv.style.display = 'grid';
  cardsDiv.style.gridTemplateColumns = 'repeat(auto-fit, minmax(100px, 1fr))';
  cardsDiv.style.gap = '12px';
  cardsDiv.style.marginBottom = '20px';
  
  selectedCardIds.forEach(cardId => {
    const card = state.cards.find(c => c.id === cardId);
    if (!card) return;
    
    const cardDiv = document.createElement('div');
    const rarity = ui.getRarityBadge(card.rarity);
    cardDiv.style.background = 'linear-gradient(135deg, var(--bg-secondary), var(--bg-tertiary))';
    cardDiv.style.padding = '8px';
    cardDiv.style.borderRadius = '8px';
    cardDiv.style.border = `2px solid ${rarity.color}`;
    cardDiv.style.textAlign = 'center';
    cardDiv.style.fontSize = '11px';
    cardDiv.innerHTML = `
      <div style="font-size: 20px; margin-bottom: 4px;">${rarity.emoji}</div>
      <div style="font-weight: 600;">${card.title}</div>
      <div style="color: var(--text-secondary); font-size: 10px;">${card.artist}</div>
    `;
    
    cardsDiv.appendChild(cardDiv);
  });
  
  container.appendChild(cardsDiv);
  
  // Кнопка
  confirmBtn.style.display = 'block';
  confirmBtn.onclick = () => {
    closeModal('pack-opening-modal');
    ui.showSuccess(`🎁 Пак открыт!`);
    renderShop();
  };
  
  // Открываем модаль
  openModal('pack-opening-modal');
}
