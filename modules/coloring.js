/**
 * modules/coloring.js - Мини-игра "Раскраска"
 * Раскрась картину по номерам
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
  
  let currentColor = '#000000';
  let brushSize = 10;
  let isDrawing = false;
  let canvas, ctx;
  
  // Палитра цветов
  const palette = [
    { name: 'Чёрный', color: '#000000' },
    { name: 'Белый', color: '#FFFFFF' },
    { name: 'Красный', color: '#EF4444' },
    { name: 'Оранжевый', color: '#F97316' },
    { name: 'Жёлтый', color: '#FBBF24' },
    { name: 'Зелёный', color: '#10B981' },
    { name: 'Голубой', color: '#3B82F6' },
    { name: 'Синий', color: '#1E40AF' },
    { name: 'Фиолетовый', color: '#8B5CF6' },
    { name: 'Розовый', color: '#EC4899' },
    { name: 'Коричневый', color: '#92400E' },
    { name: 'Серый', color: '#6B7280' }
  ];
  
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 900px; max-height: 95vh; overflow-y: auto; padding: 24px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <div>
          <h2 style="margin: 0 0 8px 0; color: var(--text-accent);">🎨 Раскраска: ${card.title}</h2>
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
              <li><strong>Рисуй кистью</strong> по холсту — зажми мышь и веди</li>
              <li><strong>Размер кисти:</strong> настрой ползунком (5-50 пикселей)</li>
              <li><strong>Ластик:</strong> стирай ненужное или очисти всё</li>
            </ul>
          </div>
        </div>
      </div>
      
      <div style="display: flex; gap: 20px; flex-wrap: wrap;">
        <!-- Палитра цветов -->
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
              style="
                width: 100%;
                height: 50px;
                border: 2px solid var(--border-light);
                border-radius: 8px;
                cursor: pointer;
              "
            />
          </div>
          
          <!-- Размер кисти -->
          <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 8px; font-size: 13px; color: var(--text-secondary);">🖌️ Размер: <span id="brush-size-value">${brushSize}</span>px</label>
            <input 
              type="range" 
              id="brush-size-slider"
              min="5" 
              max="50" 
              value="${brushSize}"
              style="width: 100%;"
            />
          </div>
          
          <!-- Кнопки управления -->
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <button 
              id="eraser-btn"
              style="
                padding: 10px;
                background: var(--bg-tertiary);
                color: var(--text);
                border: 1px solid var(--border-light);
                border-radius: 8px;
                cursor: pointer;
                font-weight: 600;
                font-size: 13px;
              "
            >
              🧯 Ластик
            </button>
            <button 
              id="clear-btn"
              style="
                padding: 10px;
                background: linear-gradient(135deg, #EF4444, #DC2626);
                color: white;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 600;
                font-size: 13px;
              "
            >
              🗑 Очистить
            </button>
            <button 
              id="save-btn"
              style="
                padding: 10px;
                background: linear-gradient(135deg, #10B981, #059669);
                color: white;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 600;
                font-size: 13px;
              "
            >
              💾 Сохранить
            </button>
          </div>
        </div>
        
        <!-- Холст -->
        <div style="flex: 1; min-width: 300px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h4 style="margin: 0; font-size: 14px; color: var(--text-accent);">🖼️ Холст</h4>
            <div style="font-size: 12px; color: var(--text-secondary);">
              Текущий цвет: <span id="current-color-display" style="display: inline-block; width: 20px; height: 20px; background: ${currentColor}; border: 1px solid var(--border); border-radius: 4px; vertical-align: middle;"></span>
            </div>
          </div>
          <div style="position: relative; border: 2px solid var(--border-light); border-radius: 12px; overflow: hidden; background: white;">
            <canvas 
              id="drawing-canvas" 
              width="600" 
              height="600"
              style="display: block; max-width: 100%; height: auto; cursor: crosshair;"
            ></canvas>
          </div>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Закрытие
  modal.querySelector('.modal-close').onclick = () => modal.remove();
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  
  // Инициализация Canvas
  canvas = modal.querySelector('#drawing-canvas');
  ctx = canvas.getContext('2d');
  
  // Загрузка изображения как фона (полупрозрачное)
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    ctx.globalAlpha = 0.15;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1.0;
  };
  img.onerror = () => {
    // Если не загрузилось - просто белый фон
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };
  img.src = card.imageUrl;
  
  // Рисование
  function startDrawing(e) {
    isDrawing = true;
    draw(e);
  }
  
  function stopDrawing() {
    isDrawing = false;
    ctx.beginPath();
  }
  
  function draw(e) {
    if (!isDrawing) return;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = brushSize;
    ctx.strokeStyle = currentColor;
    
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  }
  
  canvas.addEventListener('mousedown', startDrawing);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDrawing);
  canvas.addEventListener('mouseout', stopDrawing);
  
  // Выбор цвета из палитры
  modal.querySelectorAll('.color-btn').forEach(btn => {
    btn.onclick = () => {
      currentColor = btn.dataset.color;
      updateColorUI();
    };
  });
  
  // Пипетка
  const colorPicker = modal.querySelector('#color-picker');
  colorPicker.oninput = (e) => {
    currentColor = e.target.value;
    updateColorUI();
  };
  
  // Размер кисти
  const brushSizeSlider = modal.querySelector('#brush-size-slider');
  const brushSizeValue = modal.querySelector('#brush-size-value');
  brushSizeSlider.oninput = (e) => {
    brushSize = parseInt(e.target.value);
    brushSizeValue.textContent = brushSize;
  };
  
  // Ластик
  modal.querySelector('#eraser-btn').onclick = () => {
    currentColor = '#FFFFFF';
    updateColorUI();
  };
  
  // Очистить
  modal.querySelector('#clear-btn').onclick = () => {
    if (confirm('Очистить весь холст?')) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Перезагружаем фон
      ctx.globalAlpha = 0.15;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1.0;
    }
  };
  
  // Сохранить
  modal.querySelector('#save-btn').onclick = () => {
    const dataURL = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `coloring_${card.title.replace(/\s+/g, '_')}_${Date.now()}.png`;
    link.href = dataURL;
    link.click();
    ui.showToast('💾 Рисунок сохранён!', 'success');
  };
  
  // Обновление UI цвета
  function updateColorUI() {
    modal.querySelectorAll('.color-btn').forEach(btn => {
      btn.style.border = btn.dataset.color === currentColor ? '3px solid var(--text-accent)' : '3px solid transparent';
    });
    modal.querySelector('#current-color-display').style.background = currentColor;
    colorPicker.value = currentColor;
  }
}
