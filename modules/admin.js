/**
 * modules/admin.js - админ-панель
 */

import { state } from '../app.js';
import * as ui from './ui.js';

const db = firebase.firestore();

export function initAdminPanel() {
  if (!state.isAdmin) {
    const form = document.getElementById('admin-form');
    form.innerHTML = '<div style="padding: 16px; color: red;">No admin rights</div>';
    return;
  }
  const form = document.getElementById('admin-form');
  if (!form.dataset.initialized) {
    form.addEventListener('submit', handleSubmit);
    form.querySelectorAll('.power-slider').forEach(slider => {
      const valSpan = slider.parentElement.querySelector('.slider-value');
      slider.addEventListener('input', () => { valSpan.textContent = slider.value; });
    });
    form.dataset.initialized = 'true';
  }
  renderCardsList();
}

async function handleSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const title = form.querySelector('#card-title').value.trim();
  const artist = form.querySelector('#card-artist').value.trim();
  const year = parseInt(form.querySelector('#card-year').value, 10);
  const description = form.querySelector('#card-description').value.trim();
  const imageUrl = form.querySelector('#card-image-url').value.trim();
  const rarity = form.querySelector('#card-rarity').value;
  
  // 🔥 НОВОЕ: Получаем theme и genre
  const theme = form.querySelector('#card-theme')?.value || '';
  const genre = form.querySelector('#card-genre')?.value || '';
  
  const resonance = parseInt(form.querySelector('#card-resonance').value, 10);
  const virtuosity = parseInt(form.querySelector('#card-virtuosity').value, 10);
  const profundity = parseInt(form.querySelector('#card-profundity').value, 10);
  const harmony = parseInt(form.querySelector('#card-harmony').value, 10);
  
  // 🔥 ВАЛИДАЦИЯ
  if (!title || !artist || !description || !rarity || !theme || !genre) {
    ui.showError('Fill all fields (including theme & genre)');
    return;
  }
  if (year < 1000 || year > 2100) {
    ui.showError('Year 1000-2100');
    return;
  }
  
  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  
  try {
    const cardId = form.dataset.editingId;
    
    // 🔥 ОБЪЕКТ КАРТЫ С THEME И GENRE
    const cardData = {
      title, 
      artist, 
      year, 
      description, 
      imageUrl, 
      rarity,
      theme,    // ⬅️ НОВОЕ
      genre,    // ⬅️ НОВОЕ
      power: { resonance, virtuosity, profundity, harmony }
    };
    
    if (cardId) {
      // Редактирование
      await db.collection('masterCards').doc(cardId).update({
        ...cardData,
        updatedAt: firebase.firestore.Timestamp.now()
      });
      ui.showSuccess('Card updated');
      form.dataset.editingId = '';
      form.querySelector('button[type="submit"]').textContent = '➕ Add Card';
    } else {
      // Новая карта
      await db.collection('masterCards').add({
        ...cardData,
        createdAt: firebase.firestore.Timestamp.now(),
        totalOwners: 0
      });
      ui.showSuccess('Card added');
    }
    form.reset();
    renderCardsList();
  } catch (error) {
    console.error('Ош:', error);
  } finally {
    submitBtn.disabled = false;
  }
}

async function renderCardsList() {
  try {
    const snap = await db.collection('masterCards').orderBy('createdAt', 'desc').limit(50).get();
    const container = document.getElementById('admin-cards-list');
    if (!container) return;
    container.innerHTML = '';
    snap.forEach(doc => {
      const card = { id: doc.id, ...doc.data() };
      const div = document.createElement('div');
      div.style.cssText = 'padding: 12px; border: 1px solid var(--border); margin: 8px 0; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;';
      
      // 🔥 ПОКАЗЫВАЕМ THEME И GENRE
      const themeLabel = card.theme ? `<span style="background:#3b82f620; color:#3b82f6; padding:2px 6px; border-radius:4px; font-size:10px; margin-right:4px;">🎨 ${card.theme}</span>` : '';
      const genreLabel = card.genre ? `<span style="background:#10b98120; color:#10b981; padding:2px 6px; border-radius:4px; font-size:10px;">🎭 ${card.genre}</span>` : '';
      
      div.innerHTML = `
        <div>
          <strong>${card.title}</strong> by ${card.artist} (${card.year})
          <div style="font-size: 12px; color: var(--text-secondary); margin-top:4px;">
            Rarity: ${card.rarity}
            <div style="margin-top:4px;">${themeLabel}${genreLabel}</div>
          </div>
        </div>
        <div style="display: flex; gap: 8px;">
          <button data-id="${card.id}" class="edit-btn" style="padding: 4px 8px; background: #3a8d8e; color: white; border: none; border-radius: 4px; cursor: pointer;">✎ Edit</button>
          <button data-id="${card.id}" class="delete-btn" style="padding: 4px 8px; background: #d32f2f; color: white; border: none; border-radius: 4px; cursor: pointer;">🗑 Delete</button>
        </div>
      `;
      const editBtn = div.querySelector('.edit-btn');
      const delBtn = div.querySelector('.delete-btn');
      editBtn.addEventListener('click', () => loadCardForEdit(card.id));
      delBtn.addEventListener('click', () => {
        if (confirm('Delete?')) deleteCard(card.id);
      });
      container.appendChild(div);
    });
  } catch (error) {
    console.error('Render:', error);
  }
}

async function loadCardForEdit(cardId) {
  try {
    const doc = await db.collection('masterCards').doc(cardId).get();
    const card = doc.data();
    const form = document.getElementById('admin-form');
    form.querySelector('#card-title').value = card.title;
    form.querySelector('#card-artist').value = card.artist;
    form.querySelector('#card-year').value = card.year;
    form.querySelector('#card-description').value = card.description;
    form.querySelector('#card-image-url').value = card.imageUrl || '';
    form.querySelector('#card-rarity').value = card.rarity;
    
    // 🔥 ЗАГРУЖАЕМ THEME И GENRE
    const themeSelect = form.querySelector('#card-theme');
    const genreSelect = form.querySelector('#card-genre');
    if (themeSelect) themeSelect.value = card.theme || '';
    if (genreSelect) genreSelect.value = card.genre || '';
    
    form.querySelector('#card-resonance').value = card.power?.resonance || 0;
    form.querySelector('#card-virtuosity').value = card.power?.virtuosity || 0;
    form.querySelector('#card-profundity').value = card.power?.profundity || 0;
    form.querySelector('#card-harmony').value = card.power?.harmony || 0;
    form.querySelectorAll('.slider-value').forEach((v, i) => {
      const val = [card.power?.resonance || 0, card.power?.virtuosity || 0, card.power?.profundity || 0, card.power?.harmony || 0][i];
      v.textContent = val;
    });
    form.dataset.editingId = cardId;
    form.querySelector('button[type="submit"]').textContent = '💾 Update';
    form.scrollIntoView({ behavior: 'smooth' });
  } catch (error) {
    console.error('Load:', error);
  }
}

async function deleteCard(cardId) {
  try {
    await db.collection('masterCards').doc(cardId).delete();
    ui.showSuccess('Card deleted');
    renderCardsList();
  } catch (error) {
    console.error('Delete:', error);
  }
}
