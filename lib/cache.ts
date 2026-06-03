import { useState, useEffect, useCallback } from 'react'

// Система кэширования для POS системы
class POSCache {
  private cache = new Map<string, { data: unknown; timestamp: number; ttl: number }>()
  private readonly DEFAULT_TTL = 5 * 60 * 1000 // 5 минут

  set(key: string, data: unknown, ttl: number = this.DEFAULT_TTL) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    })
  }

  get<T = unknown>(key: string): T | null {
    const item = this.cache.get(key)
    if (!item) return null

    const now = Date.now()
    if (now - item.timestamp > item.ttl) {
      this.cache.delete(key)
      return null
    }

    return item.data as T
  }

  has(key: string): boolean {
    return this.get(key) !== null
  }

  delete(key: string) {
    this.cache.delete(key)
  }

  clear() {
    this.cache.clear()
  }

  // Очистка устаревших записей
  cleanup() {
    const now = Date.now()
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        this.cache.delete(key)
      }
    }
  }

  // Получение размера кэша
  size(): number {
    return this.cache.size
  }

  // Статистика кэша
  getStats() {
    const now = Date.now()
    let valid = 0
    let expired = 0

    for (const [, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        expired++
      } else {
        valid++
      }
    }

    return { valid, expired, total: this.cache.size }
  }
}

// Глобальный экземпляр кэша
export const posCache = new POSCache()

// Автоматическая очистка каждые 10 минут
if (typeof window !== 'undefined') {
  setInterval(() => {
    posCache.cleanup()
  }, 10 * 60 * 1000)
}

// Хуки для React компонентов
export function useCachedData<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl?: number
): { data: T | null; loading: boolean; error: Error | null; refetch: () => void } {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchData = useCallback(async () => {
    // Проверяем кэш
    const cached = posCache.get<T>(key)
    if (cached) {
      setData(cached)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await fetcher()
      posCache.set(key, result, ttl)
      setData(result)
    } catch (err) {
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }, [key, fetcher, ttl])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return {
    data,
    loading,
    error,
    refetch: fetchData
  }
}

// Специализированные кэш-ключи
export const CACHE_KEYS = {
  MENU_ITEMS: 'menu_items',
  CATEGORIES: 'categories',
  MODIFIERS: 'modifiers',
  ORDERS: 'orders',
  COMPLETED_ORDERS: 'completed_orders',
  INVENTORY: 'inventory',
  REPORTS: (type: string, dateFrom?: string, dateTo?: string) => 
    `reports_${type}_${dateFrom || 'all'}_${dateTo || 'all'}`
} as const

// Утилиты для работы с кэшем
export const cacheUtils = {
  // Инвалидация связанных ключей
  invalidatePattern(pattern: string) {
    const keys = Array.from(posCache['cache'].keys())
    keys.forEach(key => {
      if (key.includes(pattern)) {
        posCache.delete(key)
      }
    })
  },

  // Предзагрузка данных
  async preload<T>(key: string, fetcher: () => Promise<T>, ttl?: number) {
    if (!posCache.has(key)) {
      try {
        const data = await fetcher()
        posCache.set(key, data, ttl)
      } catch (error) {
        console.warn(`Failed to preload cache key: ${key}`, error)
      }
    }
  },

  // Кэширование с мутексом (предотвращение дублирующих запросов)
  async fetchWithMutex<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    // Проверяем кэш
    const cached = posCache.get<T>(key)
    if (cached) return cached

    // Проверяем, не выполняется ли уже запрос
    const mutexKey = `mutex_${key}`
    if (posCache.has(mutexKey)) {
      // Ждем завершения текущего запроса
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          const result = posCache.get<T>(key)
          if (result) {
            clearInterval(checkInterval)
            resolve(result)
          }
        }, 50)
      })
    }

    // Устанавливаем мутекс
    posCache.set(mutexKey, true, 30000) // 30 секунд TTL для мутекса

    try {
      const result = await fetcher()
      posCache.set(key, result, ttl)
      return result
    } finally {
      posCache.delete(mutexKey)
    }
  }
}
