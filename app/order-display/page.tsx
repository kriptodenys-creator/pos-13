"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useVersionedSync } from "@/hooks/useVersionedSync"

interface DisplayOrder {
  id: string
  dailyNumber?: string
  status: string
  orderType?: string
  timestamp: string
}

export default function OrderDisplay() {
  const [orders, setOrders] = useState<DisplayOrder[]>([])
  const [currentTime, setCurrentTime] = useState(new Date())
  const [language, setLanguage] = useState<"uk" | "lt">("lt")
  const prevReadyIdsRef = useRef<Set<string>>(new Set())
  const audioCtxRef = useRef<AudioContext | null>(null)

  // Звук при появлении нового готового заказа
  const playReadySound = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }
      const ctx = audioCtxRef.current
      if (ctx.state === 'suspended') ctx.resume()

      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.setValueAtTime(880, ctx.currentTime)
      osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.15)
      osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.3)
      gain.gain.setValueAtTime(0.5, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.6)
    } catch (e) {
      // ignore
    }
  }, [])

  // Загрузка заказов
  const fetchOrders = useCallback(async () => {
    try {
      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)

      const res = await fetch(
        `/api/orders?from=${todayStart.toISOString()}&to=${tomorrowStart.toISOString()}`,
        { cache: 'no-store', headers: { 'Cache-Control': 'no-store' } }
      )
      if (!res.ok) return

      const data = await res.json()
      const all: DisplayOrder[] = (data.orders || []).map((o: any) => ({
        id: String(o.id),
        dailyNumber: o.daily_number != null ? String(o.daily_number) : undefined,
        status: (o.status || '').toLowerCase(),
        orderType: o.order_type || o.orderType || '',
        timestamp: o.created_at || o.timestamp || '',
      }))

      // Только активные: new, preparing, ready
      const active = all.filter(o =>
        ['new', 'preparing', 'ready'].includes(o.status)
      )

      // Проверяем новые ready заказы для звука
      const readyIds = new Set(active.filter(o => o.status === 'ready').map(o => o.id))
      const prevReady = prevReadyIdsRef.current
      for (const id of readyIds) {
        if (!prevReady.has(id)) {
          playReadySound()
          break
        }
      }
      prevReadyIdsRef.current = readyIds

      setOrders(active)
    } catch (e) {
      console.error('[OrderDisplay] fetch error:', e)
    }
  }, [playReadySound])

  useVersionedSync({
    onVersionChange: fetchOrders,
    pollingIntervalMs: 3000,
  })

  // Часы
  useEffect(() => {
    const clockId = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(clockId)
  }, [])

  // Язык из localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('orderDisplayLanguage')
      if (saved === 'uk' || saved === 'lt') setLanguage(saved)
    }
  }, [])

  const toggleLanguage = () => {
    const next = language === 'lt' ? 'uk' : 'lt'
    setLanguage(next)
    localStorage.setItem('orderDisplayLanguage', next)
  }

  // Полноэкранный режим
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }

  const preparing = orders.filter(o => o.status === 'new' || o.status === 'preparing')
  const ready = orders.filter(o => o.status === 'ready')

  const t = language === 'uk'
    ? { preparing: 'Готується', ready: 'Готово', noOrders: 'Немає активних замовлень' }
    : { preparing: 'Ruošiama', ready: 'Paruošta', noOrders: 'Nėra aktyvių užsakymų' }

  const timeStr = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <div
      className="min-h-screen bg-black text-white flex flex-col select-none cursor-default"
      onClick={() => {
        if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume()
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-3 bg-zinc-900 border-b border-zinc-800">
        <div className="text-3xl font-bold text-orange-500">Meidos</div>
        <div className="text-2xl font-mono text-zinc-400">{timeStr}</div>
        <div className="flex gap-2">
          <button
            onClick={toggleLanguage}
            className="text-zinc-400 hover:text-white text-sm px-3 py-1 rounded border border-zinc-700 transition-colors"
          >
            {language === 'lt' ? '🇱🇹 LT' : '🇺🇦 UK'}
          </button>
          <button
            onClick={toggleFullscreen}
            className="text-zinc-400 hover:text-white text-sm px-3 py-1 rounded border border-zinc-700 transition-colors"
          >
            ⛶
          </button>
        </div>
      </div>

      {/* Main — два столбца */}
      {preparing.length === 0 && ready.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-zinc-600 text-3xl">{t.noOrders}</p>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Готовится — левая колонка */}
          <div className="flex-1 flex flex-col border-r border-zinc-800">
            <div className="bg-orange-600 text-center py-4 shrink-0">
              <span className="text-3xl font-extrabold tracking-wide uppercase">{t.preparing}</span>
              {preparing.length > 0 && (
                <span className="ml-3 bg-black/30 text-white text-2xl font-bold px-3 py-1 rounded-full">{preparing.length}</span>
              )}
            </div>
            <div className="flex-1 overflow-auto p-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
                {preparing.map(order => (
                  <div
                    key={order.id}
                    className="bg-zinc-900 border-2 border-orange-500/40 rounded-2xl flex items-center justify-center aspect-square transition-all hover:border-orange-400"
                  >
                    <span className="text-6xl lg:text-7xl font-black text-orange-400 leading-none">{order.dailyNumber ?? order.id}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Готово — правая колонка */}
          <div className="flex-1 flex flex-col">
            <div className="bg-green-600 text-center py-4 shrink-0">
              <span className="text-3xl font-extrabold tracking-wide uppercase">{t.ready}</span>
              {ready.length > 0 && (
                <span className="ml-3 bg-black/30 text-white text-2xl font-bold px-3 py-1 rounded-full">{ready.length}</span>
              )}
            </div>
            <div className="flex-1 overflow-auto p-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
                {ready.map(order => (
                  <div
                    key={order.id}
                    className="bg-green-900/40 border-2 border-green-400 rounded-2xl flex items-center justify-center aspect-square animate-pulse transition-all"
                  >
                    <span className="text-6xl lg:text-7xl font-black text-green-300 leading-none">{order.dailyNumber ?? order.id}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
