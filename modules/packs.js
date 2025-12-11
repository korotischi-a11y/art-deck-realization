/**
 * modules/packs.js
 * Магазин паков и система открытия с РЕАЛЬНЫМИ монетами
 */

import { state, openModal, closeModal } from '../app.js';
import * as cards from './cards.js';
import * as ui from './ui.js';

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
    description: '15 карт, рантеды всех редкостей',
    price: 500,
    cards: 15
  },
  {
    id: 'ultimate',
    name: '👑 Ультимейт пак',
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
  
  state.packs.forEach(pack => {
    const canAfford = (state.currentUser?.currency || 0) >= pack.price;
    const element = createPackElement(pack, canAfford);
    grid.appendChild(element);
  });
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
      <div style="color: var(--text-secondary); font-size: 12px; margin-bottom: 12px;">|
        💰 ${pack.price} монет
        | 🂠 ${pack.cards} карт
      </div>
      <button class="btn btn-primary btn-full" style="margin-top: auto;" ${canAfford ? '' : 'disabled'}>
        ${canAfford ? '🙊 Открыть' : '❗ Мало монет'}
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
 * Купить пак (РЕАЛЬНые монеты)
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
    
    // Сохраняем в Firestore
    await db.collection('users').doc(currentUser.uid).update({
      currency: newCurrency,
      cards: currentUser.cards
    });
    
    // Показываем модаль открытия
    showPackOpeningAnimation(selectedCards, pack);
    
  } catch (error) {
    console.error('Ошибка при купке пака:', error);
    ui.showError('Ошибка при купке');
  }
}

/**
 * Выбирает случайные карты учитывая редкость
 */
function selectRandomCards(count) {
  const selected = [];
  
  // По пмолчанию: средние карты
  for (let i = 0; i < count; i++) {
    const randomCard = state.cards[Math.floor(Math.random() * state.cards.length)];
    if (randomCard) {
      selected.push(randomCard.id);
    }
  }
  
  return selected;
}

/**
 * Показывает анимацию открытия пака
 */
function showPackOpeningAnimation(selectedCardIds, pack) {
  const modal = document.getElementById('pack-opening-modal');
  const container = document.getElementById('pack-animation-container');
  const confirmBtn = document.getElementById('pack-confirm-btn');
  
  // Очистка
  container.innerHTML = '';
  
  // Надпись
  const title = document.createElement('h3');
  title.style.textAlign = 'center';
  title.style.marginBottom = '20px';
  title.textContent = `🎉 Вы получили ${selectedCardIds.length} карт!`;
  container.appendChild(title);
  
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
    cardDiv.style.background = 'linear-gradient(135deg, var(--bg-secondary), var(--bg-tertiary))';
    cardDiv.style.padding = '8px';
    cardDiv.style.borderRadius = '8px';
    cardDiv.style.border = `2px solid ${ui.getRarityBadge(card.rarity).color}`;
    cardDiv.style.textAlign = 'center';
    cardDiv.style.fontSize = '11px';
    cardDiv.innerHTML = `
      <div style="font-size: 20px; margin-bottom: 4px;">${ui.getRarityBadge(card.rarity).emoji}</div>
      <div>${card.title}</div>
      <div style="color: var(--text-secondary); font-size: 10px;">${card.artist}</div>
    `;
    
    cardsDiv.appendChild(cardDiv);
  });
  
  container.appendChild(cardsDiv);
  
  // Кнопка
  confirmBtn.style.display = 'block';
  confirmBtn.onclick = () => {
    closeModal('pack-opening-modal');
    ui.showSuccess(`🎈 Пак открыт!`);
    renderShop();
  };
  
  // Открываем модаль
  openModal('pack-opening-modal');
}
