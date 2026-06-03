import type { CompletedOrder } from '@/types/pos'

export function reconcileCompletedOrders(prev: CompletedOrder[], next: CompletedOrder[]): CompletedOrder[] {
  if (prev.length !== next.length) return next

  return prev.map((prevOrder) => {
    const dbOrder = next.find((o) => o.id === prevOrder.id)
    if (!dbOrder) return prevOrder

    if (dbOrder.status !== prevOrder.status) {
      return dbOrder
    }

    return prevOrder
  })
}
