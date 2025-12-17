/**
 * modules/decks.js - Управление колодами
 */

import { state, closeModal, openModal } from '../app.js';
import * as ui from './ui.js';
import * as cardMod from './cards.js';

const db = firebase.firestore();

// Активная колода
export let activeDeckId = null;

// КОНСТАНТА для колоды сброса
const DISCARD_DECK_NAME = '🗑 Колода Сброса';

/**
 * Загружает колоды пользователя
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

    console.log('📂 Decks loaded:', Object.keys(u.decks).length);
    
    // Обеспечиваем, что колода сброса существует
    await getOrCreateDiscardDeck();
    
    // Если активная не установлена, берём первую НЕ сбросовую
    if (!activeDeckId && Object.keys(u.decks).length > 0) {
      const normalDeck = Object.values(u.decks).find(d => !d.isDiscardDeck);
      if (normalDeck) {
        activeDeckId = normalDeck.id;
      }
    }
  } catch (e) {
    console.error('Error loading decks:', e);
  }
}

/**
 * Получить или создать колоду сброса
 */
export async function getOrCreateDiscardDeck() {
  try {
    const u = state.currentUser;
    if (!u) return null;

    // Поиск наличие колоды
    const existingDeck = Object.values(u.decks || {}).find(d => d.isDiscardDeck);
    if (existingDeck) {
      return existingDeck.id;
    }

    // Нет - создаём
    const ref = db.collection('users').doc(u.uid).collection('decks').doc();
    await ref.set({ 
      name: DISCARD_DECK_NAME, 
      cards: {}, 
      createdAt: new Date(),
      isDiscardDeck: true,  // Метка для распознания
      isLocked: false       // НЕ блокируем - МОЖНО смотреть!
    });

    await loadDecks();
    return ref.id;
  } catch (e) {
    console.error('Error getting discard deck:', e);
    return null;
  }
}

/**
 * Рендерит панель колод справа
 */
export function renderDecks() {
  const panel = document.getElementById('decks-panel');
  if (!panel) return;

  const { decks: decksObj = {} } = state.currentUser || {};
  let deckList = Object.values(decksObj);

  if (deckList.length === 0) {
    panel.innerHTML = '<div style="padding:16px; color:var(--text-secondary); text-align:center;">🎴 Нет колод</div>';
    return;
  }

  // Отделяем колоду сброса и нормальные
  const discardDeck = deckList.find(d => d.isDiscardDeck);
  const normalDecks = deckList.filter(d => !d.isDiscardDeck);

  panel.innerHTML = `
    <div style="padding:16px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
      <h3 style="margin:0; font-size:14px; color:var(--text-accent);">🎴 Мои колоды</h3>
      <button id="create-deck-btn" style="padding:4px 8px; background:var(--wood-medium); border:none; border-radius:6px; color:var(--bg-primary); font-size:11px; cursor:pointer; font-weight:600;">+ Новая</button>
    </div>
  `;
  
  const decksList = document.createElement('div');
  decksList.id = 'decks-list';
  decksList.style.cssText = 'display: flex; flex-direction: column; gap: 8px; padding: 8px;';
  
  // НОРМАЛЬНЫЕ КОЛОДЫ
  normalDecks.forEach(deck => {
    const cardCount = Object.values(deck.cards || {}).reduce((a, b) => a + b, 0);
    const uniqueCount = Object.keys(deck.cards || {}).length;
    const deckRating = calculateDeckRating(deck.cards || {});
    const isActive = activeDeckId === deck.id;
    
    const deckEl = createDeckElement(deck, uniqueCount, isActive, deckRating, false);
    decksList.appendChild(deckEl);
  });
  
  // КОЛОДА СБРОСА (ОТДЕЛьНО, В КОНЦЕ, НЕ блокируемая, активная)
  if (discardDeck) {
    const separator = document.createElement('div');
    separator.style.cssText = 'border-top: 2px dashed var(--border); margin: 8px 0;';
    decksList.appendChild(separator);
    
    const uniqueCount = Object.keys(discardDeck.cards || {}).length;
    const deckRating = calculateDeckRating(discardDeck.cards || {});
    const isActive = activeDeckId === discardDeck.id;  // ОНА МОЖЕТ БЫТЬ АКТИВНОЙ!
    const deckEl = createDeckElement(discardDeck, uniqueCount, isActive, deckRating, false);  // НЕ заблокируемая!
    decksList.appendChild(deckEl);
  }
  
  panel.appendChild(decksList);
  
  // Обработчики для кнопок edit/delete
  panel.querySelectorAll('.deck-edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openEditDeckModal(btn.dataset.deckId);
    });
  });
  
  panel.querySelectorAll('.deck-delete-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm('Удалить колоду?')) {
        await deleteDeck(btn.dataset.deckId);
      }
    });
  });
  
  document.getElementById('create-deck-btn')?.addEventListener('click', openCreateDeckModal);
}

/**
 * Создаёт DOM элемент колоды
 */
function createDeckElement(deck, uniqueCount, isActive, deckRating, isLocked) {
  const deckEl = document.createElement('div');
  deckEl.className = 'deck-item';
  deckEl.style.cssText = `
    padding: 12px 16px;
    border-left: 3px solid ${isActive ? 'var(--wood-light)' : 'transparent'};
    cursor: pointer;
    transition: all 0.2s;
    background: ${isActive ? 'var(--bg-tertiary)' : 'transparent'};
    opacity: 1;
    position: relative;
  `;
  
  const label = deck.isDiscardDeck ? '🗑' : '🎴';
  const noteExtra = deck.isDiscardDeck ? ' (Карты без колод)' : '';
  
  deckEl.innerHTML = `
    <div style="font-weight:600; color:var(--text-accent); font-size:13px; word-break: break-word; margin-bottom:4px;">${label} ${deck.name}${noteExtra}</div>
    <div style="font-size:11px; color:var(--text-secondary);">
      🎰 ${uniqueCount} уник. | ⭐ ${Math.round(deckRating)}
    </div>
    ${!deck.isDiscardDeck ? `<div class="deck-actions" style="position:absolute; top:8px; right:8px; display:none; gap:4px;">
      <button class="deck-edit-btn" data-deck-id="${deck.id}" style="padding:4px 8px; background:var(--wood-medium); border:none; border-radius:4px; color:var(--bg-primary); font-size:10px; cursor:pointer;">✏️</button>
      <button class="deck-delete-btn" data-deck-id="${deck.id}" style="padding:4px 8px; background:var(--resonance); border:none; border-radius:4px; color:white; font-size:10px; cursor:pointer;">🗑</button>
    </div>` : ''}
  `;
  
  deckEl.addEventListener('mouseover', () => {
    deckEl.style.background = 'var(--bg-tertiary)';
    const actions = deckEl.querySelector('.deck-actions');
    if (actions) actions.style.display = 'flex';
  });
  deckEl.addEventListener('mouseout', () => {
    if (!isActive) deckEl.style.background = 'transparent';
    const actions = deckEl.querySelector('.deck-actions');
    if (actions) actions.style.display = 'none';
  });
  deckEl.addEventListener('click', (e) => {
    if (e.target.classList.contains('deck-edit-btn') || e.target.classList.contains('deck-delete-btn')) return;
    activeDeckId = deck.id;
    renderDecks();
    cardMod.renderCollection();
    ui.showToast(`📂 Выбрана: ${deck.name}`, 'success');
  });
  
  return deckEl;
}

/**
 * Рассчитывает рейтинг колоды
 */
function calculateDeckRating(cards) {
  if (!cards || Object.keys(cards).length === 0) return 0;
  const totalCards = Object.values(cards).reduce((a, b) => a + b, 0);
  const uniqueCards = Object.keys(cards).length;
  return (uniqueCards / totalCards) * 100 + uniqueCards * 10;
}

/**
 * Получить все колоды для dropdown (БЕЗ колоды сброса)
 */
export function getDecksForDropdown() {
  const { decks = {} } = state.currentUser || {};
  return Object.values(decks)
    .filter(d => !d.isDiscardDeck)  // Исключаем колоду сброса
    .map(d => ({
      id: d.id,
      name: d.name || 'Без имени'
    }));
}

/**
 * Добавить карту в конкретную колоду
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

/**
 * Удалить карту ИЗ АКТИВНОЙ КОЛОДЫ
 */
export async function removeCardFromActiveDeck(cardId) {
  try {
    if (!activeDeckId) return false;
    const u = state.currentUser;
    const deck = u.decks[activeDeckId];
    if (!deck || !deck.cards || !deck.cards[cardId]) return false;
    
    // КОЛОДА СБРОСА: НЕ делете, только просматривайте оттуда карты
    if (deck.isDiscardDeck) {
      ui.showToast('🗑 Где карты бес колод - только просмотр', 'info');
      return false;
    }
    
    deck.cards[cardId] -= 1;
    if (deck.cards[cardId] <= 0) {
      delete deck.cards[cardId];
      
      // ПЕРЕНОСИМ В КОЛОДУ СБРОСА
      await addCardToDiscardDeck(cardId);
    }
    
    await db.collection('users').doc(u.uid)
      .collection('decks').doc(activeDeckId)
      .update({ cards: deck.cards });
    
    await loadDecks();
    return true;
  } catch (e) {
    console.error('Error removing card:', e);
    return false;
  }
}

/**
 * Добавить карту В КОЛОДУ СБРОСА
 */
export async function addCardToDiscardDeck(cardId) {
  try {
    const discardDeckId = await getOrCreateDiscardDeck();
    if (!discardDeckId) return false;
    
    return await addCardToDeckById(cardId, discardDeckId);
  } catch (e) {
    console.error('Error adding to discard deck:', e);
    return false;
  }
}

/**
 * Открыть модалку создания колоды
 */
function openCreateDeckModal() {
  const modal = document.createElement('div');
  modal.className = 'modal active';
  modal.id = 'create-deck-modal';
  modal.innerHTML = `
    <div class="modal-content" style="max-width:400px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <h2 style="margin:0;">📮 Новая колода</h2>
        <button class="modal-close" style="padding:0; width:32px; height:32px;">✗</button>
      </div>
      <input type="text" id="new-deck-name" placeholder="Название колоды" style="width:100%; padding:10px; background:var(--bg-tertiary); border:1px solid var(--border); color:var(--text); border-radius:8px; margin-bottom:16px;" />
      <button id="create-deck-confirm" class="btn btn-primary" style="width:100%;">Create</button>
    </div>
  `;
  document.body.appendChild(modal);
  
  modal.querySelector('.modal-close').onclick = () => modal.remove();
  modal.onclick = (e) => e.target === modal && modal.remove();
  
  modal.querySelector('#create-deck-confirm').onclick = async () => {
    const name = document.getElementById('new-deck-name').value.trim();
    if (!name) return ui.showError('Введите название');
    
    await createDeck(name);
    modal.remove();
  };
}

/**
 * Создать новую колоду
 */
async function createDeck(name) {
  try {
    const u = state.currentUser;
    const ref = db.collection('users').doc(u.uid).collection('decks').doc();
    await ref.set({ name, cards: {}, createdAt: new Date() });
    
    await loadDecks();
    renderDecks();
    ui.showToast('✅ Колода создана', 'success');
  } catch (e) {
    console.error('Error creating deck:', e);
    ui.showError('Ошибка создания');
  }
}

/**
 * Открыть модалку редактирования колоды
 */
function openEditDeckModal(deckId) {
  const deck = state.currentUser.decks[deckId];
  if (!deck) return;
  
  const modal = document.createElement('div');
  modal.className = 'modal active';
  modal.id = 'edit-deck-modal';
  modal.innerHTML = `
    <div class="modal-content" style="max-width:400px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <h2 style="margin:0;">✏️ Редактировать</h2>
        <button class="modal-close" style="padding:0; width:32px; height:32px;">✗</button>
      </div>
      <input type="text" id="edit-deck-name" value="${deck.name}" style="width:100%; padding:10px; background:var(--bg-tertiary); border:1px solid var(--border); color:var(--text); border-radius:8px; margin-bottom:16px;" />
      <button id="save-deck-name" class="btn btn-primary" style="width:100%;">Save</button>
    </div>
  `;
  document.body.appendChild(modal);
  
  modal.querySelector('.modal-close').onclick = () => modal.remove();
  modal.onclick = (e) => e.target === modal && modal.remove();
  
  modal.querySelector('#save-deck-name').onclick = async () => {
    const newName = document.getElementById('edit-deck-name').value.trim();
    if (!newName) return ui.showError('Название не может быть пустым');
    
    await db.collection('users').doc(state.currentUser.uid)
      .collection('decks').doc(deckId)
      .update({ name: newName });
    
    await loadDecks();
    renderDecks();
    ui.showToast('✅ Название обновлено', 'success');
    modal.remove();
  };
}

/**
 * Удалить колоду
 */
async function deleteDeck(deckId) {
  try {
    await db.collection('users').doc(state.currentUser.uid)
      .collection('decks').doc(deckId).delete();
    
    if (activeDeckId === deckId) activeDeckId = null;
    await loadDecks();
    renderDecks();
    cardMod.renderCollection();
    ui.showToast('✅ Колода удалена', 'success');
  } catch (e) {
    console.error('Error deleting deck:', e);
    ui.showError('Ошибка удаления');
  }
}
