'use client'

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Trash2 } from "lucide-react"

interface InventoryItem {
  id: string
  name_lt: string
  name_uk: string
  unit: string
  current_stock: number
  min_stock: number
  cost_per_unit: number
  image?: string
  available: boolean
  modifiers?: string[]
}

interface RecipeIngredient {
  id?: number
  recipe_id?: number
  inventory_item_id: string
  quantity: number
  inventory_item?: InventoryItem
}

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
}

interface RecipeManagerProps {
  isRecipeDialogOpen: boolean
  setIsRecipeDialogOpen: (open: boolean) => void
  selectedMenuItem: MenuItem | null
  menuItemRecipes: RecipeIngredient[]
  inventoryItems: InventoryItem[]
  loadRecipes: (menuItemId: string) => void
}

export function RecipeManager({ 
  isRecipeDialogOpen,
  setIsRecipeDialogOpen,
  selectedMenuItem,
  menuItemRecipes,
  inventoryItems,
  loadRecipes
}: RecipeManagerProps) {
  const [newRecipe, setNewRecipe] = useState({
    inventory_item_id: '',
    quantity: 0
  })

  const addRecipeIngredient = async () => {
    if (!selectedMenuItem || !newRecipe.inventory_item_id || newRecipe.quantity <= 0) return

    try {
      const allIngredients = [
        ...menuItemRecipes.map(r => ({
          inventory_item_id: r.inventory_item_id,
          quantity: r.quantity
        })),
        {
          inventory_item_id: newRecipe.inventory_item_id,
          quantity: newRecipe.quantity
        }
      ]

      const response = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          menu_item_id: selectedMenuItem.id,
          ingredients: allIngredients
        })
      })

      if (response.ok) {
        await loadRecipes(selectedMenuItem.id)
        setNewRecipe({ inventory_item_id: '', quantity: 0 })
      }
    } catch (error) {
      console.error('Ошибка добавления ингредиента:', error)
    }
  }

  const deleteRecipeIngredient = async (ingredientId: number) => {
    if (!confirm('Удалить ингредиент из рецепта?')) return
    if (!selectedMenuItem) return

    try {
      const remainingIngredients = menuItemRecipes
        .filter(r => r.id !== ingredientId)
        .map(r => ({
          inventory_item_id: r.inventory_item_id,
          quantity: r.quantity
        }))

      const response = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          menu_item_id: selectedMenuItem.id,
          ingredients: remainingIngredients
        })
      })

      if (response.ok) {
        await loadRecipes(selectedMenuItem.id)
      }
    } catch (error) {
      console.error('Ошибка удаления ингредиента:', error)
    }
  }

  return (
    <Dialog open={isRecipeDialogOpen} onOpenChange={setIsRecipeDialogOpen}>
      <DialogContent className="bg-black border-orange-500 max-w-2xl max-h-[85vh] overflow-hidden">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-orange-500 text-lg">
            Рецепт: {typeof selectedMenuItem?.name === 'object' ? selectedMenuItem.name.uk || selectedMenuItem.name.lt : selectedMenuItem?.name || 'Неизвестное блюдо'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 overflow-y-auto overflow-x-hidden max-h-[calc(85vh-120px)]">
          {/* Add new ingredient */}
          <div className="border border-gray-700 rounded p-2 overflow-hidden">
            <h3 className="text-sm font-semibold text-orange-300 mb-2">Добавить ингредиент</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 min-w-0">
              <div>
                <Label htmlFor="recipe-ingredient" className="text-orange-300 text-xs">Ингредиент</Label>
                <Select value={newRecipe.inventory_item_id} onValueChange={(value) => setNewRecipe({ ...newRecipe, inventory_item_id: value })}>
                  <SelectTrigger id="recipe-ingredient" className="bg-black border-orange-500 text-orange-500 h-9 text-sm">
                    <SelectValue placeholder="Выберите ингредиент" />
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
                <Label htmlFor="recipe-quantity" className="text-orange-300 text-xs">Количество</Label>
                <Input
                  id="recipe-quantity"
                  name="recipe-quantity"
                  type="number"
                  step="0.01"
                  value={newRecipe.quantity}
                  onChange={(e) => setNewRecipe({ ...newRecipe, quantity: Number(e.target.value) })}
                  className="bg-black border-orange-500 text-orange-500 h-9 text-sm"
                  placeholder="0.00"
                />
              </div>
              <div className="flex items-end">
                <Button onClick={addRecipeIngredient} className="bg-orange-500 text-black hover:bg-orange-600 h-9 text-sm w-full">
                  <Plus className="w-4 h-4 mr-1" />
                  Добавить
                </Button>
              </div>
            </div>
          </div>

          {/* Current recipe ingredients */}
          <div className="border border-gray-700 rounded p-2">
            <h3 className="text-sm font-semibold text-orange-300 mb-2">Состав рецепта ({menuItemRecipes.length})</h3>
            {menuItemRecipes.length === 0 ? (
              <p className="text-gray-400 text-center py-2 text-sm">Ингредиенты не добавлены</p>
            ) : (
              <div className="space-y-1">
                {menuItemRecipes.map((recipe) => {
                  const ingredient = inventoryItems.find(item => item.id === recipe.inventory_item_id)
                  return (
                    <div key={recipe.id} className="flex items-center justify-between bg-gray-800 rounded p-2 gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="truncate text-orange-300 font-medium text-sm">
                          {ingredient?.name_uk || 'Неизвестный ингредиент'}
                        </div>
                        <span className="text-gray-400 text-sm whitespace-nowrap">
                          {recipe.quantity} {ingredient?.unit}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deleteRecipeIngredient(recipe.id!)}
                        className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white h-8 w-8 p-0 flex-shrink-0"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-1 sticky bottom-0 bg-black">
            <Button variant="outline" onClick={() => setIsRecipeDialogOpen(false)} className="border-orange-500 text-orange-500 h-9 text-sm flex-1">
              Закрыть
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}