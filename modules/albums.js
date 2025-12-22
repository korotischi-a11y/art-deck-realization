/**
 * modules/albums.js - Система альбомов для публикации коллекций
 */

import { state } from '../app.js';
import * as ui from './ui.js';
import * as decks from './decks.js';

const db = firebase.firestore();

/**
 * Создать новый альбом
 */
export async function createAlbum(name, description = '', coverCardId = null) {
  try {
    if (!state.currentUser) throw new Error('Пользователь не авторизован');
    
    const albumId = `album_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const coverImageUrl = coverCardId ? getCoverImage(coverCardId) : '';
    
    const album = {
      name: name.trim(),
      description: description.trim(),
      coverImageUrl,
      cards: {},
      isPublic: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      viewCount: 0,
      likeCount: 0
    };
    
    const userRef = db.collection('users').doc(state.currentUser.uid);
    await userRef.update({
      [`albums.${albumId}`]: album
    });
    
    console.log(`✅ Альбом "${name}" создан`);
    return albumId;
  } catch (e) {
    console.error('Ошибка создания альбома:', e);
    throw e;
  }
}

/**
 * Получить обложку альбома
 */
function getCoverImage(cardId) {
  const card = state.cards.find(c => c.id === cardId);
  return card?.imageUrl || '';
}

/**
 * Добавить карту в альбом
 */
export async function addCardToAlbum(albumId, cardId) {
  try {
    if (!state.currentUser) throw new Error('Пользователь не авторизован');
    
    const userRef = db.collection('users').doc(state.currentUser.uid);
    await userRef.update({
      [`albums.${albumId}.cards.${cardId}`]: true,
      [`albums.${albumId}.updatedAt`]: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Обновляем локальное состояние
    if (!state.currentUser.albums) state.currentUser.albums = {};
    if (!state.currentUser.albums[albumId]) state.currentUser.albums[albumId] = { cards: {} };
    state.currentUser.albums[albumId].cards[cardId] = true;
    
    console.log(`✅ Карта добавлена в альбом`);
    return true;
  } catch (e) {
    console.error('Ошибка добавления карты в альбом:', e);
    return false;
  }
}

/**
 * Удалить карту из альбома
 */
export async function removeCardFromAlbum(albumId, cardId) {
  try {
    if (!state.currentUser) throw new Error('Пользователь не авторизован');
    
    const userRef = db.collection('users').doc(state.currentUser.uid);
    await userRef.update({
      [`albums.${albumId}.cards.${cardId}`]: firebase.firestore.FieldValue.delete(),
      [`albums.${albumId}.updatedAt`]: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Обновляем локальное состояние
    if (state.currentUser.albums?.[albumId]?.cards) {
      delete state.currentUser.albums[albumId].cards[cardId];
    }
    
    console.log(`✅ Карта удалена из альбома`);
    return true;
  } catch (e) {
    console.error('Ошибка удаления карты из альбома:', e);
    return false;
  }
}

/**
 * Опубликовать/снять с публикации альбом
 */
export async function toggleAlbumPublic(albumId) {
  try {
    if (!state.currentUser) throw new Error('Пользователь не авторизован');
    
    const album = state.currentUser.albums?.[albumId];
    if (!album) throw new Error('Альбом не найден');
    
    const newPublicState = !album.isPublic;
    
    const userRef = db.collection('users').doc(state.currentUser.uid);
    await userRef.update({
      [`albums.${albumId}.isPublic`]: newPublicState,
      [`albums.${albumId}.updatedAt`]: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Если публикуем, добавляем в publicAlbums
    if (newPublicState) {
      await db.collection('publicAlbums').doc(albumId).set({
        albumId,
        userId: state.currentUser.uid,
        userName: state.currentUser.displayName || 'Аноним',
        userAvatar: state.currentUser.photoURL || '',
        name: album.name,
        description: album.description,
        coverImageUrl: album.coverImageUrl,
        cardCount: Object.keys(album.cards || {}).length,
        createdAt: album.createdAt,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        viewCount: album.viewCount || 0,
        likeCount: album.likeCount || 0
      });
    } else {
      // Если снимаем с публикации, удаляем из publicAlbums
      await db.collection('publicAlbums').doc(albumId).delete();
    }
    
    // Обновляем локальное состояние
    state.currentUser.albums[albumId].isPublic = newPublicState;
    
    console.log(`✅ Альбом ${newPublicState ? 'опубликован' : 'снят с публикации'}`);
    return true;
  } catch (e) {
    console.error('Ошибка публикации альбома:', e);
    return false;
  }
}

/**
 * Конвертировать колоду в альбом
 */
export async function convertDeckToAlbum(deckId) {
  try {
    if (!state.currentUser) throw new Error('Пользователь не авторизован');
    
    const deck = state.currentUser.decks?.[deckId];
    if (!deck) throw new Error('Колода не найдена');
    if (deck.isDiscardDeck) throw new Error('Нельзя конвертировать техническую колоду');
    
    const albumId = await createAlbum(
      deck.name,
      `Альбом создан из колоды "${deck.name}"`,
      Object.keys(deck.cards || {})[0] // Первая карта как обложка
    );
    
    // Копируем карты в альбом
    const cards = {};
    for (const cardId of Object.keys(deck.cards || {})) {
      cards[cardId] = true;
    }
    
    const userRef = db.collection('users').doc(state.currentUser.uid);
    await userRef.update({
      [`albums.${albumId}.cards`]: cards
    });
    
    ui.showToast(`✅ Колода "${deck.name}" конвертирована в альбом!`, 'success');
    return albumId;
  } catch (e) {
    console.error('Ошибка конвертации колоды в альбом:', e);
    ui.showError('Ошибка конвертации колоды');
    return null;
  }
}

/**
 * Удалить альбом
 */
export async function deleteAlbum(albumId) {
  try {
    if (!state.currentUser) throw new Error('Пользователь не авторизован');
    
    const album = state.currentUser.albums?.[albumId];
    if (!album) throw new Error('Альбом не найден');
    
    const userRef = db.collection('users').doc(state.currentUser.uid);
    await userRef.update({
      [`albums.${albumId}`]: firebase.firestore.FieldValue.delete()
    });
    
    // Если альбом был публичным, удаляем из publicAlbums
    if (album.isPublic) {
      await db.collection('publicAlbums').doc(albumId).delete();
    }
    
    // Удаляем из локального состояния
    delete state.currentUser.albums[albumId];
    
    console.log(`✅ Альбом удалён`);
    return true;
  } catch (e) {
    console.error('Ошибка удаления альбома:', e);
    return false;
  }
}

/**
 * Обновить информацию об альбоме
 */
export async function updateAlbum(albumId, updates) {
  try {
    if (!state.currentUser) throw new Error('Пользователь не авторизован');
    
    const userRef = db.collection('users').doc(state.currentUser.uid);
    const updateData = {};
    
    if (updates.name) updateData[`albums.${albumId}.name`] = updates.name;
    if (updates.description !== undefined) updateData[`albums.${albumId}.description`] = updates.description;
    if (updates.coverImageUrl) updateData[`albums.${albumId}.coverImageUrl`] = updates.coverImageUrl;
    updateData[`albums.${albumId}.updatedAt`] = firebase.firestore.FieldValue.serverTimestamp();
    
    await userRef.update(updateData);
    
    // Обновляем локальное состояние
    Object.assign(state.currentUser.albums[albumId], updates);
    
    // Если альбом публичный, обновляем publicAlbums
    if (state.currentUser.albums[albumId].isPublic) {
      await db.collection('publicAlbums').doc(albumId).update({
        ...updates,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    
    console.log(`✅ Альбом обновлён`);
    return true;
  } catch (e) {
    console.error('Ошибка обновления альбома:', e);
    return false;
  }
}

/**
 * Получить список публичных альбомов
 */
export async function getPublicAlbums(limit = 20) {
  try {
    const snapshot = await db.collection('publicAlbums')
      .orderBy('updatedAt', 'desc')
      .limit(limit)
      .get();
    
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (e) {
    console.error('Ошибка загрузки публичных альбомов:', e);
    return [];
  }
}

/**
 * Получить детали публичного альбома
 */
export async function getPublicAlbumDetails(albumId, userId) {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) throw new Error('Пользователь не найден');
    
    const userData = userDoc.data();
    const album = userData.albums?.[albumId];
    
    if (!album || !album.isPublic) throw new Error('Альбом не найден или не опубликован');
    
    // Увеличиваем счётчик просмотров
    await db.collection('publicAlbums').doc(albumId).update({
      viewCount: firebase.firestore.FieldValue.increment(1)
    });
    
    await db.collection('users').doc(userId).update({
      [`albums.${albumId}.viewCount`]: firebase.firestore.FieldValue.increment(1)
    });
    
    return {
      ...album,
      id: albumId,
      userId,
      userName: userData.displayName || 'Аноним',
      userAvatar: userData.photoURL || ''
    };
  } catch (e) {
    console.error('Ошибка загрузки деталей альбома:', e);
    return null;
  }
}

/**
 * Показать модальное окно создания альбома
 */
export function showCreateAlbumModal(deckIdToConvert = null) {
  const modal = document.createElement('div');
  modal.className = 'modal active';
  modal.id = 'create-album-modal';
  
  const deck = deckIdToConvert ? state.currentUser.decks?.[deckIdToConvert] : null;
  const defaultName = deck ? deck.name : '';
  const defaultDesc = deck ? `Альбом создан из колоды "${deck.name}"` : '';
  
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 500px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h2 style="margin: 0; color: var(--text-accent);">
          ${deckIdToConvert ? '📚→📖 Конвертация в альбом' : '📖 Создать альбом'}
        </h2>
        <button class="modal-close" style="padding: 0; width: 36px; height: 36px; font-size: 24px; background: none; border: none; color: var(--text); cursor: pointer;">×</button>
      </div>
      
      <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--text);">Название альбома</label>
        <input 
          type="text" 
          id="album-name-input"
          placeholder="Например: Импрессионизм XIX века"
          value="${defaultName}"
          style="
            width: 100%;
            padding: 12px;
            background: var(--bg-tertiary);
            border: 1px solid var(--border-light);
            border-radius: 8px;
            color: var(--text);
            font-size: 14px;
            box-sizing: border-box;
          "
        />
      </div>
      
      <div style="margin-bottom: 24px;">
        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--text);">Описание (опционально)</label>
        <textarea 
          id="album-description-input"
          placeholder="Добавьте описание альбома..."
          style="
            width: 100%;
            padding: 12px;
            background: var(--bg-tertiary);
            border: 1px solid var(--border-light);
            border-radius: 8px;
            color: var(--text);
            font-size: 14px;
            resize: vertical;
            min-height: 80px;
            box-sizing: border-box;
          "
        >${defaultDesc}</textarea>
      </div>
      
      ${deckIdToConvert ? `
        <div style="background: #FEF3C7; border: 1px solid #FCD34D; border-radius: 8px; padding: 12px; margin-bottom: 20px;">
          <p style="margin: 0; color: #78350F; font-size: 13px;">
            ℹ️ Все карты из колоды "<strong>${deck.name}</strong>" будут скопированы в альбом.
            Колода останется без изменений.
          </p>
        </div>
      ` : ''}
      
      <div style="display: flex; gap: 12px;">
        <button 
          id="cancel-album-btn"
          style="
            flex: 1;
            padding: 12px;
            background: var(--bg-tertiary);
            color: var(--text);
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            font-size: 14px;
          "
        >
          Отмена
        </button>
        <button 
          id="create-album-btn"
          style="
            flex: 1;
            padding: 12px;
            background: linear-gradient(135deg, #8B5CF6, #6366F1);
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            font-size: 14px;
          "
        >
          ${deckIdToConvert ? 'Конвертировать' : 'Создать альбом'}
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Обработчики
  const closeBtn = modal.querySelector('.modal-close');
  const cancelBtn = modal.querySelector('#cancel-album-btn');
  const createBtn = modal.querySelector('#create-album-btn');
  const nameInput = modal.querySelector('#album-name-input');
  const descInput = modal.querySelector('#album-description-input');
  
  closeBtn.onclick = () => modal.remove();
  cancelBtn.onclick = () => modal.remove();
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  
  createBtn.onclick = async () => {
    const name = nameInput.value.trim();
    if (!name) {
      ui.showError('Введите название альбома');
      return;
    }
    
    createBtn.disabled = true;
    createBtn.textContent = 'Создание...';
    
    try {
      if (deckIdToConvert) {
        await convertDeckToAlbum(deckIdToConvert);
      } else {
        const albumId = await createAlbum(name, descInput.value);
        ui.showToast(`✅ Альбом "${name}" создан!`, 'success');
      }
      
      modal.remove();
      await loadUserAlbums();
      renderAlbumsList();
    } catch (e) {
      ui.showError('Ошибка создания альбома');
      createBtn.disabled = false;
      createBtn.textContent = deckIdToConvert ? 'Конвертировать' : 'Создать альбом';
    }
  };
  
  nameInput.focus();
}

/**
 * Загрузить альбомы пользователя
 */
export async function loadUserAlbums() {
  try {
    if (!state.currentUser?.uid) return;
    
    const userDoc = await db.collection('users').doc(state.currentUser.uid).get();
    if (!userDoc.exists) return;
    
    const userData = userDoc.data();
    state.currentUser.albums = userData.albums || {};
    
    console.log(`✅ Загружено ${Object.keys(state.currentUser.albums).length} альбомов`);
  } catch (e) {
    console.error('Ошибка загрузки альбомов:', e);
  }
}

/**
 * Отобразить список альбомов
 */
export function renderAlbumsList() {
  const container = document.getElementById('albums-container');
  if (!container) return;
  
  const albums = state.currentUser?.albums || {};
  const albumsList = Object.entries(albums).map(([id, album]) => ({ id, ...album }));
  
  if (albumsList.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 60px 20px; color: var(--text-secondary);">
        <p style="font-size: 18px; margin-bottom: 12px;">📖 У вас пока нет альбомов</p>
        <p style="font-size: 14px; margin-bottom: 20px;">Создайте альбом или конвертируйте колоду</p>
        <button 
          onclick="window.albums.showCreateAlbumModal()"
          style="
            padding: 12px 24px;
            background: linear-gradient(135deg, #8B5CF6, #6366F1);
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            font-size: 14px;
          "
        >
          + Создать первый альбом
        </button>
      </div>
    `;
    return;
  }
  
  container.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px;">
      ${albumsList.map(album => renderAlbumCard(album)).join('')}
    </div>
  `;
}

/**
 * Отобразить карточку альбома
 */
function renderAlbumCard(album) {
  const cardCount = Object.keys(album.cards || {}).length;
  const coverImage = album.coverImageUrl || 'https://via.placeholder.com/280x200?text=No+Cover';
  
  return `
    <div 
      class="album-card"
      style="
        background: var(--bg-tertiary);
        border: 1px solid var(--border-light);
        border-radius: 12px;
        overflow: hidden;
        cursor: pointer;
        transition: all 0.3s ease;
      "
      onclick="window.albums.showAlbumDetail('${album.id}')"
    >
      <div style="height: 200px; overflow: hidden; background: var(--bg-secondary);">
        <img 
          src="${coverImage}" 
          alt="${album.name}"
          style="width: 100%; height: 100%; object-fit: cover;"
        />
      </div>
      
      <div style="padding: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
          <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: var(--text-accent); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${album.name}
          </h3>
          ${album.isPublic ? '<span style="font-size: 16px;">🌍</span>' : ''}
        </div>
        
        <p style="margin: 0 0 12px 0; font-size: 13px; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
          ${album.description || 'Нет описания'}
        </p>
        
        <div style="display: flex; gap: 12px; font-size: 12px; color: var(--text-secondary);">
          <span>🎴 ${cardCount} карт${cardCount === 1 ? 'а' : cardCount < 5 ? 'ы' : ''}</span>
          ${album.viewCount ? `<span>👁 ${album.viewCount}</span>` : ''}
        </div>
      </div>
    </div>
  `;
}

/**
 * Показать детали альбома
 */
export function showAlbumDetail(albumId) {
  const album = state.currentUser?.albums?.[albumId];
  if (!album) return;
  
  const cards = Object.keys(album.cards || {}).map(cardId => 
    state.cards.find(c => c.id === cardId)
  ).filter(c => c);
  
  const modal = document.createElement('div');
  modal.className = 'modal active';
  modal.id = 'album-detail-modal';
  
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 900px; max-height: 90vh; overflow-y: auto;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; position: sticky; top: 0; background: var(--bg-secondary); padding: 20px 0 16px 0; z-index: 100; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h2 style="margin: 0; color: var(--text-accent);">${album.name}</h2>
        <button class="modal-close" style="padding: 0; width: 36px; height: 36px; font-size: 24px; background: none; border: none; color: var(--text); cursor: pointer;">×</button>
      </div>
      
      <div style="margin-bottom: 20px;">
        <p style="color: var(--text); line-height: 1.6;">${album.description || 'Нет описания'}</p>
        <div style="display: flex; gap: 16px; margin-top: 12px; font-size: 13px; color: var(--text-secondary);">
          <span>🎴 ${cards.length} карт</span>
          <span>👁 ${album.viewCount || 0} просмотров</span>
          <span>${album.isPublic ? '🌍 Опубликован' : '🔒 Приватный'}</span>
        </div>
      </div>
      
      <div style="display: flex; gap: 8px; margin-bottom: 24px; flex-wrap: wrap;">
        <button 
          onclick="window.albums.toggleAlbumPublic('${albumId}').then(() => { document.getElementById('album-detail-modal').remove(); window.albums.renderAlbumsList(); })"
          style="
            padding: 10px 16px;
            background: ${album.isPublic ? '#EF4444' : '#10B981'};
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            font-size: 13px;
          "
        >
          ${album.isPublic ? '🔒 Снять с публикации' : '🌍 Опубликовать'}
        </button>
        
        <button 
          onclick="window.albums.showEditAlbumModal('${albumId}')"
          style="
            padding: 10px 16px;
            background: var(--bg-tertiary);
            color: var(--text);
            border: 1px solid var(--border-light);
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            font-size: 13px;
          "
        >
          ✏️ Редактировать
        </button>
        
        <button 
          onclick="if(confirm('Удалить альбом \"${album.name}\"?')) { window.albums.deleteAlbum('${albumId}').then(() => { document.getElementById('album-detail-modal').remove(); window.albums.renderAlbumsList(); }); }"
          style="
            padding: 10px 16px;
            background: #EF4444;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            font-size: 13px;
          "
        >
          🗑 Удалить альбом
        </button>
      </div>
      
      <h3 style="font-size: 18px; margin: 0 0 16px 0; color: var(--text-accent);">Карты в альбоме</h3>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 16px;">
        ${cards.map(card => `
          <div style="position: relative;">
            <img 
              src="${card.imageUrl}" 
              alt="${card.title}"
              style="width: 100%; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.2);"
            />
            <button 
              onclick="event.stopPropagation(); window.albums.removeCardFromAlbum('${albumId}', '${card.id}').then(() => window.albums.showAlbumDetail('${albumId}'));"
              style="
                position: absolute;
                top: 8px;
                right: 8px;
                width: 28px;
                height: 28px;
                background: rgba(0,0,0,0.7);
                color: white;
                border: none;
                border-radius: 50%;
                cursor: pointer;
                font-size: 16px;
                display: flex;
                align-items: center;
                justify-content: center;
              "
            >×</button>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  modal.querySelector('.modal-close').onclick = () => modal.remove();
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
}

/**
 * Показать модальное окно редактирования альбома
 */
export function showEditAlbumModal(albumId) {
  const album = state.currentUser?.albums?.[albumId];
  if (!album) return;
  
  document.getElementById('album-detail-modal')?.remove();
  
  const modal = document.createElement('div');
  modal.className = 'modal active';
  modal.id = 'edit-album-modal';
  
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 500px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h2 style="margin: 0; color: var(--text-accent);">✏️ Редактировать альбом</h2>
        <button class="modal-close" style="padding: 0; width: 36px; height: 36px; font-size: 24px; background: none; border: none; color: var(--text); cursor: pointer;">×</button>
      </div>
      
      <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--text);">Название</label>
        <input 
          type="text" 
          id="edit-album-name"
          value="${album.name}"
          style="
            width: 100%;
            padding: 12px;
            background: var(--bg-tertiary);
            border: 1px solid var(--border-light);
            border-radius: 8px;
            color: var(--text);
            font-size: 14px;
            box-sizing: border-box;
          "
        />
      </div>
      
      <div style="margin-bottom: 24px;">
        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--text);">Описание</label>
        <textarea 
          id="edit-album-description"
          style="
            width: 100%;
            padding: 12px;
            background: var(--bg-tertiary);
            border: 1px solid var(--border-light);
            border-radius: 8px;
            color: var(--text);
            font-size: 14px;
            resize: vertical;
            min-height: 80px;
            box-sizing: border-box;
          "
        >${album.description || ''}</textarea>
      </div>
      
      <div style="display: flex; gap: 12px;">
        <button 
          id="cancel-edit-btn"
          style="
            flex: 1;
            padding: 12px;
            background: var(--bg-tertiary);
            color: var(--text);
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            font-size: 14px;
          "
        >
          Отмена
        </button>
        <button 
          id="save-edit-btn"
          style="
            flex: 1;
            padding: 12px;
            background: linear-gradient(135deg, #8B5CF6, #6366F1);
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            font-size: 14px;
          "
        >
          Сохранить
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  const closeBtn = modal.querySelector('.modal-close');
  const cancelBtn = modal.querySelector('#cancel-edit-btn');
  const saveBtn = modal.querySelector('#save-edit-btn');
  
  closeBtn.onclick = () => modal.remove();
  cancelBtn.onclick = () => modal.remove();
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  
  saveBtn.onclick = async () => {
    const name = modal.querySelector('#edit-album-name').value.trim();
    const description = modal.querySelector('#edit-album-description').value.trim();
    
    if (!name) {
      ui.showError('Введите название альбома');
      return;
    }
    
    saveBtn.disabled = true;
    saveBtn.textContent = 'Сохранение...';
    
    const success = await updateAlbum(albumId, { name, description });
    if (success) {
      ui.showToast('✅ Альбом обновлён', 'success');
      modal.remove();
      renderAlbumsList();
    } else {
      ui.showError('Ошибка обновления');
      saveBtn.disabled = false;
      saveBtn.textContent = 'Сохранить';
    }
  };
}

// Экспортируем функции в window для использования в onclick
if (typeof window !== 'undefined') {
  window.albums = {
    showCreateAlbumModal,
    showAlbumDetail,
    showEditAlbumModal,
    toggleAlbumPublic,
    deleteAlbum,
    removeCardFromAlbum,
    renderAlbumsList
  };
}
