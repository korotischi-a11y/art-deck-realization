/**
 * modules/cards.js - Карты и коллекция
 */

import { state, closeModal, openModal } from '../app.js';
import * as ui from './ui.js';
import * as decks from './decks.js';

const db = firebase.firestore();

/**
 * Загружает карты из мастер-коллекции
 */
export async function loadCards() {
  console.log('🎠 Loading cards...');
  try {
    const snap = await db.collection('masterCards')
      .orderBy('createdAt', 'desc')
      .limit(1000)
      .get();
    
    state.cards = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log(`✅ Loaded ${state.cards.length} cards`);
  } catch (e) {
    console.error('Error loading cards:', e);
    ui.showError('Error loading cards');
  }
}

/**
 * Получить карту по ID
 */
function getCard(cardId) {
  return state.cards.find(c => c.id === cardId);
}

/**
 * ПРАВНЛЫЕ ЛОГИКА СЧЁТЧИКОВ
 * ВСЕГО = сумма карт ВО ВСЕХ КОЛОДАХ (включая сброс)
 * УНИКАЛЬНЫЕ = разные cardId ВО ВСЕХ КОЛОДАХ (включая сброс)
 */
function calculateStats() {
  const decksObj = state.currentUser?.decks || {};
  
  let totalInAllDecks = 0;
  const uniqueCardIds = new Set();
  
  for (const deck of Object.values(decksObj)) {
    for (const [cardId, count] of Object.entries(deck.cards || {})) {
      totalInAllDecks += count;
      uniqueCardIds.add(cardId);
    }
  }
  
  return { 
    total: totalInAllDecks,
    unique: uniqueCardIds.size
  };
}

/**
 * Определяет кол-во и доступность карты в колодах
 */
function getCardStatsInDecks(cardId) {
  const decksObj = state.currentUser?.decks || {};
  const inDecks = [];
  let totalInAllDecks = 0;
  
  for (const [deckId, deck] of Object.entries(decksObj)) {
    if (deck.isDiscardDeck) continue;
    const count = deck.cards?.[cardId] || 0;
    if (count > 0) {
      inDecks.push({ name: deck.name, count, deckId });
      totalInAllDecks += count;
    }
  }
  
  return {
    inDecks,
    inDecksTotal: totalInAllDecks
  };
}

/**
 * Рендерит коллекцию карт (всю или активную колоду)
 */
export function renderCollection() {
  const grid = document.getElementById('cards-grid');
  const filter = document.getElementById('rarity-filter')?.value || '';
  
  grid.innerHTML = '';

  let userCardIds;
  let title = 'Вся коллекция';
  const viewingDeck = decks.activeDeckId && state.currentUser?.decks?.[decks.activeDeckId];
  
  if (viewingDeck && !viewingDeck.isDiscardDeck) {
    userCardIds = Object.keys(viewingDeck.cards || {});
    title = `🎴 ${viewingDeck.name}`;
  } else if (viewingDeck && viewingDeck.isDiscardDeck) {
    userCardIds = Object.keys(viewingDeck.cards || {});
    title = `🗑 Карты без колод`;
  } else {
    const decksObj = state.currentUser?.decks || {};
    const allCardIds = new Set();
    for (const deck of Object.values(decksObj)) {
      for (const cardId of Object.keys(deck.cards || {})) {
        allCardIds.add(cardId);
      }
    }
    userCardIds = Array.from(allCardIds);
  }
  
  let headerEl = document.getElementById('collection-deck-title');
  if (!headerEl) {
    headerEl = document.createElement('div');
    headerEl.id = 'collection-deck-title';
    headerEl.style.cssText = 'font-size:16px; font-weight:700; color:var(--text-accent); margin-bottom:12px;';
    grid.parentElement.insertBefore(headerEl, grid);
  }
  headerEl.textContent = title;
  
  let cards = userCardIds.map(id => getCard(id)).filter(c => c);
  
  if (filter) cards = cards.filter(c => c.rarity === filter);

  if (!cards.length) {
    grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; color:var(--text-secondary); padding:40px;">🤷 No cards found</div>';
    updateStats();
    return;
  }

  cards.forEach(card => {
    let countInDisplay = 0;
    
    if (decks.activeDeckId) {
      const deck = state.currentUser?.decks?.[decks.activeDeckId];
      countInDisplay = deck?.cards?.[card.id] || 0;
    } else {
      const decksObj = state.currentUser?.decks || {};
      for (const deck of Object.values(decksObj)) {
        countInDisplay += deck.cards?.[card.id] || 0;
      }
    }
    
    const el = createCardElement(card, countInDisplay);
    grid.appendChild(el);
  });

  updateStats();
  initTiltEffect();
}

/**
 * Создаят элемент карты
 */
function createCardElement(card, count) {
  const div = document.createElement('div');
  div.className = 'card-item';
  div.setAttribute('data-tilt', 'true');
  div.setAttribute('data-card-id', card.id);
  div.setAttribute('data-rarity', card.rarity);
  div.style.cursor = 'pointer';
  
  const rarity = ui.getRarityBadge(card.rarity);
  const params = `💓${card.power?.resonance || 0} 🎯${card.power?.virtuosity || 0} 🧠${card.power?.profundity || 0} ⚖${card.power?.harmony || 0}`;
  
  div.innerHTML = `
    <div class="card-image" style="position:relative; overflow:hidden;">
      <div style="position:absolute; top:0; left:0; right:0; padding:6px 4px; background:rgba(50, 50, 50, 0.9); font-size:10px; font-weight:600; color:#d0d0d0; text-shadow:0 1px 3px rgba(0,0,0,0.95); z-index:10; border-bottom:1px solid rgba(200,200,200,0.15);">${params}</div>
      <div style="position:absolute; top:4px; right:4px; z-index:11; background:rgba(30,30,30,0.8); padding:3px 6px; border-radius:4px; font-size:11px; font-weight:600; color:${rarity.color}; border:1px solid ${rarity.color};">${count}</div>
      ${card.imageUrl ? `<img src="${card.imageUrl}" alt="${card.title}" style="width:100%; height:100%; object-fit:cover; object-position:center;" />` : '🎨'}
    </div>
    <div class="card-body" style="display:flex; flex-direction:column; min-height:0;">
      <div class="card-title" style="flex:1; overflow:hidden; display:flex; align-items:center; font-size:clamp(6px, 2.8vw, 11px); word-break:break-word; line-height:1.2;">${ui.sanitizeHTML(card.title)}</div>
      <div style="display:flex; justify-content:space-between; font-size:10px; color:var(--text-secondary); margin-bottom:6px; min-height:14px;">
        <span style="overflow:hidden; text-overflow:ellipsis;">${ui.sanitizeHTML(card.artist)}</span>
        <span>${card.year}</span>
      </div>
      <div class="card-rarity" style="background:${rarity.color}15; border-color:${rarity.color}; color:${rarity.color}; white-space:nowrap; text-align:center; font-size:10px;">
        ${rarity.emoji} ${rarity.name}
      </div>
    </div>
  `;
  
  div.style.borderColor = rarity.color;
  div.addEventListener('click', () => showCardDetail(card, count));
  
  return div;
}

/**
 * Инициализирует 3D Tilt
 */
function initTiltEffect() {
  const cards = document.querySelectorAll('[data-tilt="true"]');
  console.log(`🔮 Init tilt for ${cards.length} cards`);
  
  cards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const rotX = ((y - cy) / cy) * 8;
      const rotY = ((cx - x) / cx) * 8;
      card.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg)`;
      card.classList.add('tilt-active');
      card.style.setProperty('--glare-x', `${(x / rect.width) * 100}%`);
      card.style.setProperty('--glare-y', `${(y / rect.height) * 100}%`);
    });
    
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'rotateX(0deg) rotateY(0deg)';
      card.classList.remove('tilt-active');
    });
  });
}

/**
 * Показывает модальное окно карты
 */
function showCardDetail(card, count) {
  const modal = document.getElementById('card-detail-modal');
  if (!modal) { console.error('Modal not found'); return; }
  
  const rarity = ui.getRarityBadge(card.rarity);
  const cardStats = getCardStatsInDecks(card.id);
  
  const titleEl = document.getElementById('modal-card-title');
  const artistEl = document.getElementById('modal-card-artist');
  const yearEl = document.getElementById('modal-card-year');
  const imgEl = document.getElementById('modal-card-image');
  const rarityDiv = document.getElementById('modal-card-rarity');
  const descEl = document.getElementById('modal-card-description');
  const countEl = document.getElementById('modal-card-count');
  const paramsTable = document.getElementById('modal-params-table');
  
  if (!titleEl) { console.error('Modal elements not found'); return; }
  
  titleEl.textContent = card.title;
  artistEl.textContent = card.artist;
  yearEl.textContent = `Year: ${card.year}`;
  
  imgEl.src = card.imageUrl || '';
  imgEl.style.cursor = 'pointer';
  imgEl.onclick = () => openFullscreenImage(card.imageUrl);
  
  rarityDiv.innerHTML = `${rarity.emoji} ${rarity.name}`;
  rarityDiv.style.backgroundColor = `${rarity.color}15`;
  rarityDiv.style.borderColor = rarity.color;
  rarityDiv.style.color = rarity.color;
  
  descEl.textContent = card.description || 'Нет описания';
  
  let countHTML = `<strong>🎁 В активной колоде:</strong> ${count} копий`;
  
  if (cardStats.inDecksTotal > 0 && cardStats.inDecks.length > 0) {
    countHTML += `<div style="font-size:11px; color:var(--text-secondary); margin-top:6px;">`;
    cardStats.inDecks.forEach(d => {
      countHTML += `• ${d.name}: ${d.count}<br/>`;
    });
    countHTML += '</div>';
  }
  
  countEl.innerHTML = countHTML;
  
  paramsTable.innerHTML = '';
  const params = [
    { name: '💓 Resonance', value: card.power?.resonance || 0, color: 'var(--resonance)' },
    { name: '🎯 Virtuosity', value: card.power?.virtuosity || 0, color: 'var(--virtuosity)' },
    { name: '🧠 Profundity', value: card.power?.profundity || 0, color: 'var(--profundity)' },
    { name: '⚖ Harmony', value: card.power?.harmony || 0, color: 'var(--harmony)' }
  ];
  
  params.forEach(p => {
    const cell = document.createElement('div');
    cell.className = 'modal-param-cell';
    cell.innerHTML = `
      <div class="modal-param-label" style="color:${p.color};">${p.name}</div>
      <div class="modal-param-value">${p.value}/10</div>
      <div class="modal-param-bar">
        <div class="modal-param-bar-fill" style="background:${p.color}; width:${(p.value/10)*100}%;"></div>
      </div>
    `;
    paramsTable.appendChild(cell);
  });
  
  const oldButtonContainer = document.getElementById('modal-buttons-container');
  if (oldButtonContainer) oldButtonContainer.remove();
  
  const buttonContainer = document.createElement('div');
  buttonContainer.id = 'modal-buttons-container';
  buttonContainer.style.cssText = 'display: flex; flex-direction: column; gap: 8px; margin-top: 16px;';
  
  const modalContent = document.querySelector('.modal-content');
  if (modalContent) {
    const closeBtnDiv = document.querySelector('.modal-close');
    if (closeBtnDiv && closeBtnDiv.parentElement === modalContent) {
      modalContent.insertBefore(buttonContainer, closeBtnDiv.nextSibling);
    } else {
      modalContent.appendChild(buttonContainer);
    }
  }
  
  renderDeckSelector(card.id, count, buttonContainer);
  renderCardActionButtons(card.id, count, buttonContainer);
  
  openModal('card-detail-modal');
}

/**
 * 🔥 НОВОЕ: Рендерит селектор колод + выбор кол-во для ПЕРЕНОСА
 * Логика: перемещает N копий ИЗ активной колоды В выбранную
 * Без копирования — чистый перенос!
 */
function renderDeckSelector(cardId, countInActive, container) {
  const decksList = decks.getDecksForDropdown();
  
  if (!decksList.length) {
    const emptyDiv = document.createElement('div');
    emptyDiv.style.cssText = 'color:var(--text-secondary); font-size:12px; padding:8px;';
    emptyDiv.textContent = '📂 Нет колод';
    container.appendChild(emptyDiv);
    return;
  }

  // Если активная колода это Сброс — позволяем перенести
  const isFromDiscard = decks.activeDeckId && state.currentUser?.decks?.[decks.activeDeckId]?.isDiscardDeck;
  
  if (!isFromDiscard && countInActive === 0) {
    const emptyDiv = document.createElement('div');
    emptyDiv.style.cssText = 'color:var(--text-secondary); font-size:12px; padding:8px;';
    emptyDiv.textContent = '⚠ Карты нет в активной колоде';
    container.appendChild(emptyDiv);
    return;
  }
  
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';
  
  // Селектор колод
  const selectWrapper = document.createElement('div');
  selectWrapper.style.cssText = 'display: flex; gap: 8px; align-items: center;';
  
  const select = document.createElement('select');
  select.id = 'deck-choice';
  select.style.cssText = 'flex: 1; padding:8px; background:var(--bg-tertiary); border:1px solid var(--border-light); color:var(--text); border-radius:6px; font-size:13px;';
  
  decksList.forEach(d => {
    const option = document.createElement('option');
    option.value = d.id;
    option.textContent = d.name;
    select.appendChild(option);
  });
  
  selectWrapper.appendChild(select);
  wrapper.appendChild(selectWrapper);
  
  // Инпут для выбора кол-во
  const quantityWrapper = document.createElement('div');
  quantityWrapper.style.cssText = 'display: flex; gap: 8px; align-items: center;';
  
  const quantityLabel = document.createElement('label');
  quantityLabel.textContent = '📦 Кол-во:';
  quantityLabel.style.cssText = 'font-size:13px; font-weight:600; min-width:80px;';
  
  const quantityInput = document.createElement('input');
  quantityInput.type = 'number';
  quantityInput.id = 'move-quantity-input';
  quantityInput.value = '1';
  quantityInput.min = '1';
  quantityInput.max = countInActive;
  quantityInput.style.cssText = 'flex:1; padding:8px; background:var(--bg-tertiary); border:1px solid var(--border-light); color:var(--text); border-radius:6px; font-size:13px;';
  
  quantityWrapper.appendChild(quantityLabel);
  quantityWrapper.appendChild(quantityInput);
  wrapper.appendChild(quantityWrapper);
  
  // Кнопка переноса
  const moveBtn = document.createElement('button');
  moveBtn.type = 'button';
  moveBtn.className = 'btn btn-primary';
  moveBtn.style.cssText = 'width:100%; padding:10px; font-size:13px; font-weight:600; border:none; cursor:pointer; border-radius:6px;';
  moveBtn.textContent = '🔄 Перенести в колоду';
  
  moveBtn.onclick = async () => {
    const targetDeckId = select.value;
    const quantity = parseInt(quantityInput.value, 10);
    
    if (!targetDeckId) {
      ui.showError('Выберите целевую колоду');
      return;
    }
    
    if (isNaN(quantity) || quantity < 1 || quantity > countInActive) {
      ui.showError(`Количество должно быть от 1 до ${countInActive}`);
      return;
    }
    
    // Уточнение: из какой колоды в какую?
    let sourceDecId = decks.activeDeckId;
    
    if (!sourceDecId) {
      ui.showError('❌ Активная колода не выбрана');
      return;
    }
    
    // Переносим карту: из активной В выбранную
    const success = await decks.moveCardBetweenDecks(cardId, sourceDecId, targetDeckId, quantity);
    
    if (success) {
      const targetDeckName = select.options[select.selectedIndex].text;
      ui.showToast(`✅ Перенесено ${quantity} копия/копий в "${targetDeckName}"!`, 'success');
      closeModal('card-detail-modal');
      await decks.loadDecks();
      decks.renderDecks();
      renderCollection();
    } else {
      ui.showError('❌ Ошибка: нет карты в активной колоде или целевая колода не найдена');
    }
  };
  
  wrapper.appendChild(moveBtn);
  container.appendChild(wrapper);
}

/**
 * Кнопки действия с картой
 */
function renderCardActionButtons(cardId, currentCount, container) {
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
  deleteBtn.textContent = '⚠️ ПОРВАТЬ';
  deleteBtn.onclick = () => {
    // Открываем модаль для выбора кол-ва
    openTearCardModal(cardId, currentCount);
  };
  container.appendChild(deleteBtn);
}

/**
 * Открывает модаль для выбора количества карт к удалению
 */
function openTearCardModal(cardId, maxCount) {
  const modal = document.getElementById('tear-card-modal');
  if (!modal) {
    console.error('Модаль tear-card-modal не найдена!');
    return;
  }

  // Устанавливаем макс количество
  const availableEl = document.getElementById('tear-available-count');
  const inputEl = document.getElementById('tear-quantity-input');
  const confirmBtn = document.getElementById('tear-confirm-btn');
  const cancelBtn = document.getElementById('tear-cancel-btn');

  if (availableEl) availableEl.textContent = maxCount;
  if (inputEl) {
    inputEl.value = '1';
    inputEl.max = maxCount;
  }

  // Обработчик для кнопки в ПОРВАТЬ
  confirmBtn.onclick = async () => {
    const quantity = parseInt(inputEl.value, 10);

    if (isNaN(quantity) || quantity < 1 || quantity > maxCount) {
      ui.showError(`Количество должно быть от 1 до ${maxCount}`);
      return;
    }

    // Подтверждение
    const confirm1 = confirm(`⚠️ Это ПОРВЕТ ${quantity} копию/копий карты из ВСЕХ колод и коллекции!\n\nВы уверены?`);
    if (!confirm1) return;

    const confirm2 = confirm(`⚠️ ПОСЛЕДНЕЕ ПОПИНАНИЕ: реально ПОРВАТЬ ${quantity}?`);
    if (!confirm2) return;

    // Удаляем карты
    const success = await decks.deleteCardFromCollectionQuantity(cardId, quantity);
    if (success) {
      ui.showToast(`✅ Карта ${quantity} копия/копий разтерта в клочья!`, 'success');
      closeModal('tear-card-modal');
      closeModal('card-detail-modal');
      await decks.loadDecks();
      decks.renderDecks();
      renderCollection();
    } else {
      ui.showError('Ошибка при удалении');
    }
  };

  cancelBtn.onclick = () => {
    closeModal('tear-card-modal');
  };

  // Открываем модаль
  openModal('tear-card-modal');
}

/**
 * Открывает расширенную картинку
 */
function openFullscreenImage(imageUrl) {
  if (!imageUrl) return;
  let modal = document.getElementById('modal-fullscreen-image');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-fullscreen-image';
    modal.className = 'modal-fullscreen-image';
    modal.innerHTML = '<button class="modal-fullscreen-close">✗</button><img src="" alt="fullscreen" />';
    modal.querySelector('.modal-fullscreen-close').onclick = () => modal.style.display = 'none';
    modal.onclick = (e) => e.target === modal && (modal.style.display = 'none');
    document.body.appendChild(modal);
  }
  modal.querySelector('img').src = imageUrl;
  modal.style.display = 'flex';
}

/**
 * Обновляет статистику
 */
function updateStats() {
  const { total, unique } = calculateStats();
  const maxRating = calculateMaxRating();
  
  const totalEl = document.getElementById('stat-total-cards');
  const uniqueEl = document.getElementById('stat-unique-cards');
  const ratingEl = document.getElementById('max-rating');
  
  if (totalEl) totalEl.textContent = total;
  if (uniqueEl) uniqueEl.textContent = unique;
  if (ratingEl) ratingEl.textContent = Math.round(maxRating);
}

/**
 * Определяет макс рейтинг
 */
function calculateMaxRating() {
  const decksObj = state.currentUser?.decks || {};
  const ratings = Object.values(decksObj).map(d => {
    const total = Object.values(d.cards || {}).reduce((a, b) => a + b, 0);
    const unique = Object.keys(d.cards || {}).length;
    if (total === 0) return 0;
    return (unique / total) * 100 + unique * 10;
  });
  return Math.max(...ratings, 0);
}

export { initTiltEffect };
