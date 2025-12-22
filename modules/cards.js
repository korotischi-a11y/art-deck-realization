/**
 * modules/cards.js - Карты и коллекция
 */

import { state, closeModal, openModal } from '../app.js';
import * as ui from './ui.js';
import * as decks from './decks.js';

const db = firebase.firestore();

/**
 * 💎 ЦЕНЫ ЗА ПОРВАННЫЕ КАРТЫ
 */
const TEAR_PRICES = {
  common:           { base: 1,   ratingMultiplier: 0.20 },
  uncommon:         { base: 2,   ratingMultiplier: 0.50 },
  rare:             { base: 3,   ratingMultiplier: 0.29 },
  mythical:         { base: 7,   ratingMultiplier: 0.26 },
  legendary:        { base: 12,  ratingMultiplier: 0.20 },
  ancient:          { base: 20,  ratingMultiplier: 0.30 },
  ethereal:         { base: 45,  ratingMultiplier: 1.00 },
  immortal:         { base: 100, ratingMultiplier: 1.30 }
};

/**
 * 🎨 Получить бейдж для theme
 */
function getThemeLabel(theme) {
  const themes = {
    impressionism: { emoji: '🌻', name: 'Импрессионизм', color: '#ffb347' },
    renaissance: { emoji: '🏰', name: 'Ренессанс', color: '#daa520' },
    surrealism: { emoji: '🌙', name: 'Сюрреализм', color: '#9b59b6' },
    abstract: { emoji: '🎨', name: 'Абстракционизм', color: '#e74c3c' },
    realism: { emoji: '🖼️', name: 'Реализм', color: '#8b4513' },
    modernism: { emoji: '✨', name: 'Модернизм', color: '#3498db' },
    baroque: { emoji: '👑', name: 'Барокко', color: '#ffd700' },
    romanticism: { emoji: '🌹', name: 'Романтизм', color: '#e91e63' },
    cubism: { emoji: '🟦', name: 'Кубизм', color: '#f39c12' },
    expressionism: { emoji: '🔥', name: 'Экспрессионизм', color: '#ff5722' },
    contemporary: { emoji: '🔮', name: 'Современное искусство', color: '#00bcd4' }
  };
  return themes[theme] || { emoji: '❓', name: theme || 'Unknown', color: '#999' };
}

/**
 * 🎭 Получить бейдж для genre
 */
function getGenreLabel(genre) {
  const genres = {
    portrait: { emoji: '👤', name: 'Портрет', role: 'Hero', color: '#3b82f6' },
    landscape: { emoji: '🌄', name: 'Пейзаж', role: 'Dream', color: '#10b981' },
    still_life: { emoji: '🍎', name: 'Натюрморт', role: 'Heal', color: '#84cc16' },
    religious: { emoji: '⛪', name: 'Религиозный', role: 'Divine', color: '#fbbf24' },
    mythological: { emoji: '🐉', name: 'Мифология', role: 'Epic', color: '#a855f7' },
    abstract: { emoji: '🎨', name: 'Абстракция', role: 'Chaos', color: '#ef4444' },
    urban: { emoji: '🏛️', name: 'Бытовой жанр', role: 'Stability', color: '#6366f1' },
    nude: { emoji: '💃', name: 'Ню', role: 'Beauty', color: '#ec4899' }
  };
  return genres[genre] || { emoji: '❓', name: genre || 'Unknown', role: '?', color: '#999' };
}

function calculateTearPrice(card) {
  if (!card || !card.rarity) return 0;
  const priceData = TEAR_PRICES[card.rarity];
  if (!priceData) return 0;
  const cardRating = calculateCardRating(card);
  const price = priceData.base + (cardRating * priceData.ratingMultiplier);
  return Math.round(price);
}

function calculateCardRating(card) {
  if (!card.power) return 0;
  const { resonance = 0, virtuosity = 0, profundity = 0, harmony = 0 } = card.power;
  return Math.round((resonance + virtuosity + profundity + harmony) / 4 * 10);
}

export async function loadCards() {
  console.log('🎁 Loading cards...');
  try {
    const snap = await db.collection('masterCards')
      .orderBy('createdAt', 'desc')
      .limit(1000)
      .get();
    state.cards = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log(`✅ Loaded ${state.cards.length} cards`);
  } catch (e) {
    console.error('Error loading cards:', e);
    ui.showError('Error loading cards');
  }
}

function getCard(cardId) {
  return state.cards.find(c => c.id === cardId);
}

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
  return { total: totalInAllDecks, unique: uniqueCardIds.size };
}

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
  return { inDecks, inDecksTotal: totalInAllDecks };
}

export function renderCollection() {
  const grid = document.getElementById('cards-grid');
  const filter = document.getElementById('rarity-filter')?.value || '';
  if (!grid) return;
  grid.innerHTML = '';

  const decksObj = state.currentUser?.decks || {};
  const viewingDeckId = decks.getViewingDeckId?.() || null;
  const activeDeckId = decks.activeDeckId || null;

  let viewingDeck = viewingDeckId ? decksObj[viewingDeckId] : null;
  if (!viewingDeck && activeDeckId) viewingDeck = decksObj[activeDeckId];

  let userCardIds = [];
  let title = 'Вся коллекция';

  if (viewingDeck) {
    userCardIds = Object.keys(viewingDeck.cards || {});
    title = viewingDeck.isDiscardDeck ? '🗑 Карты без колод' : `🎴 ${viewingDeck.name}`;
  } else {
    const allCardIds = new Set();
    for (const deck of Object.values(decksObj)) {
      for (const cardId of Object.keys(deck.cards || {})) allCardIds.add(cardId);
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
    updateStats(viewingDeck);
    return;
  }

  cards.forEach(card => {
    let countInDisplay = 0;
    if (viewingDeck) {
      countInDisplay = viewingDeck.cards?.[card.id] || 0;
    } else if (activeDeckId && decksObj[activeDeckId]) {
      countInDisplay = decksObj[activeDeckId].cards?.[card.id] || 0;
    } else {
      for (const deck of Object.values(decksObj)) {
        countInDisplay += deck.cards?.[card.id] || 0;
      }
    }
    grid.appendChild(createCardElement(card, countInDisplay));
  });

  updateStats(viewingDeck);
  initTiltEffect();
}

function createCardElement(card, count) {
  const div = document.createElement('div');
  div.className = 'card-item';
  div.setAttribute('data-tilt', 'true');
  div.setAttribute('data-card-id', card.id);
  div.setAttribute('data-rarity', card.rarity);
  div.style.cursor = 'pointer';

  const rarity = ui.getRarityBadge(card.rarity);
  const params = `💓${card.power?.resonance || 0} 🎯${card.power?.virtuosity || 0} 🧠${card.power?.profundity || 0} ⚖${card.power?.harmony || 0}`;
  
  const themeLabel = getThemeLabel(card.theme);
  const genreLabel = getGenreLabel(card.genre);

  div.innerHTML = `
    <div class="card-image" style="position:relative; overflow:hidden;">
      <div style="position:absolute; top:0; left:0; right:0; padding:6px 4px; background:rgba(50, 50, 50, 0.9); font-size:10px; font-weight:600; color:#d0d0d0; text-shadow:0 1px 3px rgba(0,0,0,0.95); z-index:10; border-bottom:1px solid rgba(200,200,200,0.15);">${params}</div>
      <div style="position:absolute; top:4px; right:4px; z-index:11; background:rgba(30,30,30,0.8); padding:3px 6px; border-radius:4px; font-size:11px; font-weight:600; color:${rarity.color}; border:1px solid ${rarity.color};">${count}</div>
      ${card.imageUrl ? `<img src="${card.imageUrl}" alt="${card.title}" style="width:100%; height:100%; object-fit:cover; object-position:center;" />` : '🎨'}
    </div>
    <div class="card-body" style="display:flex; flex-direction:column; gap:6px; padding:8px 8px 12px 8px;">
      <div class="card-title" title="${ui.sanitizeHTML(card.title)}">${ui.sanitizeHTML(card.title)}</div>
      <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--text-secondary);">
        <span class="card-artist-name" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${ui.sanitizeHTML(card.artist)}">${ui.sanitizeHTML(card.artist)}</span>
        <span>${card.year}</span>
      </div>
      
      <!-- 🔥 МАТРИЦА: Theme & Genre ВЛЕВО + эмодзи + текст (шрифт 6px) -->
      <div style="display:flex; gap:4px; font-size:6px; justify-content:flex-start; flex-wrap:wrap;">
        <span style="background:${themeLabel.color}20; color:${themeLabel.color}; padding:2px 4px; border-radius:3px; border:1px solid ${themeLabel.color}40; white-space:nowrap; font-weight:600;">${themeLabel.emoji} ${themeLabel.name}</span>
        <span style="background:${genreLabel.color}20; color:${genreLabel.color}; padding:2px 4px; border-radius:3px; border:1px solid ${genreLabel.color}40; white-space:nowrap; font-weight:600;">${genreLabel.emoji} ${genreLabel.name}</span>
      </div>
      
      <!-- 🔥 МАТРИЦА: Редкость ВЛЕВО + text-align:left -->
      <div class="card-rarity" style="background:${rarity.color}15; border-color:${rarity.color}; color:${rarity.color}; padding:4px 8px; border-radius:8px; text-align:left; font-size:11px; border:1px solid ${rarity.color};">
        ${rarity.emoji} ${rarity.name}
      </div>
    </div>
  `;

  div.style.borderColor = rarity.color;
  div.addEventListener('mousemove', handleTiltMove);
  div.addEventListener('mouseleave', handleTiltLeave);
  div.addEventListener('click', () => showCardDetail(card, count));

  return div;
}

// 🔥 REACTBITS TILT: карта наклоняется К курсору!
function handleTiltMove(e) {
  const card = e.currentTarget;
  const rect = card.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const cx = rect.width / 2;
  const cy = rect.height / 2;
  
  // 🔥 КЛЮЧЕВАЯ ФОРМУЛА: rotY БЕЗ минуса!
  const rotX = -((y - cy) / cy) * 10;  // минус для вертикали
  const rotY = ((x - cx) / cx) * 10;   // БЕЗ минуса для горизонтали!
  
  // 🔥 GLARE эффект: блик следует за курсором
  const glareX = (x / rect.width) * 100;
  const glareY = (y / rect.height) * 100;
  card.style.setProperty('--glare-x', `${glareX}%`);
  card.style.setProperty('--glare-y', `${glareY}%`);
  
  card.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg)`;
  card.classList.add('tilt-active');
}

function handleTiltLeave(e) {
  const card = e.currentTarget;
  card.style.transform = 'rotateX(0deg) rotateY(0deg)';
  card.classList.remove('tilt-active');
}

function initTiltEffect() {
  const cards = document.querySelectorAll('[data-tilt="true"]');
  cards.forEach(card => {
    card.removeEventListener('mousemove', handleTiltMove);
    card.removeEventListener('mouseleave', handleTiltLeave);
    card.addEventListener('mousemove', handleTiltMove);
    card.addEventListener('mouseleave', handleTiltLeave);
  });
}

function showCardDetail(card, count) {
  const modal = document.getElementById('card-detail-modal');
  if (!modal) return;

  const rarity = ui.getRarityBadge(card.rarity);
  const cardStats = getCardStatsInDecks(card.id);
  
  const themeLabel = getThemeLabel(card.theme);
  const genreLabel = getGenreLabel(card.genre);

  const titleEl = document.getElementById('modal-card-title');
  const artistEl = document.getElementById('modal-card-artist');
  const yearEl = document.getElementById('modal-card-year');
  const imgEl = document.getElementById('modal-card-image');
  const rarityDiv = document.getElementById('modal-card-rarity');
  const descEl = document.getElementById('modal-card-description');
  const countEl = document.getElementById('modal-card-count');
  const paramsTable = document.getElementById('modal-params-table');

  titleEl.textContent = card.title;
  artistEl.textContent = card.artist;
  yearEl.textContent = `Год: ${card.year}`;

  imgEl.src = card.imageUrl || '';
  imgEl.style.cursor = 'pointer';
  imgEl.onclick = () => openFullscreenImage(card.imageUrl);

  rarityDiv.innerHTML = `${rarity.emoji} ${rarity.name}`;
  rarityDiv.style.backgroundColor = `${rarity.color}15`;
  rarityDiv.style.borderColor = rarity.color;
  rarityDiv.style.color = rarity.color;

  descEl.textContent = card.description || 'Нет описания';

  let countHTML = `<strong>🎁 В текущей колоде:</strong> ${count} копий`;
  if (cardStats.inDecksTotal > 0 && cardStats.inDecks.length > 0) {
    countHTML += `<div style="font-size:11px; color:var(--text-secondary); margin-top:6px;">`;
    cardStats.inDecks.forEach(d => {
      countHTML += `• ${d.name}: ${d.count}<br/>`;
    });
    countHTML += '</div>';
  }
  countEl.innerHTML = countHTML;

  paramsTable.innerHTML = '';
  
  // 🔥 МОДАЛКА: Theme & Genre ПО ЦЕНТРУ (text-align:center)
  const themeGenreDiv = document.createElement('div');
  themeGenreDiv.style.cssText = 'display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap; grid-column: 1 / -1;';
  themeGenreDiv.innerHTML = `
    <div style="flex:1; background:${themeLabel.color}15; border:1px solid ${themeLabel.color}; color:${themeLabel.color}; padding:8px 12px; border-radius:8px; font-size:12px; font-weight:600; text-align:center;">
      ${themeLabel.emoji} ${themeLabel.name}
    </div>
    <div style="flex:1; background:${genreLabel.color}15; border:1px solid ${genreLabel.color}; color:${genreLabel.color}; padding:8px 12px; border-radius:8px; font-size:12px; font-weight:600; text-align:center;">
      ${genreLabel.emoji} ${genreLabel.name}<br/>
      <span style="font-size:10px; opacity:0.8;">${genreLabel.role}</span>
    </div>
  `;
  paramsTable.appendChild(themeGenreDiv);
  
  // 🔥 2. ТАБЛИЦА СПОСОБНОСТЕЙ (2x2) - ПЕРЕВЕДЕНО НА РУССКИЙ
  const params = [
    { name: '💓 Резонанс', value: card.power?.resonance || 0, color: 'var(--resonance)' },
    { name: '🎯 Виртуозность', value: card.power?.virtuosity || 0, color: 'var(--virtuosity)' },
    { name: '🧠 Глубина', value: card.power?.profundity || 0, color: 'var(--profundity)' },
    { name: '⚖ Гармония', value: card.power?.harmony || 0, color: 'var(--harmony)' }
  ];

  params.forEach(p => {
    const cell = document.createElement('div');
    cell.className = 'modal-param-cell';
    cell.innerHTML = `
      <div class="modal-param-label" style="color:${p.color};">${p.name}</div>
      <div class="modal-param-value">${p.value}/10</div>
      <div class="modal-param-bar">
        <div class="modal-param-bar-fill" style="background:${p.color}; width:${(p.value/10)*100}%;"></div>
      </div>
    `;
    paramsTable.appendChild(cell);
  });

  const oldButtonContainer = document.getElementById('modal-buttons-container');
  if (oldButtonContainer) oldButtonContainer.remove();

  const buttonContainer = document.createElement('div');
  buttonContainer.id = 'modal-buttons-container';
  buttonContainer.style.cssText = 'display:flex; flex-direction:column; gap:8px; margin-top:16px;';

  const modalContent = modal.querySelector('.modal-content');
  const closeBtnDiv = modal.querySelector('.modal-close');
  if (modalContent && closeBtnDiv && closeBtnDiv.parentElement === modalContent) {
    modalContent.insertBefore(buttonContainer, closeBtnDiv.nextSibling);
  } else if (modalContent) {
    modalContent.appendChild(buttonContainer);
  }

  renderDeckSelector(card.id, count, buttonContainer);
  renderCardActionButtons(card, count, buttonContainer);

  openModal('card-detail-modal');
}

function renderDeckSelector(cardId, countInActive, container) {
  const decksList = decks.getDecksForDropdown();
  if (!decksList.length) {
    const emptyDiv = document.createElement('div');
    emptyDiv.style.cssText = 'color:var(--text-secondary); font-size:12px; padding:8px;';
    emptyDiv.textContent = '📂 Нет колод';
    container.appendChild(emptyDiv);
    return;
  }

  const isFromDiscard = decks.activeDeckId && state.currentUser?.decks?.[decks.activeDeckId]?.isDiscardDeck;
  if (!isFromDiscard && countInActive === 0) {
    const emptyDiv = document.createElement('div');
    emptyDiv.style.cssText = 'color:var(--text-secondary); font-size:12px; padding:8px;';
    emptyDiv.textContent = '⚠ Карты нет в активной колоде';
    container.appendChild(emptyDiv);
    return;
  }

  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'display:flex; flex-direction:column; gap:8px;';

  const selectWrapper = document.createElement('div');
  selectWrapper.style.cssText = 'display:flex; gap:8px; align-items:center;';

  const select = document.createElement('select');
  select.id = 'deck-choice';
  select.style.cssText = 'flex:1; padding:8px; background:var(--bg-tertiary); border:1px solid var(--border-light); color:var(--text); border-radius:6px; font-size:13px;';
  decksList.forEach(d => {
    const option = document.createElement('option');
    option.value = d.id;
    option.textContent = d.name;
    select.appendChild(option);
  });
  selectWrapper.appendChild(select);
  wrapper.appendChild(selectWrapper);

  const quantityWrapper = document.createElement('div');
  quantityWrapper.style.cssText = 'display:flex; gap:8px; align-items:center;';

  const quantityLabel = document.createElement('label');
  quantityLabel.textContent = '📦 Кол-во:';
  quantityLabel.style.cssText = 'font-size:13px; font-weight:600; min-width:80px;';

  const quantityInput = document.createElement('input');
  quantityInput.type = 'number';
  quantityInput.id = 'move-quantity-input';
  quantityInput.value = '1';
  quantityInput.min = '1';
  quantityInput.max = countInActive;
  quantityInput.style.cssText = 'flex:1; padding:8px; background:var(--bg-tertiary); border:1px solid var(--border-light); color:var(--text); border-radius:6px; font-size:13px;';

  quantityWrapper.appendChild(quantityLabel);
  quantityWrapper.appendChild(quantityInput);
  wrapper.appendChild(quantityWrapper);

  // 🔥 УНИФИЦИРОВАННАЯ КНОПКА: font-size:14px, font-weight:600, padding:12px
  const moveBtn = document.createElement('button');
  moveBtn.type = 'button';
  moveBtn.className = 'btn btn-primary';
  moveBtn.style.cssText = 'width:100%; padding:12px; font-size:14px; font-weight:600; border:none; cursor:pointer; border-radius:6px;';
  moveBtn.textContent = '🔄 Перенести в колоду';

  moveBtn.onclick = async () => {
    const targetDeckId = select.value;
    const quantity = parseInt(quantityInput.value, 10);
    if (!targetDeckId) return ui.showError('Выберите целевую колоду');
    if (isNaN(quantity) || quantity < 1 || quantity > countInActive) {
      return ui.showError(`Количество должно быть от 1 до ${countInActive}`);
    }
    const sourceDeckId = decks.activeDeckId;
    if (!sourceDeckId) return ui.showError('❌ Активная колода не выбрана');

    const success = await decks.moveCardBetweenDecks(cardId, sourceDeckId, targetDeckId, quantity);
    if (success) {
      const targetDeckName = select.options[select.selectedIndex].text;
      ui.showToast(`✅ Перенесено ${quantity} копия/копий в "${targetDeckName}"!`, 'success');
      closeModal('card-detail-modal');
      await decks.loadDecks();
      decks.renderDecks();
      renderCollection();
    } else {
      ui.showError('❌ Ошибка: нет карты в активной колоде или целевая колода не найдена');
    }
  };

  wrapper.appendChild(moveBtn);
  container.appendChild(wrapper);
}

function renderCardActionButtons(card, currentCount, container) {
  if (decks.activeDeckId) {
    // 🔥 УНИФИЦИРОВАННАЯ КНОПКА
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn';
    removeBtn.style.cssText = 'width:100%; background:#666; color:white; border:none; cursor:pointer; font-weight:600; padding:12px; border-radius:6px; font-size:14px;';
    removeBtn.textContent = '🗑 Удалить из колоды';
    removeBtn.onclick = async () => {
      const success = await decks.removeCardFromActiveDeck(card.id);
      if (success) {
        ui.showToast('✅ Удалено из колоды', 'success');
        closeModal('card-detail-modal');
        decks.renderDecks();
        renderCollection();
      } else ui.showError('Ошибка');
    };
    container.appendChild(removeBtn);
  }

  const tearPrice = calculateTearPrice(card);
  // 🔥 УНИФИЦИРОВАННАЯ КНОПКА
  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'btn';
  deleteBtn.style.cssText = 'width:100%; background:#ef4444; color:white; border:none; cursor:pointer; font-weight:600; padding:12px; border-radius:6px; font-size:14px;';
  deleteBtn.textContent = `💰 Продать (${tearPrice} 💎 за шт.)`;
  deleteBtn.onclick = () => openTearCardModal(card, currentCount, tearPrice);
  container.appendChild(deleteBtn);
}

function openTearCardModal(card, maxCount, tearPrice) {
  const modal = document.getElementById('tear-card-modal');
  if (!modal) return;

  const availableEl = document.getElementById('tear-available-count');
  const inputEl = document.getElementById('tear-quantity-input');
  const confirmBtn = document.getElementById('tear-confirm-btn');
  const cancelBtn = document.getElementById('tear-cancel-btn');
  const titleEl = document.getElementById('tear-modal-title');

  if (availableEl) availableEl.textContent = maxCount;
  if (inputEl) { inputEl.value = '1'; inputEl.max = maxCount; }
  if (titleEl) titleEl.textContent = `Сколько копий продать? (${tearPrice} 💎 за шт.)`;

  confirmBtn.onclick = async () => {
    const quantity = parseInt(inputEl.value, 10);
    if (isNaN(quantity) || quantity < 1 || quantity > maxCount) {
      return ui.showError(`Количество должно быть от 1 до ${maxCount}`);
    }
    const totalCoins = tearPrice * quantity;
    const ok = confirm(`⚠️ Продать ${quantity} копию/копий карты "${card.title}"?\n\nВы получите: ${totalCoins} 💎\n\nПродолжить?`);
    if (!ok) return;

    const success = await tearCardWithReward(card.id, quantity, totalCoins);
    if (success) {
      ui.showToast(`💰 Получено ${totalCoins} 💎 за ${quantity} карт!`, 'success');
      closeModal('tear-card-modal');
      closeModal('card-detail-modal');
      await decks.loadDecks();
      decks.renderDecks();
      renderCollection();
      document.getElementById('coins-display').textContent = state.currentUser.currency;
    } else ui.showError('Ошибка при продаже');
  };

  cancelBtn.onclick = () => closeModal('tear-card-modal');
  openModal('tear-card-modal');
}

async function tearCardWithReward(cardId, quantity, reward) {
  try {
    const u = state.currentUser;
    if (!u) return false;
    const success = await decks.deleteCardFromCollectionQuantity(cardId, quantity);
    if (!success) return false;

    const newCurrency = (u.currency || 0) + reward;
    await db.collection('users').doc(u.uid).update({ currency: newCurrency });
    u.currency = newCurrency;
    return true;
  } catch (e) {
    console.error('Error tearing card:', e);
    return false;
  }
}

function openFullscreenImage(imageUrl) {
  if (!imageUrl) return;
  let modal = document.getElementById('modal-fullscreen-image');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-fullscreen-image';
    modal.className = 'modal-fullscreen-image';
    modal.innerHTML = '<button class="modal-fullscreen-close">✗</button><img src="" alt="fullscreen" />';
    modal.querySelector('.modal-fullscreen-close').onclick = () => modal.style.display = 'none';
    modal.onclick = (e) => e.target === modal && (modal.style.display = 'none');
    document.body.appendChild(modal);
  }
  modal.querySelector('img').src = imageUrl;
  modal.style.display = 'flex';
}

function updateStats(viewingDeckOverride) {
  const { total, unique } = calculateStats();
  const decksObj = state.currentUser?.decks || {};

  let currentRating = 0;
  let viewingDeck = viewingDeckOverride;
  if (!viewingDeck) {
    const viewingDeckId = decks.getViewingDeckId?.() || null;
    if (viewingDeckId && decksObj[viewingDeckId]) viewingDeck = decksObj[viewingDeckId];
  }
  if (viewingDeck) {
    currentRating = decks.calculateDeckRating(viewingDeck.cards || {});
  } else {
    const activeDeckId = decks.activeDeckId || null;
    if (activeDeckId && decksObj[activeDeckId]) {
      currentRating = decks.calculateDeckRating(decksObj[activeDeckId].cards || {});
    }
  }

  document.getElementById('stat-total-cards').textContent = total;
  document.getElementById('stat-unique-cards').textContent = unique;
  document.getElementById('max-rating').textContent = Math.round(currentRating);
}

export { initTiltEffect };