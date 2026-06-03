"use client"

import { telegramClient } from './telegram-client'

interface SchedulerSettings {
  dailyReportEnabled: boolean
  dailyReportTime: string // "20:00"
  lastReportDate: string
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

class NotificationScheduler {
  private settings: SchedulerSettings
  private checkInterval: NodeJS.Timeout | null = null
  private isRunning: boolean = false

  constructor() {
    this.settings = {
      dailyReportEnabled: true,
      dailyReportTime: '20:00',
      lastReportDate: ''
    }
    this.loadSettings()
  }

  // Загрузка настроек из localStorage
  private loadSettings() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('scheduler_settings')
      if (saved) {
        try {
          this.settings = { ...this.settings, ...JSON.parse(saved) }
        } catch (e) {
          console.error('Failed to load scheduler settings:', e)
        }
      }
    }
  }

  // Сохранение настроек
  private saveSettings() {
    if (typeof window !== 'undefined') {
      localStorage.setItem('scheduler_settings', JSON.stringify(this.settings))
    }
  }

  // Настройка ежедневного отчета
  setDailyReport(enabled: boolean, time: string = '20:00') {
    this.settings.dailyReportEnabled = enabled
    this.settings.dailyReportTime = time
    this.saveSettings()
    
    if (enabled) {
      this.start()
      console.log(`📅 Ежедневный отчет настроен на ${time}`)
    } else {
      console.log('📅 Ежедневный отчет отключен')
    }
  }

  // Запуск планировщика
  start() {
    if (this.isRunning) return
    
    this.isRunning = true
    
    // Проверяем каждую минуту
    this.checkInterval = setInterval(() => {
      this.checkScheduledTasks()
    }, 60000) // 60 секунд
    
    // Проверяем сразу при запуске
    this.checkScheduledTasks()
    
    console.log('⏰ Планировщик уведомлений запущен')
  }

  // Остановка планировщика
  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
    this.isRunning = false
    console.log('⏰ Планировщик уведомлений остановлен')
  }

  // Проверка запланированных задач
  private checkScheduledTasks() {
    const now = new Date()
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
    const currentDate = now.toISOString().split('T')[0]

    // Проверяем ежедневный отчет
    if (this.settings.dailyReportEnabled && 
        currentTime === this.settings.dailyReportTime &&
        this.settings.lastReportDate !== currentDate) {
      
      this.sendDailyReport()
      this.settings.lastReportDate = currentDate
      this.saveSettings()
    }
  }

  // Отправка ежедневного отчета
  private async sendDailyReport() {
    try {
      console.log('📊 Отправка ежедневного отчета...')
      
      // Получаем данные о продажах за сегодня
      const today = new Date().toISOString().split('T')[0]
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'daily_report',
          data: { date: today }
        })
      })

      if (!response.ok) {
        console.error('Ошибка получения данных для отчета')
        return
      }

      const data = await response.json()

      const dataObj = asRecord(data)
      const notification = asRecord(dataObj?.notification)
      const orders = Array.isArray(notification?.orders) ? (notification?.orders as unknown[]) : []

      // Вычисляем статистику
      const totalSales = orders.length
      const totalRevenue = orders.reduce((sum: number, order: unknown) => {
        const o = asRecord(order)
        const total = o?.total
        const n = typeof total === 'number' ? total : Number(total ?? 0)
        return sum + (Number.isFinite(n) ? n : 0)
      }, 0)
      const avgOrderValue = totalSales > 0 ? (totalRevenue / totalSales).toFixed(2) : '0'

      // Анализируем товары
      const itemStats: { [key: string]: { count: number, revenue: number } } = {}
      orders.forEach((order: unknown) => {
        const o = asRecord(order)
        const items = Array.isArray(o?.items) ? (o?.items as unknown[]) : []
        if (items.length > 0) {
          items.forEach((item: unknown) => {
            const it = asRecord(item)
            const name = typeof it?.name === 'string' ? it.name : 'Невідомий товар'
            if (!itemStats[name]) {
              itemStats[name] = { count: 0, revenue: 0 }
            }
            const qtyRaw = it?.quantity
            const priceRaw = it?.price
            const qty = typeof qtyRaw === 'number' ? qtyRaw : Number(qtyRaw ?? 0)
            const price = typeof priceRaw === 'number' ? priceRaw : Number(priceRaw ?? 0)
            const q = Number.isFinite(qty) ? qty : 0
            const p = Number.isFinite(price) ? price : 0
            itemStats[name].count += q
            itemStats[name].revenue += p * q
          })
        }
      })

      // Топ товары
      const topItems = Object.entries(itemStats)
        .sort(([,a], [,b]) => b.count - a.count)
        .slice(0, 5)
        .map(([name, stats]) => `• ${name}: ${stats.count} шт. (${stats.revenue.toFixed(2)} грн)`)
        .join('\n')

      // Анализ по типам заказов
      const orderTypes = orders.reduce<Record<string, number>>((acc, order: unknown) => {
        const o = asRecord(order)
        const typeRaw = o?.order_type
        const type = typeof typeRaw === 'string' && typeRaw ? typeRaw : 'unknown'
        acc[type] = (acc[type] ?? 0) + 1
        return acc
      }, {})

      const orderTypesText = Object.entries(orderTypes)
        .map(([type, count]) => {
          const typeNames: { [key: string]: string } = {
            'dine_in': 'В залі',
            'takeaway': 'На винос',
            'delivery': 'Доставка'
          }
          return `• ${typeNames[type] || type}: ${count}`
        })
        .join('\n')

      // Формируем сообщение
      const reportDate = new Date().toLocaleDateString('uk-UA', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })

      const message = `📊 **Щоденний звіт**
📅 ${reportDate}

💰 **Фінансові показники:**
• Загальна виручка: **${totalRevenue.toFixed(2)} грн**
• Кількість замовлень: **${totalSales}**
• Середній чек: **${avgOrderValue} грн**

${totalSales > 0 ? `🏆 **Топ товари:**
${topItems}

📋 **Типи замовлень:**
${orderTypesText}` : '📭 Сьогодні не було продажів'}

⏰ Звіт згенеровано: ${new Date().toLocaleString('uk-UA')}

${totalRevenue > 0 ? 
  totalRevenue > 1000 ? '🎉 Відмінний день!' : 
  totalRevenue > 500 ? '👍 Хороший день!' : 
  '💪 Продовжуємо працювати!' : 
  '🔄 Завтра буде краще!'}`

      // Отправляем через Telegram
      telegramClient.notifySystem(
        '📊 Щоденний звіт',
        message,
        'low'
      )

      console.log('✅ Ежедневный отчет отправлен')

    } catch (error) {
      console.error('❌ Ошибка отправки ежедневного отчета:', error)
      
      // Отправляем уведомление об ошибке
      telegramClient.notifySystem(
        '❌ Помилка звіту',
        `Не вдалося згенерувати щоденний звіт за ${new Date().toLocaleDateString('uk-UA')}.\n\nПомилка: ${error}`,
        'high'
      )
    }
  }

  // Принудительная отправка отчета
  async forceSendReport() {
    await this.sendDailyReport()
  }

  // Получение настроек
  getSettings() {
    return { ...this.settings }
  }

  // Получение статуса
  getStatus() {
    return {
      isRunning: this.isRunning,
      settings: this.settings,
      nextReportTime: this.getNextReportTime()
    }
  }

  // Вычисление времени следующего отчета
  private getNextReportTime(): string {
    const now = new Date()
    const [hours, minutes] = this.settings.dailyReportTime.split(':').map(Number)
    
    const nextReport = new Date()
    nextReport.setHours(hours, minutes, 0, 0)
    
    // Если время уже прошло сегодня, планируем на завтра
    if (nextReport <= now) {
      nextReport.setDate(nextReport.getDate() + 1)
    }
    
    return nextReport.toLocaleString('uk-UA')
  }
}

// Экспорт синглтона
export const notificationScheduler = new NotificationScheduler()

// Автозапуск при загрузке
if (typeof window !== 'undefined') {
  // Запускаем планировщик через 5 секунд после загрузки
  setTimeout(() => {
    notificationScheduler.start()
  }, 5000)
}
