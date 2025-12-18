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

export const state = { 
  currentUser: null, 
  cards: [], 
  packs: [], 
  leaderboard: [], 
  isAdmin: false, 
  isLoginMode: true 
};

const TAB_TITLES = {
  collection: '📚 Коллекция',
  profile: '👤 Профиль',
  leaderboard: '🏆 Рейтинг',
  packs: '📋 Паки',
  admin: '⚙ Админ'
};

/**
 * Проверка дневных наград
 */
async function checkDailyRewards() {
  try {
    const u = state.currentUser;
    if (!u) return;
    
    const db = firebase.firestore();
    const userRef = db.collection('users').doc(u.uid);
    const data = (await userRef.get()).data();
    if (!data) return;
    
    const lastDay = data.lastDailyReward?.toDate() || new Date(0);
    const now = new Date();
    const diff = Math.floor((now - lastDay) / (1000 * 60 * 60 * 24));
    
    if (diff >= 1) {
      await userRef.update({ 
        currency: (data.currency || 0) + 50, 
        lastDailyReward: new Date(), 
        dailyFreeOpens: 1 
      });
      state.currentUser.currency = (data.currency || 0) + 50;
      state.currentUser.dailyFreeOpens = 1;
      ui.showToast('🎁 +50 💨', 'success');
      updateUserInterface();
    }
  } catch (e) { 
    console.error('[APP] Daily check:', e); 
  }
}

/**
 * Основная инициализация приложения
 */
async function initApp() {
  console.log('[APP] Initializing Art Deck...');
  try {
    // Проверяем Firebase
    if (!firebase || !firebase.auth || !firebase.firestore) {
      console.error('[APP] Firebase not available');
      ui.showError('Ошибка Firebase');
      return;
    }
    
    // Проверяем авторизацию
    await auth.checkAuthState();
    
    if (!state.currentUser) {
      console.log('[APP] User not authenticated');
      showAuthPage();
      setupAuthListeners();
      return;
    }
    
    console.log('[APP] User authenticated:', state.currentUser.email);
    showApp();
    
    // Загружаем все данные
    await loadInitialData();
    
    // Настраиваем слушатели
    setupEventListeners();
    
    // Проверяем дневные награды
    await checkDailyRewards();
    
    console.log('[APP] ✅ Ready!');
  } catch (e) { 
    console.error('[APP] Init error:', e);
    ui.showError('Ошибка инициализации');
  }
}

/**
 * Лоадинг начальных данных
 */
async function loadInitialData() {
  console.log('[APP] Loading initial data...');
  try {
    await cardMod.loadCards();
    await decks.loadDecks();
    await packs.loadPacks();
    await leaderboard.loadLeaderboard();
    
    updateUserInterface();
    user.renderProfile();
    switchTab('collection');
    
    console.log('[APP] ✅ Data loaded');
  } catch (e) { 
    console.error('[APP] Load error:', e);
    throw e;
  }
}

/**
 * Обновление пользовательского интерфейса
 */
function updateUserInterface() {
  const { currentUser } = state;
  if (!currentUser) return;
  
  document.getElementById('user-name').textContent = currentUser?.username || currentUser?.email?.split('@')[0] || 'Guest';
  document.getElementById('coins-display').textContent = currentUser?.currency || 100;
  
  const tiers = { 
    'Common': '📑', 
    'Uncommon': '🎯', 
    'Rare': '🏆', 
    'Epic': '💎', 
    'Ancient': '🔥', 
    'Legendary': '⭐', 
    'Immortal': '👑' 
  };
  document.getElementById('user-rank').textContent = `${tiers['Common'] || '📑'} Common`;
  
  const ab = document.getElementById('admin-btn');
  if (ab) ab.style.display = state.isAdmin ? 'flex' : 'none';
}

/**
 * Переключение табов
 */
export function switchTab(tabName) {
  console.log('[APP] Switching to tab:', tabName);
  
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.getElementById(`${tabName}-tab`)?.classList.add('active');
  document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabName));
  document.getElementById('page-title').textContent = TAB_TITLES[tabName] || 'Art Deck';
  
  switch (tabName) {
    case 'collection':
      cardMod.renderCollection();
      decks.renderDecks();
      break;
    case 'profile':
      user.renderProfile();
      break;
    case 'leaderboard':
      leaderboard.renderLeaderboard();
      break;
    case 'packs':
      packs.renderShop();
      break;
    case 'admin':
      admin.initAdminPanel();
      break;
  }
}

/**
 * Открытие/закрытие модалю
 */
export function openModal(id) { 
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('active');
}

export function closeModal(id) { 
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('active');
}

/**
 * Показ приложения
 */
function showApp() { 
  document.getElementById('app').style.display = 'grid'; 
  document.getElementById('auth-page').style.display = 'none'; 
}

/**
 * Показ авторизации
 */
function showAuthPage() { 
  document.getElementById('app').style.display = 'none'; 
  document.getElementById('auth-page').style.display = 'flex'; 
  state.isLoginMode = true; 
  updateAuthUI(); 
}

/**
 * Обновление уи авторизации
 */
function updateAuthUI() {
  const btn = document.getElementById('auth-btn');
  const toggle = document.getElementById('toggle-auth');
  if (state.isLoginMode) { 
    btn.textContent = '🔐 Войти'; 
    toggle.textContent = 'Регистрация'; 
  }
  else { 
    btn.textContent = '✨ Рег'; 
    toggle.textContent = 'Есть аккаунт?'; 
  }
}

/**
 * Настройка слушателей авторизации
 */
function setupAuthListeners() {
  document.getElementById('toggle-password')?.addEventListener('click', (e) => {
    e.preventDefault();
    const inp = document.getElementById('auth-password');
    if (inp.type === 'password') { 
      inp.type = 'text'; 
      e.target.textContent = '😨'; 
    }
    else { 
      inp.type = 'password'; 
      e.target.textContent = '👁'; 
    }
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
    } catch (e) { 
      document.getElementById('auth-error').textContent = e.message;
      document.getElementById('auth-error').style.display = 'block';
    }
    finally { 
      btn.disabled = false; 
    }
  });
  
  document.getElementById('toggle-auth')?.addEventListener('click', () => { 
    state.isLoginMode = !state.isLoginMode; 
    updateAuthUI(); 
  });
}

/**
 * Настройка основных слушателей
 */
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
    m.addEventListener('click', (e) => { 
      if (e.target === m) m.classList.remove('active'); 
    });
    m.querySelector('.modal-close')?.addEventListener('click', () => m.classList.remove('active'));
  });
  
  document.getElementById('rarity-filter')?.addEventListener('change', () => {
    cardMod.renderCollection();
  });
}

export { updateUserInterface };

/**
 * Запуск initApp когда документ вполне загружен
 */
if (document.readyState === 'loading') { 
  document.addEventListener('DOMContentLoaded', initApp); 
} else { 
  // Все скрипты загружены, но давай подождем Firebase
  setTimeout(initApp, 500); 
}
