/**
 * config.js
 * Конфигурация Firebase для проекта Art Deck
 * 
 * ВАЖНО: Эти credentials на production должны быть защищены окружением
 */

const firebaseConfig = {
  apiKey: "AIzaSyAUC0NC6OSkG7osBcz2_ZcUXOLDp0PZWVw",
  authDomain: "art-deck-366b5.firebaseapp.com",
  projectId: "art-deck-366b5",
  storageBucket: "art-deck-366b5.firebasestorage.app",
  messagingSenderId: "211244871778",
  appId: "1:211244871778:web:31d4e7583c33abd168a13b"
};

/**
 * Инициализация Firebase
 * Используем обычный SDK (не compat)
 */
if (typeof firebase !== 'undefined') {
  firebase.initializeApp(firebaseConfig);
}

// Экспортируем для использования в других модулях
export { firebaseConfig };
