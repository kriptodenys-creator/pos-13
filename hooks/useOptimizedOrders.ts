import { useState, useEffect, useCallback, useMemo } from 'react'
import { posCache, CACHE_KEYS, cacheUtils } from '@/lib/cache'

interface Order {
  id: string
  total: number
  status: string
  created_at: string
  items: any[]
  [key: string]: any
}

export function useOptimizedOrders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // Мемоизированные вычисления
  const orderStats = useMemo(() => {
    const stats = {
      total: orders.length,
      new: 0,
      preparing: 0,
      ready: 0,
      completed: 0,
      cancelled: 0,
      totalRevenue: 0
    }

    orders.forEach(order => {
      const status = order.status?.toLowerCase()
      if (status === 'new') stats.new++
      else if (status === 'preparing') stats.preparing++
      else if (status === 'ready') stats.ready++
      else if (status === 'completed') stats.completed++
      else if (status === 'cancelled') stats.cancelled++

      if (status === 'completed') {
        stats.totalRevenue += order.total || 0
      }
    })

    return stats
  }, [orders])

  // Группировка заказов по статусу
  const ordersByStatus = useMemo(() => {
    const groups: Record<string, Order[]> = {}
    orders.forEach(order => {
      const status = order.status || 'unknown'
      if (!groups[status]) groups[status] = []
      groups[status].push(order)
    })
    return groups
  }, [orders])

  // Загрузка заказов с кэшированием
  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const data = await cacheUtils.fetchWithMutex(
        CACHE_KEYS.ORDERS,
        async () => {
          const response = await fetch('/api/orders')
          if (!response.ok) throw new Error('Failed to fetch orders')
          return response.json()
        },
        30000 // 30 секунд TTL для активных заказов
      )

      setOrders(data.orders || [])
    } catch (err) {
      setError(err as Error)
      console.error('Error fetching orders:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Загрузка завершенных заказов с более длительным кэшированием
  const fetchCompletedOrders = useCallback(async () => {
    try {
      const data = await cacheUtils.fetchWithMutex(
        CACHE_KEYS.COMPLETED_ORDERS,
        async () => {
          const response = await fetch('/api/orders?status=completed')
          if (!response.ok) throw new Error('Failed to fetch completed orders')
          return response.json()
        },
        5 * 60 * 1000 // 5 минут TTL для завершенных заказов
      )

      return data.orders || []
    } catch (err) {
      console.error('Error fetching completed orders:', err)
      return []
    }
  }, [])

  // Создание заказа с инвалидацией кэша
  const createOrder = useCallback(async (orderData: any) => {
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      })

      if (!response.ok) throw new Error('Failed to create order')

      const newOrder = await response.json()

      // Инвалидируем кэш заказов
      posCache.delete(CACHE_KEYS.ORDERS)
      cacheUtils.invalidatePattern('reports_')

      // Обновляем локальное состояние
      setOrders(prev => [newOrder, ...prev])

      return newOrder
    } catch (err) {
      console.error('Error creating order:', err)
      throw err
    }
  }, [])

  // Обновление статуса заказа
  const updateOrderStatus = useCallback(async (orderId: string, status: string) => {
    try {
      const response = await fetch('/api/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, status })
      })

      if (!response.ok) throw new Error('Failed to update order status')

      // Инвалидируем кэш
      posCache.delete(CACHE_KEYS.ORDERS)
      posCache.delete(CACHE_KEYS.COMPLETED_ORDERS)
      cacheUtils.invalidatePattern('reports_')

      // Оптимистичное обновление
      setOrders(prev => prev.map(order => 
        String(order.id) === String(orderId) ? { ...order, status } : order
      ))

      return true
    } catch (err) {
      console.error('Error updating order status:', err)
      throw err
    }
  }, [])

  // Отмена заказа
  const cancelOrder = useCallback(async (orderId: string, pin: string) => {
    try {
      const response = await fetch('/api/orders', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, pin })
      })

      if (!response.ok) throw new Error('Failed to cancel order')

      // Инвалидируем кэш
      posCache.delete(CACHE_KEYS.ORDERS)
      posCache.delete(CACHE_KEYS.COMPLETED_ORDERS)
      cacheUtils.invalidatePattern('reports_')

      // Обновляем локальное состояние
      setOrders(prev => prev.map(order => 
        String(order.id) === String(orderId) ? { ...order, status: 'cancelled' } : order
      ))

      return true
    } catch (err) {
      console.error('Error cancelling order:', err)
      throw err
    }
  }, [])

  // Автоматическое обновление заказов
  useEffect(() => {
    fetchOrders()

    // Обновляем каждые 30 секунд
    const interval = setInterval(fetchOrders, 30000)
    return () => clearInterval(interval)
  }, [fetchOrders])

  // Подписка на BroadcastChannel для синхронизации между вкладками
  useEffect(() => {
    const channel = new BroadcastChannel('orders-sync')
    
    channel.addEventListener('message', (event) => {
      const { type, orderId, status } = event.data
      
      if (type === 'order-status-updated') {
        setOrders(prev => prev.map(order => 
          String(order.id) === String(orderId) ? { ...order, status } : order
        ))
      } else if (type === 'order-created') {
        // Перезагружаем заказы при создании нового
        fetchOrders()
      }
    })

    return () => channel.close()
  }, [fetchOrders])

  return {
    orders,
    loading,
    error,
    orderStats,
    ordersByStatus,
    fetchOrders,
    fetchCompletedOrders,
    createOrder,
    updateOrderStatus,
    cancelOrder,
    refetch: fetchOrders
  }
}
