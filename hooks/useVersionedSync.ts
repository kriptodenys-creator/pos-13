'use client'

import { useCallback, useEffect, useRef } from 'react'
import { createPollingFallback, createSSEManager } from '@/lib/sync'

type UseVersionedSyncOptions = {
  enabled?: boolean
  versionUrl?: string
  sseUrl?: string
  pollingIntervalMs?: number
  onVersionChange: () => Promise<void> | void
}

export function useVersionedSync({
  enabled = true,
  versionUrl = '/api/orders/version',
  sseUrl = '/api/events',
  pollingIntervalMs = 3000,
  onVersionChange,
}: UseVersionedSyncOptions) {
  const lastVersionRef = useRef<string>('')

  const fetchVersion = useCallback(async () => {
    try {
      const res = await fetch(versionUrl, { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data?.success === false) return ''
      return String(data.version || '')
    } catch {
      return ''
    }
  }, [versionUrl])

  const syncIfChanged = useCallback(async () => {
    const v = await fetchVersion()
    if (v && v !== lastVersionRef.current) {
      lastVersionRef.current = v
      await onVersionChange()
    }
  }, [fetchVersion, onVersionChange])

  useEffect(() => {
    if (!enabled) return

    const sseManager = createSSEManager(
      sseUrl,
      async (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'heartbeat' || data.type === 'connected') return
          if (data.type === 'order-created' || data.type === 'order-status-updated') {
            await syncIfChanged()
          }
        } catch {
          // ignore
        }
      },
      () => {
        // fallback polling active
      },
      {
        staleTimeoutMs: 15000,
        onStale: async () => {
          await syncIfChanged()
        },
      }
    )

    sseManager.connect()

    const polling = createPollingFallback(async () => {
      await syncIfChanged()
    }, pollingIntervalMs)

    polling.start()

    return () => {
      sseManager.destroy()
      polling.stop()
    }
  }, [enabled, pollingIntervalMs, sseUrl, syncIfChanged])

  return {
    lastVersionRef,
    syncIfChanged,
  }
}
