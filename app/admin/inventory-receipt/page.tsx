'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import AdminProtection from '@/components/AdminProtection'
import { ArrowLeft, Plus, Trash2, Save, Package, CheckCircle2 } from 'lucide-react'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import Image from 'next/image'
import { handleNumericInput } from '@/lib/inputUtils'

type InventoryItem = {
  id: string
  name_uk: string
  name_lt: string
  unit: string
  current_stock: number
  cost_per_unit: number
  category_id: string | null
  image_url?: string
  pieces_per_package?: number
  kg_per_piece?: number
}

type ReceiptPosition = {
  id: string
  item: InventoryItem | null
  inputUnit: 'package' | 'piece' | 'kg'
  inputQuantity: string
  piecesPerPackage: string
  kgPerPiece: string
}

const UNIT_LABELS = {
  package: 'Упаковки',
  piece: 'Штуки',
  kg: 'Кілограми',
  g: 'Грами'
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

export default function InventoryReceiptPage() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [positions, setPositions] = useState<ReceiptPosition[]>([
    { id: '1', item: null, inputUnit: 'package', inputQuantity: '', piecesPerPackage: '', kgPerPiece: '' }
  ])
  const [submitting, setSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api<{ items: InventoryItem[] }>('/api/inventory')
      setItems(Array.isArray(data.items) ? data.items : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const addPosition = () => {
    setPositions([...positions, {
      id: Date.now().toString(),
      item: null,
      inputUnit: 'package',
      inputQuantity: '',
      piecesPerPackage: '',
      kgPerPiece: ''
    }])
  }

  const removePosition = (id: string) => {
    if (positions.length > 1) {
      setPositions(positions.filter(p => p.id !== id))
    }
  }

  const updatePosition = (id: string, updates: Partial<ReceiptPosition>) => {
    setPositions(positions.map(p => p.id === id ? { ...p, ...updates } : p))
  }

  const selectItem = (positionId: string, itemId: string) => {
    const item = items.find(i => i.id === itemId)
    if (!item) return

    updatePosition(positionId, {
      item,
      piecesPerPackage: item.pieces_per_package?.toString() || '',
      kgPerPiece: item.kg_per_piece?.toString() || ''
    })
  }

  const calculateConversions = (position: ReceiptPosition) => {
    if (!position.item || !position.inputQuantity) {
      return { packages: 0, pieces: 0, kg: 0, valid: false }
    }

    const inputQty = parseFloat(position.inputQuantity)
    const piecesPerPkg = parseFloat(position.piecesPerPackage) || 0
    const kgPerPc = parseFloat(position.kgPerPiece) || 0

    if (isNaN(inputQty) || inputQty <= 0) {
      return { packages: 0, pieces: 0, kg: 0, valid: false }
    }

    let packages = 0
    let pieces = 0
    let kg = 0

    if (position.inputUnit === 'package') {
      packages = inputQty
      pieces = piecesPerPkg > 0 ? inputQty * piecesPerPkg : 0
      kg = pieces > 0 && kgPerPc > 0 ? pieces * kgPerPc : 0
    } else if (position.inputUnit === 'piece') {
      pieces = inputQty
      packages = piecesPerPkg > 0 ? inputQty / piecesPerPkg : 0
      kg = kgPerPc > 0 ? inputQty * kgPerPc : 0
    } else if (position.inputUnit === 'kg') {
      kg = inputQty
      pieces = kgPerPc > 0 ? inputQty / kgPerPc : 0
      packages = pieces > 0 && piecesPerPkg > 0 ? pieces / piecesPerPkg : 0
    }

    return {
      packages: Math.round(packages * 1000) / 1000,
      pieces: Math.round(pieces * 1000) / 1000,
      kg: Math.round(kg * 1000) / 1000,
      valid: true
    }
  }

  const getTotals = () => {
    return positions.reduce((acc, pos) => {
      const conv = calculateConversions(pos)
      return {
        packages: acc.packages + conv.packages,
        pieces: acc.pieces + conv.pieces,
        kg: acc.kg + conv.kg
      }
    }, { packages: 0, pieces: 0, kg: 0 })
  }

  const handleSubmit = async () => {
    const validPositions = positions.filter(p => {
      const conv = calculateConversions(p)
      return p.item && conv.valid
    })

    if (validPositions.length === 0) {
      setError('Додайте хоча б одну позицію з коректними даними')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      for (const pos of validPositions) {
        const conv = calculateConversions(pos)
        const baseQuantity = pos.item!.unit === 'g' ? conv.kg * 1000 : conv.pieces

        await api('/api/inventory/movement', {
          method: 'POST',
          body: JSON.stringify({
            movement_type: 'in',
            item_id: pos.item!.id,
            quantity: baseQuantity,
            reason: `Приход: ${conv.packages > 0 ? `${conv.packages} упак.` : ''} ${conv.pieces > 0 ? `${conv.pieces} шт.` : ''} ${conv.kg > 0 ? `${conv.kg} кг` : ''}`.trim(),
            cost_per_unit: pos.item!.cost_per_unit
          })
        })

        if (pos.piecesPerPackage && parseFloat(pos.piecesPerPackage) > 0) {
          await api('/api/inventory', {
            method: 'PUT',
            body: JSON.stringify({
              id: pos.item!.id,
              pieces_per_package: parseFloat(pos.piecesPerPackage)
            })
          })
        }

        if (pos.kgPerPiece && parseFloat(pos.kgPerPiece) > 0) {
          await api('/api/inventory', {
            method: 'PUT',
            body: JSON.stringify({
              id: pos.item!.id,
              kg_per_piece: parseFloat(pos.kgPerPiece)
            })
          })
        }
      }

      setShowSuccess(true)
      setTimeout(() => {
        setShowSuccess(false)
        setPositions([{ id: '1', item: null, inputUnit: 'package', inputQuantity: '', piecesPerPackage: '', kgPerPiece: '' }])
        load()
      }, 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  const totals = getTotals()

  return (
    <AdminProtection>
      <div className="min-h-screen bg-gray-50 pb-20">
        <div className="bg-white border-b sticky top-0 z-10 shadow-sm">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
                  <ArrowLeft className="w-6 h-6" />
                </Button>
                <h1 className="text-2xl font-bold">📦 Приход товару</h1>
              </div>
              <LanguageSwitcher />
            </div>
          </div>
        </div>

        <div className="p-4 max-w-6xl mx-auto space-y-4">
          {showSuccess && (
            <Card className="border-green-500 bg-green-50">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 text-green-700">
                  <CheckCircle2 className="w-8 h-8" />
                  <div>
                    <div className="text-xl font-bold">Приход успішно збережено!</div>
                    <div className="text-sm">Залишки оновлено</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {error && (
            <Card className="border-red-500 bg-red-50">
              <CardContent className="p-4">
                <div className="text-red-700 font-bold">{error}</div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Позиції приходу</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {positions.map((position, index) => {
                const conversions = calculateConversions(position)
                
                return (
                  <Card key={position.id} className="border-2">
                    <CardContent className="p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="font-bold text-lg">Позиція #{index + 1}</div>
                        {positions.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removePosition(position.id)}
                          >
                            <Trash2 className="w-5 h-5 text-red-500" />
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                          <Label>Товар</Label>
                          <Select
                            value={position.item?.id || ''}
                            onValueChange={(val) => selectItem(position.id, val)}
                          >
                            <SelectTrigger className="h-14 text-base">
                              <SelectValue placeholder="Виберіть товар...">
                                {position.item && (
                                  <div className="flex items-center gap-3">
                                    {position.item.image_url ? (
                                      <div className="relative w-10 h-10 rounded overflow-hidden flex-shrink-0">
                                        <Image
                                          src={position.item.image_url}
                                          alt={position.item.name_uk}
                                          fill
                                          className="object-cover"
                                          sizes="40px"
                                        />
                                      </div>
                                    ) : (
                                      <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center flex-shrink-0">
                                        <Package className="w-5 h-5 text-gray-400" />
                                      </div>
                                    )}
                                    <span className="font-medium">{position.item.name_uk}</span>
                                  </div>
                                )}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {items.map(item => (
                                <SelectItem key={item.id} value={item.id} className="h-16">
                                  <div className="flex items-center gap-3">
                                    {item.image_url ? (
                                      <div className="relative w-12 h-12 rounded overflow-hidden flex-shrink-0">
                                        <Image
                                          src={item.image_url}
                                          alt={item.name_uk}
                                          fill
                                          className="object-cover"
                                          sizes="48px"
                                        />
                                      </div>
                                    ) : (
                                      <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center flex-shrink-0">
                                        <Package className="w-6 h-6 text-gray-400" />
                                      </div>
                                    )}
                                    <div className="flex-1">
                                      <div className="font-medium">{item.name_uk}</div>
                                      <div className="text-sm text-gray-500">
                                        Залишок: {item.current_stock.toFixed(2)} {item.unit}
                                      </div>
                                    </div>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>Фактичний приход</Label>
                          <div className="flex gap-2">
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={position.inputQuantity}
                              onChange={(e) => {
                                const val = handleNumericInput(e.target.value)
                                updatePosition(position.id, { inputQuantity: val })
                              }}
                              placeholder="0"
                              className="h-12 text-lg font-bold"
                            />
                            <Select
                              value={position.inputUnit}
                              onValueChange={(val: any) => updatePosition(position.id, { inputUnit: val })}
                            >
                              <SelectTrigger className="h-12 w-40">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="package">Упаковки</SelectItem>
                                <SelectItem value="piece">Штуки</SelectItem>
                                <SelectItem value="kg">Кілограми</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div>
                          <Label>Штук в упаковці</Label>
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={position.piecesPerPackage}
                            onChange={(e) => {
                              const val = handleNumericInput(e.target.value)
                              updatePosition(position.id, { piecesPerPackage: val })
                            }}
                            placeholder="0"
                            className="h-12"
                          />
                        </div>

                        <div>
                          <Label>Кг в одній штуці</Label>
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={position.kgPerPiece}
                            onChange={(e) => {
                              const val = handleNumericInput(e.target.value)
                              updatePosition(position.id, { kgPerPiece: val })
                            }}
                            placeholder="0.000"
                            className="h-12"
                          />
                        </div>
                      </div>

                      {position.item && conversions.valid && (
                        <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-300">
                          <div className="font-bold mb-2">Автоматичний перерахунок:</div>
                          <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                              <div className="text-sm text-gray-600">Упаковки</div>
                              <div className="text-2xl font-bold text-blue-700">
                                {conversions.packages.toFixed(3)}
                              </div>
                            </div>
                            <div>
                              <div className="text-sm text-gray-600">Штуки</div>
                              <div className="text-2xl font-bold text-blue-700">
                                {conversions.pieces.toFixed(3)}
                              </div>
                            </div>
                            <div>
                              <div className="text-sm text-gray-600">Кілограми</div>
                              <div className="text-2xl font-bold text-blue-700">
                                {conversions.kg.toFixed(3)}
                              </div>
                            </div>
                          </div>
                          <div className="mt-3 text-sm text-gray-600 text-center">
                            На склад буде додано: <span className="font-bold">
                              {position.item.unit === 'g' ? `${(conversions.kg * 1000).toFixed(0)} г` : `${conversions.pieces.toFixed(3)} шт`}
                            </span>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}

              <Button
                onClick={addPosition}
                variant="outline"
                className="w-full h-12 border-2 border-dashed"
              >
                <Plus className="w-5 h-5 mr-2" />
                Додати позицію
              </Button>
            </CardContent>
          </Card>

          <Card className="border-2 border-green-500">
            <CardHeader className="bg-green-50">
              <CardTitle>Підсумок приходу</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-3 gap-6 text-center">
                <div>
                  <div className="text-sm text-gray-600 mb-2">Всього упаковок</div>
                  <div className="text-4xl font-bold text-green-700">
                    {totals.packages.toFixed(3)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-2">Всього штук</div>
                  <div className="text-4xl font-bold text-green-700">
                    {totals.pieces.toFixed(3)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-2">Всього кілограмів</div>
                  <div className="text-4xl font-bold text-green-700">
                    {totals.kg.toFixed(3)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => window.history.back()}
              disabled={submitting}
              className="flex-1 h-14 text-lg"
            >
              Скасувати
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || positions.every(p => !p.item)}
              className="flex-1 h-14 text-lg bg-green-600 hover:bg-green-700"
            >
              <Save className="w-6 h-6 mr-2" />
              {submitting ? 'Збереження...' : 'Зберегти приход'}
            </Button>
          </div>
        </div>
      </div>
    </AdminProtection>
  )
}
