/**
 * modules/auth.js
 * Автентификация через Firebase Auth
 * 
 * Функции:
 * - регистрация новых пользователей
 * - логин на сайт
 * - получение текущего авторизованного пользователя
 * - выход из системы
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
        // Пользователь авторизован
        await loadUserData(firebaseUser.uid);
        resolve(true);
      } else {
        // Пользователь не авторизован
        state.currentUser = null;
        resolve(false);
      }
    });
  });
}

/**
 * Загружает данные пользователя из Firestore
 */
async function loadUserData(uid) {
  try {
    const userDoc = await db.collection('users').doc(uid).get();
    
    if (userDoc.exists) {
      const userData = userDoc.data();
      state.currentUser = {
        uid,
        email: userData.email,
        username: userData.username,
        currency: userData.currency || 100,
        cards: userData.cards || {},
        isAdmin: userData.isAdmin || false,
        createdAt: userData.createdAt
      };
      state.isAdmin = userData.isAdmin || false;
    } else {
      console.warn('📄 Документ пользователя не найден');
    }
  } catch (error) {
    console.error('Ошибка загружки данных пользователя:', error);
  }
}

/**
 * Регистрация нового пользователя
 */
export async function register(email, password) {
  // Валидация
  if (!ui.validateEmail(email)) {
    throw new Error('Неверный email');
  }
  
  if (!ui.validatePassword(password)) {
    throw new Error('Пароль должен содержать минимум 6 символов');
  }
  
  try {
    // Создаем пользователя в Firebase Auth
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    const uid = userCredential.user.uid;
    const username = email.split('@')[0];
    
    // Создаем документ пользователя в Firestore
    await db.collection('users').doc(uid).set({
      email,
      username,
      currency: 100,  // Начальные 100 монет
      cards: {},
      isAdmin: false,
      createdAt: Firestore.Timestamp.now(),
      totalCards: 0,
      totalPacks: 0
    });
    
    // Обновляем глобальное состояние
    state.currentUser = {
      uid,
      email,
      username,
      currency: 100,
      cards: {},
      isAdmin: false
    };
    
    return { success: true, uid };
  } catch (error) {
    // Обработка ошибок
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
 * Логин экзистирующего пользователя
 */
export async function login(email, password) {
  // Валидация
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
      throw new Error('Слишком много попыток. Попытайте позже.');
    } else {
      throw new Error(error.message);
    }
  }
}

/**
 * Выход из системы
 */
export async function logout() {
  try {
    await auth.signOut();
    state.currentUser = null;
    return { success: true };
  } catch (error) {
    throw new Error(error.message);
  }
}

/**
 * Получить текущего авторизованного пользователя
 */
export function getCurrentUser() {
  return state.currentUser;
}

/**
 * Проверяет, является ли пользователь админом
 */
export function isAdmin() {
  return state.isAdmin || false;
}
