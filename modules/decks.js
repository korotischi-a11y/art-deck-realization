/**
 * modules/decks.js - Гибридная система управления колодами
 * 
 * СТРУКТУРА:
 * - Коллекция (весь инвентарь с копиями)
 * - Колоды (много, создаются пользователем, макс 56 карт)
 * - Активная колода (одна, считает рейтинг)
 * - Просматриваемая колода (для отображения)
 */

import { state, closeModal, openModal } from '../app.js';
import * as ui from './ui.js';
import * as cardMod from './cards.js';

const db = firebase.firestore();

// 🔥 АКТИВНАЯ КОЛОДА (для рейтинга в лидерборде)
export let activeDeckId = null;

// 👀 ПРОСМАТРИВАЕМАЯ КОЛОДА (для отображения карт)
export let viewingDeckId = null;

// КОНСТАНТА для колоды сброса
const DISCARD_DECK_NAME = '🗑 Свободные карты';

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
    
    await getOrCreateDiscardDeck();
    
    // 🔥 Проверяем если есть колода с флагом isActive
    const activeFlaggedDeck = Object.values(u.decks).find(d => d.isActive && !d.isDiscardDeck);
    if (activeFlaggedDeck) {
      activeDeckId = activeFlaggedDeck.id;
    } else if (!activeDeckId && Object.keys(u.decks).length > 0) {
      // Если нет активной - выбираем первую не-сбросную
      const normalDeck = Object.values(u.decks).find(d => !d.isDiscardDeck);
      if (normalDeck) {
        activeDeckId = normalDeck.id;
      }
    }
    
    // 👀 Если нет просматриваемой - выбираем активную
    if (!viewingDeckId) {
      viewingDeckId = activeDeckId;
    }
  } catch (e) {
    console.error('Error loading decks:', e);
  }
}

/**
 * Получить или создать колоду сброса (свободные карты)
 */
export async function getOrCreateDiscardDeck() {
  try {
    const u = state.currentUser;
    if (!u) return null;

    const existingDeck = Object.values(u.decks || {}).find(d => d.isDiscardDeck);
    if (existingDeck) {
      return existingDeck.id;
    }

    const ref = db.collection('users').doc(u.uid).collection('decks').doc();
    await ref.set({ 
      name: DISCARD_DECK_NAME, 
      cards: {}, 
      createdAt: new Date(),
      isDiscardDeck: true,
      isActive: false
    });

    await loadDecks();
    return ref.id;
  } catch (e) {
    console.error('Error getting discard deck:', e);
    return null;
  }
}

/**
 * 🔥 Устанавливает активную колоду (для рейтинга)
 */
export async function setActiveDeck(deckId) {
  try {
    const u = state.currentUser;
    if (!u || !u.decks || !u.decks[deckId]) return false;
    
    const deck = u.decks[deckId];
    if (deck.isDiscardDeck) {
      ui.showError('❌ Колода сброса не может быть активной');
      return false;
    }
    
    // Снимаем флаг isActive со всех колод
    for (const [id, d] of Object.entries(u.decks)) {
      if (d.isActive && id !== deckId) {
        d.isActive = false;
        await db.collection('users').doc(u.uid)
          .collection('decks').doc(id)
          .update({ isActive: false });
      }
    }
    
    // Устанавливаем новую активную
    deck.isActive = true;
    await db.collection('users').doc(u.uid)
      .collection('decks').doc(deckId)
      .update({ isActive: true });
    
    activeDeckId = deckId;
    
    await loadDecks();
    return true;
  } catch (e) {
    console.error('Error setting active deck:', e);
    return false;
  }
}

/**
 * 👀 Устанавливает просматриваемую колоду (для отображения)
 */
export function setViewingDeck(deckId) {
  viewingDeckId = deckId;
}

/**
 * 👀 Получает ID просматриваемой колоды
 */
export function getViewingDeckId() {
  return viewingDeckId;
}

/**
 * 🔥 Вычисляет рейтинг конкретной колоды
 */
export function calculateDeckRating(deckCards) {
  if (!deckCards || Object.keys(deckCards).length === 0) return 0;
  
  let totalRating = 0;
  
  for (const [cardId, count] of Object.entries(deckCards)) {
    const card = state.cards.find(c => c.id === cardId);
    if (!card) continue;
    
    const cardRating = calculateCardRating(card);
    totalRating += cardRating * count;
  }
  
  return Math.round(totalRating);
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
 * 🔥 Получает рейтинг активной колоды (для лидерборда)
 */
export function getActiveRating() {
  if (!activeDeckId || !state.currentUser?.decks) return 0;
  
  const activeDeck = state.currentUser.decks[activeDeckId];
  if (!activeDeck || activeDeck.isDiscardDeck) return 0;
  
  return calculateDeckRating(activeDeck.cards || {});
}

/**
 * 👀 Получает рейтинг просматриваемой колоды (для отображения)
 */
export function getViewingRating() {
  if (!viewingDeckId || !state.currentUser?.decks) return 0;
  
  const viewingDeck = state.currentUser.decks[viewingDeckId];
  if (!viewingDeck) return 0;
  
  return calculateDeckRating(viewingDeck.cards || {});
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
  
  normalDecks.forEach(deck => {
    const uniqueCount = Object.keys(deck.cards || {}).length;
    const totalCount = Object.values(deck.cards || {}).reduce((a, b) => a + b, 0);
    const deckRating = calculateDeckRating(deck.cards || {});
    const isActive = deck.isActive || activeDeckId === deck.id;
    const isViewing = viewingDeckId === deck.id;
    
    const deckEl = createDeckElement(deck, uniqueCount, totalCount, isActive, isViewing, deckRating);
    decksList.appendChild(deckEl);
  });
  
  if (discardDeck) {
    const separator = document.createElement('div');
    separator.style.cssText = 'border-top: 2px dashed var(--border); margin: 8px 0;';
    decksList.appendChild(separator);
    
    const uniqueCount = Object.keys(discardDeck.cards || {}).length;
    const totalCount = Object.values(discardDeck.cards || {}).reduce((a, b) => a + b, 0);
    const deckRating = calculateDeckRating(discardDeck.cards || {});
    const isViewing = viewingDeckId === discardDeck.id;
    const deckEl = createDeckElement(discardDeck, uniqueCount, totalCount, false, isViewing, deckRating);
    decksList.appendChild(deckEl);
  }
  
  panel.appendChild(decksList);
  
  panel.querySelectorAll('.deck-edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openEditDeckModal(btn.dataset.deckId);
    });
  });
  
  panel.querySelectorAll('.deck-delete-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm('Удалить колоду? Карты вернутся в коллекцию.')) {
        await deleteDeck(btn.dataset.deckId);
      }
    });
  });
  
  // 🔥 Кнопка "Сделать активной"
  panel.querySelectorAll('.deck-activate-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const success = await setActiveDeck(btn.dataset.deckId);
      if (success) {
        ui.showToast('⭐ Колода активирована!', 'success');
        renderDecks();
        cardMod.renderCollection();
      }
    });
  });
  
  document.getElementById('create-deck-btn')?.addEventListener('click', openCreateDeckModal);
}

function createDeckElement(deck, uniqueCount, totalCount, isActive, isViewing, deckRating) {
  const deckEl = document.createElement('div');
  deckEl.className = 'deck-item';
  deckEl.style.cssText = `
    padding: 12px 16px;
    border-left: 3px solid ${isViewing ? 'var(--wood-light)' : 'transparent'};
    cursor: pointer;
    transition: all 0.2s;
    background: ${isViewing ? 'var(--bg-tertiary)' : 'transparent'};
    opacity: 1;
    position: relative;
  `;
  
  const label = deck.isDiscardDeck ? '🗑' : (isActive ? '⭐' : '🎴');
  const noteExtra = deck.isDiscardDeck ? ' (Без колод)' : '';
  
  deckEl.innerHTML = `
    <div style="font-weight:600; color:var(--text-accent); font-size:13px; word-break: break-word; margin-bottom:4px;">${label} ${deck.name}${noteExtra}</div>
    <div style="font-size:11px; color:var(--text-secondary);">
      🎰 ${uniqueCount} уник. (${totalCount} всего) | ⭐ ${Math.round(deckRating)}
    </div>
    ${!deck.isDiscardDeck ? `<div class="deck-actions" style="position:absolute; top:8px; right:8px; display:none; gap:4px;">
      ${!isActive ? `<button class="deck-activate-btn" data-deck-id="${deck.id}" style="padding:4px 8px; background:var(--wood-light); border:none; border-radius:4px; color:var(--bg-primary); font-size:10px; cursor:pointer;">⭐</button>` : ''}
      <button class="deck-edit-btn" data-deck-id="${deck.id}" style="padding:4px 8px; background:var(--wood-medium); border:none; border-radius:4px; color:var(--bg-primary); font-size:10px; cursor:pointer;">✍️</button>
      <button class="deck-delete-btn" data-deck-id="${deck.id}" style="padding:4px 8px; background:var(--resonance); border:none; border-radius:4px; color:white; font-size:10px; cursor:pointer;">🗑</button>
    </div>` : ''}
  `;
  
  deckEl.addEventListener('mouseover', () => {
    deckEl.style.background = 'var(--bg-tertiary)';
    const actions = deckEl.querySelector('.deck-actions');
    if (actions) actions.style.display = 'flex';
  });
  deckEl.addEventListener('mouseout', () => {
    if (!isViewing) deckEl.style.background = 'transparent';
    const actions = deckEl.querySelector('.deck-actions');
    if (actions) actions.style.display = 'none';
  });
  deckEl.addEventListener('click', (e) => {
    if (e.target.classList.contains('deck-edit-btn') || 
        e.target.classList.contains('deck-delete-btn') ||
        e.target.classList.contains('deck-activate-btn')) return;
    
    // 👀 Только просмотр, НЕ активация!
    viewingDeckId = deck.id;
    renderDecks();
    cardMod.renderCollection();
    ui.showToast(`👀 Просмотр: ${deck.name}`, 'info');
  });
  
  return deckEl;
}

export function getDecksForDropdown() {
  const { decks = {} } = state.currentUser || {};
  return Object.values(decks)
    .filter(d => !d.isDiscardDeck)
    .map(d => ({
      id: d.id,
      name: d.name || 'Без имени'
    }));
}

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

export async function removeCardFromActiveDeck(cardId) {
  try {
    // 👀 Удаляем из просматриваемой колоды
    if (!viewingDeckId) return false;
    const u = state.currentUser;
    const deck = u.decks[viewingDeckId];
    if (!deck || !deck.cards || !deck.cards[cardId]) return false;
    
    if (deck.isDiscardDeck) {
      ui.showToast('🗑 Свободные карты - только просмотр', 'info');
      return false;
    }
    
    deck.cards[cardId] -= 1;
    if (deck.cards[cardId] <= 0) {
      delete deck.cards[cardId];
    }
    
    await db.collection('users').doc(u.uid)
      .collection('decks').doc(viewingDeckId)
      .update({ cards: deck.cards });
    
    const discardDeckId = await getOrCreateDiscardDeck();
    if (discardDeckId) {
      const discardDeck = u.decks[discardDeckId];
      discardDeck.cards = discardDeck.cards || {};
      discardDeck.cards[cardId] = (discardDeck.cards[cardId] || 0) + 1;
      
      await db.collection('users').doc(u.uid)
        .collection('decks').doc(discardDeckId)
        .update({ cards: discardDeck.cards });
    }
    
    await loadDecks();
    return true;
  } catch (e) {
    console.error('Error removing card:', e);
    return false;
  }
}

/**
 * УНИВЕРСАЛЬНАЯ ФУНКЦИЯ: ПЕРЕМЕЩАТЬ КАРТУ МЕЖДУ КОЛОДАМИ
 */
export async function moveCardBetweenDecks(cardId, fromDeckId, toDeckId, count = 1) {
  try {
    const u = state.currentUser;
    if (!u || !fromDeckId || !toDeckId) return false;
    if (fromDeckId === toDeckId) return false;
    
    const fromDeck = u.decks[fromDeckId];
    const toDeck = u.decks[toDeckId];
    
    if (!fromDeck || !toDeck) return false;
    
    const countInFrom = fromDeck.cards?.[cardId] || 0;
    if (countInFrom < count) return false;
    
    fromDeck.cards[cardId] -= count;
    if (fromDeck.cards[cardId] <= 0) {
      delete fromDeck.cards[cardId];
    }
    
    toDeck.cards = toDeck.cards || {};
    toDeck.cards[cardId] = (toDeck.cards[cardId] || 0) + count;
    
    await db.collection('users').doc(u.uid)
      .collection('decks').doc(fromDeckId)
      .update({ cards: fromDeck.cards });
    
    await db.collection('users').doc(u.uid)
      .collection('decks').doc(toDeckId)
      .update({ cards: toDeck.cards });
    
    await loadDecks();
    return true;
  } catch (e) {
    console.error('Error moving card:', e);
    return false;
  }
}

/**
 * УДАЛИТЬ КАРТУ ИЗ ВСЕХ КОЛОД (ВСЕ КОПИИ)
 */
export async function deleteCardFromCollection(cardId) {
  try {
    const u = state.currentUser;
    const decksObj = u.decks || {};
    for (const [deckId, deck] of Object.entries(decksObj)) {
      if (deck.cards && deck.cards[cardId]) {
        delete deck.cards[cardId];
        await db.collection('users').doc(u.uid)
          .collection('decks').doc(deckId)
          .update({ cards: deck.cards });
      }
    }
    await loadDecks();
    return true;
  } catch (e) {
    console.error('Error deleting card:', e);
    return false;
  }
}

/**
 * УДАЛИТЬ N КОПИЙ КАРТЫ ИЗ ВСЕХ КОЛОД
 */
export async function deleteCardFromCollectionQuantity(cardId, quantity) {
  try {
    const u = state.currentUser;
    if (!u) return false;

    const decksObj = u.decks || {};
    let remainingToDelete = quantity;

    for (const [deckId, deck] of Object.entries(decksObj)) {
      if (remainingToDelete <= 0) break;

      if (deck.cards && deck.cards[cardId] && deck.cards[cardId] > 0) {
        const countInDeck = deck.cards[cardId];
        const deleteCount = Math.min(countInDeck, remainingToDelete);

        deck.cards[cardId] -= deleteCount;
        remainingToDelete -= deleteCount;

        if (deck.cards[cardId] <= 0) {
          delete deck.cards[cardId];
        }

        await db.collection('users').doc(u.uid)
          .collection('decks').doc(deckId)
          .update({ cards: deck.cards });
      }
    }

    if (remainingToDelete > 0) {
      console.warn(`⚠ Не все карты удалены. Осталось: ${remainingToDelete}`);
      return false;
    }

    await loadDecks();
    return true;
  } catch (e) {
    console.error('Error deleting card quantity:', e);
    return false;
  }
}

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

function openCreateDeckModal() {
  const modal = document.createElement('div');
  modal.className = 'modal active';
  modal.id = 'create-deck-modal';
  modal.innerHTML = `
    <div class="modal-content" style="max-width:400px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <h2 style="margin:0;">💮 Новая колода</h2>
        <button class="modal-close" style="padding:0; width:32px; height:32px;">✗</button>
      </div>
      <input type="text" id="new-deck-name" placeholder="Название колоды" style="width:100%; padding:10px; background:var(--bg-tertiary); border:1px solid var(--border); color:var(--text); border-radius:8px; margin-bottom:16px;" />
      <button id="create-deck-confirm" class="btn btn-primary" style="width:100%;">Создать</button>
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

async function createDeck(name) {
  try {
    const u = state.currentUser;
    const ref = db.collection('users').doc(u.uid).collection('decks').doc();
    
    // 🔥 Если это первая колода - делаем её активной
    const normalDecks = Object.values(u.decks || {}).filter(d => !d.isDiscardDeck);
    const isFirstDeck = normalDecks.length === 0;
    
    await ref.set({ 
      name, 
      cards: {}, 
      createdAt: new Date(),
      isActive: isFirstDeck
    });
    
    await loadDecks();
    
    if (isFirstDeck) {
      activeDeckId = ref.id;
      viewingDeckId = ref.id;
    }
    
    renderDecks();
    ui.showToast('✅ Колода создана', 'success');
  } catch (e) {
    console.error('Error creating deck:', e);
    ui.showError('Ошибка создания');
  }
}

function openEditDeckModal(deckId) {
  const deck = state.currentUser.decks[deckId];
  if (!deck) return;
  
  const modal = document.createElement('div');
  modal.className = 'modal active';
  modal.id = 'edit-deck-modal';
  modal.innerHTML = `
    <div class="modal-content" style="max-width:400px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <h2 style="margin:0;">✍️ Редактировать</h2>
        <button class="modal-close" style="padding:0; width:32px; height:32px;">✗</button>
      </div>
      <input type="text" id="edit-deck-name" value="${deck.name}" style="width:100%; padding:10px; background:var(--bg-tertiary); border:1px solid var(--border); color:var(--text); border-radius:8px; margin-bottom:16px;" />
      <button id="save-deck-name" class="btn btn-primary" style="width:100%;">Сохранить</button>
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

async function deleteDeck(deckId) {
  try {
    const deck = state.currentUser.decks[deckId];
    
    // Если удаляем активную колоду - сбрасываем флаг
    if (deck.isActive || activeDeckId === deckId) {
      activeDeckId = null;
      
      // Выбираем новую активную колоду (первую доступную)
      const normalDecks = Object.values(state.currentUser.decks)
        .filter(d => !d.isDiscardDeck && d.id !== deckId);
      
      if (normalDecks.length > 0) {
        await setActiveDeck(normalDecks[0].id);
      }
    }
    
    // Если удаляем просматриваемую - переключаемся
    if (viewingDeckId === deckId) {
      viewingDeckId = activeDeckId;
    }
    
    await db.collection('users').doc(state.currentUser.uid)
      .collection('decks').doc(deckId).delete();
    
    await loadDecks();
    renderDecks();
    cardMod.renderCollection();
    ui.showToast('✅ Колода удалена', 'success');
  } catch (e) {
    console.error('Error deleting deck:', e);
    ui.showError('Ошибка удаления');
  }
}
