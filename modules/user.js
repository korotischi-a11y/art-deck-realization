/**
 * modules/user.js
 * Профиль пользователя и рейтинг на основе монет
 * 
 * Ответственность:
 * - Отображение профиля пользователя
 * - Расчет рейтинга колоды
 * - Определение тира
 */

import { state } from '../app.js';
import * as cards from './cards.js';
import * as ui from './ui.js';

const db = firebase.firestore();

/**
 * Загружает данные пользователя (встроенно в app.js)
 */
export async function loadUserData() {
  // Тут та логика, что в auth.js
}

/**
 * Россчитывает рейтинг колоды
 * 
 * В этой системе рейтинг рассчитывается на основе силы колоды,
 * что включает: философские параметры, редкость, все бонусы.
 */
export function calculateDeckRating() {
  return cards.calculateDeckRating();
}

/**
 * Определяет тир на основе рейтинга
 */
export function getRatingTier(rating) {
  if (rating >= 10000) return 'Immortal';
  if (rating >= 8000) return 'Legendary';
  if (rating >= 6000) return 'Ancient';
  if (rating >= 4000) return 'Epic';
  if (rating >= 2000) return 'Rare';
  if (rating >= 1000) return 'Uncommon';
  return 'Common';
}

/**
 * Получает эмоджи тира
 */
function getTierEmoji(tier) {
  const emojis = {
    'Common': '📍',
    'Uncommon': '🎯',
    'Rare': '🏆',
    'Epic': '💎',
    'Ancient': '🔥',
    'Legendary': '⭐',
    'Immortal': '👑'
  };
  return emojis[tier] || '📍';
}

/**
 * Отображает профиль
 */
export function renderProfile() {
  const { currentUser } = state;
  const deckRating = calculateDeckRating();
  const tier = getRatingTier(deckRating);
  const tierEmoji = getTierEmoji(tier);
  
  // Главная информация
  document.getElementById('profile-username').textContent = currentUser.username;
  document.getElementById('profile-email').textContent = currentUser.email;
  document.getElementById('profile-rating').textContent = Math.round(deckRating);
  
  // Добавляем тир
  const profileHeader = document.querySelector('.profile-header');
  const tierDiv = profileHeader.querySelector('[style*="font-size: 32px"]');
  if (tierDiv) {
    tierDiv.textContent = tierEmoji;
    tierDiv.parentElement.querySelector('[style*="Тир"]');
  }
  
  // Разложение рейтинга
  const breakdown = cards.getDeckRatingBreakdown();
  const breakdownDiv = document.getElementById('rating-breakdown');
  breakdownDiv.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
      <div class="stat-card">
        <div class="stat-value" style="color: var(--text-accent);">${Math.round(breakdown.uniqueness)}</div>
        <div class="stat-label">Уникальность</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: var(--text-accent);">${Math.round(breakdown.power)}</div>
        <div class="stat-label">Сила карт</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: var(--virtuosity);">+${(breakdown.eraBonus * 100).toFixed(0)}%</div>
        <div class="stat-label">Бонус эра</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: var(--harmony);">+${(breakdown.artistBonus * 100).toFixed(0)}%</div>
        <div class="stat-label">Бонус художников</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: var(--harmony);">+${(breakdown.rarityBonus * 100).toFixed(0)}%</div>
        <div class="stat-label">Бонус редкостей</div>
      </div>
      <div class="stat-card" style="border-color: var(--wood-light); background-color: rgba(212, 165, 116, 0.1);">
        <div class="stat-value" style="color: var(--wood-light);">${Math.round(breakdown.total)}</div>
        <div class="stat-label">Общий рейтинг</div>
      </div>
    </div>
  `;
  
  // Количество карт
  const cards_obj = currentUser.cards || {};
  const totalCards = Object.values(cards_obj).reduce((a, b) => a + b, 0);
  const uniqueCards = Object.keys(cards_obj).length;
  
  document.getElementById('profile-total-cards').textContent = totalCards;
  document.getElementById('profile-unique-cards').textContent = uniqueCards;
  document.getElementById('profile-coins').textContent = currentUser.currency;
  document.getElementById('profile-packs-opened').textContent = '0'; // Обновляться у packs.js
}
