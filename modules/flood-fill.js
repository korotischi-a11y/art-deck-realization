/**
 * modules/flood-fill.js - Игра "Color Flood Fill"
 * Закрась всю картину одним цветом за минимум ходов
 */

import { state } from '../app.js';
import * as ui from './ui.js';

/**
 * Показать игру "Color Flood Fill"
 */
export function showFloodFillGame(card) {
  const modal = document.createElement('div');
  modal.className = 'modal active';
  modal.id = 'flood-fill-modal';
  modal.style.cssText = 'z-index: 9999;';
  
  let canvas, ctx;
  let gridSize = 20; // Размер сетки
  let grid = []; // Сетка цветов
  let moves = 0;
  let maxMoves = 25;
  let colorPalette = [];
  
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 800px; max-height: 95vh; overflow-y: auto; padding: 24px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <div>
          <h2 style="margin: 0 0 8px 0; color: var(--text-accent);">🌈 Color Flood: ${card.title}</h2>
          <p style="margin: 0; font-size: 14px; color: var(--text-secondary);">${card.artist}, ${card.year}</p>
        </div>
        <button class="modal-close" style="padding: 0; width: 36px; height: 36px; font-size: 24px; background: none; border: none; color: var(--text); cursor: pointer;">×</button>
      </div>
      
      <!-- ИНСТРУКЦИЯ -->
      <div style="background: linear-gradient(135deg, #E0F2FE, #BAE6FD); border: 2px solid #0EA5E9; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
        <div style="display: flex; align-items: start; gap: 12px;">
          <div style="font-size: 24px; flex-shrink: 0;">💡</div>
          <div>
            <h4 style="margin: 0 0 8px 0; color: #075985; font-size: 14px; font-weight: 700;">Как играть:</h4>
            <ul style="margin: 0; padding-left: 20px; color: #0C4A6E; font-size: 13px; line-height: 1.6;">
              <li><strong>Выбери цвет</strong> из палитры внизу</li>
              <li><strong>Вся связанная область</strong> левого верхнего угла перекрасится</li>
              <li><strong>Цель:</strong> закрась всю картину одним цветом за ${maxMoves} ходов</li>
              <li><strong>Стратегия:</strong> выбирай цвет, который захватит больше областей!</li>
            </ul>
          </div>
        </div>
      </div>
      
      <!-- СТАТИСТИКА -->
      <div style="display: flex; gap: 20px; margin-bottom: 20px; padding: 12px; background: var(--bg-tertiary); border-radius: 8px;">
        <div style="flex: 1; text-align: center;">
          <div style="font-size: 24px; font-weight: 700; color: var(--text-accent);" id="flood-moves">0 / ${maxMoves}</div>
          <div style="font-size: 12px; color: var(--text-secondary);">Ходов</div>
        </div>
        <div style="flex: 1; text-align: center;">
          <div style="font-size: 24px; font-weight: 700; color: var(--text-accent);" id="flood-progress">0%</div>
          <div style="font-size: 12px; color: var(--text-secondary);">Заполнено</div>
        </div>
        <div style="flex: 1; text-align: center;">
          <div style="font-size: 24px; font-weight: 700; color: var(--text-accent);" id="flood-colors">6</div>
          <div style="font-size: 12px; color: var(--text-secondary);">Цветов</div>
        </div>
      </div>
      
      <!-- ХОЛСТ -->
      <div style="display: flex; flex-direction: column; align-items: center; gap: 16px;">
        <canvas 
          id="flood-canvas" 
          width="600" 
          height="600"
          style="border: 2px solid var(--border-light); border-radius: 12px; max-width: 100%; height: auto;"
        ></canvas>
        
        <!-- ПАЛИТРА -->
        <div>
          <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 8px; text-align: center;">Выбери цвет:</div>
          <div id="flood-palette" style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;"></div>
        </div>
        
        <!-- КНОПКИ -->
        <div style="display: flex; gap: 12px;">
          <button id="flood-restart-btn" style="padding: 12px 24px; background: linear-gradient(135deg, #F59E0B, #D97706); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">🔄 Новая игра</button>
          <button id="flood-hint-btn" style="padding: 12px 24px; background: linear-gradient(135deg, #8B5CF6, #7C3AED); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">💡 Подсказка</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  modal.querySelector('.modal-close').onclick = () => modal.remove();
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  
  canvas = modal.querySelector('#flood-canvas');
  ctx = canvas.getContext('2d');
  
  // Инициализация игры
  function initGame() {
    moves = 0;
    grid = [];
    
    // Загружаем изображение и извлекаем цвета
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // Создаём временный canvas для пикселизации
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = gridSize;
      tempCanvas.height = gridSize;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.imageSmoothingEnabled = false;
      tempCtx.drawImage(img, 0, 0, gridSize, gridSize);
      
      const imageData = tempCtx.getImageData(0, 0, gridSize, gridSize);
      const data = imageData.data;
      
      // Извлекаем цвета и квантуем их
      const colors = [];
      for (let y = 0; y < gridSize; y++) {
        grid[y] = [];
        for (let x = 0; x < gridSize; x++) {
          const i = (y * gridSize + x) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const color = rgbToHex(r, g, b);
          grid[y][x] = color;
          if (!colors.includes(color)) colors.push(color);
        }
      }
      
      // Квантуем до 6-8 цветов
      colorPalette = quantizeColors(colors, 6);
      
      // Заменяем цвета в сетке на ближайшие из палитры
      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          grid[y][x] = findClosestColor(grid[y][x], colorPalette);
        }
      }
      
      renderGrid();
      renderPalette();
      updateStats();
    };
    img.src = card.imageUrl;
  }
  
  // Квантизация цветов (упрощение)
  function quantizeColors(colors, targetCount) {
    if (colors.length <= targetCount) return colors;
    
    // Простой алгоритм: берём равномерно распределённые цвета
    const step = Math.floor(colors.length / targetCount);
    const result = [];
    for (let i = 0; i < targetCount; i++) {
      result.push(colors[Math.min(i * step, colors.length - 1)]);
    }
    return result;
  }
  
  // Найти ближайший цвет из палитры
  function findClosestColor(color, palette) {
    let minDist = Infinity;
    let closest = palette[0];
    
    const rgb1 = hexToRgb(color);
    
    for (const c of palette) {
      const rgb2 = hexToRgb(c);
      const dist = Math.sqrt(
        Math.pow(rgb1.r - rgb2.r, 2) +
        Math.pow(rgb1.g - rgb2.g, 2) +
        Math.pow(rgb1.b - rgb2.b, 2)
      );
      if (dist < minDist) {
        minDist = dist;
        closest = c;
      }
    }
    
    return closest;
  }
  
  // RGB → HEX
  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
  }
  
  // HEX → RGB
  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  }
  
  // Отрисовка сетки
  function renderGrid() {
    const cellSize = canvas.width / gridSize;
    
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        ctx.fillStyle = grid[y][x];
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        
        // Сетка
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
    }
  }
  
  // Отрисовка палитры
  function renderPalette() {
    const paletteContainer = modal.querySelector('#flood-palette');
    paletteContainer.innerHTML = colorPalette.map(color => `
      <button 
        class="flood-color-btn"
        data-color="${color}"
        style="
          width: 60px;
          height: 60px;
          background: ${color};
          border: 3px solid var(--border-light);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        "
        onmouseover="this.style.transform='scale(1.1)'"
        onmouseout="this.style.transform='scale(1)'"
      ></button>
    `).join('');
    
    // Обработчики
    modal.querySelectorAll('.flood-color-btn').forEach(btn => {
      btn.onclick = () => {
        const color = btn.dataset.color;
        floodFill(color);
      };
    });
  }
  
  // Flood Fill алгоритм
  function floodFill(newColor) {
    const startColor = grid[0][0];
    
    if (startColor === newColor) {
      ui.showToast('❌ Выбери другой цвет!', 'error');
      return;
    }
    
    moves++;
    
    const stack = [[0, 0]];
    const visited = new Set();
    
    while (stack.length > 0) {
      const [x, y] = stack.pop();
      const key = `${x},${y}`;
      
      if (visited.has(key)) continue;
      if (x < 0 || x >= gridSize || y < 0 || y >= gridSize) continue;
      if (grid[y][x] !== startColor) continue;
      
      visited.add(key);
      grid[y][x] = newColor;
      
      // Соседи (4-связность)
      stack.push([x + 1, y]);
      stack.push([x - 1, y]);
      stack.push([x, y + 1]);
      stack.push([x, y - 1]);
    }
    
    renderGrid();
    updateStats();
    checkWin();
  }
  
  // Обновление статистики
  function updateStats() {
    modal.querySelector('#flood-moves').textContent = `${moves} / ${maxMoves}`;
    modal.querySelector('#flood-colors').textContent = colorPalette.length;
    
    // Процент заполнения
    const targetColor = grid[0][0];
    let count = 0;
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        if (grid[y][x] === targetColor) count++;
      }
    }
    const percent = Math.round((count / (gridSize * gridSize)) * 100);
    modal.querySelector('#flood-progress').textContent = `${percent}%`;
  }
  
  // Проверка победы
  function checkWin() {
    const firstColor = grid[0][0];
    const allSame = grid.every(row => row.every(cell => cell === firstColor));
    
    if (allSame) {
      setTimeout(() => {
        ui.showToast(`🎉 Победа за ${moves} ходов!`, 'success');
      }, 300);
    } else if (moves >= maxMoves) {
      setTimeout(() => {
        ui.showToast('😢 Ходы закончились! Попробуй снова', 'error');
      }, 300);
    }
  }
  
  // Подсказка
  modal.querySelector('#flood-hint-btn').onclick = () => {
    // Подсчитываем какой цвет захватит больше клеток
    const currentColor = grid[0][0];
    let bestColor = null;
    let maxCapture = 0;
    
    for (const color of colorPalette) {
      if (color === currentColor) continue;
      
      // Симулируем заливку
      const tempGrid = grid.map(row => [...row]);
      const stack = [[0, 0]];
      const visited = new Set();
      let captureCount = 0;
      
      while (stack.length > 0) {
        const [x, y] = stack.pop();
        const key = `${x},${y}`;
        
        if (visited.has(key)) continue;
        if (x < 0 || x >= gridSize || y < 0 || y >= gridSize) continue;
        if (tempGrid[y][x] !== currentColor && tempGrid[y][x] !== color) continue;
        
        visited.add(key);
        if (tempGrid[y][x] === color) captureCount++;
        
        stack.push([x + 1, y]);
        stack.push([x - 1, y]);
        stack.push([x, y + 1]);
        stack.push([x, y - 1]);
      }
      
      if (captureCount > maxCapture) {
        maxCapture = captureCount;
        bestColor = color;
      }
    }
    
    if (bestColor) {
      modal.querySelectorAll('.flood-color-btn').forEach(btn => {
        if (btn.dataset.color === bestColor) {
          btn.style.border = '3px solid gold';
          btn.style.boxShadow = '0 0 20px gold';
          setTimeout(() => {
            btn.style.border = '3px solid var(--border-light)';
            btn.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
          }, 2000);
        }
      });
      ui.showToast('💡 Подсвечен лучший выбор!', 'info');
    }
  };
  
  // Рестарт
  modal.querySelector('#flood-restart-btn').onclick = () => {
    initGame();
  };
  
  initGame();
}
