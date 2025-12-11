/**
 * modules/ui.js
 * UI утилиты и вспомогательные функции
 * 
 * Функции:
 * - Toast-уведомления (success/error)
 * - Модальные окна
 * - Валидация входных данных
 * - Санитизация HTML
 * - Форматирование данных
 */

/**
 * Показывает успешное уведомление
 */
export function showSuccess(message) {
  showToast(message, 'success');
}

/**
 * Показывает ошибку
 */
export function showError(message) {
  showToast(message, 'error');
}

/**
 * Внутренняя функция для вывода toast
 */
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  
  container.appendChild(toast);
  
  // Удаляем через 3 секунды
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s ease-out reverse';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/**
 * Валидация email
 */
export function validateEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

/**
 * Валидация пароля (минимум 6 символов)
 */
export function validatePassword(password) {
  return password && password.length >= 6;
}

/**
 * Валидация года (1000-2100)
 */
export function validateYear(year) {
  const y = parseInt(year);
  return y >= 1000 && y <= 2100;
}

/**
 * Валидация URL
 */
export function validateUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Санитизация HTML (защита от XSS)
 */
export function sanitizeHTML(str) {
  if (!str) return '';
  const temp = document.createElement('div');
  temp.textContent = str;
  return temp.innerHTML;
}

/**
 * Форматирование больших чисел
 */
export function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

/**
 * Форматирование валюты (монеты)
 */
export function formatCurrency(amount) {
  return `💰 ${amount}`;
}

/**
 * Получить статус редкости с цветом
 */
export function getRarityBadge(rarity) {
  const rarities = {
    'common': { emoji: '📍', name: 'Обычная', color: '#e0e0e0' },
    'uncommon': { emoji: '🎯', name: 'Необычная', color: '#4facf6' },
    'rare': { emoji: '🏆', name: 'Редкая', color: '#5d4cc0' },
    'mythical': { emoji: '💎', name: 'Мифическая', color: '#a832d0' },
    'legendary': { emoji: '⭐', name: 'Легендарная', color: '#d946ef' },
    'ancient': { emoji: '🔥', name: 'Древняя', color: '#ff6b6b' },
    'exceedingly_rare': { emoji: '✨', name: 'Исключительно редкая', color: '#ffaa00' },
    'immortal': { emoji: '👑', name: 'Бессмертная', color: '#b89968' }
  };
  
  return rarities[rarity] || rarities['common'];
}

/**
 * Получить HTML для отображения редкости
 */
export function createRarityElement(rarity) {
  const badge = getRarityBadge(rarity);
  const div = document.createElement('div');
  div.className = 'card-rarity';
  div.style.backgroundColor = `${badge.color}15`;
  div.style.borderColor = badge.color;
  div.style.color = badge.color;
  div.innerHTML = `${badge.emoji} ${badge.name}`;
  return div;
}

/**
 * Показывает/скрывает загрузку
 */
export function setLoading(element, isLoading) {
  if (isLoading) {
    element.classList.add('loading');
    element.disabled = true;
  } else {
    element.classList.remove('loading');
    element.disabled = false;
  }
}

/**
 * Создаёт прогресс-бар
 */
export function createProgressBar(current, max, color = '#d4a574') {
  const percentage = (current / max) * 100;
  const bar = document.createElement('div');
  bar.style.height = '8px';
  bar.style.backgroundColor = 'var(--bg-tertiary)';
  bar.style.borderRadius = '4px';
  bar.style.overflow = 'hidden';
  bar.style.marginTop = '8px';
  
  const fill = document.createElement('div');
  fill.style.height = '100%';
  fill.style.backgroundColor = color;
  fill.style.width = percentage + '%';
  fill.style.transition = 'width 0.3s ease';
  
  bar.appendChild(fill);
  return bar;
}

/**
 * Форматирование даты
 */
export function formatDate(timestamp) {
  if (!timestamp) return '-';
  
  let date;
  if (typeof timestamp === 'number') {
    date = new Date(timestamp * 1000);
  } else if (timestamp.toDate) {
    date = timestamp.toDate();
  } else {
    date = new Date(timestamp);
  }
  
  return date.toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Проверка поддержки браузера
 */
export function checkBrowserSupport() {
  const required = {
    'ES6 Classes': typeof class {} !== 'undefined',
    'Fetch API': typeof fetch !== 'undefined',
    'LocalStorage': typeof localStorage !== 'undefined'
  };
  
  const unsupported = Object.entries(required)
    .filter(([, support]) => !support)
    .map(([feature]) => feature);
  
  if (unsupported.length > 0) {
    console.warn('⚠️ Браузер не поддерживает:', unsupported.join(', '));
    return false;
  }
  
  return true;
}

/**
 * Дебаунс функции
 */
export function debounce(func, delay = 300) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

/**
 * Получить класс CSS для фона статуса
 */
export function getStatusBackgroundClass(rarity) {
  const rarityMap = {
    'common': 'rgba(224, 224, 224, 0.1)',
    'uncommon': 'rgba(79, 172, 246, 0.1)',
    'rare': 'rgba(93, 76, 192, 0.1)',
    'mythical': 'rgba(168, 50, 208, 0.1)',
    'legendary': 'rgba(217, 70, 239, 0.1)',
    'ancient': 'rgba(255, 107, 107, 0.1)',
    'exceedingly_rare': 'rgba(255, 170, 0, 0.1)',
    'immortal': 'rgba(184, 153, 104, 0.1)'
  };
  
  return rarityMap[rarity] || rarityMap['common'];
}

/**
 * Преобразует Firestore timestamp в юникс
 */
export function firestoreToUnix(timestamp) {
  if (!timestamp) return null;
  if (timestamp.seconds) {
    return timestamp.seconds;
  }
  return Math.floor(timestamp.getTime() / 1000);
}
