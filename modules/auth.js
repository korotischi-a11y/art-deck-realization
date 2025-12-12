/**
 * modules/auth.js
 * Автентификация через Firebase Auth + инициализация колод
 */

import { state } from '../app.js';
import * as ui from './ui.js';

const { auth, db, Firestore } = initializeFirebase();

function initializeFirebase() {
  const auth = firebase.auth();
  const db = firebase.firestore();
  const Firestore = firebase.firestore;
  return { auth, db, Firestore };
}

// Максимум колод сейчас
const MAX_DECKS = 10;

/**
 * Проверяет текущее состояние авторизации
 */
export async function checkAuthState() {
  return new Promise((resolve) => {
    auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        await loadUserData(firebaseUser.uid);
        resolve(true);
      } else {
        state.currentUser = null;
        resolve(false);
      }
    });
  });
}

/**
 * Загружает данные пользователя из Firestore и при необходимости
 * делает мягкую миграцию в новую схему с колодами.
 */
async function loadUserData(uid) {
  try {
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      console.warn('📄 Документ пользователя не найден');
      return;
    }

    const userData = userDoc.data();

    // --- МЯГКАЯ МИГРАЦИЯ В СХЕМУ С КОЛОДАМИ ---
    let decks = userData.decks || {};
    let activeDeckId = userData.activeDeckId || null;
    const cards = userData.cards || {};

    // Если ещё нет ни одной колоды, создаём первую из существующей коллекции
    if (!Object.keys(decks).length) {
      const deckId = `deck_${Date.now()}`;
      decks = {
        [deckId]: {
          id: deckId,
          name: 'Первая колода',
          description: 'Создано автоматически из вашей коллекции',
          cards: { ...cards }, // каждая карта доступна в стартовой колоде
          rating: 0,
          isActive: true,
          color: '#3a8d8e',
          createdAt: Firestore.Timestamp.now()
        }
      };
      activeDeckId = deckId;

      // Обновляем Firestore один раз, без удаления старых полей
      await userRef.update({
        decks,
        activeDeckId
      });
    } else if (!activeDeckId) {
      // Колоды есть, но activeDeckId не выставлен – выбираем первую
      const firstId = Object.keys(decks)[0];
      decks[firstId].isActive = true;
      activeDeckId = firstId;
      await userRef.update({ decks, activeDeckId });
    }

    // --- Обновляем state ---
    state.currentUser = {
      uid,
      email: userData.email,
      username: userData.username,
      currency: userData.currency || 100,
      cards,
      decks,
      activeDeckId,
      isAdmin: userData.isAdmin || false,
      createdAt: userData.createdAt
    };
    state.isAdmin = userData.isAdmin || false;
  } catch (error) {
    console.error('Ошибка загрузки/миграции пользователя:', error);
  }
}

/**
 * Регистрация нового пользователя
 * Сразу создаём первую пустую колоду.
 */
export async function register(email, password) {
  if (!ui.validateEmail(email)) {
    throw new Error('Неверный email');
  }
  if (!ui.validatePassword(password)) {
    throw new Error('Пароль должен содержать минимум 6 символов');
  }

  try {
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    const uid = userCredential.user.uid;
    const username = email.split('@')[0];

    const deckId = `deck_${Date.now()}`;
    const decks = {
      [deckId]: {
        id: deckId,
        name: 'Первая колода',
        description: 'Стартовая колода',
        cards: {},
        rating: 0,
        isActive: true,
        color: '#3a8d8e',
        createdAt: Firestore.Timestamp.now()
      }
    };

    await db.collection('users').doc(uid).set({
      email,
      username,
      currency: 100,
      cards: {},            // глобальная коллекция
      decks,                // новые колоды
      activeDeckId: deckId, // активная колода
      isAdmin: false,
      createdAt: Firestore.Timestamp.now(),
      totalCards: 0,
      totalPacks: 0,
      completedQuests: [],
      dailyFreeOpens: 0
    });

    state.currentUser = {
      uid,
      email,
      username,
      currency: 100,
      cards: {},
      decks,
      activeDeckId: deckId,
      isAdmin: false
    };

    return { success: true, uid };
  } catch (error) {
    if (error.code === 'auth/email-already-in-use') {
      throw new Error('Email уже зарегистрирован');
    } else if (error.code === 'auth/weak-password') {
      throw new Error('Недостаточно надёжный пароль');
    } else {
      throw new Error(error.message);
    }
  }
}

/**
 * Логин существующего пользователя
 */
export async function login(email, password) {
  if (!ui.validateEmail(email)) {
    throw new Error('Неверный email');
  }
  if (!password) {
    throw new Error('Введите пароль');
  }

  try {
    await auth.signInWithEmailAndPassword(email, password);
    return { success: true };
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      throw new Error('Пользователь не найден');
    } else if (error.code === 'auth/wrong-password') {
      throw new Error('Неверный пароль');
    } else if (error.code === 'auth/too-many-requests') {
      throw new Error('Слишком много попыток. Попробуйте позже.');
    } else {
      throw new Error(error.message);
    }
  }
}

export async function logout() {
  try {
    await auth.signOut();
    state.currentUser = null;
    return { success: true };
  } catch (error) {
    throw new Error(error.message);
  }
}

export function getCurrentUser() {
  return state.currentUser;
}

export function isAdmin() {
  return state.isAdmin || false;
}
