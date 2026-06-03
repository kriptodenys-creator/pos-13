interface TelegramConfig {
  botToken: string
  chatId: string
  enabled: boolean
}

interface NotificationMessage {
  type: 'low_stock' | 'out_of_stock' | 'order_alert' | 'system_alert'
  title: string
  message: string
  priority: 'low' | 'medium' | 'high'
  data?: unknown
}

class TelegramNotifier {
  private config: TelegramConfig
  private baseUrl: string

  constructor() {
    this.config = {
      botToken: process.env.TELEGRAM_BOT_TOKEN || '',
      chatId: process.env.TELEGRAM_CHAT_ID || '',
      enabled: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID)
    }
    this.baseUrl = `https://api.telegram.org/bot${this.config.botToken}`
  }

  // Проверка подключения к боту
  async testConnection(): Promise<boolean> {
    if (!this.config.enabled) {
      console.log('❌ Telegram bot not configured')
      return false
    }

    try {
      const response = await fetch(`${this.baseUrl}/getMe`)
      const data = await response.json()
      
      if (data.ok) {
        console.log(`✅ Telegram bot connected: @${data.result.username}`)
        return true
      } else {
        console.log('❌ Telegram bot connection failed:', data.description)
        return false
      }
    } catch (error) {
      console.log('❌ Telegram bot connection error:', error)
      return false
    }
  }

  // Отправка сообщения
  async sendMessage(notification: NotificationMessage): Promise<boolean> {
    if (!this.config.enabled) {
      console.log('⚠️ Telegram notifications disabled')
      return false
    }

    try {
      const emoji = this.getEmojiForType(notification.type)
      const priorityEmoji = this.getEmojiForPriority(notification.priority)
      
      const message = `${emoji} ${priorityEmoji} *${notification.title}*\n\n${notification.message}\n\n_Время: ${new Date().toLocaleString('uk-UA')}_`

      const response = await fetch(`${this.baseUrl}/sendMessage`, {
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
      
      if (data.ok) {
        console.log('✅ Telegram notification sent successfully')
        return true
      } else {
        console.log('❌ Telegram notification failed:', data.description)
        return false
      }
    } catch (error) {
      console.log('❌ Telegram notification error:', error)
      return false
    }
  }

  // Уведомление о низких остатках
  async notifyLowStock(items: Array<{name: string, current: number, minimum: number}>): Promise<boolean> {
    if (items.length === 0) return true

    const itemsList = items.map(item => 
      `• *${item.name}*: ${item.current} шт. (мін: ${item.minimum})`
    ).join('\n')

    return this.sendMessage({
      type: 'low_stock',
      title: 'Низькі залишки на складі',
      message: `Увага! Наступні товари закінчуються:\n\n${itemsList}\n\n🔄 Рекомендується поповнити запаси`,
      priority: 'medium'
    })
  }

  // Уведомление о закончившихся товарах
  async notifyOutOfStock(items: Array<{name: string}>): Promise<boolean> {
    if (items.length === 0) return true

    const itemsList = items.map(item => `• *${item.name}*`).join('\n')

    return this.sendMessage({
      type: 'out_of_stock',
      title: 'Товари закінчилися!',
      message: `🚨 Наступні товари відсутні на складі:\n\n${itemsList}\n\n⚠️ Терміново поповніть запаси!`,
      priority: 'high'
    })
  }

  // Уведомление о новом заказе
  async notifyNewOrder(orderData: {id: string, total: number, items: number}): Promise<boolean> {
    return this.sendMessage({
      type: 'order_alert',
      title: 'Новий заказ',
      message: `📋 Заказ #${orderData.id}\n💰 Сума: ${orderData.total} грн\n📦 Товарів: ${orderData.items} шт.`,
      priority: 'low'
    })
  }

  // Системные уведомления
  async notifySystem(title: string, message: string, priority: 'low' | 'medium' | 'high' = 'medium'): Promise<boolean> {
    return this.sendMessage({
      type: 'system_alert',
      title,
      message,
      priority
    })
  }

  // Получение эмодзи для типа уведомления
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

  // Проверка настроек
  isConfigured(): boolean {
    return this.config.enabled
  }

  // Получение информации о боте
  getConfig(): Omit<TelegramConfig, 'botToken'> {
    return {
      chatId: this.config.chatId,
      enabled: this.config.enabled
    }
  }
}

// Экспорт синглтона
export const telegramNotifier = new TelegramNotifier()

// Экспорт типов
export type { NotificationMessage, TelegramConfig }
