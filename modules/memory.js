/**
 * modules/memory.js - Игра "Мемори"
 * Найди парные картины из своей коллекции
 */

import { state } from '../app.js';
import * as ui from './ui.js';

/**
 * Показать игру "Мемори"
 */
export function showMemoryGame() {
  const modal = document.createElement('div');
  modal.className = 'modal active';
  modal.id = 'memory-game-modal';
  modal.style.cssText = 'z-index: 9999;';
  
  let difficulty = 4; // 4 пары = 8 карт
  let cards = [];
  let flippedCards = [];
  let matchedPairs = 0;
  let moves = 0;
  let startTime = Date.now();
  let isProcessing = false;
  
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 900px; max-height: 95vh; overflow-y: auto; padding: 24px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <div>
          <h2 style="margin: 0 0 8px 0; color: var(--text-accent);">🃏 Мемори</h2>
          <p style="margin: 0; font-size: 14px; color: var(--text-secondary);">Найди парные картины</p>
        </div>
        <button class="modal-close" style="padding: 0; width: 36px; height: 36px; font-size: 24px; background: none; border: none; color: var(--text); cursor: pointer;">×</button>
      </div>
      
      <!-- ИНСТРУКЦИЯ -->
      <div style="background: linear-gradient(135deg, #EFF6FF, #DBEAFE); border: 2px solid #3B82F6; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
        <div style="display: flex; align-items: start; gap: 12px;">
          <div style="font-size: 24px; flex-shrink: 0;">ℹ️</div>
          <div>
            <h4 style="margin: 0 0 8px 0; color: #1E40AF; font-size: 14px; font-weight: 700;">Как играть:</h4>
            <ul style="margin: 0; padding-left: 20px; color: #1E3A8A; font-size: 13px; line-height: 1.6;">
              <li><strong>Кликай на карты</strong> чтобы перевернуть их</li>
              <li><strong>Найди пары</strong> одинаковых картин</li>
              <li><strong>Запоминай</strong> расположение карт</li>
              <li><strong>Цель:</strong> найти все пары за минимальное количество ходов</li>
            </ul>
          </div>
        </div>
      </div>
      
      <!-- Статистика -->
      <div style="display: flex; gap: 20px; margin-bottom: 20px; padding: 12px; background: var(--bg-tertiary); border-radius: 8px;">
        <div style="flex: 1; text-align: center;">
          <div style="font-size: 24px; font-weight: 700; color: var(--text-accent);" id="memory-moves">0</div>
          <div style="font-size: 12px; color: var(--text-secondary);">Ходов</div>
        </div>
        <div style="flex: 1; text-align: center;">
          <div style="font-size: 24px; font-weight: 700; color: var(--text-accent);" id="memory-pairs">0 / ${difficulty}</div>
          <div style="font-size: 12px; color: var(--text-secondary);">Пар найдено</div>
        </div>
        <div style="flex: 1; text-align: center;">
          <div style="font-size: 24px; font-weight: 700; color: var(--text-accent);" id="memory-time">00:00</div>
          <div style="font-size: 12px; color: var(--text-secondary);">Время</div>
        </div>
      </div>
      
      <!-- Сложность -->
      <div style="display: flex; gap: 8px; margin-bottom: 20px; justify-content: center; align-items: center;">
        <span style="font-size: 13px; color: var(--text-secondary); font-weight: 600;">Пар:</span>
        <button class="difficulty-btn" data-pairs="4" style="padding: 8px 16px; background: linear-gradient(135deg, #10B981, #059669); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">4 (Легко)</button>
        <button class="difficulty-btn" data-pairs="6" style="padding: 8px 16px; background: var(--bg-tertiary); color: var(--text); border: 1px solid var(--border-light); border-radius: 8px; cursor: pointer; font-weight: 600;">6 (Средне)</button>
        <button class="difficulty-btn" data-pairs="8" style="padding: 8px 16px; background: var(--bg-tertiary); color: var(--text); border: 1px solid var(--border-light); border-radius: 8px; cursor: pointer; font-weight: 600;">8 (Сложно)</button>
        <button class="difficulty-btn" data-pairs="10" style="padding: 8px 16px; background: var(--bg-tertiary); color: var(--text); border: 1px solid var(--border-light); border-radius: 8px; cursor: pointer; font-weight: 600;">10 (Хардкор)</button>
      </div>
      
      <!-- Игровое поле -->
      <div id="memory-grid" style="display: grid; gap: 12px; margin-bottom: 20px;"></div>
      
      <!-- Кнопка -->
      <div style="display: flex; gap: 12px;">
        <button id="restart-btn" style="flex: 1; padding: 12px; background: linear-gradient(135deg, #F59E0B, #D97706); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 14px;">🔄 Новая игра</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  modal.querySelector('.modal-close').onclick = () => modal.remove();
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  
  // Получение уникальных карт из коллекции
  function getUniqueCards() {
    const uniqueMap = new Map();
    
    if (!state.currentUser?.decks) return [];
    
    const decks = state.currentUser.decks;
    for (const deck of Object.values(decks)) {
      if (!deck.cards) continue;
      
      for (const cardId of Object.keys(deck.cards)) {
        const cardInfo = state.cards.find(c => c.id === cardId);
        if (cardInfo && !uniqueMap.has(cardId)) {
          uniqueMap.set(cardId, cardInfo);
        }
      }
    }
    
    return Array.from(uniqueMap.values());
  }
  
  // Инициализация игры
  function initGame(pairs) {
    difficulty = pairs;
    moves = 0;
    matchedPairs = 0;
    flippedCards = [];
    startTime = Date.now();
    
    modal.querySelector('#memory-moves').textContent = '0';
    modal.querySelector('#memory-pairs').textContent = `0 / ${difficulty}`;
    
    const availableCards = getUniqueCards();
    
    if (availableCards.length < difficulty) {
      ui.showToast('❌ Недостаточно карт в коллекции!', 'error');
      return;
    }
    
    // Выбираем случайные карты и дублируем
    const selectedCards = availableCards
      .sort(() => Math.random() - 0.5)
      .slice(0, difficulty);
    
    cards = [];
    selectedCards.forEach((card, index) => {
      cards.push({ ...card, pairId: index, uniqueId: `${index}-a`, flipped: false, matched: false });
      cards.push({ ...card, pairId: index, uniqueId: `${index}-b`, flipped: false, matched: false });
    });
    
    // Перемешиваем
    cards.sort(() => Math.random() - 0.5);
    
    renderGrid();
  }
  
  // Рендер сетки
  function renderGrid() {
    const grid = modal.querySelector('#memory-grid');
    const columns = difficulty <= 4 ? 4 : difficulty <= 6 ? 4 : difficulty <= 8 ? 4 : 5;
    
    grid.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
    
    grid.innerHTML = cards.map(card => `
      <div 
        class="memory-card" 
        data-unique-id="${card.uniqueId}"
        style="
          aspect-ratio: 2/3;
          background: ${card.flipped || card.matched ? `url(${card.imageUrl})` : 'linear-gradient(135deg, #8B5CF6, #7C3AED)'};
          background-size: cover;
          background-position: center;
          border-radius: 12px;
          cursor: ${card.matched ? 'default' : 'pointer'};
          transition: all 0.3s;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
          position: relative;
          transform-style: preserve-3d;
          ${card.matched ? 'opacity: 0.6; filter: grayscale(100%);' : ''}
        "
      >
        ${!card.flipped && !card.matched ? `
          <div style="
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 48px;
          ">🎴</div>
        ` : ''}
      </div>
    `).join('');
    
    // Обработчики кликов
    grid.querySelectorAll('.memory-card').forEach(cardEl => {
      cardEl.addEventListener('click', () => {
        const uniqueId = cardEl.dataset.uniqueId;
        flipCard(uniqueId);
      });
      
      cardEl.addEventListener('mouseenter', () => {
        const card = cards.find(c => c.uniqueId === cardEl.dataset.uniqueId);
        if (!card.matched && !card.flipped) {
          cardEl.style.transform = 'scale(1.05)';
        }
      });
      
      cardEl.addEventListener('mouseleave', () => {
        cardEl.style.transform = 'scale(1)';
      });
    });
  }
  
  // Переворот карты
  function flipCard(uniqueId) {
    if (isProcessing) return;
    
    const card = cards.find(c => c.uniqueId === uniqueId);
    if (!card || card.flipped || card.matched) return;
    
    if (flippedCards.length >= 2) return;
    
    card.flipped = true;
    flippedCards.push(card);
    renderGrid();
    
    if (flippedCards.length === 2) {
      moves++;
      modal.querySelector('#memory-moves').textContent = moves;
      
      isProcessing = true;
      
      setTimeout(() => {
        checkMatch();
        isProcessing = false;
      }, 800);
    }
  }
  
  // Проверка совпадения
  function checkMatch() {
    const [card1, card2] = flippedCards;
    
    if (card1.pairId === card2.pairId) {
      card1.matched = true;
      card2.matched = true;
      matchedPairs++;
      
      modal.querySelector('#memory-pairs').textContent = `${matchedPairs} / ${difficulty}`;
      
      if (matchedPairs === difficulty) {
        setTimeout(() => showVictory(), 500);
      }
    } else {
      card1.flipped = false;
      card2.flipped = false;
    }
    
    flippedCards = [];
    renderGrid();
  }
  
  // Победа
  function showVictory() {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    
    const victoryModal = document.createElement('div');
    victoryModal.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: linear-gradient(135deg, #8B5CF6, #7C3AED);
      padding: 40px;
      border-radius: 20px;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5);
      z-index: 10000;
      animation: bounceIn 0.5s ease;
    `;
    
    victoryModal.innerHTML = `
      <style>
        @keyframes bounceIn {
          0% { transform: translate(-50%, -50%) scale(0.3); opacity: 0; }
          50% { transform: translate(-50%, -50%) scale(1.05); }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
      </style>
      <div style="font-size: 64px; margin-bottom: 16px;">🎉</div>
      <h2 style="margin: 0 0 16px 0; color: white; font-size: 32px;">Победа!</h2>
      <p style="margin: 0 0 8px 0; color: white; font-size: 18px;">Все пары найдены!</p>
      <p style="margin: 0 0 24px 0; color: rgba(255,255,255,0.9); font-size: 14px;">
        Ходов: <strong>${moves}</strong> • Время: <strong>${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}</strong>
      </p>
      <button 
        onclick="this.parentElement.parentElement.remove()"
        style="
          padding: 12px 32px;
          background: white;
          color: #7C3AED;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 700;
          font-size: 16px;
        "
      >Закрыть</button>
    `;
    
    modal.querySelector('.modal-content').appendChild(victoryModal);
    ui.showToast('🎉 Все пары найдены!', 'success');
  }
  
  // Таймер
  const timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    const timeEl = modal.querySelector('#memory-time');
    if (timeEl) {
      timeEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    } else {
      clearInterval(timerInterval);
    }
  }, 1000);
  
  // Новая игра
  modal.querySelector('#restart-btn').onclick = () => {
    initGame(difficulty);
  };
  
  // Переключение сложности
  modal.querySelectorAll('.difficulty-btn').forEach(btn => {
    btn.onclick = () => {
      modal.querySelectorAll('.difficulty-btn').forEach(b => {
        b.style.background = 'var(--bg-tertiary)';
        b.style.color = 'var(--text)';
        b.style.border = '1px solid var(--border-light)';
      });
      btn.style.background = 'linear-gradient(135deg, #10B981, #059669)';
      btn.style.color = 'white';
      btn.style.border = 'none';
      
      initGame(parseInt(btn.dataset.pairs));
    };
  });
  
  // Инициализация
  initGame(4);
}
