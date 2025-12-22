/**
 * modules/coloring.js - Мини-игра "Раскраска по номерам"
 * Раскрась чёрно-белую картину по секторам
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
  let canvas, ctx, segmentCanvas, segmentCtx;
  let segments = []; // сегменты для раскраски
  let coloredSegments = new Map(); // сохранённые цвета
  
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
              <li><strong>Кликни на область</strong> чёрно-белого изображения, чтобы залить её цветом</li>
              <li><strong>Ластик:</strong> стирает цвет, возвращая область в белый</li>
              <li><strong>Совет:</strong> используй превью оригинала для подсказки</li>
            </ul>
          </div>
        </div>
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
          
          <!-- Кнопки -->
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <button 
              id="eraser-btn"
              style="padding: 10px; background: var(--bg-tertiary); color: var(--text); border: 1px solid var(--border-light); border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 13px;">
              🧯 Ластик
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
          
          <!-- Превью -->
          <div style="margin-top: 16px;">
            <div style="margin-bottom: 8px; font-size: 13px; color: var(--text-secondary);">Оригинал</div>
            <img src="${card.imageUrl}" alt="Оригинал" style="width: 100%; border-radius: 8px; opacity: 0.7; border: 2px solid var(--border-light);" />
          </div>
        </div>
        
        <!-- Холст -->
        <div style="flex: 1; min-width: 300px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h4 style="margin: 0; font-size: 14px; color: var(--text-accent);">🖼️ Раскрась картину</h4>
            <div style="font-size: 12px; color: var(--text-secondary);">
              Текущий: <span id="current-color-display" style="display: inline-block; width: 20px; height: 20px; background: ${currentColor}; border: 1px solid var(--border); border-radius: 4px; vertical-align: middle;"></span>
            </div>
          </div>
          <div style="position: relative; border: 2px solid var(--border-light); border-radius: 12px; overflow: hidden; background: white;">
            <!-- Скрытый canvas для сегментации -->
            <canvas id="segment-canvas" width="600" height="600" style="display: none;"></canvas>
            <!-- Основной canvas -->
            <canvas 
              id="drawing-canvas" 
              width="600" 
              height="600"
              style="display: block; max-width: 100%; height: auto; cursor: pointer;"
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
  segmentCanvas = modal.querySelector('#segment-canvas');
  segmentCtx = segmentCanvas.getContext('2d');
  
  // Загрузка изображения
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    // Рисуем чёрно-белую версию
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    
    // Применяем чёрно-белый фильтр
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      data[i] = avg;     // R
      data[i + 1] = avg; // G
      data[i + 2] = avg; // B
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    // Создаём сегменты (сетку 4x4)
    createSegments();
    
    // Добавляем контуры
    drawContours();
  };
  
  img.onerror = () => {
    ctx.fillStyle = '#F0F0F0';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#666';
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Не удалось загрузить изображение', canvas.width / 2, canvas.height / 2);
  };
  
  img.src = card.imageUrl;
  
  // Создание сегментов (сетка 4x4 = 16 областей)
  function createSegments() {
    const gridSize = 4;
    const segmentWidth = canvas.width / gridSize;
    const segmentHeight = canvas.height / gridSize;
    
    segments = [];
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        segments.push({
          id: `${row}-${col}`,
          x: col * segmentWidth,
          y: row * segmentHeight,
          width: segmentWidth,
          height: segmentHeight
        });
      }
    }
  }
  
  // Отрисовка контуров
  function drawContours() {
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 1;
    
    segments.forEach(seg => {
      ctx.strokeRect(seg.x, seg.y, seg.width, seg.height);
    });
  }
  
  // Получение сегмента по клику
  function getSegmentAtPoint(x, y) {
    return segments.find(seg => 
      x >= seg.x && x < seg.x + seg.width &&
      y >= seg.y && y < seg.y + seg.height
    );
  }
  
  // Заливка сегмента
  function fillSegment(segment, color) {
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.6;
    ctx.fillRect(segment.x + 1, segment.y + 1, segment.width - 2, segment.height - 2);
    ctx.globalAlpha = 1.0;
    
    // Перерисовываем контур
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(segment.x, segment.y, segment.width, segment.height);
  }
  
  // Клик по canvas
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    const segment = getSegmentAtPoint(x, y);
    if (segment) {
      coloredSegments.set(segment.id, currentColor);
      fillSegment(segment, currentColor);
    }
  });
  
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
  
  // Ластик
  modal.querySelector('#eraser-btn').onclick = () => {
    currentColor = 'transparent';
    updateColorUI();
  };
  
  // Очистить
  modal.querySelector('#clear-btn').onclick = () => {
    if (confirm('Очистить все цвета?')) {
      coloredSegments.clear();
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      // Чёрно-белый фильтр
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        data[i] = avg;
        data[i + 1] = avg;
        data[i + 2] = avg;
      }
      ctx.putImageData(imageData, 0, 0);
      drawContours();
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
  
  function updateColorUI() {
    modal.querySelectorAll('.color-btn').forEach(btn => {
      btn.style.border = btn.dataset.color === currentColor ? '3px solid var(--text-accent)' : '3px solid transparent';
    });
    modal.querySelector('#current-color-display').style.background = currentColor === 'transparent' ? '#FFF' : currentColor;
    if (currentColor !== 'transparent') {
      colorPicker.value = currentColor;
    }
  }
}
