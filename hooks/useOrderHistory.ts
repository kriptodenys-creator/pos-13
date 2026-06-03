import { useState, useCallback } from "react"
import type { CompletedOrder } from "@/types/pos"
import { broadcastSyncEvent, type SyncEvent } from "@/lib/sync"

export function useOrderHistory() {
  const [deliveringOrders, setDeliveringOrders] = useState<Set<string>>(new Set())

  const broadcastOrderStatus = useCallback((orderId: string, status: string) => {
    const syncEvent: SyncEvent = {
      type: 'order-status-updated',
      data: { orderId, status, timestamp: Date.now() }
    }
    broadcastSyncEvent(syncEvent)
  }, [])

  const broadcastOrdersUpdated = useCallback(() => {
    const syncEvent: SyncEvent = {
      type: 'order-created', // Используем existing type для общего обновления
      data: { orderId: 'refresh', timestamp: Date.now() }
    }
    broadcastSyncEvent(syncEvent)
  }, [])

  const loadCompletedOrdersFromDatabase = useCallback(async (): Promise<CompletedOrder[]> => {
    try {
      const response = await fetch('/api/orders')
      if (!response.ok) {
        throw new Error('Failed to load orders')
      }
      
      const data = await response.json()
      
      if (!data.orders || !Array.isArray(data.orders)) {
        return []
      }

      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const todayOrders = data.orders
        .filter((order: any) => {
          const orderDate = new Date(order.timestamp)
          orderDate.setHours(0, 0, 0, 0)
          return orderDate.getTime() === today.getTime()
        })
        .map((order: any) => ({
          ...order,
          timestamp: new Date(order.timestamp),
          items: order.items || []
        }))
        .sort((a: any, b: any) => b.timestamp.getTime() - a.timestamp.getTime())

      return todayOrders
    } catch (error) {
      console.error('[OrderHistory] Ошибка загрузки заказов:', error)
      return []
    }
  }, [])

  const markOrderAsDelivered = useCallback(async (
    orderId: string,
    completedOrders: CompletedOrder[],
    setCompletedOrders: (orders: CompletedOrder[] | ((prev: CompletedOrder[]) => CompletedOrder[])) => void,
    playSound: (type: 'complete' | 'error') => void,
    language: 'uk' | 'lt'
  ) => {
    if (deliveringOrders.has(orderId)) {
      console.log('[OrderHistory] ⚠️ Заказ уже обрабатывается:', orderId)
      return
    }

    console.log('[OrderHistory] 📦 Начало выдачи заказа:', orderId)

    try {
      setDeliveringOrders(prev => new Set(prev).add(orderId))
      
      // ОПТИМИСТИЧНОЕ ОБНОВЛЕНИЕ - обновляем UI сразу, не дожидаясь ответа сервера
      setCompletedOrders(prev => {
        return prev.map(order => {
          if (String(order.id) === String(orderId)) {
            console.log('[OrderHistory] 🔄 Оптимистичное обновление UI: статус → completed')
            return { ...order, status: 'completed' }
          }
          return order
        })
      })
      
      console.log('[OrderHistory] 📡 Отправка PUT запроса на /api/orders...')
      const response = await fetch("/api/orders", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orderId, status: 'completed' }),
      })

      console.log('[OrderHistory] 📥 Ответ от API:', response.status, response.ok)

      if (response.ok) {
        console.log('[OrderHistory] ✅ Заказ успешно помечен как выданный')
        
        // SSE автоматически отправит уведомление через API (order-status-updated event)
        playSound('complete')
        broadcastOrderStatus(orderId, 'completed')
        broadcastOrdersUpdated()
      } else {
        // Откатываем изменения при ошибке
        console.error('[OrderHistory] Ошибка при обновлении статуса заказа:', response.status)
        setCompletedOrders(prev => {
          return prev.map(order => {
            if (String(order.id) === String(orderId)) {
              return { ...order, status: 'ready' } // Возвращаем статус обратно
            }
            return order
          })
        })
        playSound('error')
      }
    } catch (error) {
      console.error('[OrderHistory] Ошибка при отметке заказа как выданного:', error)
      console.error('[OrderHistory] Error details:', error instanceof Error ? error.message : String(error))
      console.error('[OrderHistory] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
      
      // Откатываем изменения при ошибке
      setCompletedOrders(prev => {
        return prev.map(order => {
          if (String(order.id) === String(orderId)) {
            return { ...order, status: 'ready' }
          }
          return order
        })
      })
      playSound('error')
      
      // Показываем пользователю сообщение об ошибке
      alert(`Ошибка при обновлении статуса заказа: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`)
    } finally {
      setDeliveringOrders(prev => {
        const newSet = new Set(prev)
        newSet.delete(orderId)
        return newSet
      })
    }
  }, [deliveringOrders])

  const deleteOrder = useCallback(async (
    orderId: string,
    pin: string,
    setCompletedOrders: (orders: CompletedOrder[] | ((prev: CompletedOrder[]) => CompletedOrder[])) => void,
    playSound: (type: 'complete' | 'error') => void
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch('/api/orders', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orderId, pin }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // Удаляем заказ из списка
        setCompletedOrders(prev => prev.filter(order => String(order.id) !== String(orderId)))
        
        // SSE автоматически отправит уведомление через API (order-status-updated event)
        playSound('complete')
        return { success: true }
      } else {
        playSound('error')
        return { success: false, error: data.error || 'Ошибка удаления заказа' }
      }
    } catch (error) {
      console.error('[OrderHistory] Ошибка при удалении заказа:', error)
      playSound('error')
      return { success: false, error: 'Произошла ошибка при удалении заказа' }
    }
  }, [])

  return {
    loadCompletedOrdersFromDatabase,
    markOrderAsDelivered,
    deleteOrder,
    deliveringOrders
  }
}
