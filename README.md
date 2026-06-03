# 🍕 POS Система для ресторану

Повнофункціональна POS система з підтримкою двох мов (українська та литовська), управлінням складом, музичним плеєром та оптимізацією для планшетів.

## 🚀 Швидкий старт

### Встановлення
```bash
npm install
```

### Запуск
```bash
# Швидкий запуск (оптимізований)
start-fast.bat

# Або стандартний
npm run dev
```

Відкрийте: http://localhost:3000

## 📋 Основні функції

### ✅ POS Система
- Прийом замовлень
- Різні типи замовлень (їжа на місці, з собою, доставка)
- Модифікатори та додатки
- Знижки та акції
- Друк чеків

### ✅ Управління складом
- Облік товарів
- Приход/списання
- Мобільний інтерфейс для планшета
- Автоматичний розрахунок упаковок

### ✅ Багатомовність
- 🇺🇦 Українська
- 🇱🇹 Литовська
- Перемикач мови в інтерфейсі
- Автоматичне збереження вибору

### ✅ Музичний плеєр
- Серверне відтворення (на ПК)
- Плейлисти
- Автоматичне переключення треків
- Збереження стану відтворення

### ✅ Захист даних
- Валідація всіх полів
- Захист від подвійного натискання
- Захист від дублікатів товарів
- Обробка помилок

## 📁 Структура проекту

```
pos12/
├── app/                      # Next.js сторінки
│   ├── page.tsx             # Головна POS система
│   ├── admin/               # Адмін панель
│   │   ├── inventory/       # Управління складом
│   │   └── inventory-mobile/ # Мобільна версія
│   └── api/                 # API endpoints
│       ├── inventory/       # API складу
│       └── music/           # API музики
├── components/              # React компоненти
│   ├── MusicPlayer.tsx     # Музичний плеєр
│   └── LanguageSwitcher.tsx # Перемикач мови
├── hooks/                   # Custom hooks
│   ├── useLanguage.ts      # Hook для мови
│   └── useOrderManagement.ts # Управління замовленнями
├── lib/                     # Утиліти
│   ├── translations.ts     # Переклади
│   └── validation.ts       # Валідація
└── public/                  # Статичні файли
    ├── music/              # Музичні файли
    └── sounds/             # Звукові ефекти
```

## 🔧 Конфігурація

### База даних
SQLite база даних: `pos.db`

### Змінні оточення
Файл: `.env.local`
```env
DATABASE_URL=./pos.db
NEXT_TELEMETRY_DISABLED=1
NODE_ENV=development
NODE_OPTIONS=--max-old-space-size=4096
```

## 📱 Мобільний інтерфейс

### Приход товару на планшеті
URL: `/admin/inventory-mobile`

**Особливості:**
- Великі кнопки для пальців
- Швидке додавання кількості
- Розрахунок по упаковках
- Діалогове вікно для введення

## 🎵 Музичний плеєр

### Серверне відтворення
Музика відтворюється на ПК (сервері), а не в браузері.

**Налаштування:**
```typescript
<MusicPlayer serverPlayback={true} />
```

**Тестування:**
```bash
test-music.bat
```

## 🌍 Багатомовність

### Використання в компонентах
```typescript
import { useLanguage } from '@/hooks/useLanguage'
import { t } from '@/lib/translations'

const { language } = useLanguage()
const translate = t(language)

// Використання
<h1>{translate('itemReceipt')}</h1>
```

### Додавання перекладів
Файл: `lib/translations.ts`
```typescript
export const translations = {
  uk: { myKey: 'Мій текст' },
  lt: { myKey: 'Mano tekstas' }
}
```

## 🛡️ Валідація та захист

### Автоматичний захист
- ✅ Валідація всіх полів форм
- ✅ Захист від подвійного натискання
- ✅ Перевірка на дублікати
- ✅ Обмеження максимальних значень
- ✅ Очищення небезпечних символів

### Використання
```typescript
import { validateNotEmpty, validateNumber } from '@/lib/validation'
import { useClickProtection } from '@/hooks/useClickProtection'

const { protect } = useClickProtection()

await protect('submit', async () => {
  // Ваш код
})
```

## 📚 Документація

- `MULTILANGUAGE.md` - Система перекладів
- `VALIDATION_PROTECTION.md` - Захист даних
- `MOBILE_INVENTORY.md` - Мобільний інтерфейс
- `MUSIC_TEST_GUIDE.md` - Тестування музики
- `MUSIC_TROUBLESHOOTING.md` - Діагностика музики
- `OPTIMIZATION_GUIDE.md` - Оптимізація
- `QUICK_START.md` - Швидкий старт
- `SETUP_NEW_PC.md` - Налаштування на новому ПК

## 🔨 Корисні скрипти

```bash
# Швидкий запуск (оптимізований)
start-fast.bat

# Production режим
start-production.bat

# Перезапуск
restart.bat

# Тест музики
test-music.bat
```

## 🐛 Діагностика

### Проблеми з музикою
```bash
# Перевірка PowerShell та музичних файлів
test-music.bat
```

### Проблеми з продуктивністю
Використовуйте оптимізовані скрипти:
- `start-fast.bat` - для розробки
- `start-production.bat` - для production

## 💾 Резервне копіювання

### База даних
```bash
copy pos.db pos.db.backup
```

### Музичні файли
```bash
xcopy public\music public\music.backup /E /I
```

## 🔄 Оновлення

```bash
# Оновити залежності
npm update

# Перезібрати проект
npm run build
```

## ⚙️ Технології

- **Frontend:** Next.js 15, React, TypeScript
- **UI:** Tailwind CSS, shadcn/ui
- **База даних:** SQLite
- **Іконки:** Lucide React
- **Музика:** PowerShell (Windows)

## 📝 Ліцензія

Приватний проект для внутрішнього використання.

## 🆘 Підтримка

При виникненні проблем:
1. Перевірте документацію у відповідних MD файлах
2. Запустіть діагностичні скрипти
3. Перевірте консоль браузера (F12)
4. Перевірте логи сервера

---

**Версія:** 1.0.0  
**Останнє оновлення:** Січень 2026
