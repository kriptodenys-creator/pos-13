/**
 * Утилиты для синхронизации между вкладками и устройствами
 */

// BroadcastChannel для cross-tab синхронизации
let broadcastChannel: BroadcastChannel | null = null

// Генерируем уникальный ID устройства/сессии
const deviceId = `device-${Math.random().toString(36).substr(2, 9)}-${Date.now()}`

// Типы событий для синхронизации
export interface SyncEvent {
  type: 'order-status-updated' | 'order-created' | 'order-deleted' | 'heartbeat'
  data: {
    orderId?: string
    status?: string
    timestamp: number
    deviceId?: string
  }
}

// Инициализация BroadcastChannel
export function initBroadcastChannel(): void {
  if (typeof window === 'undefined') return
  
  try {
    broadcastChannel = new BroadcastChannel('pos-sync')
    console.log('[Sync] BroadcastChannel initialized')
  } catch (error) {
    console.warn('[Sync] BroadcastChannel not supported:', error)
  }
}

// Отправка события через BroadcastChannel
export function broadcastSyncEvent(event: SyncEvent): void {
  if (broadcastChannel) {
    try {
      // Добавляем deviceId ко всем событиям
      const eventWithDevice = {
        ...event,
        data: {
          ...event.data,
          deviceId
        }
      }
      broadcastChannel.postMessage(eventWithDevice)
      console.log('[Sync] BroadcastChannel event sent:', eventWithDevice)
    } catch (error) {
      console.warn('[Sync] Failed to send BroadcastChannel event:', error)
    }
  }
}

// Отправка heartbeat для проверки соединения
export function sendHeartbeat(): void {
  const heartbeatEvent: SyncEvent = {
    type: 'heartbeat',
    data: {
      timestamp: Date.now(),
      deviceId
    }
  }
  broadcastSyncEvent(heartbeatEvent)
}

// Подписка на события BroadcastChannel
export function onBroadcastSyncEvent(callback: (event: SyncEvent) => void): () => void {
  if (!broadcastChannel) return () => {}
  
  const handler = (event: MessageEvent) => {
    try {
      const syncEvent = event.data as SyncEvent
      
      // Игнорируем собственные события (echo prevention)
      if (syncEvent.data?.deviceId === deviceId) {
        return
      }
      
      console.log('[Sync] BroadcastChannel event received:', syncEvent)
      callback(syncEvent)
    } catch (error) {
      console.error('[Sync] Error parsing BroadcastChannel event:', error)
    }
  }
  
  broadcastChannel.addEventListener('message', handler)
  
  return () => {
    broadcastChannel?.removeEventListener('message', handler)
  }
}

// Polling fallback для SSE
export function createPollingFallback(
  fetchFn: () => Promise<void>, 
  interval: number = 3000 // Уменьшили с 5000 до 3000 для быстрой реакции
): { start: () => void; stop: () => void } {
  let intervalId: NodeJS.Timeout | null = null
  let isActive = false
  let lastFetchTime = 0
  
  const start = () => {
    if (isActive) return
    isActive = true
    
    console.log(`[Sync] Starting fast polling with ${interval}ms interval`)
    
    // Первая загрузка сразу
    fetchFn().catch(error => {
      console.error('[Sync] Initial fetch failed:', error)
    })
    
    // Регулярные обновления с проверкой на дублирование
    intervalId = setInterval(() => {
      if (isActive) {
        const now = Date.now()
        // Пропускаем если прошло меньше времени чем интервал
        if (now - lastFetchTime < interval) {
          return
        }
        
        lastFetchTime = now
        fetchFn().catch(error => {
          console.error('[Sync] Polling fetch failed:', error)
        })
      }
    }, interval)
  }
  
  const stop = () => {
    isActive = false
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
      console.log('[Sync] Fast polling stopped')
    }
  }
  
  return { start, stop }
}

// SSE reconnect логика с экспоненциальным backoff
export function createSSEManager(
  url: string,
  onMessage: (event: MessageEvent) => void,
  onError?: () => void,
  options?: {
    staleTimeoutMs?: number
    onStale?: () => void | Promise<void>
  }
) {
  let eventSource: EventSource | null = null
  let reconnectTimer: NodeJS.Timeout | null = null
  let reconnectAttempts = 0
  let isDestroyed = false
  let lastMessageTime = 0
  let staleTriggeredAt = 0
  
  const maxReconnectAttempts = 10
  const baseReconnectDelay = 500 // Уменьшили с 1000 до 500 для быстрого reconect
  const maxReconnectDelay = 10000 // Уменьшили с 30000 до 10000
  const connectionTimeout = 10000 // 10 секунд timeout для проверки соединения
  const staleTimeoutMs = Math.max(1000, Number(options?.staleTimeoutMs) || 15000)
  
  const checkConnection = () => {
    if (eventSource && eventSource.readyState === EventSource.OPEN) {
      const now = Date.now()

      // Watchdog: if SSE is silent too long, trigger a one-shot stale handler.
      if (lastMessageTime > 0 && now - lastMessageTime > staleTimeoutMs) {
        // Prevent spamming: trigger at most once per staleTimeout window
        if (now - staleTriggeredAt > staleTimeoutMs) {
          staleTriggeredAt = now
          try {
            const p = options?.onStale?.()
            if (p) {
              Promise.resolve(p).catch((e: unknown) => {
                console.warn('[Sync] onStale handler failed:', e)
              })
            }
          } catch (e) {
            console.warn('[Sync] onStale handler failed:', e)
          }
        }
      }

      // Если нет сообщений более 10 секунд, reconect
      if (now - lastMessageTime > connectionTimeout) {
        console.log('[Sync] Connection timeout, reconnecting...')
        eventSource.close()
        scheduleReconnect()
      }
    }
  }
  
  const connect = () => {
    if (isDestroyed) return
    
    try {
      console.log(`[Sync] Connecting to SSE (attempt ${reconnectAttempts + 1})`)
      eventSource = new EventSource(url)
      
      eventSource.onopen = () => {
        console.log('[Sync] ✅ SSE Connected')
        reconnectAttempts = 0 // Сбрасываем счетчик при успешном подключении
        lastMessageTime = Date.now()
        staleTriggeredAt = 0
        
        // Отменяем таймер reconect
        if (reconnectTimer) {
          clearTimeout(reconnectTimer)
          reconnectTimer = null
        }
      }
      
      eventSource.onmessage = (event) => {
        lastMessageTime = Date.now()
        staleTriggeredAt = 0
        onMessage(event)
      }
      
      eventSource.onerror = () => {
        console.log('[Sync] ❌ SSE Connection lost')
        eventSource?.close()
        eventSource = null
        
        if (!isDestroyed) {
          scheduleReconnect()
          onError?.()
        }
      }
      
    } catch (error) {
      console.error('[Sync] SSE connection error:', error)
      if (!isDestroyed) {
        scheduleReconnect()
      }
    }
  }
  
  const scheduleReconnect = () => {
    if (isDestroyed || reconnectTimer) return
    
    if (reconnectAttempts >= maxReconnectAttempts) {
      console.error('[Sync] Max reconnect attempts reached, giving up')
      return
    }
    
    // Экспоненциальный backoff
    const delay = Math.min(
      baseReconnectDelay * Math.pow(2, reconnectAttempts),
      maxReconnectDelay
    )
    
    reconnectAttempts++
    console.log(`[Sync] Scheduling reconnect in ${delay}ms (attempt ${reconnectAttempts})`)
    
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      connect()
    }, delay)
  }
  
  const destroy = () => {
    isDestroyed = true
    
    if (eventSource) {
      eventSource.close()
      eventSource = null
    }
    
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }

    clearInterval(connectionCheckInterval)
    
    console.log('[Sync] SSE manager destroyed')
  }
  
  // Запускаем проверку соединения каждые 5 секунд
  const connectionCheckInterval = setInterval(checkConnection, 5000)
  
  return {
    connect,
    destroy,
    getConnectionState: () => ({
      connected: eventSource?.readyState === EventSource.OPEN,
      lastMessageTime,
      reconnectAttempts
    })
  }
}
