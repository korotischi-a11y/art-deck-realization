/**
 * cards.js - Управление картами
 */

import { state, openModal, closeModal } from '../app.js';
import * as ui from './ui.js';
import * as decks from './decks.js';

// Функция загружки карт
export async function loadCards() {
  try {
    console.log('[CARDS] Loading cards from Firestore...');
    
    if (!firebase || !firebase.firestore) {
      console.error('[CARDS] Firebase not initialized');
      return;
    }
    
    const db = firebase.firestore();
    const cardsRef = db.collection('cards');
    const snap = await cardsRef.get();
    
    state.cards = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    console.log('[CARDS] ✅ Loaded:', state.cards.length, 'cards');
  } catch (e) {
    console.error('[CARDS] Error loading cards:', e);
    ui.showError('Ошибка загрузки карт');
  }
}

// Рендеринг коллекции
export function renderCollection() {
  const container = document.getElementById('cards-grid');
  if (!container) {
    console.warn('[CARDS] cards-grid container not found');
    return;
  }
  
  if (!state.cards || state.cards.length === 0) {
    container.innerHTML = '<div style="color: #a0a0a0; text-align: center; padding: 20px; grid-column: 1/-1;">No cards yet</div>';
    return;
  }
  
  const rarity = document.getElementById('rarity-filter')?.value || '';
  const filtered = rarity ? state.cards.filter(c => c.rarity === rarity) : state.cards;
  
  console.log('[CARDS] Rendering:', filtered.length, 'cards');
  
  container.innerHTML = filtered.map(card => `
    <div class="card-item" data-card-id="${card.id}" style="cursor: pointer; border-radius: 8px; overflow: hidden; background: #2e2520; border: 1px solid #3a3020; transition: all 0.2s;">
      <img src="${card.imageUrl || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22130%22 height=%22190%22%3E%3Crect fill=%22%23444%22 width=%22130%22 height=%22190%22/%3E%3Ctext x=%2265%22 y=%2295%22 fill=%22%23999%22 text-anchor=%22middle%22 font-size=%2214%22%3ENo Image%3C/text%3E%3C/svg%3E'}" alt="${card.title}" style="width: 100%; height: 160px; object-fit: cover;">
      <div style="font-size: 0.8em; padding: 8px; color: #d4a574; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${card.title || 'Unknown'}</div>
    </div>
  `).join('');
  
  container.querySelectorAll('.card-item').forEach(el => {
    el.addEventListener('click', () => showCardModal(el.dataset.cardId));
    el.addEventListener('mouseover', () => el.style.transform = 'scale(1.05)');
    el.addEventListener('mouseout', () => el.style.transform = 'scale(1)');
  });
}

// Модальное окно карты
function showCardModal(cardId) {
  const card = state.cards.find(c => c.id === cardId);
  if (!card) {
    console.warn('[CARDS] Card not found:', cardId);
    return;
  }
  
  console.log('[CARDS] Opening modal for:', card.title);
  
  document.getElementById('modal-card-title').textContent = card.title || '-';
  document.getElementById('modal-card-image').src = card.imageUrl || '';
  document.getElementById('modal-card-artist').textContent = card.artist || '-';
  document.getElementById('modal-card-year').textContent = card.year || '-';
  
  const rarityEl = document.getElementById('modal-card-rarity');
  if (rarityEl) {
    rarityEl.textContent = card.rarity || '-';
  }
  
  const descEl = document.getElementById('modal-card-description');
  if (descEl) {
    descEl.textContent = card.description || '-';
  }
  
  const countEl = document.getElementById('modal-card-count');
  if (countEl) {
    countEl.textContent = '📚 In collections: 0';
  }
  
  const container = document.getElementById('card-actions');
  if (container) {
    container.innerHTML = '';
    renderCardActionButtons(cardId, container);
  }
  
  openModal('card-detail-modal');
}

/**
 * Кнопки действия с картой
 */
function renderCardActionButtons(cardId, container) {
  // Кнопка добавления в колоду
  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'btn';
  addBtn.style.cssText = 'width:100%; background:#4a7c59; color:white; border:none; cursor:pointer; font-weight:600; padding:10px; border-radius:6px; margin-bottom: 8px;';
  addBtn.textContent = '➕ Добавить в колоду';
  addBtn.onclick = async () => {
    const deckId = await selectDeck();
    if (deckId) {
      await decks.addCardToDeckById(cardId, deckId);
      ui.showToast('✅ Карта добавлена', 'success');
      closeModal('card-detail-modal');
      decks.loadDecks().then(() => {
        decks.renderDecks();
        renderCollection();
      });
    }
  };
  container.appendChild(addBtn);
  
  // Кнопка удаления из колоды
  if (decks.activeDeckId) {
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn';
    removeBtn.style.cssText = 'width:100%; background:#666; color:white; border:none; cursor:pointer; font-weight:600; padding:10px; border-radius:6px; margin-bottom: 8px;';
    removeBtn.textContent = '🗑 Удалить из колоды';
    removeBtn.onclick = async () => {
      const success = await decks.removeCardFromActiveDeck(cardId);
      if (success) {
        ui.showToast('✅ Удалено', 'success');
        closeModal('card-detail-modal');
        await decks.loadDecks();
        decks.renderDecks();
        renderCollection();
      }
    };
    container.appendChild(removeBtn);
  }
}

// Помощная функция: выбор колоды
async function selectDeck() {
  const decksForDropdown = decks.getDecksForDropdown();
  if (decksForDropdown.length === 0) {
    ui.showError('Нет колод для добавления');
    return null;
  }
  
  // Выбираем первую колоду или активную
  return decks.activeDeckId || decksForDropdown[0].id;
}

export { closeModal };
