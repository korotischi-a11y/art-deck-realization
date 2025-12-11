# 🚀 Деплой на Vercel

## 📄 Овервью

Art Deck - это статичное SPA приложение, которое можно распределить исключительно на CDN.

**Конфигурации уже внесены:**
- ✅ `vercel.json` - энайтинг SPA
- ✅ `.vercelignore` - игнорирование (ускорение деплое)
- ✅ `.gitignore` - безопасность 

---

## 🎉 Настройка Firestore

**ИМПОРТАНТО: Это ОБАЗАТЕЛЬНО сделать ВРУЧНУЮ!**

### Шаг 1: Firestore Security Rules

1. Перейди https://console.firebase.google.com/project/art-deck-366b5/firestore/rules
2. Найди кнопку **Edit rules** (blue button)
3. Очисти текущие рулы
4. **Скопируй это:**

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper functions
    function isSignedIn() {
      return request.auth != null;
    }
    
    function isOwner(userId) {
      return request.auth.uid == userId;
    }
    
    function isAdmin() {
      return isSignedIn() && 
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
    }
    
    // Users collection - each user can read/write only their own doc
    match /users/{userId} {
      allow read: if isOwner(userId) || isAdmin();
      allow write: if isOwner(userId);
      allow create: if isSignedIn();
    }
    
    // Master cards - anyone can read, only admins can write
    match /masterCards/{cardId} {
      allow read: if isSignedIn();
      allow create, update, delete: if isAdmin();
    }
  }
}
```

5. Нажми **Publish** (blue button)
6. Подожди 1-2 минуты до распределения

---

## 📍 ПОЛНАЯ ИНСТРУКЦИЯ: деплой

### Опция 1: Vercel GitHub Integration (ЛУЧШЕ)

1. **Перейди** https://vercel.com
2. **Логин** через GitHub
3. **Нажми** "Add New..." → "Project"
4. **Экспортируй** `art-deck-realization`
5. **Настройки (defaults ОК):**
   - Framework: `Other` (где vercel.json)
   - Root: `.` (на текущая директория)
   - Build command: `echo 'No build needed'` (vercel.json переопределяет)
   - Output: `.`
6. **Деплой** нажми кнопку
7. **Подожди** ~1 минуту
8. Пинг URL я дау тебе - всё! 🎆

### Опция 2: Vercel CLI

```bash
# Установка
npm i -g vercel

# Логин
vercel login

# Перено в проект
cd art-deck-realization

# Деплой
vercel

# Production
vercel --prod
```

---

## ✅ Проверка деплое

После деплое Vercel даст URL вроде:
```
https://art-deck-realization.vercel.app
```

Распределенное приложение в интернете!

### Открытие:
1. Откроется медленно? 
   → проверь F12 консоль (ошибки Firebase?)
2. Ошибка 401?
   → Firestore Rules не активны ещё, подожди
3. Не видит эндпоинты?
   → Проверь config.js — ключи верны?

---

## 🌈 Auto Deploy

**Отличные новости:** Каждый раз, когда ты:
- Пушиш в GitHub main
- Vercel **автоматически распределяет** новые изменения
- ✅ **Ливе обновления** в ~30 сек

**Оптимизация:**
- Если деплое медленные, чисти у Vercel `.vercelignore`
- Если Vercel строит долго, проверь vercel.json:
  - `buildCommand: "echo 'No build needed'"` (no Node/NPM builds)

---

## 🔍 Firestore Best Practices

### От НОЛЕЧАТЕЉ:
- ❌ Правила с `allow read, write: if true;` (произвольные данные)
- ❌ От внесения secrets/API keys в код
- ❌ От использования Service Account в frontend

### От КОНТРОЛЯ:
- Категорически посмотри Firestore Rules
- Категорически проверь монеты на клиенте
- Всегда валидируй на Firestore Rules

---

## 📄 Useful Links

- **Vercel Dashboard**: https://vercel.com/dashboard
- **Firebase Console**: https://console.firebase.google.com/project/art-deck-366b5
- **GitHub Repo**: https://github.com/korotischi-a11y/art-deck-realization
- **Vercel Docs**: https://vercel.com/docs

---

## 🙋 Не чинится?

Если после деплое что-то блокится:

1. **Clear Vercel Cache**:
   - https://vercel.com/dashboard/YOUR_USERNAME/deployments
   - Клик на не работающем деплое
   - Redeploy

2. **Check Firestore Rules** (большинство проблем)

3. **Check Network** (F12 → Network tab)

4. **Reddit/Discord** if stuck
