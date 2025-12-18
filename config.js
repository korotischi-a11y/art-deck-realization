/**
 * config.js - Firebase Configuration
 * Инициализация Firebase для Art Deck
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
 * Используем compat версию (firebase-compat) которую загружаем из HTML
 */
window.addEventListener('DOMContentLoaded', () => {
  if (typeof firebase !== 'undefined') {
    console.log('[CONFIG] Initializing Firebase...');
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
      console.log('[CONFIG] ✅ Firebase initialized');
    }
  }
});

// Альтернатива: если скрипты загружены до этого
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

export { firebaseConfig };
