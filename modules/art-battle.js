/**
 * modules/art-battle.js - Игра "Art Dice Battle"
 * PvE батл с колодой + кубик как RNG
 */

import { state } from '../app.js';
import * as ui from './ui.js';

/**
 * Показать игру "Art Battle"
 */
export function showArtBattle() {
  const modal = document.createElement('div');
  modal.className = 'modal active';
  modal.id = 'art-battle-modal';
  modal.style.cssText = 'z-index: 9999;';
  
  let playerHP = 20;
  let botHP = 20;
  let round = 1;
  let maxRounds = 10;
  let playerDeck = [];
  let playerHand = [];
  let botDeck = [];
  let currentPlayerCard = null;
  let currentBotCard = null;
  let playerDice = null;
  let botDice = null;
  let difficulty = 'normal';
  
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 900px; max-height: 95vh; overflow-y: auto; padding: 24px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <div>
          <h2 style="margin: 0 0 8px 0; color: var(--text-accent);">⚔️ Art Dice Battle</h2>
          <p style="margin: 0; font-size: 14px; color: var(--text-secondary);">Сражайся картами своей коллекции!</p>
        </div>
        <button class="modal-close" style="padding: 0; width: 36px; height: 36px; font-size: 24px; background: none; border: none; color: var(--text); cursor: pointer;">×</button>
      </div>
      
      <div id="battle-setup" style="display: block;">
        <!-- ВЫБОР СЛОЖНОСТИ -->
        <div style="background: var(--bg-tertiary); padding: 20px; border-radius: 12px; margin-bottom: 20px;">
          <h3 style="margin: 0 0 16px 0; text-align: center;">Выбери сложность:</h3>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
            <button class="difficulty-btn" data-difficulty="easy" style="padding: 16px; background: linear-gradient(135deg, #10B981, #059669); color: white; border: none; border-radius: 8px; cursor: pointer;">
              <div style="font-size: 24px; margin-bottom: 8px;">🟢 Новичок</div>
              <div style="font-size: 12px; opacity: 0.9;">Бот: 15 HP, слабые карты</div>
            </button>
            <button class="difficulty-btn" data-difficulty="normal" style="padding: 16px; background: linear-gradient(135deg, #F59E0B, #D97706); color: white; border: none; border-radius: 8px; cursor: pointer;">
              <div style="font-size: 24px; margin-bottom: 8px;">🟡 Обычный</div>
              <div style="font-size: 12px; opacity: 0.9;">Бот: 20 HP, средние карты</div>
            </button>
            <button class="difficulty-btn" data-difficulty="expert" style="padding: 16px; background: linear-gradient(135deg, #EF4444, #DC2626); color: white; border: none; border-radius: 8px; cursor: pointer;">
              <div style="font-size: 24px; margin-bottom: 8px;">🔴 Эксперт</div>
              <div style="font-size: 12px; opacity: 0.9;">Бот: 25 HP, сильные карты</div>
            </button>
            <button class="difficulty-btn" data-difficulty="boss" style="padding: 16px; background: linear-gradient(135deg, #8B5CF6, #7C3AED); color: white; border: none; border-radius: 8px; cursor: pointer;">
              <div style="font-size: 24px; margin-bottom: 8px;">💀 Босс</div>
              <div style="font-size: 12px; opacity: 0.9;">Бот: 30 HP, только Legendary+</div>
            </button>
          </div>
        </div>
        
        <!-- ВЫБОР КОЛОДЫ -->
        <div style="background: var(--bg-tertiary); padding: 20px; border-radius: 12px;">
          <h3 style="margin: 0 0 16px 0; text-align: center;">Выбери колоду:</h3>
          <div id="deck-selection" style="display: flex; flex-direction: column; gap: 12px;"></div>
        </div>
      </div>
      
      <div id="battle-arena" style="display: none;">
        <!-- HP BARS -->
        <div style="display: flex; justify-content: space-between; margin-bottom: 20px; gap: 20px;">
          <div style="flex: 1; text-align: center;">
            <div style="font-size: 18px; font-weight: 700; color: var(--text-accent); margin-bottom: 8px;">ТЫ</div>
            <div id="player-hp-bar" style="height: 30px; background: linear-gradient(135deg, #EF4444, #DC2626); border-radius: 8px; position: relative; overflow: hidden;">
              <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: white; font-weight: 700; z-index: 1;"><span id="player-hp">20</span> HP</div>
            </div>
          </div>
          <div style="flex: 1; text-align: center;">
            <div style="font-size: 18px; font-weight: 700; color: var(--text-accent); margin-bottom: 8px;">БОТ</div>
            <div id="bot-hp-bar" style="height: 30px; background: linear-gradient(135deg, #8B5CF6, #7C3AED); border-radius: 8px; position: relative; overflow: hidden;">
              <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: white; font-weight: 700; z-index: 1;"><span id="bot-hp">20</span> HP</div>
            </div>
          </div>
        </div>
        
        <!-- ПОЛЕ БОЯ -->
        <div style="display: flex; justify-content: space-around; align-items: center; margin-bottom: 20px; min-height: 300px; gap: 20px;">
          <!-- Карта игрока -->
          <div id="player-card-slot" style="flex: 1; text-align: center;">
            <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 8px;">Твоя карта</div>
            <div id="player-card-display"></div>
          </div>
          
          <!-- VS -->
          <div style="font-size: 48px; font-weight: 700; color: var(--text-accent);">⚔️</div>
          
          <!-- Карта бота -->
          <div id="bot-card-slot" style="flex: 1; text-align: center;">
            <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 8px;">Карта бота</div>
            <div id="bot-card-display"></div>
          </div>
        </div>
        
        <!-- КУБИК -->
        <div style="text-align: center; margin-bottom: 20px;">
          <button id="roll-dice-btn" style="padding: 16px 32px; background: linear-gradient(135deg, #F59E0B, #D97706); color: white; border: none; border-radius: 12px; cursor: pointer; font-weight: 700; font-size: 18px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
            🎲 Бросить кубик!
          </button>
          <div id="dice-result" style="margin-top: 12px; font-size: 14px; color: var(--text-secondary);"></div>
        </div>
        
        <!-- РУКА ИГРОКА -->
        <div style="background: var(--bg-tertiary); padding: 16px; border-radius: 12px;">
          <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 12px; text-align: center;">📋 Твои карты (выбери одну):</div>
          <div id="player-hand" style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;"></div>
        </div>
        
        <!-- РАУНД -->
        <div style="text-align: center; margin-top: 16px; color: var(--text-secondary);">
          🎯 Раунд <span id="current-round">1</span> / ${maxRounds}
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  modal.querySelector('.modal-close').onclick = () => modal.remove();
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  
  // Получение всех уникальных карт из коллекции
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
  
  // Рендер выбора колоды
  function renderDeckSelection() {
    const container = modal.querySelector('#deck-selection');
    const decks = state.currentUser?.decks || {};
    
    if (Object.keys(decks).length === 0) {
      container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-secondary);">У тебя нет колод! Создай колоду в разделе Коллекция.</div>';
      return;
    }
    
    container.innerHTML = Object.entries(decks).map(([deckId, deck]) => {
      const cardCount = Object.keys(deck.cards || {}).length;
      return `
        <button 
          class="select-deck-btn"
          data-deck-id="${deckId}"
          style="padding: 16px; background: var(--bg-secondary); border: 2px solid var(--border-light); border-radius: 8px; cursor: pointer; text-align: left; transition: all 0.2s;"
          onmouseover="this.style.borderColor='var(--text-accent)'"
          onmouseout="this.style.borderColor='var(--border-light)'"
        >
          <div style="font-weight: 700; margin-bottom: 4px;">${deck.name}</div>
          <div style="font-size: 12px; color: var(--text-secondary);">${cardCount} карт</div>
        </button>
      `;
    }).join('');
    
    // Обработчики
    container.querySelectorAll('.select-deck-btn').forEach(btn => {
      btn.onclick = () => {
        const deckId = btn.dataset.deckId;
        startBattle(deckId);
      };
    });
  }
  
  // Выбор сложности
  modal.querySelectorAll('.difficulty-btn').forEach(btn => {
    btn.onclick = () => {
      difficulty = btn.dataset.difficulty;
      
      // Визуальная обратная связь
      modal.querySelectorAll('.difficulty-btn').forEach(b => b.style.opacity = '0.6');
      btn.style.opacity = '1';
    };
  });
  
  // Старт битвы
  function startBattle(deckId) {
    const deck = state.currentUser.decks[deckId];
    if (!deck || !deck.cards) {
      ui.showToast('❌ Ошибка загрузки колоды', 'error');
      return;
    }
    
    // Загружаем карты игрока
    playerDeck = Object.keys(deck.cards)
      .map(cardId => state.cards.find(c => c.id === cardId))
      .filter(c => c);
    
    if (playerDeck.length < 3) {
      ui.showToast('❌ В колоде должно быть минимум 3 карты', 'error');
      return;
    }
    
    // Загружаем карты бота в зависимости от сложности
    botDeck = generateBotDeck(difficulty);
    
    // Устанавливаем HP бота
    switch(difficulty) {
      case 'easy': botHP = 15; break;
      case 'normal': botHP = 20; break;
      case 'expert': botHP = 25; break;
      case 'boss': botHP = 30; break;
    }
    
    playerHP = 20;
    round = 1;
    
    // Перемешиваем колоды
    playerDeck = shuffle(playerDeck);
    botDeck = shuffle(botDeck);
    
    // Раздаём стартовую руку (3 карты)
    drawPlayerHand();
    
    // Показываем арену
    modal.querySelector('#battle-setup').style.display = 'none';
    modal.querySelector('#battle-arena').style.display = 'block';
    
    updateUI();
  }
  
  // Генерация колоды бота
  function generateBotDeck(diff) {
    const allCards = state.cards.filter(c => c);
    let filtered = [];
    
    switch(diff) {
      case 'easy':
        filtered = allCards.filter(c => calculateCardPower(c) < 40);
        break;
      case 'normal':
        filtered = allCards.filter(c => calculateCardPower(c) >= 30 && calculateCardPower(c) < 70);
        break;
      case 'expert':
        filtered = allCards.filter(c => calculateCardPower(c) >= 60);
        break;
      case 'boss':
        filtered = allCards.filter(c => ['legendary', 'ancient', 'ethereal', 'immortal'].includes(c.rarity));
        break;
    }
    
    if (filtered.length < 10) filtered = allCards;
    
    return shuffle(filtered).slice(0, 10);
  }
  
  // Перемешать массив
  function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  
  // Раздать руку игроку
  function drawPlayerHand() {
    playerHand = [];
    for (let i = 0; i < 3 && playerDeck.length > 0; i++) {
      playerHand.push(playerDeck.pop());
    }
    renderPlayerHand();
  }
  
  // Отрисовка руки
  function renderPlayerHand() {
    const container = modal.querySelector('#player-hand');
    container.innerHTML = playerHand.map((card, idx) => {
      const power = calculateCardPower(card);
      return `
        <div 
          class="hand-card"
          data-index="${idx}"
          style="
            width: 120px;
            cursor: pointer;
            transition: transform 0.2s;
          "
          onmouseover="this.style.transform='translateY(-10px)'"
          onmouseout="this.style.transform='translateY(0)'"
        >
          <div style="
            aspect-ratio: 155/268;
            background: url(${card.imageUrl}) center/cover;
            border-radius: 8px;
            border: 2px solid var(--border-light);
            position: relative;
          ">
            <div style="
              position: absolute;
              bottom: 4px;
              left: 4px;
              background: rgba(0,0,0,0.8);
              color: white;
              padding: 4px 8px;
              border-radius: 4px;
              font-size: 12px;
              font-weight: 700;
            ">⚡ ${Math.round(power)}</div>
          </div>
        </div>
      `;
    }).join('');
    
    // Обработчики
    container.querySelectorAll('.hand-card').forEach(card => {
      card.onclick = () => {
        const idx = parseInt(card.dataset.index);
        selectPlayerCard(idx);
      };
    });
  }
  
  // Выбор карты игрока
  function selectPlayerCard(idx) {
    if (currentPlayerCard !== null) return;
    
    currentPlayerCard = playerHand[idx];
    playerHand.splice(idx, 1);
    
    renderCardDisplay('#player-card-display', currentPlayerCard);
    renderPlayerHand();
    
    // Бот выбирает карту
    selectBotCard();
    
    // Активируем кнопку кубика
    modal.querySelector('#roll-dice-btn').disabled = false;
  }
  
  // Выбор карты бота
  function selectBotCard() {
    if (botDeck.length === 0) botDeck = generateBotDeck(difficulty);
    
    currentBotCard = botDeck.pop();
    renderCardDisplay('#bot-card-display', currentBotCard, true);
  }
  
  // Отрисовка карты
  function renderCardDisplay(selector, card, hidden = false) {
    const container = modal.querySelector(selector);
    const power = calculateCardPower(card);
    
    container.innerHTML = `
      <div style="width: 150px; margin: 0 auto;">
        <div style="
          aspect-ratio: 155/268;
          background: ${hidden ? 'linear-gradient(135deg, #8B5CF6, #7C3AED)' : `url(${card.imageUrl}) center/cover`};
          border-radius: 12px;
          border: 3px solid var(--border-light);
          position: relative;
          box-shadow: 0 8px 16px rgba(0,0,0,0.3);
        ">
          ${hidden ? `
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 48px;">🎴</div>
          ` : `
            <div style="
              position: absolute;
              bottom: 8px;
              left: 8px;
              background: rgba(0,0,0,0.9);
              color: white;
              padding: 6px 12px;
              border-radius: 6px;
              font-size: 14px;
              font-weight: 700;
            ">⚡ ${Math.round(power)}</div>
          `}
        </div>
        ${!hidden ? `<div style="text-align: center; margin-top: 8px; font-size: 12px; color: var(--text-secondary);">${card.title}</div>` : ''}
      </div>
    `;
  }
  
  // Бросок кубика
  modal.querySelector('#roll-dice-btn').onclick = () => {
    if (!currentPlayerCard || !currentBotCard) return;
    
    // Броски
    playerDice = rollDice();
    botDice = rollDice();
    
    // Показываем результаты
    const resultDiv = modal.querySelector('#dice-result');
    resultDiv.innerHTML = `
      <div style="font-size: 16px; font-weight: 700;">
        Ты: 🎲 ${playerDice} | Бот: 🎲 ${botDice}
      </div>
    `;
    
    // Рассчёт урона
    setTimeout(() => {
      resolveBattle();
    }, 1000);
    
    modal.querySelector('#roll-dice-btn').disabled = true;
  };
  
  // Бросок кубика
  function rollDice() {
    return Math.floor(Math.random() * 6) + 1;
  }
  
  // Модификатор от кубика
  function getDiceModifier(dice) {
    const modifiers = {
      1: 0.7,
      2: 0.85,
      3: 1.0,
      4: 1.0,
      5: 1.15,
      6: 1.3
    };
    return modifiers[dice];
  }
  
  // Расчёт силы карты
  function calculateCardPower(card) {
    const base = (card.resonance || 5) + (card.virtuosity || 5) + (card.profundity || 5) + (card.harmony || 5);
    
    const rarityMultipliers = {
      common: 1.0,
      uncommon: 1.2,
      rare: 1.5,
      mythical: 2.0,
      legendary: 2.5,
      ancient: 3.0,
      ethereal: 4.0,
      immortal: 5.0
    };
    
    return base * (rarityMultipliers[card.rarity] || 1.0);
  }
  
  // Разрешение битвы
  function resolveBattle() {
    const playerPower = calculateCardPower(currentPlayerCard) * getDiceModifier(playerDice);
    const botPower = calculateCardPower(currentBotCard) * getDiceModifier(botDice);
    
    // Открываем карту бота
    renderCardDisplay('#bot-card-display', currentBotCard, false);
    
    setTimeout(() => {
      const damage = Math.abs(Math.round(playerPower - botPower));
      
      if (playerPower > botPower) {
        botHP = Math.max(0, botHP - damage);
        ui.showToast(`💥 Ты нанёс ${damage} урона!`, 'success');
      } else if (botPower > playerPower) {
        playerHP = Math.max(0, playerHP - damage);
        ui.showToast(`😢 Ты получил ${damage} урона!`, 'error');
      } else {
        ui.showToast('⚖️ Ничья!', 'info');
      }
      
      updateUI();
      
      setTimeout(() => {
        checkGameEnd();
      }, 1000);
    }, 1000);
  }
  
  // Обновление UI
  function updateUI() {
    modal.querySelector('#player-hp').textContent = playerHP;
    modal.querySelector('#bot-hp').textContent = botHP;
    modal.querySelector('#current-round').textContent = round;
    
    // HP бары
    const playerBar = modal.querySelector('#player-hp-bar');
    const botBar = modal.querySelector('#bot-hp-bar');
    playerBar.style.width = `${(playerHP / 20) * 100}%`;
    botBar.style.width = `${(botHP / (difficulty === 'easy' ? 15 : difficulty === 'normal' ? 20 : difficulty === 'expert' ? 25 : 30)) * 100}%`;
  }
  
  // Проверка конца игры
  function checkGameEnd() {
    if (playerHP <= 0) {
      ui.showToast('😢 Поражение! Попробуй снова', 'error');
      setTimeout(() => modal.remove(), 2000);
      return;
    }
    
    if (botHP <= 0) {
      const rewards = { easy: 50, normal: 100, expert: 200, boss: 500 };
      const reward = rewards[difficulty];
      
      ui.showToast(`🎉 Победа! +${reward} 💎`, 'success');
      
      // Начисляем награду
      if (state.currentUser) {
        state.currentUser.currency = (state.currentUser.currency || 0) + reward;
        firebase.firestore().collection('users').doc(firebase.auth().currentUser.uid)
          .update({ currency: state.currentUser.currency });
      }
      
      setTimeout(() => modal.remove(), 2000);
      return;
    }
    
    if (round >= maxRounds) {
      ui.showToast('⏱️ Время вышло! Ничья', 'info');
      setTimeout(() => modal.remove(), 2000);
      return;
    }
    
    // Следующий раунд
    nextRound();
  }
  
  // Следующий раунд
  function nextRound() {
    round++;
    currentPlayerCard = null;
    currentBotCard = null;
    playerDice = null;
    botDice = null;
    
    // Очищаем поле
    modal.querySelector('#player-card-display').innerHTML = '<div style="text-align: center; color: var(--text-secondary); padding: 40px 0;">Выбери карту</div>';
    modal.querySelector('#bot-card-display').innerHTML = '';
    modal.querySelector('#dice-result').innerHTML = '';
    
    // Пополняем руку
    if (playerHand.length < 3 && playerDeck.length > 0) {
      drawPlayerHand();
    }
    
    updateUI();
  }
  
  // Инициализация
  renderDeckSelection();
}
