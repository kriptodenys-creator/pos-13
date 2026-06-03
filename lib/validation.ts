// Utility функції для валідації та захисту

/**
 * Debounce функція для захисту від подвійного натискання
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number = 300
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null
      func(...args)
    }
    
    if (timeout) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(later, wait)
  }
}

/**
 * Throttle функція для обмеження частоти викликів
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number = 1000
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false
  
  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

/**
 * Захист від подвійного натискання кнопки
 */
export class ClickProtection {
  private clicking: Set<string> = new Set()
  
  async execute<T>(
    key: string,
    action: () => Promise<T>,
    timeout: number = 2000
  ): Promise<T | null> {
    if (this.clicking.has(key)) {
      console.warn(`[ClickProtection] Blocked duplicate click: ${key}`)
      return null
    }
    
    this.clicking.add(key)
    
    try {
      const result = await action()
      return result
    } finally {
      setTimeout(() => {
        this.clicking.delete(key)
      }, timeout)
    }
  }
  
  isProcessing(key: string): boolean {
    return this.clicking.has(key)
  }
}

/**
 * Валідація пустих значень
 */
export function validateNotEmpty(value: unknown, fieldName: string = 'Поле'): string | null {
  if (value === null || value === undefined) {
    return `${fieldName} не може бути порожнім`
  }
  
  if (typeof value === 'string' && value.trim() === '') {
    return `${fieldName} не може бути порожнім`
  }
  
  if (Array.isArray(value) && value.length === 0) {
    return `${fieldName} не може бути порожнім`
  }
  
  return null
}

/**
 * Валідація числових значень
 */
export function validateNumber(
  value: unknown,
  fieldName: string = 'Значення',
  options: { min?: number; max?: number; allowZero?: boolean } = {}
): string | null {
  const num =
    typeof value === 'number' ? value :
    typeof value === 'string' ? parseFloat(value) :
    Number.NaN
  
  if (Number.isNaN(num)) {
    return `${fieldName} має бути числом`
  }
  
  if (!options.allowZero && num === 0) {
    return `${fieldName} не може дорівнювати нулю`
  }
  
  if (options.min !== undefined && num < options.min) {
    return `${fieldName} не може бути меншим за ${options.min}`
  }
  
  if (options.max !== undefined && num > options.max) {
    return `${fieldName} не може бути більшим за ${options.max}`
  }
  
  return null
}

/**
 * Перевірка на дублікати в масиві
 */
export function hasDuplicates<T>(
  array: T[],
  getKey: (item: T) => string | number
): boolean {
  const keys = new Set<string | number>()
  
  for (const item of array) {
    const key = getKey(item)
    if (keys.has(key)) {
      return true
    }
    keys.add(key)
  }
  
  return false
}

/**
 * Знайти дублікати в масиві
 */
export function findDuplicates<T>(
  array: T[],
  getKey: (item: T) => string | number
): T[] {
  const seen = new Map<string | number, T>()
  const duplicates: T[] = []
  
  for (const item of array) {
    const key = getKey(item)
    if (seen.has(key)) {
      duplicates.push(item)
    } else {
      seen.set(key, item)
    }
  }
  
  return duplicates
}

/**
 * Видалити дублікати з масиву
 */
export function removeDuplicates<T>(
  array: T[],
  getKey: (item: T) => string | number
): T[] {
  const seen = new Set<string | number>()
  const result: T[] = []
  
  for (const item of array) {
    const key = getKey(item)
    if (!seen.has(key)) {
      seen.add(key)
      result.push(item)
    }
  }
  
  return result
}

/**
 * Валідація форми
 */
export interface ValidationRule {
  field: string
  validate: (value: unknown) => string | null
}

export function validateForm(
  data: Record<string, unknown>,
  rules: ValidationRule[]
): { isValid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {}
  
  for (const rule of rules) {
    const error = rule.validate(data[rule.field])
    if (error) {
      errors[rule.field] = error
    }
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  }
}

/**
 * Sanitize рядок (видалення небезпечних символів)
 */
export function sanitizeString(str: string): string {
  return str
    .replace(/[<>]/g, '') // Видалити HTML теги
    .replace(/['"]/g, '') // Видалити лапки
    .trim()
}

/**
 * Валідація email
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Валідація телефону
 */
export function validatePhone(phone: string): boolean {
  const phoneRegex = /^[\d\s\+\-\(\)]+$/
  return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 9
}

/**
 * Глобальний екземпляр для захисту від кліків
 */
export const clickProtection = new ClickProtection()
