/**
 * modules/leaderboard.js
 */

import { state } from '../app.js';
const db = firebase.firestore();

export async function loadLeaderboard() {
  try {
    const snap = await db.collection('leaderboard')
      .orderBy('rating', 'desc')
      .limit(100)
      .get();
    
    state.leaderboard = snap.docs.map(doc => ({
      uid: doc.id,
      ...doc.data()
    }));
    
    console.log('✅ Leaderboard loaded');
  } catch (e) {
    console.error('Leaderboard error:', e);
    state.leaderboard = [];
  }
}

export function renderLeaderboard() {
  const table = document.getElementById('leaderboard-body');
  if (!table) return;
  
  table.innerHTML = state.leaderboard?.map((user, idx) => `
    <tr style="border-bottom:1px solid var(--border);">
      <td style="padding:12px; text-align:center; color:var(--wood-light); font-weight:600;">#${idx + 1}</td>
      <td style="padding:12px; color:var(--text-accent);">${user.username || 'Player'}</td>
      <td style="padding:12px; text-align:right; color:var(--text-secondary);">${Math.round(user.rating || 0)}</td>
    </tr>
  `).join('') || '<tr><td colspan="3" style="text-align:center; color:var(--text-secondary);">No data</td></tr>';
}
