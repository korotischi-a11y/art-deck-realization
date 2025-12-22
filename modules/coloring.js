/**
 * modules/coloring.js - Мини-игра "Алмазная мозаика"
 * Раскрась картину по пикселям как алмазную мозаику
 */

import * as ui from './ui.js';

/**
 * Показать игру "Раскраска"
 */
export function showColoringGame(card) {
  const modal = document.createElement('div');
  modal.className = 'modal active';
  modal.id = 'coloring-game-modal';
  modal.style.cssText = 'z-index: 9999;';
  
  let currentColor = '#EF4444';
  let canvas, ctx;
  let gridSize = 100; // КАТЕГОРИИ: 100, 150, 200
  let segments = [];
  let coloredSegments = new Map();
  let pixelatedColors = [];
  let isDrawing = false; // Для drag-режима
  
  // Палитра
  const palette = [
    { name: 'Красный', color: '#EF4444' },
    { name: 'Оранжевый', color: '#F97316' },
    { name: 'Жёлтый', color: '#FBBF24' },
    { name: 'Зелёный', color: '#10B981' },
    { name: 'Голубой', color: '#3B82F6' },
    { name: 'Синий', color: '#1E40AF' },
    { name: 'Фиолетовый', color: '#8B5CF6' },
    { name: 'Розовый', color: '#EC4899' },
    { name: 'Коричневый', color: '#92400E' },
    { name: 'Серый', color: '#6B7280' },
    { name: 'Чёрный', color: '#000000' },
    { name: 'Белый', color: '#FFFFFF' }
  ];
  
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 1000px; max-height: 95vh; overflow-y: auto; padding: 24px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <div>
          <h2 style="margin: 0 0 8px 0; color: var(--text-accent);">💎 Алмазная мозаика: ${card.title}</h2>
          <p style="margin: 0; font-size: 14px; color: var(--text-secondary);">${card.artist}, ${card.year}</p>
        </div>
        <button class="modal-close" style="padding: 0; width: 36px; height: 36px; font-size: 24px; background: none; border: none; color: var(--text); cursor: pointer;">×</button>
      </div>
      
      <!-- ИНСТРУКЦИЯ -->
      <div style="background: linear-gradient(135deg, #FEF3C7, #FDE68A); border: 2px solid #F59E0B; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
        <div style="display: flex; align-items: start; gap: 12px;">
          <div style="font-size: 24px; flex-shrink: 0;">✨</div>
          <div>
            <h4 style="margin: 0 0 8px 0; color: #92400E; font-size: 14px; font-weight: 700;">Как играть:</h4>
            <ul style="margin: 0; padding-left: 20px; color: #78350F; font-size: 13px; line-height: 1.6;">
              <li><strong>Выбери цвет</strong> из палитры или используй пипетку</li>
              <li><strong>Кликни или зажми мышку</strong> чтобы раскрасить несколько пикселей подряд!</li>
              <li><strong>Авто-заполнение:</strong> нажми "🎨 Показать оригинал" чтобы увидеть подсказку</li>
              <li><strong>Сложность:</strong> выбери размер сетки (100×100, 150×150, 200×200)</li>
            </ul>
          </div>
        </div>
      </div>
      
      <!-- Сложность -->
      <div style="display: flex; gap: 8px; margin-bottom: 20px; justify-content: center; align-items: center;">
        <span style="font-size: 13px; color: var(--text-secondary); font-weight: 600;">Детализация:</span>
        <button class="grid-size-btn" data-size="100" style="padding: 8px 16px; background: linear-gradient(135deg, #10B981, #059669); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 13px;">100×100</button>
        <button class="grid-size-btn" data-size="150" style="padding: 8px 16px; background: var(--bg-tertiary); color: var(--text); border: 1px solid var(--border-light); border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 13px;">150×150</button>
        <button class="grid-size-btn" data-size="200" style="padding: 8px 16px; background: var(--bg-tertiary); color: var(--text); border: 1px solid var(--border-light); border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 13px;">200×200 🔥</button>
      </div>
      
      <div style="display: flex; gap: 20px; flex-wrap: wrap;">
        <!-- Палитра -->
        <div style="flex: 0 0 auto; max-width: 200px;">
          <h4 style="margin: 0 0 12px 0; font-size: 14px; color: var(--text-accent);">🎨 Палитра</h4>
          <div id="color-palette" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 16px;">
            ${palette.map(c => `
              <button 
                class="color-btn" 
                data-color="${c.color}"
                style="
                  padding: 8px;
                  background: ${c.color};
                  border: 3px solid ${c.color === currentColor ? 'var(--text-accent)' : 'transparent'};
                  border-radius: 8px;
                  cursor: pointer;
                  transition: all 0.2s;
                  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                  min-height: 40px;
                "
                title="${c.name}"
              ></button>
            `).join('')}
          </div>
          
          <!-- Пипетка -->
          <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 8px; font-size: 13px; color: var(--text-secondary);">💧 Пипетка</label>
            <input 
              type="color" 
              id="color-picker"
              value="${currentColor}"
              style="width: 100%; height: 50px; border: 2px solid var(--border-light); border-radius: 8px; cursor: pointer;"
            />
          </div>
          
          <!-- Статистика -->
          <div style="background: var(--bg-tertiary); padding: 12px; border-radius: 8px; margin-bottom: 16px;">
            <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 4px;">Прогресс</div>
            <div style="font-size: 20px; font-weight: 700; color: var(--text-accent);" id="progress-display">0%</div>
            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;"><span id="colored-count">0</span> / <span id="total-count">${gridSize * gridSize}</span></div>
          </div>
          
          <!-- Кнопки -->
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <button 
              id="toggle-hint-btn"
              style="padding: 10px; background: linear-gradient(135deg, #8B5CF6, #7C3AED); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 13px;">
              🎨 Показать оригинал
            </button>
            <button 
              id="clear-btn"
              style="padding: 10px; background: linear-gradient(135deg, #EF4444, #DC2626); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 13px;">
              🗑 Очистить
            </button>
            <button 
              id="save-btn"
              style="padding: 10px; background: linear-gradient(135deg, #10B981, #059669); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 13px;">
              💾 Сохранить
            </button>
          </div>
        </div>
        
        <!-- Холст -->
        <div style="flex: 1; min-width: 300px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h4 style="margin: 0; font-size: 14px; color: var(--text-accent);">💎 Мозаика ${gridSize}×${gridSize}</h4>
            <div style="font-size: 12px; color: var(--text-secondary);">
              Текущий: <span id="current-color-display" style="display: inline-block; width: 20px; height: 20px; background: ${currentColor}; border: 1px solid var(--border); border-radius: 4px; vertical-align: middle;"></span>
            </div>
          </div>
          <div style="position: relative; border: 2px solid var(--border-light); border-radius: 12px; overflow: hidden; background: white;">
            <canvas 
              id="drawing-canvas" 
              width="600" 
              height="600"
              style="display: block; max-width: 100%; height: auto; cursor: crosshair; image-rendering: pixelated;"
            ></canvas>
          </div>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  modal.querySelector('.modal-close').onclick = () => modal.remove();
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  
  // Инициализация
  canvas = modal.querySelector('#drawing-canvas');
  ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  
  let showHint = false;
  
  // Загрузка изображения
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    initMosaic();
  };
  
  img.onerror = () => {
    ctx.fillStyle = '#F0F0F0';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };
  
  img.src = card.imageUrl;
  
  // Инициализация мозаики
  function initMosaic() {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = gridSize;
    tempCanvas.height = gridSize;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.imageSmoothingEnabled = false;
    
    tempCtx.drawImage(img, 0, 0, gridSize, gridSize);
    
    const imageData = tempCtx.getImageData(0, 0, gridSize, gridSize);
    const data = imageData.data;
    
    pixelatedColors = [];
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const i = (y * gridSize + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        pixelatedColors.push(`rgb(${r},${g},${b})`);
      }
    }
    
    createSegments();
    renderCanvas();
    updateProgress();
  }
  
  function createSegments() {
    const pixelSize = canvas.width / gridSize;
    segments = [];
    
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        segments.push({
          id: `${row}-${col}`,
          x: col * pixelSize,
          y: row * pixelSize,
          size: pixelSize,
          colorIndex: row * gridSize + col
        });
      }
    }
  }
  
  function renderCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#F5F5F5';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    segments.forEach(seg => {
      if (showHint) {
        ctx.fillStyle = pixelatedColors[seg.colorIndex];
        ctx.globalAlpha = 0.3;
        ctx.fillRect(seg.x, seg.y, seg.size, seg.size);
        ctx.globalAlpha = 1.0;
      }
      
      if (coloredSegments.has(seg.id)) {
        ctx.fillStyle = coloredSegments.get(seg.id);
        ctx.fillRect(seg.x + 1, seg.y + 1, seg.size - 2, seg.size - 2);
      }
      
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(seg.x, seg.y, seg.size, seg.size);
    });
  }
  
  function getSegmentAtPoint(x, y) {
    return segments.find(seg => 
      x >= seg.x && x < seg.x + seg.size &&
      y >= seg.y && y < seg.y + seg.size
    );
  }
  
  function paintSegment(x, y) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = (x - rect.left) * scaleX;
    const canvasY = (y - rect.top) * scaleY;
    
    const segment = getSegmentAtPoint(canvasX, canvasY);
    if (segment) {
      coloredSegments.set(segment.id, currentColor);
      renderCanvas();
      updateProgress();
    }
  }
  
  // DRAG-РЕЖИМ: Зажатая мышка
  canvas.addEventListener('mousedown', (e) => {
    isDrawing = true;
    paintSegment(e.clientX, e.clientY);
  });
  
  canvas.addEventListener('mousemove', (e) => {
    if (isDrawing) {
      paintSegment(e.clientX, e.clientY);
    }
  });
  
  canvas.addEventListener('mouseup', () => {
    isDrawing = false;
  });
  
  canvas.addEventListener('mouseleave', () => {
    isDrawing = false;
  });
  
  // Обновление прогресса
  function updateProgress() {
    const colored = coloredSegments.size;
    const total = segments.length;
    const percent = Math.round((colored / total) * 100);
    
    modal.querySelector('#progress-display').textContent = `${percent}%`;
    modal.querySelector('#colored-count').textContent = colored;
    modal.querySelector('#total-count').textContent = total;
    
    if (percent === 100) {
      setTimeout(() => {
        ui.showToast('🎉 Мозаика завершена!', 'success');
      }, 300);
    }
  }
  
  // Переключение подсказки
  modal.querySelector('#toggle-hint-btn').onclick = () => {
    showHint = !showHint;
    const btn = modal.querySelector('#toggle-hint-btn');
    btn.textContent = showHint ? '🙈 Скрыть оригинал' : '🎨 Показать оригинал';
    renderCanvas();
  };
  
  // Выбор цвета
  modal.querySelectorAll('.color-btn').forEach(btn => {
    btn.onclick = () => {
      currentColor = btn.dataset.color;
      updateColorUI();
    };
  });
  
  const colorPicker = modal.querySelector('#color-picker');
  colorPicker.oninput = (e) => {
    currentColor = e.target.value;
    updateColorUI();
  };
  
  // Очистить
  modal.querySelector('#clear-btn').onclick = () => {
    if (confirm('Очистить всю мозаику?')) {
      coloredSegments.clear();
      renderCanvas();
      updateProgress();
    }
  };
  
  // Сохранить
  modal.querySelector('#save-btn').onclick = () => {
    const dataURL = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `mosaic_${card.title.replace(/\s+/g, '_')}_${Date.now()}.png`;
    link.href = dataURL;
    link.click();
    ui.showToast('💾 Мозаика сохранена!', 'success');
  };
  
  // Смена размера сетки
  modal.querySelectorAll('.grid-size-btn').forEach(btn => {
    btn.onclick = () => {
      gridSize = parseInt(btn.dataset.size);
      
      modal.querySelectorAll('.grid-size-btn').forEach(b => {
        b.style.background = 'var(--bg-tertiary)';
        b.style.color = 'var(--text)';
        b.style.border = '1px solid var(--border-light)';
      });
      btn.style.background = 'linear-gradient(135deg, #10B981, #059669)';
      btn.style.color = 'white';
      btn.style.border = 'none';
      
      coloredSegments.clear();
      initMosaic();
      
      modal.querySelector('h4').textContent = `💎 Мозаика ${gridSize}×${gridSize}`;
    };
  });
  
  function updateColorUI() {
    modal.querySelectorAll('.color-btn').forEach(btn => {
      btn.style.border = btn.dataset.color === currentColor ? '3px solid var(--text-accent)' : '3px solid transparent';
    });
    modal.querySelector('#current-color-display').style.background = currentColor;
    colorPicker.value = currentColor;
  }
}
