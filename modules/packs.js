/**
 * modules/packs.js - Паки и магазин
 */

import { state, closeModal, openModal } from '../app.js';
import * as ui from './ui.js';
import * as user from './user.js';
import * as cardMod from './cards.js';
import * as decks from './decks.js';

const db = firebase.firestore();

/**
 * Загружать все паки
 */
export async function loadPacks() {
  try {
    console.log('[PACKS] Loading packs...');
    const snap = await db.collection('packs').orderBy('price').get();
    state.packs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log('[PACKS] ✅ Loaded:', state.packs.length, 'packs');
    
    if (state.packs.length === 0) {
      await initDefaultPacks();
    }
  } catch (e) {
    console.error('[PACKS] Error loading:', e);
  }
}

/**
 * Инициализируем тестовые паки
 */
async function initDefaultPacks() {
  try {
    console.log('[PACKS] Creating default packs...');
    const defaultPacks = [
      { 
        name: 'Начало', 
        price: 25, 
        cardCount: 2, 
        emoji: '🌢', 
        color: '#3b82f6',
        borderColor: '#1e40af',
        rarityWeights: { common: 10 } 
      },
      { 
        name: 'Стартер', 
        price: 50, 
        cardCount: 3, 
        emoji: '⭐', 
        color: '#06b6d4',
        borderColor: '#0369a1',
        rarityWeights: { common: 7, uncommon: 3 } 
      },
      { 
        name: 'Стандарт', 
        price: 100, 
        cardCount: 5, 
        emoji: '🎆', 
        color: '#f59e0b',
        borderColor: '#b45309',
        rarityWeights: { uncommon: 5, rare: 2 } 
      },
      { 
        name: 'Премиум', 
        price: 200, 
        cardCount: 7, 
        emoji: '💎', 
        color: '#a855f7',
        borderColor: '#6d28d9',
        rarityWeights: { rare: 4, mythical: 2, legendary: 1 } 
      }
    ];
    
    for (const pack of defaultPacks) {
      await db.collection('packs').add(pack);
    }
    
    await loadPacks();
  } catch (e) {
    console.error('[PACKS] Error creating defaults:', e);
  }
}

/**
 * Рендерит магазин паков
 */
export function renderShop() {
  const list = document.getElementById('packs-list');
  if (!list) {
    console.warn('[PACKS] packs-list container not found');
    return;
  }
  
  console.log('[PACKS] Rendering shop with', state.packs.length, 'packs');
  list.innerHTML = '';
  
  if (!state.packs.length) {
    list.innerHTML = '<div style="color:#a0a0a0;">No packs available</div>';
    return;
  }
  
  // Обычные паки
  state.packs.forEach((pack, idx) => {
    const packColor = pack.color || '#6366f1';
    const packBorderColor = pack.borderColor || packColor;
    
    const div = document.createElement('div');
    div.style.cssText = `
      min-width: 200px;
      background: linear-gradient(135deg, ${packColor}30 0%, ${packColor}10 100%);
      border: 2px solid ${packBorderColor};
      border-radius: 12px;
      padding: 16px;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      flex-direction: column;
      gap: 12px;
      position: relative;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      flex-shrink: 0;
    `;
    
    div.innerHTML = `
      <div style="font-size: 40px; text-align: center;">${pack.emoji || '📋'}</div>
      <div style="font-weight: 700; font-size: 16px; color: ${packBorderColor}; text-align: center;">${pack.name}</div>
      <div style="font-size: 12px; color: #a0a0a0; text-align: center;">${pack.cardCount} карт</div>
      <div style="margin-top: auto; text-align: center; font-size: 14px; color: ${packBorderColor}; font-weight: 700;">${pack.price} 💨</div>
      <button class="btn" style="width: 100%; background: ${packColor}; border: none; color: white; font-weight: 600; padding: 10px; border-radius: 8px; cursor: pointer; transition: all 0.2s;" data-pack-idx="${idx}">ОТКРЫТЬ</button>
    `;
    
    div.addEventListener('mouseenter', () => {
      div.style.transform = 'translateY(-8px)';
      div.style.boxShadow = '0 12px 24px rgba(0,0,0,0.2)';
    });
    div.addEventListener('mouseleave', () => {
      div.style.transform = 'translateY(0)';
      div.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
    });
    
    div.querySelector('button').addEventListener('click', (e) => {
      e.stopPropagation();
      openPack(pack);
    });
    
    list.appendChild(div);
  });
}

/**
 * Открыть пак
 */
async function openPack(pack) {
  const u = state.currentUser;
  if (!u) return;
  
  if ((u.currency || 0) < pack.price) {
    ui.showError('💨 Не хватает монет');
    return;
  }
  
  try {
    const rarityPool = buildRarityPool(pack.rarityWeights);
    const drawnCards = [];
    
    for (let i = 0; i < pack.cardCount; i++) {
      const rarity = pickWeightedRarity(rarityPool);
      const card = pickRandomCardByRarity(rarity);
      if (card) drawnCards.push(card);
    }
    
    if (drawnCards.length === 0) {
      ui.showError('Ошибка открытия');
      return;
    }
    
    await db.collection('users').doc(u.uid).update({
      currency: firebase.firestore.FieldValue.increment(-pack.price)
    });
    u.currency -= pack.price;
    
    for (const card of drawnCards) {
      await decks.addCardToDiscardDeck(card.id);
    }
    
    ui.showToast('🎉 Пак открыт!', 'success');
    document.getElementById('coins-display').textContent = u.currency;
    cardMod.renderCollection();
    await decks.loadDecks();
    decks.renderDecks();
  } catch (e) {
    console.error('[PACKS] Error opening:', e);
    ui.showError('Ошибка');
  }
}

function buildRarityPool(weights) {
  const pool = [];
  for (const [rarity, weight] of Object.entries(weights)) {
    for (let i = 0; i < weight; i++) pool.push(rarity);
  }
  return pool;
}

function pickWeightedRarity(pool) {
  return pool[Math.floor(Math.random() * pool.length)];
}

function pickRandomCardByRarity(rarity) {
  const cards = state.cards.filter(c => c.rarity === rarity);
  return cards.length ? cards[Math.floor(Math.random() * cards.length)] : null;
}
