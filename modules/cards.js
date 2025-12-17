/**
 * modules/cards.js - Карты и коллекция
 */

import { state, closeModal, openModal } from '../app.js';
import * as ui from './ui.js';
import * as decks from './decks.js';

const db = firebase.firestore();

/**
 * Загружает карты из мастер-коллекции
 */
export async function loadCards() {
  console.log('🎫 Loading cards...');
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
 * Рендерит коллекцию карт
 */
export function renderCollection() {
  const grid = document.getElementById('cards-grid');
  const filter = document.getElementById('rarity-filter')?.value || '';
  
  grid.innerHTML = '';

  const userCardIds = Object.keys(state.currentUser?.cards || {});
  let cards = userCardIds.map(id => getCard(id)).filter(c => c);
  
  if (filter) cards = cards.filter(c => c.rarity === filter);

  if (!cards.length) {
    grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; color:var(--text-secondary); padding:40px;">🤷 No cards found</div>';
    return;
  }

  cards.forEach(card => {
    const count = state.currentUser?.cards[card.id] || 0;
    const el = createCardElement(card, count);
    grid.appendChild(el);
  });

  updateStats();
}

/**
 * Создаёт элемент карты
 */
function createCardElement(card, count) {
  const div = document.createElement('div');
  div.className = 'card-item';
  div.setAttribute('data-tilt', 'true');
  div.setAttribute('data-rarity', card.rarity);
  
  const rarity = ui.getRarityBadge(card.rarity);
  const params = `💓${card.power?.resonance || 0} 🎯${card.power?.virtuosity || 0} 🧠${card.power?.profundity || 0} ⚖${card.power?.harmony || 0}`;
  
  div.innerHTML = `
    <div class="card-image">
      ${card.imageUrl ? `<img src="${card.imageUrl}" alt="${card.title}" />` : '🎫'}
    </div>
    <div class="card-body">
      <div class="card-title">${ui.sanitizeHTML(card.title)}</div>
      <div class="card-artist">${ui.sanitizeHTML(card.artist)} (${card.year})</div>
      <div class="card-rarity" style="background:${rarity.color}15; border-color:${rarity.color}; color:${rarity.color};">
        ${rarity.emoji} ${rarity.name}
      </div>
      <div class="card-params"><div class="card-param-line"><span>${params}</span></div></div>
      <div class="card-count" style="border-color:${rarity.color}; color:${rarity.color};">${count} шт.</div>
    </div>
  `;
  
  div.style.borderColor = rarity.color;
  div.addEventListener('click', () => showCardDetail(card, count));
  
  return div;
}

/**
 * Показывает модаль карты
 */
function showCardDetail(card, count) {
  const modal = document.getElementById('card-detail-modal');
  if (!modal) return;
  
  const rarity = ui.getRarityBadge(card.rarity);
  
  document.getElementById('modal-card-title').textContent = card.title;
  document.getElementById('modal-card-artist').textContent = card.artist;
  document.getElementById('modal-card-year').textContent = `Year: ${card.year}`;
  
  const img = document.getElementById('modal-card-image');
  img.src = card.imageUrl || '';
  img.style.cursor = 'pointer';
  img.onclick = () => openFullscreenImage(card.imageUrl);
  
  const rarityDiv = document.getElementById('modal-card-rarity');
  rarityDiv.innerHTML = `${rarity.emoji} ${rarity.name}`;
  rarityDiv.style.backgroundColor = `${rarity.color}15`;
  rarityDiv.style.borderColor = rarity.color;
  rarityDiv.style.color = rarity.color;
  
  // Таблица параметров 2x2
  const paramsTable = document.getElementById('modal-params-table');
  paramsTable.innerHTML = '';
  
  const params = [
    { name: '💓 Resonance', value: card.power?.resonance || 0, color: 'var(--resonance)' },
    { name: '🎯 Virtuosity', value: card.power?.virtuosity || 0, color: 'var(--virtuosity)' },
    { name: '🧠 Profundity', value: card.power?.profundity || 0, color: 'var(--profundity)' },
    { name: '⚖ Harmony', value: card.power?.harmony || 0, color: 'var(--harmony)' }
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
  
  document.getElementById('modal-card-description').textContent = card.description;
  document.getElementById('modal-card-count').textContent = `In collection: ${count}`;
  
  // Dropdown для выбора колоды
  renderDeckSelector(card.id);
  
  openModal('card-detail-modal');
}

/**
 * Рендерит селектор колод в модали
 */
function renderDeckSelector(cardId) {
  let container = document.getElementById('deck-selector-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'deck-selector-container';
    const modal = document.querySelector('.modal-content');
    const addBtn = document.getElementById('add-to-deck-btn');
    if (modal && addBtn) modal.insertBefore(container, addBtn);
  }
  
  const decksList = decks.getDecksForDropdown();
  
  if (!decksList.length) {
    container.innerHTML = '<div style="color:var(--text-secondary); font-size:12px; margin-bottom:12px;">No decks yet</div>';
    return;
  }
  
  container.innerHTML = `
    <div style="margin-bottom:12px;">
      <label style="display:block; color:var(--text-secondary); font-size:11px; margin-bottom:4px; text-transform:uppercase; letter-spacing:0.5px;">Select deck</label>
      <select id="deck-choice" style="width:100%; padding:8px; background:var(--bg-tertiary); border:1px solid var(--border-light); color:var(--text); border-radius:6px; font-size:13px;">
        ${decksList.map(d => `<option value="${d.id}">${d.name}</option>`).join('')}
      </select>
    </div>
  `;
  
  // Обнови обработчик кнопки
  const addBtn = document.getElementById('add-to-deck-btn');
  addBtn.onclick = async () => {
    const deckId = document.getElementById('deck-choice')?.value;
    if (!deckId) {
      ui.showError('Select a deck');
      return;
    }
    
    const success = await decks.addCardToDeckById(cardId, deckId);
    if (success) {
      ui.showToast(`✅ Added to deck!`, 'success');
      closeModal('card-detail-modal');
      await decks.loadDecks();
      decks.renderDecks();
    } else {
      ui.showError('Error adding card');
    }
  };
}

/**
 * Открывает картинку на полный экран
 */
function openFullscreenImage(imageUrl) {
  let modal = document.getElementById('modal-fullscreen-image');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-fullscreen-image';
    modal.className = 'modal-fullscreen-image';
    modal.innerHTML = '<button class="modal-fullscreen-close">✕</button><img src="" alt="fullscreen" />';
    modal.querySelector('.modal-fullscreen-close').onclick = () => modal.style.display = 'none';
    modal.onclick = (e) => e.target === modal && (modal.style.display = 'none');
    document.body.appendChild(modal);
  }
  modal.querySelector('img').src = imageUrl;
  modal.style.display = 'flex';
}

/**
 * Обновляет статистику
 */
function updateStats() {
  const cards = state.currentUser?.cards || {};
  const total = Object.values(cards).reduce((a, b) => a + b, 0);
  const unique = Object.keys(cards).length;
  const maxRating = calculateMaxRating();
  
  const totalEl = document.getElementById('stat-total-cards');
  const uniqueEl = document.getElementById('stat-unique-cards');
  const ratingEl = document.getElementById('max-rating');
  
  if (totalEl) totalEl.textContent = total;
  if (uniqueEl) uniqueEl.textContent = unique;
  if (ratingEl) ratingEl.textContent = Math.round(maxRating);
}

/**
 * Расчитывает максимальный рейтинг ИЗ ВСЕХ колод
 */
function calculateMaxRating() {
  const decksObj = state.currentUser?.decks || {};
  const ratings = Object.values(decksObj).map(d => {
    const total = Object.values(d.cards || {}).reduce((a, b) => a + b, 0);
    const unique = Object.keys(d.cards || {}).length;
    return (unique / total) * 100 + unique * 10;
  });
  return Math.max(...ratings, 0);
}
