'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import AdminProtection from '@/components/AdminProtection'
import { ArrowLeft, Plus, RefreshCw, Trash2, Save } from 'lucide-react'

type Employee = {
  id: number
  name: string
  discount_percent: number
  is_active: number
  created_at?: string
  updated_at?: string
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    cache: 'no-store',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  })
  const data = (await res.json().catch(() => ({}))) as any
  if (!res.ok || data?.success === false) {
    throw new Error(data?.error || `Request failed (${res.status})`)
  }
  return data as T
}

export default function AdminEmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [newName, setNewName] = useState('')
  const [newPin, setNewPin] = useState('')
  const [newDiscount, setNewDiscount] = useState('10')

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editPin, setEditPin] = useState('')
  const [editDiscount, setEditDiscount] = useState('0')
  const [editActive, setEditActive] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api<{ success: true; employees: Employee[] }>('/api/employees', { method: 'GET' })
      setEmployees(Array.isArray(data.employees) ? data.employees : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const startEdit = useCallback((emp: Employee) => {
    setEditingId(emp.id)
    setEditName(emp.name)
    setEditPin('')
    setEditDiscount(String(emp.discount_percent ?? 0))
    setEditActive(Boolean(emp.is_active))
  }, [])

  const cancelEdit = useCallback(() => {
    setEditingId(null)
    setEditName('')
    setEditPin('')
    setEditDiscount('0')
    setEditActive(true)
  }, [])

  const createEmployee = useCallback(async () => {
    setError(null)
    try {
      const discount = Number(newDiscount)
      if (!newName.trim()) throw new Error("Введіть ім'я")
      if (!newPin.trim() || newPin.replace(/\D/g, '').length < 4) throw new Error('PIN мінімум 4 цифри')
      if (!Number.isFinite(discount) || discount < 0 || discount > 100) throw new Error('Знижка 0..100')

      await api('/api/employees', {
        method: 'POST',
        body: JSON.stringify({
          action: 'create',
          name: newName.trim(),
          pin: newPin,
          discount_percent: discount,
        }),
      })

      setNewName('')
      setNewPin('')
      setNewDiscount('10')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [load, newDiscount, newName, newPin])

  const saveEdit = useCallback(async () => {
    if (editingId === null) return
    setError(null)
    try {
      const discount = Number(editDiscount)
      if (!editName.trim()) throw new Error("Введіть ім'я")
      if (!Number.isFinite(discount) || discount < 0 || discount > 100) throw new Error('Знижка 0..100')

      await api('/api/employees', {
        method: 'POST',
        body: JSON.stringify({
          action: 'update',
          id: editingId,
          name: editName.trim(),
          pin: editPin.trim() ? editPin : undefined,
          discount_percent: discount,
          is_active: editActive,
        }),
      })

      cancelEdit()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [cancelEdit, editActive, editDiscount, editName, editPin, editingId, load])

  const deleteEmployee = useCallback(async (emp: Employee) => {
    const ok = confirm(`Видалити співробітника "${emp.name}"?`)
    if (!ok) return

    setError(null)
    try {
      await api('/api/employees', {
        method: 'POST',
        body: JSON.stringify({ action: 'delete', id: emp.id }),
      })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [load])

  const sorted = useMemo(() => {
    return [...employees].sort((a, b) => {
      if (Number(b.is_active) !== Number(a.is_active)) return Number(b.is_active) - Number(a.is_active)
      return String(a.name).localeCompare(String(b.name))
    })
  }, [employees])

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
                <h1 className="text-3xl font-bold text-orange-500">Співробітники</h1>
                <p className="text-orange-300 mt-1">Управління співробітниками та знижками по PIN-коду</p>
              </div>
            </div>

            <Button
              variant="outline"
              className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-black bg-transparent"
              onClick={load}
              disabled={loading}
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
              <CardTitle className="text-orange-500">Додати співробітника</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label className="text-orange-300">Ім'я</Label>
                <Input className="bg-black border-gray-700 text-orange-200" value={newName} onChange={(e) => setNewName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-orange-300">PIN</Label>
                <Input
                  className="bg-black border-gray-700 text-orange-200"
                  inputMode="numeric"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-orange-300">Знижка (%)</Label>
                <Input
                  className="bg-black border-gray-700 text-orange-200"
                  inputMode="numeric"
                  value={newDiscount}
                  onChange={(e) => setNewDiscount(e.target.value.replace(/[^\d.]/g, ''))}
                />
              </div>
              <div className="flex items-end">
                <Button className="w-full bg-orange-500 text-black hover:bg-orange-600" onClick={createEmployee} disabled={loading}>
                  <Plus className="w-4 h-4 mr-2" />
                  Додати
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border border-gray-700">
            <CardHeader>
              <CardTitle className="text-orange-500">Співробітники ({employees.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {sorted.length === 0 ? (
                <div className="text-gray-300 text-sm">Поки що немає співробітників</div>
              ) : (
                sorted.map((emp) => {
                  const isEditing = editingId === emp.id

                  return (
                    <div key={emp.id} className="border border-gray-700 rounded-md p-3 flex flex-col gap-3">
                      {!isEditing ? (
                        <>
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="text-orange-200 font-medium truncate">{emp.name}</div>
                              <div className="text-gray-300 text-sm">
                                Знижка: <span className="text-green-400 font-bold">{Number(emp.discount_percent).toFixed(0)}%</span>
                                {' '}• Статус: <span className={emp.is_active ? 'text-green-400' : 'text-gray-500'}>{emp.is_active ? 'Активний' : 'Вимкнений'}</span>
                              </div>
                              <div className="text-gray-500 text-xs">ID: {emp.id}</div>
                            </div>

                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                className="border-orange-500 text-orange-200 hover:bg-orange-500 hover:text-black bg-transparent"
                                onClick={() => startEdit(emp)}
                              >
                                <Save className="w-4 h-4 mr-2" />
                                Редагувати
                              </Button>
                              <Button
                                variant="outline"
                                className="border-red-500 text-red-200 hover:bg-red-500 hover:text-black bg-transparent"
                                onClick={() => deleteEmployee(emp)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            <div className="space-y-2">
                              <Label className="text-orange-300">Ім'я</Label>
                              <Input className="bg-black border-gray-700 text-orange-200" value={editName} onChange={(e) => setEditName(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-orange-300">Новий PIN (опц.)</Label>
                              <Input
                                className="bg-black border-gray-700 text-orange-200"
                                inputMode="numeric"
                                value={editPin}
                                onChange={(e) => setEditPin(e.target.value.replace(/\D/g, ''))}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-orange-300">Знижка (%)</Label>
                              <Input
                                className="bg-black border-gray-700 text-orange-200"
                                inputMode="numeric"
                                value={editDiscount}
                                onChange={(e) => setEditDiscount(e.target.value.replace(/[^\d.]/g, ''))}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-orange-300">Активний</Label>
                              <select
                                className="w-full bg-black border border-gray-700 text-orange-200 rounded-md h-9 px-3"
                                value={editActive ? '1' : '0'}
                                onChange={(e) => setEditActive(e.target.value === '1')}
                              >
                                <option value="1">Так</option>
                                <option value="0">Ні</option>
                              </select>
                            </div>
                          </div>

                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              className="border-gray-600 text-gray-300 hover:bg-gray-800 bg-transparent"
                              onClick={cancelEdit}
                            >
                              Скасувати
                            </Button>
                            <Button className="bg-orange-500 text-black hover:bg-orange-600" onClick={saveEdit}>
                              Зберегти
                            </Button>
                          </div>
                        </>
                      )}
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
