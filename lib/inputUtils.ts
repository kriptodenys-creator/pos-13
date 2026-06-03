/**
 * Утилітна функція для обробки числового вводу
 * Видаляє ведучі нулі, але зберігає "0." для десяткових дробів
 */
export function handleNumericInput(value: string): string {
  // Видаляємо всі символи крім цифр та крапки
  let val = value.replace(/[^0-9.]/g, '')
  
  // Дозволяємо тільки одну крапку
  if (val.split('.').length > 2) {
    return val.substring(0, val.lastIndexOf('.'))
  }
  
  // Видаляємо ведучі нулі, але зберігаємо "0." для десяткових
  if (val.length > 1 && val[0] === '0' && val[1] !== '.') {
    val = val.replace(/^0+/, '')
  }
  
  return val
}

/**
 * Обробник onChange для числових полів
 */
export function createNumericInputHandler(
  setValue: (value: string) => void
): (e: React.ChangeEvent<HTMLInputElement>) => void {
  return (e) => {
    const cleanValue = handleNumericInput(e.target.value)
    setValue(cleanValue)
  }
}
