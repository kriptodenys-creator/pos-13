import { useState, useEffect } from 'react'
import { fetchWithRetry } from '@/lib/fetchWithRetry'

interface UseFetchWithRetryOptions {
  url: string
  options?: RequestInit
  delay?: number // Задержка перед первым запросом (мс)
  enabled?: boolean // Включить автоматическую загрузку
}

interface UseFetchWithRetryResult<T> {
  data: T | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

/**
 * Хук для загрузки данных с автоматическими повторными попытками
 * @param options - Опции для запроса
 * @returns Объект с данными, состоянием загрузки, ошибкой и функцией refetch
 */
export function useFetchWithRetry<T = any>(
  options: UseFetchWithRetryOptions
): UseFetchWithRetryResult<T> {
  const { url, options: fetchOptions, delay = 500, enabled = true } = options
  
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetchWithRetry(url, fetchOptions || {})

      if (!response) {
        throw new Error('Не удалось подключиться к серверу после нескольких попыток')
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      setData(result)
      setLoading(false)
    } catch (err: any) {
      console.error(`[useFetchWithRetry] Ошибка загрузки ${url}:`, err)
      setError(err.message || 'Произошла ошибка при загрузке данных')
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }

    // Даём серверу время инициализироваться перед первым запросом
    const timer = setTimeout(() => {
      fetchData()
    }, delay)

    return () => clearTimeout(timer)
  }, [url, enabled]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    data,
    loading,
    error,
    refetch: fetchData
  }
}
