// Автоматична перевірка залишків для Telegram сповіщень
// Запускається щодня о 9:00 ранку

let checkInterval: NodeJS.Timeout | null = null
let lastCheckDate: string | null = null

// Функція для перевірки чи настав час відправки
function shouldSendNotification(): boolean {
  const now = new Date()
  const currentHour = now.getHours()
  const currentDate = now.toDateString()
  
  // Відправляємо о 9:00 ранку
  if (currentHour === 9 && lastCheckDate !== currentDate) {
    lastCheckDate = currentDate
    return true
  }
  
  return false
}

// Функція для відправки автоматичного сповіщення
async function sendAutoNotification() {
  try {
    const response = await fetch('/api/telegram/check-stock')
    const data = await response.json()
    
    if (data.success) {
      console.log('[Auto Check] ✅ Сповіщення відправлено:', data.message)
    } else {
      console.log('[Auto Check] ⚠️', data.message || data.error)
    }
  } catch (error) {
    console.error('[Auto Check] ❌ Помилка:', error)
  }
}

// Запуск автоматичної перевірки
export function startAutoCheck() {
  if (checkInterval) {
    console.log('[Auto Check] Вже запущено')
    return
  }
  
  console.log('[Auto Check] 🚀 Запуск автоматичної перевірки залишків')
  console.log('[Auto Check] ⏰ Сповіщення будуть відправлятись щодня о 9:00')
  
  // Перевіряємо кожну хвилину
  checkInterval = setInterval(() => {
    if (shouldSendNotification()) {
      console.log('[Auto Check] 📨 Час відправки сповіщення!')
      sendAutoNotification()
    }
  }, 60000) // Кожну хвилину
  
  // Перевіряємо одразу при запуску (якщо зараз 9:00)
  if (shouldSendNotification()) {
    sendAutoNotification()
  }
}

// Зупинка автоматичної перевірки
export function stopAutoCheck() {
  if (checkInterval) {
    clearInterval(checkInterval)
    checkInterval = null
    console.log('[Auto Check] ⏹️ Автоматична перевірка зупинена')
  }
}

// Ручна перевірка (для тестування)
export async function manualCheck() {
  console.log('[Auto Check] 🔍 Ручна перевірка залишків...')
  await sendAutoNotification()
}
