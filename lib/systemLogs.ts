export type SystemLogLevel = 'error' | 'warn' | 'info'

export type SystemLogEntry = {
  id: string
  level: SystemLogLevel
  message: string
  stack?: string
  context?: unknown
  createdAt: number
}

const MAX_LOGS = 500

let logs: SystemLogEntry[] = []

let captureInstalled = false

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function addSystemLog(entry: Omit<SystemLogEntry, 'id' | 'createdAt'> & { id?: string; createdAt?: number }) {
  const full: SystemLogEntry = {
    id: entry.id ?? makeId(),
    level: entry.level,
    message: entry.message,
    stack: entry.stack,
    context: entry.context,
    createdAt: entry.createdAt ?? Date.now(),
  }

  logs = [full, ...logs].slice(0, MAX_LOGS)
}

export function getSystemLogs(limit: number = 200): SystemLogEntry[] {
  return logs.slice(0, Math.max(1, Math.min(limit, MAX_LOGS)))
}

export function clearSystemLogs() {
  logs = []
}

function installServerLogCapture() {
  if (captureInstalled) return
  captureInstalled = true

  const originalConsoleError = console.error
  console.error = (...args: unknown[]) => {
    try {
      const message = args
        .map((a) => {
          if (a instanceof Error) return a.message
          if (typeof a === 'string') return a
          try {
            return JSON.stringify(a)
          } catch {
            return String(a)
          }
        })
        .join(' ')

      const stack = args.find((a) => a instanceof Error) as Error | undefined

      addSystemLog({
        level: 'error',
        message: message || 'Unknown error',
        stack: stack?.stack,
        context: args,
      })
    } catch {
      // ignore
    }

    originalConsoleError(...args)
  }

  if (typeof process !== 'undefined' && typeof process.on === 'function') {
    process.on('unhandledRejection', (reason: unknown) => {
      try {
        addSystemLog({
          level: 'error',
          message: reason instanceof Error ? reason.message : String(reason),
          stack: reason instanceof Error ? reason.stack : undefined,
          context: { type: 'unhandledRejection', reason },
        })
      } catch {
        // ignore
      }
    })

    process.on('uncaughtException', (err: unknown) => {
      try {
        addSystemLog({
          level: 'error',
          message: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
          context: { type: 'uncaughtException', err },
        })
      } catch {
        // ignore
      }
    })
  }
}

installServerLogCapture()
