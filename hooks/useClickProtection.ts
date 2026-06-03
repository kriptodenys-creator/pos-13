import { useRef, useCallback } from 'react'

/**
 * Hook для захисту від подвійного натискання
 */
export function useClickProtection(delay: number = 1000) {
  const processingRef = useRef<Set<string>>(new Set())

  const protect = useCallback(
    async <T>(key: string, action: () => Promise<T> | T): Promise<T | null> => {
      if (processingRef.current.has(key)) {
        console.warn(`[ClickProtection] Blocked duplicate action: ${key}`)
        return null
      }

      processingRef.current.add(key)

      try {
        const result = await action()
        return result
      } finally {
        setTimeout(() => {
          processingRef.current.delete(key)
        }, delay)
      }
    },
    [delay]
  )

  const isProcessing = useCallback((key: string) => {
    return processingRef.current.has(key)
  }, [])

  return { protect, isProcessing }
}
