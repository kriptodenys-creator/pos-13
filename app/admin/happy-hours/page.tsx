'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { ArrowLeft, Clock, RefreshCw, Trash2, Plus } from 'lucide-react'
import AdminProtection from '@/components/AdminProtection'

type HappyHourRule = {
  id: string
  item_id: string | null
  category_id: string | null
  discount_percent: number
  start_time: string | null
  end_time: string | null
  day_of_week: number | null
  active: number | boolean
}

type Category = {
  id: string
  name_lt: string
  name_uk: string
}

type MenuItem = {
  id: string
  name_lt: string
  name_uk: string
  category: string
}

const dayOptions: Array<{ value: string; label: string }> = [
  { value: 'any', label: 'Будь-який день' },
  { value: '0', label: 'Неділя' },
  { value: '1', label: 'Понеділок' },
  { value: '2', label: 'Вівторок' },
  { value: '3', label: 'Середа' },
  { value: '4', label: 'Четвер' },
  { value: '5', label: "П'ятниця" },
  { value: '6', label: 'Субота' },
]

async function postHappyHours(body: any) {
  const res = await fetch('/api/happy-hours', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data?.success === false) {
    throw new Error(data?.error || `Request failed (${res.status})`)
  }
  return data
}

async function safeJson<T>(p: Promise<Response>): Promise<T | null> {
  try {
    const res = await p
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

export default function AdminHappyHoursPage() {
  const [rules, setRules] = useState<HappyHourRule[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [discountPercent, setDiscountPercent] = useState('10')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [dayOfWeek, setDayOfWeek] = useState<string>('any')
  const [scope, setScope] = useState<'category' | 'item'>('category')
  const [categoryId, setCategoryId] = useState<string>('')
  const [itemId, setItemId] = useState<string>('')

  useEffect(() => {
    setCategoryId('')
    setItemId('')
  }, [scope])

  const loadAll = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [hhRes, catsRes, menuRes] = await Promise.all([
        postHappyHours({ action: 'getAll' }).catch(() => null),
        safeJson<any>(fetch('/api/categories', { cache: 'no-store' })),
        safeJson<any>(fetch('/api/menu?includeAll=1', { cache: 'no-store' })),
      ])

      if (hhRes && Array.isArray((hhRes as any).happyHours)) {
        setRules(((hhRes as any).happyHours || []) as HappyHourRule[])
      } else {
        setRules([])
      }

      const catsArray: any[] = Array.isArray(catsRes) ? catsRes : Array.isArray((catsRes as any)?.categories) ? (catsRes as any).categories : []
      const nextCategories =
        catsArray
          .filter((c) => c && c.id)
          .map((c) => ({
            id: String(c.id),
            name_lt: String(c.name_lt ?? ''),
            name_uk: String(c.name_uk ?? ''),
          }))
      setCategories(nextCategories)

      const menuArray: any[] = Array.isArray((menuRes as any)?.menu) ? (menuRes as any).menu : Array.isArray(menuRes) ? (menuRes as any) : []
      const nextMenuItems =
        menuArray
          .filter((m) => m && m.id)
          .map((m) => ({
            id: String(m.id),
            name_lt: String(m.name_lt ?? ''),
            name_uk: String(m.name_uk ?? ''),
            category: String(m.category ?? ''),
          }))
      setMenuItems(nextMenuItems)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  // Автовыбор, чтобы можно было сразу создать правило (без циклов перезагрузки)
  useEffect(() => {
    if (scope === 'category' && !categoryId && categories.length > 0) {
      setCategoryId(String(categories[0].id))
    }
    if (scope === 'item' && !itemId && menuItems.length > 0) {
      setItemId(String(menuItems[0].id))
    }
  }, [categories, categoryId, itemId, menuItems, scope])

  const categoriesById = useMemo(() => {
    const m = new Map<string, Category>()
    for (const c of categories) m.set(c.id, c)
    return m
  }, [categories])

  const menuItemById = useMemo(() => {
    const m = new Map<string, MenuItem>()
    for (const it of menuItems) m.set(it.id, it)
    return m
  }, [menuItems])

  const createRule = useCallback(async () => {
    setError(null)
    try {
      const percent = Number(discountPercent)
      if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
        throw new Error('Знижка має бути від 1 до 100')
      }

      const payload: any = {
        action: 'create',
        discount_percent: percent,
        start_time: startTime || null,
        end_time: endTime || null,
        day_of_week: dayOfWeek === 'any' ? null : Number(dayOfWeek),
        item_id: null,
        category_id: null,
      }

      if (scope === 'category') {
        if (!categoryId) throw new Error('Оберіть категорію')
        payload.category_id = categoryId
      } else {
        if (!itemId) throw new Error('Оберіть страву')
        payload.item_id = itemId
      }

      await postHappyHours(payload)
      await loadAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [categoryId, dayOfWeek, discountPercent, endTime, itemId, loadAll, scope, startTime])

  const toggleRule = useCallback(async (rule: HappyHourRule, active: boolean) => {
    setError(null)
    try {
      await postHappyHours({
        action: 'update',
        id: rule.id,
        discount_percent: rule.discount_percent,
        start_time: rule.start_time,
        end_time: rule.end_time,
        day_of_week: rule.day_of_week,
        active,
      })
      await loadAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [loadAll])

  const deleteRule = useCallback(async (id: string) => {
    setError(null)
    try {
      await postHappyHours({ action: 'delete', id })
      await loadAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [loadAll])

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
                <h1 className="text-3xl font-bold text-orange-500 flex items-center gap-3">
                  <Clock className="w-8 h-8" />
                  Щасливі години
                </h1>
                <p className="text-orange-300 mt-1">Знижки по часу та дням тижня</p>
              </div>
            </div>

            <Button
              variant="outline"
              className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-black bg-transparent"
              onClick={loadAll}
              disabled={isLoading}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Оновити
            </Button>
          </header>

          {error ? (
            <div className="mb-4 border border-red-500 bg-red-500/10 text-red-200 rounded-md p-3 text-sm">
              {error}
            </div>
          ) : null}

          <Card className="bg-gray-900 border border-gray-700 mb-6">
            <CardHeader>
              <CardTitle className="text-orange-500">Додати правило</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-orange-300">Сфера дії</Label>
                <Select value={scope} onValueChange={(v) => setScope(v as any)}>
                  <SelectTrigger className="bg-black border-gray-700 text-orange-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="category">Категорія</SelectItem>
                    <SelectItem value="item">Страва</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {scope === 'category' ? (
                <div className="space-y-2">
                  <Label className="text-orange-300">Категорія</Label>
                  <select
                    className="w-full bg-black border border-gray-700 text-orange-200 rounded-md h-9 px-3"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                  >
                    <option value="" disabled>
                      Оберіть категорію
                    </option>
                    {categories
                      .filter((c) => String(c.id).trim() !== '')
                      .map((c) => (
                        <option key={c.id} value={String(c.id)}>
                          {c.name_uk}
                        </option>
                      ))}
                  </select>
                  {categories.length === 0 ? (
                    <div className="text-xs text-gray-400">
                      Немає категорій. Додайте їх у <a className="underline" href="/admin/menu">/admin/menu</a>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-2">
                  <Label className="text-orange-300">Страва</Label>
                  <select
                    className="w-full bg-black border border-gray-700 text-orange-200 rounded-md h-9 px-3"
                    value={itemId}
                    onChange={(e) => setItemId(e.target.value)}
                  >
                    <option value="" disabled>
                      Оберіть страву
                    </option>
                    {menuItems
                      .filter((it) => String(it.id).trim() !== '')
                      .map((it) => (
                        <option key={it.id} value={String(it.id)}>
                          {it.name_uk}
                        </option>
                      ))}
                  </select>
                  {menuItems.length === 0 ? (
                    <div className="text-xs text-gray-400">
                      Немає страв. Додайте їх у <a className="underline" href="/admin/menu">/admin/menu</a>
                    </div>
                  ) : null}
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-orange-300">Знижка (%)</Label>
                <Input
                  className="bg-black border-gray-700 text-orange-200"
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(e.target.value)}
                  inputMode="numeric"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-orange-300">День тижня</Label>
                <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
                  <SelectTrigger className="bg-black border-gray-700 text-orange-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {dayOptions.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-orange-300">Час початку (HH:MM)</Label>
                <Input
                  className="bg-black border-gray-700 text-orange-200"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  placeholder="Напр. 11:00"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-orange-300">Час кінця (HH:MM)</Label>
                <Input
                  className="bg-black border-gray-700 text-orange-200"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  placeholder="Напр. 16:00"
                />
              </div>

              <div className="md:col-span-2">
                <Button
                  className="bg-orange-500 text-black hover:bg-orange-600"
                  onClick={createRule}
                  disabled={isLoading}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Додати
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border border-gray-700">
            <CardHeader>
              <CardTitle className="text-orange-500">Правила ({rules.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {rules.length === 0 ? (
                <div className="text-gray-300 text-sm">Правил поки немає</div>
              ) : (
                rules.map((r) => {
                  const active = Boolean((r as any).active)
                  const scopeLabel = r.item_id
                    ? `Страва: ${menuItemById.get(r.item_id)?.name_uk || r.item_id}`
                    : r.category_id
                      ? `Категорія: ${categoriesById.get(r.category_id)?.name_uk || r.category_id}`
                      : 'Глобально'

                  const dayLabel = r.day_of_week === null || r.day_of_week === undefined
                    ? 'Будь-який день'
                    : dayOptions.find((d) => d.value === String(r.day_of_week))?.label || String(r.day_of_week)

                  return (
                    <div key={r.id} className="border border-gray-700 rounded-md p-3 flex flex-col md:flex-row md:items-center gap-3 justify-between">
                      <div className="min-w-0">
                        <div className="text-orange-200 font-medium truncate">{scopeLabel}</div>
                        <div className="text-gray-300 text-sm">
                          {r.discount_percent}% • {dayLabel} • {r.start_time || '--:--'} - {r.end_time || '--:--'}
                        </div>
                        <div className="text-gray-500 text-xs">{r.id}</div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-300">Активне</span>
                          <Switch checked={active} onCheckedChange={(v: boolean) => toggleRule(r, v)} />
                        </div>

                        <Button
                          variant="outline"
                          className="border-red-500 text-red-200 hover:bg-red-500 hover:text-black bg-transparent"
                          onClick={() => deleteRule(r.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminProtection>
  )
}
