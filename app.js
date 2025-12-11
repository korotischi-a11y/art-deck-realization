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
  isAdmin: false
};

// === ТАБЛИЦА НАВигаЦИИ ===
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
  console.log('[ОНИЦ]Инициализация Art Deck...');
  
  try {
    // Проверяем аутентификацию
    await auth.checkAuthState();
    
    if (!state.currentUser) {
      // Показываем страницу авторизации
      showAuthPage();
      return;
    }
    
    // Приложение готово
    showApp();
    await loadInitialData();
    setupEventListeners();
    
    console.log('✔️ Приложение загружено');
  } catch (error) {
    console.error('Ошибка инициализации:', error);
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
  
  // Обновляю ник
  document.getElementById('user-name').textContent = 
    currentUser.username || currentUser.email?.split('@')[0] || 'Гость';
  
  // Обновляю монеты
  document.getElementById('coins-display').textContent = currentUser.currency || 100;
  
  // Обновляю тир
  const deckRating = user.calculateDeckRating();
  const tier = user.getRatingTier(deckRating);
  const tierEmojis = {
    'Common': '📍',
    'Uncommon': '🎯',
    'Rare': '🏆',
    'Epic': '💎',
    'Ancient': '🔥',
    'Legendary': '⭐',
    'Immortal': '👑'
  };
  
  document.getElementById('user-rank').textContent = 
    `${tierEmojis[tier] || '📍'} ${tier}`;
  
  // Показываю админ-кнопку, если это админ
  const adminBtn = document.getElementById('admin-btn');
  if (state.isAdmin) {
    adminBtn.style.display = 'flex';
  } else {
    adminBtn.style.display = 'none';
  }
}

/**
 * Переключает вкладки
 */
export function switchTab(tabName) {
  // Открываю контент
  const tabContents = document.querySelectorAll('.tab-content');
  tabContents.forEach(tab => tab.classList.remove('active'));
  document.getElementById(`${tabName}-tab`).classList.add('active');
  
  // Обновляю активные кнопки
  const sidebarBtns = document.querySelectorAll('.sidebar-btn');
  sidebarBtns.forEach(btn => {
    if (btn.dataset.tab === tabName) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  // Обновляю заголовок
  document.getElementById('page-title').textContent = TAB_TITLES[tabName] || 'Art Deck';
  
  // Дополнительная логика для некоторых табов
  switch (tabName) {
    case 'collection':
      cards.renderCollection();
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
 * Открывает модальное окно
 */
export function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
  }
}

/**
 * Закрывает модальное окно
 */
export function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
  }
}

/**
 * Показывает страницу аппликации
 */
function showApp() {
  document.getElementById('app').style.display = 'grid';
  document.getElementById('auth-page').style.display = 'none';
}

/**
 * Показывает страницу авторизации
 */
function showAuthPage() {
  document.getElementById('app').style.display = 'none';
  document.getElementById('auth-page').style.display = 'flex';
}

/**
 * Настраивают слушатели событий
 */
function setupEventListeners() {
  // Навигация по вкладкам
  document.querySelectorAll('.sidebar-btn[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  
  // Выход
  document.getElementById('logout-btn').addEventListener('click', () => {
    auth.logout().then(() => {
      state.currentUser = null;
      showAuthPage();
    });
  });
  
  // Окрытие модалей
  document.querySelectorAll('[class*="modal"]').forEach(modal => {
    // Закрытие по клику вне модали
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });
    
    // Закрытие по кнопке х
    const closeBtn = modal.querySelector('.modal-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        modal.classList.remove('active');
      });
    }
  });
  
  // Профильтр по редкости
  const rarityFilter = document.getElementById('rarity-filter');
  if (rarityFilter) {
    rarityFilter.addEventListener('change', () => {
      cards.renderCollection();
    });
  }
}

// === ПУБЛИЧНОЕ API ===
export {
  state,
  updateUserInterface,
  switchTab
};

// === ЗАПУСК ПО КОнтролю DOM ===
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
