'use client'

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Trash2, Edit, ChefHat, Package, Settings, ArrowUp, ArrowDown } from "lucide-react"

interface MenuItem {
  id: string
  name?: string | { lt: string; uk: string }
  name_lt: string
  name_uk: string
  price: number
  category: string
  description?: string
  image?: string
  available: boolean
  modifiers?: string[]
  is_fryer?: boolean
  cooking_time?: number
}

interface Category {
  id: string
  name_lt: string
  name_uk: string
  order_index?: number
}

interface Modifier {
  id: string
  name_lt: string
  name_uk: string
  type?: string
  group_name?: string
  required: boolean
  order?: number
  options: ModifierOption[]
}

interface ModifierOption {
  id: string
  name_lt: string
  name_uk: string
  price: number
  order?: number
}

interface MenuItemManagerProps {
  menuItems: MenuItem[]
  categories: Category[]
  modifiers: Modifier[]
  selectedCategory: string
  onCategoryChange: (category: string) => void
  loadMenuItems: () => void
  notifyPOSMenuUpdate: () => void
  setMenuItems: (items: MenuItem[]) => void
}

export function MenuItemManager({ 
  menuItems, 
  categories, 
  modifiers,
  selectedCategory,
  onCategoryChange,
  loadMenuItems,
  notifyPOSMenuUpdate,
  setMenuItems
}: MenuItemManagerProps) {
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false)
  const [isEditMenuDialogOpen, setIsEditMenuDialogOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [newItem, setNewItem] = useState({
    name: '',
    name_lt: '',
    name_uk: '',
    price: '',
    category: '',
    description: '',
    image: '',
    available: true,
    modifiers: [] as string[],
    is_fryer: false,
    cooking_time: 180
  })
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)
  const [modifierSearchTerm, setModifierSearchTerm] = useState('')
  const [editModifierSearchTerm, setEditModifierSearchTerm] = useState('')

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('image', file)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()
      
      if (result.success) {
        setNewItem({ ...newItem, image: result.imagePath })
      } else {
        alert('Ошибка загрузки изображения: ' + result.error)
      }
    } catch (error) {
      console.error('Upload error:', error)
      alert('Ошибка загрузки изображения')
    } finally {
      setIsUploading(false)
    }
  }

  const handleEditImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !editingItem) return

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('image', file)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()
      
      if (result.success) {
        setEditingItem({ ...editingItem, image: result.imagePath })
      } else {
        alert('Ошибка загрузки изображения: ' + result.error)
      }
    } catch (error) {
      console.error('Upload error:', error)
      alert('Ошибка загрузки изображения')
    } finally {
      setIsUploading(false)
    }
  }

  const createMenuItem = async () => {
    if (!newItem.name.trim() || !newItem.category) {
      alert('Пожалуйста, заполните название и выберите категорию')
      return
    }

    try {
      const response = await fetch('/api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createMenuItem',
          ...newItem,
          name_lt: newItem.name,
          name_uk: newItem.name,
          modifierIds: newItem.modifiers,
          id: `item_${Date.now()}_${Math.floor(Math.random() * 10000)}`
        })
      })

      if (response.ok) {
        const result = await response.json()
        console.log('Товар создан успешно:', result)
        
        // Instead of reloading all items, add the new item to the state directly
        const createdItem: MenuItem = {
          id: result.id,
          name: newItem.name,
          name_lt: newItem.name,
          name_uk: newItem.name,
          price: parseFloat(newItem.price) || 0,
          category: newItem.category,
          description: newItem.description,
          image: newItem.image,
          available: newItem.available,
          modifiers: newItem.modifiers
        }
        
        // Update the state directly
        setMenuItems([...menuItems, createdItem])
        
        setNewItem({
          name: '',
          name_lt: '',
          name_uk: '',
          price: '',
          category: '',
          description: '',
          image: '',
          available: true,
          modifiers: [],
          is_fryer: false,
          cooking_time: 180
        })
        setIsItemDialogOpen(false)
        notifyPOSMenuUpdate() // Уведомляем POS
      } else {
        const errorData = await response.json()
        alert(`Ошибка создания товара: ${errorData.error || 'Неизвестная ошибка'}`)
      }
    } catch (error) {
      console.error('Ошибка создания товара:', error)
      alert('Ошибка сети при создании товара')
    }
  }

  const updateMenuItem = async () => {
    if (!editingItem) return

    try {
      const editedName = typeof editingItem.name === 'string' ? editingItem.name : (editingItem.name?.uk || '')
      const response = await fetch('/api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateMenuItem',
          ...editingItem,
          name_lt: editedName,
          name_uk: editedName,
          modifierIds: editingItem.modifiers
        })
      })

      if (response.ok) {
        await loadMenuItems()
        setIsEditMenuDialogOpen(false)
        setEditingItem(null)
        notifyPOSMenuUpdate() // Уведомляем POS
      } else {
        const errorData = await response.json()
        alert(`Ошибка обновления товара: ${errorData.error || 'Неизвестная ошибка'}`)
      }
    } catch (error) {
      console.error('Ошибка обновления товара:', error)
      alert('Ошибка сети при обновлении товара')
    }
  }

  const deleteMenuItem = async (id: string) => {
    if (!confirm('Удалить товар?')) return

    try {
      const response = await fetch('/api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deleteMenuItem', id })
      })

      if (response.ok) {
        await loadMenuItems()
        notifyPOSMenuUpdate() // Уведомляем POS
      }
    } catch (error) {
      console.error('Ошибка удаления товара:', error)
      alert('Ошибка сети при удалении товара')
    }
  }

  const toggleModifier = (modifierId: string, isAdding: boolean = true) => {
    if (isAdding) {
      setNewItem({ ...newItem, modifiers: [...newItem.modifiers, modifierId] })
    } else {
      setNewItem({ ...newItem, modifiers: newItem.modifiers.filter(id => id !== modifierId) })
    }
  }

  const toggleEditModifier = (modifierId: string, isAdding: boolean = true) => {
    if (editingItem) {
      if (isAdding) {
        setEditingItem({ ...editingItem, modifiers: [...(editingItem.modifiers || []), modifierId] })
      } else {
        setEditingItem({ ...editingItem, modifiers: (editingItem.modifiers || []).filter(id => id !== modifierId) })
      }
    }
  }

  const selectAllModifiers = () => {
    const allModifierIds = modifiers.map(m => m.id)
    setNewItem({ ...newItem, modifiers: allModifierIds })
  }

  const clearAllModifiers = () => {
    setNewItem({ ...newItem, modifiers: [] })
  }

  const selectAllEditModifiers = () => {
    if (editingItem) {
      const allModifierIds = modifiers.map(m => m.id)
      setEditingItem({ ...editingItem, modifiers: allModifierIds })
    }
  }

  const clearAllEditModifiers = () => {
    if (editingItem) {
      setEditingItem({ ...editingItem, modifiers: [] })
    }
  }

  // Группировка модификаторов по типу для отображения
  const groupedModifiers = modifiers.reduce((acc, modifier) => {
    const type = modifier.type || 'addon'
    if (!acc[type]) {
      acc[type] = []
    }
    acc[type].push(modifier)
    return acc
  }, {} as Record<string, Modifier[]>)

  const getTypeName = (type: string) => {
    switch (type) {
      case 'size': return 'Размеры'
      case 'sauce': return 'Соусы'
      case 'addon': return 'Добавки'
      default: return type
    }
  }

  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-orange-500">Товары</h2>
        <Dialog open={isItemDialogOpen} onOpenChange={setIsItemDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-orange-500 text-black hover:bg-orange-600 h-12 text-lg px-4">
              <Plus className="w-5 h-5 mr-2" />
              Добавить товар
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-black border-orange-500 max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-orange-500">Новый товар</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="new-name" className="text-orange-300">Название</Label>
                  <Input
                    id="new-name"
                    value={newItem.name}
                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                    className="bg-black border-orange-500 text-orange-500 h-12 text-lg"
                    placeholder="Название товара"
                  />
                </div>
                <div>
                  <Label htmlFor="new-price" className="text-orange-300">Цена (€)</Label>
                  <Input
                    id="new-price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={newItem.price}
                    onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                    className="bg-black border-orange-500 text-orange-500 h-12 text-lg"
                    placeholder="0.00"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="new-category" className="text-orange-300">Категория</Label>
                  <Select value={newItem.category} onValueChange={(value) => setNewItem({ ...newItem, category: value })}>
                    <SelectTrigger id="new-category" className="bg-black border-orange-500 text-orange-500 h-12 text-lg">
                      <SelectValue placeholder="Выберите категорию" />
                    </SelectTrigger>
                    <SelectContent className="bg-black border-orange-500">
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id} className="text-orange-500">
                          {cat.name_uk}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="new-image" className="text-orange-300">Изображение</Label>
                  <Input
                    id="new-image"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="bg-black border-orange-500 text-orange-500 h-12 text-lg file:mr-2 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-orange-500 file:text-black hover:file:bg-orange-600"
                  />
                  {isUploading && <p className="text-orange-300 text-sm mt-1">Загрузка...</p>}
                  {newItem.image && <p className="text-orange-300 text-sm mt-1">Загружено: {newItem.image}</p>}
                </div>
              </div>
              
              <div>
                <Label htmlFor="new-description" className="text-orange-300">Описание</Label>
                <Textarea
                  id="new-description"
                  value={newItem.description}
                  onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                  className="bg-black border-orange-500 text-orange-500 min-h-[100px] text-lg"
                  placeholder="Описание товара"
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="new-available"
                  checked={newItem.available}
                  onCheckedChange={(checked) => setNewItem({ ...newItem, available: !!checked })}
                  className="border-orange-500 data-[state=checked]:bg-orange-500 data-[state=checked]:text-black h-6 w-6"
                />
                <Label htmlFor="new-available" className="text-orange-300">Товар доступен</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="new-fryer"
                  checked={newItem.is_fryer}
                  onCheckedChange={(checked) => setNewItem({ ...newItem, is_fryer: !!checked })}
                  className="border-orange-500 data-[state=checked]:bg-orange-500 data-[state=checked]:text-black h-6 w-6"
                />
                <Label htmlFor="new-fryer" className="text-orange-300">Приготовление во фритюре (таймер)</Label>
              </div>
              
              {newItem.is_fryer && (
                <div>
                  <Label htmlFor="new-cooking-time" className="text-orange-300">Время приготовления (секунды)</Label>
                  <Input
                    id="new-cooking-time"
                    type="number"
                    min="30"
                    max="600"
                    value={newItem.cooking_time}
                    onChange={(e) => setNewItem({ ...newItem, cooking_time: parseInt(e.target.value) || 180 })}
                    className="bg-black border-orange-500 text-orange-500 h-12 text-lg"
                  />
                  <p className="text-sm text-gray-400 mt-1">
                    {Math.floor(newItem.cooking_time / 60)}:{(newItem.cooking_time % 60).toString().padStart(2, '0')}
                  </p>
                </div>
              )}
              
              <div>
                <Label className="text-orange-300 mb-2 block">Модификаторы</Label>
                <div className="space-y-3 max-h-60 overflow-y-auto p-2 border border-gray-700 rounded">
                  {Object.keys(groupedModifiers).length > 0 ? (
                    Object.entries(groupedModifiers).map(([type, mods]) => (
                      <div key={type}>
                        <h4 className="font-medium text-orange-500 mb-1">{getTypeName(type)}</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                          {mods.map((modifier) => (
                            <div key={modifier.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`new-mod-${modifier.id}`}
                                checked={newItem.modifiers.includes(modifier.id)}
                                onCheckedChange={(checked) => toggleModifier(modifier.id, !!checked)}
                                className="border-orange-500 data-[state=checked]:bg-orange-500 data-[state=checked]:text-black"
                              />
                              <Label htmlFor={`new-mod-${modifier.id}`} className="text-orange-300 text-sm">
                                {modifier.name_uk}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-sm">Нет доступных модификаторов</p>
                  )}
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button onClick={createMenuItem} className="bg-orange-500 text-black hover:bg-orange-600 h-12 flex-1">
                  Создать товар
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setIsItemDialogOpen(false)} 
                  className="border-orange-500 text-orange-500 h-12 flex-1"
                >
                  Отмена
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      
      {/* Category Filter */}
      <div className="mb-6">
        <Label htmlFor="category-filter" className="text-orange-300 mb-2 block">Фильтр по категории</Label>
        <Select value={selectedCategory} onValueChange={onCategoryChange}>
          <SelectTrigger id="category-filter" className="w-full bg-black border-orange-500 text-orange-500 h-12 text-lg">
            <SelectValue placeholder="Все категории" />
          </SelectTrigger>
          <SelectContent className="bg-black border-orange-500">
            <SelectItem value="all" className="text-orange-500">Все категории</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id} className="text-orange-500">
                {cat.name_uk}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Menu Items List */}
      <div className="space-y-3">
        {menuItems.length > 0 ? (
          menuItems.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-4 bg-gray-900 border border-orange-500 rounded-lg">
              <div className="flex items-center gap-4">
                <div className="flex flex-col">
                  <span className="text-orange-500 font-semibold text-lg">{item.name_uk}</span>
                  <span className="text-gray-400 text-sm">€{item.price.toFixed(2)}</span>
                  {item.description && (
                    <span className="text-gray-500 text-sm mt-1 line-clamp-1">{item.description}</span>
                  )}
                  {item.modifiers && item.modifiers.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      <Badge variant="secondary" className="text-xs bg-gray-700 text-gray-300">
                        {item.modifiers.length} модификаторов
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingItem({
                      ...item,
                      name: typeof item.name === 'string' ? item.name : (item.name?.uk || ''),
                      price: item.price,
                      category: item.category || '',
                      description: item.description || '',
                      image: item.image || '',
                      available: item.available !== undefined ? item.available : true,
                      modifiers: item.modifiers || [],
                      cooking_time: item.cooking_time || 180
                    })
                    setIsEditMenuDialogOpen(true)
                  }}
                  className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-black h-10 w-10 p-0"
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => deleteMenuItem(item.id)}
                  className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white h-10 w-10 p-0"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>Нет товаров в выбранной категории</p>
            <Button 
              onClick={() => setIsItemDialogOpen(true)} 
              className="mt-4 bg-orange-500 text-black hover:bg-orange-600"
            >
              Создать первый товар
            </Button>
          </div>
        )}
      </div>

      {/* Диалог редактирования товара */}
      <Dialog open={isEditMenuDialogOpen} onOpenChange={setIsEditMenuDialogOpen}>
        <DialogContent className="bg-black border-orange-500 max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-orange-500">Редактировать товар</DialogTitle>
          </DialogHeader>
          {editingItem && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-id" className="text-orange-300">ID товара</Label>
                <Input
                  id="edit-id"
                  value={editingItem.id}
                  disabled
                  className="bg-gray-800 border-gray-600 text-gray-400 h-12 text-lg"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-name" className="text-orange-300">Название</Label>
                  <Input
                    id="edit-name"
                    value={typeof editingItem.name === 'string' ? editingItem.name : (editingItem.name?.uk || '')}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        name: e.target.value,
                        name_lt: e.target.value,
                        name_uk: e.target.value,
                      })
                    }
                    className="bg-black border-orange-500 text-orange-500 h-12 text-lg"
                    placeholder="Название товара"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-price" className="text-orange-300">Цена (€)</Label>
                  <Input
                    id="edit-price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={editingItem.price}
                    onChange={(e) => setEditingItem({ ...editingItem, price: parseFloat(e.target.value) || 0 })}
                    className="bg-black border-orange-500 text-orange-500 h-12 text-lg"
                    placeholder="0.00"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-category" className="text-orange-300">Категория</Label>
                  <Select value={editingItem.category} onValueChange={(value) => setEditingItem({ ...editingItem, category: value })}>
                    <SelectTrigger id="edit-category" className="bg-black border-orange-500 text-orange-500 h-12 text-lg">
                      <SelectValue placeholder="Выберите категорию" />
                    </SelectTrigger>
                    <SelectContent className="bg-black border-orange-500">
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id} className="text-orange-500">
                          {cat.name_uk}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-image" className="text-orange-300">Изображение</Label>
                  <Input
                    id="edit-image"
                    type="file"
                    accept="image/*"
                    onChange={handleEditImageUpload}
                    className="bg-black border-orange-500 text-orange-500 h-12 text-lg file:mr-2 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-orange-500 file:text-black hover:file:bg-orange-600"
                  />
                  {isUploading && <p className="text-orange-300 text-sm mt-1">Загрузка...</p>}
                  {editingItem.image && <p className="text-orange-300 text-sm mt-1">Загружено: {editingItem.image}</p>}
                </div>
              </div>
              
              <div>
                <Label htmlFor="edit-description" className="text-orange-300">Описание</Label>
                <Textarea
                  id="edit-description"
                  value={editingItem.description || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                  className="bg-black border-orange-500 text-orange-500 min-h-[100px] text-lg"
                  placeholder="Описание товара"
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="edit-available"
                  checked={editingItem.available}
                  onCheckedChange={(checked) => setEditingItem({ ...editingItem, available: !!checked })}
                  className="border-orange-500 data-[state=checked]:bg-orange-500 data-[state=checked]:text-black h-6 w-6"
                />
                <Label htmlFor="edit-available" className="text-orange-300">Товар доступен</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="edit-fryer"
                  checked={editingItem.is_fryer || false}
                  onCheckedChange={(checked) => setEditingItem({ ...editingItem, is_fryer: !!checked })}
                  className="border-orange-500 data-[state=checked]:bg-orange-500 data-[state=checked]:text-black h-6 w-6"
                />
                <Label htmlFor="edit-fryer" className="text-orange-300">Приготовление во фритюре (таймер)</Label>
              </div>
              
              {editingItem.is_fryer && (
                <div>
                  <Label htmlFor="edit-cooking-time" className="text-orange-300">Время приготовления (секунды)</Label>
                  <Input
                    id="edit-cooking-time"
                    type="number"
                    min="30"
                    max="600"
                    value={editingItem.cooking_time || 180}
                    onChange={(e) => setEditingItem({ ...editingItem, cooking_time: parseInt(e.target.value) || 180 })}
                    className="bg-black border-orange-500 text-orange-500 h-12 text-lg"
                  />
                  <p className="text-sm text-gray-400 mt-1">
                    {Math.floor((editingItem.cooking_time || 180) / 60)}:{((editingItem.cooking_time || 180) % 60).toString().padStart(2, '0')}
                  </p>
                </div>
              )}
              
              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label className="text-orange-300">Модификаторы</Label>
                  <div className="flex gap-1">
                    <Button 
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={selectAllEditModifiers}
                      className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-black h-8 text-xs"
                    >
                      Все
                    </Button>
                    <Button 
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={clearAllEditModifiers}
                      className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white h-8 text-xs"
                    >
                      Очистить
                    </Button>
                  </div>
                </div>
                <div className="space-y-3 max-h-60 overflow-y-auto p-2 border border-gray-700 rounded bg-black/30">
                  {Object.keys(groupedModifiers).length > 0 ? (
                    Object.entries(groupedModifiers).map(([type, mods]) => (
                      <div key={type} className="border border-gray-700 rounded p-2 bg-gray-900/50">
                        <h4 className="font-medium text-orange-500 mb-2 text-sm">{getTypeName(type)}</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {mods.map((modifier) => (
                            <div key={modifier.id} className="flex items-center space-x-2 p-1 rounded hover:bg-gray-800/50">
                              <Checkbox
                                id={`edit-mod-${modifier.id}`}
                                checked={(editingItem.modifiers || []).includes(modifier.id)}
                                onCheckedChange={(checked) => toggleEditModifier(modifier.id, !!checked)}
                                className="border-orange-500 data-[state=checked]:bg-orange-500 data-[state=checked]:text-black"
                              />
                              <Label htmlFor={`edit-mod-${modifier.id}`} className="text-orange-300 text-sm cursor-pointer">
                                {modifier.name_uk}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-sm">Нет доступных модификаторов</p>
                  )}
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button onClick={updateMenuItem} className="bg-orange-500 text-black hover:bg-orange-600 h-12 flex-1">
                  Сохранить изменения
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setIsEditMenuDialogOpen(false)} 
                  className="border-orange-500 text-orange-500 h-12 flex-1"
                >
                  Отмена
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}