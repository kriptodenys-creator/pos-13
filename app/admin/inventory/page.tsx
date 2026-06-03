'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import AdminProtection from '@/components/AdminProtection'
import { ArrowLeft, Plus, Trash2, Edit2, Package, AlertCircle, TrendingUp, TrendingDown, DollarSign, Search, X, RefreshCw, AlertTriangle, Edit, Upload, Save } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { t } from '@/lib/translations'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { handleNumericInput } from '@/lib/inputUtils'

type InventoryItem = {
  id: string
  name_uk: string
  name_lt: string
  unit: string
  min_stock: number
  max_stock: number
  current_stock: number
  cost_per_unit: number
  supplier: string | null
  category_id: string | null
  image_url: string | null
  unit_weight: number | null
  used_in_recipes?: number
  created_at?: string
  updated_at?: string
}

type InventoryMovement = {
  id: string
  inventory_item_id: string
  movement_type: 'in' | 'out'
  quantity: number
  reason: string | null
  cost_per_unit: number | null
  total_cost: number | null
  created_at: string
}

type Stats = {
  totalItems: number
  lowStockCount: number
  totalValue: number
}

const UNITS = [
  { value: 'kg', label: 'кг' },
  { value: 'g', label: 'г' },
  { value: 'l', label: 'л' },
  { value: 'ml', label: 'мл' },
  { value: 'pcs', label: 'шт' },
  { value: 'pack', label: 'уп' },
]

const UNIT_CONVERSIONS: Record<string, Record<string, number>> = {
  kg: { kg: 1, g: 1000 },
  g: { kg: 0.001, g: 1 },
  l: { l: 1, ml: 1000 },
  ml: { l: 0.001, ml: 1 },
  pcs: { pcs: 1 },
  pack: { pack: 1 },
}

const INVENTORY_CATEGORIES = [
  { value: 'meat', label: "М'ясо" },
  { value: 'vegetables', label: 'Овочі' },
  { value: 'dairy', label: 'Молочні' },
  { value: 'cheese', label: 'Сири' },
  { value: 'frozen', label: 'Заморозка' },
  { value: 'sauces', label: 'Соуси' },
  { value: 'bread', label: 'Хліб' },
  { value: 'drinks', label: 'Напої' },
  { value: 'packaging', label: 'Упаковка' },
  { value: 'spices', label: 'Спеції' },
  { value: 'other', label: 'Інше' },
]

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

export default function AdminInventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [stats, setStats] = useState<Stats>({ totalItems: 0, lowStockCount: 0, totalValue: 0 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showLowStock, setShowLowStock] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  // Диалоги
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showStockDialog, setShowStockDialog] = useState(false)
  const [showMovementsDialog, setShowMovementsDialog] = useState(false)

  // Форма нового товара
  const [newItem, setNewItem] = useState({
    name_uk: '',
    name_lt: '',
    unit: 'kg',
    min_stock: '',
    max_stock: '10',
    current_stock: '',
    cost_per_unit: '',
    supplier: '',
    category_id: 'other',
    image_url: '',
    unit_weight: ''
  })

  // Редактирование
  const [editItem, setEditItem] = useState<InventoryItem | null>(null)

  // Операции со складом
  const [stockOperation, setStockOperation] = useState<{
    item: InventoryItem | null
    type: 'add' | 'remove' | 'correction'
    quantity: number
    reason: string
    cost_per_unit: number
    // Калькулятор упаковок
    usePackageCalc: boolean
    packages: number
    unitsPerPackage: number
    weightPerUnit: number
    inputUnit: string
  }>({
    item: null,
    type: 'add',
    quantity: 0,
    reason: '',
    cost_per_unit: 0,
    usePackageCalc: false,
    packages: 1,
    unitsPerPackage: 1,
    weightPerUnit: 1,
    inputUnit: 'kg'
  })

  // История движений
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [selectedItemForMovements, setSelectedItemForMovements] = useState<InventoryItem | null>(null)

  // Завантаження зображень
  const [uploading, setUploading] = useState(false)

  const uploadImage = async (file: File, target: 'new' | 'edit') => {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('image', file)
      
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })
      
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Помилка завантаження')
      
      if (target === 'new') {
        setNewItem({ ...newItem, image_url: data.imagePath })
      } else if (target === 'edit' && editItem) {
        setEditItem({ ...editItem, image_url: data.imagePath })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setUploading(false)
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const url = showLowStock ? '/api/inventory?lowStock=1' : '/api/inventory'
      const data = await api<{ items: InventoryItem[], stats: Stats }>(url)
      setItems(Array.isArray(data.items) ? data.items : [])
      setStats(data.stats || { totalItems: 0, lowStockCount: 0, totalValue: 0 })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [showLowStock])

  useEffect(() => {
    load()
  }, [load])

  const convertUnit = (value: number, fromUnit: string, toUnit: string): number => {
    if (fromUnit === toUnit) return value
    const conversion = UNIT_CONVERSIONS[fromUnit]?.[toUnit]
    if (!conversion) return value
    return value * conversion
  }

  const getCompatibleUnits = (baseUnit: string): typeof UNITS => {
    if (baseUnit === 'kg' || baseUnit === 'g') {
      return UNITS.filter(u => u.value === 'kg' || u.value === 'g')
    }
    if (baseUnit === 'l' || baseUnit === 'ml') {
      return UNITS.filter(u => u.value === 'l' || u.value === 'ml')
    }
    return UNITS.filter(u => u.value === baseUnit)
  }

  const createItem = async () => {
    setError(null)
    try {
      if (!newItem.name_uk.trim()) throw new Error('Введіть назву')
      
      const itemData = {
        ...newItem,
        min_stock: parseFloat(newItem.min_stock) || 0,
        max_stock: parseFloat(newItem.max_stock) || 10,
        current_stock: parseFloat(newItem.current_stock) || 0,
        cost_per_unit: parseFloat(newItem.cost_per_unit) || 0,
        unit_weight: parseFloat(newItem.unit_weight) || 0
      }
      
      await api('/api/inventory', {
        method: 'POST',
        body: JSON.stringify(itemData)
      })
      
      setShowAddDialog(false)
      setNewItem({
        name_uk: '',
        name_lt: '',
        unit: 'kg',
        min_stock: '',
        max_stock: '10',
        current_stock: '',
        cost_per_unit: '',
        supplier: '',
        category_id: 'other',
        image_url: '',
        unit_weight: ''
      })
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const updateItem = async () => {
    if (!editItem) return
    setError(null)
    try {
      await api('/api/inventory', {
        method: 'PUT',
        body: JSON.stringify(editItem)
      })
      setShowEditDialog(false)
      setEditItem(null)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const deleteItem = async (id: string) => {
    if (!confirm('Видалити цей товар зі складу?')) return
    setError(null)
    try {
      await api(`/api/inventory?id=${id}`, { method: 'DELETE' })
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const handleStockOperation = async () => {
    if (!stockOperation.item) return
    if (stockOperation.type !== 'correction' && stockOperation.quantity <= 0) return
    setError(null)
    try {
      // Конвертуємо кількість в базову одиницю товару
      const convertedQty = convertUnit(stockOperation.quantity, stockOperation.inputUnit, stockOperation.item.unit)
      
      if (stockOperation.type === 'correction') {
        // Корекція - встановлюємо точну кількість
        const diff = convertedQty - stockOperation.item.current_stock
        if (diff !== 0) {
          await api('/api/inventory/movement', {
            method: 'POST',
            body: JSON.stringify({
              movement_type: diff > 0 ? 'in' : 'out',
              item_id: stockOperation.item.id,
              quantity: Math.abs(diff),
              reason: stockOperation.reason || 'Корекція залишку',
              cost_per_unit: diff > 0 ? stockOperation.cost_per_unit : undefined
            })
          })
        }
      } else {
        // Звичайний прихід/списання
        await api('/api/inventory/movement', {
          method: 'POST',
          body: JSON.stringify({
            movement_type: stockOperation.type === 'add' ? 'in' : 'out',
            item_id: stockOperation.item.id,
            quantity: convertedQty,
            reason: stockOperation.reason,
            cost_per_unit: stockOperation.type === 'add' ? stockOperation.cost_per_unit : undefined
          })
        })
      }
      setShowStockDialog(false)
      setStockOperation({ item: null, type: 'add', quantity: 0, reason: '', cost_per_unit: 0, usePackageCalc: false, packages: 1, unitsPerPackage: 1, weightPerUnit: 1, inputUnit: 'kg' })
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const loadMovements = async (item: InventoryItem) => {
    try {
      const data = await api<{ item: InventoryItem, movements: InventoryMovement[] }>(
        `/api/inventory?id=${item.id}&includeMovements=1`
      )
      setMovements(data.movements || [])
      setSelectedItemForMovements(item)
      setShowMovementsDialog(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const openStockDialog = (item: InventoryItem, type: 'add' | 'remove' | 'correction') => {
    setStockOperation({
      item,
      type,
      quantity: type === 'correction' ? item.current_stock : 0,
      reason: '',
      cost_per_unit: item.cost_per_unit,
      usePackageCalc: false,
      packages: 1,
      unitsPerPackage: 1,
      weightPerUnit: 1,
      inputUnit: item.unit === 'g' ? 'kg' : item.unit === 'ml' ? 'l' : item.unit
    })
    setShowStockDialog(true)
  }

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name_uk.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.name_lt.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || item.category_id === selectedCategory
    return matchesSearch && matchesCategory
  })

  const getCategoryLabel = (categoryId: string | null) => {
    if (!categoryId) return 'Інше'
    return INVENTORY_CATEGORIES.find(c => c.value === categoryId)?.label || categoryId
  }

  const getUnitLabel = (unit: string) => UNITS.find(u => u.value === unit)?.label || unit

  const getStockStatus = (item: InventoryItem) => {
    if (item.current_stock <= item.min_stock) return 'critical'
    if (item.current_stock <= item.min_stock * 1.5) return 'warning'
    return 'ok'
  }

  return (
    <AdminProtection>
      <div className="min-h-screen bg-gray-100 p-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Button variant="outline" onClick={() => window.history.back()}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Назад
              </Button>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Package className="w-6 h-6" />
                Склад
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={load} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Оновити
              </Button>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Додати товар
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Всього позицій</p>
                    <p className="text-2xl font-bold">{stats.totalItems}</p>
                  </div>
                  <Package className="w-8 h-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
            <Card className={stats.lowStockCount > 0 ? 'border-red-300 bg-red-50' : ''}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Закінчується</p>
                    <p className="text-2xl font-bold text-red-600">{stats.lowStockCount}</p>
                  </div>
                  <AlertTriangle className="w-8 h-8 text-red-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Загальна вартість</p>
                    <p className="text-2xl font-bold">€{stats.totalValue.toFixed(2)}</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Пошук..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Всі категорії" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Всі категорії</SelectItem>
                {INVENTORY_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant={showLowStock ? 'default' : 'outline'}
              onClick={() => setShowLowStock(!showLowStock)}
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              Тільки критичні
            </Button>
          </div>

          {/* Category Tabs */}
          <div className="flex flex-wrap gap-2 mb-4">
            <Button
              size="sm"
              variant={selectedCategory === 'all' ? 'default' : 'outline'}
              onClick={() => setSelectedCategory('all')}
            >
              Всі ({items.length})
            </Button>
            {INVENTORY_CATEGORIES.map((cat) => {
              const count = items.filter(item => item.category_id === cat.value).length
              if (count === 0) return null
              return (
                <Button
                  key={cat.value}
                  size="sm"
                  variant={selectedCategory === cat.value ? 'default' : 'outline'}
                  onClick={() => setSelectedCategory(cat.value)}
                >
                  {cat.label} ({count})
                </Button>
              )
            })}
          </div>

          {/* Items Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left p-4 font-medium">Назва</th>
                      <th className="text-left p-4 font-medium">Категорія</th>
                      <th className="text-left p-4 font-medium">Одиниця</th>
                      <th className="text-right p-4 font-medium">Залишок</th>
                      <th className="text-right p-4 font-medium">Мін.</th>
                      <th className="text-right p-4 font-medium">Ціна/од.</th>
                      <th className="text-right p-4 font-medium">Вартість</th>
                      <th className="text-center p-4 font-medium">Статус</th>
                      <th className="text-center p-4 font-medium">Дії</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item) => {
                      const status = getStockStatus(item)
                      const totalValue = item.current_stock * (item.cost_per_unit || 0)
                      return (
                        <tr key={item.id} className="border-b hover:bg-gray-50">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              {item.image_url ? (
                                <img 
                                  src={item.image_url} 
                                  alt={item.name_uk}
                                  className="w-12 h-12 object-cover rounded border"
                                  onError={(e) => (e.currentTarget.style.display = 'none')}
                                />
                              ) : (
                                <div className="w-12 h-12 bg-gray-100 rounded border flex items-center justify-center">
                                  <Package className="w-6 h-6 text-gray-400" />
                                </div>
                              )}
                              <div>
                                <div className="font-medium">{item.name_uk}</div>
                                {item.name_lt && item.name_lt !== item.name_uk && (
                                  <div className="text-sm text-gray-500">{item.name_lt}</div>
                                )}
                                {item.supplier && (
                                  <div className="text-xs text-gray-400">Постачальник: {item.supplier}</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <Badge variant="outline">{getCategoryLabel(item.category_id)}</Badge>
                          </td>
                          <td className="p-4">{getUnitLabel(item.unit)}</td>
                          <td className="p-4 text-right font-mono">
                            {item.current_stock.toFixed(2)}
                          </td>
                          <td className="p-4 text-right text-gray-500 font-mono">
                            {item.min_stock.toFixed(2)}
                          </td>
                          <td className="p-4 text-right font-mono">
                            €{(item.cost_per_unit || 0).toFixed(2)}
                          </td>
                          <td className="p-4 text-right font-mono">
                            €{totalValue.toFixed(2)}
                          </td>
                          <td className="p-4 text-center">
                            {status === 'critical' && (
                              <Badge className="bg-red-600 text-white font-bold text-sm px-3 py-1 border border-red-700 shadow-sm">
                                Критично
                              </Badge>
                            )}
                            {status === 'warning' && (
                              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 font-bold text-sm border border-yellow-300">
                                Мало
                              </Badge>
                            )}
                            {status === 'ok' && (
                              <Badge variant="secondary" className="bg-green-100 text-green-800 font-bold text-sm border border-green-300">
                                OK
                              </Badge>
                            )}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-600"
                                onClick={() => openStockDialog(item, 'add')}
                                title="Приход"
                              >
                                <TrendingUp className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600"
                                onClick={() => openStockDialog(item, 'remove')}
                                title="Списання"
                              >
                                <TrendingDown className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-blue-600"
                                onClick={() => openStockDialog(item, 'correction')}
                                title="Корекція"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => loadMovements(item)}
                                title="Історія"
                              >
                                <Search className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditItem(item)
                                  setShowEditDialog(true)
                                }}
                                title="Редагувати"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600"
                                onClick={() => deleteItem(item.id)}
                                title="Видалити"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                    {filteredItems.length === 0 && (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-gray-500">
                          {loading ? 'Завантаження...' : 'Немає товарів'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Add Item Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Додати товар на склад</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Назва (укр) *</Label>
                <Input
                  value={newItem.name_uk}
                  onChange={(e) => setNewItem({ ...newItem, name_uk: e.target.value })}
                  placeholder="Курка"
                />
              </div>
              <div>
                <Label>Назва (лит)</Label>
                <Input
                  value={newItem.name_lt}
                  onChange={(e) => setNewItem({ ...newItem, name_lt: e.target.value })}
                  placeholder="Vištiena"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Одиниця виміру</Label>
                  <Select
                    value={newItem.unit}
                    onValueChange={(v) => setNewItem({ ...newItem, unit: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNITS.map((u) => (
                        <SelectItem key={u.value} value={u.value}>
                          {u.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Вага одиниці (кг)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={newItem.unit_weight}
                    onChange={(e) => setNewItem({ ...newItem, unit_weight: e.target.value })}
                    placeholder="Напр. 5.6 для банки"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Для шт/уп: скільки кг в одиниці
                  </p>
                </div>
                <div>
                  <Label>Ціна за одиницю (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={newItem.cost_per_unit}
                    onChange={(e) => setNewItem({ ...newItem, cost_per_unit: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Мін. залишок</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={newItem.min_stock}
                    onChange={(e) => setNewItem({ ...newItem, min_stock: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>Макс. залишок</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={newItem.max_stock}
                    onChange={(e) => setNewItem({ ...newItem, max_stock: e.target.value })}
                    placeholder="10"
                  />
                </div>
                <div>
                  <Label>Початковий залишок</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={newItem.current_stock}
                    onChange={(e) => setNewItem({ ...newItem, current_stock: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>
              <div>
                <Label>Категорія</Label>
                <Select
                  value={newItem.category_id}
                  onValueChange={(v) => setNewItem({ ...newItem, category_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INVENTORY_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Постачальник</Label>
                <Input
                  value={newItem.supplier}
                  onChange={(e) => setNewItem({ ...newItem, supplier: e.target.value })}
                  placeholder="Назва постачальника"
                />
              </div>
              <div>
                <Label>Зображення</Label>
                <div className="flex gap-2">
                  <Input
                    value={newItem.image_url}
                    onChange={(e) => setNewItem({ ...newItem, image_url: e.target.value })}
                    placeholder="URL або завантажте файл"
                    className="flex-1"
                  />
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) uploadImage(file, 'new')
                      }}
                    />
                    <Button type="button" variant="outline" disabled={uploading} asChild>
                      <span>
                        <Upload className="w-4 h-4" />
                      </span>
                    </Button>
                  </label>
                </div>
                {uploading && <p className="text-sm text-gray-500 mt-1">Завантаження...</p>}
                {newItem.image_url && (
                  <div className="mt-2 relative inline-block">
                    <img 
                      src={newItem.image_url} 
                      alt="Превью" 
                      className="w-20 h-20 object-cover rounded border"
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                    <button
                      type="button"
                      onClick={() => setNewItem({ ...newItem, image_url: '' })}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                  Скасувати
                </Button>
                <Button onClick={createItem} disabled={uploading}>
                  <Save className="w-4 h-4 mr-2" />
                  Зберегти
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Item Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Редагувати товар</DialogTitle>
            </DialogHeader>
            {editItem && (
              <div className="space-y-4">
                <div>
                  <Label>Назва (укр)</Label>
                  <Input
                    value={editItem.name_uk}
                    onChange={(e) => setEditItem({ ...editItem, name_uk: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Назва (лит)</Label>
                  <Input
                    value={editItem.name_lt}
                    onChange={(e) => setEditItem({ ...editItem, name_lt: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Одиниця виміру</Label>
                    <Select
                      value={editItem.unit}
                      onValueChange={(v) => setEditItem({ ...editItem, unit: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {UNITS.map((u) => (
                          <SelectItem key={u.value} value={u.value}>
                            {u.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Вага одиниці (кг)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={editItem.unit_weight || ''}
                      onChange={(e) => setEditItem({ ...editItem, unit_weight: e.target.value === '' ? null : parseFloat(e.target.value) })}
                      placeholder="Напр. 5.6 для банки"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Для шт/уп: скільки кг в одиниці
                    </p>
                  </div>
                  <div>
                    <Label>Ціна за одиницю (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={editItem.cost_per_unit || ''}
                      onChange={(e) => setEditItem({ ...editItem, cost_per_unit: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Мін. залишок</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={editItem.min_stock || ''}
                      onChange={(e) => setEditItem({ ...editItem, min_stock: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label>Макс. залишок</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={editItem.max_stock || ''}
                      onChange={(e) => setEditItem({ ...editItem, max_stock: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                      placeholder="10"
                    />
                  </div>
                </div>
                <div>
                  <Label>Категорія</Label>
                  <Select
                    value={editItem.category_id || 'other'}
                    onValueChange={(v) => setEditItem({ ...editItem, category_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INVENTORY_CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Постачальник</Label>
                  <Input
                    value={editItem.supplier || ''}
                    onChange={(e) => setEditItem({ ...editItem, supplier: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Зображення</Label>
                  <div className="flex gap-2">
                    <Input
                      value={editItem.image_url || ''}
                      onChange={(e) => setEditItem({ ...editItem, image_url: e.target.value })}
                      placeholder="URL або завантажте файл"
                      className="flex-1"
                    />
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) uploadImage(file, 'edit')
                        }}
                      />
                      <Button type="button" variant="outline" disabled={uploading} asChild>
                        <span>
                          <Upload className="w-4 h-4" />
                        </span>
                      </Button>
                    </label>
                  </div>
                  {uploading && <p className="text-sm text-gray-500 mt-1">Завантаження...</p>}
                  {editItem.image_url && (
                    <div className="mt-2 relative inline-block">
                      <img 
                        src={editItem.image_url} 
                        alt="Превью" 
                        className="w-20 h-20 object-cover rounded border"
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                      />
                      <button
                        type="button"
                        onClick={() => setEditItem({ ...editItem, image_url: null })}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                    Скасувати
                  </Button>
                  <Button onClick={updateItem} disabled={uploading}>
                    <Save className="w-4 h-4 mr-2" />
                    Зберегти
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Stock Operation Dialog */}
        <Dialog open={showStockDialog} onOpenChange={setShowStockDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {stockOperation.type === 'add' ? 'Приход товару' : stockOperation.type === 'remove' ? 'Списання товару' : 'Корекція залишку'}
              </DialogTitle>
            </DialogHeader>
            {stockOperation.item && (
              <div className="space-y-4">
                <div className="p-3 bg-gray-100 rounded">
                  <div className="font-medium">{stockOperation.item.name_uk}</div>
                  <div className="text-sm text-gray-500">
                    Поточний залишок: {stockOperation.item.current_stock.toFixed(2)} {getUnitLabel(stockOperation.item.unit)}
                  </div>
                </div>

                {/* Калькулятор упаковок - тільки для приходу */}
                {stockOperation.type === 'add' && (
                  <div className="border-2 rounded-lg p-4 bg-gradient-to-br from-blue-50 to-blue-100">
                    <div className="flex items-center gap-2 mb-3">
                      <input
                        type="checkbox"
                        id="usePackageCalc"
                        checked={stockOperation.usePackageCalc}
                        onChange={(e) => setStockOperation({ ...stockOperation, usePackageCalc: e.target.checked })}
                        className="w-5 h-5 cursor-pointer"
                      />
                      <Label htmlFor="usePackageCalc" className="cursor-pointer font-bold text-base">
                        📦 Калькулятор упаковок
                      </Label>
                    </div>
                    
                    {stockOperation.usePackageCalc && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-3">
                          <div className="bg-white p-3 rounded-lg shadow-sm">
                            <Label className="text-xs font-semibold text-gray-600 mb-1 block">Ящиків/коробок</Label>
                            <Input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={stockOperation.packages}
                              onChange={(e) => {
                                const val = e.target.value.replace(/[^0-9]/g, '')
                                const packages = parseInt(val) || 1
                                const total = packages * stockOperation.unitsPerPackage * stockOperation.weightPerUnit
                                setStockOperation({ ...stockOperation, packages, quantity: total })
                              }}
                              className="text-2xl font-bold text-center h-14 border-2 focus:border-blue-500"
                              placeholder="0"
                            />
                          </div>
                          <div className="bg-white p-3 rounded-lg shadow-sm">
                            <Label className="text-xs font-semibold text-gray-600 mb-1 block">Пакетів в ящику</Label>
                            <Input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={stockOperation.unitsPerPackage}
                              onChange={(e) => {
                                const val = e.target.value.replace(/[^0-9]/g, '')
                                const unitsPerPackage = parseInt(val) || 1
                                const total = stockOperation.packages * unitsPerPackage * stockOperation.weightPerUnit
                                setStockOperation({ ...stockOperation, unitsPerPackage, quantity: total })
                              }}
                              className="text-2xl font-bold text-center h-14 border-2 focus:border-blue-500"
                              placeholder="0"
                            />
                          </div>
                          <div className="bg-white p-3 rounded-lg shadow-sm">
                            <Label className="text-xs font-semibold text-gray-600 mb-1 block">{getUnitLabel(stockOperation.inputUnit)} в пакеті</Label>
                            <div className="flex gap-2">
                              <Input
                                type="text"
                                inputMode="decimal"
                                value={stockOperation.weightPerUnit.toString()}
                                onChange={(e) => {
                                  const val = handleNumericInput(e.target.value)
                                  const weightPerUnit = parseFloat(val) || 1
                                  const total = stockOperation.packages * stockOperation.unitsPerPackage * weightPerUnit
                                  setStockOperation({ ...stockOperation, weightPerUnit, quantity: total })
                                }}
                                className="text-2xl font-bold text-center h-14 border-2 focus:border-blue-500 flex-1"
                                placeholder="1"
                              />
                              <Select 
                                value={stockOperation.inputUnit} 
                                onValueChange={(val) => setStockOperation({ ...stockOperation, inputUnit: val })}
                              >
                                <SelectTrigger className="h-14 w-20 text-lg font-bold border-2">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {getCompatibleUnits(stockOperation.item.unit).map(unit => (
                                    <SelectItem key={unit.value} value={unit.value} className="text-lg">
                                      {unit.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                        <div className="text-base text-blue-900 bg-white p-4 rounded-lg border-2 border-blue-300 shadow-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold">Розрахунок:</span>
                            <span className="text-sm text-gray-600">{stockOperation.packages} ящ. × {stockOperation.unitsPerPackage} пак. × {stockOperation.weightPerUnit}</span>
                          </div>
                          <div className="text-2xl font-bold text-blue-600 mt-2 text-center">
                            = {stockOperation.quantity.toFixed(2)} {getUnitLabel(stockOperation.inputUnit)}
                            {stockOperation.inputUnit !== stockOperation.item.unit && (
                              <div className="text-sm text-gray-600 mt-1">
                                = {convertUnit(stockOperation.quantity, stockOperation.inputUnit, stockOperation.item.unit).toFixed(2)} {getUnitLabel(stockOperation.item.unit)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <Label>
                    {stockOperation.type === 'correction' 
                      ? `Нова кількість (${getUnitLabel(stockOperation.item.unit)})` 
                      : `Кількість (${getUnitLabel(stockOperation.item.unit)})`}
                  </Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    value={stockOperation.quantity}
                    onChange={(e) => setStockOperation({ ...stockOperation, quantity: parseFloat(e.target.value) || 0 })}
                    disabled={stockOperation.usePackageCalc && stockOperation.type !== 'correction'}
                    className={(stockOperation.usePackageCalc && stockOperation.type !== 'correction') ? 'bg-gray-100' : 'text-xl font-bold'}
                  />
                  {stockOperation.type === 'correction' && (
                    <p className="text-sm text-gray-600 mt-1">
                      Поточний залишок: <strong>{stockOperation.item.current_stock.toFixed(2)}</strong> {getUnitLabel(stockOperation.item.unit)}
                    </p>
                  )}
                </div>
                {stockOperation.type === 'add' && (
                  <div>
                    <Label>Ціна за одиницю (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={stockOperation.cost_per_unit}
                      onChange={(e) => setStockOperation({ ...stockOperation, cost_per_unit: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                )}
                <div>
                  <Label>Причина / Коментар</Label>
                  <Input
                    value={stockOperation.reason}
                    onChange={(e) => setStockOperation({ ...stockOperation, reason: e.target.value })}
                    placeholder={stockOperation.type === 'add' ? 'Поставка від...' : stockOperation.type === 'remove' ? 'Списання через...' : 'Причина корекції...'}
                  />
                </div>
                {stockOperation.type === 'add' && stockOperation.quantity > 0 && (
                  <div className="p-3 bg-green-50 rounded text-green-800">
                    Загальна вартість: €{(stockOperation.quantity * stockOperation.cost_per_unit).toFixed(2)}
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowStockDialog(false)}>
                    Скасувати
                  </Button>
                  <Button
                    onClick={handleStockOperation}
                    className={stockOperation.type === 'add' ? 'bg-green-600 hover:bg-green-700' : stockOperation.type === 'remove' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}
                  >
                    {stockOperation.type === 'add' ? (
                      <>
                        <Plus className="w-4 h-4 mr-2" />
                        Додати
                      </>
                    ) : stockOperation.type === 'remove' ? (
                      <>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Списати
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Зберегти
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Movements History Dialog */}
        <Dialog open={showMovementsDialog} onOpenChange={setShowMovementsDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Історія руху: {selectedItemForMovements?.name_uk}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              {movements.length === 0 ? (
                <p className="text-center text-gray-500 py-4">Немає записів</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-2">Дата</th>
                      <th className="text-left p-2">Тип</th>
                      <th className="text-right p-2">Кількість</th>
                      <th className="text-right p-2">Ціна</th>
                      <th className="text-left p-2">Причина</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((mov) => (
                      <tr key={mov.id} className="border-b">
                        <td className="p-2">
                          {new Date(mov.created_at).toLocaleString('uk-UA')}
                        </td>
                        <td className="p-2">
                          {mov.movement_type === 'in' ? (
                            <Badge className="bg-green-100 text-green-800">Приход</Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-800">Списання</Badge>
                          )}
                        </td>
                        <td className="p-2 text-right font-mono">
                          {mov.movement_type === 'in' ? '+' : '-'}{mov.quantity.toFixed(2)}
                        </td>
                        <td className="p-2 text-right font-mono">
                          {mov.cost_per_unit ? `€${mov.cost_per_unit.toFixed(2)}` : '-'}
                        </td>
                        <td className="p-2 text-gray-600">
                          {mov.reason || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminProtection>
  )
}
