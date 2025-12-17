/**
 * modules/packs.js
 * Магазин паков и система открытия
 */

import { state, openModal, closeModal } from '../app.js';
import * as ui from './ui.js';
import * as app from '../app.js';

const db = firebase.firestore();

// Дефолтные паки
const DEFAULT_PACKS = [
  { id: 'starter',  name: '🌟 Начинающий пак', description: '5 карт для начинающих',                  price: 100,  cards: 5 },
  { id: 'standard', name: '🎯 Нормальный пак',  description: '10 карт, одна редкая',                  price: 250,  cards: 10 },
  { id: 'premium',  name: '💎 Премиум пак',     description: '15 карт, раритеты всех уровней',        price: 500,  cards: 15 },
  { id: 'ultimate', name: '👑 Ултимейт пак',    description: '20 карт, гарантированная легенда',      price: 1000, cards: 20 }
];

export async function loadPacks() {
  state.packs = DEFAULT_PACKS;
}

// ===== РЕНДЕР МАГАЗИНА =====
export function renderShop() {
  const list = document.getElementById('packs-list');
  if (!list) return;
  list.innerHTML = '';

  // Бесплатный пак слева
  list.appendChild(createFreeOpenElement());

  // Остальные паки
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
  `;

  const dailyFreeOpens = state.currentUser?.dailyFreeOpens || 0;
  const canUseToday = dailyFreeOpens > 0;

  div.innerHTML = `
    <div style="font-size: 52px; text-align:center;">🎉</div>
    <div style="font-weight: 700; font-size: 18px; text-align:center;">БЕСПЛАТНОЕ ОТКРЫТИЕ!</div>
    <div style="font-size: 13px; text-align:center;">Получите 5 случайных карт. Один раз в день.</div>
    <div style="font-size: 12px; text-align:center; opacity:.9;">Доступно сегодня: <b>${dailyFreeOpens}</b></div>
    <button class="btn btn-primary btn-full" ${canUseToday ? '' : 'disabled'}>
      ${canUseToday ? '🎁 Открыть бесплатно' : '⏳ Уже использовано'}
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
  `;

  div.innerHTML = `
    <div style="font-size: 52px; text-align:center;">🎁</div>
    <div style="font-weight: 700; font-size: 16px; text-align:center;">${pack.name}</div>
    <div style="font-size: 13px; text-align:center; color: var(--text-secondary);">${pack.description}</div>
    <div style="font-size: 13px; text-align:center;">
      💰 <b>${pack.price}</b> · 🂠 <b>${pack.cards}</b> карт
    </div>
    <button class="btn btn-primary btn-full" ${canAfford ? '' : 'disabled'}>
      ${canAfford ? 'Открыть за монеты' : '❌ Мало монет'}
    </button>
  `;

  const btn = div.querySelector('button');
  btn.addEventListener('click', () => {
    if (!canAfford) return;
    buyPack(pack);
  });

  return div;
}

// ===== ЛОГИКА ОТКРЫТИЯ ПАКОВ =====
async function openDailyFreePack() {
  const u = state.currentUser;
  if (!u || (u.dailyFreeOpens || 0) <= 0) {
    ui.showError('Нет доступных бесплатных открытий');
    return;
  }

  try {
    const selected = selectRandomCards(5);
    if (!selected.length) {
      ui.showError('Нет карт для открытия');
      return;
    }

    const newDaily = (u.dailyFreeOpens || 1) - 1;
    u.dailyFreeOpens = newDaily;

    // Обновляем коллекцию пользователя
    selected.forEach(cardId => {
      u.cards[cardId] = (u.cards[cardId] || 0) + 1;
    });

    await db.collection('users').doc(u.uid).update({
      cards: u.cards,
      dailyFreeOpens: newDaily
    });

    app.updateUserInterface();
    showPackOpeningAnimation(selected, { name: 'БЕСПЛАТНОЕ ОТКРЫТИЕ' });
  } catch (e) {
    console.error('Daily pack error:', e);
    ui.showError('Ошибка при открытии пака');
  }
}

async function buyPack(pack) {
  const u = state.currentUser;
  if (!u) return;

  if ((u.currency || 0) < pack.price) {
    ui.showError('Недостаточно монет');
    return;
  }

  try {
    const selected = selectRandomCards(pack.cards);
    if (!selected.length) {
      ui.showError('Нет карт для открытия');
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
    app.checkQuestCompletion();
  } catch (e) {
    console.error('Buy pack error:', e);
    ui.showError('Ошибка при покупке пака');
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
    ${reward > 0 ? `<div style=\"font-size:12px; color: var(--rarity-legendary);\">Бонус: +${reward} 💎 за новые карты</div>` : ''}
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
    ui.showSuccess('🎁 Пак открыт');
    renderShop();
  };

  openModal('pack-opening-modal');
}
