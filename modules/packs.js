/**
 * modules/packs.js
 * Магазин паков и система открытия
 */

import { state, openModal, closeModal } from '../app.js';
import * as ui from './ui.js';
import * as app from '../app.js';

const db = firebase.firestore();

const DEFAULT_PACKS = [
  { id: 'starter',  name: '🌟 Starter Pack', description: '5 cards for beginners',                  price: 100,  cards: 5 },
  { id: 'standard', name: '🎯 Standard Pack',  description: '10 cards, one rare',                  price: 250,  cards: 10 },
  { id: 'premium',  name: '💎 Premium Pack',     description: '15 cards, all rarities',        price: 500,  cards: 15 },
  { id: 'ultimate', name: '👑 Ultimate Pack',    description: '20 cards, guaranteed legend',      price: 1000, cards: 20 }
];

export async function loadPacks() {
  state.packs = DEFAULT_PACKS;
}

export function renderShop() {
  const list = document.getElementById('packs-list');
  if (!list) return;
  
  list.innerHTML = '';
  list.style.cssText = `
    display: flex;
    gap: 20px;
    overflow-x: auto;
    padding-bottom: 10px;
    scroll-behavior: smooth;
  `;
  
  // Прикрепляем wheel scroll
  list.addEventListener('wheel', (e) => {
    e.preventDefault();
    list.scrollLeft += e.deltaY;
  });

  list.appendChild(createFreeOpenElement());

  state.packs.forEach(pack => {
    const canAfford = (state.currentUser?.currency || 0) >= pack.price;
    list.appendChild(createPackCard(pack, canAfford));
  });
}

function createFreeOpenElement() {
  const div = document.createElement('div');
  div.style.cssText = `
    min-width: 260px;
    max-width: 260px;
    border-radius: 16px;
    padding: 16px;
    background: linear-gradient(135deg, var(--rarity-legendary), var(--rarity-immortal));
    display: flex;
    flex-direction: column;
    gap: 12px;
    color: var(--bg-primary);
    box-shadow: var(--shadow-md);
    flex-shrink: 0;
  `;

  const dailyFreeOpens = state.currentUser?.dailyFreeOpens || 0;
  const canUseToday = dailyFreeOpens > 0;

  div.innerHTML = `
    <div style="font-size: 52px; text-align:center;">🎉</div>
    <div style="font-weight: 700; font-size: 18px; text-align:center;">FREE OPEN!</div>
    <div style="font-size: 13px; text-align:center;">Get 5 random cards. Once per day.</div>
    <div style="font-size: 12px; text-align:center; opacity:.9;">Available today: <b>${dailyFreeOpens}</b></div>
    <button class="btn btn-primary btn-full" ${canUseToday ? '' : 'disabled'}>
      ${canUseToday ? '🎁 Open Free' : '⏳ Used'}
    </button>
  `;

  const btn = div.querySelector('button');
  btn.addEventListener('click', () => {
    if (!canUseToday) return;
    openDailyFreePack();
  });

  return div;
}

function createPackCard(pack, canAfford) {
  const div = document.createElement('div');
  div.style.cssText = `
    min-width: 260px;
    max-width: 260px;
    border-radius: 16px;
    padding: 16px;
    background: linear-gradient(135deg, var(--bg-secondary), var(--bg-tertiary));
    display: flex;
    flex-direction: column;
    gap: 12px;
    color: var(--text-primary);
    border: 1px solid var(--border-light);
    box-shadow: var(--shadow-sm);
    flex-shrink: 0;
  `;

  div.innerHTML = `
    <div style="font-size: 52px; text-align:center;">🎁</div>
    <div style="font-weight: 700; font-size: 16px; text-align:center;">${pack.name}</div>
    <div style="font-size: 13px; text-align:center; color: var(--text-secondary);">${pack.description}</div>
    <div style="font-size: 13px; text-align:center;">
      💰 <b>${pack.price}</b> · 🂠 <b>${pack.cards}</b> cards
    </div>
    <button class="btn btn-primary btn-full" ${canAfford ? '' : 'disabled'}>
      ${canAfford ? 'Open' : '❌ Not enough'}
    </button>
  `;

  const btn = div.querySelector('button');
  btn.addEventListener('click', () => {
    if (!canAfford) return;
    buyPack(pack);
  });

  return div;
}

async function openDailyFreePack() {
  const u = state.currentUser;
  if (!u || (u.dailyFreeOpens || 0) <= 0) {
    ui.showError('No free opens available');
    return;
  }

  try {
    const selected = selectRandomCards(5);
    if (!selected.length) {
      ui.showError('No cards to open');
      return;
    }

    const newDaily = (u.dailyFreeOpens || 1) - 1;
    u.dailyFreeOpens = newDaily;

    selected.forEach(cardId => {
      u.cards[cardId] = (u.cards[cardId] || 0) + 1;
    });

    await db.collection('users').doc(u.uid).update({
      cards: u.cards,
      dailyFreeOpens: newDaily
    });

    app.updateUserInterface();
    showPackOpeningAnimation(selected, { name: 'FREE OPEN' });
  } catch (e) {
    console.error('Daily pack error:', e);
    ui.showError('Error opening pack');
  }
}

async function buyPack(pack) {
  const u = state.currentUser;
  if (!u) return;

  if ((u.currency || 0) < pack.price) {
    ui.showError('Not enough coins');
    return;
  }

  try {
    const selected = selectRandomCards(pack.cards);
    if (!selected.length) {
      ui.showError('No cards to open');
      return;
    }

    let reward = 0;
    selected.forEach(cardId => {
      const isNew = !u.cards[cardId];
      if (isNew) reward += 10;
      u.cards[cardId] = (u.cards[cardId] || 0) + 1;
    });

    u.currency = (u.currency || 0) - pack.price + reward;

    await db.collection('users').doc(u.uid).update({
      currency: u.currency,
      cards: u.cards,
      packsOpened: (u.packsOpened || 0) + 1
    });

    app.updateUserInterface();
    showPackOpeningAnimation(selected, pack, reward);
  } catch (e) {
    console.error('Buy pack error:', e);
    ui.showError('Error buying pack');
  }
}

function selectRandomCards(count) {
  const res = [];
  const pool = state.cards || [];
  if (!pool.length) return res;
  for (let i = 0; i < count; i++) {
    const card = pool[Math.floor(Math.random() * pool.length)];
    if (card) res.push(card.id);
  }
  return res;
}

function showPackOpeningAnimation(selectedCardIds, pack, reward = 0) {
  const container = document.getElementById('pack-animation-container');
  const confirmBtn = document.getElementById('pack-confirm-btn');
  container.innerHTML = '';

  const header = document.createElement('div');
  header.style.marginBottom = '12px';
  header.innerHTML = `
    <div style="font-size: 20px; font-weight: 700; color: var(--wood-light);">${pack.name}</div>
    ${reward > 0 ? `<div style="font-size:12px; color: var(--rarity-legendary);">Bonus: +${reward} 💎 for new cards</div>` : ''}
  `;
  container.appendChild(header);

  const strip = document.createElement('div');
  strip.style.cssText = `
    display: flex;
    gap: 16px;
    overflow-x: auto;
    padding-bottom: 8px;
  `;

  selectedCardIds.forEach(cardId => {
    const card = state.cards.find(c => c.id === cardId);
    if (!card) return;

    const cardDiv = document.createElement('div');
    cardDiv.style.cssText = `
      min-width: 250px;
      aspect-ratio: 155 / 268;
      border-radius: 16px;
      overflow: hidden;
      background: var(--bg-secondary);
      border: 1px solid var(--border-light);
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
    `;

    cardDiv.innerHTML = `
      <div style="flex:1; background: var(--bg-tertiary);">
        <img src="${card.imageUrl}" style="width:100%; height:100%; object-fit:cover;" />
      </div>
      <div style="padding:8px 10px; font-size:11px;">
        <div style="font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${card.title}</div>
        <div style="color:var(--text-secondary);">${card.artist}</div>
      </div>
    `;

    strip.appendChild(cardDiv);
  });

  container.appendChild(strip);

  confirmBtn.style.display = 'block';
  confirmBtn.onclick = () => {
    closeModal('pack-opening-modal');
    ui.showToast('🎁 Pack opened', 'success');
    renderShop();
  };

  openModal('pack-opening-modal');
}
