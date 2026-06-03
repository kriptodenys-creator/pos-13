import { useState, useEffect, useRef } from "react"
import type { OrderItem, CompletedOrder } from "@/types/pos"

// Экспортируем типы для обратной совместимости
export type { OrderItem, CompletedOrder }

export function usePOSState() {
  const [isMounted, setIsMounted] = useState(false)
  const [language, setLanguage] = useState<"lt" | "uk">("uk")
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [orderType, setOrderType] = useState<string>("")
  const [selectedOrderTypeId, setSelectedOrderTypeId] = useState<string>("")
  const [customerName, setCustomerName] = useState<string>("")
  const [phoneNumber, setPhoneNumber] = useState<string>("")
  const [employeeDiscount, setEmployeeDiscount] = useState<{
    employeeId: number
    employeeName: string
    discountPercent: number
  } | null>(null)
  const [completedOrders, setCompletedOrders] = useState<CompletedOrder[]>([])
  const [isPreorder, setIsPreorder] = useState(false)
  const [preorderTime, setPreorderTime] = useState('')
  const [itemComments, setItemComments] = useState<Record<string, string>>({})

  const broadcastChannelRef = useRef<BroadcastChannel | null>(null)
  const instanceIdRef = useRef<string>(Math.random().toString(36).slice(2))
  const skipBroadcastRef = useRef(false)
  const lastLocalOrderRef = useRef<string | null>(null)

  useEffect(() => {
    setIsMounted(true)
    
    // Восстанавливаем из localStorage
    const savedOrder = localStorage.getItem('currentOrder')
    if (savedOrder) {
      try {
        const parsedOrder = JSON.parse(savedOrder)
        if (Array.isArray(parsedOrder)) {
          console.log('[usePOSState] 📥 Восстановлено из localStorage:', parsedOrder.length, 'товаров')
          setOrderItems(parsedOrder)
          lastLocalOrderRef.current = savedOrder
        }
      } catch (error) {
        console.warn('Не удалось восстановить заказ из localStorage:', error)
      }
    }
    
    const savedPhoneNumber = localStorage.getItem('phoneNumber')
    if (savedPhoneNumber) setPhoneNumber(savedPhoneNumber)
    
    const savedCustomerName = localStorage.getItem('customerName')
    if (savedCustomerName) setCustomerName(savedCustomerName)
    
    const savedOrderType = localStorage.getItem('orderType')
    if (savedOrderType) setOrderType(savedOrderType)
  }, [])

  // Сохраняем в localStorage при изменениях
  useEffect(() => {
    if (isMounted) {
      const serialized = JSON.stringify(orderItems)
      localStorage.setItem('currentOrder', serialized)
      console.log('[usePOSState] 💾 Сохранено в localStorage:', orderItems.length, 'товаров', serialized.length, 'байт')
    }
  }, [orderItems, isMounted])

  useEffect(() => {
    lastLocalOrderRef.current = JSON.stringify(orderItems)
  }, [orderItems])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const interval = setInterval(() => {
      const stored = localStorage.getItem('currentOrder')
      if (!stored || stored === lastLocalOrderRef.current) return
      try {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          skipBroadcastRef.current = true
          setOrderItems(parsed)
          lastLocalOrderRef.current = stored
        }
      } catch (error) {
        console.warn('[POS] Не удалось распарсить заказ из интервала:', error)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== 'currentOrder') return
      if (!event.newValue) return
      try {
        const parsedOrder = JSON.parse(event.newValue)
        if (Array.isArray(parsedOrder)) {
          skipBroadcastRef.current = true
          setOrderItems(parsedOrder)
        }
      } catch (error) {
        console.warn('[POS] Не удалось распарсить обновленный заказ из storage:', error)
      }
    }

    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return

    const channel = new BroadcastChannel('order-items-sync')
    broadcastChannelRef.current = channel
    channel.onmessage = (event) => {
      const payload = event.data
      if (!payload || payload.senderId === instanceIdRef.current) return
      if (Array.isArray(payload.orderItems)) {
        skipBroadcastRef.current = true
        setOrderItems(payload.orderItems)
      }
    }

    return () => {
      channel.close()
      broadcastChannelRef.current = null
    }
  }, [])

  useEffect(() => {
    if (skipBroadcastRef.current) {
      skipBroadcastRef.current = false
      return
    }

    if (!broadcastChannelRef.current) return

    broadcastChannelRef.current.postMessage({
      orderItems,
      senderId: instanceIdRef.current,
    })
  }, [orderItems])

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem('customerName', customerName)
    }
  }, [customerName, isMounted])

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem('orderType', orderType)
    }
  }, [orderType, isMounted])

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem('phoneNumber', phoneNumber)
    }
  }, [phoneNumber, isMounted])

  const clearOrder = () => {
    setOrderItems([])
    setCustomerName('')
    setPhoneNumber('')
    setOrderType('')
    setSelectedOrderTypeId('')
    setItemComments({})
    setEmployeeDiscount(null)
    setIsPreorder(false)
    setPreorderTime('')
    
    localStorage.removeItem('currentOrder')
    localStorage.removeItem('customerName')
    localStorage.removeItem('phoneNumber')
    localStorage.removeItem('orderType')
  }

  return {
    isMounted,
    language,
    setLanguage,
    orderItems,
    setOrderItems,
    orderType,
    setOrderType,
    selectedOrderTypeId,
    setSelectedOrderTypeId,
    customerName,
    setCustomerName,
    phoneNumber,
    setPhoneNumber,
    employeeDiscount,
    setEmployeeDiscount,
    completedOrders,
    setCompletedOrders,
    isPreorder,
    setIsPreorder,
    preorderTime,
    setPreorderTime,
    itemComments,
    setItemComments,
    clearOrder
  }
}
