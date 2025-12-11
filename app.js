/**
 * app.js
 * Оркестратор приложения
 * 
 * Ответственность:
 * - Инициализация всех модулей
 * - Управление глобальным состоянием
 * - Навигация между вкладками
 * - Модальные окна
 * - Обновление интерфейса
 */

import * as auth from './modules/auth.js';
import * as cards from './modules/cards.js';
import * as user from './modules/user.js';
import * as leaderboard from './modules/leaderboard.js';
import * as packs from './modules/packs.js';
import * as admin from './modules/admin.js';
import * as ui from './modules/ui.js';

// === ГЛОБАЛЬНОЕ СОСТОЯНИЕ ===
export const state = {
  currentUser: null,
  cards: [],
  packs: [],
  userCards: {},
  userStats: {},
  leaderboard: [],
  isAdmin: false,
  isLoginMode: true  // Флаг: true = вход, false = регистрация
};

// === ТАБЛИЦА НАВГАЦИИ ===
const TAB_TITLES = {
  collection: '📚 Моя коллекция',
  profile: '👤 Мой профиль',
  leaderboard: '🏆 Глобальный рейтинг',
  packs: '💳 Магазин паков',
  admin: '⚙️ Админ-панель'
};

/**
 * Инициализация приложения
 */
async function initApp() {
  console.log('[ОНИЦ] Инициализация Art Deck...');
  
  try {
    // Проверяем аутентификацию
    await auth.checkAuthState();
    
    if (!state.currentUser) {
      // Показываем страницу авторизации
      showAuthPage();
      setupAuthListeners();
      return;
    }
    
    // Приложение готово
    showApp();
    await loadInitialData();
    setupEventListeners();
    
    console.log('✅ Приложение загружено');
  } catch (error) {
    console.error('Ошибка инициализации:', error);
    ui.showError('Ошибка инициализации приложения');
  }
}

/**
 * Загружают все карты, данные пользователя, паки
 */
async function loadInitialData() {
  console.log('Загружаю данные...');
  
  try {
    // Загружаю карты
    await cards.loadCards();
    
    // Загружаю данные пользователя
    await user.loadUserData();
    
    // Загружаю паки
    await packs.loadPacks();
    
    // Загружаю рейтинг
    await leaderboard.loadLeaderboard();
    
    // Настраиваю пользователя в интерфейсе
    updateUserInterface();
    
    // Показываю коллекцию по умолчанию
    switchTab('collection');
  } catch (error) {
    console.error('Ошибка загружки:', error);
    ui.showError('Ошибка загружки данных');
  }
}

/**
 * Обновляет информацию пользователя в заголовке
 */
function updateUserInterface() {
  const { currentUser } = state;
  
  document.getElementById('user-name').textContent = 
    currentUser.username || currentUser.email?.split('@')[0] || 'Гость';
  document.getElementById('coins-display').textContent = currentUser.currency || 100;
  
  const deckRating = user.calculateDeckRating();
  const tier = user.getRatingTier(deckRating);
  const tierEmojis = {
    'Common': '📍', 'Uncommon': '🎯', 'Rare': '🏆',
    'Epic': '💎', 'Ancient': '🔥', 'Legendary': '⭐', 'Immortal': '👑'
  };
  
  document.getElementById('user-rank').textContent = `${tierEmojis[tier] || '📍'} ${tier}`;
  
  const adminBtn = document.getElementById('admin-btn');
  adminBtn.style.display = state.isAdmin ? 'flex' : 'none';
}

/**
 * Переключает вкладки
 */
export function switchTab(tabName) {
  const tabContents = document.querySelectorAll('.tab-content');
  tabContents.forEach(tab => tab.classList.remove('active'));
  document.getElementById(`${tabName}-tab`).classList.add('active');
  
  const sidebarBtns = document.querySelectorAll('.sidebar-btn');
  sidebarBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  
  document.getElementById('page-title').textContent = TAB_TITLES[tabName] || 'Art Deck';
  
  switch (tabName) {
    case 'collection': cards.renderCollection(); break;
    case 'profile': user.renderProfile(); break;
    case 'leaderboard': leaderboard.renderLeaderboard(); break;
    case 'packs': packs.renderShop(); break;
    case 'admin': admin.initAdminPanel(); break;
  }
}

/**
 * Открывает/закрывает модальные окна
 */
export function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('active');
}

export function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('active');
}

/**
 * Настройка режима доступа
 */
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
    btn.textContent = '🔓 Вход';
    toggleBtn.textContent = 'Создать аккаунт';
  } else {
    btn.textContent = '✨ Регистрация';
    toggleBtn.textContent = 'Уже есть аккаунт?';
  }
}

/**
 * Обработчики авторизации
 */
function setupAuthListeners() {
  const form = document.getElementById('auth-form');
  const toggleBtn = document.getElementById('toggle-auth');
  const errorDiv = document.getElementById('auth-error');
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    
    errorDiv.style.display = 'none';
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Посхдите...';
    
    try {
      if (state.isLoginMode) {
        await auth.login(email, password);
      } else {
        await auth.register(email, password);
      }
      
      await loadInitialData();
      showApp();
      setupEventListeners();
      updateAuthUI();
      
    } catch (error) {
      errorDiv.textContent = error.message;
      errorDiv.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = state.isLoginMode ? '🔓 Вход' : '✨ Регистрация';
    }
  });
  
  toggleBtn.addEventListener('click', () => {
    state.isLoginMode = !state.isLoginMode;
    document.getElementById('auth-email').value = '';
    document.getElementById('auth-password').value = '';
    errorDiv.style.display = 'none';
    updateAuthUI();
  });
}

/**
 * Обработчики приложения
 */
function setupEventListeners() {
  document.querySelectorAll('.sidebar-btn[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  
  document.getElementById('logout-btn').addEventListener('click', async () => {
    try {
      await auth.logout();
      state.currentUser = null;
      showAuthPage();
    } catch (error) {
      ui.showError('Ошибка при выходе');
    }
  });
  
  document.querySelectorAll('[id*="modal"]').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('active');
    });
    
    const closeBtn = modal.querySelector('.modal-close');
    if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.remove('active'));
  });
  
  const rarityFilter = document.getElementById('rarity-filter');
  if (rarityFilter) rarityFilter.addEventListener('change', () => cards.renderCollection());
}

export { updateUserInterface };

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
