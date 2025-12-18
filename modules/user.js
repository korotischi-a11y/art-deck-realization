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
  document.getElementById('profile-rating').textContent = Math.round(currentUser.currency || 0);
  
  // Количество карт
  const cards_obj = currentUser.cards || {};
  const totalCards = Object.values(cards_obj).reduce((a, b) => a + b, 0);
  const uniqueCards = Object.keys(cards_obj).length;
  
  const totalEl = document.getElementById('profile-total-cards');
  const uniqueEl = document.getElementById('profile-unique-cards');
  const coinsEl = document.getElementById('profile-coins');
  
  if (totalEl) totalEl.textContent = totalCards;
  if (uniqueEl) uniqueEl.textContent = uniqueCards;
  if (coinsEl) coinsEl.textContent = currentUser.currency || 0;
  
  // Рейтинг распределения (алтернативные данные)
  const decksObj = currentUser.decks || {};
  const maxDeckRating = Object.values(decksObj).map(d => {
    const total = Object.values(d.cards || {}).reduce((a, b) => a + b, 0);
    const unique = Object.keys(d.cards || {}).length;
    return (unique / total) * 100 + unique * 10;
  }).reduce((a, b) => Math.max(a, b), 0);
  
  const breakdownDiv = document.getElementById('rating-breakdown');
  if (breakdownDiv) {
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
          <div class="stat-value" style="color: var(--harmony);">${Object.keys(decksObj).length}</div>
          <div class="stat-label">Колод</div>
        </div>
        <div class="stat-card" style="border-color: var(--wood-light); background-color: rgba(212, 165, 116, 0.1);">
          <div class="stat-value" style="color: var(--wood-light);">${Math.round(maxDeckRating)}</div>
          <div class="stat-label">Макс. рейтинг</div>
        </div>
      </div>
    `;
  }
}
