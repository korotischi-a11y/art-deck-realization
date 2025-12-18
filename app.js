/**
 * app.js - Main application logic
 */

import * as auth from './modules/auth.js';
import * as cardMod from './modules/cards.js';
import * as decks from './modules/decks.js';
import * as user from './modules/user.js';
import * as leaderboard from './modules/leaderboard.js';
import * as packs from './modules/packs.js';
import * as admin from './modules/admin.js';
import * as ui from './modules/ui.js';

export const state = { currentUser: null, cards: [], packs: [], leaderboard: [], isAdmin: false, isLoginMode: true };

const TAB_TITLES = {
  collection: '📚 Коллекция', profile: '👤 Профиль', leaderboard: '🏆 Рейтинг', packs: '📋 Паки', admin: '⚙ Админ'
};

async function checkDailyRewards() {
  try {
    const u = firebase.auth().currentUser;
    if (!u) return;
    const userRef = firebase.firestore().collection('users').doc(u.uid);
    const data = (await userRef.get()).data();
    if (!data) return;
    
    const lastDay = data.lastDailyReward?.toDate() || new Date(0);
    const now = new Date();
    const diff = Math.floor((now - lastDay) / (1000 * 60 * 60 * 24));
    
    if (diff >= 1) {
      await userRef.update({ currency: (data.currency || 0) + 50, lastDailyReward: new Date(), dailyFreeOpens: 1 });
      state.currentUser.currency = (data.currency || 0) + 50;
      state.currentUser.dailyFreeOpens = 1;
      ui.showToast('🎁 +50 💎', 'success');
      updateUserInterface();
    }
  } catch (e) { console.error('Daily check:', e); }
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
    console.log('✅ Ready');
  } catch (e) { console.error('Init error:', e); }
}

async function loadInitialData() {
  try {
    await cardMod.loadCards();
    await decks.loadDecks();
    await packs.loadPacks();
    await leaderboard.loadLeaderboard();
    updateUserInterface();
    user.renderProfile();
    switchTab('collection');
  } catch (e) { console.error('Load error:', e); }
}

function updateUserInterface() {
  const { currentUser } = state;
  document.getElementById('user-name').textContent = currentUser?.username || currentUser?.email?.split('@')[0] || 'Guest';
  document.getElementById('coins-display').textContent = currentUser?.currency || 100;
  const tiers = { 'Common': '📑', 'Uncommon': '🎯', 'Rare': '🏆', 'Epic': '💎', 'Ancient': '🔥', 'Legendary': '⭐', 'Immortal': '👑' };
  document.getElementById('user-rank').textContent = `${tiers['Common'] || '📑'} Common`;
  const ab = document.getElementById('admin-btn');
  ab.style.display = state.isAdmin ? 'flex' : 'none';
}

export function switchTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.getElementById(`${tabName}-tab`)?.classList.add('active');
  document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabName));
  document.getElementById('page-title').textContent = TAB_TITLES[tabName] || 'Art Deck';
  
  switch (tabName) {
    case 'collection':
      cardMod.renderCollection();
      decks.renderDecks();
      break;
    case 'profile': user.renderProfile(); break;
    case 'leaderboard': leaderboard.renderLeaderboard(); break;
    case 'packs': packs.renderShop(); break;
    case 'admin': admin.initAdminPanel(); break;
  }
}

export function openModal(id) { document.getElementById(id)?.classList.add('active'); }
export function closeModal(id) { document.getElementById(id)?.classList.remove('active'); }
function showApp() { document.getElementById('app').style.display = 'grid'; document.getElementById('auth-page').style.display = 'none'; }
function showAuthPage() { document.getElementById('app').style.display = 'none'; document.getElementById('auth-page').style.display = 'flex'; state.isLoginMode = true; updateAuthUI(); }
function updateAuthUI() {
  const btn = document.getElementById('auth-btn');
  const toggle = document.getElementById('toggle-auth');
  if (state.isLoginMode) { btn.textContent = '🔐 Login'; toggle.textContent = 'Register'; }
  else { btn.textContent = '✨ Reg'; toggle.textContent = 'Have account?'; }
}
function setupAuthListeners() {
  document.getElementById('toggle-password')?.addEventListener('click', (e) => {
    e.preventDefault();
    const inp = document.getElementById('auth-password');
    if (inp.type === 'password') { inp.type = 'text'; e.target.textContent = '😨'; }
    else { inp.type = 'password'; e.target.textContent = '👁'; }
  });
  
  const form = document.getElementById('auth-form');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      state.isLoginMode ? await auth.login(email, password) : await auth.register(email, password);
      await loadInitialData();
      showApp();
      setupEventListeners();
      await checkDailyRewards();
    } catch (e) { document.getElementById('auth-error').textContent = e.message; }
    finally { btn.disabled = false; }
  });
  document.getElementById('toggle-auth')?.addEventListener('click', () => { state.isLoginMode = !state.isLoginMode; updateAuthUI(); });
}
function setupEventListeners() {
  document.querySelectorAll('.sidebar-btn[data-tab]').forEach(b => { b.addEventListener('click', () => switchTab(b.dataset.tab)); });
  document.getElementById('logout-btn')?.addEventListener('click', async () => { await auth.logout(); state.currentUser = null; showAuthPage(); });
  document.querySelectorAll('[id*="modal"]').forEach(m => {
    m.addEventListener('click', (e) => { if (e.target === m) m.classList.remove('active'); });
    m.querySelector('.modal-close')?.addEventListener('click', () => m.classList.remove('active'));
  });
  document.getElementById('rarity-filter')?.addEventListener('change', () => {
    cardMod.renderCollection();
  });
}
export { updateUserInterface };
if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initApp); } else { initApp(); }
