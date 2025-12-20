/**
 * modules/user.js
 * Профиль пользователя
 */

import { state } from '../app.js';
import * as decks from './decks.js';
import * as ui from './ui.js';

const db = firebase.firestore();

/**
 * Отображает профиль
 */
export function renderProfile() {
  const { currentUser } = state;
  if (!currentUser) return;
  
  // Основная информация
  document.getElementById('profile-username').textContent = currentUser.username || currentUser.email?.split('@')[0] || '-';
  document.getElementById('profile-email').textContent = currentUser.email || '-';
  
  // 🔥 НОВОЕ: Количество карт во ВСЕХ колодах
  const decksObj = currentUser.decks || {};
  let totalCards = 0;
  const uniqueCardIds = new Set();
  
  for (const deck of Object.values(decksObj)) {
    for (const [cardId, count] of Object.entries(deck.cards || {})) {
      totalCards += count;
      uniqueCardIds.add(cardId);
    }
  }
  
  const uniqueCards = uniqueCardIds.size;
  
  const totalEl = document.getElementById('profile-total-cards');
  const uniqueEl = document.getElementById('profile-unique-cards');
  const coinsEl = document.getElementById('profile-coins');
  
  if (totalEl) totalEl.textContent = totalCards;
  if (uniqueEl) uniqueEl.textContent = uniqueCards;
  if (coinsEl) coinsEl.textContent = currentUser.currency || 0;
  
  // 🔥 НОВОЕ: Рейтинг АКТИВНОЙ колоды (для лидерборда)
  const activeRating = decks.getActiveRating();
  
  // Максимальный рейтинг (для справки)
  const maxDeckRating = Object.values(decksObj)
    .filter(d => !d.isDiscardDeck)
    .map(d => decks.calculateDeckRating(d.cards || {}))
    .reduce((a, b) => Math.max(a, b), 0);
  
  // Отображаем рейтинг активной колоды
  document.getElementById('profile-rating').textContent = Math.round(activeRating);
  
  // Распределение рейтинга
  const breakdownDiv = document.getElementById('rating-breakdown');
  if (breakdownDiv) {
    const normalDecksCount = Object.values(decksObj).filter(d => !d.isDiscardDeck).length;
    
    breakdownDiv.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div class="stat-card">
          <div class="stat-value" style="color: var(--wood-light);">${uniqueCards}</div>
          <div class="stat-label">Уникальные</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color: var(--virtuosity);">${totalCards}</div>
          <div class="stat-label">Всего карт</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color: var(--harmony);">${normalDecksCount}</div>
          <div class="stat-label">Колод</div>
        </div>
        <div class="stat-card" style="border-color: var(--wood-light); background-color: rgba(212, 165, 116, 0.1);">
          <div class="stat-value" style="color: var(--wood-light);">${Math.round(activeRating)}</div>
          <div class="stat-label">Активный рейтинг</div>
        </div>
      </div>
      <div style="margin-top: 12px; padding: 12px; background: var(--bg-tertiary); border-radius: 8px; font-size: 12px; color: var(--text-secondary);">
        👉 Рейтинг считается по <strong style="color: var(--text-accent);">активной колоде</strong><br/>
        💡 Макс. рейтинг всех колод: <strong>${Math.round(maxDeckRating)}</strong>
      </div>
    `;
  }
}

/**
 * 🔥 НОВОЕ: Обновляет рейтинг в Firebase (по активной колоде)
 */
export async function updateRatingInFirebase() {
  try {
    const u = state.currentUser;
    if (!u) return;
    
    const activeRating = decks.getActiveRating();
    
    await db.collection('users').doc(u.uid).update({
      rating: Math.round(activeRating)
    });
    
    u.rating = Math.round(activeRating);
  } catch (e) {
    console.error('Error updating rating:', e);
  }
}
