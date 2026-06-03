'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import AdminProtection from '@/components/AdminProtection'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

type LogEntry = {
  id: string
  level: 'error' | 'warn' | 'info'
  message: string
  stack?: string
  context?: any
  createdAt: number
}

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/logs?limit=200', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok || !data?.success) {
        setError(data?.error || `HTTP ${res.status}`)
        return
      }
      setLogs(Array.isArray(data.logs) ? data.logs : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  const clearLogs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/logs', { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok || !data?.success) {
        setError(data?.error || `HTTP ${res.status}`)
        return
      }
      setLogs([])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const rows = useMemo(() => {
    return logs.map((l) => ({
      ...l,
      time: new Date(l.createdAt).toLocaleString(),
    }))
  }, [logs])

  return (
    <AdminProtection>
      <div className="min-h-screen bg-black text-orange-500 p-4">
        <div className="max-w-6xl mx-auto space-y-4">
          <Card className="bg-gray-900 border-orange-500">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-orange-500">Логи системы</CardTitle>
              <div className="flex gap-2">
                <Button onClick={fetchLogs} disabled={loading} className="bg-orange-600 hover:bg-orange-700 text-white">
                  Обновить
                </Button>
                <Button onClick={clearLogs} disabled={loading} variant="destructive">
                  Очистить
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="mb-3 p-3 rounded border border-red-500 bg-red-950 text-red-200">
                  {error}
                </div>
              )}

              <div className="text-sm text-orange-300 mb-3">
                Показано: {rows.length}
              </div>

              <div className="space-y-3">
                {rows.length === 0 ? (
                  <div className="text-orange-300">Логов пока нет.</div>
                ) : (
                  rows.map((l) => (
                    <div key={l.id} className="p-3 rounded border border-gray-700 bg-gray-950">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="font-bold text-orange-500">[{l.level.toUpperCase()}] {l.time}</div>
                        <div className="text-orange-300 break-all">{l.id}</div>
                      </div>
                      <div className="mt-2 text-white whitespace-pre-wrap break-words">{l.message}</div>
                      {l.stack && (
                        <pre className="mt-2 text-xs text-gray-300 whitespace-pre-wrap break-words">{l.stack}</pre>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminProtection>
  )
}
