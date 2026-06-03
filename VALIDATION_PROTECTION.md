# 🛡️ Система захисту від дублікатів, подвійних натискань та пустих значень

## Що було додано

### 1. ✅ Utility функції для валідації
**Файл:** `lib/validation.ts`

#### Функції:
- `debounce()` - затримка виконання функції
- `throttle()` - обмеження частоти викликів
- `ClickProtection` - клас для захисту від подвійних кліків
- `validateNotEmpty()` - перевірка на пусті значення
- `validateNumber()` - валідація чисел
- `hasDuplicates()` - перевірка на дублікати в масиві
- `findDuplicates()` - знаходження дублікатів
- `removeDuplicates()` - видалення дублікатів
- `validateForm()` - валідація форм
- `sanitizeString()` - очищення рядків
- `validateEmail()` - валідація email
- `validatePhone()` - валідація телефону

#### Приклад використання:
```typescript
import { validateNotEmpty, validateNumber, clickProtection } from '@/lib/validation'

// Перевірка на пусті значення
const error = validateNotEmpty(value, 'Назва товару')
if (error) {
  console.error(error) // "Назва товару не може бути порожнім"
}

// Валідація числа
const error = validateNumber(price, 'Ціна', { min: 0, max: 10000 })

// Захист від подвійного кліку
const result = await clickProtection.execute('submit-order', async () => {
  return await submitOrder()
})
```

### 2. ✅ Hook для захисту від подвійних кліків
**Файл:** `hooks/useClickProtection.ts`

```typescript
import { useClickProtection } from '@/hooks/useClickProtection'

function MyComponent() {
  const { protect, isProcessing } = useClickProtection(1000)
  
  const handleClick = async () => {
    const result = await protect('my-action', async () => {
      // Ваш код
      return await doSomething()
    })
    
    if (result === null) {
      console.log('Duplicate click blocked')
    }
  }
  
  return (
    <button 
      onClick={handleClick}
      disabled={isProcessing('my-action')}
    >
      Submit
    </button>
  )
}
```

### 3. ✅ Захист у додаванні товарів до кошика
**Файл:** `hooks/useOrderManagement.ts`

#### Що перевіряється:
- ✅ Товар не порожній (є ID та назва)
- ✅ Ціна коректна (число >= 0)
- ✅ Автоматичне об'єднання дублікатів (збільшення кількості)
- ✅ Унікальний tempId для React keys
- ✅ Логування всіх операцій

#### Приклад логів:
```
[OrderManagement] Added new item: Піца Маргарита
[OrderManagement] Increased quantity for: Піца Маргарита
[OrderManagement] Invalid item: undefined
[OrderManagement] Invalid price: -5
```

### 4. ✅ Захист у формі приходу товару
**Файл:** `app/admin/inventory-mobile/page.tsx`

#### Валідації:
- ✅ Товар вибрано
- ✅ Кількість > 0
- ✅ Кількість <= 10000
- ✅ Ціна >= 0
- ✅ Причина не порожня
- ✅ Захист від подвійного натискання
- ✅ Детальне логування

#### Приклад:
```typescript
// Спроба відправити без товару
handleSubmit() // Error: "Виберіть товар"

// Спроба відправити з нульовою кількістю
quantity = "0"
handleSubmit() // Error: "Введіть коректну кількість (більше 0)"

// Спроба подвійного натискання
handleSubmit() // Перший раз - OK
handleSubmit() // [Inventory] Already submitting, ignoring duplicate click
```

### 5. ✅ Захист в API endpoints
**Файл:** `app/api/inventory/movement/route.ts`

#### Валідації:
- ✅ Item ID обов'язковий і не порожній
- ✅ Movement type тільки 'in' або 'out'
- ✅ Quantity > 0 та <= 100000
- ✅ Cost >= 0
- ✅ Reason не порожній
- ✅ Товар існує в базі
- ✅ Достатньо товару для списання

#### Приклади відповідей:
```json
// Помилка: порожній item_id
{
  "error": "Item ID is required"
}

// Помилка: неправильна кількість
{
  "error": "Quantity must be a positive number"
}

// Помилка: занадто велика кількість
{
  "error": "Quantity too large (max 100000)"
}

// Помилка: товар не знайдено
{
  "error": "Item not found"
}

// Успіх
{
  "success": true,
  "message": "Stock added successfully"
}
```

## Як це працює

### Додавання товару до кошика

**Без захисту (раніше):**
```
1. Клік на товар → додано
2. Клік на товар → додано ще раз (дублікат!)
3. Клік на товар → додано ще раз (дублікат!)
```

**З захистом (тепер):**
```
1. Клік на товар → додано (qty: 1)
2. Клік на товар → збільшено кількість (qty: 2)
3. Клік на товар → збільшено кількість (qty: 3)
```

### Приход товару

**Без захисту (раніше):**
```
1. Натиснути "Підтвердити" → відправлено
2. Натиснути "Підтвердити" ще раз → відправлено ще раз (дублікат!)
```

**З захистом (тепер):**
```
1. Натиснути "Підтвердити" → відправлено
2. Натиснути "Підтвердити" ще раз → ігнорується (submitting = true)
```

### Валідація форм

**Без захисту (раніше):**
```
Кількість: "" → відправлено з помилкою
Кількість: "abc" → відправлено з помилкою
Кількість: "-5" → відправлено з помилкою
```

**З захистом (тепер):**
```
Кількість: "" → Error: "Введіть коректну кількість (більше 0)"
Кількість: "abc" → Error: "Введіть коректну кількість (більше 0)"
Кількість: "-5" → Error: "Введіть коректну кількість (більше 0)"
Кількість: "999999" → Error: "Кількість занадто велика (максимум 10000)"
```

## Тестування

### Тест 1: Дублікати в кошику
1. Відкрийте POS систему
2. Додайте товар 3 рази швидко
3. **Очікується:** Товар додано 1 раз з кількістю 3

### Тест 2: Подвійне натискання
1. Відкрийте форму приходу товару
2. Заповніть дані
3. Натисніть "Підтвердити" 5 разів швидко
4. **Очікується:** Відправлено тільки 1 раз

### Тест 3: Пусті значення
1. Відкрийте форму приходу
2. Не заповнюйте кількість
3. Натисніть "Підтвердити"
4. **Очікується:** Error: "Введіть коректну кількість"

### Тест 4: Неправильні значення
1. Введіть кількість: "abc"
2. Натисніть "Підтвердити"
3. **Очікується:** Error: "Введіть коректну кількість"

### Тест 5: API валідація
Відкрийте консоль браузера (F12) та виконайте:

```javascript
// Тест: порожній item_id
fetch('/api/inventory/movement', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    movement_type: 'in',
    item_id: '',
    quantity: 10
  })
})
.then(r => r.json())
.then(d => console.log(d))
// Очікується: {error: "Item ID is required"}

// Тест: негативна кількість
fetch('/api/inventory/movement', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    movement_type: 'in',
    item_id: 'some-id',
    quantity: -5
  })
})
.then(r => r.json())
.then(d => console.log(d))
// Очікується: {error: "Quantity must be a positive number"}
```

## Логування

Всі операції логуються в консоль для діагностики:

### Консоль браузера (F12):
```
[OrderManagement] Added new item: Піца Маргарита
[OrderManagement] Increased quantity for: Піца Маргарита
[Inventory] Submitting: {item: "Курка", quantity: 10, ...}
[Inventory] ✓ Success
[ClickProtection] Blocked duplicate click: submit-order
```

### Консоль сервера:
```
[API] Inventory movement error: Item not found
```

## Переваги

✅ **Немає дублікатів** - товари автоматично об'єднуються  
✅ **Немає подвійних відправок** - захист від швидких кліків  
✅ **Валідація даних** - неможливо відправити некоректні дані  
✅ **Зрозумілі помилки** - користувач бачить що не так  
✅ **Логування** - легко знайти проблему  
✅ **Безпека API** - сервер перевіряє всі дані  

## Файли

- `lib/validation.ts` - utility функції
- `hooks/useClickProtection.ts` - hook для захисту
- `hooks/useOrderManagement.ts` - захист у кошику
- `app/admin/inventory-mobile/page.tsx` - захист у формі
- `app/api/inventory/movement/route.ts` - захист в API

## Використання в інших компонентах

Для додавання захисту в інші компоненти:

```typescript
import { validateNotEmpty, validateNumber } from '@/lib/validation'
import { useClickProtection } from '@/hooks/useClickProtection'

function MyComponent() {
  const { protect, isProcessing } = useClickProtection()
  
  const handleSubmit = async () => {
    // Валідація
    const nameError = validateNotEmpty(name, 'Назва')
    if (nameError) {
      setError(nameError)
      return
    }
    
    const priceError = validateNumber(price, 'Ціна', { min: 0 })
    if (priceError) {
      setError(priceError)
      return
    }
    
    // Захист від подвійного кліку
    const result = await protect('submit', async () => {
      return await api.submit({ name, price })
    })
    
    if (result === null) {
      console.log('Duplicate click blocked')
    }
  }
  
  return (
    <button 
      onClick={handleSubmit}
      disabled={isProcessing('submit')}
    >
      Відправити
    </button>
  )
}
```

Система повністю захищена від дублікатів, подвійних натискань та пустих значень! 🛡️
