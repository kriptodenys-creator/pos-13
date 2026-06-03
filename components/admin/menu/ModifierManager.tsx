'use client'

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, Trash2, Edit, Package } from "lucide-react"
import { ModifierIngredientManager } from "@/components/admin/modifiers/ModifierIngredientManager"

interface ModifierOption {
  id: string
  name_lt: string
  name_uk: string
  price: number
  order?: number
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

interface ModifierManagerProps {
  modifiers: Modifier[]
  loadModifiers: () => void
  notifyPOSMenuUpdate: () => void
}

export function ModifierManager({ 
  modifiers, 
  loadModifiers,
  notifyPOSMenuUpdate
}: ModifierManagerProps) {
  const [isModifierDialogOpen, setIsModifierDialogOpen] = useState(false)
  const [isEditModifierDialogOpen, setIsEditModifierDialogOpen] = useState(false)
  const [newModifier, setNewModifier] = useState({
    name_lt: '',
    name_uk: '',
    type: 'addon' as string,
    required: false,
    options: [{ id: '', name_lt: '', name_uk: '', price: 0 }],
    customType: ''
  })
  const [editingModifier, setEditingModifier] = useState<Modifier | null>(null)
  const [isIngredientDialogOpen, setIsIngredientDialogOpen] = useState(false)
  const [selectedOption, setSelectedOption] = useState<ModifierOption | null>(null)
  const [selectedModifierName, setSelectedModifierName] = useState('')
  const [inventoryItems, setInventoryItems] = useState<unknown[]>([])

  useEffect(() => {
    loadInventoryItems()
  }, [])

  const loadInventoryItems = async () => {
    try {
      const response = await fetch('/api/inventory')
      if (response.ok) {
        const data = await response.json()
        setInventoryItems(data.items || [])
      }
    } catch (error) {
      console.error('Ошибка загрузки склада:', error)
    }
  }

  const openIngredientManager = (option: ModifierOption, modifierName: string) => {
    setSelectedOption(option)
    setSelectedModifierName(modifierName)
    setIsIngredientDialogOpen(true)
  }

  const createModifier = async () => {
    if (!newModifier.name_lt.trim() || !newModifier.name_uk.trim()) {
      alert('Пожалуйста, заполните название модификатора');
      return;
    }

    try {
      // Creating modifier
      const finalType = newModifier.customType.trim() || newModifier.type || 'addon'
      const modifier = {
        id: `mod_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
        name_lt: newModifier.name_lt,
        name_uk: newModifier.name_uk,
        type: finalType,
        required: newModifier.required,
        // Filter out empty options
        options: newModifier.options.filter(opt => opt.name_lt.trim() || opt.name_uk.trim()).map(opt => ({
          ...opt,
          id: opt.id || `opt_${Date.now()}_${Math.floor(Math.random() * 10000)}`
        }))
      }
      // Sending data
      const response = await fetch('/api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createModifier',
          ...modifier
        })
      })

      if (response.ok) {
        // Modifier created
        // Гарантированно перезагружаем список модификаторов
        await loadModifiers();
        setNewModifier({
          name_lt: '',
          name_uk: '',
          type: 'addon',
          required: false,
          options: [{ id: '', name_lt: '', name_uk: '', price: 0 }],
          customType: ''
        })
        setIsModifierDialogOpen(false)
        notifyPOSMenuUpdate() // Уведомляем POS
      } else {
        const errorData = await response.json();
        console.error('Ошибка создания модификатора, статус:', response.status, errorData);
        alert(`Ошибка создания модификатора: ${errorData.error || 'Неизвестная ошибка'}`);
      }
    } catch (error) {
      console.error('Ошибка создания модификатора:', error)
      alert('Ошибка сети при создании модификатора');
    }
  }

  const updateModifier = async () => {
    if (!editingModifier) return

    try {
      // Updating modifier
      
      // Filter out empty options
      const filteredOptions = editingModifier.options && Array.isArray(editingModifier.options) 
        ? editingModifier.options.filter(opt => opt.name_lt?.trim() || opt.name_uk?.trim())
        : []
      
      const modifierData = {
        action: 'updateModifier',
        id: editingModifier.id,
        name_lt: editingModifier.name_lt,
        name_uk: editingModifier.name_uk,
        type: editingModifier.type || 'addon',
        required: editingModifier.required,
        options: filteredOptions
      }
      
      const response = await fetch('/api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(modifierData)
      })

      if (response.ok) {
        await loadModifiers()
        setIsEditModifierDialogOpen(false)
        setEditingModifier(null)
        notifyPOSMenuUpdate() // Уведомляем POS
      } else {
        const errorData = await response.json()
        console.error('Failed to update modifier:', errorData)
        alert(`Ошибка обновления модификатора: ${errorData.error || 'Неизвестная ошибка'}`);
      }
    } catch (error) {
      console.error('Ошибка обновления модификатора:', error)
      alert('Ошибка сети при обновлении модификатора');
    }
  }

  const deleteModifier = async (id: string) => {
    // Для одиночного модификатора
    if (!confirm('Удалить модификатор?')) return;

    try {
      // Deleting modifier
      
      // Проверяем, что ID не пустой
      if (!id) {
        alert('Ошибка: Пустой ID модификатора');
        return;
      }
      
      const response = await fetch('/api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deleteModifier', id })
      });

      if (response.ok) {
        // Modifier deleted
        // Гарантированно перезагружаем список модификаторов
        await loadModifiers();
        notifyPOSMenuUpdate() // Уведомляем POS
      } else {
        const errorText = await response.text();
        console.error('Ошибка удаления модификатора, статус:', response.status, errorText);
        try {
          const errorData = JSON.parse(errorText);
          alert(`Ошибка удаления модификатора: ${errorData.error || 'Неизвестная ошибка'}`);
        } catch {
          alert('Ошибка удаления модификатора: ' + errorText);
        }
      }
    } catch (error) {
      console.error('Ошибка удаления модификатора:', error);
      alert('Ошибка сети при удалении модификатора');
    }
  };

  const addOption = () => {
    setNewModifier({
      ...newModifier,
      options: [...newModifier.options, { id: '', name_lt: '', name_uk: '', price: 0 }]
    })
  }

  const removeOption = (index: number) => {
    const newOptions = [...newModifier.options]
    newOptions.splice(index, 1)
    setNewModifier({ ...newModifier, options: newOptions })
  }

  const updateOption = (index: number, field: string, value: string | number) => {
    const newOptions = [...newModifier.options]
    newOptions[index] = { ...newOptions[index], [field]: value }
    setNewModifier({ ...newModifier, options: newOptions })
  }

  const handleOptionKeyPress = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter' && index === newModifier.options.length - 1) {
      e.preventDefault()
      addOption()
    }
  }

  const addEditOption = () => {
    if (editingModifier) {
      setEditingModifier({
        ...editingModifier,
        options: [...editingModifier.options, { id: '', name_lt: '', name_uk: '', price: 0 }]
      })
    }
  }

  const removeEditOption = (index: number) => {
    if (editingModifier) {
      const newOptions = [...editingModifier.options]
      newOptions.splice(index, 1)
      setEditingModifier({ ...editingModifier, options: newOptions })
    }
  }

  const updateEditOption = (index: number, field: string, value: string | number) => {
    if (editingModifier) {
      const newOptions = [...editingModifier.options]
      newOptions[index] = { ...newOptions[index], [field]: value }
      setEditingModifier({ ...editingModifier, options: newOptions })
    }
  }

  // Группировка модификаторов по типу
  const groupedModifiers = modifiers.reduce((acc, modifier) => {
    const type = modifier.type || 'addon'
    if (!acc[type]) {
      acc[type] = []
    }
    acc[type].push(modifier)
    return acc
  }, {} as Record<string, Modifier[]>)

  const getTypeName = (type: string) => {
    // Очистка типа от лишних символов и цифр в конце
    const cleanType = String(type || '').trim().toLowerCase().replace(/\d+$/, '')
    
    switch (cleanType) {
      case 'size': return '📏 Розміри'
      case 'sauce': return '🧴 Соуси'
      case 'addon': return '🧩 Добавки'
      case 'topping': return '🍕 Топінги'
      case 'drink': return '🥤 Напої'
      case 'extra': return '➕ Додатково'
      default: return `🔧 ${cleanType || type}`
    }
  }

  return (
    <div className="mb-6">
      <Dialog open={isModifierDialogOpen} onOpenChange={setIsModifierDialogOpen}>
        <DialogTrigger asChild>
          <Button className="bg-orange-500 text-black hover:bg-orange-600 mb-4 h-12 text-lg w-full">
            <Plus className="w-5 h-5 mr-2" />
            Добавить модификатор
          </Button>
        </DialogTrigger>
        <DialogContent className="bg-black border-orange-500 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-orange-500">Новый модификатор</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="new-name_lt" className="text-orange-300">Название (LT)</Label>
                <Input
                  id="new-name_lt"
                  value={newModifier.name_lt}
                  onChange={(e) => setNewModifier({ ...newModifier, name_lt: e.target.value })}
                  className="bg-black border-orange-500 text-orange-500 h-12 text-lg"
                  placeholder="Lietuviškai"
                />
              </div>
              <div>
                <Label htmlFor="new-name_uk" className="text-orange-300">Название (UK)</Label>
                <Input
                  id="new-name_uk"
                  value={newModifier.name_uk}
                  onChange={(e) => setNewModifier({ ...newModifier, name_uk: e.target.value })}
                  className="bg-black border-orange-500 text-orange-500 h-12 text-lg"
                  placeholder="Українською"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="new-type" className="text-orange-300">Тип</Label>
                <Select value={newModifier.type} onValueChange={(value) => setNewModifier({ ...newModifier, type: value, customType: '' })}>
                  <SelectTrigger id="new-type" className="bg-black border-orange-500 text-orange-500 h-12 text-lg">
                    <SelectValue placeholder="Выберите тип" />
                  </SelectTrigger>
                  <SelectContent className="bg-black border-orange-500">
                    <SelectItem value="addon" className="text-orange-500">🧩 Добавки</SelectItem>
                    <SelectItem value="sauce" className="text-orange-500">🧴 Соусы</SelectItem>
                    <SelectItem value="size" className="text-orange-500">📏 Размеры</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="new-custom-type" className="text-orange-300">Или создать новый тип</Label>
                <Input
                  id="new-custom-type"
                  value={newModifier.customType}
                  onChange={(e) => setNewModifier({ ...newModifier, customType: e.target.value })}
                  className="bg-black border-orange-500 text-orange-500 h-12 text-lg"
                  placeholder="Название нового типа"
                />
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="new-required"
                checked={newModifier.required}
                onCheckedChange={(checked) => setNewModifier({ ...newModifier, required: !!checked })}
                className="border-orange-500 data-[state=checked]:bg-orange-500 data-[state=checked]:text-black"
              />
              <Label htmlFor="new-required" className="text-orange-300">Обязательный модификатор</Label>
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-2">
                <div>
                  <Label className="text-orange-300">Опции</Label>
                  <p className="text-xs text-gray-500 mt-1">💡 Нажмите Enter в последнем поле для быстрого добавления</p>
                </div>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={addOption}
                  className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-black h-10"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Добавить опцию
                </Button>
              </div>
              
              <div className="space-y-2 bg-black/30 p-3 rounded border border-orange-500/30">
                {newModifier.options.length === 0 ? (
                  <div className="text-center py-4 text-gray-500">
                    Нет опций. Нажмите кнопку выше для добавления.
                  </div>
                ) : (
                  newModifier.options.map((option, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end bg-gray-900/50 p-2 rounded border border-gray-700">
                      <div className="md:col-span-4">
                        <Label className="text-orange-300 text-xs">Название (LT)</Label>
                        <Input
                          value={option.name_lt}
                          onChange={(e) => updateOption(index, 'name_lt', e.target.value)}
                          onKeyPress={(e) => handleOptionKeyPress(e, index)}
                          className="bg-black border-orange-500 text-orange-500 h-10 text-sm"
                          placeholder="Lietuviškai"
                        />
                      </div>
                      <div className="md:col-span-4">
                        <Label className="text-orange-300 text-xs">Название (UK)</Label>
                        <Input
                          value={option.name_uk}
                          onChange={(e) => updateOption(index, 'name_uk', e.target.value)}
                          onKeyPress={(e) => handleOptionKeyPress(e, index)}
                          className="bg-black border-orange-500 text-orange-500 h-10 text-sm"
                          placeholder="Українською"
                        />
                      </div>
                      <div className="md:col-span-3">
                        <Label className="text-orange-300 text-xs">Цена (€)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={option.price}
                          onChange={(e) => updateOption(index, 'price', parseFloat(e.target.value) || 0)}
                          onKeyPress={(e) => handleOptionKeyPress(e, index)}
                          className="bg-black border-orange-500 text-orange-500 h-10 text-sm"
                        />
                      </div>
                      <div className="md:col-span-1">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => removeOption(index)}
                          className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white h-10 w-full"
                          title="Удалить опцию"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button onClick={createModifier} className="bg-orange-500 text-black hover:bg-orange-600 h-12 flex-1">
                Создать
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setIsModifierDialogOpen(false)} 
                className="border-orange-500 text-orange-500 h-12 flex-1"
              >
                Отмена
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      <Card className="bg-gray-900 border-orange-500">
        <CardHeader>
          <CardTitle className="text-orange-500 flex items-center justify-between">
            <span>Модификаторы</span>
            <Badge variant="secondary" className="bg-orange-500 text-black">
              {modifiers.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(groupedModifiers).length > 0 ? (
            <div className="space-y-4">
              {Object.entries(groupedModifiers).map(([groupName, mods]) => (
                <div key={groupName} className="border border-gray-700 rounded-lg p-3">
                  <h3 className="text-lg font-semibold text-orange-500 mb-2 flex items-center">
                    {groupName}
                    <Badge variant="secondary" className="ml-2 bg-gray-700 text-orange-300">
                      {mods.length}
                    </Badge>
                  </h3>
                  <div className="space-y-3">
                    {mods.map((modifier) => (
                      <div key={modifier.id} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border-2 border-gray-600 hover:border-orange-500/50 transition-colors">
                        <div className="flex-1">
                          <div className="font-medium text-orange-500">{modifier.name_uk}</div>
                          {modifier.group_name && (
                            <div className="text-sm text-gray-400">Группа: {modifier.group_name}</div>
                          )}
                          <div className="text-sm text-gray-400">
                            Тип: {getTypeName(modifier.type || 'addon')}
                            {modifier.required ? <span className="ml-2 text-orange-400">● Обов&apos;язковий</span> : null}
                          </div>
                          {modifier.options && modifier.options.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {modifier.options.map((option, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <Badge variant="secondary" className="text-xs bg-gray-700 text-gray-300">
                                    {option.name_uk} {option.price > 0 ? `+€${option.price.toFixed(2)}` : ''}
                                  </Badge>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => openIngredientManager(option, modifier.name_uk)}
                                    className="h-6 px-2 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                                    title="Управление ингредиентами"
                                  >
                                    <Package className="w-3 h-3 mr-1" />
                                    Ингредиенты
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1 ml-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingModifier(modifier)
                              setIsEditModifierDialogOpen(true)
                            }}
                            className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-black h-9 w-9 p-0"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deleteModifier(modifier.id)}
                            className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white h-9 w-9 p-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500">
              <p>Нет модификаторов</p>
              <p className="text-sm mt-1">Нажмите &quot;Добавить модификатор&quot; чтобы создать первый</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Диалог редактирования модификатора */}
      <Dialog open={isEditModifierDialogOpen} onOpenChange={setIsEditModifierDialogOpen}>
        <DialogContent className="bg-black border-orange-500 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-orange-500">Редактировать модификатор</DialogTitle>
          </DialogHeader>
          {editingModifier && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-name_lt" className="text-orange-300">Название (LT)</Label>
                  <Input
                    id="edit-name_lt"
                    value={editingModifier.name_lt}
                    onChange={(e) => setEditingModifier({ ...editingModifier, name_lt: e.target.value })}
                    className="bg-black border-orange-500 text-orange-500 h-12 text-lg"
                    placeholder="Lietuviškai"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-name_uk" className="text-orange-300">Название (UK)</Label>
                  <Input
                    id="edit-name_uk"
                    value={editingModifier.name_uk}
                    onChange={(e) => setEditingModifier({ ...editingModifier, name_uk: e.target.value })}
                    className="bg-black border-orange-500 text-orange-500 h-12 text-lg"
                    placeholder="Українською"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="edit-type" className="text-orange-300">Тип</Label>
                <Select 
                  value={editingModifier.type || 'addon'} 
                  onValueChange={(value) => setEditingModifier({ ...editingModifier, type: value })}
                >
                  <SelectTrigger id="edit-type" className="bg-black border-orange-500 text-orange-500 h-12 text-lg">
                    <SelectValue placeholder="Выберите тип" />
                  </SelectTrigger>
                  <SelectContent className="bg-black border-orange-500">
                    <SelectItem value="addon" className="text-orange-500">🧩 Добавки</SelectItem>
                    <SelectItem value="sauce" className="text-orange-500">🧴 Соусы</SelectItem>
                    <SelectItem value="size" className="text-orange-500">📏 Размеры</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="edit-required"
                  checked={editingModifier.required}
                  onCheckedChange={(checked) => setEditingModifier({ ...editingModifier, required: !!checked })}
                  className="border-orange-500 data-[state=checked]:bg-orange-500 data-[state=checked]:text-black"
                />
                <Label htmlFor="edit-required" className="text-orange-300">Обязательный модификатор</Label>
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label className="text-orange-300">Опции</Label>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={addEditOption}
                    className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-black h-10"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Добавить опцию
                  </Button>
                </div>
                
                <div className="space-y-3">
                  {editingModifier.options.map((option, index) => (
                    <div key={index} className="space-y-2">
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
                        <div className="md:col-span-4">
                          <Label className="text-orange-300 text-sm">Название (LT)</Label>
                          <Input
                            value={option.name_lt}
                            onChange={(e) => updateEditOption(index, 'name_lt', e.target.value)}
                            className="bg-black border-orange-500 text-orange-500 h-10"
                            placeholder="Lietuviškai"
                          />
                        </div>
                        <div className="md:col-span-4">
                          <Label className="text-orange-300 text-sm">Название (UK)</Label>
                          <Input
                            value={option.name_uk}
                            onChange={(e) => updateEditOption(index, 'name_uk', e.target.value)}
                            className="bg-black border-orange-500 text-orange-500 h-10"
                            placeholder="Українською"
                          />
                        </div>
                        <div className="md:col-span-3">
                          <Label className="text-orange-300 text-sm">Цена (€)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={option.price}
                            onChange={(e) => updateEditOption(index, 'price', parseFloat(e.target.value) || 0)}
                            className="bg-black border-orange-500 text-orange-500 h-10"
                          />
                        </div>
                        <div className="md:col-span-1">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => removeEditOption(index)}
                            className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white h-10 w-full"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      {option.id && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => openIngredientManager(option, editingModifier.name_uk)}
                          className="border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-white h-8 text-xs"
                        >
                          <Package className="w-3 h-3 mr-1" />
                          Управление ингредиентами
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button onClick={updateModifier} className="bg-orange-500 text-black hover:bg-orange-600 h-12 flex-1">
                  Сохранить
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setIsEditModifierDialogOpen(false)} 
                  className="border-orange-500 text-orange-500 h-12 flex-1"
                >
                  Отмена
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Диалог управления ингредиентами модификатора */}
      <ModifierIngredientManager
        isOpen={isIngredientDialogOpen}
        setIsOpen={setIsIngredientDialogOpen}
        modifierOption={selectedOption}
        modifierName={selectedModifierName}
        inventoryItems={inventoryItems as Array<{ id: string; name_lt: string; name_uk: string; unit: string; current_stock: number; cost_per_unit: number }>}
        onSave={() => {
          loadInventoryItems()
        }}
      />
    </div>
  )
}