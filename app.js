/**
 * app.js
 */

import * as auth from './modules/auth.js';
import * as cardMod from './modules/cards.js';
import * as decks from './modules/decks.js';
import * as user from './modules/user.js';
import * as leaderboard from './modules/leaderboard.js';
import * as packs from './modules/packs.js';
import * as admin from './modules/admin.js';
import * as ui from './modules/ui.js';

export const state = { currentUser: null, cards: [], packs: [], isAdmin: false, isLoginMode: true };

const QUESTS = {
  'first_pack': { id: 'first_pack', title: 'Первые шаги', desc: 'Откройте пак', reward: 100, progress: 'packsOpened', target: 1 },
  'collect_5': { id: 'collect_5', title: 'Коллекционер', desc: '5 карт', reward: 150, progress: 'uniqueCards', target: 5 },
  'collect_10': { id: 'collect_10', title: 'Мастер', desc: '10 карт', reward: 200, progress: 'uniqueCards', target: 10 },
  'first_legendary': { id: 'first_legendary', title: 'Легенда', desc: 'Легенда', reward: 250, progress: 'legendaryCards', target: 1 },
  'rare_collector': { id: 'rare_collector', title: 'Мастер редкостей', desc: 'редкие карты', reward: 300, progress: 'rareCards', target: 5 }
};

const TAB_TITLES = {
  collection: '📚 Коллекция', profile: '👤 Профиль', leaderboard: '🏆 Рейтинг', packs: '📋 Паки', admin: '⚙ Админ'
};

async function checkDailyRewards() {
  try {
    const u = firebase.auth().currentUser;
    if (!u) return;
    const r = firebase.firestore().collection('users').doc(u.uid);
    const d = (await r.get()).data();
    if (!d) return;
    const l = d.lastDailyReward?.toDate() || new Date(0);
    const n = new Date();
    const diff = Math.floor((n - l) / (1000 * 60 * 60 * 24));
    if (diff >= 1) {
      await r.update({ currency: (d.currency || 0) + 50, lastDailyReward: new Date(), dailyFreeOpens: (d.dailyFreeOpens || 0) + 1 });
      state.currentUser.currency = (d.currency || 0) + 50;
      state.currentUser.dailyFreeOpens = (d.dailyFreeOpens || 0) + 1;
      ui.showToast('🎁 +50 💎', 'success');
      updateUserInterface();
    }
  } catch (e) { console.error('Daily:', e); }
}

async function loadQuests() {
  try {
    const u = firebase.auth().currentUser;
    if (!u) return [];
    const d = (await firebase.firestore().collection('users').doc(u.uid).get()).data();
    const c = d?.completedQuests || [];
    return Object.values(QUESTS).map(q => ({ ...q, completed: c.includes(q.id) }));
  } catch (e) { console.error('Quests:', e); return []; }
}

export function renderQuests() {
  loadQuests().then(q => {
    const c = document.getElementById('quests-container');
    if (!c) return;
    c.innerHTML = q.map(i => `<div class="quest-card ${i.completed ? 'completed' : ''}"><div class="quest-icon">✨</div><div class="quest-info"><h4>${i.title}</h4><p>${i.desc}</p><div class="quest-reward">+${i.reward} 💎</div></div>${i.completed ? '<span>✓</span>' : ''}</div>`).join('');
  });
}

export async function checkQuestCompletion() {
  try {
    const u = firebase.auth().currentUser;
    if (!u) return;
    const d = (await firebase.firestore().collection('users').doc(u.uid).get()).data();
    const c = d?.completedQuests || [];
    for (const qId in QUESTS) {
      if (c.includes(qId)) continue;
      const q = QUESTS[qId];
      if ((d[q.progress] || 0) >= q.target) {
        await firebase.firestore().collection('users').doc(u.uid).update({ completedQuests: [...c, qId], currency: (d.currency || 0) + q.reward });
        state.currentUser.currency = (d.currency || 0) + q.reward;
        ui.showToast(`🌟 +${q.reward} 💎`, 'success');
        updateUserInterface();
        renderQuests();
      }
    }
  } catch (e) { console.error('CheckQuest:', e); }
}

async function initApp() {
  console.log('[INIT] Art Deck...');
  try {
    await auth.checkAuthState();
    if (!state.currentUser) { showAuthPage(); setupAuthListeners(); return; }
    showApp();
    await loadInitialData();
    setupEventListeners();
    await checkDailyRewards();
    console.log('✅ OK');
  } catch (e) { console.error('Error:', e); }
}

async function loadInitialData() {
  try {
    await cardMod.loadCards();
    await user.loadUserData();
    await decks.loadDecks();
    await packs.loadPacks();
    await leaderboard.loadLeaderboard();
    updateUserInterface();
    switchTab('collection');
  } catch (e) { console.error('Load:', e); }
}

function updateUserInterface() {
  const { currentUser } = state;
  document.getElementById('user-name').textContent = currentUser.username || currentUser.email?.split('@')[0] || 'Guest';
  document.getElementById('coins-display').textContent = currentUser.currency || 100;
  const dr = cardMod.calculateDeckRating();
  const t = user.getRatingTier(dr);
  const tiers = { 'Common': '📑', 'Uncommon': '🎯', 'Rare': '🏆', 'Epic': '💎', 'Ancient': '🔥', 'Legendary': '⭐', 'Immortal': '👑' };
  document.getElementById('user-rank').textContent = `${tiers[t] || '📑'} ${t}`;
  const ab = document.getElementById('admin-btn');
  ab.style.display = state.isAdmin ? 'flex' : 'none';
}

export function switchTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.getElementById(`${tabName}-tab`)?.classList.add('active');
  document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabName));
  document.getElementById('page-title').textContent = TAB_TITLES[tabName] || 'Art Deck';
  switch (tabName) {
    case 'collection': cardMod.renderCollection(); decks.renderDecks(); break;
    case 'profile': user.renderProfile(); break;
    case 'leaderboard': leaderboard.renderLeaderboard(); break;
    case 'packs': packs.renderShop(); break;
    case 'admin': admin.initAdminPanel(); break;
  }
}

export function openModal(modalId) { const m = document.getElementById(modalId); if (m) m.classList.add('active'); }
export function closeModal(modalId) { const m = document.getElementById(modalId); if (m) m.classList.remove('active'); }
function showApp() { document.getElementById('app').style.display = 'grid'; document.getElementById('auth-page').style.display = 'none'; }
function showAuthPage() { document.getElementById('app').style.display = 'none'; document.getElementById('auth-page').style.display = 'flex'; state.isLoginMode = true; updateAuthUI(); }
function updateAuthUI() {
  const btn = document.getElementById('auth-btn');
  const toggleBtn = document.getElementById('toggle-auth');
  if (state.isLoginMode) { btn.textContent = '🔐 Вход'; toggleBtn.textContent = 'Регистрация'; }
  else { btn.textContent = '✨ Рег'; toggleBtn.textContent = 'Уже есть?'; }
}
function setupAuthListeners() {
  const form = document.getElementById('auth-form');
  const toggleBtn = document.getElementById('toggle-auth');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
      state.isLoginMode ? await auth.login(email, password) : await auth.register(email, password);
      await loadInitialData();
      showApp();
      setupEventListeners();
      await checkDailyRewards();
    } catch (e) { document.getElementById('auth-error').textContent = e.message; }
    finally { submitBtn.disabled = false; }
  });
  toggleBtn?.addEventListener('click', () => { state.isLoginMode = !state.isLoginMode; updateAuthUI(); });
}
function setupEventListeners() {
  document.querySelectorAll('.sidebar-btn[data-tab]').forEach(b => { b.addEventListener('click', () => switchTab(b.dataset.tab)); });
  document.getElementById('logout-btn')?.addEventListener('click', async () => { await auth.logout(); state.currentUser = null; showAuthPage(); });
  document.querySelectorAll('[id*="modal"]').forEach(m => {
    m.addEventListener('click', (e) => { if (e.target === m) m.classList.remove('active'); });
    m.querySelector('.modal-close')?.addEventListener('click', () => m.classList.remove('active'));
  });
  document.getElementById('rarity-filter')?.addEventListener('change', () => cardMod.renderCollection());
}
export { updateUserInterface };
if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initApp); } else { initApp(); }
