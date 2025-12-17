/**
 * modules/ui.js
 */

function ensureToastContainer() {
  let c = document.getElementById('toast-container');
  if (!c) {
    c = document.createElement('div');
    c.id = 'toast-container';
    c.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:2000;display:flex;flex-direction:column;gap:12px';
    document.body.appendChild(c);
  }
  return c;
}

export function showToast(msg, type = 'success') {
  const c = ensureToastContainer();
  const t = document.createElement('div');
  const bg = type === 'error' ? '#ff6b6b' : '#4facf6';
  const bd = type === 'error' ? '#e63946' : '#2e7d32';
  t.style.cssText = `background:${bg};color:white;padding:12px 16px;border-radius:8px;border-left:4px solid ${bd};box-shadow:0 4px 12px rgba(0,0,0,0.3);font-size:14px;max-width:300px;word-wrap:break-word`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

export function showSuccess(msg) { showToast(msg, 'success'); }
export function showError(msg) { showToast(msg, 'error'); }
export function validateEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
export function validatePassword(p) { return p && p.length >= 6; }
export function validateYear(y) { const n = parseInt(y); return n >= 1000 && n <= 2100; }
export function validateUrl(u) { try { new URL(u); return true; } catch { return false; } }
export function sanitizeHTML(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
export function formatNumber(n) { if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'; return n.toString(); }
export function formatCurrency(a) { return `💰 ${a}`; }
export function getRarityBadge(r) {
  const m = { 'common': { emoji: '📑', name: 'Обычная', color: '#e0e0e0' }, 'uncommon': { emoji: '🎯', name: 'Необычная', color: '#4facf6' }, 'rare': { emoji: '🏆', name: 'Редкая', color: '#5d4cc0' }, 'mythical': { emoji: '💎', name: 'Мифическая', color: '#a832d0' }, 'legendary': { emoji: '⭐', name: 'Легендарная', color: '#d946ef' }, 'ancient': { emoji: '🔥', name: 'Древняя', color: '#ff6b6b' }, 'exceedingly_rare': { emoji: '✨', name: 'Исключ. редкая', color: '#ffaa00' }, 'immortal': { emoji: '⚠', name: 'Бессмертная', color: '#b89968' } };
  return m[r] || m['common'];
}
export function createRarityElement(r) { const b = getRarityBadge(r); const d = document.createElement('div'); d.className = 'card-rarity'; d.style.backgroundColor = `${b.color}15`; d.style.borderColor = b.color; d.style.color = b.color; d.innerHTML = `${b.emoji} ${b.name}`; return d; }
export function setLoading(e, l) { l ? (e.classList.add('loading'), e.disabled = true) : (e.classList.remove('loading'), e.disabled = false); }
export function createProgressBar(c, m, col = '#d4a574') { const p = (c / m) * 100; const b = document.createElement('div'); b.style.cssText = 'height:8px;background:var(--bg-tertiary);border-radius:4px;overflow:hidden;margin-top:8px'; const f = document.createElement('div'); f.style.cssText = `height:100%;background:${col};width:${p}%;transition:width 0.3s ease`; b.appendChild(f); return b; }
export function formatDate(ts) { if (!ts) return '-'; let d = typeof ts === 'number' ? new Date(ts * 1000) : ts.toDate ? ts.toDate() : new Date(ts); return d.toLocaleDateString('ru-RU', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
export function checkBrowserSupport() { const r = { 'ES6': typeof class {} !== 'undefined', 'Fetch': typeof fetch !== 'undefined', 'Storage': typeof localStorage !== 'undefined' }; return Object.values(r).every(v => v); }
export function debounce(f, d = 300) { let t; return function(...a) { clearTimeout(t); t = setTimeout(() => f.apply(this, a), d); }; }
export function getStatusBackgroundClass(r) { const m = { 'common': 'rgba(224,224,224,0.1)', 'uncommon': 'rgba(79,172,246,0.1)', 'rare': 'rgba(93,76,192,0.1)', 'mythical': 'rgba(168,50,208,0.1)', 'legendary': 'rgba(217,70,239,0.1)', 'ancient': 'rgba(255,107,107,0.1)', 'exceedingly_rare': 'rgba(255,170,0,0.1)', 'immortal': 'rgba(184,153,104,0.1)' }; return m[r] || m['common']; }
export function firestoreToUnix(ts) { if (!ts) return null; return ts.seconds ? ts.seconds : Math.floor(ts.getTime() / 1000); }
