"use client"

import { useEffect } from 'react'
import { useTelegramClient } from '@/lib/telegram-client'

interface OrderItem {
  name: string
  quantity: number
  price: number
}

interface Order {
  id: string
  total: number
  items: OrderItem[]
  orderType: string
  customerInfo?: string
}

export function useOrderNotifications() {
  const telegram = useTelegramClient()

  // Уведомление о новой продаже
  const notifyNewSale = (order: Order) => {
    const itemsList = order.items.map(item => 
      `• ${item.name} x${item.quantity} = ${item.price * item.quantity} грн`
    ).join('\n')

    const orderTypeText = {
      'dine_in': 'В залі',
      'takeaway': 'На винос',
      'delivery': 'Доставка'
    }[order.orderType] || order.orderType

    telegram.notifySystem(
      '💰 Нова продажа',
      `🧾 Замовлення #${order.id}
📍 Тип: ${orderTypeText}
💵 Сума: ${order.total} грн

📦 Товари:
${itemsList}

${order.customerInfo ? `👤 Клієнт: ${order.customerInfo}` : ''}

⏰ ${new Date().toLocaleString('uk-UA')}`,
      'low'
    )
  }

  // Уведомление об изменении остатков
  const notifyStockChange = (changes: Array<{
    name: string
    oldStock: number
    newStock: number
    minStock: number
  }>) => {
    const changesList = changes.map(change => {
      const diff = change.newStock - change.oldStock
      const diffText = diff > 0 ? `+${diff}` : `${diff}`
      const status = change.newStock <= 0 ? '🚨' : 
                    change.newStock <= change.minStock ? '⚠️' : '✅'
      
      return `${status} ${change.name}: ${change.oldStock} → ${change.newStock} (${diffText})`
    }).join('\n')

    telegram.notifySystem(
      '📦 Зміна залишків',
      `Оновлення складу:

${changesList}

⏰ ${new Date().toLocaleString('uk-UA')}`,
      'medium'
    )
  }

  // Ежедневный отчет о продажах
  const sendDailySalesReport = async () => {
    try {
      const today = new Date().toISOString().split('T')[0]
      
      // Получаем данные о продажах за сегодня
      const response = await fetch(`/api/reports?type=daily&date=${today}`)
      if (!response.ok) return

      const data = await response.json()
      
      const totalSales = data.orders?.length || 0
      const totalRevenue = data.orders?.reduce((sum: number, order: any) => sum + order.total, 0) || 0
      const avgOrderValue = totalSales > 0 ? (totalRevenue / totalSales).toFixed(2) : '0'

      // Топ товары
      const itemStats: { [key: string]: { count: number, revenue: number } } = {}
      data.orders?.forEach((order: any) => {
        order.items?.forEach((item: any) => {
          if (!itemStats[item.name]) {
            itemStats[item.name] = { count: 0, revenue: 0 }
          }
          itemStats[item.name].count += item.quantity
          itemStats[item.name].revenue += item.price * item.quantity
        })
      })

      const topItems = Object.entries(itemStats)
        .sort(([,a], [,b]) => b.count - a.count)
        .slice(0, 5)
        .map(([name, stats]) => `• ${name}: ${stats.count} шт. (${stats.revenue} грн)`)
        .join('\n')

      telegram.notifySystem(
        '📊 Щоденний звіт',
        `📅 Звіт за ${new Date().toLocaleDateString('uk-UA')}

💰 Загальна виручка: ${totalRevenue} грн
🧾 Кількість замовлень: ${totalSales}
📈 Середній чек: ${avgOrderValue} грн

🏆 Топ товари:
${topItems || 'Немає продажів'}

⏰ ${new Date().toLocaleString('uk-UA')}`,
        'low'
      )
    } catch (error) {
      console.error('Error sending daily report:', error)
    }
  }

  // Проверка критических остатков
  const checkCriticalStock = async () => {
    try {
      const response = await fetch('/api/inventory')
      if (!response.ok) return

      const data = await response.json()
      
      const criticalItems = data.items?.filter((item: any) => 
        item.current_stock <= 0
      ) || []

      const lowStockItems = data.items?.filter((item: any) => 
        item.current_stock > 0 && 
        item.current_stock <= item.minimum_stock && 
        item.minimum_stock > 0
      ) || []

      if (criticalItems.length > 0) {
        telegram.notifyOutOfStock(
          criticalItems.map((item: any) => ({ name: item.name_lt || item.name }))
        )
      }

      if (lowStockItems.length > 0) {
        telegram.notifyLowStock(
          lowStockItems.map((item: any) => ({
            name: item.name_lt || item.name,
            current: item.current_stock,
            minimum: item.minimum_stock
          }))
        )
      }
    } catch (error) {
      console.error('Error checking stock:', error)
    }
  }

  return {
    notifyNewSale,
    notifyStockChange,
    sendDailySalesReport,
    checkCriticalStock
  }
}
