import { useEffect } from 'react'
import type { CompletedOrder } from '@/types/pos'
import type { SyncEvent } from '@/lib/sync'
import { initBroadcastChannel, onBroadcastSyncEvent, createPollingFallback, createSSEManager, sendHeartbeat } from '@/lib/sync'

type UsePosOrdersSyncOptions = {
  enabled: boolean
  checkOrdersVersionChanged: () => Promise<boolean>
  completedOrdersRef: React.MutableRefObject<CompletedOrder[]>
  loadCompletedOrdersFromDatabase: () => Promise<CompletedOrder[]>
  setCompletedOrders: (orders: CompletedOrder[] | ((prev: CompletedOrder[]) => CompletedOrder[])) => void
  playReadySound: () => void
  onMenuUpdated: () => Promise<void>
  logError: (msg: string, err: unknown) => void
}

export function usePosOrdersSync({
  enabled,
  checkOrdersVersionChanged,
  completedOrdersRef,
  loadCompletedOrdersFromDatabase,
  setCompletedOrders,
  playReadySound,
  onMenuUpdated,
  logError,
}: UsePosOrdersSyncOptions) {
  useEffect(() => {
    if (!enabled) return

    const updateFromDbIfVersionChanged = async () => {
      const changed = await checkOrdersVersionChanged()
      if (!changed) return
      const orders = await loadCompletedOrdersFromDatabase()
      setCompletedOrders(orders)
    }

    initBroadcastChannel()

    const sseManager = createSSEManager(
      '/api/events',
      async (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'heartbeat' || data.type === 'connected') return

          if (data.type === 'order-created') {
            const newOrderId = String(data.data.orderId)
            const orderExists = completedOrdersRef.current.some((order) => String(order.id) === newOrderId)
            if (!orderExists) {
              await updateFromDbIfVersionChanged()
            }
          } else if (data.type === 'order-status-updated') {
            // Immediate load to prevent flicker
            const orders = await loadCompletedOrdersFromDatabase()
            setCompletedOrders(orders)
            if (data.data.status === 'ready') {
              playReadySound()
            }
            // Safety version-based check after 1.5s in case of race
            setTimeout(() => {
              updateFromDbIfVersionChanged().catch((e) => logError('[POS] Fallback version check failed:', e))
            }, 1500)
          } else if (data.type === 'menu-updated') {
            await onMenuUpdated()
          }
        } catch (e) {
          logError('[POS] SSE message parse error:', e)
        }
      },
      () => {
        // fallback polling active
      },
      {
        staleTimeoutMs: 15000,
        onStale: async () => {
          try {
            await updateFromDbIfVersionChanged()
          } catch (e) {
            logError('[POS] SSE watchdog update failed:', e)
          }
        },
      }
    )

    sseManager.connect()

    const polling = createPollingFallback(async () => {
      try {
        await updateFromDbIfVersionChanged()
      } catch (e) {
        logError('[POS] Polling update failed:', e)
      }
    }, 3000)

    polling.start()

    const unsubscribeBroadcast = onBroadcastSyncEvent(async (event: SyncEvent) => {
      try {
        if (event.type === 'order-status-updated') {
          setCompletedOrders((prev) =>
            prev.map((order) =>
              String(order.id) === String(event.data.orderId)
                ? { ...order, status: event.data.status || 'unknown' }
                : order
            )
          )

          if (event.data.status === 'ready') {
            playReadySound()
          }

          setTimeout(() => {
            updateFromDbIfVersionChanged().catch((e) => logError('[POS] Fallback reload failed:', e))
          }, 1000)
        } else if (event.type === 'order-created') {
          setTimeout(() => {
            updateFromDbIfVersionChanged().catch((e) => logError('[POS] Order created reload failed:', e))
          }, 500)
        }
      } catch (e) {
        logError('[POS] Broadcast handler failed:', e)
      }
    })

    const heartbeatInterval = setInterval(() => {
      sendHeartbeat()
    }, 30000)

    return () => {
      sseManager.destroy()
      polling.stop()
      unsubscribeBroadcast()
      clearInterval(heartbeatInterval)
    }
  }, [
    enabled,
    checkOrdersVersionChanged,
    completedOrdersRef,
    loadCompletedOrdersFromDatabase,
    onMenuUpdated,
    playReadySound,
    setCompletedOrders,
    logError,
  ])
}
