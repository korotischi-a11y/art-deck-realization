/**
 * 🔒 СЕРВЕРНАЯ ЛОГИКА - Критическое исправление безопасности
 * Firebase Cloud Functions для защиты от client-side атак
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const Timestamp = admin.firestore.Timestamp;

// ========================
// 🔐 RATE LIMITING
// ========================

/**
 * Проверка rate limit для предотвращения спама
 */
async function checkRateLimit(uid, operation, maxAttempts = 10, windowMs = 60000) {
  const rateLimitRef = db.collection('rateLimits').doc(`${uid}_${operation}`);
  const doc = await rateLimitRef.get();
  
  const now = Date.now();
  let attempts = [];
  
  if (doc.exists) {
    attempts = doc.data().attempts || [];
    // Фильтруем попытки в текущем окне
    attempts = attempts.filter(timestamp => now - timestamp < windowMs);
    
    if (attempts.length >= maxAttempts) {
      const oldestAttempt = Math.min(...attempts);
      const waitTime = Math.ceil((windowMs - (now - oldestAttempt)) / 1000);
      throw new functions.https.HttpsError(
        'resource-exhausted',
        `Слишком много попыток. Повторите через ${waitTime} сек.`
      );
    }
  }
  
  // Добавляем текущую попытку
  attempts.push(now);
  await rateLimitRef.set({ attempts }, { merge: true });
  
  return true;
}

// ========================
// 🎲 КРИПТОГРАФИЧЕСКИ СТОЙКАЯ ГЕНЕРАЦИЯ
// ========================

/**
 * Генерация случайного числа с использованием crypto
 */
function secureRandom() {
  const buffer = require('crypto').randomBytes(4);
  return buffer.readUInt32BE(0) / 0xFFFFFFFF;
}

/**
 * Выбор карты по взвешенной вероятности (server-side)
 */
function pickWeightedRarity(weights) {
  const pool = [];
  for (const [rarity, weight] of Object.entries(weights)) {
    for (let i = 0; i < weight * 10; i++) {
      pool.push(rarity);
    }
  }
  
  const rand = Math.floor(secureRandom() * pool.length);
  return pool[rand];
}

/**
 * Выбор случайной карты заданной редкости
 */
async function pickRandomCardByRarity(rarity) {
  const snapshot = await db.collection('masterCards')
    .where('rarity', '==', rarity)
    .get();
  
  if (snapshot.empty) return null;
  
  const cards = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const rand = Math.floor(secureRandom() * cards.length);
  return cards[rand];
}

// ========================
// 📦 ОТКРЫТИЕ ПАКОВ (ЗАЩИЩЕНО)
// ========================

/**
 * 🔒 Открытие платного пака
 */
exports.openPack = functions.https.onCall(async (data, context) => {
  // Проверка аутентификации
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Требуется авторизация');
  }
  
  const uid = context.auth.uid;
  const { packId } = data;
  
  if (!packId) {
    throw new functions.https.HttpsError('invalid-argument', 'Pack ID не указан');
  }
  
  // Rate limiting: максимум 10 паков в минуту
  await checkRateLimit(uid, 'open_pack', 10, 60000);
  
  // Транзакция для атомарности операций
  return db.runTransaction(async (transaction) => {
    const userRef = db.collection('users').doc(uid);
    const packRef = db.collection('packs').doc(packId);
    
    const [userDoc, packDoc] = await Promise.all([
      transaction.get(userRef),
      transaction.get(packRef)
    ]);
    
    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Пользователь не найден');
    }
    
    if (!packDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Пак не найден');
    }
    
    const user = userDoc.data();
    const pack = packDoc.data();
    const currency = user.currency || 0;
    
    // Проверка достаточности средств
    if (currency < pack.price) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        `Недостаточно монет. Требуется: ${pack.price}, доступно: ${currency}`
      );
    }
    
    // Генерация карт на сервере
    const drawnCards = [];
    for (let i = 0; i < pack.cardCount; i++) {
      const rarity = pickWeightedRarity(pack.rarityWeights);
      const card = await pickRandomCardByRarity(rarity);
      if (card) drawnCards.push(card);
    }
    
    if (drawnCards.length === 0) {
      throw new functions.https.HttpsError('internal', 'Не удалось сгенерировать карты');
    }
    
    // Обновляем валюту
    transaction.update(userRef, {
      currency: FieldValue.increment(-pack.price),
      packsOpened: FieldValue.increment(1)
    });
    
    // Возвращаем результат
    return {
      success: true,
      cards: drawnCards,
      newCurrency: currency - pack.price
    };
  });
});

/**
 * 🔒 Открытие бесплатного пака (24 часа)
 */
exports.openDailyPack = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Требуется авторизация');
  }
  
  const uid = context.auth.uid;
  
  // Rate limiting: максимум 3 попытки в минуту (защита от спама)
  await checkRateLimit(uid, 'daily_pack', 3, 60000);
  
  return db.runTransaction(async (transaction) => {
    const userRef = db.collection('users').doc(uid);
    const userDoc = await transaction.get(userRef);
    
    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Пользователь не найден');
    }
    
    const user = userDoc.data();
    const now = Timestamp.now();
    const lastDate = user.lastDailyPackDate;
    
    // Проверка 24-часового интервала
    if (lastDate) {
      const lastTime = lastDate.toMillis();
      const diff = now.toMillis() - lastTime;
      const hours24 = 24 * 60 * 60 * 1000;
      
      if (diff < hours24) {
        const remainingMs = hours24 - diff;
        const hours = Math.floor(remainingMs / (1000 * 60 * 60));
        const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
        
        throw new functions.https.HttpsError(
          'failed-precondition',
          `Следующий бесплатный пак будет доступен через ${hours}ч ${minutes}м`
        );
      }
    }
    
    // Генерация карт: 2 common, 1 uncommon
    const weights = { common: 2, uncommon: 1 };
    const drawnCards = [];
    
    for (let i = 0; i < 3; i++) {
      const rarity = pickWeightedRarity(weights);
      const card = await pickRandomCardByRarity(rarity);
      if (card) drawnCards.push(card);
    }
    
    if (drawnCards.length === 0) {
      throw new functions.https.HttpsError('internal', 'Не удалось сгенерировать карты');
    }
    
    // Обновляем пользователя: +50 монет, новый timestamp
    transaction.update(userRef, {
      lastDailyPackDate: now,
      currency: FieldValue.increment(50),
      packsOpened: FieldValue.increment(1)
    });
    
    return {
      success: true,
      cards: drawnCards,
      newCurrency: (user.currency || 0) + 50,
      nextAvailable: now.toMillis() + 24 * 60 * 60 * 1000
    };
  });
});

// ========================
// 🎯 ДОБАВЛЕНИЕ КАРТ В КОЛОДУ
// ========================

/**
 * 🔒 Добавление карты в колоду (с валидацией)
 */
exports.addCardToDeck = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Требуется авторизация');
  }
  
  const uid = context.auth.uid;
  const { cardId, deckId } = data;
  
  if (!cardId || !deckId) {
    throw new functions.https.HttpsError('invalid-argument', 'cardId и deckId обязательны');
  }
  
  // Rate limiting
  await checkRateLimit(uid, 'add_card', 30, 60000);
  
  return db.runTransaction(async (transaction) => {
    const userRef = db.collection('users').doc(uid);
    const userDoc = await transaction.get(userRef);
    
    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Пользователь не найден');
    }
    
    const user = userDoc.data();
    const decks = user.decks || {};
    const deck = decks[deckId];
    
    if (!deck) {
      throw new functions.https.HttpsError('not-found', 'Колода не найдена');
    }
    
    // Проверка лимита карт в колоде (60)
    const currentCardCount = Object.values(deck.cards || {}).reduce((sum, count) => sum + count, 0);
    if (currentCardCount >= 60) {
      throw new functions.https.HttpsError('failed-precondition', 'Колода полна (макс. 60 карт)');
    }
    
    // Добавляем карту
    deck.cards = deck.cards || {};
    deck.cards[cardId] = (deck.cards[cardId] || 0) + 1;
    decks[deckId] = deck;
    
    transaction.update(userRef, { decks });
    
    return { success: true, newCount: deck.cards[cardId] };
  });
});

// ========================
// 🏆 ОБНОВЛЕНИЕ РЕЙТИНГА (ЗАЩИТА ОТ МАНИПУЛЯЦИЙ)
// ========================

/**
 * 🔒 Пересчёт рейтинга колоды (server-side)
 */
exports.recalculateDeckRating = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Требуется авторизация');
  }
  
  const uid = context.auth.uid;
  const { deckId } = data;
  
  if (!deckId) {
    throw new functions.https.HttpsError('invalid-argument', 'deckId обязателен');
  }
  
  const userRef = db.collection('users').doc(uid);
  const userDoc = await userRef.get();
  
  if (!userDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Пользователь не найден');
  }
  
  const user = userDoc.data();
  const decks = user.decks || {};
  const deck = decks[deckId];
  
  if (!deck) {
    throw new functions.https.HttpsError('not-found', 'Колода не найдена');
  }
  
  // Загружаем все карты колоды
  const cardIds = Object.keys(deck.cards || {});
  const cardPromises = cardIds.map(id => db.collection('masterCards').doc(id).get());
  const cardDocs = await Promise.all(cardPromises);
  
  const masterCards = {};
  cardDocs.forEach(doc => {
    if (doc.exists) {
      masterCards[doc.id] = doc.data();
    }
  });
  
  // Рассчитываем рейтинг на сервере
  const rating = calculateRatingServerSide(deck, masterCards);
  
  // Обновляем колоду
  deck.rating = rating;
  decks[deckId] = deck;
  
  await userRef.update({ decks });
  
  return { success: true, rating };
});

/**
 * Расчёт рейтинга на сервере (точная копия client-side логики)
 */
function calculateRatingServerSide(deck, masterCards) {
  const cards = deck.cards || {};
  const rarityWeights = {
    common: 1,
    uncommon: 2,
    rare: 4,
    mythical: 8,
    legendary: 15,
    ancient: 25,
    ethereal: 40,
    immortal: 60
  };
  
  let totalPower = 0;
  const uniqueCards = new Set();
  const artistCount = {};
  const eraSet = new Set();
  const raritySet = new Set();
  
  for (const [cardId, count] of Object.entries(cards)) {
    const card = masterCards[cardId];
    if (!card) continue;
    
    uniqueCards.add(cardId);
    
    const power = card.power || {};
    const cardPower = (power.resonance || 0) +
                      (power.virtuosity || 0) +
                      (power.profundity || 0) +
                      (power.harmony || 0);
    
    const rarityMult = rarityWeights[card.rarity] || 1;
    totalPower += cardPower * rarityMult * count;
    
    // Бонусы
    artistCount[card.artist] = (artistCount[card.artist] || 0) + 1;
    if (card.year) {
      const century = Math.floor(card.year / 100);
      eraSet.add(century);
    }
    raritySet.add(card.rarity);
  }
  
  // Уникальность
  const uniqueness = uniqueCards.size * 10;
  
  // Бонусы
  let bonuses = 0;
  
  // Художники: +10% за каждого с 2+ карт (макс +60%)
  const multiArtists = Object.values(artistCount).filter(c => c >= 2).length;
  bonuses += Math.min(multiArtists * 0.1, 0.6);
  
  // Эпохи: +5% за каждую (макс +50%)
  bonuses += Math.min(eraSet.size * 0.05, 0.5);
  
  // Редкости: +10% за каждый тип (макс +80%)
  bonuses += Math.min(raritySet.size * 0.1, 0.8);
  
  // Финальный рейтинг
  const baseRating = uniqueness + totalPower;
  const finalRating = Math.round(baseRating * (1 + bonuses));
  
  return finalRating;
}

// ========================
// 🛡️ ЗАЩИТА FIRESTORE (ПРАВИЛА БЕЗОПАСНОСТИ)
// ========================

/**
 * Firestore Security Rules - сохраните в файл firestore.rules
 * 
 * rules_version = '2';
 * service cloud.firestore {
 *   match /databases/{database}/documents {
 *     
 *     // Whitelist админов
 *     function isAdmin() {
 *       return exists(/databases/$(database)/documents/admins/$(request.auth.uid));
 *     }
 *     
 *     // Пользователи
 *     match /users/{userId} {
 *       allow read: if request.auth.uid == userId;
 *       allow write: if request.auth.uid == userId 
 *                    && !request.resource.data.diff(resource.data).affectedKeys()
 *                       .hasAny(['isAdmin', 'currency', 'lastDailyPackDate']);
 *     }
 *     
 *     // Карты - только чтение
 *     match /masterCards/{cardId} {
 *       allow read: if true;
 *       allow write: if isAdmin();
 *     }
 *     
 *     // Паки - только чтение
 *     match /packs/{packId} {
 *       allow read: if true;
 *       allow write: if isAdmin();
 *     }
 *     
 *     // Rate limits - только система
 *     match /rateLimits/{limitId} {
 *       allow read, write: if false;
 *     }
 *   }
 * }
 */
