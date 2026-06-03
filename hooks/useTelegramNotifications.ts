"use client"

import { useEffect, useCallback } from 'react'
import { telegramClient } from '@/lib/telegram-client'

// Хук для автоматических уведомлений в POS системе
export function useTelegramNotifications() {
  
  // Уведомление о новом заказе
  const notifyNewOrder = useCallback((orderData: {
    id: string
    total: number
    items: Array<{name: string, quantity: number}>
    orderType: string
  }) => {
    const itemsCount = orderData.items.reduce((sum, item) => sum + item.quantity, 0)
    
    telegramClient.notifyNewOrder({
      id: orderData.id,
      total: orderData.total,
      items: itemsCount
    })
  }, [])

  // Проверка остатков (вызывается вручную или по расписанию)
  const checkInventoryLevels = useCallback(async () => {
    try {
      // В реальном приложении здесь будет запрос к API инвентаря
      const response = await fetch('/api/inventory')
      if (!response.ok) return

      const data = await response.json()
      
      // Фильтруем товары с низкими остатками
      const lowStockItems = data.items?.filter((item: any) => 
        item.current_stock <= item.minimum_stock && item.minimum_stock > 0
      ).map((item: any) => ({
        name: item.name_lt || item.name,
        current: item.current_stock,
        minimum: item.minimum_stock
      })) || []

      // Фильтруем товары которые закончились
      const outOfStockItems = data.items?.filter((item: any) => 
        item.current_stock <= 0
      ).map((item: any) => ({
        name: item.name_lt || item.name
      })) || []

      // Отправляем уведомления
      if (lowStockItems.length > 0) {
        telegramClient.notifyLowStock(lowStockItems)
      }

      if (outOfStockItems.length > 0) {
        telegramClient.notifyOutOfStock(outOfStockItems)
      }

      return {
        lowStock: lowStockItems.length,
        outOfStock: outOfStockItems.length
      }
    } catch (error) {
      console.error('Error checking inventory levels:', error)
      return null
    }
  }, [])

  // Системные уведомления
  const notifySystem = useCallback((
    title: string, 
    message: string, 
    priority: 'low' | 'medium' | 'high' = 'medium'
  ) => {
    telegramClient.notifySystem(title, message, priority)
  }, [])

  // Автоматическая проверка остатков при монтировании компонента
  useEffect(() => {
    // Проверяем остатки при загрузке страницы (если настроен Telegram)
    const stats = telegramClient.getStats()
    if (stats.configured && stats.online) {
      // Задержка чтобы не спамить при каждом обновлении страницы
      const timer = setTimeout(() => {
        checkInventoryLevels()
      }, 5000)
      
      return () => clearTimeout(timer)
    }
  }, [checkInventoryLevels])

  // Получение статистики Telegram
  const getStats = useCallback(() => {
    return telegramClient.getStats()
  }, [])

  return {
    notifyNewOrder,
    checkInventoryLevels,
    notifySystem,
    getStats,
    // Прямой доступ к клиенту для расширенных функций
    client: telegramClient
  }
}

// Хук для компонентов которые хотят отслеживать статус Telegram
export function useTelegramStatus() {
  const { getStats } = useTelegramNotifications()
  
  return {
    getStats,
    isConfigured: () => getStats().configured,
    isOnline: () => getStats().online,
    getQueueLength: () => getStats().queueLength,
    getUnsentCount: () => getStats().unsentCount
  }
}
