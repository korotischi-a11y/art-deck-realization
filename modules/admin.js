/**
 * modules/admin.js - админ-панель
 */

import { state } from '../app.js';
import * as ui from './ui.js';

const db = firebase.firestore();

// Хранилище всех карт из базы
let allMasterCards = [];
let currentFilters = { rarity: '', genre: '' };

export function initAdminPanel() {
  if (!state.isAdmin) {
    const form = document.getElementById('admin-form');
    if (form) form.innerHTML = '<div style="padding: 16px; color: red;">No admin rights</div>';
    return;
  }
  const form = document.getElementById('admin-form');
  if (form && !form.dataset.initialized) {
    form.addEventListener('submit', handleSubmit);
    form.querySelectorAll('.power-slider').forEach(slider => {
      const valSpan = slider.parentElement.querySelector('.slider-value');
      if (valSpan) {
        slider.addEventListener('input', () => { valSpan.textContent = slider.value; });
      }
    });
    form.dataset.initialized = 'true';
  }
  
  setupFilters();
  loadAllCards();
}

function setupFilters() {
  const rarityFilter = document.getElementById('admin-filter-rarity');
  const genreFilter = document.getElementById('admin-filter-genre');
  
  if (rarityFilter && !rarityFilter.dataset.initialized) {
    rarityFilter.addEventListener('change', (e) => {
      currentFilters.rarity = e.target.value;
      renderCardsGrid();
    });
    rarityFilter.dataset.initialized = 'true';
  }
  
  if (genreFilter && !genreFilter.dataset.initialized) {
    genreFilter.addEventListener('change', (e) => {
      currentFilters.genre = e.target.value;
      renderCardsGrid();
    });
    genreFilter.dataset.initialized = 'true';
  }
}

async function loadAllCards() {
  try {
    const snap = await db.collection('masterCards').orderBy('createdAt', 'desc').get();
    allMasterCards = [];
    snap.forEach(doc => {
      allMasterCards.push({ id: doc.id, ...doc.data() });
    });
    
    updateStatistics();
    renderCardsGrid();
  } catch (error) {
    console.error('Load all cards:', error);
  }
}

function updateStatistics() {
  const totalEl = document.getElementById('admin-total-cards');
  const commonEl = document.getElementById('admin-common-cards');
  const legendaryEl = document.getElementById('admin-legendary-cards');
  
  if (totalEl) totalEl.textContent = allMasterCards.length;
  
  if (commonEl) {
    const commonCount = allMasterCards.filter(c => c.rarity === 'common' || c.rarity === 'uncommon').length;
    commonEl.textContent = commonCount;
  }
  
  if (legendaryEl) {
    const legendaryCount = allMasterCards.filter(c => 
      c.rarity === 'legendary' || c.rarity === 'ancient' || c.rarity === 'ethereal' || c.rarity === 'immortal'
    ).length;
    legendaryEl.textContent = legendaryCount;
  }
}

function renderCardsGrid() {
  const container = document.getElementById('admin-cards-matrix');
  if (!container) return;
  
  let filteredCards = allMasterCards;
  
  if (currentFilters.rarity) {
    filteredCards = filteredCards.filter(c => c.rarity === currentFilters.rarity);
  }
  
  if (currentFilters.genre) {
    filteredCards = filteredCards.filter(c => c.genre === currentFilters.genre);
  }
  
  container.innerHTML = '';
  
  if (filteredCards.length === 0) {
    container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-secondary);">Карт не найдено</div>';
    return;
  }
  
  filteredCards.forEach(card => {
    const cardEl = createCardElement(card);
    container.appendChild(cardEl);
  });
}

function createCardElement(card) {
  const div = document.createElement('div');
  div.className = 'card-item';
  div.dataset.rarity = card.rarity;
  div.style.cursor = 'pointer';
  
  const rarityLabels = {
    common: '🗑 Обычная',
    uncommon: '🎯 Необычная',
    rare: '🏆 Редкая',
    mythical: '💎 Мифическая',
    legendary: '⭐ Легендарная',
    ancient: '🔥 Древняя',
    ethereal: '🔮 Эфирная',
    immortal: '⚠ Бессмертная'
  };
  
  const rarityColors = {
    common: '#6b7280',
    uncommon: '#3b82f6',
    rare: '#8b5cf6',
    mythical: '#d946ef',
    legendary: '#ec4899',
    ancient: '#f97316',
    ethereal: '#06b6d4',
    immortal: '#fbbf24'
  };
  
  const genreEmojis = {
    portrait: '👤',
    landscape: '🌄',
    still_life: '🍎',
    religious: '⛪',
    mythological: '🐉',
    abstract: '🎨',
    urban: '🏙️',
    nude: '💃'
  };
  
  // 🔥 ПРЕВЬЮ БЕЗ ЗУМА (зум только в модалке)
  const imgWrapper = document.createElement('div');
  imgWrapper.className = 'card-image';
  imgWrapper.innerHTML = card.imageUrl
    ? `<img src="${card.imageUrl}" alt="${card.title}" loading="lazy">`
    : '🖼️';
  
  const body = document.createElement('div');
  body.className = 'card-body';
  body.innerHTML = `
    <h3 class="card-title">${card.title}</h3>
    <p class="card-artist">${card.artist} (${card.year})</p>
    <div class="card-rarity" style="background-color: ${rarityColors[card.rarity] || '#6b7280'}20; color: ${rarityColors[card.rarity] || '#6b7280'};">
      ${rarityLabels[card.rarity] || card.rarity}
    </div>
    <div class="card-params">
      <div class="card-param-line">
        <span>♥${card.power?.resonance || 0}</span>
        <span>⚡${card.power?.virtuosity || 0}</span>
      </div>
      <div class="card-param-line">
        <span>🧠${card.power?.profundity || 0}</span>
        <span>⚖${card.power?.harmony || 0}</span>
      </div>
      ${card.genre ? `<div style="margin-top: 4px; font-size: 10px; text-align: center; color: var(--text-secondary);">${genreEmojis[card.genre] || '🎭'} ${card.genre}</div>` : ''}
    </div>
  `;
  
  div.appendChild(imgWrapper);
  div.appendChild(body);
  
  // 🔥 КЛИК НА КАРТОЧКУ ОТКРЫВАЕТ МОДАЛКУ С ВОЗМОЖНОСТЬЮ РЕДАКТИРОВАНИЯ
  div.addEventListener('click', () => {
    openCardDetailModal(card);
  });
  
  return div;
}

function openCardDetailModal(card) {
  const modal = document.getElementById('card-detail-modal');
  if (!modal) return;
  
  const rarityLabels = {
    common: '🗑 Обычная',
    uncommon: '🎯 Необычная',
    rare: '🏆 Редкая',
    mythical: '💎 Мифическая',
    legendary: '⭐ Легендарная',
    ancient: '🔥 Древняя',
    ethereal: '🔮 Эфирная',
    immortal: '⚠ Бессмертная'
  };
  
  const rarityColors = {
    common: '#6b7280',
    uncommon: '#3b82f6',
    rare: '#8b5cf6',
    mythical: '#d946ef',
    legendary: '#ec4899',
    ancient: '#f97316',
    ethereal: '#06b6d4',
    immortal: '#fbbf24'
  };
  
  document.getElementById('modal-card-title').textContent = card.title;
  document.getElementById('modal-card-artist').textContent = card.artist;
  document.getElementById('modal-card-year').textContent = card.year;
  document.getElementById('modal-card-description').textContent = card.description || 'Нет описания';
  
  const img = document.getElementById('modal-card-image');
  if (card.imageUrl) {
    img.src = card.imageUrl;
    img.style.display = 'block';
    
    // 🔥 ЗУМ ПО КЛИКУ НА ИЗОБРАЖЕНИЕ В МОДАЛКЕ
    img.style.cursor = 'zoom-in';
    img.onclick = (e) => {
      e.stopPropagation();
      img.classList.toggle('modal-image-zoomed');
      img.style.cursor = img.classList.contains('modal-image-zoomed') ? 'zoom-out' : 'zoom-in';
    };
  } else {
    img.style.display = 'none';
  }
  
  const rarityEl = document.getElementById('modal-card-rarity');
  rarityEl.textContent = rarityLabels[card.rarity] || card.rarity;
  rarityEl.style.backgroundColor = (rarityColors[card.rarity] || '#6b7280') + '20';
  rarityEl.style.color = rarityColors[card.rarity] || '#6b7280';
  
  const paramsTable = document.getElementById('modal-params-table');
  paramsTable.innerHTML = `
    <div class="modal-param-cell">
      <div class="modal-param-label">♥ Resonance</div>
      <div class="modal-param-value">${card.power?.resonance || 0}</div>
    </div>
    <div class="modal-param-cell">
      <div class="modal-param-label">⚡ Virtuosity</div>
      <div class="modal-param-value">${card.power?.virtuosity || 0}</div>
    </div>
    <div class="modal-param-cell">
      <div class="modal-param-label">🧠 Profundity</div>
      <div class="modal-param-value">${card.power?.profundity || 0}</div>
    </div>
    <div class="modal-param-cell">
      <div class="modal-param-label">⚖ Harmony</div>
      <div class="modal-param-value">${card.power?.harmony || 0}</div>
    </div>
  `;
  
  const countEl = document.getElementById('modal-card-count');
  countEl.innerHTML = `
    <div style="display: flex; justify-content: space-around; font-size: 12px; margin-bottom: 12px;">
      <div><strong>🎨 Стиль:</strong> ${card.theme || '—'}</div>
      <div><strong>🎭 Жанр:</strong> ${card.genre || '—'}</div>
    </div>
    ${state.isAdmin ? `
      <div style="display: flex; gap: 8px; flex-direction: column;">
        <button id="edit-card-btn" class="btn btn-primary" style="width: 100%;">✏️ Изменить карту</button>
        <button id="delete-card-btn" class="btn" style="width: 100%; background: #ef4444; color: white; font-weight: 600;">🗑️ Удалить карту</button>
      </div>
    ` : ''}
  `;
  
  // 🔥 КНОПКА РЕДАКТИРОВАНИЯ (только для админа)
  if (state.isAdmin) {
    const editBtn = countEl.querySelector('#edit-card-btn');
    if (editBtn) {
      editBtn.addEventListener('click', () => {
        fillFormForEdit(card);
        modal.classList.remove('active');
        
        // Переключаемся на админ-таб и прокручиваем к форме
        document.querySelector('[data-tab="admin"]').click();
        setTimeout(() => {
          document.getElementById('admin-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      });
    }
    
    // 🔥 КНОПКА УДАЛЕНИЯ
    const deleteBtn = countEl.querySelector('#delete-card-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async () => {
        const confirmed = confirm(`⚠️ УДАЛИТЬ карту "${card.title}" навсегда?\n\nЭто действие НЕЛЬЗЯ ОТМЕНИТЬ!`);
        if (!confirmed) return;
        
        try {
          await db.collection('masterCards').doc(card.id).delete();
          ui.showSuccess(`✅ Карта "${card.title}" удалена`);
          modal.classList.remove('active');
          await loadAllCards();
        } catch (error) {
          console.error('Delete card error:', error);
          ui.showError('❌ Ошибка при удалении');
        }
      });
    }
  }
  
  modal.classList.add('active');
}

function fillFormForEdit(card) {
  const form = document.getElementById('admin-form');
  if (!form) return;
  
  form.querySelector('#card-title').value = card.title || '';
  form.querySelector('#card-artist').value = card.artist || '';
  form.querySelector('#card-year').value = card.year || '';
  form.querySelector('#card-description').value = card.description || '';
  form.querySelector('#card-image-url').value = card.imageUrl || '';
  form.querySelector('#card-rarity').value = card.rarity || '';
  form.querySelector('#card-theme').value = card.theme || '';
  form.querySelector('#card-genre').value = card.genre || '';
  
  const resonance = form.querySelector('#card-resonance');
  const virtuosity = form.querySelector('#card-virtuosity');
  const profundity = form.querySelector('#card-profundity');
  const harmony = form.querySelector('#card-harmony');
  
  resonance.value = card.power?.resonance || 5;
  virtuosity.value = card.power?.virtuosity || 5;
  profundity.value = card.power?.profundity || 5;
  harmony.value = card.power?.harmony || 5;
  
  // Обновляем отображение значений слайдеров
  resonance.parentElement.querySelector('.slider-value').textContent = resonance.value;
  virtuosity.parentElement.querySelector('.slider-value').textContent = virtuosity.value;
  profundity.parentElement.querySelector('.slider-value').textContent = profundity.value;
  harmony.parentElement.querySelector('.slider-value').textContent = harmony.value;
  
  // Сохраняем ID для обновления
  form.dataset.editingId = card.id;
  form.querySelector('button[type="submit"]').textContent = '💾 Сохранить изменения';
  
  ui.showSuccess('✏️ Карта загружена для редактирования');
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
  
  const theme = form.querySelector('#card-theme')?.value || '';
  const genre = form.querySelector('#card-genre')?.value || '';
  
  const resonance = parseInt(form.querySelector('#card-resonance').value, 10);
  const virtuosity = parseInt(form.querySelector('#card-virtuosity').value, 10);
  const profundity = parseInt(form.querySelector('#card-profundity').value, 10);
  const harmony = parseInt(form.querySelector('#card-harmony').value, 10);
  
  if (!title || !artist || !description || !rarity || !theme || !genre) {
    ui.showError('Заполни все поля (включая theme & genre)');
    return;
  }
  if (year < 1000 || year > 2100) {
    ui.showError('Год 1000-2100');
    return;
  }
  
  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  
  try {
    const cardId = form.dataset.editingId;
    
    const cardData = {
      title, 
      artist, 
      year, 
      description, 
      imageUrl, 
      rarity,
      theme,
      genre,
      power: { resonance, virtuosity, profundity, harmony }
    };
    
    if (cardId) {
      await db.collection('masterCards').doc(cardId).update({
        ...cardData,
        updatedAt: firebase.firestore.Timestamp.now()
      });
      ui.showSuccess('✅ Карта обновлена');
      form.dataset.editingId = '';
      form.querySelector('button[type="submit"]').textContent = '➕ Добавить';
    } else {
      await db.collection('masterCards').add({
        ...cardData,
        createdAt: firebase.firestore.Timestamp.now(),
        totalOwners: 0
      });
      ui.showSuccess('✅ Карта добавлена');
    }
    form.reset();
    
    await loadAllCards();
  } catch (error) {
    console.error('Ош:', error);
    ui.showError('Ошибка: ' + error.message);
  } finally {
    submitBtn.disabled = false;
  }
}

// 🔥 МАССОВАЯ ЗАГРУЗКА ИЗ JSON
export function uploadCardsFromJSON() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      try {
        const jsonData = JSON.parse(event.target.result);
        
        // Валидация: должен быть массив
        if (!Array.isArray(jsonData)) {
          ui.showError('❌ JSON должен содержать массив карт!');
          return;
        }
        
        if (jsonData.length === 0) {
          ui.showError('❌ Массив карт пуст!');
          return;
        }
        
        // Валидация структуры первой карты
        const firstCard = jsonData[0];
        const requiredFields = ['title', 'artist', 'year', 'description', 'rarity', 'theme', 'genre'];
        const missingFields = requiredFields.filter(field => !firstCard[field]);
        
        if (missingFields.length > 0) {
          ui.showError(`❌ Отсутствуют поля: ${missingFields.join(', ')}`);
          return;
        }
        
        // Подтверждение загрузки
        const confirmed = confirm(`📦 Загрузить ${jsonData.length} карт в базу данных?`);
        if (!confirmed) return;
        
        ui.showSuccess(`📦 Загружаю ${jsonData.length} карт...`);
        
        let uploaded = 0;
        const batch = db.batch();
        
        for (const card of jsonData) {
          const docRef = db.collection('masterCards').doc();
          batch.set(docRef, {
            title: card.title,
            artist: card.artist,
            year: card.year,
            description: card.description,
            imageUrl: card.imageUrl || '',
            rarity: card.rarity,
            theme: card.theme,
            genre: card.genre,
            power: {
              resonance: card.power?.resonance || 5,
              virtuosity: card.power?.virtuosity || 5,
              profundity: card.power?.profundity || 5,
              harmony: card.power?.harmony || 5
            },
            createdAt: firebase.firestore.Timestamp.now(),
            totalOwners: 0
          });
          uploaded++;
        }
        
        await batch.commit();
        
        ui.showSuccess(`✅ Успешно загружено ${uploaded} карт!`);
        await loadAllCards();
        
      } catch (error) {
        console.error('Upload JSON error:', error);
        ui.showError(`❌ Ошибка: ${error.message}`);
      }
    };
    
    reader.onerror = () => {
      ui.showError('❌ Ошибка чтения файла!');
    };
    
    reader.readAsText(file);
  };
  
  input.click();
}

// 🔥 ЭКСПОРТ КАРТ В JSON
export async function exportCardsToJSON() {
  try {
    ui.showSuccess('📥 Скачиваю данные...');
    
    const snap = await db.collection('masterCards').orderBy('createdAt', 'desc').get();
    const cardsData = [];
    
    snap.forEach(doc => {
      const data = doc.data();
      cardsData.push({
        title: data.title,
        artist: data.artist,
        year: data.year,
        description: data.description,
        imageUrl: data.imageUrl || '',
        rarity: data.rarity,
        theme: data.theme,
        genre: data.genre,
        power: {
          resonance: data.power?.resonance || 5,
          virtuosity: data.power?.virtuosity || 5,
          profundity: data.power?.profundity || 5,
          harmony: data.power?.harmony || 5
        }
      });
    });
    
    // Создаём JSON файл
    const jsonString = JSON.stringify(cardsData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // Создаём ссылку для скачивания
    const a = document.createElement('a');
    a.href = url;
    a.download = `art-deck-cards-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    ui.showSuccess(`✅ Экспортировано ${cardsData.length} карт!`);
  } catch (error) {
    console.error('Export JSON error:', error);
    ui.showError(`❌ Ошибка экспорта: ${error.message}`);
  }
}