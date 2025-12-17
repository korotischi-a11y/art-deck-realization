/**
 * modules/decks.js - Управление колодами
 */

import { state, closeModal, openModal } from '../app.js';
import * as ui from './ui.js';
import * as cardMod from './cards.js';

const db = firebase.firestore();

/**
 * Загружает колоды
 */
export async function loadDecks() {
  try {
    const u = state.currentUser;
    if (!u) return;

    const ref = db.collection('users').doc(u.uid).collection('decks');
    const snap = await ref.get();
    
    u.decks = {};
    snap.forEach(doc => {
      u.decks[doc.id] = { id: doc.id, ...doc.data() };
    });

    console.log('✅ Decks loaded:', Object.keys(u.decks).length);
  } catch (e) {
    console.error('Error loading decks:', e);
  }
}

/**
 * Рендерит панель колод
 */
export function renderDecks() {
  const panel = document.getElementById('decks-panel');
  if (!panel) return;

  const { decks: decksObj = {} } = state.currentUser || {};
  const deckList = Object.values(decksObj);

  if (deckList.length === 0) {
    panel.innerHTML = '<div style="padding:16px; color:var(--text-secondary); text-align:center;">🎴 Нет колод</div>';
    return;
  }

  panel.innerHTML = '<div style="padding:16px; border-bottom:1px solid var(--border);"><h3 style="margin:0 0 12px; font-size:14px; color:var(--text-accent);">🎴 Мои колоды</h3><button id="show-all-btn" style="width:100%; padding:6px; background:var(--bg-tertiary); border:1px solid var(--border-light); color:var(--text); font-size:11px; border-radius:4px; cursor:pointer;">Show All</button></div>';
  
  const decksList = document.createElement('div');
  decksList.id = 'decks-list';
  decksList.style.cssText = 'display: flex; flex-direction: column; gap: 0;';
  
  deckList.forEach(deck => {
    const cardCount = Object.values(deck.cards || {}).reduce((a, b) => a + b, 0);
    const deckRating = calculateDeckRating(deck.cards || {});
    
    const deckEl = document.createElement('div');
    deckEl.className = 'deck-item';
    deckEl.setAttribute('data-deck-id', deck.id);
    deckEl.style.cssText = `
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
      cursor: pointer;
      transition: all 0.2s;
      background: transparent;
      user-select: none;
    `;
    deckEl.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
        <div>
          <div style="font-weight:600; color:var(--text-accent); font-size:13px; word-break: break-word;">${deck.name}</div>
          <div style="font-size:11px; color:var(--text-secondary); margin-top:4px;">
            🂠 ${cardCount} карт | ⭐ ${Math.round(deckRating)}
          </div>
        </div>
        <button class="deck-edit-btn" style="width:20px; height:20px; padding:0; background:transparent; border:none; color:var(--text-secondary); cursor:pointer; font-size:14px;">✏️</button>
      </div>
    `;
    
    deckEl.addEventListener('mouseover', () => {
      deckEl.style.background = 'var(--bg-tertiary)';
    });
    deckEl.addEventListener('mouseout', () => {
      deckEl.style.background = 'transparent';
    });
    deckEl.addEventListener('click', (e) => {
      if (e.target.closest('.deck-edit-btn')) return;
      selectDeck(deck.id, deck.name);
    });
    
    deckEl.querySelector('.deck-edit-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      openDeckEditor(deck.id, deck.name, deck.cards || {});
    });
    
    decksList.appendChild(deckEl);
  });
  
  panel.appendChild(decksList);
  
  document.getElementById('show-all-btn').addEventListener('click', () => {
    cardMod.setSelectedDeckId(null);
    cardMod.renderCollection();
    document.querySelectorAll('.deck-item').forEach(el => el.style.background = 'transparent');
    ui.showToast('Showing all cards', 'success');
  });
}

/**
 * Открыть редактор колоды
 */
function openDeckEditor(deckId, deckName, deckCards) {
  const modal = document.getElementById('deck-editor-modal');
  if (!modal) {
    const newModal = document.createElement('div');
    newModal.id = 'deck-editor-modal';
    newModal.className = 'modal';
    newModal.style.cssText = 'display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); z-index:1000; align-items:center; justify-content:center;';
    document.body.appendChild(newModal);
  }
  
  const content = document.createElement('div');
  content.className = 'modal-content';
  content.style.cssText = 'max-width:600px; max-height:80vh; overflow-y:auto;';
  
  const cardIds = Object.keys(deckCards);
  const cardsHTML = cardIds.map(cardId => {
    const card = (state.cards || []).find(c => c.id === cardId);
    const count = deckCards[cardId];
    if (!card) return '';
    return `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:8px; border-bottom:1px solid var(--border); background:var(--bg-tertiary); margin-bottom:8px; border-radius:4px;">
        <div>
          <div style="font-weight:600; font-size:13px;">${card.title}</div>
          <div style="font-size:11px; color:var(--text-secondary);">${count}x copies</div>
        </div>
        <div style="display:flex; gap:4px;">
          <button class="remove-card-btn" data-card-id="${cardId}" data-deck-id="${deckId}" style="padding:4px 8px; background:var(--resonance); border:none; color:white; border-radius:4px; font-size:11px; cursor:pointer;">Remove</button>
        </div>
      </div>
    `;
  }).join('');
  
  content.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
      <h2 style="margin:0; color:var(--text-accent);">Edit: ${deckName}</h2>
      <button class="modal-close" style="background:none; border:none; color:var(--text-secondary); font-size:24px; cursor:pointer;">✕</button>
    </div>
    <div style="margin-bottom:16px;">
      <label style="display:block; color:var(--text-secondary); font-size:11px; margin-bottom:4px; text-transform:uppercase;">Cards in deck (${cardIds.length})</label>
      <div style="max-height:400px; overflow-y:auto;">
        ${cardsHTML || '<div style="color:var(--text-secondary); text-align:center; padding:20px;">No cards yet</div>'}
      </div>
    </div>
  `;
  
  content.querySelector('.modal-close').addEventListener('click', () => {
    modal.style.display = 'none';
  });
  
  content.querySelectorAll('.remove-card-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const cardId = btn.getAttribute('data-card-id');
      await removeCardFromDeck(cardId, deckId);
      await loadDecks();
      openDeckEditor(deckId, deckName, state.currentUser.decks[deckId].cards || {});
    });
  });
  
  modal.innerHTML = '';
  modal.appendChild(content);
  modal.style.display = 'flex';
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.style.display = 'none';
  });
}

/**
 * Удалить карту из колоды
 */
async function removeCardFromDeck(cardId, deckId) {
  try {
    const u = state.currentUser;
    const deck = u.decks[deckId];
    if (!deck.cards[cardId]) return;
    
    deck.cards[cardId]--;
    if (deck.cards[cardId] <= 0) delete deck.cards[cardId];
    
    await db.collection('users').doc(u.uid)
      .collection('decks').doc(deckId)
      .update({ cards: deck.cards });
    
    ui.showToast('❌ Card removed', 'success');
  } catch (e) {
    console.error('Remove error:', e);
    ui.showError('Error removing card');
  }
}

/**
 * Выбрать колоду
 */
function selectDeck(deckId, deckName) {
  cardMod.setSelectedDeckId(deckId);
  cardMod.renderCollection();
  
  document.querySelectorAll('.deck-item').forEach(el => {
    if (el.getAttribute('data-deck-id') === deckId) {
      el.style.background = 'var(--wood-medium)';
      el.style.color = 'var(--bg-primary)';
    } else {
      el.style.background = 'transparent';
      el.style.color = 'var(--text)';
    }
  });
  
  ui.showToast(`📂 Selected: ${deckName}`, 'success');
}

/**
 * Простой расчёт рейтинга
 */
function calculateDeckRating(cards) {
  if (!cards || Object.keys(cards).length === 0) return 0;
  const totalCards = Object.values(cards).reduce((a, b) => a + b, 0);
  const uniqueCards = Object.keys(cards).length;
  return (uniqueCards / totalCards) * 100 + uniqueCards * 10;
}

/**
 * Получить все колоды для dropdown
 */
export function getDecksForDropdown() {
  const { decks = {} } = state.currentUser || {};
  return Object.values(decks).map(d => ({
    id: d.id,
    name: d.name || 'Без имени'
  }));
}

/**
 * Добавить карту в колоду
 */
export async function addCardToDeckById(cardId, deckId) {
  try {
    const u = state.currentUser;
    if (!u || !u.decks || !u.decks[deckId]) {
      ui.showError('❌ Колода не найдена');
      return false;
    }

    const deck = u.decks[deckId];
    deck.cards = deck.cards || {};
    deck.cards[cardId] = (deck.cards[cardId] || 0) + 1;

    await db.collection('users').doc(u.uid)
      .collection('decks').doc(deckId)
      .update({ cards: deck.cards });

    return true;
  } catch (e) {
    console.error('Error adding to deck:', e);
    return false;
  }
}
