import { useCallback, useEffect } from "react"
import type { OrderItem } from "./usePOSState"

interface UseOrderManagementProps {
  orderItems: OrderItem[]
  setOrderItems: (items: OrderItem[] | ((prev: OrderItem[]) => OrderItem[])) => void
  happyHourDiscounts: Record<string, number>
  packagingCost: number
  selectedOrderTypeId: string
  playSound: (type: 'add' | 'remove' | 'complete' | 'click' | 'error') => void
  employeeDiscount?: { employeeId: number; employeeName: string; discountPercent: number } | null
}

export function useOrderManagement({
  orderItems,
  setOrderItems,
  happyHourDiscounts,
  packagingCost,
  selectedOrderTypeId,
  playSound,
  employeeDiscount
}: UseOrderManagementProps) {

  useEffect(() => {
    setOrderItems((prev) => {
      let changed = false

      const round2 = (v: number) => Math.round(v * 100) / 100

      const next = prev.map((item) => {
        const originalPrice = Number((item as any).original_price ?? item.price) || 0
        const hhDiscount = Number(happyHourDiscounts[item.id] ?? (item as any).happy_hour_discount ?? 0) || 0
        const finalPrice = hhDiscount > 0 ? round2(originalPrice * (1 - hhDiscount / 100)) : round2(originalPrice)

        const currentPrice = round2(Number((item as any).price) || 0)
        const currentOriginal = Number((item as any).original_price ?? originalPrice) || 0
        const currentDiscount = Number((item as any).happy_hour_discount ?? 0) || 0

        if (currentPrice !== finalPrice || currentOriginal !== originalPrice || currentDiscount !== hhDiscount) {
          changed = true
          return {
            ...item,
            price: finalPrice,
            original_price: originalPrice,
            happy_hour_discount: hhDiscount,
          } as any
        }

        return item
      })

      return changed ? (next as any) : prev
    })
  }, [happyHourDiscounts, setOrderItems])

  const addToOrder = useCallback((item: any, modifiers: any[] = [], comboData?: any) => {
    // Валідація: перевірка на пусті значення
    if (!item || !item.id || !item.name) {
      playSound('error')
      return
    }

    // Валідація: перевірка ціни
    const price = Number(item.price)
    if (isNaN(price) || price < 0) {
      playSound('error')
      return
    }

    playSound('add')
    
    setOrderItems((prev) => {
      // Перевірка на дублікати: шукаємо товар з такими ж модифікаторами
      const existingIndex = prev.findIndex(
        (orderItem) =>
          orderItem.id === item.id &&
          JSON.stringify(orderItem.selectedModifiers) === JSON.stringify(modifiers)
      )

      if (existingIndex !== -1) {
        // Товар вже є - збільшуємо кількість
        const updated = [...prev]
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + 1,
        }
        return updated
      }

      const originalPrice = Number(item.price) || 0
      const hhDiscount = Number(happyHourDiscounts[item.id] || 0)
      const finalPrice = hhDiscount > 0 ? originalPrice * (1 - hhDiscount / 100) : originalPrice
      
      return [
        ...prev,
        {
          id: item.id,
          name: item.name,
          price: finalPrice,
          original_price: originalPrice,
          happy_hour_discount: hhDiscount,
          quantity: 1,
          selectedModifiers: modifiers,
          category: item.category || '',
          comboData: comboData || undefined,
          tempId: `${item.id}-${Date.now()}-${Math.random()}`, // Унікальний ID для React keys
        },
      ]
    })
  }, [happyHourDiscounts, playSound, setOrderItems])

  const updateQuantity = useCallback((itemId: string, modifiers: any[], newQuantity: number) => {
    if (newQuantity <= 0) {
      playSound('remove')
      setOrderItems((prev) =>
        prev.filter(
          (item) =>
            !(item.id === itemId && JSON.stringify(item.selectedModifiers) === JSON.stringify(modifiers))
        )
      )
    } else {
      setOrderItems((prev) =>
        prev.map((item) =>
          item.id === itemId && JSON.stringify(item.selectedModifiers) === JSON.stringify(modifiers)
            ? { ...item, quantity: newQuantity }
            : item
        )
      )
    }
  }, [playSound, setOrderItems])

  const removeFromOrder = useCallback((itemId: string, modifiers: any[]) => {
    playSound('remove')
    setOrderItems((prev) =>
      prev.filter(
        (item) =>
          !(item.id === itemId && JSON.stringify(item.selectedModifiers) === JSON.stringify(modifiers))
      )
    )
  }, [playSound, setOrderItems])

  const updateItemComment = useCallback((itemId: string, modifiers: any[], comment: string) => {
    setOrderItems((prev) =>
      prev.map((item) =>
        item.id === itemId && JSON.stringify(item.selectedModifiers) === JSON.stringify(modifiers)
          ? { ...item, comment }
          : item
      )
    )
  }, [setOrderItems])

  const calculateTotal = useCallback(() => {
    const itemsTotal = orderItems.reduce((sum, item) => {
      const modifiersTotal = item.selectedModifiers.reduce((modSum, mod) => modSum + (mod.price || 0), 0)
      return sum + (item.price + modifiersTotal) * item.quantity
    }, 0)

    const packagingTotal = selectedOrderTypeId === 'delivery' 
      ? orderItems.reduce((sum, item) => sum + item.quantity, 0) * packagingCost
      : 0

    const grandTotal = itemsTotal + packagingTotal

    // Apply employee discount if available
    if (employeeDiscount && employeeDiscount.discountPercent > 0) {
      const discountAmount = grandTotal * (employeeDiscount.discountPercent / 100)
      return {
        itemsTotal,
        packagingTotal,
        discountAmount,
        grandTotal: grandTotal - discountAmount
      }
    }

    return {
      itemsTotal,
      packagingTotal,
      discountAmount: 0,
      grandTotal
    }
  }, [orderItems, selectedOrderTypeId, packagingCost, employeeDiscount])

  const clearOrder = useCallback(() => {
    setOrderItems([])
  }, [setOrderItems])

  return {
    addToOrder,
    updateQuantity,
    removeFromOrder,
    updateItemComment,
    calculateTotal,
    clearOrder
  }
}
