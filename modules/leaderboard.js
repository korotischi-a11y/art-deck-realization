/**
 * modules/leaderboard.js
 * Глобальный рейтинг всех игроков
 */

import { state, openModal } from '../app.js';
import * as user from './user.js';
import * as ui from './ui.js';

const db = firebase.firestore();

/**
 * Загружает всех пользователей и рассчитывает их рейтинг
 */
export async function loadLeaderboard() {
  console.log('🏆 Загружаю рейтинг...');
  try {
    const snapshot = await db.collection('users').get();
    
    state.leaderboard = snapshot.docs.map(doc => {
      const userData = doc.data();
      return {
        uid: doc.id,
        ...userData
      };
    }).sort((a, b) => (b.currency || 0) - (a.currency || 0));
    
    console.log(`✔️ Загружено ${state.leaderboard.length} игроков`);
  } catch (error) {
    console.error('Ошибка загружки рейтинга:', error);
  }
}

/**
 * Отображает таблицу лидеров
 */
export function renderLeaderboard() {
  const tbody = document.getElementById('leaderboard-body');
  tbody.innerHTML = '';
  
  state.leaderboard.forEach((player, index) => {
    const tier = user.getRatingTier(player.currency || 0);
    const tierEmojis = {
      'Common': '📍',
      'Uncommon': '🎯',
      'Rare': '🏆',
      'Epic': '💎',
      'Ancient': '🔥',
      'Legendary': '⭐',
      'Immortal': '👑'
    };
    
    const isCurrentUser = player.uid === state.currentUser?.uid;
    
    const row = document.createElement('tr');
    row.style.backgroundColor = isCurrentUser ? 'rgba(212, 165, 116, 0.1)' : '';
    row.style.fontWeight = isCurrentUser ? 'bold' : 'normal';
    
    row.innerHTML = `
      <td class="leaderboard-rank">#${index + 1}</td>
      <td>${ui.sanitizeHTML(player.username || player.email?.split('@')[0] || 'Гость')}</td>
      <td>${ui.formatCurrency(player.currency || 0)}</td>
      <td>
        <span class="leaderboard-tier">${tierEmojis[tier] || '📍'} ${tier}</span>
      </td>
    `;
    
    tbody.appendChild(row);
  });
}
