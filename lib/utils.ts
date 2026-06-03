import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

// Форматирование цены в формат 0.00 €
// Если цена > 100, предполагаем что это центы, иначе это уже евро
export function formatPrice(price: number): string {
  const priceInEuros = price > 100 ? price / 100 : price
  return priceInEuros.toFixed(2) + ' €'
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Утилитарные функции для POS системы
export const generateOrderNumber = () => {
  const today = new Date()
  const timeStamp = today.getHours() * 100 + today.getMinutes()
  const randomSuffix = Math.floor(Math.random() * 100)
  return timeStamp + randomSuffix
}

// Функция для генерации временных слотов для предзаказа
export const generateTimeSlots = () => {
  const slots = []
  const now = new Date()
  const currentMinute = now.getMinutes()
  
  // Начинаем с текущего времени + 30 минут
  const startTime = new Date(now)
  startTime.setMinutes(currentMinute + 30)
  startTime.setSeconds(0)
  
  // Округляем до ближайших 15 минут
  const minutes = startTime.getMinutes()
  const roundedMinutes = Math.ceil(minutes / 15) * 15
  startTime.setMinutes(roundedMinutes)
  
  // Генерируем слоты на следующие 12 часов с интервалом 15 минут
  for (let i = 0; i < 48; i++) {
    const time = new Date(startTime.getTime() + i * 15 * 60 * 1000)
    
    // Пропускаем время после 23:00 и до 08:00
    const hour = time.getHours()
    if (hour >= 8 && hour < 23) {
      slots.push({
        value: time.toTimeString().slice(0, 5),
        label: time.toLocaleTimeString('uk-UA', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: false 
        }),
        date: time
      })
    }
  }

  return slots
}
