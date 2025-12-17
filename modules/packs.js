/**
 * modules/packs.js - Паки и магазин
 */

import { state, closeModal, openModal } from '../app.js';
import * as ui from './ui.js';
import * as user from './user.js';
import * as cardMod from './cards.js';

const db = firebase.firestore();

/**
 * Загрузить все паки
 */
export async function loadPacks() {
  try {
    const snap = await db.collection('packs').orderBy('price').get();
    state.packs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log('✅ Packs loaded:', state.packs.length);
    
    // Если нет - создаём тестовые
    if (state.packs.length === 0) {
      await initDefaultPacks();
    }
  } catch (e) {
    console.error('Error loading packs:', e);
  }
}

/**
 * Инициализируем тестовые паки
 */
async function initDefaultPacks() {
  try {
    const defaultPacks = [
      { name: 'Стартер', price: 50, cardCount: 3, emoji: '🃦', rarityWeights: { common: 5, uncommon: 2 } },
      { name: 'Стандарт', price: 100, cardCount: 5, emoji: '🃥', rarityWeights: { uncommon: 4, rare: 2 } },
      { name: 'Премиум', price: 200, cardCount: 7, emoji: '🃤', rarityWeights: { rare: 3, mythical: 2, legendary: 1 } }
    ];
    
    for (const pack of defaultPacks) {
      await db.collection('packs').add(pack);
    }
    
    await loadPacks();
  } catch (e) {
    console.error('Error creating default packs:', e);
  }
}

/**
 * Рендерить магазин паков с прокруткой колесом мыши
 */
export function renderShop() {
  const list = document.getElementById('packs-list');
  if (!list) return;
  list.innerHTML = '';
  
  if (!state.packs.length) {
    list.innerHTML = '<div style="color:var(--text-secondary);">No packs</div>';
    return;
  }
  
  state.packs.forEach(pack => {
    const div = document.createElement('div');
    div.style.cssText = `
      min-width: 200px;
      background: linear-gradient(135deg, var(--bg-secondary), var(--bg-tertiary));
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px;
      cursor: pointer;
      transition: all 0.3s;
      display: flex;
      flex-direction: column;
      gap: 8px;
    `;
    div.innerHTML = `
      <div style="font-size:24px; text-align:center;">${pack.emoji || '📦'}</div>
      <div style="font-weight:600; font-size:16px; color:var(--text-accent); text-align:center;">${pack.name}</div>
      <div style="font-size:12px; color:var(--text-secondary); text-align:center;">${pack.cardCount} cards</div>
      <div style="margin-top:auto; text-align:center; font-size:14px; color:var(--wood-light); font-weight:600;">${pack.price} 💎</div>
      <button class="btn btn-primary" style="width:100%; margin-top:8px;">Open</button>
    `;
    
    div.addEventListener('mouseenter', () => {
      div.style.transform = 'translateY(-8px)';
      div.style.boxShadow = 'var(--shadow-lg)';
    });
    div.addEventListener('mouseleave', () => {
      div.style.transform = 'translateY(0)';
      div.style.boxShadow = 'none';
    });
    
    div.querySelector('button').addEventListener('click', (e) => {
      e.stopPropagation();
      openPack(pack);
    });
    
    list.appendChild(div);
  });
  
  list.addEventListener('wheel', (e) => {
    e.preventDefault();
    list.scrollLeft += e.deltaY;
  });
}

/**
 * Открыть пак
 */
async function openPack(pack) {
  const u = state.currentUser;
  if (!u) return;
  
  if ((u.currency || 0) < pack.price) {
    ui.showError('Not enough coins!');
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
      ui.showError('Error opening pack');
      return;
    }
    
    await db.collection('users').doc(u.uid).update({
      currency: firebase.firestore.FieldValue.increment(-pack.price)
    });
    u.currency -= pack.price;
    
    const updates = {};
    drawnCards.forEach(c => {
      const key = `cards.${c.id}`;
      updates[key] = firebase.firestore.FieldValue.increment(1);
    });
    await db.collection('users').doc(u.uid).update(updates);
    
    drawnCards.forEach(c => {
      u.cards = u.cards || {};
      u.cards[c.id] = (u.cards[c.id] || 0) + 1;
    });
    
    showPackOpeningModal(drawnCards);
    
    document.getElementById('coins-display').textContent = u.currency;
    cardMod.renderCollection();
  } catch (e) {
    console.error('Error opening pack:', e);
    ui.showError('Error opening pack');
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

function showPackOpeningModal(cards) {
  const modal = document.getElementById('pack-opening-modal');
  const container = document.getElementById('pack-animation-container');
  if (!modal || !container) return;
  
  container.innerHTML = '';
  
  cards.forEach((card, idx) => {
    setTimeout(() => {
      const cardDiv = document.createElement('div');
      cardDiv.style.cssText = `
        min-width: 180px;
        background: var(--bg-secondary);
        border: 2px solid ${ui.getRarityBadge(card.rarity).color};
        border-radius: 12px;
        padding: 12px;
        display: flex;
        flex-direction: column;
        align-items: center;
        animation: cardReveal 0.5s ease-out;
      `;
      const rarity = ui.getRarityBadge(card.rarity);
      cardDiv.innerHTML = `
        <div style="width:100%; aspect-ratio:155/268; background:var(--bg-tertiary); border-radius:8px; overflow:hidden; margin-bottom:8px;">
          ${card.imageUrl ? `<img src="${card.imageUrl}" style="width:100%; height:100%; object-fit:cover;" />` : '🎨'}
        </div>
        <div style="font-weight:600; font-size:14px; color:var(--text-accent); text-align:center;">${card.title}</div>
        <div style="font-size:11px; color:var(--text-secondary); text-align:center;">${card.artist}</div>
        <div style="margin-top:4px; padding:4px 8px; border-radius:6px; font-size:11px; font-weight:600;" style="background:${rarity.color}15; color:${rarity.color};">${rarity.emoji} ${rarity.name}</div>
      `;
      container.appendChild(cardDiv);
    }, idx * 200);
  });
  
  openModal('pack-opening-modal');
  
  const confirmBtn = document.getElementById('pack-confirm-btn');
  confirmBtn.style.display = 'block';
  confirmBtn.onclick = () => closeModal('pack-opening-modal');
}
