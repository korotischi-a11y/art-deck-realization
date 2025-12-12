import { state, openModal } from '../app.js';
import * as ui from './ui.js';
import * as decks from './decks.js';

const db = firebase.firestore();

export async function loadCards() {
  try {
    const snap = await db.collection('masterCards').orderBy('createdAt', 'desc').limit(1000).get();
    state.cards = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log(`✔ ${state.cards.length} карт`);
  } catch (error) {
    console.error('Ош:', error);
  }
}

function getCard(cId) {
  return state.cards.find(c => c.id === cId);
}

export function calculateDeckRating() {
  const did = state.currentUser?.activeDeckId;
  if (!did || !state.currentUser?.decks?.[did]) return 0;
  return calcRating(state.currentUser.decks[did].cards || {});
}

function calcRating(co) {
  const u = calcUnique(co);
  const p = calcPower(co);
  const e = calcEra(co);
  const a = calcArtist(co);
  const r = calcRarity(co);
  return (u + p) * (1 + e + a + r);
}

function calcUnique(co) {
  const un = Object.keys(co).length;
  const tot = Object.values(co).reduce((a, b) => a + b, 0);
  if (!tot) return 0;
  let b = 1;
  if (un > 20) b = 1.5;
  else if (un > 10) b = 1.25;
  return (un / tot * 100) * b;
}

function calcPower(co) {
  const m = { 'common': 1, 'uncommon': 1.25, 'rare': 1.5, 'mythical': 1.75, 'legendary': 2, 'ancient': 2.25, 'exceedingly_rare': 2.5, 'immortal': 3 };
  let t = 0;
  Object.entries(co).forEach(([cId, cnt]) => {
    const c = getCard(cId);
    if (!c) return;
    const pw = (c.power?.resonance || 0) + (c.power?.virtuosity || 0) + (c.power?.profundity || 0) + (c.power?.harmony || 0);
    t += pw * (m[c.rarity] || 1) * cnt;
  });
  return t / 10;
}

function calcEra(co) {
  const s = new Set();
  Object.keys(co).forEach(cId => { const c = getCard(cId); if (c) s.add(c.year); });
  return Math.min(s.size * 0.05, 0.5);
}

function calcArtist(co) {
  const a = {};
  Object.keys(co).forEach(cId => { const c = getCard(cId); if (c) a[c.artist] = (a[c.artist] || 0) + 1; });
  return Math.min(Object.values(a).filter(x => x >= 2).length * 0.1, 0.6);
}

function calcRarity(co) {
  const s = new Set();
  Object.keys(co).forEach(cId => { const c = getCard(cId); if (c) s.add(c.rarity); });
  return Math.min(s.size * 0.1, 0.8);
}

export function getDeckRatingBreakdown() {
  const did = state.currentUser?.activeDeckId;
  if (!did) return {};
  const co = state.currentUser.decks?.[did]?.cards || {};
  return { uniqueness: calcUnique(co), power: calcPower(co), eraBonus: calcEra(co), artistBonus: calcArtist(co), rarityBonus: calcRarity(co), total: calcRating(co) };
}

export function renderCollection() {
  const g = document.getElementById('cards-grid');
  const f = document.getElementById('rarity-filter')?.value;
  g.innerHTML = '';
  let c = state.isAdmin ? state.cards : Object.keys(state.currentUser?.cards || {}).map(id => getCard(id)).filter(x => x);
  if (f) c = c.filter(x => x.rarity === f);
  if (!c.length) { g.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-secondary);">no cards</div>'; return; }
  c.forEach(card => g.appendChild(createCardEl(card)));
}

function createCardEl(c) {
  const d = document.createElement('div');
  d.className = 'card-item';
  const r = ui.getRarityBadge(c.rarity);
  d.setAttribute('data-rarity', c.rarity);
  d.innerHTML = `<div class="card-image">${c.imageUrl ? `<img src="${c.imageUrl}">` : '<div style="font-size: 48px;">🎨</div>'}</div><div class="card-body"><div class="card-title">${c.title}</div><div class="card-artist">${c.artist} (${c.year})</div><div class="card-rarity" style="background: ${r.color}15; border-color: ${r.color}; color: ${r.color};">${r.emoji} ${r.name}</div><div class="card-count">${state.currentUser?.cards[c.id] || 0}шт</div></div>`;
  d.style.borderColor = r.color;
  d.addEventListener('click', () => showDetail(c));
  return d;
}

function showDetail(c) {
  const r = ui.getRarityBadge(c.rarity);
  document.getElementById('modal-card-title').textContent = c.title;
  document.getElementById('modal-card-artist').textContent = c.artist;
  document.getElementById('modal-card-year').textContent = `Year: ${c.year}`;
  const img = document.getElementById('modal-card-image');
  img.src = c.imageUrl || '';
  const addBtn = document.getElementById('add-to-deck-btn');
  if (addBtn) addBtn.onclick = async () => {
    const did = state.currentUser?.activeDeckId;
    if (!did) { ui.showError('No deck'); return; }
    if (await decks.addCardToDeck(did, c.id)) { ui.showSuccess('Added!'); decks.renderDecks(); }
  };
  openModal('card-detail-modal');
}
