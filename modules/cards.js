/**
 * cards.js - Управление картами
 */

import { state, openModal, closeModal } from '../app.js';
import * as ui from './ui.js';
import * as decks from './decks.js';

// Функция загрузки карт
export async function loadCards() {
  try {
    const u = state.currentUser;
    if (!u) return;
    
    const db = firebase.firestore();
    const cardsRef = db.collection('cards');
    const snap = await cardsRef.get();
    
    state.cards = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    console.log('📚 Cards loaded:', state.cards.length);
  } catch (e) {
    console.error('Error loading cards:', e);
  }
}

// Рендеринг коллекции
export function renderCollection() {
  const container = document.getElementById('cards-grid');
  if (!container) return;
  
  const rarity = document.getElementById('rarity-filter')?.value || '';
  const filtered = rarity ? state.cards.filter(c => c.rarity === rarity) : state.cards;
  
  container.innerHTML = filtered.map(card => `
    <div class="card-item" data-card-id="${card.id}">
      <img src="${card.imageUrl || 'placeholder.png'}" alt="${card.title}" style="width:100%; border-radius:8px; cursor:pointer;">
      <div style="font-size:0.8em; margin-top:5px; color:#a0a0a0;">${card.title}</div>
    </div>
  `).join('');
  
  container.querySelectorAll('.card-item').forEach(el => {
    el.addEventListener('click', () => showCardModal(el.dataset.cardId));
  });
}

// Модальное окно карты
function showCardModal(cardId) {
  const card = state.cards.find(c => c.id === cardId);
  if (!card) return;
  
  document.getElementById('modal-card-title').textContent = card.title || '-';
  document.getElementById('modal-image').src = card.imageUrl || 'placeholder.png';
  document.getElementById('modal-artist').textContent = card.artist || '-';
  document.getElementById('modal-year').textContent = card.year || '-';
  document.getElementById('modal-rarity').textContent = card.rarity || '-';
  
  const container = document.getElementById('card-actions');
  container.innerHTML = '';
  renderCardActionButtons(cardId, container);
  
  openModal('card-modal');
}

/**
 * Кнопки действия с картой
 */
function renderCardActionButtons(cardId, container) {
  if (decks.activeDeckId) {
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn';
    removeBtn.style.cssText = 'width:100%; background:#666; color:white; border:none; cursor:pointer; font-weight:600; padding:10px; border-radius:6px;';
    removeBtn.textContent = '🗑 Удалить из колоды';
    removeBtn.onclick = async () => {
      const success = await decks.removeCardFromActiveDeck(cardId);
      if (success) {
        ui.showToast('✅ Удалено из колоды', 'success');
        closeModal('card-detail-modal');
        decks.renderDecks();
        renderCollection();
      } else {
        ui.showError('Ошибка');
      }
    };
    container.appendChild(removeBtn);
  }
  
  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'btn';
  deleteBtn.style.cssText = 'width:100%; background:#ef4444; color:white; border:none; cursor:pointer; font-weight:600; padding:10px; border-radius:6px;';
  deleteBtn.textContent = '⚠️ ПОРВАТЬ НАВСЕГДА';
  deleteBtn.onclick = async () => {
    const u = state.currentUser;
    const decksObj = u.decks || {};
    let totalCount = 0;
    for (const deck of Object.values(decksObj)) {
      if (deck.cards && deck.cards[cardId]) {
        totalCount += deck.cards[cardId];
      }
    }
    
    if (totalCount === 0) {
      ui.showError('Карта не найдена в коллекции');
      return;
    }
    
    const countToDelete = prompt(
      `Выберите кол-во копий для удаления\n\nВсего копий: ${totalCount}\n\nВведите количество (или 0 для удаления ВСЕХ):`,
      '1'
    );
    
    if (countToDelete === null) return;
    
    let deleteCount = parseInt(countToDelete, 10);
    
    if (deleteCount === 0) deleteCount = totalCount;
    
    if (isNaN(deleteCount) || deleteCount <= 0 || deleteCount > totalCount) {
      ui.showError(`❌ Ошибка: введите число от 1 до ${totalCount}`);
      return;
    }
    
    const confirm1 = confirm(
      `⚠️ Порвать ${deleteCount}/${totalCount} копий этой карты?\n\nЭто удалит карту из ВСЕХ колод!`
    );
    if (!confirm1) return;
    
    if (deleteCount < totalCount) {
      const confirm2 = confirm(
        `⏰ Подтвердите: удалить ровно ${deleteCount} копий (останется ${totalCount - deleteCount})?`
      );
      if (!confirm2) return;
    } else {
      const confirm2 = confirm(
        `⚠️ ПОСЛЕДНЕЕ ПОПИНАНИЕ: удалить ВСЕ ${totalCount} копий карты НАВСЕГДА?`
      );
      if (!confirm2) return;
    }
    
    const success = await deleteCardPartially(cardId, deleteCount);
    if (success) {
      ui.showToast(`✅ Удалено ${deleteCount} копий`, 'success');
      closeModal('card-detail-modal');
      await decks.loadDecks();
      decks.renderDecks();
      renderCollection();
    } else {
      ui.showError('Ошибка при удалении');
    }
  };
  container.appendChild(deleteBtn);
}

async function deleteCardPartially(cardId, countToDelete) {
  try {
    const u = state.currentUser;
    if (!u) return false;
    
    const db = firebase.firestore();
    const decksObj = u.decks || {};
    let remainingToDelete = countToDelete;
    
    for (const [deckId, deck] of Object.entries(decksObj)) {
      if (!deck.cards || !deck.cards[cardId]) continue;
      
      const countInDeck = deck.cards[cardId];
      const toRemove = Math.min(countInDeck, remainingToDelete);
      
      deck.cards[cardId] -= toRemove;
      remainingToDelete -= toRemove;
      
      if (deck.cards[cardId] <= 0) {
        delete deck.cards[cardId];
      }
      
      await db.collection('users').doc(u.uid)
        .collection('decks').doc(deckId)
        .update({ cards: deck.cards });
      
      if (remainingToDelete === 0) break;
    }
    
    await decks.loadDecks();
    return true;
  } catch (e) {
    console.error('Error deleting card partially:', e);
    return false;
  }
}

export { closeModal };
