/**
 * gallery.js - Модуль галереи с фильтрацией, поиском и заметками
 */

import { state } from '../app.js';
import * as ui from './ui.js';

// Состояние галереи
const galleryState = {
  searchQuery: '',
  filterRarity: '',
  sortBy: 'dateObtained',
  favorites: new Set(),
  notes: new Map()
};

// Загрузка сохранённых данных
export function loadGalleryData() {
  try {
    const savedFavorites = localStorage.getItem('gallery_favorites');
    const savedNotes = localStorage.getItem('gallery_notes');
    
    if (savedFavorites) {
      galleryState.favorites = new Set(JSON.parse(savedFavorites));
    }
    if (savedNotes) {
      galleryState.notes = new Map(JSON.parse(savedNotes));
    }
  } catch (e) {
    console.error('Ошибка загрузки данных галереи:', e);
  }
}

// Сохранение данных
function saveGalleryData() {
  try {
    localStorage.setItem('gallery_favorites', JSON.stringify([...galleryState.favorites]));
    localStorage.setItem('gallery_notes', JSON.stringify([...galleryState.notes]));
  } catch (e) {
    console.error('Ошибка сохранения данных галереи:', e);
  }
}

// Переключение избранного
export function toggleFavorite(cardId) {
  if (galleryState.favorites.has(cardId)) {
    galleryState.favorites.delete(cardId);
  } else {
    galleryState.favorites.add(cardId);
  }
  saveGalleryData();
  renderGallery();
}

// Сохранение заметки
export function saveNote(cardId, note) {
  if (note.trim()) {
    galleryState.notes.set(cardId, note.trim());
  } else {
    galleryState.notes.delete(cardId);
  }
  saveGalleryData();
}

/**
 * ИСПРАВЛЕНО: Получение уникальных карт ИЗ КОЛЛЕКЦИИ ПОЛЬЗОВАТЕЛЯ
 * Берём карты из всех колод пользователя (включая дубликаты)
 */
function getUniqueCards() {
  const uniqueMap = new Map();
  
  // Проверяем наличие пользователя и его колод
  if (!state.currentUser?.decks) {
    return [];
  }
  
  // Собираем все карты из всех колод
  const decks = state.currentUser.decks;
  for (const deck of Object.values(decks)) {
    if (!deck.cards) continue;
    
    for (const [cardId, count] of Object.entries(deck.cards)) {
      // Находим полную информацию о карте из state.cards
      const cardInfo = state.cards.find(c => c.id === cardId);
      if (!cardInfo) continue;
      
      if (!uniqueMap.has(cardId)) {
        uniqueMap.set(cardId, { ...cardInfo, count });
      } else {
        // Суммируем количество из разных колод
        uniqueMap.get(cardId).count += count;
      }
    }
  }
  
  return Array.from(uniqueMap.values());
}

// Фильтрация и сортировка карт
function getFilteredCards() {
  let cards = getUniqueCards();
  
  // Поиск
  if (galleryState.searchQuery) {
    const query = galleryState.searchQuery.toLowerCase();
    cards = cards.filter(card => 
      card.title.toLowerCase().includes(query) ||
      card.artist.toLowerCase().includes(query) ||
      card.year.toString().includes(query)
    );
  }
  
  // Фильтр по редкости
  if (galleryState.filterRarity === 'favorites') {
    cards = cards.filter(card => galleryState.favorites.has(card.id));
  } else if (galleryState.filterRarity) {
    cards = cards.filter(card => card.rarity === galleryState.filterRarity);
  }
  
  // Сортировка
  cards.sort((a, b) => {
    switch (galleryState.sortBy) {
      case 'name':
        return a.title.localeCompare(b.title, 'ru');
      case 'artist':
        return a.artist.localeCompare(b.artist, 'ru');
      case 'rarity':
        const rarityOrder = {
          common: 0, uncommon: 1, rare: 2, mythical: 3,
          legendary: 4, ancient: 5, exceedingly_rare: 6,
          ethereal: 7, immortal: 8
        };
        return (rarityOrder[b.rarity] || 0) - (rarityOrder[a.rarity] || 0);
      case 'dateObtained':
      default:
        return 0; // Порядок как в коллекции
    }
  });
  
  return cards;
}

// Рендер галереи
export function renderGallery() {
  const container = document.getElementById('gallery-grid');
  if (!container) return;
  
  const cards = getFilteredCards();
  
  if (cards.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--text-secondary);">
        <p style="font-size: 18px; margin-bottom: 8px;">🎨 Галерея пуста</p>
        <p style="font-size: 14px;">Добавьте карты в коллекцию, чтобы увидеть их здесь</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = cards.map(card => {
    const isFavorite = galleryState.favorites.has(card.id);
    const rarityColors = {
      common: '#9CA3AF',
      uncommon: '#10B981',
      rare: '#3B82F6',
      mythical: '#A855F7',
      legendary: '#F59E0B',
      ancient: '#F97316',
      exceedingly_rare: '#EC4899',
      ethereal: '#06B6D4',
      immortal: '#EF4444'
    };
    
    return `
      <div 
        class="gallery-card" 
        data-card-id="${card.id}"
        style="
          position: relative;
          cursor: pointer;
          transition: all 0.3s ease;
          display: inline-block;
        "
      >
        ${isFavorite ? `
          <div style="position: absolute; top: 8px; right: 8px; z-index: 10;">
            <span style="font-size: 20px;">⭐</span>
          </div>
        ` : ''}
        
        <div style="position: relative; display: inline-block;">
          <img 
            src="${card.imageUrl}" 
            alt="${card.title}"
            style="
              max-width: 100%;
              height: auto;
              display: block;
              border-radius: 8px;
              border: 3px solid ${rarityColors[card.rarity] || '#9CA3AF'};
              box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            "
            loading="lazy"
          >
        </div>
        
        <div style="padding: 12px 4px;">
          <h3 style="
            font-size: 14px;
            font-weight: 700;
            color: var(--text-accent);
            margin: 0 0 4px 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          ">${card.title}</h3>
          
          <p style="
            font-size: 12px;
            color: var(--text-secondary);
            margin: 0 0 4px 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          ">${card.artist}</p>
          
          <p style="
            font-size: 11px;
            color: var(--text-secondary);
            margin: 0 0 8px 0;
          ">${card.year}</p>
          
          ${card.count > 1 ? `
            <div style="
              font-size: 11px;
              color: var(--text-secondary);
              background: var(--bg-tertiary);
              padding: 4px 8px;
              border-radius: 6px;
              text-align: center;
            ">
              Копий: ${card.count}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
  
  // Добавление обработчиков кликов
  container.querySelectorAll('.gallery-card').forEach(cardEl => {
    cardEl.addEventListener('click', () => {
      const cardId = cardEl.dataset.cardId;
      const card = cards.find(c => c.id === cardId);
      if (card) showCardDetailModal(card);
    });
  });
  
  // Обновление счётчика
  updateGalleryStats();
}

// Обновление статистики
function updateGalleryStats() {
  const totalEl = document.getElementById('gallery-total-cards');
  const uniqueEl = document.getElementById('gallery-unique-cards');
  const favoritesEl = document.getElementById('gallery-favorites-count');
  
  const uniqueCards = getUniqueCards();
  const totalCount = uniqueCards.reduce((sum, card) => sum + card.count, 0);
  
  if (totalEl) totalEl.textContent = totalCount;
  if (uniqueEl) uniqueEl.textContent = uniqueCards.length;
  if (favoritesEl) favoritesEl.textContent = galleryState.favorites.size;
}

/**
 * Показать изображение на весь экран (зум)
 */
function showImageZoom(imageUrl, title) {
  const zoomModal = document.createElement('div');
  zoomModal.className = 'modal active';
  zoomModal.style.cssText = 'background: rgba(0, 0, 0, 0.95); z-index: 10000;';
  
  zoomModal.innerHTML = `
    <div style="
      width: 100vw;
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      box-sizing: border-box;
      position: relative;
    ">
      <button 
        class="zoom-close"
        style="
          position: absolute;
          top: 20px;
          right: 20px;
          width: 48px;
          height: 48px;
          background: rgba(255, 255, 255, 0.2);
          backdrop-filter: blur(10px);
          border: none;
          border-radius: 50%;
          color: white;
          font-size: 32px;
          cursor: pointer;
          z-index: 10001;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
        "
        onmouseover="this.style.background='rgba(255, 255, 255, 0.3)'"
        onmouseout="this.style.background='rgba(255, 255, 255, 0.2)'"
      >×</button>
      
      <img 
        src="${imageUrl}" 
        alt="${title}"
        style="
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
          border-radius: 12px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        "
      />
      
      <div style="
        position: absolute;
        bottom: 30px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(10px);
        padding: 12px 24px;
        border-radius: 24px;
        color: white;
        font-size: 16px;
        font-weight: 600;
      ">
        ${title}
      </div>
    </div>
  `;
  
  document.body.appendChild(zoomModal);
  
  const closeBtn = zoomModal.querySelector('.zoom-close');
  closeBtn.onclick = () => zoomModal.remove();
  
  zoomModal.onclick = (e) => {
    if (e.target === zoomModal || e.target.tagName === 'IMG') {
      zoomModal.remove();
    }
  };
  
  // ESC для закрытия
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      zoomModal.remove();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

// Модальное окно детального просмотра
function showCardDetailModal(card) {
  const modal = document.createElement('div');
  modal.className = 'modal active';
  modal.id = 'gallery-detail-modal';
  
  const isFavorite = galleryState.favorites.has(card.id);
  const note = galleryState.notes.get(card.id) || '';
  
  const rarityLabels = {
    common: 'Обычная',
    uncommon: 'Необычная',
    rare: 'Редкая',
    mythical: 'Мифическая',
    legendary: 'Легендарная',
    ancient: 'Древняя',
    exceedingly_rare: 'Исключительно редкая',
    ethereal: 'Эфирная',
    immortal: 'Бессмертная'
  };
  
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 700px; max-height: 90vh; overflow-y: auto; padding-top: 0;">
      <!-- ФИКС: Убрал sticky, добавил обычный заголовок -->
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 24px 24px 16px 24px; background: var(--bg-secondary);">
        <h2 style="margin: 0; color: var(--text-accent);">Детали картины</h2>
        <button class="modal-close" style="padding: 0; width: 36px; height: 36px; font-size: 24px; background: none; border: none; color: var(--text); cursor: pointer;">×</button>
      </div>
      
      <div style="padding: 0 24px 24px 24px;">
        <!-- ЗУМ: Клик по изображению для увеличения -->
        <div style="margin-bottom: 24px; cursor: zoom-in; position: relative;" id="image-zoom-trigger">
          <img 
            src="${card.imageUrl}" 
            alt="${card.title}"
            style="width: 100%; border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.2); transition: transform 0.3s ease;"
          >
          <div style="
            position: absolute;
            bottom: 12px;
            right: 12px;
            background: rgba(0,0,0,0.6);
            backdrop-filter: blur(10px);
            padding: 8px 12px;
            border-radius: 20px;
            color: white;
            font-size: 12px;
            font-weight: 600;
            pointer-events: none;
          ">
            🔍 Клик для увеличения
          </div>
        </div>
        
        <div style="margin-bottom: 20px;">
          <h3 style="font-size: 24px; margin: 0 0 8px 0; color: var(--text-accent);">${card.title}</h3>
          <p style="font-size: 16px; color: var(--text-secondary); margin: 0 0 8px 0;">${card.artist}, ${card.year}</p>
          <div style="display: inline-block; padding: 6px 12px; border-radius: 8px; background: var(--bg-tertiary); font-size: 14px; font-weight: 600;">
            ${rarityLabels[card.rarity]}
          </div>
        </div>
        
        <div style="margin-bottom: 24px;">
          <h4 style="font-size: 16px; margin: 0 0 8px 0; color: var(--text-accent);">📚 Описание</h4>
          <p style="color: var(--text); line-height: 1.6;">${card.description}</p>
        </div>
        
        <div style="background: #FEF3C7; border: 1px solid #FCD34D; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h4 style="margin: 0; font-size: 16px; color: #92400E; display: flex; align-items: center; gap: 8px;">
              <span>📝</span> Моя заметка
            </h4>
            <button 
              id="edit-note-btn"
              style="
                padding: 6px 12px;
                background: #F59E0B;
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 13px;
                font-weight: 600;
              "
            >
              Редактировать
            </button>
          </div>
          
          <div id="note-display" style="color: #78350F; font-style: ${note ? 'normal' : 'italic'};">
            ${note || 'Нет заметок. Нажмите "Редактировать" чтобы добавить.'}
          </div>
          
          <div id="note-editor" style="display: none;">
            <textarea 
              id="note-textarea"
              style="
                width: 100%;
                padding: 12px;
                border: 1px solid #FCD34D;
                border-radius: 8px;
                background: white;
                color: #78350F;
                font-size: 14px;
                resize: vertical;
                min-height: 100px;
                box-sizing: border-box;
              "
              placeholder="Добавьте личную заметку о картине..."
            >${note}</textarea>
            <div style="display: flex; gap: 8px; margin-top: 8px;">
              <button 
                id="save-note-btn"
                style="
                  flex: 1;
                  padding: 8px;
                  background: #10B981;
                  color: white;
                  border: none;
                  border-radius: 6px;
                  cursor: pointer;
                  font-weight: 600;
                "
              >
                💾 Сохранить
              </button>
              <button 
                id="cancel-note-btn"
                style="
                  flex: 1;
                  padding: 8px;
                  background: #6B7280;
                  color: white;
                  border: none;
                  border-radius: 6px;
                  cursor: pointer;
                  font-weight: 600;
                "
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
        
        <div style="display: flex; gap: 12px;">
          <button 
            id="toggle-favorite-btn"
            style="
              flex: 1;
              padding: 14px;
              background: ${isFavorite ? '#FCD34D' : 'var(--bg-tertiary)'};
              color: ${isFavorite ? '#78350F' : 'var(--text)'};
              border: none;
              border-radius: 10px;
              cursor: pointer;
              font-size: 16px;
              font-weight: 600;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 8px;
            "
          >
            <span>${isFavorite ? '⭐' : '☆'}</span>
            ${isFavorite ? 'В избранном' : 'В избранное'}
          </button>
          
          <button 
            style="
              flex: 1;
              padding: 14px;
              background: linear-gradient(135deg, #8B5CF6, #6366F1);
              color: white;
              border: none;
              border-radius: 10px;
              cursor: pointer;
              font-size: 16px;
              font-weight: 600;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 8px;
            "
          >
            <span>🧩</span>
            Сложить пазл
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Обработчики
  modal.querySelector('.modal-close').addEventListener('click', () => {
    modal.remove();
  });
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
  
  // ЗУМ: Клик по изображению
  const imageZoomTrigger = modal.querySelector('#image-zoom-trigger');
  imageZoomTrigger.addEventListener('click', () => {
    showImageZoom(card.imageUrl, card.title);
  });
  
  imageZoomTrigger.addEventListener('mouseenter', () => {
    const img = imageZoomTrigger.querySelector('img');
    img.style.transform = 'scale(1.02)';
  });
  
  imageZoomTrigger.addEventListener('mouseleave', () => {
    const img = imageZoomTrigger.querySelector('img');
    img.style.transform = 'scale(1)';
  });
  
  // Редактирование заметки
  const editBtn = modal.querySelector('#edit-note-btn');
  const noteDisplay = modal.querySelector('#note-display');
  const noteEditor = modal.querySelector('#note-editor');
  const saveBtn = modal.querySelector('#save-note-btn');
  const cancelBtn = modal.querySelector('#cancel-note-btn');
  
  editBtn.addEventListener('click', () => {
    noteDisplay.style.display = 'none';
    noteEditor.style.display = 'block';
    modal.querySelector('#note-textarea').focus();
  });
  
  saveBtn.addEventListener('click', () => {
    const newNote = modal.querySelector('#note-textarea').value;
    saveNote(card.id, newNote);
    noteDisplay.textContent = newNote || 'Нет заметок. Нажмите "Редактировать" чтобы добавить.';
    noteDisplay.style.fontStyle = newNote ? 'normal' : 'italic';
    noteDisplay.style.display = 'block';
    noteEditor.style.display = 'none';
    ui.showToast('Заметка сохранена!', 'success');
  });
  
  cancelBtn.addEventListener('click', () => {
    modal.querySelector('#note-textarea').value = note;
    noteDisplay.style.display = 'block';
    noteEditor.style.display = 'none';
  });
  
  // Избранное
  modal.querySelector('#toggle-favorite-btn').addEventListener('click', () => {
    toggleFavorite(card.id);
    modal.remove();
    ui.showToast(
      galleryState.favorites.has(card.id) ? '⭐ Добавлено в избранное' : 'Удалено из избранного',
      'success'
    );
  });
}

// Обработчики поиска и фильтров
export function setupGalleryListeners() {
  const searchInput = document.getElementById('gallery-search');
  const filterSelect = document.getElementById('gallery-filter-rarity');
  const sortSelect = document.getElementById('gallery-sort');
  
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      galleryState.searchQuery = e.target.value;
      renderGallery();
    });
  }
  
  if (filterSelect) {
    filterSelect.addEventListener('change', (e) => {
      galleryState.filterRarity = e.target.value;
      renderGallery();
    });
  }
  
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      galleryState.sortBy = e.target.value;
      renderGallery();
    });
  }
}
