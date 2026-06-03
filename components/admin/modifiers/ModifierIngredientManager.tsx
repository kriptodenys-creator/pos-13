'use client'

import { useState, useEffect, useMemo, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Trash2, Package, Search } from "lucide-react"

interface InventoryItem {
  id: string
  name_lt: string
  name_uk: string
  unit: string
  current_stock: number
  cost_per_unit: number
}

interface ModifierOptionIngredient {
  id: number
  modifier_option_id: string
  inventory_item_id: string
  quantity: number
  unit: string
  ingredient_name_uk?: string
  ingredient_name_lt?: string
  stock_unit?: string
}

interface ModifierOption {
  id: string
  name_uk: string
  name_lt: string
  price: number
}

interface ModifierIngredientManagerProps {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  modifierOption: ModifierOption | null
  modifierName: string
  inventoryItems: InventoryItem[]
  onSave: () => void
}

export function ModifierIngredientManager({ 
  isOpen,
  setIsOpen,
  modifierOption,
  modifierName,
  inventoryItems,
  onSave
}: ModifierIngredientManagerProps) {
  const [ingredients, setIngredients] = useState<ModifierOptionIngredient[]>([])
  const [newIngredient, setNewIngredient] = useState({
    inventory_item_id: '',
    quantity: 0,
    unit: 'g'
  })
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const loadIngredients = useCallback(async () => {
    if (!modifierOption) return
    
    try {
      const response = await fetch(`/api/modifier-ingredients?modifier_option_id=${modifierOption.id}`)
      if (response.ok) {
        const data = await response.json()
        setIngredients(data.ingredients || [])
      }
    } catch (error) {
      console.error('Ошибка загрузки ингредиентов модификатора:', error)
    }
  }, [modifierOption])

  useEffect(() => {
    if (modifierOption && isOpen) {
      loadIngredients()
    }
  }, [modifierOption, isOpen, loadIngredients])

  const saveIngredients = async () => {
    if (!modifierOption) return
    
    setLoading(true)
    try {
      console.log('Сохранение ингредиентов для опции:', modifierOption.id)
      console.log('Ингредиенты:', ingredients)
      
      const response = await fetch('/api/modifier-ingredients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modifier_option_id: modifierOption.id,
          ingredients: ingredients.map(ing => ({
            inventory_item_id: ing.inventory_item_id,
            quantity: ing.quantity,
            unit: ing.unit || 'g'
          }))
        })
      })

      const data = await response.json()
      console.log('Ответ сервера:', data)

      if (response.ok && data.success) {
        alert('Ингредиенты успешно сохранены!')
        onSave()
        setIsOpen(false)
      } else {
        const errorMsg = data.details || data.error || 'Неизвестная ошибка'
        console.error('Ошибка от сервера:', errorMsg)
        alert(`Ошибка сохранения: ${errorMsg}`)
      }
    } catch (error) {
      console.error('Ошибка сохранения ингредиентов:', error)
      alert(`Ошибка сохранения: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`)
    } finally {
      setLoading(false)
    }
  }

  const addIngredient = () => {
    if (!newIngredient.inventory_item_id || newIngredient.quantity <= 0) {
      alert('Выберите ингредиент и укажите количество')
      return
    }

    const existingIndex = ingredients.findIndex(
      ing => ing.inventory_item_id === newIngredient.inventory_item_id
    )

    if (existingIndex >= 0) {
      const updated = [...ingredients]
      updated[existingIndex].quantity = newIngredient.quantity
      updated[existingIndex].unit = newIngredient.unit
      setIngredients(updated)
    } else {
      const inventoryItem = inventoryItems.find(item => item.id === newIngredient.inventory_item_id)
      setIngredients([
        ...ingredients,
        {
          id: 0,
          modifier_option_id: modifierOption?.id || '',
          inventory_item_id: newIngredient.inventory_item_id,
          quantity: newIngredient.quantity,
          unit: newIngredient.unit,
          ingredient_name_uk: inventoryItem?.name_uk,
          ingredient_name_lt: inventoryItem?.name_lt,
          stock_unit: inventoryItem?.unit
        }
      ])
    }

    setNewIngredient({ inventory_item_id: '', quantity: 0, unit: 'g' })
  }

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index))
  }

  // Фильтрация ингредиентов по поисковому запросу
  const filteredInventoryItems = useMemo(() => {
    if (!searchQuery.trim()) return inventoryItems
    
    const query = searchQuery.toLowerCase()
    return inventoryItems.filter(item => 
      item.name_uk?.toLowerCase().includes(query) ||
      item.name_lt?.toLowerCase().includes(query)
    )
  }, [inventoryItems, searchQuery])

  if (!modifierOption) return null

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="bg-black border-orange-500 max-w-3xl max-h-[85vh] overflow-hidden">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-orange-500 text-base flex items-center gap-2">
            <Package className="w-5 h-5" />
            Ингредиенты: {modifierOption.name_uk}
          </DialogTitle>
          <p className="text-gray-400 text-xs">Модификатор: {modifierName}</p>
        </DialogHeader>

        <div className="space-y-2 overflow-y-auto overflow-x-hidden max-h-[calc(85vh-140px)]">
          <Card className="bg-gray-900 border-gray-700 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-orange-300 text-sm">Добавить ингредиент</CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="space-y-2 min-w-0">
                <div className="relative">
                  <Label htmlFor="search" className="text-orange-300 text-xs">Поиск ингредиента</Label>
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400" />
                    <Input
                      id="search"
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-black border-orange-500 text-orange-500 h-8 pl-8 text-sm"
                      placeholder="Введите название ингредиента..."
                    />
                  </div>
                  {searchQuery && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Найдено: {filteredInventoryItems.length} из {inventoryItems.length}
                    </p>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                  <div className="md:col-span-2">
                    <Label htmlFor="ingredient" className="text-orange-300 text-xs">
                      Ингредиент {searchQuery && `(${filteredInventoryItems.length})`}
                    </Label>
                    <Select 
                      value={newIngredient.inventory_item_id} 
                      onValueChange={(value) => {
                        setNewIngredient({ ...newIngredient, inventory_item_id: value })
                        setSearchQuery('')
                      }}
                    >
                      <SelectTrigger id="ingredient" className="bg-black border-orange-500 text-orange-500 h-8 text-sm">
                        <SelectValue placeholder={searchQuery ? `Найдено: ${filteredInventoryItems.length}` : "Выберите ингредиент"} />
                      </SelectTrigger>
                      <SelectContent className="bg-black border-orange-500 max-h-[200px]">
                        {filteredInventoryItems.length === 0 ? (
                          <div className="text-center py-2 text-gray-400 text-sm">
                            {searchQuery ? `Ничего не найдено по запросу "${searchQuery}"` : 'Нет ингредиентов'}
                          </div>
                        ) : (
                          filteredInventoryItems.map((item) => (
                            <SelectItem key={item.id} value={item.id} className="text-orange-500 text-sm">
                              {item.name_uk} ({item.unit}) - {item.current_stock}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                <div>
                  <Label htmlFor="quantity" className="text-orange-300 text-xs">Кількість</Label>
                  <Input
                    id="quantity"
                    type="number"
                    step="0.01"
                    min="0"
                    value={newIngredient.quantity || ''}
                    onChange={(e) => setNewIngredient({ ...newIngredient, quantity: Number(e.target.value) })}
                    className="bg-black border-orange-500 text-orange-500 h-10 text-base font-semibold text-center"
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label htmlFor="unit" className="text-orange-300 text-xs">Одиниця</Label>
                  <Select 
                    value={newIngredient.unit} 
                    onValueChange={(value) => setNewIngredient({ ...newIngredient, unit: value })}
                  >
                    <SelectTrigger id="unit" className="bg-black border-orange-500 text-orange-500 h-10 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-black border-orange-500">
                      <SelectItem value="g" className="text-orange-500 text-sm">г</SelectItem>
                      <SelectItem value="kg" className="text-orange-500 text-sm">кг</SelectItem>
                      <SelectItem value="ml" className="text-orange-500 text-sm">мл</SelectItem>
                      <SelectItem value="l" className="text-orange-500 text-sm">л</SelectItem>
                      <SelectItem value="pcs" className="text-orange-500 text-sm">шт</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button 
                    onClick={addIngredient} 
                    className="bg-orange-500 text-black hover:bg-orange-600 h-8 w-full"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-orange-300 text-sm">
                Состав ({ingredients.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              {ingredients.length === 0 ? (
                <p className="text-gray-400 text-center py-2 text-sm">Ингредиенты не добавлены</p>
              ) : (
                <div className="space-y-1">
                  {ingredients.map((ing, index) => {
                    const inventoryItem = inventoryItems.find(item => item.id === ing.inventory_item_id)
                    const name = ing.ingredient_name_uk || inventoryItem?.name_uk || 'Неизвестный'
                    const stockUnit = ing.stock_unit || inventoryItem?.unit || ''
                    
                    const getUnitName = (unit: string) => {
                      switch(unit) {
                        case 'g': return 'г'
                        case 'kg': return 'кг'
                        case 'ml': return 'мл'
                        case 'l': return 'л'
                        case 'pcs': return 'шт'
                        default: return unit
                      }
                    }
                    
                    return (
                      <div key={index} className="flex items-center justify-between bg-gray-800 rounded p-2 gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="truncate text-orange-300 font-medium text-sm">{name}</div>
                          <div className="text-gray-400 text-sm whitespace-nowrap">
                            {ing.quantity} {getUnitName(ing.unit)}
                            {stockUnit && stockUnit !== ing.unit && (
                              <span className="text-blue-400 ml-1 text-xs">
                                (склад: {stockUnit})
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => removeIngredient(index)}
                          className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white h-7 w-7 p-0 flex-shrink-0"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-2 pt-1 sticky bottom-0 bg-black">
            <Button 
              variant="outline" 
              onClick={() => setIsOpen(false)} 
              className="border-gray-500 text-gray-300 hover:bg-gray-700 h-8 text-sm flex-1"
              disabled={loading}
            >
              Отмена
            </Button>
            <Button 
              onClick={saveIngredients} 
              className="bg-orange-500 text-black hover:bg-orange-600 h-8 text-sm flex-1"
              disabled={loading}
            >
              {loading ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
