'use client'

import { useEffect } from 'react'

type Level = 'error' | 'warn' | 'info'

function safeStringify(value: unknown) {
  try {
    return JSON.stringify(value)
  } catch {
    try {
      return String(value)
    } catch {
      return '[unserializable]'
    }
  }
}

async function postLog(level: Level, message: string, stack?: string, context?: unknown) {
  try {
    const payload = {
      level,
      message,
      stack,
      context,
    }

    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([safeStringify(payload)], { type: 'application/json' })
      navigator.sendBeacon('/api/logs', blob)
      return
    }

    await fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: safeStringify(payload),
      keepalive: true,
    })
  } catch {
    // ignore
  }
}

export default function SystemErrorReporter() {
  useEffect(() => {
    let lastSentAt = 0
    const minIntervalMs = 1500

    const shouldSend = () => {
      const now = Date.now()
      if (now - lastSentAt < minIntervalMs) return false
      lastSentAt = now
      return true
    }

    const originalConsoleError = console.error
    console.error = (...args: unknown[]) => {
      try {
        if (shouldSend()) {
          const err = args.find((a) => a instanceof Error) as Error | undefined
          const message = args
            .map((a) => {
              if (a instanceof Error) return a.message
              if (typeof a === 'string') return a
              return safeStringify(a)
            })
            .join(' ')
          postLog('error', message || 'Unknown error', err?.stack, { args })
        }
      } catch {
        // ignore
      }

      originalConsoleError(...args)
    }

    const onError = (event: ErrorEvent) => {
      if (!shouldSend()) return
      postLog('error', event.message || 'window.onerror', event.error?.stack, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      })
    }

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (!shouldSend()) return
      const reason: unknown = event.reason
      postLog(
        'error',
        reason instanceof Error ? reason.message : safeStringify(reason),
        reason instanceof Error ? reason.stack : undefined,
        { type: 'unhandledrejection' }
      )
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onUnhandledRejection)

    return () => {
      console.error = originalConsoleError
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onUnhandledRejection)
    }
  }, [])

  return null
}
