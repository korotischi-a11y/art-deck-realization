/**
 * modules/decks.js - Управление колодами
 */

import { state, closeModal, openModal } from '../app.js';
import * as ui from './ui.js';

const db = firebase.firestore();

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

    console.log('✅ Decks loaded:', Object.keys(u.decks).length);
  } catch (e) {
    console.error('Error loading decks:', e);
  }
}

/**
 * Рендерит панель колод справа
 */
export function renderDecks() {
  const panel = document.getElementById('decks-panel');
  if (!panel) return;

  const { decks = {} } = state.currentUser || {};
  const deckList = Object.values(decks);

  if (deckList.length === 0) {
    panel.innerHTML = '<div style="padding:16px; color:var(--text-secondary); text-align:center;">📭 Нет колод</div>';
    return;
  }

  panel.innerHTML = '<div style="padding:16px; border-bottom:1px solid var(--border);"><h3 style="margin:0 0 12px; font-size:14px; color:var(--text-accent);">📦 Мои колоды</h3></div>' + 
    deckList.map(deck => {
      const cardCount = Object.values(deck.cards || {}).reduce((a, b) => a + b, 0);
      const deckRating = calculateDeckRating(deck.cards || {});
      return `
        <div style="padding:12px 16px; border-bottom:1px solid var(--border); cursor:pointer; transition: all 0.2s;" 
             onmouseover="this.style.background='var(--bg-tertiary)'" 
             onmouseout="this.style.background='transparent'">
          <div style="font-weight:600; color:var(--text-accent); font-size:13px;">${deck.name}</div>
          <div style="font-size:11px; color:var(--text-secondary); margin-top:4px;">
            🂠 ${cardCount} карт | ⭐ ${Math.round(deckRating)}
          </div>
        </div>
      `;
    }).join('');
}

/**
 * Простой расчёт рейтинга колоды
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
