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

// === МИССИИ ===
const QUESTS = {
  'first_pack': {
    id: 'first_pack',
    title: 'Первые шаги',
    desc: 'Откройте первый пак',
    reward: 100,
    progress: 'packsOpened',
    target: 1
  },
  'collect_5': {
    id: 'collect_5',
    title: 'Начинающий коллекционер',
    desc: 'Соберите 5 уникальных карт',
    reward: 150,
    progress: 'uniqueCards',
    target: 5
  },
  'collect_10': {
    id: 'collect_10',
    title: 'Коллекционер',
    desc: 'Соберите 10 уникальных карт',
    reward: 200,
    progress: 'uniqueCards',
    target: 10
  },
  'first_legendary': {
    id: 'first_legendary',
    title: 'Легенда',
    desc: 'Получите первую легендарную карту',
    reward: 250,
    progress: 'legendaryCards',
    target: 1
  },
  'rare_collector': {
    id: 'rare_collector',
    title: 'Мастер редкостей',
    desc: 'Насобирайте редкие и выше карты',
    reward: 300,
    progress: 'rareCards',
    target: 5
  }
};

// === ТАБЛИЦА НАВГАЦИИ ===
const TAB_TITLES = {
  collection: '📚 Моя коллекция',
  profile: '👤 Мой профиль',
  leaderboard: '🏆 Глобальный рейтинг',
  packs: '💳 Магазин паков',
  admin: '⚙️ Админ-панель'
};

// === ДНЕВНЫЕ БОНУСЫ ===
/**
 * Проверяют и выдают ежедневные бонусы
 */
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
      // Дать +50 монет и +1 бесплатное открытие
      await userRef.update({
        currency: (userData.currency || 0) + 50,
        lastDailyReward: new Date(),
        dailyFreeOpens: (userData.dailyFreeOpens || 0) + 1
      });
      
      // Обновить состояние
      state.currentUser.currency = (userData.currency || 0) + 50;
      state.currentUser.dailyFreeOpens = (userData.dailyFreeOpens || 0) + 1;
      
      ui.showToast('🎁 Ежедневный бонус! +50 монет 💎', 'success');
      updateUserInterface();
    }
  } catch (error) {
    console.error('Ошибка дневных бонусов:', error);
  }
}

/**
 * Получит миссии пользователя
 */
async function loadQuests() {
  try {
    const user = firebase.auth().currentUser;
    if (!user) return [];
    
    const userData = (await firebase.firestore().collection('users').doc(user.uid).get()).data();
    const completedQuests = userData?.completedQuests || [];
    
    return Object.values(QUESTS).map(quest => ({
      ...quest,
      completed: completedQuests.includes(quest.id)
    }));
  } catch (error) {
    console.error('Ошибка загружки миссий:', error);
    return [];
  }
}

/**
 * Рендерит миссии
 */
export function renderQuests() {
  loadQuests().then(quests => {
    const container = document.getElementById('quests-container');
    if (!container) return;
    
    container.innerHTML = quests.map(quest => `
      <div class="quest-card ${quest.completed ? 'completed' : ''}">
        <div class="quest-icon">✨</div>
        <div class="quest-info">
          <h4>${quest.title}</h4>
          <p>${quest.desc}</p>
          <div class="quest-reward">+${quest.reward} 💎</div>
        </div>
        ${quest.completed ? '<span class="quest-badge">\u2713 Выполнено</span>' : ''}
      </div>
    `).join('');
  });
}

/**
 * Проверяют выполнение миссий
 */
export async function checkQuestCompletion() {
  try {
    const user = firebase.auth().currentUser;
    if (!user) return;
    
    const userData = (await firebase.firestore().collection('users').doc(user.uid).get()).data();
    const completedQuests = userData?.completedQuests || [];
    
    for (const questId in QUESTS) {
      if (completedQuests.includes(questId)) continue;
      
      const quest = QUESTS[questId];
      const currentProgress = userData[quest.progress] || 0;
      
      if (currentProgress >= quest.target) {
        // Миссия выполнена!
        await firebase.firestore().collection('users').doc(user.uid).update({
          completedQuests: [...completedQuests, questId],
          currency: (userData.currency || 0) + quest.reward
        });
        
        state.currentUser.currency = (userData.currency || 0) + quest.reward;
        ui.showToast(`🌟 Миссия выполнена! +${quest.reward} 💎`, 'success');
        updateUserInterface();
        renderQuests();
      }
    }
  } catch (error) {
    console.error('Ошибка проверки миссий:', error);
  }
}

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
    
    // Проверяем дневные бонусы
    await checkDailyRewards();
    
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
    submitBtn.textContent = '⏳ Подхдите...';
    
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
      
      // Проверяем дневные бонусы
      await checkDailyRewards();
      
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
