/**
 * modules/decks.js - система колод
 */

import { state, openModal, closeModal } from '../app.js';
import * as cards from './cards.js';
import * as ui from './ui.js';

const db = firebase.firestore();
const MAX_DECKS = 10;
const MAX_CARDS_IN_DECK = 60;

export async function loadDecks() {
  const { currentUser } = state;
  if (!currentUser) return;
  try {
    const docSnap = await db.collection('users').doc(currentUser.uid).get();
    const data = docSnap.data() || {};
    state.currentUser.decks = data.decks || {};
    state.currentUser.activeDeckId = data.activeDeckId;
    if (!state.currentUser.activeDeckId || !state.currentUser.decks[state.currentUser.activeDeckId]) {
      const firstDeckId = Object.keys(state.currentUser.decks)[0];
      if (firstDeckId) { await selectDeck(firstDeckId); }
      else { await createDefaultDeck(); }
    }
    console.log(`✔ Колод: ${Object.keys(state.currentUser.decks).length}`);
  } catch (error) { console.error('Ошибка колод:', error); }
}

async function createDefaultDeck() {
  const deckId = `deck_${Date.now()}`;
  const deck = {
    id: deckId, name: 'На старте', description: 'Первая колода',
    cards: {}, rating: 0, createdAt: new Date(), isActive: true, color: '#3a8d8e'
  };
  state.currentUser.decks[deckId] = deck;
  state.currentUser.activeDeckId = deckId;
  await db.collection('users').doc(state.currentUser.uid).update({
    decks: state.currentUser.decks, activeDeckId: deckId
  });
}

export async function createDeck(name, desc = '', color = '#3a8d8e') {
  const { currentUser } = state;
  if (!currentUser || Object.keys(currentUser.decks).length >= MAX_DECKS) {
    ui.showError(`Макс ${MAX_DECKS} колод`);
    return null;
  }
  try {
    const id = `deck_${Date.now()}`;
    const newDeck = {
      id, name: name.trim(), description: desc.trim(), cards: {},
      rating: 0, createdAt: new Date(), isActive: false, color
    };
    currentUser.decks[id] = newDeck;
    await db.collection('users').doc(currentUser.uid).update({ decks: currentUser.decks });
    ui.showSuccess(`Колода «${name}» создана`);
    renderDecks();
    return id;
  } catch (error) { console.error('Ошибка:', error); }
}

export async function selectDeck(deckId) {
  const { currentUser } = state;
  if (!currentUser || !currentUser.decks[deckId]) return;
  try {
    Object.values(currentUser.decks).forEach(d => d.isActive = false);
    currentUser.decks[deckId].isActive = true;
    currentUser.activeDeckId = deckId;
    await db.collection('users').doc(currentUser.uid).update({
      decks: currentUser.decks, activeDeckId: deckId
    });
    renderDecks();
    cards.renderCollection();
    ui.showSuccess(`Выбрана «${currentUser.decks[deckId].name}»`);
  } catch (error) { console.error('Ошибка:', error); }
}

export async function deleteDeck(deckId) {
  const { currentUser } = state;
  if (!currentUser || !currentUser.decks[deckId]) return;
  if (currentUser.activeDeckId === deckId) {
    ui.showError('Не можно удалить активную');
    return;
  }
  try {
    delete currentUser.decks[deckId];
    await db.collection('users').doc(currentUser.uid).update({ decks: currentUser.decks });
    renderDecks();
    ui.showSuccess('Колода удалена');
  } catch (error) { console.error('Ошибка:', error); }
}

export async function cloneDeck(deckId) {
  const { currentUser } = state;
  if (!currentUser || !currentUser.decks[deckId] || Object.keys(currentUser.decks).length >= MAX_DECKS) {
    ui.showError(`Макс ${MAX_DECKS} колод`);
    return;
  }
  try {
    const orig = currentUser.decks[deckId];
    const newId = `deck_${Date.now()}`;
    const cloned = {
      ...orig, id: newId, name: `${orig.name} (copy)`,
      cards: { ...orig.cards }, isActive: false, createdAt: new Date()
    };
    currentUser.decks[newId] = cloned;
    await db.collection('users').doc(currentUser.uid).update({ decks: currentUser.decks });
    renderDecks();
    ui.showSuccess('Колода скопирована');
  } catch (error) { console.error('Ошибка:', error); }
}

export async function editDeck(deckId, name, desc, color) {
  const { currentUser } = state;
  if (!currentUser || !currentUser.decks[deckId]) return;
  try {
    currentUser.decks[deckId] = { ...currentUser.decks[deckId], name: name.trim(), description: desc.trim(), color };
    await db.collection('users').doc(currentUser.uid).update({ decks: currentUser.decks });
    renderDecks();
    ui.showSuccess('Обновлена');
  } catch (error) { console.error('Ошибка:', error); }
}

export async function addCardToDeck(deckId, cardId) {
  const { currentUser } = state;
  if (!currentUser || !currentUser.decks[deckId]) return false;
  const deck = currentUser.decks[deckId];
  const totalInDeck = Object.values(deck.cards || {}).reduce((a, b) => a + b, 0);
  if (totalInDeck >= MAX_CARDS_IN_DECK) {
    ui.showError(`Макс ${MAX_CARDS_IN_DECK} карт`);
    return false;
  }
  const globalCount = currentUser.cards[cardId] || 0;
  const deckCount = deck.cards[cardId] || 0;
  if (deckCount >= globalCount) {
    ui.showError('Карт не хватает');
    return false;
  }
  try {
    deck.cards[cardId] = (deck.cards[cardId] || 0) + 1;
    await db.collection('users').doc(currentUser.uid).update({ decks: currentUser.decks });
    return true;
  } catch (error) { console.error('Ошибка:', error); return false; }
}

export async function removeCardFromDeck(deckId, cardId) {
  const { currentUser } = state;
  if (!currentUser || !currentUser.decks[deckId]) return false;
  try {
    const count = currentUser.decks[deckId].cards[cardId] || 0;
    if (count <= 0) return false;
    if (count === 1) { delete currentUser.decks[deckId].cards[cardId]; }
    else { currentUser.decks[deckId].cards[cardId] = count - 1; }
    await db.collection('users').doc(currentUser.uid).update({ decks: currentUser.decks });
    return true;
  } catch (error) { console.error('Ошибка:', error); return false; }
}

/**
 * Нендер панели колод
 */
export function renderDecks() {
  const { currentUser } = state;
  const panel = document.getElementById('decks-panel');
  if (!panel || !currentUser) return;
  panel.innerHTML = '';

  const h = document.createElement('div');
  h.style.cssText = 'padding: 12px; border-bottom: 1px solid var(--border-color); font-weight: 600; font-size: 12px;';
  h.textContent = `🎲 Колоды (${Object.keys(currentUser.decks).length}/${MAX_DECKS})`;
  panel.appendChild(h);

  // МАКСИМАЛЬНЫЙ РЕЙТИНГ
  if (currentUser.activeDeckId) {
    const activeDeck = currentUser.decks[currentUser.activeDeckId];
    if (activeDeck) {
      const ratingDisplay = document.createElement('div');
      ratingDisplay.style.cssText = 'padding: 8px 12px; background: var(--bg-tertiary); margin-bottom: 8px; border-radius: 8px; font-size: 12px;';
      const rating = cards.calculateDeckRating();
      ratingDisplay.innerHTML = `
        <div style="color: var(--text-secondary); margin-bottom: 4px; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;">🏆 Максимальный рейтинг</div>
        <div style="font-size: 18px; font-weight: 700; color: var(--wood-light);">${Math.round(rating)}</div>
      `;
      panel.appendChild(ratingDisplay);
    }
  }

  const btn = document.createElement('button');
  btn.className = 'btn btn-primary';
  btn.textContent = '➕ Новая';
  btn.style.margin = '8px';
  btn.style.width = 'calc(100% - 16px)';
  btn.addEventListener('click', () => showCreateDeckModal());
  panel.appendChild(btn);

  Object.values(currentUser.decks).forEach(deck => {
    panel.appendChild(createDeckItemElement(deck));
  });
}

function createDeckItemElement(deck) {
  const div = document.createElement('div');
  const cardsCount = Object.values(deck.cards || {}).reduce((a, b) => a + b, 0);
  div.style.cssText = `padding: 8px; margin: 4px; border-left: 3px solid ${deck.color}; cursor: pointer; background: ${deck.isActive ? 'rgba(58,141,142,0.1)' : 'transparent'}; transition: 0.2s;`;
  div.innerHTML = `<strong>${deck.isActive ? '🔥' : ''} ${deck.name}</strong> <small>${cardsCount}/${MAX_CARDS_IN_DECK}</small>`;
  div.addEventListener('click', () => selectDeck(deck.id));
  return div;
}

function showCreateDeckModal() {
  const name = prompt('Название колоды:');
  if (name) createDeck(name);
}
