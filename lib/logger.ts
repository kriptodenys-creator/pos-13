/**
 * Утилита для логирования
 * Логи выводятся только в режиме разработки
 */

const isDevelopment = process.env.NODE_ENV === 'development'

export const logger = {
  log: (...args: unknown[]) => {
    if (isDevelopment) {
      console.log(...args)
    }
  },

  warn: (...args: unknown[]) => {
    if (isDevelopment) {
      console.warn(...args)
    }
  },

  error: (...args: unknown[]) => {
    // Ошибки логируем всегда
    console.error(...args)
  },

  info: (...args: unknown[]) => {
    if (isDevelopment) {
      console.info(...args)
    }
  },

  debug: (...args: unknown[]) => {
    if (isDevelopment) {
      console.debug(...args)
    }
  },

  // Группировка логов
  group: (label: string) => {
    if (isDevelopment) {
      console.group(label)
    }
  },

  groupEnd: () => {
    if (isDevelopment) {
      console.groupEnd()
    }
  },

  // Таблица
  table: (data: unknown) => {
    if (isDevelopment) {
      console.table(data)
    }
  },

  // Время выполнения
  time: (label: string) => {
    if (isDevelopment) {
      console.time(label)
    }
  },

  timeEnd: (label: string) => {
    if (isDevelopment) {
      console.timeEnd(label)
    }
  }
}

// Алиасы для удобства
export const log = logger.log
export const warn = logger.warn
export const error = logger.error
export const info = logger.info
export const debug = logger.debug
