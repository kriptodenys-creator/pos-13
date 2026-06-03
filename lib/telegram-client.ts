"use client"

interface TelegramClientConfig {
  botToken: string
  chatId: string
  enabled: boolean
}

interface NotificationQueue {
  id: string
  type: 'low_stock' | 'out_of_stock' | 'order_alert' | 'system_alert'
  title: string
  message: string
  priority: 'low' | 'medium' | 'high'
  timestamp: number
  sent: boolean
}

class TelegramClientService {
  private config: TelegramClientConfig
  private queue: NotificationQueue[] = []
  private isOnline: boolean = false
  private checkInterval: NodeJS.Timeout | null = null

  constructor() {
    this.config = {
      botToken: '',
      chatId: '',
      enabled: false
    }
    
    // Загружаем настройки из localStorage
    this.loadConfig()
    
    // Загружаем очередь из localStorage
    this.loadQueue()
    
    // Отслеживаем состояние интернета
    this.setupOnlineDetection()
    
    // Запускаем обработку очереди
    this.startQueueProcessor()
  }

  // Загрузка конфигурации из localStorage
  private loadConfig() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('telegram_config')
      if (saved) {
        try {
          this.config = JSON.parse(saved)
        } catch (e) {
          console.error('Failed to load Telegram config:', e)
        }
      }
    }
  }

  // Сохранение конфигурации в localStorage
  private saveConfig() {
    if (typeof window !== 'undefined') {
      localStorage.setItem('telegram_config', JSON.stringify(this.config))
    }
  }

  // Загрузка очереди из localStorage
  private loadQueue() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('telegram_queue')
      if (saved) {
        try {
          this.queue = JSON.parse(saved)
        } catch (e) {
          console.error('Failed to load Telegram queue:', e)
          this.queue = []
        }
      }
    }
  }

  // Сохранение очереди в localStorage
  private saveQueue() {
    if (typeof window !== 'undefined') {
      localStorage.setItem('telegram_queue', JSON.stringify(this.queue))
    }
  }

  // Настройка отслеживания интернета
  private setupOnlineDetection() {
    if (typeof window !== 'undefined') {
      this.isOnline = navigator.onLine
      
      window.addEventListener('online', () => {
        this.isOnline = true
        console.log('📶 Интернет подключен - обрабатываем очередь Telegram')
        this.processQueue()
      })
      
      window.addEventListener('offline', () => {
        this.isOnline = false
        console.log('📵 Интернет отключен - уведомления в очереди')
      })
    }
  }

  // Запуск обработчика очереди
  private startQueueProcessor() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
    }
    
    // Проверяем очередь каждые 30 секунд
    this.checkInterval = setInterval(() => {
      if (this.isOnline && this.config.enabled) {
        this.processQueue()
      }
    }, 30000)
  }

  // Настройка бота
  configure(botToken: string, chatId: string) {
    this.config = {
      botToken,
      chatId,
      enabled: !!(botToken && chatId)
    }
    this.saveConfig()
    
    if (this.config.enabled) {
      console.log('✅ Telegram бот настроен')
      this.processQueue() // Обрабатываем накопившиеся уведомления
    }
  }

  // Проверка подключения
  async testConnection(): Promise<boolean> {
    if (!this.config.enabled || !this.isOnline) {
      return false
    }

    try {
      const response = await fetch(`https://api.telegram.org/bot${this.config.botToken}/getMe`)
      const data = await response.json()
      return data.ok
    } catch (error) {
      console.error('Telegram connection test failed:', error)
      return false
    }
  }

  // Добавление уведомления в очередь
  addNotification(
    type: NotificationQueue['type'],
    title: string,
    message: string,
    priority: NotificationQueue['priority'] = 'medium'
  ) {
    const notification: NotificationQueue = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      title,
      message,
      priority,
      timestamp: Date.now(),
      sent: false
    }

    this.queue.push(notification)
    this.saveQueue()

    // Если онлайн и настроен - отправляем сразу
    if (this.isOnline && this.config.enabled) {
      this.processQueue()
    } else {
      console.log(`📝 Уведомление добавлено в очередь: ${title}`)
    }
  }

  // Обработка очереди уведомлений
  private async processQueue() {
    if (!this.config.enabled || !this.isOnline || this.queue.length === 0) {
      return
    }

    const unsentNotifications = this.queue.filter(n => !n.sent)
    
    for (const notification of unsentNotifications) {
      try {
        const success = await this.sendTelegramMessage(notification)
        if (success) {
          notification.sent = true
          console.log(`✅ Отправлено: ${notification.title}`)
        }
      } catch (error) {
        console.error(`❌ Ошибка отправки: ${notification.title}`, error)
      }
      
      // Небольшая задержка между сообщениями
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    // Сохраняем обновленную очередь
    this.saveQueue()

    // Очищаем старые отправленные уведомления (старше 24 часов)
    this.cleanupQueue()
  }

  // Отправка сообщения в Telegram
  private async sendTelegramMessage(notification: NotificationQueue): Promise<boolean> {
    const emoji = this.getEmojiForType(notification.type)
    const priorityEmoji = this.getEmojiForPriority(notification.priority)
    
    const message = `${emoji} ${priorityEmoji} *${notification.title}*\n\n${notification.message}\n\n_Час: ${new Date(notification.timestamp).toLocaleString('uk-UA')}_`

    try {
      const response = await fetch(`https://api.telegram.org/bot${this.config.botToken}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: this.config.chatId,
          text: message,
          parse_mode: 'Markdown',
          disable_web_page_preview: true
        })
      })

      const data = await response.json()
      return data.ok
    } catch (error) {
      console.error('Telegram API error:', error)
      return false
    }
  }

  // Очистка старых уведомлений
  private cleanupQueue() {
    const dayAgo = Date.now() - (24 * 60 * 60 * 1000)
    const initialLength = this.queue.length
    
    this.queue = this.queue.filter(n => 
      !n.sent || n.timestamp > dayAgo
    )

    if (this.queue.length !== initialLength) {
      this.saveQueue()
      console.log(`🧹 Очищено ${initialLength - this.queue.length} старых уведомлений`)
    }
  }

  // Получение эмодзи для типа
  private getEmojiForType(type: string): string {
    const emojis = {
      'low_stock': '⚠️',
      'out_of_stock': '🚨',
      'order_alert': '📋',
      'system_alert': '🔧'
    }
    return emojis[type as keyof typeof emojis] || '📢'
  }

  // Получение эмодзи для приоритета
  private getEmojiForPriority(priority: string): string {
    const emojis = {
      'low': '🔵',
      'medium': '🟡',
      'high': '🔴'
    }
    return emojis[priority as keyof typeof emojis] || '🔵'
  }

  // Методы для различных типов уведомлений
  notifyLowStock(items: Array<{name: string, current: number, minimum: number}>) {
    if (items.length === 0) return

    const itemsList = items.map(item => 
      `• ${item.name}: ${item.current} шт. (мін: ${item.minimum})`
    ).join('\n')

    this.addNotification(
      'low_stock',
      'Низькі залишки на складі',
      `Увага! Наступні товари закінчуються:\n\n${itemsList}\n\n🔄 Рекомендується поповнити запаси`,
      'medium'
    )
  }

  notifyOutOfStock(items: Array<{name: string}>) {
    if (items.length === 0) return

    const itemsList = items.map(item => `• ${item.name}`).join('\n')

    this.addNotification(
      'out_of_stock',
      'Товари закінчилися!',
      `🚨 Наступні товари відсутні на складі:\n\n${itemsList}\n\n⚠️ Терміново поповніть запаси!`,
      'high'
    )
  }

  notifyNewOrder(orderData: {id: string, total: number, items: number}) {
    this.addNotification(
      'order_alert',
      'Новий заказ',
      `📋 Заказ #${orderData.id}\n💰 Сума: ${orderData.total} грн\n📦 Товарів: ${orderData.items} шт.`,
      'low'
    )
  }

  notifySystem(title: string, message: string, priority: 'low' | 'medium' | 'high' = 'medium') {
    this.addNotification('system_alert', title, message, priority)
  }

  // Получение статистики
  getStats() {
    return {
      configured: this.config.enabled,
      online: this.isOnline,
      queueLength: this.queue.length,
      unsentCount: this.queue.filter(n => !n.sent).length,
      config: {
        chatId: this.config.chatId ? '***' + this.config.chatId.slice(-4) : null,
        enabled: this.config.enabled
      }
    }
  }

  // Очистка всех данных
  reset() {
    this.config = { botToken: '', chatId: '', enabled: false }
    this.queue = []
    this.saveConfig()
    this.saveQueue()
  }
}

// Экспорт синглтона
export const telegramClient = new TelegramClientService()

// Хук для React компонентов
export function useTelegramClient() {
  return {
    configure: telegramClient.configure.bind(telegramClient),
    testConnection: telegramClient.testConnection.bind(telegramClient),
    notifyLowStock: telegramClient.notifyLowStock.bind(telegramClient),
    notifyOutOfStock: telegramClient.notifyOutOfStock.bind(telegramClient),
    notifyNewOrder: telegramClient.notifyNewOrder.bind(telegramClient),
    notifySystem: telegramClient.notifySystem.bind(telegramClient),
    getStats: telegramClient.getStats.bind(telegramClient),
    reset: telegramClient.reset.bind(telegramClient)
  }
}
