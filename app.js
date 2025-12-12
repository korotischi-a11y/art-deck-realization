/**
 * app.js - оркестратор
 */

import * as auth from './modules/auth.js';
import * as cardMod from './modules/cards-new.js';
import * as decks from './modules/decks.js';
import * as user from './modules/user.js';
import * as leaderboard from './modules/leaderboard.js';
import * as packs from './modules/packs.js';
import * as admin from './modules/admin.js';
import * as ui from './modules/ui.js';

export const state = {
  currentUser: null,
  cards: [],
  packs: [],
  isAdmin: false,
  isLoginMode: true
};

const QUESTS = {
  'first_pack': { id: 'first_pack', title: 'Первые шаги', desc: 'Откройте пак', reward: 100, progress: 'packsOpened', target: 1 },
  'collect_5': { id: 'collect_5', title: 'Коллекционер', desc: '5 карт', reward: 150, progress: 'uniqueCards', target: 5 },
  'collect_10': { id: 'collect_10', title: 'Мастер', desc: '10 карт', reward: 200, progress: 'uniqueCards', target: 10 },
  'first_legendary': { id: 'first_legendary', title: 'Легенда', desc: 'Легенда', reward: 250, progress: 'legendaryCards', target: 1 },
  'rare_collector': { id: 'rare_collector', title: 'Мастер редкостей', desc: 'редкие карты', reward: 300, progress: 'rareCards', target: 5 }
};

const TAB_TITLES = {
  collection: '📚 Коллекция',
  profile: '👤 Профиль',
  leaderboard: '🏆 Рейтинг',
  packs: '📋 Паки',
  admin: '⚙ Админ'
};

async function checkDailyRewards() {
  try {
    const user = firebase.auth().currentUser;
    if (!user) return;
    const userRef = firebase.firestore().collection('users').doc(user.uid);
    const userData = (await userRef.get()).data();
    if (!userData) return;
    const lastReward = userData.lastDailyReward?.toDate() || new Date(0);
    const now = new Date();
    const daysDiff = Math.floor((now - lastReward) / (1000 * 60 * 60 * 24));
    if (daysDiff >= 1) {
      await userRef.update({
        currency: (userData.currency || 0) + 50,
        lastDailyReward: new Date(),
        dailyFreeOpens: (userData.dailyFreeOpens || 0) + 1
      });
      state.currentUser.currency = (userData.currency || 0) + 50;
      state.currentUser.dailyFreeOpens = (userData.dailyFreeOpens || 0) + 1;
      ui.showToast('🎁 +50 💎', 'success');
      updateUserInterface();
    }
  } catch (error) {
    console.error('Daily:', error);
  }
}

async function loadQuests() {
  try {
    const user = firebase.auth().currentUser;
    if (!user) return [];
    const userData = (await firebase.firestore().collection('users').doc(user.uid).get()).data();
    const completed = userData?.completedQuests || [];
    return Object.values(QUESTS).map(q => ({ ...q, completed: completed.includes(q.id) }));
  } catch (error) {
    console.error('Quests:', error);
    return [];
  }
}

export function renderQuests() {
  loadQuests().then(quests => {
    const container = document.getElementById('quests-container');
    if (!container) return;
    container.innerHTML = quests.map(q => `
      <div class="quest-card ${q.completed ? 'completed' : ''}">
        <div class="quest-icon">✨</div>
        <div class="quest-info">
          <h4>${q.title}</h4>
          <p>${q.desc}</p>
          <div class="quest-reward">+${q.reward} 💎</div>
        </div>
        ${q.completed ? '<span>✓</span>' : ''}
      </div>
    `).join('');
  });
}

export async function checkQuestCompletion() {
  try {
    const user = firebase.auth().currentUser;
    if (!user) return;
    const userData = (await firebase.firestore().collection('users').doc(user.uid).get()).data();
    const completed = userData?.completedQuests || [];
    for (const questId in QUESTS) {
      if (completed.includes(questId)) continue;
      const quest = QUESTS[questId];
      if ((userData[quest.progress] || 0) >= quest.target) {
        await firebase.firestore().collection('users').doc(user.uid).update({
          completedQuests: [...completed, questId],
          currency: (userData.currency || 0) + quest.reward
        });
        state.currentUser.currency = (userData.currency || 0) + quest.reward;
        ui.showToast(`🌟 +${quest.reward} 💎`, 'success');
        updateUserInterface();
        renderQuests();
      }
    }
  } catch (error) {
    console.error('CheckQuest:', error);
  }
}

async function initApp() {
  console.log('[INIT] Art Deck...');
  try {
    await auth.checkAuthState();
    if (!state.currentUser) {
      showAuthPage();
      setupAuthListeners();
      return;
    }
    showApp();
    await loadInitialData();
    setupEventListeners();
    await checkDailyRewards();
    console.log('✅ OK');
  } catch (error) {
    console.error('Error:', error);
  }
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
  } catch (error) {
    console.error('Load:', error);
  }
}

function updateUserInterface() {
  const { currentUser } = state;
  document.getElementById('user-name').textContent = currentUser.username || currentUser.email?.split('@')[0] || 'Guest';
  document.getElementById('coins-display').textContent = currentUser.currency || 100;
  const deckRating = cardMod.calculateDeckRating();
  const tier = user.getRatingTier(deckRating);
  const tiers = { 'Common': '📑', 'Uncommon': '🎯', 'Rare': '🏆', 'Epic': '💎', 'Ancient': '🔥', 'Legendary': '⭐', 'Immortal': '👑' };
  document.getElementById('user-rank').textContent = `${tiers[tier] || '📑'} ${tier}`;
  const adminBtn = document.getElementById('admin-btn');
  adminBtn.style.display = state.isAdmin ? 'flex' : 'none';
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

export function openModal(modalId) {
  const m = document.getElementById(modalId);
  if (m) m.classList.add('active');
}

export function closeModal(modalId) {
  const m = document.getElementById(modalId);
  if (m) m.classList.remove('active');
}

function showApp() {
  document.getElementById('app').style.display = 'grid';
  document.getElementById('auth-page').style.display = 'none';
}

function showAuthPage() {
  document.getElementById('app').style.display = 'none';
  document.getElementById('auth-page').style.display = 'flex';
  state.isLoginMode = true;
  updateAuthUI();
}

function updateAuthUI() {
  const btn = document.getElementById('auth-btn');
  const toggleBtn = document.getElementById('toggle-auth');
  if (state.isLoginMode) {
    btn.textContent = '🔐 Вход';
    toggleBtn.textContent = 'Регистрация';
  } else {
    btn.textContent = '✨ Рег';
    toggleBtn.textContent = 'Уже есть?';
  }
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
    } catch (error) {
      document.getElementById('auth-error').textContent = error.message;
    } finally {
      submitBtn.disabled = false;
    }
  });
  toggleBtn?.addEventListener('click', () => {
    state.isLoginMode = !state.isLoginMode;
    updateAuthUI();
  });
}

function setupEventListeners() {
  document.querySelectorAll('.sidebar-btn[data-tab]').forEach(b => {
    b.addEventListener('click', () => switchTab(b.dataset.tab));
  });
  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    await auth.logout();
    state.currentUser = null;
    showAuthPage();
  });
  document.querySelectorAll('[id*="modal"]').forEach(m => {
    m.addEventListener('click', (e) => { if (e.target === m) m.classList.remove('active'); });
    m.querySelector('.modal-close')?.addEventListener('click', () => m.classList.remove('active'));
  });
  document.getElementById('rarity-filter')?.addEventListener('change', () => cardMod.renderCollection());
}

export { updateUserInterface };

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
