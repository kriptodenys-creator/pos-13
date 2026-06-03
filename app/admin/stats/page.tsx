'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import AdminProtection from '@/components/AdminProtection'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, RefreshCw } from 'lucide-react'

type StatsItem = {
  item_id: string
  name_uk: string
  name_lt: string
  completed_quantity: number
  completed_amount: number
  cancelled_quantity: number
  cancelled_amount: number
}

type DailyStatsResponse = {
  success: boolean
  date?: string
  items?: StatsItem[]
  totals?: {
    completed_quantity: number
    completed_amount: number
    cancelled_quantity: number
    cancelled_amount: number
  }
  error?: string
}

async function loadDailyStats(): Promise<DailyStatsResponse> {
  const res = await fetch('/api/stats/daily', { cache: 'no-store' })
  const data = (await res.json().catch(() => ({}))) as DailyStatsResponse
  if (!res.ok || data.success === false) {
    throw new Error(data.error || `Request failed (${res.status})`)
  }
  return data
}

export default function AdminStatsPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [printing, setPrinting] = useState(false)
  const [date, setDate] = useState<string>('')
  const [items, setItems] = useState<StatsItem[]>([])
  const [totals, setTotals] = useState<{
    completed_quantity: number
    completed_amount: number
    cancelled_quantity: number
    cancelled_amount: number
  }>({ completed_quantity: 0, completed_amount: 0, cancelled_quantity: 0, cancelled_amount: 0 })

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await loadDailyStats()
      setDate(String(data.date || ''))
      setItems(Array.isArray(data.items) ? data.items : [])
      setTotals(data.totals || { completed_quantity: 0, completed_amount: 0, cancelled_quantity: 0, cancelled_amount: 0 })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  const printNow = useCallback(async () => {
    setPrinting(true)
    setError(null)
    try {
      const res = await fetch('/api/stats/print-daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAsPrinted: false }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || `Request failed (${res.status})`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setPrinting(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const titleDate = useMemo(() => {
    if (!date) return 'Сьогодні'
    return `Сьогодні (${date})`
  }, [date])

  return (
    <AdminProtection>
      <div className="min-h-screen bg-black text-orange-500 p-4">
        <div className="max-w-5xl mx-auto">
          <header className="mb-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-black bg-transparent"
                onClick={() => (window.location.href = '/admin')}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Назад
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-orange-500">Dienos statistika</h1>
                <p className="text-orange-300 mt-1">Продані товари за день</p>
              </div>
            </div>

            <Button
              variant="outline"
              className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-black bg-transparent"
              onClick={refresh}
              disabled={loading}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Оновити
            </Button>
          </header>

          <div className="mb-6">
            <Button
              className="bg-orange-600 hover:bg-orange-700 text-white"
              onClick={printNow}
              disabled={printing}
            >
              {printing ? 'Друк...' : 'Друкувати статистику зараз'}
            </Button>
          </div>

          {error ? (
            <div className="mb-4 border border-red-500 bg-red-500/10 text-red-200 rounded-md p-3 text-sm">
              {error}
            </div>
          ) : null}

          <Card className="bg-gray-900 border border-gray-700 mb-6">
            <CardHeader>
              <CardTitle className="text-orange-500">{titleDate}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="border border-gray-700 rounded-md p-3">
                  <div className="text-gray-400">Виконано (шт. / сума)</div>
                  <div className="text-2xl font-bold text-orange-200">{totals.completed_quantity}</div>
                  <div className="text-green-400 font-bold">€{totals.completed_amount.toFixed(2)}</div>
                </div>
                <div className="border border-gray-700 rounded-md p-3">
                  <div className="text-gray-400">Скасовано (шт. / сума)</div>
                  <div className="text-2xl font-bold text-orange-200">{totals.cancelled_quantity}</div>
                  <div className="text-green-400 font-bold">€{totals.cancelled_amount.toFixed(2)}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border border-gray-700">
            <CardHeader>
              <CardTitle className="text-orange-500">Товари</CardTitle>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <div className="text-gray-300 text-sm">Немає продажів за сьогодні</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-300 border-b border-gray-700">
                        <th className="py-2 pr-3">Товар</th>
                        <th className="py-2 pr-3">Виконано (шт.)</th>
                        <th className="py-2 pr-3">Виконано (€)</th>
                        <th className="py-2 pr-3">Скасовано (шт.)</th>
                        <th className="py-2">Скасовано (€)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it) => (
                        <tr key={it.item_id} className="border-b border-gray-800">
                          <td className="py-2 pr-3 text-orange-200">
                            {it.name_uk || it.name_lt || it.item_id}
                          </td>
                          <td className="py-2 pr-3 text-gray-200">{it.completed_quantity}</td>
                          <td className="py-2 pr-3 text-green-400">€{it.completed_amount.toFixed(2)}</td>
                          <td className="py-2 pr-3 text-gray-200">{it.cancelled_quantity}</td>
                          <td className="py-2 text-green-400">€{it.cancelled_amount.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminProtection>
  )
}
