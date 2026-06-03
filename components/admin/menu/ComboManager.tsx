'use client'

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, Trash2, Edit, ChefHat } from "lucide-react"

interface MenuItem {
  id: string
  name_uk: string
  name_lt: string
  price: number
  category: string
  is_fryer?: number
  cooking_time?: number
}

interface ComboSlot {
  id: string
  title_lt: string
  title_uk: string
  slot_type: 'modifier' | 'menu_item_choice'
  required: number
  min_selection: number
  max_selection: number
  sort_order: number
  items?: ComboSlotItem[]
}

interface ComboSlotItem {
  id: string
  menu_item_id: string
  price_delta: number
  is_available: number
  sort_order: number
  is_fryer?: number
  cooking_time?: number
  menu_item?: MenuItem
}

interface ComboSet {
  id: string
  menu_item_id: string
  is_active: number
  price_override?: number
  menu_item?: MenuItem
  slots?: ComboSlot[]
}

interface ComboManagerProps {
  menuItems: MenuItem[]
  loadMenuItems: () => void
}

export function ComboManager({ menuItems, loadMenuItems }: ComboManagerProps) {
  const [comboSets, setComboSets] = useState<ComboSet[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCombo, setEditingCombo] = useState<ComboSet | null>(null)
  const [newCombo, setNewCombo] = useState({
    menu_item_id: '',
    is_active: 1,
    price_override: ''
  })

  useEffect(() => {
    loadComboSets()
  }, [])

  const loadComboSets = async () => {
    try {
      const res = await fetch('/api/combo-sets')
      const data = await res.json()
      if (data.comboSets) {
        // Load menu items for each combo
        const comboSetsWithItems = await Promise.all(
          data.comboSets.map(async (combo: ComboSet) => {
            const menuItem = menuItems.find(m => m.id === combo.menu_item_id)
            const slotsRes = await fetch(`/api/combo-sets/${combo.id}/slots`)
            const slotsData = await slotsRes.json()
            return {
              ...combo,
              menu_item: menuItem,
              slots: slotsData.slots || []
            }
          })
        )
        setComboSets(comboSetsWithItems)
      }
    } catch (error) {
      console.error('Error loading combo sets:', error)
    }
  }

  const createComboSet = async () => {
    try {
      const res = await fetch('/api/combo-sets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          ...newCombo,
          price_override: newCombo.price_override ? parseFloat(newCombo.price_override) : null
        })
      })

      if (res.ok) {
        await loadComboSets()
        setIsDialogOpen(false)
        setNewCombo({ menu_item_id: '', is_active: 1, price_override: '' })
      }
    } catch (error) {
      console.error('Error creating combo set:', error)
    }
  }

  const deleteComboSet = async (id: string) => {
    if (!confirm('Удалить комбо-набор?')) return

    try {
      const res = await fetch('/api/combo-sets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id })
      })

      if (res.ok) {
        await loadComboSets()
      }
    } catch (error) {
      console.error('Error deleting combo set:', error)
    }
  }

  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-orange-500">Комбо-наборы</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-orange-500 text-black hover:bg-orange-600 h-12 text-lg px-4">
              <Plus className="w-5 h-5 mr-2" />
              Создать комбо
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-black border-orange-500 max-w-md">
            <DialogHeader>
              <DialogTitle className="text-orange-500">Новый комбо-набор</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="combo-menu-item" className="text-orange-300">Блюдо</Label>
                <Select value={newCombo.menu_item_id} onValueChange={(value) => setNewCombo({ ...newCombo, menu_item_id: value })}>
                  <SelectTrigger id="combo-menu-item" className="bg-black border-orange-500 text-orange-500 h-12">
                    <SelectValue placeholder="Выберите блюдо" />
                  </SelectTrigger>
                  <SelectContent className="bg-black border-orange-500">
                    {menuItems.map((item) => (
                      <SelectItem key={item.id} value={item.id} className="text-orange-500">
                        {item.name_uk}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="combo-price" className="text-orange-300">Цена комбо (опционально)</Label>
                <Input
                  id="combo-price"
                  type="number"
                  step="0.01"
                  value={newCombo.price_override}
                  onChange={(e) => setNewCombo({ ...newCombo, price_override: e.target.value })}
                  className="bg-black border-orange-500 text-orange-500 h-12"
                  placeholder="Оставьте пустым для автоматической цены"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="combo-active"
                  checked={newCombo.is_active === 1}
                  onCheckedChange={(checked) => setNewCombo({ ...newCombo, is_active: checked ? 1 : 0 })}
                  className="border-orange-500 data-[state=checked]:bg-orange-500 data-[state=checked]:text-black"
                />
                <Label htmlFor="combo-active" className="text-orange-300">Активен</Label>
              </div>
              <Button onClick={createComboSet} className="bg-orange-500 text-black hover:bg-orange-600 w-full h-12">
                Создать
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {comboSets.map((combo) => (
          <Card key={combo.id} className="bg-gray-900 border-orange-500">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <CardTitle className="text-orange-500">
                  {combo.menu_item?.name_uk || 'Неизвестное блюдо'}
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingCombo(combo)}
                    className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-black"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => deleteComboSet(combo.id)}
                    className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-gray-400 mb-2">
                {combo.price_override ? `Цена: €${combo.price_override.toFixed(2)}` : 'Автоматическая цена'}
              </div>
              {combo.slots && combo.slots.length > 0 && (
                <div className="space-y-2">
                  {combo.slots.map((slot) => (
                    <div key={slot.id} className="bg-gray-800 p-2 rounded">
                      <div className="text-orange-300 font-semibold mb-1">
                        {slot.title_uk}
                      </div>
                      <div className="text-xs text-gray-400 mb-2">
                        {slot.min_selection}-{slot.max_selection} позиций
                      </div>
                      {slot.items && slot.items.length > 0 && (
                        <div className="space-y-1">
                          {slot.items.map((item) => (
                            <div key={item.id} className="flex items-center justify-between text-sm">
                              <span className="text-gray-300">
                                {item.menu_item?.name_uk || 'Неизвестно'}
                              </span>
                              <div className="flex items-center gap-2">
                                {item.is_fryer && (
                                  <span className="text-orange-400 flex items-center gap-1">
                                    <ChefHat className="w-3 h-3" />
                                    {item.cooking_time ? `${item.cooking_time}с` : ''}
                                  </span>
                                )}
                                {item.price_delta !== 0 && (
                                  <span className="text-gray-400">
                                    {item.price_delta > 0 ? '+' : ''}€{item.price_delta.toFixed(2)}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {editingCombo && (
        <ComboSlotEditor
          combo={editingCombo}
          menuItems={menuItems}
          onClose={() => {
            setEditingCombo(null)
            loadComboSets()
          }}
        />
      )}
    </div>
  )
}

interface ComboSlotEditorProps {
  combo: ComboSet
  menuItems: MenuItem[]
  onClose: () => void
}

function ComboSlotEditor({ combo, menuItems, onClose }: ComboSlotEditorProps) {
  const [slots, setSlots] = useState<ComboSlot[]>(combo.slots || [])
  const [isAddingSlot, setIsAddingSlot] = useState(false)
  const [newSlot, setNewSlot] = useState({
    title_lt: '',
    title_uk: '',
    slot_type: 'menu_item_choice' as const,
    required: 1,
    min_selection: 1,
    max_selection: 1
  })

  const createSlot = async () => {
    try {
      const res = await fetch('/api/combo-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          combo_set_id: combo.id,
          ...newSlot
        })
      })

      if (res.ok) {
        const data = await res.json()
        setSlots([...slots, data.slot])
        setIsAddingSlot(false)
        setNewSlot({
          title_lt: '',
          title_uk: '',
          slot_type: 'menu_item_choice',
          required: 1,
          min_selection: 1,
          max_selection: 1
        })
      }
    } catch (error) {
      console.error('Error creating slot:', error)
    }
  }

  const deleteSlot = async (slotId: string) => {
    try {
      const res = await fetch('/api/combo-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id: slotId })
      })

      if (res.ok) {
        setSlots(slots.filter(s => s.id !== slotId))
      }
    } catch (error) {
      console.error('Error deleting slot:', error)
    }
  }

  return (
    <Dialog open={!!combo} onOpenChange={onClose}>
      <DialogContent className="bg-black border-orange-500 max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-orange-500">
            Редактирование слотов: {combo.menu_item?.name_uk}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-orange-400">Слоты выбора</h3>
            <Button
              onClick={() => setIsAddingSlot(true)}
              className="bg-orange-500 text-black hover:bg-orange-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              Добавить слот
            </Button>
          </div>

          {isAddingSlot && (
            <Card className="bg-gray-800 border-orange-500">
              <CardContent className="pt-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-orange-300">Название (LT)</Label>
                    <Input
                      value={newSlot.title_lt}
                      onChange={(e) => setNewSlot({ ...newSlot, title_lt: e.target.value })}
                      className="bg-black border-orange-500 text-orange-500"
                    />
                  </div>
                  <div>
                    <Label className="text-orange-300">Название (UK)</Label>
                    <Input
                      value={newSlot.title_uk}
                      onChange={(e) => setNewSlot({ ...newSlot, title_uk: e.target.value })}
                      className="bg-black border-orange-500 text-orange-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-orange-300">Мин. выбор</Label>
                    <Input
                      type="number"
                      value={newSlot.min_selection}
                      onChange={(e) => setNewSlot({ ...newSlot, min_selection: parseInt(e.target.value) || 1 })}
                      className="bg-black border-orange-500 text-orange-500"
                    />
                  </div>
                  <div>
                    <Label className="text-orange-300">Макс. выбор</Label>
                    <Input
                      type="number"
                      value={newSlot.max_selection}
                      onChange={(e) => setNewSlot({ ...newSlot, max_selection: parseInt(e.target.value) || 1 })}
                      className="bg-black border-orange-500 text-orange-500"
                    />
                  </div>
                  <div className="flex items-center pt-6">
                    <Checkbox
                      checked={newSlot.required === 1}
                      onCheckedChange={(checked) => setNewSlot({ ...newSlot, required: checked ? 1 : 0 })}
                      className="border-orange-500 data-[state=checked]:bg-orange-500 data-[state=checked]:text-black"
                    />
                    <Label className="text-orange-300 ml-2">Обязательный</Label>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={createSlot} className="bg-orange-500 text-black hover:bg-orange-600">
                    Создать слот
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setIsAddingSlot(false)}
                    className="border-orange-500 text-orange-500"
                  >
                    Отмена
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-3">
            {slots.map((slot) => (
              <Card key={slot.id} className="bg-gray-800 border-orange-500">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-orange-400">
                      {slot.title_uk} ({slot.min_selection}-{slot.max_selection})
                    </CardTitle>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => deleteSlot(slot.id)}
                      className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <SlotItemsEditor slot={slot} menuItems={menuItems} onUpdate={() => {
                    // Reload slots
                    fetch(`/api/combo-sets/${combo.id}/slots`)
                      .then(res => res.json())
                      .then(data => setSlots(data.slots || []))
                  }} />
                </CardContent>
              </Card>
            ))}
          </div>

          <Button onClick={onClose} className="bg-orange-500 text-black hover:bg-orange-600 w-full">
            Закрыть
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface SlotItemsEditorProps {
  slot: ComboSlot
  menuItems: MenuItem[]
  onUpdate: () => void
}

function SlotItemsEditor({ slot, menuItems, onUpdate }: SlotItemsEditorProps) {
  const [isAddingItem, setIsAddingItem] = useState(false)
  const [newItem, setNewItem] = useState({
    menu_item_id: '',
    price_delta: 0,
    is_fryer: 0,
    cooking_time: 180
  })

  const createSlotItem = async () => {
    try {
      const res = await fetch('/api/combo-slot-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          combo_slot_id: slot.id,
          ...newItem
        })
      })

      if (res.ok) {
        setIsAddingItem(false)
        setNewItem({ menu_item_id: '', price_delta: 0, is_fryer: 0, cooking_time: 180 })
        onUpdate()
      }
    } catch (error) {
      console.error('Error creating slot item:', error)
    }
  }

  const deleteSlotItem = async (itemId: string) => {
    try {
      const res = await fetch('/api/combo-slot-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id: itemId })
      })

      if (res.ok) {
        onUpdate()
      }
    } catch (error) {
      console.error('Error deleting slot item:', error)
    }
  }

  const updateSlotItem = async (itemId: string, updates: any) => {
    try {
      const res = await fetch('/api/combo-slot-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', id: itemId, ...updates })
      })

      if (res.ok) {
        onUpdate()
      }
    } catch (error) {
      console.error('Error updating slot item:', error)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-400">Позиции ({slot.items?.length || 0})</span>
        <Button
          size="sm"
          onClick={() => setIsAddingItem(true)}
          className="bg-orange-500 text-black hover:bg-orange-600"
        >
          <Plus className="w-3 h-3 mr-1" />
          Добавить
        </Button>
      </div>

      {isAddingItem && (
        <Card className="bg-gray-900 border-orange-500">
          <CardContent className="pt-3 space-y-2">
            <div>
              <Label className="text-orange-300 text-sm">Блюдо</Label>
              <Select value={newItem.menu_item_id} onValueChange={(value) => {
                const menuItem = menuItems.find(m => m.id === value)
                setNewItem({ 
                  ...newItem, 
                  menu_item_id: value,
                  is_fryer: menuItem?.is_fryer || 0,
                  cooking_time: menuItem?.cooking_time || 180
                })
              }}>
                <SelectTrigger className="bg-black border-orange-500 text-orange-500 h-10">
                  <SelectValue placeholder="Выберите блюдо" />
                </SelectTrigger>
                <SelectContent className="bg-black border-orange-500">
                  {menuItems.map((item) => (
                    <SelectItem key={item.id} value={item.id} className="text-orange-500">
                      {item.name_uk}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-orange-300 text-sm">Разница цены</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newItem.price_delta}
                  onChange={(e) => setNewItem({ ...newItem, price_delta: parseFloat(e.target.value) || 0 })}
                  className="bg-black border-orange-500 text-orange-500 h-10"
                />
              </div>
              <div className="flex items-center gap-2 pt-4">
                <Checkbox
                  checked={newItem.is_fryer === 1}
                  onCheckedChange={(checked) => setNewItem({ ...newItem, is_fryer: checked ? 1 : 0 })}
                  className="border-orange-500 data-[state=checked]:bg-orange-500 data-[state=checked]:text-black"
                />
                <Label className="text-orange-300 text-sm">Фритюр</Label>
              </div>
            </div>
            {newItem.is_fryer === 1 && (
              <div>
                <Label className="text-orange-300 text-sm">Время приготовления (сек)</Label>
                <Input
                  type="number"
                  value={newItem.cooking_time}
                  onChange={(e) => setNewItem({ ...newItem, cooking_time: parseInt(e.target.value) || 180 })}
                  className="bg-black border-orange-500 text-orange-500 h-10"
                />
              </div>
            )}
            <div className="flex gap-2">
              <Button onClick={createSlotItem} className="bg-orange-500 text-black hover:bg-orange-600 flex-1">
                Добавить
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsAddingItem(false)}
                className="border-orange-500 text-orange-500"
              >
                Отмена
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-1">
        {slot.items?.map((item) => (
          <div key={item.id} className="flex items-center justify-between bg-gray-900 p-2 rounded">
            <div className="flex items-center gap-2">
              <span className="text-gray-300 text-sm">{item.menu_item?.name_uk}</span>
              {item.is_fryer && (
                <span className="text-orange-400 text-xs flex items-center gap-1">
                  <ChefHat className="w-3 h-3" />
                  {item.cooking_time}s
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <Checkbox
                  checked={item.is_fryer === 1}
                  onCheckedChange={(checked) => updateSlotItem(item.id, { is_fryer: checked ? 1 : 0 })}
                  className="border-orange-500 data-[state=checked]:bg-orange-500 data-[state=checked]:text-black w-4 h-4"
                />
                <Label className="text-orange-300 text-xs">Фритюр</Label>
              </div>
              {item.is_fryer === 1 && (
                <Input
                  type="number"
                  value={item.cooking_time || 180}
                  onChange={(e) => updateSlotItem(item.id, { cooking_time: parseInt(e.target.value) || 180 })}
                  className="bg-black border-orange-500 text-orange-500 w-16 h-8 text-sm"
                />
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => deleteSlotItem(item.id)}
                className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white h-8 w-8 p-0"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
