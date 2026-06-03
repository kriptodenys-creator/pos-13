import { telegramNotifier } from './telegram'

// Автоматические уведомления для системы
export class NotificationService {
  
  // Уведомление при создании заказа
  static async notifyNewOrder(orderData: {
    id: string
    total: number
    items: Array<{name: string, quantity: number}>
    orderType: string
  }) {
    try {
      const itemsCount = orderData.items.reduce((sum, item) => sum + item.quantity, 0)
      
      await telegramNotifier.notifyNewOrder({
        id: orderData.id,
        total: orderData.total,
        items: itemsCount
      })
    } catch (error) {
      console.error('Failed to send order notification:', error)
    }
  }

  // Проверка остатков после изменения инвентаря
  static async checkInventoryLevels() {
    try {
      // Этот метод будет вызываться после изменений в инвентаре
      const response = await fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check_stock' })
      })
      
      if (!response.ok) {
        console.error('Failed to check inventory levels')
      }
    } catch (error) {
      console.error('Error checking inventory levels:', error)
    }
  }

  // Уведомление о системных событиях
  static async notifySystemEvent(title: string, message: string, priority: 'low' | 'medium' | 'high' = 'medium') {
    try {
      await telegramNotifier.notifySystem(title, message, priority)
    } catch (error) {
      console.error('Failed to send system notification:', error)
    }
  }

  // Ежедневная проверка остатков (можно вызывать по расписанию)
  static async dailyInventoryCheck() {
    try {
      await this.checkInventoryLevels()
      await this.notifySystemEvent(
        'Щоденна перевірка',
        '✅ Автоматична перевірка залишків завершена',
        'low'
      )
    } catch (error) {
      console.error('Daily inventory check failed:', error)
    }
  }
}

// Хук для интеграции с существующими API
export function useTelegramNotifications() {
  return {
    notifyNewOrder: NotificationService.notifyNewOrder,
    checkInventory: NotificationService.checkInventoryLevels,
    notifySystem: NotificationService.notifySystemEvent,
    dailyCheck: NotificationService.dailyInventoryCheck
  }
}
