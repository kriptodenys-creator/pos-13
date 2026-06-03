# 🌍 Підтримка двох мов (Українська та Литовська)

## Що було додано

Проект тепер підтримує дві мови:
- 🇺🇦 **Українська** (за замовчуванням)
- 🇱🇹 **Литовська**

## Структура

### 1. Файл перекладів
**Файл:** `lib/translations.ts`

Містить всі переклади для обох мов:

```typescript
export const translations = {
  uk: {
    back: 'Назад',
    save: 'Зберегти',
    itemReceipt: 'Приход товару',
    // ... інші переклади
  },
  lt: {
    back: 'Atgal',
    save: 'Išsaugoti',
    itemReceipt: 'Prekių gavimas',
    // ... інші переклади
  }
}
```

### 2. Hook для мови
**Файл:** `hooks/useLanguage.ts`

```typescript
const { language, setLanguage, toggleLanguage } = useLanguage()
```

- `language` - поточна мова ('uk' або 'lt')
- `setLanguage(lang)` - встановити мову
- `toggleLanguage()` - перемкнути мову

### 3. Компонент перемикача
**Файл:** `components/LanguageSwitcher.tsx`

Кнопка для перемикання мови:
```typescript
<LanguageSwitcher />
```

Показує: `🇺🇦 УКР` або `🇱🇹 LT`

## Використання

### У компоненті

```typescript
import { useLanguage } from '@/hooks/useLanguage'
import { t } from '@/lib/translations'

function MyComponent() {
  const { language } = useLanguage()
  const translate = t(language)
  
  return (
    <div>
      <h1>{translate('itemReceipt')}</h1>
      <button>{translate('save')}</button>
    </div>
  )
}
```

### Додавання нових перекладів

Відкрийте `lib/translations.ts` та додайте новий ключ:

```typescript
export const translations = {
  uk: {
    // ... існуючі
    myNewKey: 'Мій новий текст',
  },
  lt: {
    // ... існуючі
    myNewKey: 'Mano naujas tekstas',
  }
}
```

Використання:
```typescript
{translate('myNewKey')}
```

## Де вже перекладено

### ✅ Сторінка приходу товару
**Файл:** `app/admin/inventory-mobile/page.tsx`

Перекладено:
- Заголовок сторінки
- Кнопки (Назад, Підтвердити, Скасувати)
- Поля форми (Кількість, Упаковок, Ціна, Причина)
- Повідомлення про помилки
- Статуси завантаження

**Перемикач мови:** У правому верхньому куті

## Доступні переклади

| Ключ | Українська | Литовська |
|------|-----------|-----------|
| `back` | Назад | Atgal |
| `save` | Зберегти | Išsaugoti |
| `cancel` | Скасувати | Atšaukti |
| `confirm` | Підтвердити | Patvirtinti |
| `search` | Пошук | Paieška |
| `loading` | Завантаження... | Kraunama... |
| `itemReceipt` | Приход товару | Prekių gavimas |
| `quantity` | Кількість | Kiekis |
| `currentStock` | Залишок | Likutis |
| `quickAdd` | Швидке додавання | Greitas pridėjimas |
| `packages` | Упаковок | Pakuočių |
| `unitsPerPackage` | Одиниць в упаковці | Vienetų pakuotėje |
| `totalQuantity` | Загальна кількість | Bendras kiekis |
| `costPerUnit` | Ціна за одиницю | Kaina už vienetą |
| `reason` | Причина | Priežastis |
| `defaultReason` | Приход товару | Prekių gavimas |
| `saving` | Збереження... | Išsaugoma... |
| `itemNotSelected` | Виберіть товар | Pasirinkite prekę |
| `enterValidQuantity` | Введіть коректну кількість (більше 0) | Įveskite teisingą kiekį (daugiau nei 0) |
| `quantityTooLarge` | Кількість занадто велика (максимум 10000) | Kiekis per didelis (maksimumas 10000) |
| `enterValidPrice` | Введіть коректну ціну | Įveskite teisingą kainą |
| `itemNotFound` | Товар не знайдено | Prekė nerasta |
| `noItems` | Немає товарів | Nėra prekių |

[Повний список у файлі `lib/translations.ts`]

## Одиниці виміру

| Українська | Литовська |
|-----------|-----------|
| кг | kg |
| г | g |
| л | l |
| мл | ml |
| шт | vnt |
| уп | pak |

## Збереження вибору мови

Вибрана мова зберігається в `localStorage` і автоматично відновлюється при наступному відкритті.

```typescript
// Зберігається як:
localStorage.setItem('app_language', 'uk') // або 'lt'
```

## Тестування

### Тест 1: Перемикання мови
1. Відкрийте http://localhost:3000/admin/inventory-mobile
2. Натисніть кнопку `🇺🇦 УКР` у правому верхньому куті
3. Мова змінюється на литовську `🇱🇹 LT`
4. Весь текст перекладається
5. Натисніть ще раз - повертається українська

### Тест 2: Збереження вибору
1. Виберіть литовську мову
2. Закрийте браузер
3. Відкрийте знову
4. **Очікується:** Литовська мова залишилася

### Тест 3: Переклад помилок
1. Виберіть литовську мову
2. Натисніть на товар
3. Не вводьте кількість
4. Натисніть "Patvirtinti"
5. **Очікується:** Помилка литовською: "Įveskite teisingą kiekį (daugiau nei 0)"

## Додавання перекладів в інші компоненти

### Приклад: Адмін панель

```typescript
// app/admin/page.tsx
import { useLanguage } from '@/hooks/useLanguage'
import { t } from '@/lib/translations'
import LanguageSwitcher from '@/components/LanguageSwitcher'

export default function AdminPage() {
  const { language } = useLanguage()
  const translate = t(language)
  
  return (
    <div>
      <div className="flex justify-between">
        <h1>{translate('adminPanel')}</h1>
        <LanguageSwitcher />
      </div>
      
      <div>
        <h2>{translate('inventory')}</h2>
        <p>{translate('inventoryManagement')}</p>
      </div>
    </div>
  )
}
```

### Приклад: POS система

```typescript
// app/page.tsx
const { language } = useLanguage()
const translate = t(language)

// Використання:
<button>{translate('confirm')}</button>
<h1>{translate('orders')}</h1>
```

## Розширення системи

### Додавання третьої мови (наприклад, англійської)

1. Оновіть тип у `lib/translations.ts`:
```typescript
export type Language = 'uk' | 'lt' | 'en'
```

2. Додайте переклади:
```typescript
export const translations = {
  uk: { /* ... */ },
  lt: { /* ... */ },
  en: {
    back: 'Back',
    save: 'Save',
    // ...
  }
}
```

3. Оновіть `LanguageSwitcher.tsx`:
```typescript
const languages: Language[] = ['uk', 'lt', 'en']
const flags = { uk: '🇺🇦', lt: '🇱🇹', en: '🇬🇧' }
```

## Переваги

✅ **Централізовані переклади** - всі тексти в одному місці  
✅ **Type-safe** - TypeScript перевіряє ключі перекладів  
✅ **Легко додавати** - просто додайте новий ключ  
✅ **Автоматичне збереження** - вибір мови зберігається  
✅ **Простий API** - `translate('key')`  
✅ **Зручний перемикач** - одна кнопка  

## Файли системи

- `lib/translations.ts` - всі переклади
- `hooks/useLanguage.ts` - hook для роботи з мовою
- `components/LanguageSwitcher.tsx` - кнопка перемикання
- `app/admin/inventory-mobile/page.tsx` - приклад використання

## Наступні кроки

Для повної підтримки мов потрібно перекласти:
- [ ] Головну сторінку POS системи
- [ ] Адмін панель
- [ ] Сторінку управління складом
- [ ] Сторінку меню
- [ ] Сторінку співробітників
- [ ] Сторінку звітів
- [ ] Повідомлення про помилки в API

Використовуйте той самий підхід:
```typescript
const { language } = useLanguage()
const translate = t(language)
```

Проект готовий до роботи з двома мовами! 🌍
