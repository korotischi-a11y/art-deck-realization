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
 * Загружает данные пользователя из Firestore
 * 🔥 ИСПРАВЛЕНО: используем ПОДКОЛЛЕКЦИЮ decks, а не поле в документе
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

    // 🔥 ИСПРАВЛЕНО: НЕ загружаем decks из документа, т.к. они в подколлекции
    state.currentUser = {
      uid,
      email: userData.email,
      username: userData.username,
      currency: userData.currency || 100,
      cards: userData.cards || {},  // Глобальная коллекция (старая схема, для совместимости)
      decks: {},                     // 🔥 Загрузится через decks.loadDecks()
      isAdmin: userData.isAdmin || false,
      createdAt: userData.createdAt,
      dailyFreeOpens: userData.dailyFreeOpens || 0,
      lastDailyReward: userData.lastDailyReward
    };
    state.isAdmin = userData.isAdmin || false;
    
    console.log('✅ User data loaded:', uid);
  } catch (error) {
    console.error('Ошибка загрузки пользователя:', error);
  }
}

/**
 * Регистрация нового пользователя
 * 🔥 ИСПРАВЛЕНО: создаём первую колоду в ПОДКОЛЛЕКЦИИ
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

    // 🔥 ИСПРАВЛЕНО: Создаём документ пользователя БЕЗ decks
    await db.collection('users').doc(uid).set({
      email,
      username,
      currency: 100,
      cards: {},            // глобальная коллекция (старая схема)
      isAdmin: false,
      createdAt: Firestore.Timestamp.now(),
      totalCards: 0,
      totalPacks: 0,
      completedQuests: [],
      dailyFreeOpens: 1,
      lastDailyReward: Firestore.Timestamp.now()
    });

    // 🔥 ИСПРАВЛЕНО: Создаём первую колоду в ПОДКОЛЛЕКЦИИ
    const decksRef = db.collection('users').doc(uid).collection('decks');
    await decksRef.add({
      name: '🎴 Первая колода',
      cards: {},
      createdAt: Firestore.Timestamp.now(),
      isActive: true,
      isDiscardDeck: false
    });

    console.log('✅ User created with first deck in subcollection');

    state.currentUser = {
      uid,
      email,
      username,
      currency: 100,
      cards: {},
      decks: {},  // Загрузится через loadDecks()
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
