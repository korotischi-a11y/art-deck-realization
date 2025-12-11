/**
 * modules/admin.js
 * Админ-панель для добавления новых карт
 */

import { state } from '../app.js';
import * as ui from './ui.js';

const db = firebase.firestore();

/**
 * Инициализирует админ-панель (вешает обработчики на форму)
 */
export function initAdminPanel() {
  if (!state.isAdmin) {
    // Если пользователь не админ - показываем предупреждение
    const form = document.getElementById('admin-form');
    form.innerHTML = '<div style="padding: 16px; background-color: rgba(255, 107, 107, 0.1); border-radius: 12px; border: 1px solid var(--resonance); color: var(--resonance);">У вас нет прав администратора.</div>';
    return;
  }
  
  const form = document.getElementById('admin-form');
  if (!form.dataset.initialized) {
    form.addEventListener('submit', handleSubmit);
    
    // Реал-тайм обновление значений слайдеров
    form.querySelectorAll('.power-slider').forEach(slider => {
      const valueSpan = slider.parentElement.querySelector('.slider-value');
      slider.addEventListener('input', () => {
        valueSpan.textContent = slider.value;
      });
    });
    
    form.dataset.initialized = 'true';
  }
}

/**
 * Обработчик отправки формы
 */
async function handleSubmit(event) {
  event.preventDefault();
  const form = event.target;
  
  const title = form.querySelector('#card-title').value.trim();
  const artist = form.querySelector('#card-artist').value.trim();
  const year = parseInt(form.querySelector('#card-year').value, 10);
  const description = form.querySelector('#card-description').value.trim();
  const imageUrl = form.querySelector('#card-image-url').value.trim();
  const rarity = form.querySelector('#card-rarity').value;
  
  const resonance = parseInt(form.querySelector('#card-resonance').value, 10);
  const virtuosity = parseInt(form.querySelector('#card-virtuosity').value, 10);
  const profundity = parseInt(form.querySelector('#card-profundity').value, 10);
  const harmony = parseInt(form.querySelector('#card-harmony').value, 10);
  
  // Валидация
  if (!title || !artist || !description || !rarity) {
    ui.showError('Заполните все обязательные поля');
    return;
  }
  
  if (!ui.validateYear(year)) {
    ui.showError('Год должен быть между 1000 и 2100');
    return;
  }
  
  if (!ui.validateUrl(imageUrl)) {
    ui.showError('Неверный формат URL изображения');
    return;
  }
  
  const submitBtn = form.querySelector('button[type="submit"]');
  ui.setLoading(submitBtn, true);
  
  try {
    await db.collection('masterCards').add({
      title,
      artist,
      year,
      description,
      imageUrl,
      rarity,
      power: {
        resonance,
        virtuosity,
        profundity,
        harmony
      },
      createdAt: firebase.firestore.Timestamp.now(),
      totalOwners: 0
    });
    
    ui.showSuccess('Карта успешно добавлена');
    form.reset();
    
  } catch (error) {
    console.error('Ошибка при добавлении карты:', error);
    ui.showError('Ошибка при добавлении карты');
  } finally {
    ui.setLoading(submitBtn, false);
  }
}
