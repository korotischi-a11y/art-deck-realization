/**
 * 🏗️ STATE MANAGER
 * Централизованное управление состоянием приложения
 * Аналог Redux, но легче и без зависимостей
 */

class StateManager {
  #state = {
    currentUser: null,
    cards: [],
    userCards: {},
    decks: [],
    activeDeckId: null,
    packs: [],
    leaderboard: [],
    isAdmin: false,
    currency: 0,
    loading: false,
  };

  #listeners = new Map();
  #listenerIdCounter = 0;

  constructor() {
    // Debug mode: логирует все изменения
    if (localStorage.getItem('debug') === 'true') {
      this.subscribe('*', (state, prevState) => {
        console.log('[STATE CHANGE]', { prev: prevState, next: state });
      });
    }
  }

  /**
   * Подписаться на изменения
   * @param {string} key - Ключ состояния или '*' для всех изменений
   * @param {Function} callback - Функция, вызываемая при изменении
   * @returns {Function} Функция отписки
   */
  subscribe(key, callback) {
    const id = this.#listenerIdCounter++;
    
    if (!this.#listeners.has(key)) {
      this.#listeners.set(key, new Map());
    }
    
    this.#listeners.get(key).set(id, callback);
    
    // Возвращаем функцию отписки
    return () => {
      const keyListeners = this.#listeners.get(key);
      if (keyListeners) {
        keyListeners.delete(id);
        if (keyListeners.size === 0) {
          this.#listeners.delete(key);
        }
      }
    };
  }

  /**
   * Получить копию состояния (иммутабельно)
   */
  getState() {
    return JSON.parse(JSON.stringify(this.#state));
  }

  /**
   * Получить значение по ключу
   */
  get(key) {
    return this.#state[key];
  }

  /**
   * Обновить состояние
   * @param {Object|Function} partial - Объект изменений или функция
   */
  setState(partial) {
    const prevState = this.getState();
    
    if (typeof partial === 'function') {
      this.#state = { ...this.#state, ...partial(this.#state) };
    } else {
      this.#state = { ...this.#state, ...partial };
    }

    this.#notify(prevState);
  }

  /**
   * Сбросить состояние к начальному
   */
  reset() {
    const prevState = this.getState();
    this.#state = {
      currentUser: null,
      cards: [],
      userCards: {},
      decks: [],
      activeDeckId: null,
      packs: [],
      leaderboard: [],
      isAdmin: false,
      currency: 0,
      loading: false,
    };
    this.#notify(prevState);
  }

  /**
   * Уведомить подписчиков об изменениях
   */
  #notify(prevState) {
    const newState = this.getState();

    // Глобальные слушатели (*)
    const globalListeners = this.#listeners.get('*');
    if (globalListeners) {
      globalListeners.forEach(callback => {
        try {
          callback(newState, prevState);
        } catch (error) {
          console.error('[STATE ERROR]', error);
        }
      });
    }

    // Слушатели конкретных ключей
    for (const [key, listeners] of this.#listeners) {
      if (key !== '*' && prevState[key] !== newState[key]) {
        listeners.forEach(callback => {
          try {
            callback(newState[key], prevState[key]);
          } catch (error) {
            console.error(`[STATE ERROR] Key: ${key}`, error);
          }
        });
      }
    }
  }

  /**
   * Batch обновление (несколько изменений за раз)
   */
  batch(updates) {
    const prevState = this.getState();
    
    for (const update of updates) {
      if (typeof update === 'function') {
        this.#state = { ...this.#state, ...update(this.#state) };
      } else {
        this.#state = { ...this.#state, ...update };
      }
    }
    
    this.#notify(prevState);
  }
}

// Singleton instance
export const stateManager = new StateManager();

// Helper functions
export const getState = () => stateManager.getState();
export const setState = (partial) => stateManager.setState(partial);
export const subscribe = (key, callback) => stateManager.subscribe(key, callback);

// Пример использования:
// 
// import { stateManager, setState, subscribe } from './modules/state-manager.js';
// 
// // Подписка на изменения currency
// const unsubscribe = subscribe('currency', (newValue, oldValue) => {
//   console.log(`Currency changed: ${oldValue} → ${newValue}`);
// });
// 
// // Обновление состояния
// setState({ currency: 100 });
// 
// // Отписка
// unsubscribe();
