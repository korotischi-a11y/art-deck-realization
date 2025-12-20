/**
 * raids.js - Raid system with genre interactions
 * 
 * МЕХАНИКА:
 * - Игрок собирает отряд из 4 карт
 * - Выбирает галерею противника для рейда
 * - Проходит через 5 комнат
 * - В каждой комнате - бой с картой противника
 * - Побеждает = награды
 */

import { state } from '../app.js';

// === КОНСТАНТЫ ЖАНРОВ ===
export const GENRES = {
  portrait: '👤',
  landscape: '🌄',
  still_life: '🍎',
  religious: '⛪',
  mythological: '🐉',
  abstract: '🎨',
  urban: '🏙️',
  nude: '💃'
};

export const GENRE_NAMES = {
  portrait: 'Портрет',
  landscape: 'Пейзаж',
  still_life: 'Натюрморт',
  religious: 'Религия',
  mythological: 'Мифология',
  abstract: 'Абстракция',
  urban: 'Городской',
  nude: 'Ню'
};

// === ТАБЛИЦА ЭФФЕКТИВНОСТИ ЖАНРОВ ===
// +50% = 1.5, -30% = 0.7, нейтрально = 1.0
export const GENRE_EFFECTIVENESS = {
  portrait: {
    portrait: 1.0,
    landscape: 0.7,   // Слаб против массовых атак
    still_life: 1.5,  // Уничтожает предметы
    religious: 0.7,   // Слаб против божественного
    mythological: 0.7, // Слаб против монстров
    abstract: 1.0,
    urban: 1.5,       // Личность > система
    nude: 1.0         // RNG (обрабатывается отдельно)
  },
  landscape: {
    portrait: 1.5,    // Массовая атака против героя
    landscape: 1.0,
    still_life: 0.7,  // Слаб против контроля природы
    religious: 0.7,   // Слаб против божественного
    mythological: 1.0,
    abstract: 1.0,
    urban: 0.7,       // Слаб против цивилизации
    nude: 1.0
  },
  still_life: {
    portrait: 0.7,    // Предметы уничтожаются героями
    landscape: 1.5,   // Контролирует природу
    still_life: 1.0,
    religious: 1.0,
    mythological: 0.7, // Магия > предметы
    abstract: 1.5,    // Стабилизирует хаос
    urban: 1.0,
    nude: 1.0
  },
  religious: {
    portrait: 1.0,
    landscape: 1.5,   // Божественное > земное
    still_life: 1.0,
    religious: 1.0,
    mythological: 1.5, // Свет > тьма
    abstract: 0.7,    // Слаб против хаоса
    urban: 1.0,
    nude: 0.7         // Слаб против соблазна
  },
  mythological: {
    portrait: 1.5,    // Монстр > герой
    landscape: 1.0,
    still_life: 1.5,  // Магия > предметы
    religious: 0.7,   // Тьма < свет
    mythological: 1.0,
    abstract: 0.7,    // Слаб против хаоса
    urban: 1.5,       // Магия > технология
    nude: 1.0
  },
  abstract: {
    portrait: 1.0,
    landscape: 1.0,
    still_life: 0.7,  // Слаб против стабильности
    religious: 1.5,   // Хаос > порядок
    mythological: 1.5,
    abstract: 1.0,
    urban: 1.0,
    nude: 1.5
  },
  urban: {
    portrait: 0.7,    // Система < личность
    landscape: 1.5,   // Цивилизация > дикость
    still_life: 1.0,
    religious: 1.0,
    mythological: 0.7, // Технология < магия
    abstract: 1.0,
    urban: 1.0,
    nude: 1.5         // Общество подавляет
  },
  nude: {
    portrait: 1.0,    // RNG (обрабатывается отдельно)
    landscape: 1.0,
    still_life: 1.0,
    religious: 1.5,   // Грех > святость
    mythological: 1.0,
    abstract: 0.7,    // Хаос не чувствует
    urban: 0.7,       // Общество подавляет
    nude: 1.0
  }
};

// === РАСЧЁТ УРОНА ===
export function calculateDamage(attacker, defender, attackerCopies = 1) {
  let baseDamage = attacker.virtuosity || 5;
  
  // 1. БОНУС ОТ ЭФФЕКТИВНОСТИ ЖАНРОВ
  const effectiveness = GENRE_EFFECTIVENESS[attacker.genre]?.[defender.genre] || 1.0;
  baseDamage *= effectiveness;
  
  // 2. МЕХАНИКА ПЕЙЗАЖЕЙ: стаки
  if (attacker.genre === 'landscape' && attackerCopies > 1) {
    const stackBonus = 1 + (attackerCopies - 1) * 0.25; // +25% за каждую копию
    baseDamage *= stackBonus;
  }
  
  // 3. МЕХАНИКА МИФОЛОГИИ: критический урон
  if (attacker.genre === 'mythological') {
    const critChance = 0.3; // 30% шанс крита
    if (Math.random() < critChance) {
      baseDamage *= 2;
      console.log('💥 КРИТИЧЕСКИЙ УДАР!');
    }
  }
  
  // 4. МЕХАНИКА МИФОЛОГИИ: берсерк
  if (attacker.genre === 'mythological' && attacker.currentHP < attacker.resonance * 0.5) {
    baseDamage *= 1.5;
    console.log('😈 БЕРСЕРК!');
  }
  
  // 5. ЗАЩИТА (Profundity)
  const defense = defender.profundity || 0;
  const damageReduction = Math.min(defense * 0.05, 0.5); // Макс 50% редукции
  baseDamage *= (1 - damageReduction);
  
  // 6. МЕХАНИКА URBAN: баррикады против массовых атак
  if (defender.genre === 'urban' && attacker.genre === 'landscape') {
    baseDamage *= 0.7; // -30% урон
    console.log('🛡️ БАРРИКАДА!');
  }
  
  return Math.max(1, Math.round(baseDamage));
}

// === МЕХАНИКА НЮ: ОЧАРОВАНИЕ ===
export function checkNudeCharm(nude, target) {
  if (nude.genre !== 'nude' || target.genre !== 'portrait') {
    return null;
  }
  
  const roll = Math.random();
  
  if (roll < 0.5) {
    // ПОХОТЬ: пропуск хода + дебафф
    return {
      type: 'lust',
      effect: 'skip_turn',
      message: `😈 ${target.title} очарован! Пропускает ход.`,
      debuff: { attack: -0.3 }
    };
  } else {
    // РОМАНТИКА: бафф атаки
    return {
      type: 'romance',
      effect: 'buff',
      message: `💝 ${target.title} вдохновлён! +50% атака.`,
      buff: { attack: 1.5, hp: 2 }
    };
  }
}

// === МЕХАНИКА АБСТРАКЦИИ: СЛУЧАЙНЫЕ ЭФФЕКТЫ ===
export function triggerAbstractChaos() {
  const effects = [
    { name: 'buff_all', message: '⚡ Все союзники получают +5 атаки!', value: 5 },
    { name: 'damage_random', message: '💥 Случайная карта получает 3 урона!', value: 3 },
    { name: 'miss_next', message: '🌀 Следующая атака промахивается!', value: 0 },
    { name: 'stun_enemy', message: '😵 Враг теряет ход!', value: 0 },
    { name: 'crit_chance', message: '✨ +50% шанс крита на 1 ход!', value: 0.5 },
    { name: 'swap_positions', message: '🔀 Карты меняются местами!', value: 0 }
  ];
  
  return effects[Math.floor(Math.random() * effects.length)];
}

// === МЕХАНИКА STILL LIFE: БАФФЫ ===
export function applyStillLifeBuff(stillLife, target) {
  return {
    attackBonus: 3,
    healPerTurn: 1,
    landscapeReduction: target.genre === 'landscape' ? 0.5 : 1.0,
    message: `🍎 ${stillLife.title} усиливает ${target.title}!`
  };
}

// === МЕХАНИКА RELIGIOUS: ИСЦЕЛЕНИЕ ===
export function applyReligiousHeal(religious, allies) {
  const healAmount = 3;
  allies.forEach(ally => {
    if (ally.currentHP < ally.resonance) {
      ally.currentHP = Math.min(ally.currentHP + healAmount, ally.resonance);
    }
  });
  return { message: `✨ ${religious.title} исцеляет отряд на ${healAmount} HP!` };
}

// === СОСТОЯНИЕ РЕЙДА ===
export const raidState = {
  currentRaid: null,
  playerSquad: [],
  enemyGallery: null,
  currentRoom: 0,
  totalRooms: 5,
  rewards: { coins: 0, packs: [], rating: 0 },
  battleLog: []
};

// === СОЗДАНИЕ ОТРЯДА ===
export function createSquad(cardIds) {
  if (cardIds.length > 4) {
    throw new Error('Максимум 4 карты в отряде!');
  }
  
  const squad = cardIds.map(id => {
    const card = state.cards.find(c => c.id === id);
    if (!card) throw new Error(`Карта ${id} не найдена!`);
    
    return {
      ...card,
      currentHP: card.resonance || 5,
      maxHP: card.resonance || 5,
      buffs: [],
      debuffs: [],
      skipTurn: false
    };
  });
  
  raidState.playerSquad = squad;
  return squad;
}

// === НАЧАЛО РЕЙДА ===
export function startRaid(galleryId) {
  // TODO: Загрузить галерею из Firestore
  raidState.currentRaid = galleryId;
  raidState.currentRoom = 0;
  raidState.battleLog = [];
  raidState.rewards = { coins: 0, packs: [], rating: 0 };
  
  console.log('⚔️ Рейд начат!', { gallery: galleryId, squad: raidState.playerSquad });
}

// === БОЙ (упрощённая версия для MVP) ===
export function simulateBattle(playerCard, enemyCard) {
  const log = [];
  
  let pHP = playerCard.currentHP;
  let eHP = enemyCard.currentHP || enemyCard.resonance;
  
  let turn = 1;
  const maxTurns = 20; // Защита от бесконечного цикла
  
  while (pHP > 0 && eHP > 0 && turn <= maxTurns) {
    // ХОД ИГРОКА
    if (!playerCard.skipTurn) {
      const dmg = calculateDamage(playerCard, enemyCard);
      eHP -= dmg;
      log.push(`[ХОД ${turn}] ${playerCard.title} атакует → ${dmg} урона`);
    } else {
      log.push(`[ХОД ${turn}] ${playerCard.title} пропускает ход (очарован)`);
      playerCard.skipTurn = false;
    }
    
    if (eHP <= 0) break;
    
    // ХОД ВРАГА
    const dmg = calculateDamage(enemyCard, playerCard);
    pHP -= dmg;
    log.push(`[ХОД ${turn}] ${enemyCard.title} атакует → ${dmg} урона`);
    
    turn++;
  }
  
  playerCard.currentHP = Math.max(0, pHP);
  
  const victory = pHP > 0;
  log.push(victory ? '🏆 ПОБЕДА!' : '💀 ПОРАЖЕНИЕ!');
  
  raidState.battleLog.push(...log);
  
  return { victory, log, playerHP: pHP, enemyHP: eHP };
}

// === ЭКСПОРТ ===
export default {
  GENRES,
  GENRE_NAMES,
  GENRE_EFFECTIVENESS,
  calculateDamage,
  checkNudeCharm,
  triggerAbstractChaos,
  applyStillLifeBuff,
  applyReligiousHeal,
  raidState,
  createSquad,
  startRaid,
  simulateBattle
};
