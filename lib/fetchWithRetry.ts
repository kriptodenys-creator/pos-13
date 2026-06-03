/**
 * Универсальная функция для fetch с автоматическими повторными попытками
 * @param url - URL для запроса
 * @param options - Опции fetch
 * @param retries - Количество попыток (по умолчанию 3)
 * @param delay - Базовая задержка между попытками в мс (по умолчанию 1500)
 * @returns Response или null если все попытки исчерпаны
 */
export async function fetchWithRetry(
  url: string, 
  options: RequestInit = {}, 
  retries = 3, 
  delay = 1500
): Promise<Response | null> {
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 секунд таймаут
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      // Возвращаем response даже если не ok, чтобы можно было обработать ошибку
      return response
    } catch (error: unknown) {
      if (i === retries - 1) {
        // Логируем только последнюю неудачную попытку
        const msg = error instanceof Error ? error.message : String(error)
        console.error(`[fetchWithRetry] Failed after ${retries} attempts:`, url, msg)
      }
    }
    
    if (i < retries - 1) {
      const waitTime = delay * (i + 1) // Увеличиваем задержку с каждой попыткой
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }
  }
  
  console.error(`[fetchWithRetry] Все ${retries} попытки исчерпаны для ${url}`)
  return null
}
