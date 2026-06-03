"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trash2, Plus, Edit, Package, ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import AdminProtection from "@/components/AdminProtection"

interface MenuItem {
  id: string
  name_uk: string
  name_lt: string
  price: number
  category_id?: string
  is_available: boolean
  is_fryer?: number
  cooking_time?: number
}

interface ModifierOption {
  id: string
  name_uk: string
  name_lt: string
  price: number
}

interface Modifier {
  id: string
  name_uk: string
  name_lt: string
  type?: string
  required?: number
  options?: ModifierOption[]
}

interface ComboSlot {
  id: string
  title: { lt: string; uk: string }
  type: 'menu_item_choice' | 'modifier'
  required: boolean
  minSelection: number
  maxSelection: number
  items?: Array<{
    id: string
    menuItemId: string
    name: { lt: string; uk: string }
    price: number
    priceDelta: number
  }>
  modifiers?: Array<{
    id: string
    modifierId: string
    name: { lt: string; uk: string }
    type: string
    required: boolean
    minSelection: number
    maxSelection: number
    options: Array<{
      id: string
      name: { lt: string; uk: string }
      price: number
      isDefault: boolean
    }>
  }>
}

interface Combo {
  id: string
  menuItemId: string
  name: { lt: string; uk: string }
  price: number
  category?: string
  categoryName?: { lt: string; uk: string }
  categoryColor?: string
  image?: string
  available: boolean
  slots: ComboSlot[]
  created_at?: string
  updated_at?: string
}

export default function CombosPage() {
  const [combos, setCombos] = useState<Combo[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [modifiers, setModifiers] = useState<Modifier[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingCombo, setEditingCombo] = useState<Combo | null>(null)
  const [selectedMenuItem, setSelectedMenuItem] = useState("")
  const [priceOverride, setPriceOverride] = useState<string>("")
  const [slots, setSlots] = useState<Array<{
    title: { lt: string; uk: string }
    type: 'menu_item_choice' | 'modifier'
    required: boolean
    minSelection: number
    maxSelection: number
    items: Array<{ menuItemId: string; priceDelta: number; is_fryer?: boolean; cooking_time?: number; modifiers?: Array<{ modifierId: string; required: boolean; minSelection: number; maxSelection: number }> }>
    modifiers: Array<{ modifierId: string; required: boolean; minSelection: number; maxSelection: number }>
  }>>([])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      // Загружаем комбо
      const combosResponse = await fetch('/api/combos')
      if (combosResponse.ok) {
        const combosData = await combosResponse.json()
        setCombos(combosData.combos || [])
      }

      // Загружаем все блюда для выбора
      const menuResponse = await fetch('/api/menu')
      if (menuResponse.ok) {
        const menuData = await menuResponse.json()
        setMenuItems(menuData.menu || [])
      }

      // Загружаем модификаторы
      const modsResponse = await fetch('/api/modifiers')
      if (modsResponse.ok) {
        const modsData = await modsResponse.json()
        setModifiers(modsData.modifiers || [])
      }
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Помилка завантаження даних')
    } finally {
      setLoading(false)
    }
  }

  const addSlot = () => {
    setSlots([...slots, {
      title: { lt: '', uk: '' },
      type: 'menu_item_choice',
      required: true,
      minSelection: 1,
      maxSelection: 1,
      items: [],
      modifiers: []
    }])
  }

  const updateSlot = (index: number, field: string, value: any) => {
    const newSlots = [...slots]
    newSlots[index] = { ...newSlots[index], [field]: value }
    setSlots(newSlots)
  }

  const removeSlot = (index: number) => {
    setSlots(slots.filter((_, i) => i !== index))
  }

  const addSlotItem = (slotIndex: number) => {
    const newSlots = [...slots]
    newSlots[slotIndex].items.push({ menuItemId: '', priceDelta: 0, is_fryer: false, cooking_time: 180, modifiers: [] })
    setSlots(newSlots)
  }

  const updateSlotItem = (slotIndex: number, itemIndex: number, field: string, value: any) => {
    const newSlots = [...slots]
    newSlots[slotIndex].items[itemIndex] = { ...newSlots[slotIndex].items[itemIndex], [field]: value }
    setSlots(newSlots)
  }

  const toggleSlotItemModifier = (slotIndex: number, itemIndex: number, modifierId: string) => {
    const newSlots = [...slots]
    const current = newSlots[slotIndex].items[itemIndex]
    const currentMods = current.modifiers || []

    const exists = currentMods.some(m => m.modifierId === modifierId)
    const nextMods = exists
      ? currentMods.filter(m => m.modifierId !== modifierId)
      : [...currentMods, { modifierId, required: false, minSelection: 0, maxSelection: 1 }]

    newSlots[slotIndex].items[itemIndex] = { ...current, modifiers: nextMods }
    setSlots(newSlots)
  }

  const updateSlotItemModifierRule = (
    slotIndex: number,
    itemIndex: number,
    modifierId: string,
    field: 'required' | 'minSelection' | 'maxSelection',
    value: any
  ) => {
    const newSlots = [...slots]
    const current = newSlots[slotIndex].items[itemIndex]
    const currentMods = current.modifiers || []
    newSlots[slotIndex].items[itemIndex] = {
      ...current,
      modifiers: currentMods.map(m =>
        m.modifierId === modifierId ? { ...m, [field]: value } : m
      )
    }
    setSlots(newSlots)
  }

  const removeSlotItem = (slotIndex: number, itemIndex: number) => {
    const newSlots = [...slots]
    newSlots[slotIndex].items = newSlots[slotIndex].items.filter((_, i) => i !== itemIndex)
    setSlots(newSlots)
  }

  const createCombo = async () => {
    if (!selectedMenuItem) {
      toast.error('Оберіть блюдо для комбо')
      return
    }

    if (slots.length === 0) {
      toast.error('Додайте хоча б один слот')
      return
    }

    try {
      const payload = {
        menuItemId: selectedMenuItem,
        priceOverride: priceOverride.trim() === '' ? null : Number(priceOverride),
        slots: slots.map(slot => ({
          title: slot.title,
          type: slot.type,
          required: slot.required,
          minSelection: slot.minSelection,
          maxSelection: slot.maxSelection,
          items: slot.type === 'menu_item_choice' ? slot.items : undefined,
          modifiers: slot.type === 'modifier' ? slot.modifiers : undefined
        }))
      }

      const response = await fetch('/api/combos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        toast.success('Комбо створено успішно')
        setIsCreateDialogOpen(false)
        resetForm()
        loadData()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Помилка створення комбо')
      }
    } catch (error) {
      console.error('Error creating combo:', error)
      toast.error('Помилка створення комбо')
    }
  }

  const resetForm = () => {
    setSelectedMenuItem("")
    setPriceOverride("")
    setSlots([])
    setEditingCombo(null)
  }

  const deleteCombo = async (comboId: string) => {
    if (!confirm('Ви впевнені, що хочете видалити це комбо?')) return

    try {
      const response = await fetch(`/api/combos/${comboId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success('Комбо видалено')
        loadData()
      } else {
        toast.error('Помилка видалення комбо')
      }
    } catch (error) {
      console.error('Error deleting combo:', error)
      toast.error('Помилка видалення комбо')
    }
  }

  const startEditCombo = async (comboId: string) => {
    try {
      const res = await fetch(`/api/combos/${comboId}`)
      const data = await res.json()
      if (!res.ok || !data?.success || !data?.combo) {
        toast.error(data?.error || 'Не вдалося завантажити комбо')
        return
      }

      const combo = data.combo
      setEditingCombo(combo)
      setSelectedMenuItem(combo.menuItemId || '')
      setPriceOverride(combo.priceOverride == null ? '' : String(combo.priceOverride))

      setSlots(
        (combo.slots || []).map((s: any) => ({
          title: s.title || { lt: '', uk: '' },
          type: s.type,
          required: Boolean(s.required),
          minSelection: Number(s.minSelection || 0),
          maxSelection: Number(s.maxSelection || 1),
          items:
            s.type === 'menu_item_choice'
              ? (s.items || []).map((it: any) => ({
                  menuItemId: String(it.menuItemId || ''),
                  priceDelta: Number(it.priceDelta || 0),
                  is_fryer: Boolean(it.is_fryer),
                  cooking_time: Number(it.cooking_time || 180),
                  modifiers: (it.modifiers || []).map((m: any) => ({
                    modifierId: String(m.modifierId),
                    required: Boolean(m.required),
                    minSelection: Number(m.minSelection || 0),
                    maxSelection: Number(m.maxSelection || 1),
                  })),
                }))
              : [],
          modifiers:
            s.type === 'modifier'
              ? (s.modifiers || []).map((m: any) => ({
                  modifierId: String(m.modifierId),
                  required: Boolean(m.required),
                  minSelection: Number(m.minSelection || 0),
                  maxSelection: Number(m.maxSelection || 1),
                }))
              : [],
        }))
      )

      setIsEditDialogOpen(true)
    } catch (e) {
      console.error('Error loading combo for edit:', e)
      toast.error('Помилка завантаження комбо')
    }
  }

  const updateCombo = async () => {
    if (!editingCombo?.id) {
      toast.error('Немає комбо для редагування')
      return
    }

    if (!selectedMenuItem) {
      toast.error('Оберіть блюдо для комбо')
      return
    }

    if (slots.length === 0) {
      toast.error('Додайте хоча б один слот')
      return
    }

    try {
      const payload = {
        menuItemId: selectedMenuItem,
        priceOverride: priceOverride.trim() === '' ? null : Number(priceOverride),
        slots: slots.map(slot => ({
          title: slot.title,
          type: slot.type,
          required: slot.required,
          minSelection: slot.minSelection,
          maxSelection: slot.maxSelection,
          items: slot.type === 'menu_item_choice' ? slot.items : undefined,
          modifiers: slot.type === 'modifier' ? slot.modifiers : undefined
        }))
      }

      const response = await fetch(`/api/combos/${editingCombo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await response.json().catch(() => ({} as any))

      if (response.ok && data?.success) {
        toast.success('Комбо оновлено')
        setIsEditDialogOpen(false)
        resetForm()
        loadData()
      } else {
        toast.error(data?.error || 'Помилка оновлення комбо')
      }
    } catch (error) {
      console.error('Error updating combo:', error)
      toast.error('Помилка оновлення комбо')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-orange-500 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center">Завантаження...</div>
        </div>
      </div>
    )
  }

  return (
    <AdminProtection>
      <div className="min-h-screen bg-black text-orange-500 p-4">
        <div className="max-w-6xl mx-auto">
          <header className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-black bg-transparent"
                onClick={() => window.location.href = '/admin'}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Назад к админке
              </Button>
              <div>
                <h1 className="text-4xl font-bold text-orange-500 flex items-center gap-3">
                  <Package className="w-10 h-10" />
                  Комбо-наборы
                </h1>
                <p className="text-orange-300 mt-2 text-lg">
                  Создание и управление комбо-наборами
                </p>
              </div>
            </div>
            <Button 
              onClick={() => setIsCreateDialogOpen(true)}
              className="bg-orange-600 hover:bg-orange-700 text-black font-semibold"
            >
              <Plus className="w-5 h-5 mr-2" />
              Создать комбо
            </Button>
          </header>

          {/* Список комбо */}
          {combos.length === 0 ? (
            <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-700 rounded-lg">
              Комбо-набори не знайдено. Створіть перший комбо.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {combos.map(combo => (
                <Card key={combo.id} className="bg-gray-900 border-2 border-gray-700">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-xl text-orange-500">{combo.name?.uk || 'Без назви'}</CardTitle>
                        <p className="text-gray-600">{combo.name?.lt || 'Be pavadinimo'}</p>
                        <p className="text-lg font-semibold text-green-400">€{combo.price}</p>
                        {combo.categoryName && (
                          <Badge variant="secondary" style={{ backgroundColor: combo.categoryColor }}>
                            {combo.categoryName?.uk || combo.categoryName?.lt || 'Категорія'}
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-orange-500 text-orange-500"
                          onClick={() => startEditCombo(combo.id)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => deleteCombo(combo.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {(combo.slots || []).map((slot, index) => (
                        <div key={slot.id} className="border-l-4 border-orange-500 pl-4">
                          <div className="font-semibold text-orange-400">{slot.title?.uk || 'Слот'}</div>
                          <div className="text-sm text-gray-600">{slot.title?.lt || 'Priedas'}</div>
                          <div className="text-sm">
                            {slot.type === 'menu_item_choice' ? (
                              <div>
                                <Badge variant="outline" className="border-orange-500 text-orange-500">Вибір блюда</Badge>
                                {slot.items && slot.items.length > 0 && (
                                  <div className="mt-1">
                                    {slot.items.map(item => (
                                      <span key={item.id} className="inline-block mr-2 text-gray-300">
                                        {item.name?.uk || item.name?.lt || 'Блюдо'} {item.priceDelta !== 0 && `(${item.priceDelta > 0 ? '+' : ''}€${item.priceDelta})`}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <Badge variant="outline" className="border-orange-500 text-orange-500">Модифікатор</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Диалог создания комбо */}
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-gray-900 border-gray-700 text-white">
              <DialogHeader>
                <DialogTitle className="text-orange-500 text-xl font-bold">
                  Создать новый комбо-набор
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
                {/* Вибір блюда */}
                <div>
                  <Label className="text-orange-400">Оберіть блюдо для комбо</Label>
                  <Select value={selectedMenuItem} onValueChange={setSelectedMenuItem}>
                    <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                      <SelectValue placeholder="Оберіть блюдо..." />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-600">
                      {menuItems.map(item => (
                        <SelectItem key={item.id} value={item.id} className="text-white">
                          {item.name_uk} - €{item.price}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Ціна комбо */}
                <div>
                  <Label className="text-orange-400">Ціна комбо (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={priceOverride}
                    onChange={(e) => setPriceOverride(e.target.value)}
                    placeholder="Якщо пусто — ціна з меню"
                    className="bg-gray-800 border-gray-600 text-white"
                  />
                </div>

                {/* Слоти */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <Label className="text-orange-400">Слоти комбо</Label>
                    <Button onClick={addSlot} size="sm" className="bg-orange-600 hover:bg-orange-700">
                      <Plus className="w-4 h-4 mr-1" />
                      Додати слот
                    </Button>
                  </div>
                  {slots.map((slot, slotIndex) => (
                    <Card key={slotIndex} className="bg-gray-800 border-gray-700">
                      <CardHeader>
                        <div className="flex justify-between items-center">
                          <Input
                            placeholder="Назва слота (укр)"
                            value={slot.title.uk}
                            onChange={(e) => updateSlot(slotIndex, 'title', { ...slot.title, uk: e.target.value })}
                            className="bg-gray-700 border-gray-600 text-white"
                          />
                          <Input
                            placeholder="Назва слота (лит)"
                            value={slot.title.lt}
                            onChange={(e) => updateSlot(slotIndex, 'title', { ...slot.title, lt: e.target.value })}
                            className="bg-gray-700 border-gray-600 text-white"
                          />
                          <Button 
                            variant="destructive" 
                            size="sm"
                            onClick={() => removeSlot(slotIndex)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <Label className="text-orange-400">Тип слота</Label>
                            <Select value={slot.type} onValueChange={(value) => updateSlot(slotIndex, 'type', value)}>
                              <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-gray-700 border-gray-600">
                                <SelectItem value="menu_item_choice">Вибір блюда</SelectItem>
                                <SelectItem value="modifier">Модифікатор</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-orange-400">Мін. вибір</Label>
                              <Input
                                type="number"
                                min="0"
                                value={slot.minSelection}
                                onChange={(e) => updateSlot(slotIndex, 'minSelection', parseInt(e.target.value) || 0)}
                                className="bg-gray-700 border-gray-600 text-white"
                              />
                            </div>
                            <div>
                              <Label className="text-orange-400">Макс. вибір</Label>
                              <Input
                                type="number"
                                min="1"
                                value={slot.maxSelection}
                                onChange={(e) => updateSlot(slotIndex, 'maxSelection', parseInt(e.target.value) || 1)}
                                className="bg-gray-700 border-gray-600 text-white"
                              />
                            </div>
                          </div>
                        </div>

                        {slot.type === 'menu_item_choice' && (
                          <div>
                            <div className="flex justify-between items-center mb-2">
                              <Label className="text-orange-400">Блюда в слоте</Label>
                              <Button onClick={() => addSlotItem(slotIndex)} size="sm" className="bg-orange-600 hover:bg-orange-700">
                                <Plus className="w-4 h-4 mr-1" />
                                Додати блюдо
                              </Button>
                            </div>
                            {slot.items?.map((item, itemIndex) => (
                              <div key={itemIndex} className="bg-gray-700 p-3 rounded-lg space-y-2">
                                <div className="flex gap-2 items-center">
                                  <div className="flex-1 min-w-0">
                                    <Select value={item.menuItemId} onValueChange={(value) => {
                                      const menuItem = menuItems.find(m => m.id === value)
                                      updateSlotItem(slotIndex, itemIndex, 'menuItemId', value)
                                      updateSlotItem(slotIndex, itemIndex, 'is_fryer', menuItem?.is_fryer ? true : false)
                                      updateSlotItem(slotIndex, itemIndex, 'cooking_time', menuItem?.cooking_time || 180)
                                    }}>
                                      <SelectTrigger className="bg-gray-600 border-gray-500 text-white w-full">
                                        <SelectValue placeholder="Оберіть блюдо" />
                                      </SelectTrigger>
                                      <SelectContent className="bg-gray-600 border-gray-500">
                                        {menuItems.map(menuItem => (
                                          <SelectItem key={menuItem.id} value={menuItem.id} className="text-white">
                                            {menuItem.name_uk} - €{menuItem.price}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  <Input
                                    type="number"
                                    step="0.01"
                                    placeholder="Δ ціни"
                                    value={item.priceDelta}
                                    onChange={(e) => updateSlotItem(slotIndex, itemIndex, 'priceDelta', parseFloat(e.target.value) || 0)}
                                    className="w-24 shrink-0 bg-gray-600 border-gray-500 text-white"
                                  />

                                  <div className="flex items-center gap-1">
                                    <input
                                      type="checkbox"
                                      checked={item.is_fryer}
                                      onChange={(e) => updateSlotItem(slotIndex, itemIndex, 'is_fryer', e.target.checked)}
                                      className="w-4 h-4 border-orange-500 accent-orange-500"
                                    />
                                    <span className="text-xs text-orange-400">Фритюр</span>
                                  </div>

                                  {item.is_fryer && (
                                    <Input
                                      type="number"
                                      placeholder="сек"
                                      value={item.cooking_time}
                                      onChange={(e) => updateSlotItem(slotIndex, itemIndex, 'cooking_time', parseInt(e.target.value) || 180)}
                                      className="w-16 shrink-0 bg-gray-600 border-gray-500 text-white text-sm"
                                    />
                                  )}

                                  <Button 
                                    variant="destructive" 
                                    size="sm"
                                    onClick={() => removeSlotItem(slotIndex, itemIndex)}
                                    className="shrink-0"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                                
                                {/* Модифікатори для блюда */}
                                <div>
                                  {!item.menuItemId ? (
                                    <div className="text-sm text-gray-300">
                                      Спочатку оберіть блюдо, щоб побачити доступні модифікатори.
                                    </div>
                                  ) : (
                                    <>
                                      <Label className="text-orange-400 text-sm">Модифікатори для {menuItems.find(m => m.id === item.menuItemId)?.name_uk || 'блюда'}</Label>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {modifiers.map((m) => {
                                          const checked = (item.modifiers || []).some(mm => mm.modifierId === m.id)
                                          return (
                                            <button
                                              key={m.id}
                                              type="button"
                                              onClick={() => toggleSlotItemModifier(slotIndex, itemIndex, m.id)}
                                              className={`p-2 rounded border text-left text-sm transition-colors ${
                                                checked 
                                                  ? 'border-orange-500 bg-orange-500/20 text-orange-400' 
                                                  : 'border-gray-600 bg-gray-700 text-gray-300 hover:bg-gray-600'
                                              }`}
                                            >
                                              <div className="font-medium">{m.name_uk}</div>
                                              <div className="text-xs opacity-75">
                                                {m.required ? 'Обов\'язковий' : 'Необов\'язковий'}
                                              </div>
                                            </button>
                                          )
                                        })}
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="flex justify-end gap-3">
                  <Button 
                    variant="outline" 
                    onClick={() => setIsCreateDialogOpen(false)}
                    className="border-gray-600 text-gray-300 hover:bg-gray-800"
                  >
                    Скасувати
                  </Button>
                  <Button 
                    onClick={createCombo}
                    className="bg-orange-600 hover:bg-orange-700 text-black font-semibold"
                  >
                    Створити комбо
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Диалог редактирования комбо */}
          <Dialog
            open={isEditDialogOpen}
            onOpenChange={(open) => {
              setIsEditDialogOpen(open)
              if (!open) resetForm()
            }}
          >
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-gray-900 border-gray-700 text-white">
              <DialogHeader>
                <DialogTitle className="text-orange-500 text-xl font-bold">
                  Редагувати комбо-набір
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
                {/* Вибір блюда */}
                <div>
                  <Label className="text-orange-400">Оберіть блюдо для комбо</Label>
                  <Select value={selectedMenuItem} onValueChange={setSelectedMenuItem}>
                    <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                      <SelectValue placeholder="Оберіть блюдо..." />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-600">
                      {menuItems.map(item => (
                        <SelectItem key={item.id} value={item.id} className="text-white">
                          {item.name_uk} - €{item.price}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Ціна комбо */}
                <div>
                  <Label className="text-orange-400">Ціна комбо (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={priceOverride}
                    onChange={(e) => setPriceOverride(e.target.value)}
                    placeholder="Якщо пусто — ціна з меню"
                    className="bg-gray-800 border-gray-600 text-white"
                  />
                </div>

                {/* Слоти */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <Label className="text-orange-400">Слоти комбо</Label>
                    <Button onClick={addSlot} size="sm" className="bg-orange-600 hover:bg-orange-700">
                      <Plus className="w-4 h-4 mr-1" />
                      Додати слот
                    </Button>
                  </div>
                  {slots.map((slot, slotIndex) => (
                    <Card key={slotIndex} className="bg-gray-800 border-gray-700">
                      <CardHeader>
                        <div className="flex justify-between items-center">
                          <Input
                            placeholder="Назва слота (укр)"
                            value={slot.title.uk}
                            onChange={(e) => updateSlot(slotIndex, 'title', { ...slot.title, uk: e.target.value })}
                            className="bg-gray-700 border-gray-600 text-white"
                          />
                          <Input
                            placeholder="Назва слота (лит)"
                            value={slot.title.lt}
                            onChange={(e) => updateSlot(slotIndex, 'title', { ...slot.title, lt: e.target.value })}
                            className="bg-gray-700 border-gray-600 text-white"
                          />
                          <Button 
                            variant="destructive" 
                            size="sm"
                            onClick={() => removeSlot(slotIndex)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <Label className="text-orange-400">Тип слота</Label>
                            <Select value={slot.type} onValueChange={(value) => updateSlot(slotIndex, 'type', value)}>
                              <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-gray-700 border-gray-600">
                                <SelectItem value="menu_item_choice">Вибір блюда</SelectItem>
                                <SelectItem value="modifier">Модифікатор</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-orange-400">Мін. вибір</Label>
                              <Input
                                type="number"
                                min="0"
                                value={slot.minSelection}
                                onChange={(e) => updateSlot(slotIndex, 'minSelection', parseInt(e.target.value) || 0)}
                                className="bg-gray-700 border-gray-600 text-white"
                              />
                            </div>
                            <div>
                              <Label className="text-orange-400">Макс. вибір</Label>
                              <Input
                                type="number"
                                min="1"
                                value={slot.maxSelection}
                                onChange={(e) => updateSlot(slotIndex, 'maxSelection', parseInt(e.target.value) || 1)}
                                className="bg-gray-700 border-gray-600 text-white"
                              />
                            </div>
                          </div>
                        </div>

                        {slot.type === 'menu_item_choice' && (
                          <div>
                            <div className="flex justify-between items-center mb-2">
                              <Label className="text-orange-400">Блюда в слоте</Label>
                              <Button onClick={() => addSlotItem(slotIndex)} size="sm" className="bg-orange-600 hover:bg-orange-700">
                                <Plus className="w-4 h-4 mr-1" />
                                Додати блюдо
                              </Button>
                            </div>
                            {slot.items?.map((item, itemIndex) => (
                              <div key={itemIndex} className="bg-gray-700 p-3 rounded-lg space-y-2">
                                <div className="flex gap-2 items-center">
                                  <div className="flex-1 min-w-0">
                                    <Select value={item.menuItemId} onValueChange={(value) => {
                                      const menuItem = menuItems.find(m => m.id === value)
                                      updateSlotItem(slotIndex, itemIndex, 'menuItemId', value)
                                      updateSlotItem(slotIndex, itemIndex, 'is_fryer', menuItem?.is_fryer ? true : false)
                                      updateSlotItem(slotIndex, itemIndex, 'cooking_time', menuItem?.cooking_time || 180)
                                    }}>
                                      <SelectTrigger className="bg-gray-600 border-gray-500 text-white w-full">
                                        <SelectValue placeholder="Оберіть блюдо" />
                                      </SelectTrigger>
                                      <SelectContent className="bg-gray-600 border-gray-500">
                                        {menuItems.map(menuItem => (
                                          <SelectItem key={menuItem.id} value={menuItem.id} className="text-white">
                                            {menuItem.name_uk} - €{menuItem.price}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  <Input
                                    type="number"
                                    step="0.01"
                                    placeholder="Δ ціни"
                                    value={item.priceDelta}
                                    onChange={(e) => updateSlotItem(slotIndex, itemIndex, 'priceDelta', parseFloat(e.target.value) || 0)}
                                    className="w-24 shrink-0 bg-gray-600 border-gray-500 text-white"
                                  />

                                  <div className="flex items-center gap-1">
                                    <input
                                      type="checkbox"
                                      checked={item.is_fryer}
                                      onChange={(e) => updateSlotItem(slotIndex, itemIndex, 'is_fryer', e.target.checked)}
                                      className="w-4 h-4 border-orange-500 accent-orange-500"
                                    />
                                    <span className="text-xs text-orange-400">Фритюр</span>
                                  </div>

                                  {item.is_fryer && (
                                    <Input
                                      type="number"
                                      placeholder="сек"
                                      value={item.cooking_time}
                                      onChange={(e) => updateSlotItem(slotIndex, itemIndex, 'cooking_time', parseInt(e.target.value) || 180)}
                                      className="w-16 shrink-0 bg-gray-600 border-gray-500 text-white text-sm"
                                    />
                                  )}

                                  <Button 
                                    variant="destructive" 
                                    size="sm"
                                    onClick={() => removeSlotItem(slotIndex, itemIndex)}
                                    className="shrink-0"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                                
                                {/* Модифікатори для блюда */}
                                <div>
                                  {!item.menuItemId ? (
                                    <div className="text-sm text-gray-300">
                                      Спочатку оберіть блюдо, щоб побачити доступні модифікатори.
                                    </div>
                                  ) : (
                                    <>
                                      <Label className="text-orange-400 text-sm">Модифікатори для {menuItems.find(m => m.id === item.menuItemId)?.name_uk || 'блюда'}</Label>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {modifiers.map((m) => {
                                          const checked = (item.modifiers || []).some(mm => mm.modifierId === m.id)
                                          return (
                                            <button
                                              key={m.id}
                                              type="button"
                                              onClick={() => toggleSlotItemModifier(slotIndex, itemIndex, m.id)}
                                              className={`p-2 rounded border text-left text-sm transition-colors ${
                                                checked 
                                                  ? 'border-orange-500 bg-orange-500/20 text-orange-400' 
                                                  : 'border-gray-600 bg-gray-700 text-gray-300 hover:bg-gray-600'
                                              }`}
                                            >
                                              <div className="font-medium">{m.name_uk}</div>
                                              <div className="text-xs opacity-75">
                                                {m.required ? 'Обов\'язковий' : 'Необов\'язковий'}
                                              </div>
                                            </button>
                                          )
                                        })}
                                      </div>

                                      {(item.modifiers || []).length > 0 && (
                                        <div className="space-y-2 mt-2">
                                          {(item.modifiers || []).map((mm) => (
                                            <div key={mm.modifierId} className="p-3 rounded border border-gray-700 bg-gray-800/50">
                                              <div className="flex items-center justify-between">
                                                <div className="text-sm text-gray-200">
                                                  {(modifiers.find(x => x.id === mm.modifierId)?.name_uk) || mm.modifierId}
                                                </div>
                                                <label className="flex items-center gap-2 text-sm text-gray-300">
                                                  <input
                                                    type="checkbox"
                                                    checked={mm.required}
                                                    onChange={(e) => updateSlotItemModifierRule(slotIndex, itemIndex, mm.modifierId, 'required', e.target.checked)}
                                                  />
                                                  Обов'язково
                                                </label>
                                              </div>
                                              <div className="grid grid-cols-2 gap-2 mt-2">
                                                <div>
                                                  <Label className="text-gray-400 text-xs">Min</Label>
                                                  <Input
                                                    type="number"
                                                    value={mm.minSelection}
                                                    onChange={(e) => updateSlotItemModifierRule(slotIndex, itemIndex, mm.modifierId, 'minSelection', Number(e.target.value))}
                                                    className="bg-gray-900 border-gray-600 text-white"
                                                  />
                                                </div>
                                                <div>
                                                  <Label className="text-gray-400 text-xs">Max</Label>
                                                  <Input
                                                    type="number"
                                                    value={mm.maxSelection}
                                                    onChange={(e) => updateSlotItemModifierRule(slotIndex, itemIndex, mm.modifierId, 'maxSelection', Number(e.target.value))}
                                                    className="bg-gray-900 border-gray-600 text-white"
                                                  />
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="flex justify-end gap-3">
                  <Button 
                    variant="outline" 
                    onClick={() => setIsEditDialogOpen(false)}
                    className="border-gray-600 text-gray-300 hover:bg-gray-800"
                  >
                    Скасувати
                  </Button>
                  <Button 
                    onClick={updateCombo}
                    className="bg-orange-600 hover:bg-orange-700 text-black font-semibold"
                  >
                    Зберегти
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </AdminProtection>
  )
}
