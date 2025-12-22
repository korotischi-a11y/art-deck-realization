/**
 * modules/puzzle.js - Мини-игра "Пазл"
 * Собери картину из фрагментов
 */

import * as ui from './ui.js';

/**
 * Показать игру "Пазл" для конкретной картины
 */
export function showPuzzleGame(card) {
  const modal = document.createElement('div');
  modal.className = 'modal active';
  modal.id = 'puzzle-game-modal';
  modal.style.cssText = 'z-index: 9999;';
  
  const difficulty = 3; // Начинаем с 3x3
  let gridSize = difficulty;
  let moves = 0;
  let startTime = Date.now();
  let tiles = [];
  let emptyIndex = gridSize * gridSize - 1;
  
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 800px; max-height: 95vh; overflow-y: auto; padding: 24px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <div>
          <h2 style="margin: 0 0 8px 0; color: var(--text-accent);">🧩 Пазл: ${card.title}</h2>
          <p style="margin: 0; font-size: 14px; color: var(--text-secondary);">${card.artist}, ${card.year}</p>
        </div>
        <button class="modal-close" style="padding: 0; width: 36px; height: 36px; font-size: 24px; background: none; border: none; color: var(--text); cursor: pointer;">×</button>
      </div>
      
      <!-- Статистика -->
      <div style="display: flex; gap: 20px; margin-bottom: 20px; padding: 12px; background: var(--bg-tertiary); border-radius: 8px;">
        <div style="flex: 1; text-align: center;">
          <div style="font-size: 24px; font-weight: 700; color: var(--text-accent);" id="puzzle-moves">0</div>
          <div style="font-size: 12px; color: var(--text-secondary);">Ходов</div>
        </div>
        <div style="flex: 1; text-align: center;">
          <div style="font-size: 24px; font-weight: 700; color: var(--text-accent);" id="puzzle-time">00:00</div>
          <div style="font-size: 12px; color: var(--text-secondary);">Время</div>
        </div>
        <div style="flex: 1; text-align: center;">
          <div style="font-size: 24px; font-weight: 700; color: var(--text-accent);">${gridSize}×${gridSize}</div>
          <div style="font-size: 12px; color: var(--text-secondary);">Сложность</div>
        </div>
      </div>
      
      <!-- Сложность -->
      <div style="display: flex; gap: 8px; margin-bottom: 20px; justify-content: center;">
        <button class="difficulty-btn" data-size="3" style="padding: 8px 16px; background: linear-gradient(135deg, #10B981, #059669); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">3×3</button>
        <button class="difficulty-btn" data-size="4" style="padding: 8px 16px; background: var(--bg-tertiary); color: var(--text); border: 1px solid var(--border-light); border-radius: 8px; cursor: pointer; font-weight: 600;">4×4</button>
        <button class="difficulty-btn" data-size="5" style="padding: 8px 16px; background: var(--bg-tertiary); color: var(--text); border: 1px solid var(--border-light); border-radius: 8px; cursor: pointer; font-weight: 600;">5×5</button>
      </div>
      
      <!-- Игровое поле -->
      <div style="display: flex; gap: 20px; flex-wrap: wrap; justify-content: center;">
        <!-- Превью оригинала -->
        <div style="flex: 0 0 auto;">
          <div style="margin-bottom: 8px; font-size: 12px; color: var(--text-secondary); text-align: center;">Оригинал</div>
          <img src="${card.imageUrl}" alt="Оригинал" style="width: 150px; height: 150px; object-fit: cover; border-radius: 8px; opacity: 0.5; border: 2px solid var(--border-light);" />
        </div>
        
        <!-- Пазл -->
        <div style="flex: 1; min-width: 300px; max-width: 500px;">
          <div id="puzzle-grid" style="
            display: grid;
            grid-template-columns: repeat(${gridSize}, 1fr);
            gap: 2px;
            background: var(--bg-primary);
            padding: 4px;
            border-radius: 12px;
            aspect-ratio: 1;
            width: 100%;
            max-width: 500px;
            margin: 0 auto;
          "></div>
        </div>
      </div>
      
      <!-- Кнопки управления -->
      <div style="display: flex; gap: 12px; margin-top: 20px;">
        <button id="shuffle-btn" style="flex: 1; padding: 12px; background: linear-gradient(135deg, #F59E0B, #D97706); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 14px;">🔀 Перемешать</button>
        <button id="hint-btn" style="flex: 1; padding: 12px; background: linear-gradient(135deg, #8B5CF6, #7C3AED); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 14px;">💡 Подсказка</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Закрытие модалки
  modal.querySelector('.modal-close').onclick = () => modal.remove();
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  
  // Инициализация игры
  function initPuzzle(size) {
    gridSize = size;
    moves = 0;
    startTime = Date.now();
    emptyIndex = gridSize * gridSize - 1;
    
    // Обновляем сложность в UI
    modal.querySelector('#puzzle-moves').textContent = '0';
    modal.querySelector('.modal-content h2').nextElementSibling.nextElementSibling.children[2].children[0].textContent = `${gridSize}×${gridSize}`;
    
    // Создаём плитки
    tiles = Array.from({ length: gridSize * gridSize }, (_, i) => i);
    
    // Обновляем grid
    const grid = modal.querySelector('#puzzle-grid');
    grid.style.gridTemplateColumns = `repeat(${gridSize}, 1fr)`;
    
    renderPuzzle();
    shuffle();
  }
  
  // Рендер пазла
  function renderPuzzle() {
    const grid = modal.querySelector('#puzzle-grid');
    const tileSize = 100 / gridSize;
    
    grid.innerHTML = tiles.map((tileIndex, position) => {
      const row = Math.floor(tileIndex / gridSize);
      const col = tileIndex % gridSize;
      const isEmpty = tileIndex === gridSize * gridSize - 1;
      
      return `
        <div 
          class="puzzle-tile"
          data-position="${position}"
          style="
            aspect-ratio: 1;
            background: ${isEmpty ? 'var(--bg-tertiary)' : `url(${card.imageUrl})`};
            background-size: ${gridSize * 100}%;
            background-position: ${col * tileSize}% ${row * tileSize}%;
            border-radius: 4px;
            cursor: ${isEmpty ? 'default' : 'pointer'};
            transition: all 0.2s ease;
            border: 2px solid ${isEmpty ? 'var(--border-light)' : 'rgba(255,255,255,0.3)'};
            box-shadow: ${isEmpty ? 'inset 0 2px 4px rgba(0,0,0,0.1)' : '0 2px 4px rgba(0,0,0,0.2)'};
          "
        ></div>
      `;
    }).join('');
    
    // Добавляем обработчики кликов
    grid.querySelectorAll('.puzzle-tile').forEach(tile => {
      tile.addEventListener('click', () => {
        const position = parseInt(tile.dataset.position);
        moveTile(position);
      });
      
      tile.addEventListener('mouseenter', () => {
        if (canMove(parseInt(tile.dataset.position))) {
          tile.style.transform = 'scale(1.05)';
        }
      });
      
      tile.addEventListener('mouseleave', () => {
        tile.style.transform = 'scale(1)';
      });
    });
  }
  
  // Проверка возможности хода
  function canMove(position) {
    const emptyRow = Math.floor(emptyIndex / gridSize);
    const emptyCol = emptyIndex % gridSize;
    const posRow = Math.floor(position / gridSize);
    const posCol = position % gridSize;
    
    return (Math.abs(emptyRow - posRow) === 1 && emptyCol === posCol) ||
           (Math.abs(emptyCol - posCol) === 1 && emptyRow === posRow);
  }
  
  // Перемещение плитки
  function moveTile(position) {
    if (!canMove(position)) return;
    
    [tiles[position], tiles[emptyIndex]] = [tiles[emptyIndex], tiles[position]];
    emptyIndex = position;
    moves++;
    
    modal.querySelector('#puzzle-moves').textContent = moves;
    renderPuzzle();
    
    if (isSolved()) {
      setTimeout(() => showVictory(), 300);
    }
  }
  
  // Перемешивание
  function shuffle() {
    for (let i = 0; i < gridSize * gridSize * 10; i++) {
      const neighbors = getNeighbors(emptyIndex);
      const randomNeighbor = neighbors[Math.floor(Math.random() * neighbors.length)];
      [tiles[randomNeighbor], tiles[emptyIndex]] = [tiles[emptyIndex], tiles[randomNeighbor]];
      emptyIndex = randomNeighbor;
    }
    renderPuzzle();
  }
  
  // Получить соседей пустой клетки
  function getNeighbors(index) {
    const neighbors = [];
    const row = Math.floor(index / gridSize);
    const col = index % gridSize;
    
    if (row > 0) neighbors.push(index - gridSize);
    if (row < gridSize - 1) neighbors.push(index + gridSize);
    if (col > 0) neighbors.push(index - 1);
    if (col < gridSize - 1) neighbors.push(index + 1);
    
    return neighbors;
  }
  
  // Проверка решения
  function isSolved() {
    return tiles.every((tile, index) => tile === index);
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
      background: linear-gradient(135deg, #10B981, #059669);
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
      <h2 style="margin: 0 0 16px 0; color: white; font-size: 32px;">Поздравляем!</h2>
      <p style="margin: 0 0 8px 0; color: white; font-size: 18px;">Пазл собран!</p>
      <p style="margin: 0 0 24px 0; color: rgba(255,255,255,0.9); font-size: 14px;">
        Ходов: <strong>${moves}</strong> • Время: <strong>${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}</strong>
      </p>
      <button 
        onclick="this.parentElement.parentElement.remove()"
        style="
          padding: 12px 32px;
          background: white;
          color: #059669;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 700;
          font-size: 16px;
        "
      >Закрыть</button>
    `;
    
    modal.querySelector('.modal-content').appendChild(victoryModal);
    ui.showToast('🎉 Пазл собран!', 'success');
  }
  
  // Подсказка
  function showHint() {
    const wrongTiles = tiles.filter((tile, index) => tile !== index && tile !== gridSize * gridSize - 1);
    if (wrongTiles.length === 0) return;
    
    const grid = modal.querySelector('#puzzle-grid');
    const allTiles = grid.querySelectorAll('.puzzle-tile');
    
    // Подсвечиваем неправильные плитки
    allTiles.forEach((tileEl, index) => {
      if (tiles[index] !== index && tiles[index] !== gridSize * gridSize - 1) {
        tileEl.style.border = '2px solid #EF4444';
        setTimeout(() => {
          tileEl.style.border = '2px solid rgba(255,255,255,0.3)';
        }, 1000);
      }
    });
    
    ui.showToast('💡 Красные плитки не на своём месте', 'info');
  }
  
  // Таймер
  const timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    const timeEl = modal.querySelector('#puzzle-time');
    if (timeEl) {
      timeEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    } else {
      clearInterval(timerInterval);
    }
  }, 1000);
  
  // Обработчики кнопок
  modal.querySelector('#shuffle-btn').onclick = () => {
    shuffle();
    moves = 0;
    startTime = Date.now();
    modal.querySelector('#puzzle-moves').textContent = '0';
  };
  
  modal.querySelector('#hint-btn').onclick = showHint;
  
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
      
      initPuzzle(parseInt(btn.dataset.size));
    };
  });
  
  // Инициализация
  initPuzzle(3);
}
