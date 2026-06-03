'use client'

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Trash2, Factory, Package, AlertCircle, CheckCircle, Search } from "lucide-react"

interface InventoryItem {
  id: string
  name_lt: string
  name_uk: string
  unit: string
  current_stock: number
  unit_weight?: number
}

interface ProductionRecipe {
  id: number
  output_item_id: string
  output_quantity: number
  output_name_uk: string
  output_name_lt: string
  output_unit: string
  output_current_stock: number
}

interface RecipeIngredient {
  id?: number
  inventory_item_id: string
  quantity: number
  unit: string
  ingredient_name_uk?: string
  stock_unit?: string
}

interface ProductionManagerProps {
  inventoryItems: InventoryItem[]
  onProductionComplete?: () => void
}

export function ProductionManager({ inventoryItems, onProductionComplete }: ProductionManagerProps) {
  const [recipes, setRecipes] = useState<ProductionRecipe[]>([])
  const [selectedRecipe, setSelectedRecipe] = useState<ProductionRecipe | null>(null)
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredient[]>([])
  const [isRecipeDialogOpen, setIsRecipeDialogOpen] = useState(false)
  const [isProductionDialogOpen, setIsProductionDialogOpen] = useState(false)
  const [batchMultiplier, setBatchMultiplier] = useState(1)
  const [loading, setLoading] = useState(false)

  const [newRecipe, setNewRecipe] = useState({
    output_item_id: '',
    output_quantity: 0,
    ingredients: [] as RecipeIngredient[]
  })

  const [newIngredient, setNewIngredient] = useState({
    inventory_item_id: '',
    quantity: 0,
    unit: 'g'
  })

  const [searchQuery, setSearchQuery] = useState('')

  const filteredInventoryItems = useMemo(() => {
    if (!searchQuery) return inventoryItems
    
    const query = searchQuery.toLowerCase()
    return inventoryItems.filter(item => 
      item.name_uk?.toLowerCase().includes(query) ||
      item.name_lt?.toLowerCase().includes(query)
    )
  }, [inventoryItems, searchQuery])

  useEffect(() => {
    loadRecipes()
  }, [])

  const loadRecipes = async () => {
    try {
      const response = await fetch('/api/production-recipes')
      const data = await response.json()
      if (data.success) {
        setRecipes(data.recipes)
      }
    } catch (error) {
      console.error('Error loading recipes:', error)
    }
  }

  const loadRecipeIngredients = async (recipeId: number) => {
    try {
      const response = await fetch(`/api/production-recipes?recipe_id=${recipeId}`)
      const data = await response.json()
      if (data.success) {
        setRecipeIngredients(data.ingredients)
      }
    } catch (error) {
      console.error('Error loading recipe ingredients:', error)
    }
  }

  const openRecipeDialog = (recipe?: ProductionRecipe) => {
    if (recipe) {
      setSelectedRecipe(recipe)
      setNewRecipe({
        output_item_id: recipe.output_item_id,
        output_quantity: recipe.output_quantity,
        ingredients: []
      })
      loadRecipeIngredients(recipe.id)
    } else {
      setSelectedRecipe(null)
      setNewRecipe({
        output_item_id: '',
        output_quantity: 0,
        ingredients: []
      })
      setRecipeIngredients([])
    }
    setIsRecipeDialogOpen(true)
  }

  const addIngredient = () => {
    if (!newIngredient.inventory_item_id) {
      alert('Выберите ингредиент')
      return
    }
    
    if (newIngredient.quantity <= 0) {
      alert('Укажите количество больше 0')
      return
    }

    setRecipeIngredients([...recipeIngredients, { ...newIngredient }])
    setNewIngredient({ inventory_item_id: '', quantity: 0, unit: 'g' })
  }

  const removeIngredient = (index: number) => {
    setRecipeIngredients(recipeIngredients.filter((_, i) => i !== index))
  }

  const saveRecipe = async () => {
    if (!newRecipe.output_item_id || newRecipe.output_quantity <= 0 || recipeIngredients.length === 0) {
      alert('Заполните все поля и добавьте хотя бы один ингредиент')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/production-recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipe_id: selectedRecipe?.id,
          output_item_id: newRecipe.output_item_id,
          output_quantity: newRecipe.output_quantity,
          ingredients: recipeIngredients
        })
      })

      const data = await response.json()
      if (data.success) {
        await loadRecipes()
        setIsRecipeDialogOpen(false)
      } else {
        alert('Ошибка сохранения рецепта: ' + data.error)
      }
    } catch (error) {
      console.error('Error saving recipe:', error)
      alert('Ошибка сохранения рецепта')
    } finally {
      setLoading(false)
    }
  }

  const deleteRecipe = async (recipeId: number) => {
    if (!confirm('Удалить рецепт производства?')) return

    try {
      const response = await fetch(`/api/production-recipes?recipe_id=${recipeId}`, {
        method: 'DELETE'
      })

      const data = await response.json()
      if (data.success) {
        await loadRecipes()
      }
    } catch (error) {
      console.error('Error deleting recipe:', error)
    }
  }

  const openProductionDialog = (recipe: ProductionRecipe) => {
    setSelectedRecipe(recipe)
    setBatchMultiplier(1)
    loadRecipeIngredients(recipe.id)
    setIsProductionDialogOpen(true)
  }

  const executeProduction = async () => {
    if (!selectedRecipe || batchMultiplier <= 0) return

    setLoading(true)
    try {
      const response = await fetch('/api/production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipe_id: selectedRecipe.id,
          batch_multiplier: batchMultiplier
        })
      })

      const data = await response.json()
      if (data.success) {
        alert(`Произведено: ${data.output.quantity} ${data.output.unit} ${data.output.item}`)
        setIsProductionDialogOpen(false)
        await loadRecipes()
        if (onProductionComplete) {
          onProductionComplete()
        }
      } else {
        if (data.insufficient) {
          const insufficient = Array.isArray(data.insufficient) ? (data.insufficient as unknown[]) : []
          const msg = insufficient
            .map((ing: unknown) => {
              const r = (ing && typeof ing === 'object' ? (ing as Record<string, unknown>) : {})
              const name = typeof r.name === 'string' ? r.name : 'Ингредиент'
              const required = r.required != null ? String(r.required) : '?'
              const available = r.available != null ? String(r.available) : '?'
              const unit = typeof r.unit === 'string' ? r.unit : ''
              return `${name}: требуется ${required} ${unit}, доступно ${available} ${unit}`
            })
            .join('\n')
          alert('Недостаточно ингредиентов:\n' + msg)
        } else {
          alert('Ошибка производства: ' + data.error)
        }
      }
    } catch (error) {
      console.error('Error executing production:', error)
      alert('Ошибка производства')
    } finally {
      setLoading(false)
    }
  }

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
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-orange-500 flex items-center gap-2">
          <Factory className="w-6 h-6" />
          Производство
        </h2>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">
            Товаров на складе: {inventoryItems.length}
          </span>
          <Button 
            onClick={() => openRecipeDialog()}
            className="bg-orange-500 text-black hover:bg-orange-600"
          >
            <Plus className="w-4 h-4 mr-2" />
            Новый рецепт
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {recipes.map((recipe) => (
          <Card key={recipe.id} className="bg-gray-900 border-gray-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-orange-300 text-base flex items-center gap-2">
                <Package className="w-4 h-4" />
                {recipe.output_name_uk}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-sm text-gray-400">
                Выход: <span className="text-orange-400">{recipe.output_quantity} {recipe.output_unit}</span>
              </div>
              <div className="text-sm text-gray-400">
                На складе: <span className="text-blue-400">{recipe.output_current_stock} {recipe.output_unit}</span>
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  onClick={() => openProductionDialog(recipe)}
                  className="bg-green-600 text-white hover:bg-green-700 flex-1"
                >
                  <Factory className="w-3 h-3 mr-1" />
                  Произвести
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openRecipeDialog(recipe)}
                  className="border-orange-500 text-orange-500"
                >
                  Изменить
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => deleteRecipe(recipe.id)}
                  className="border-red-500 text-red-500"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recipe Dialog */}
      <Dialog open={isRecipeDialogOpen} onOpenChange={setIsRecipeDialogOpen}>
        <DialogContent className="bg-black border-orange-500 max-w-3xl max-h-[85vh] overflow-hidden">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-orange-500 text-base">
              {selectedRecipe ? 'Редактировать рецепт' : 'Новый рецепт производства'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 overflow-y-auto overflow-x-hidden max-h-[calc(85vh-140px)]">
            <Card className="bg-gray-900 border-gray-700 overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-orange-300 text-sm">Выходной продукт</CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="grid grid-cols-2 gap-2 min-w-0">
                  <div>
                    <Label className="text-orange-300 text-xs">Продукт</Label>
                    <Select 
                      value={newRecipe.output_item_id}
                      onValueChange={(value) => setNewRecipe({ ...newRecipe, output_item_id: value })}
                    >
                      <SelectTrigger className="bg-black border-orange-500 text-orange-500 h-8 text-sm">
                        <SelectValue placeholder="Выберите продукт" />
                      </SelectTrigger>
                      <SelectContent className="bg-black border-orange-500 max-h-[200px]">
                        {inventoryItems.map((item) => (
                          <SelectItem key={item.id} value={item.id} className="text-orange-500 text-sm">
                            {item.name_uk} ({item.unit})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-orange-300 text-xs">Количество на выходе</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={newRecipe.output_quantity || ''}
                      onChange={(e) => setNewRecipe({ ...newRecipe, output_quantity: Number(e.target.value) })}
                      className="bg-black border-orange-500 text-orange-500 h-8 text-sm"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

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

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                    <div className="md:col-span-2">
                      <Label className="text-orange-300 text-xs">
                        Ингредиент {searchQuery && `(${filteredInventoryItems.length})`}
                      </Label>
                      <Select 
                        value={newIngredient.inventory_item_id}
                        onValueChange={(value) => {
                          setNewIngredient({ ...newIngredient, inventory_item_id: value })
                          setSearchQuery('')
                        }}
                      >
                        <SelectTrigger className="bg-black border-orange-500 text-orange-500 h-8 text-sm">
                          <SelectValue placeholder={searchQuery ? `Найдено: ${filteredInventoryItems.length}` : "Выберите ингредиент"} />
                        </SelectTrigger>
                        <SelectContent className="bg-black border-orange-500 max-h-[200px]" position="popper" sideOffset={5}>
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
                      <Label className="text-orange-300 text-xs">Количество</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={newIngredient.quantity || ''}
                        onChange={(e) => setNewIngredient({ ...newIngredient, quantity: Number(e.target.value) })}
                        className="bg-black border-orange-500 text-orange-500 h-8 text-sm"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <Label className="text-orange-300 text-xs">Единица</Label>
                      <Select 
                        value={newIngredient.unit}
                        onValueChange={(value) => setNewIngredient({ ...newIngredient, unit: value })}
                      >
                        <SelectTrigger className="bg-black border-orange-500 text-orange-500 h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-black border-orange-500" position="popper" sideOffset={5}>
                          <SelectItem value="g" className="text-orange-500 text-sm">г</SelectItem>
                          <SelectItem value="kg" className="text-orange-500 text-sm">кг</SelectItem>
                          <SelectItem value="ml" className="text-orange-500 text-sm">мл</SelectItem>
                          <SelectItem value="l" className="text-orange-500 text-sm">л</SelectItem>
                          <SelectItem value="pcs" className="text-orange-500 text-sm">шт</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button 
                    onClick={addIngredient}
                    className="bg-orange-500 text-black hover:bg-orange-600 h-8 text-sm w-full"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Добавить ингредиент
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-900 border-gray-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-orange-300 text-sm">
                  Состав ({recipeIngredients.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                {recipeIngredients.length === 0 ? (
                  <p className="text-gray-400 text-center py-2 text-sm">Ингредиенты не добавлены</p>
                ) : (
                  <div className="space-y-1">
                    {recipeIngredients.map((ing, index) => {
                      const item = inventoryItems.find(i => i.id === ing.inventory_item_id)
                      const name = ing.ingredient_name_uk || item?.name_uk || 'Неизвестный'
                      const stockUnit = ing.stock_unit || item?.unit || ''
                      
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
                onClick={() => setIsRecipeDialogOpen(false)}
                className="border-gray-500 text-gray-300 hover:bg-gray-700 h-8 text-sm flex-1"
                disabled={loading}
              >
                Отмена
              </Button>
              <Button 
                onClick={saveRecipe}
                className="bg-orange-500 text-black hover:bg-orange-600 h-8 text-sm flex-1"
                disabled={loading}
              >
                {loading ? 'Сохранение...' : 'Сохранить'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Production Dialog */}
      <Dialog open={isProductionDialogOpen} onOpenChange={setIsProductionDialogOpen}>
        <DialogContent className="bg-black border-orange-500 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-orange-500 text-lg flex items-center gap-2">
              <Factory className="w-5 h-5" />
              Производство: {selectedRecipe?.output_name_uk}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-orange-300">Количество партий</Label>
              <Input
                type="number"
                min="1"
                step="1"
                value={batchMultiplier}
                onChange={(e) => setBatchMultiplier(Number(e.target.value))}
                className="bg-black border-orange-500 text-orange-500 h-10 text-lg"
              />
              <p className="text-sm text-gray-400 mt-1">
                Будет произведено: {(selectedRecipe?.output_quantity || 0) * batchMultiplier} {selectedRecipe?.output_unit}
              </p>
            </div>

            <Card className="bg-gray-900 border-gray-700">
              <CardHeader>
                <CardTitle className="text-orange-300 text-base">Требуемые ингредиенты</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {recipeIngredients.map((ing, index) => {
                    const item = inventoryItems.find(i => i.id === ing.inventory_item_id)
                    const name = ing.ingredient_name_uk || item?.name_uk || 'Неизвестный'
                    const required = ing.quantity * batchMultiplier
                    const available = item?.current_stock || 0
                    const sufficient = available >= required
                    
                    return (
                      <div key={index} className="flex items-center justify-between bg-gray-800 rounded p-2">
                        <div className="flex-1">
                          <span className="text-orange-300 text-sm">{name}</span>
                          <div className="text-xs text-gray-400">
                            Требуется: {required} {getUnitName(ing.unit)} | 
                            Доступно: {available} {item?.unit || ''}
                          </div>
                        </div>
                        {sufficient ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-red-500" />
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button 
                variant="outline"
                onClick={() => setIsProductionDialogOpen(false)}
                className="border-gray-500 text-gray-300 hover:bg-gray-700 flex-1"
                disabled={loading}
              >
                Отмена
              </Button>
              <Button 
                onClick={executeProduction}
                className="bg-green-600 text-white hover:bg-green-700 flex-1"
                disabled={loading}
              >
                {loading ? 'Производство...' : 'Произвести'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
