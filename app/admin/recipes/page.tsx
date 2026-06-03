'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import AdminProtection from '@/components/AdminProtection'
import { ArrowLeft, Plus, RefreshCw, Trash2, Save, ChefHat, Search, Package } from 'lucide-react'

type MenuItem = {
  id: string
  name_uk: string
  name_lt: string
  price: number
  category: string
}

type Category = {
  id: string
  name_uk: string
  name_lt: string
}

type InventoryItem = {
  id: string
  name_uk: string
  name_lt: string
  unit: string
  current_stock: number
  cost_per_unit: number
  unit_weight?: number
}

type RecipeIngredient = {
  id?: string
  inventory_item_id: string
  ingredient_name_uk?: string
  ingredient_name_lt?: string
  unit?: string
  recipe_unit?: string
  quantity: number
  cost_per_unit?: number
  unit_weight?: number
}

const RECIPE_UNITS = [
  { value: 'g', label: 'г' },
  { value: 'kg', label: 'кг' },
  { value: 'ml', label: 'мл' },
  { value: 'l', label: 'л' },
  { value: 'pcs', label: 'шт' },
]

type Recipe = {
  id: string
  menu_item_id: string
  menu_item_name_uk: string
  menu_item_name_lt: string
  menu_item_price: number
  ingredients: RecipeIngredient[]
  totalCost: number
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

export default function AdminRecipesPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  // Диалог редактирования рецепта
  const [showRecipeDialog, setShowRecipeDialog] = useState(false)
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItem | null>(null)
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredient[]>([])

  // Загрузка данных
  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Загружаем меню з категоріями
      const menuData = await api<{ menu: MenuItem[], categories?: Category[] }>('/api/menu?includeAll=1&listCategories=1')
      setMenuItems(menuData.menu || [])
      setCategories(menuData.categories || [])

      // Загружаем склад
      const inventoryData = await api<{ items: InventoryItem[] }>('/api/inventory')
      setInventoryItems(inventoryData.items || [])

      // Загружаем рецепты
      const recipesData = await api<{ recipes: Recipe[] }>('/api/recipes')
      setRecipes(recipesData.recipes || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Открыть диалог редактирования рецепта
  const openRecipeDialog = async (menuItem: MenuItem) => {
    setSelectedMenuItem(menuItem)
    setError(null)

    try {
      // Загружаем существующий рецепт для этого блюда
      const data = await api<{ recipe: any, ingredients: RecipeIngredient[] }>(
        `/api/recipes?menu_item_id=${menuItem.id}`
      )
      
      if (data.ingredients && data.ingredients.length > 0) {
        setRecipeIngredients(data.ingredients.map(ing => ({
          inventory_item_id: ing.inventory_item_id,
          ingredient_name_uk: ing.ingredient_name_uk,
          ingredient_name_lt: ing.ingredient_name_lt,
          unit: ing.unit,
          quantity: ing.quantity,
          cost_per_unit: ing.cost_per_unit
        })))
      } else {
        setRecipeIngredients([])
      }
    } catch (e) {
      setRecipeIngredients([])
    }

    setShowRecipeDialog(true)
  }

  // Добавить ингредиент в рецепт
  const addIngredient = () => {
    setRecipeIngredients([...recipeIngredients, { inventory_item_id: '', quantity: 0, recipe_unit: 'g' }])
  }

  // Удалить ингредиент из рецепта
  const removeIngredient = (index: number) => {
    setRecipeIngredients(recipeIngredients.filter((_, i) => i !== index))
  }

  // Обновить ингредиент
  const updateIngredient = (index: number, field: string, value: any) => {
    const updated = [...recipeIngredients]
    if (field === 'inventory_item_id') {
      const item = inventoryItems.find(i => i.id === value)
      // Визначаємо одиницю за замовчуванням для рецепту
      let defaultRecipeUnit = 'g'
      if (item?.unit === 'l' || item?.unit === 'ml') {
        defaultRecipeUnit = 'ml'
      } else if (item?.unit === 'pcs') {
        defaultRecipeUnit = 'pcs'
      }
      updated[index] = {
        ...updated[index],
        inventory_item_id: value,
        ingredient_name_uk: item?.name_uk,
        ingredient_name_lt: item?.name_lt,
        unit: item?.unit,
        unit_weight: item?.unit_weight,
        cost_per_unit: item?.cost_per_unit,
        recipe_unit: defaultRecipeUnit
      }
    } else {
      (updated[index] as any)[field] = value
    }
    setRecipeIngredients(updated)
  }

  // Розрахунок вартості інгредієнта з урахуванням конвертації одиниць
  const calculateIngredientCost = (ing: RecipeIngredient, item: InventoryItem | undefined) => {
    if (!item || !ing.quantity) return 0
    
    const recipeUnit = ing.recipe_unit || ing.unit || 'g'
    const stockUnit = item.unit
    const unitWeight = item.unit_weight || 0
    
    // Конвертуємо кількість в рецепті до одиниці на складі
    let quantityInStockUnit = ing.quantity
    
    // Якщо товар на складі в шт/уп і є вага одиниці
    if ((stockUnit === 'pcs' || stockUnit === 'pack') && unitWeight > 0) {
      if (recipeUnit === 'g') {
        // г -> шт: кількість в грамах / (вага одиниці в кг * 1000)
        quantityInStockUnit = ing.quantity / (unitWeight * 1000)
      } else if (recipeUnit === 'kg') {
        // кг -> шт: кількість в кг / вага одиниці в кг
        quantityInStockUnit = ing.quantity / unitWeight
      }
    } else {
      // Звичайна конвертація
      if (stockUnit === 'kg' && recipeUnit === 'g') {
        quantityInStockUnit = ing.quantity / 1000
      } else if (stockUnit === 'g' && recipeUnit === 'kg') {
        quantityInStockUnit = ing.quantity * 1000
      } else if (stockUnit === 'l' && recipeUnit === 'ml') {
        quantityInStockUnit = ing.quantity / 1000
      } else if (stockUnit === 'ml' && recipeUnit === 'l') {
        quantityInStockUnit = ing.quantity * 1000
      }
    }
    
    return quantityInStockUnit * item.cost_per_unit
  }

  // Сохранить рецепт
  const saveRecipe = async () => {
    if (!selectedMenuItem) return
    setError(null)

    // Фильтруем пустые ингредиенты
    const validIngredients = recipeIngredients.filter(
      ing => ing.inventory_item_id && ing.quantity > 0
    )

    try {
      await api('/api/recipes', {
        method: 'POST',
        body: JSON.stringify({
          menu_item_id: selectedMenuItem.id,
          ingredients: validIngredients
        })
      })

      setShowRecipeDialog(false)
      setSelectedMenuItem(null)
      setRecipeIngredients([])
      loadData()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  // Удалить рецепт
  const deleteRecipe = async (menuItemId: string) => {
    if (!confirm('Видалити рецепт для цієї страви?')) return
    setError(null)

    try {
      await api(`/api/recipes?menu_item_id=${menuItemId}`, { method: 'DELETE' })
      loadData()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  // Расчет себестоимости рецепта
  const calculateRecipeCost = () => {
    return recipeIngredients.reduce((sum, ing) => {
      const item = inventoryItems.find(i => i.id === ing.inventory_item_id)
      return sum + calculateIngredientCost(ing, item)
    }, 0)
  }

  // Фильтрация блюд по категорії та пошуку
  const filteredMenuItems = menuItems.filter(item => {
    const matchesSearch = item.name_uk.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.name_lt.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  // Отримати унікальні категорії з меню
  const uniqueCategories = Array.from(new Set(menuItems.map(item => item.category).filter(Boolean)))

  // Проверка наличия рецепта
  const hasRecipe = (menuItemId: string) => {
    return recipes.some(r => r.menu_item_id === menuItemId)
  }

  // Получить рецепт для блюда
  const getRecipe = (menuItemId: string) => {
    return recipes.find(r => r.menu_item_id === menuItemId)
  }

  const getUnitLabel = (unit: string) => {
    const units: Record<string, string> = {
      kg: 'кг', g: 'г', l: 'л', ml: 'мл', pcs: 'шт', pack: 'уп'
    }
    return units[unit] || unit
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
                <ChefHat className="w-6 h-6" />
                Рецепти страв
              </h1>
            </div>
            <Button variant="outline" onClick={loadData} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Оновити
            </Button>
          </div>

          {/* Info */}
          <Card className="mb-6 bg-blue-50 border-blue-200">
            <CardContent className="p-4">
              <p className="text-blue-800">
                <strong>Як це працює:</strong> Додайте рецепт до страви, вказавши інгредієнти зі складу. 
                При продажу страви інгредієнти автоматично списуються зі складу.
              </p>
            </CardContent>
          </Card>

          {/* Error */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {/* Search and Category Filter */}
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Пошук страви..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Всі категорії" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Всі категорії</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name_uk}
                  </SelectItem>
                ))}
                {uniqueCategories.filter(c => !categories.find(cat => cat.id === c)).map((catId) => (
                  <SelectItem key={catId} value={catId}>
                    {catId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Category Tabs */}
          <div className="flex flex-wrap gap-2 mb-4">
            <Button
              size="sm"
              variant={selectedCategory === 'all' ? 'default' : 'outline'}
              onClick={() => setSelectedCategory('all')}
            >
              Всі ({menuItems.length})
            </Button>
            {categories.map((cat) => {
              const count = menuItems.filter(item => item.category === cat.id).length
              if (count === 0) return null
              return (
                <Button
                  key={cat.id}
                  size="sm"
                  variant={selectedCategory === cat.id ? 'default' : 'outline'}
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  {cat.name_uk} ({count})
                </Button>
              )
            })}
          </div>

          {/* Menu Items Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMenuItems.map((item) => {
              const recipe = getRecipe(item.id)
              const hasRec = !!recipe

              return (
                <Card key={item.id} className={hasRec ? 'border-green-300 bg-green-50' : ''}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{item.name_uk}</CardTitle>
                        {item.name_lt !== item.name_uk && (
                          <p className="text-sm text-gray-500">{item.name_lt}</p>
                        )}
                      </div>
                      <Badge variant={hasRec ? 'default' : 'secondary'}>
                        {hasRec ? 'Є рецепт' : 'Без рецепту'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Ціна продажу:</span>
                        <span className="font-medium">€{item.price.toFixed(2)}</span>
                      </div>
                      
                      {recipe && (
                        <>
                          <div className="flex justify-between text-sm">
                            <span>Собівартість:</span>
                            <span className="font-medium text-orange-600">
                              €{recipe.totalCost.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Прибуток:</span>
                            <span className="font-medium text-green-600">
                              €{(item.price - recipe.totalCost).toFixed(2)} 
                              ({((item.price - recipe.totalCost) / item.price * 100).toFixed(0)}%)
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 mt-2">
                            Інгредієнтів: {recipe.ingredients.length}
                          </div>
                        </>
                      )}

                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          variant={hasRec ? 'outline' : 'default'}
                          className="flex-1"
                          onClick={() => openRecipeDialog(item)}
                        >
                          <ChefHat className="w-4 h-4 mr-1" />
                          {hasRec ? 'Редагувати' : 'Додати рецепт'}
                        </Button>
                        {hasRec && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600"
                            onClick={() => deleteRecipe(item.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}

            {filteredMenuItems.length === 0 && (
              <div className="col-span-full text-center py-8 text-gray-500">
                {loading ? 'Завантаження...' : 'Страви не знайдено'}
              </div>
            )}
          </div>
        </div>

        {/* Recipe Edit Dialog */}
        <Dialog open={showRecipeDialog} onOpenChange={setShowRecipeDialog}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ChefHat className="w-5 h-5" />
                Рецепт: {selectedMenuItem?.name_uk}
              </DialogTitle>
            </DialogHeader>

            {selectedMenuItem && (
              <div className="space-y-4">
                {/* Інформація про страву */}
                <div className="p-3 bg-gray-100 rounded">
                  <div className="flex justify-between">
                    <span>Ціна продажу:</span>
                    <span className="font-bold">€{selectedMenuItem.price.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-orange-600">
                    <span>Собівартість:</span>
                    <span className="font-bold">€{calculateRecipeCost().toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-green-600">
                    <span>Прибуток:</span>
                    <span className="font-bold">
                      €{(selectedMenuItem.price - calculateRecipeCost()).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Список інгредієнтів */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-base font-medium">Інгредієнти</Label>
                    <Button size="sm" variant="outline" onClick={addIngredient}>
                      <Plus className="w-4 h-4 mr-1" />
                      Додати
                    </Button>
                  </div>

                  {recipeIngredients.length === 0 ? (
                    <div className="text-center py-4 text-gray-500 border rounded">
                      Немає інгредієнтів. Натисніть "Додати" щоб додати.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {recipeIngredients.map((ing, index) => {
                        const item = inventoryItems.find(i => i.id === ing.inventory_item_id)
                        return (
                          <div key={index} className="flex items-center gap-2 p-2 border rounded">
                            <div className="flex-1">
                              <Select
                                value={ing.inventory_item_id}
                                onValueChange={(v) => updateIngredient(index, 'inventory_item_id', v)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Оберіть інгредієнт" />
                                </SelectTrigger>
                                <SelectContent>
                                  {inventoryItems.map((inv) => (
                                    <SelectItem key={inv.id} value={inv.id}>
                                      {inv.name_uk} ({getUnitLabel(inv.unit)})
                                      {inv.unit_weight ? ` [${inv.unit_weight}кг]` : ''}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="w-20">
                              <Input
                                type="number"
                                step="0.001"
                                min="0"
                                placeholder="К-сть"
                                value={ing.quantity || ''}
                                onChange={(e) => updateIngredient(index, 'quantity', parseFloat(e.target.value) || 0)}
                              />
                            </div>
                            <div className="w-16">
                              <Select
                                value={ing.recipe_unit || 'g'}
                                onValueChange={(v) => updateIngredient(index, 'recipe_unit', v)}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {RECIPE_UNITS.map((u) => (
                                    <SelectItem key={u.value} value={u.value}>
                                      {u.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="w-20 text-right text-sm">
                              {item && ing.quantity > 0 && (
                                <span className="text-orange-600">
                                  €{calculateIngredientCost(ing, item).toFixed(2)}
                                </span>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600"
                              onClick={() => removeIngredient(index)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Кнопки */}
                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={() => setShowRecipeDialog(false)}>
                    Скасувати
                  </Button>
                  <Button onClick={saveRecipe}>
                    <Save className="w-4 h-4 mr-2" />
                    Зберегти рецепт
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminProtection>
  )
}
