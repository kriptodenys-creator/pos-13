'use client'

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Trash2, Edit, ArrowUp, ArrowDown } from "lucide-react"

interface Category {
  id: string
  name_lt: string
  name_uk: string
  order_index?: number
  parent_id?: string | null
}

interface CategoryManagerProps {
  categories: Category[]
  onCategoriesChange: (categories: Category[]) => void
  loadCategories: () => void
  updateCategoriesOrder: (updatedCategories: Category[]) => void
  notifyPOSMenuUpdate: () => void
}

export function CategoryManager({ 
  categories, 
  onCategoriesChange, 
  loadCategories, 
  updateCategoriesOrder,
  notifyPOSMenuUpdate
}: CategoryManagerProps) {
  const NO_PARENT_VALUE = '__no_parent__'
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false)
  const [isEditCategoryDialogOpen, setIsEditCategoryDialogOpen] = useState(false)
  const [newCategory, setNewCategory] = useState({ name_lt: '', name_uk: '', parent_id: '' })
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)

  const parentCandidates = categories.filter((c) => !c.parent_id)

  const createCategory = async () => {
    if (!newCategory.name_lt.trim() || !newCategory.name_uk.trim()) return

    try {
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name_lt: newCategory.name_lt.trim(),
          name_uk: newCategory.name_uk.trim(),
          parent_id: newCategory.parent_id ? newCategory.parent_id : null
        })
      })

      if (response.ok) {
        await loadCategories()
        setIsCategoryDialogOpen(false)
        setNewCategory({ name_lt: '', name_uk: '', parent_id: '' })
        notifyPOSMenuUpdate() // Уведомляем POS
      } else {
        const err: unknown = await response.json().catch(() => null)
        const errObj = (err && typeof err === 'object' ? (err as Record<string, unknown>) : null)
        const errorMsg = errObj?.error != null ? String(errObj.error) : String(response.status)
        alert(`Ошибка создания категории: ${errorMsg}`)
      }
    } catch (error) {
      console.error('Ошибка создания категории:', error)
      alert('Ошибка сети при создании категории')
    }
  }

  const updateCategory = async () => {
    if (!editingCategory || !editingCategory.name_lt.trim() || !editingCategory.name_uk.trim()) return

    try {
      const response = await fetch('/api/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingCategory)
      })

      if (response.ok) {
        await loadCategories()
        setIsEditCategoryDialogOpen(false)
        setEditingCategory(null)
        notifyPOSMenuUpdate() // Уведомляем POS
      } else {
        const err: unknown = await response.json().catch(() => null)
        const errObj = (err && typeof err === 'object' ? (err as Record<string, unknown>) : null)
        const errorMsg = errObj?.error != null ? String(errObj.error) : String(response.status)
        alert(`Ошибка сохранения категории: ${errorMsg}`)
      }
    } catch (error) {
      console.error('Ошибка обновления категории:', error)
      alert('Ошибка сети при сохранении категории')
    }
  }

  const deleteCategory = async (id: string) => {
    if (!confirm('Удалить категорию?')) return

    try {
      const response = await fetch(`/api/categories?id=${encodeURIComponent(id)}`, { method: 'DELETE' })

      if (response.ok) {
        await loadCategories()
        notifyPOSMenuUpdate() // Уведомляем POS
      } else {
        const err: unknown = await response.json().catch(() => null)
        const errObj = (err && typeof err === 'object' ? (err as Record<string, unknown>) : null)
        const errorMsg = errObj?.error != null ? String(errObj.error) : String(response.status)
        alert(`Ошибка удаления категории: ${errorMsg}`)
      }
    } catch (error) {
      console.error('Ошибка удаления категории:', error)
      alert('Ошибка сети при удалении категории')
    }
  }

  const moveCategoryUp = async (index: number) => {
    const currentParent = categories[index]?.parent_id ?? null
    const prevIndex = (() => {
      for (let i = index - 1; i >= 0; i--) {
        if ((categories[i]?.parent_id ?? null) === currentParent) return i
        if ((categories[i]?.parent_id ?? null) !== currentParent) {
          // дошли до другой группы
          continue
        }
      }
      return -1
    })()
    if (prevIndex === -1) return
    
    const newCategories = [...categories]
    const temp = newCategories[index]
    newCategories[index] = newCategories[prevIndex]
    newCategories[prevIndex] = temp
    
    // Обновляем order_index
    const updatedCategories = newCategories.map((cat, idx) => ({
      ...cat,
      order_index: idx
    }))
    
    onCategoriesChange(updatedCategories)
    await updateCategoriesOrder(updatedCategories)
  }

  const moveCategoryDown = async (index: number) => {
    const currentParent = categories[index]?.parent_id ?? null
    const nextIndex = (() => {
      for (let i = index + 1; i < categories.length; i++) {
        if ((categories[i]?.parent_id ?? null) === currentParent) return i
        if ((categories[i]?.parent_id ?? null) !== currentParent) {
          // дошли до другой группы
          continue
        }
      }
      return -1
    })()
    if (nextIndex === -1) return
    
    const newCategories = [...categories]
    const temp = newCategories[index]
    newCategories[index] = newCategories[nextIndex]
    newCategories[nextIndex] = temp
    
    // Обновляем order_index
    const updatedCategories = newCategories.map((cat, idx) => ({
      ...cat,
      order_index: idx
    }))
    
    onCategoriesChange(updatedCategories)
    await updateCategoriesOrder(updatedCategories)
  }

  return (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-orange-500">Категории</h2>
        <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-orange-500 text-black hover:bg-orange-600 text-xs sm:text-sm h-10 sm:h-12 px-3 sm:px-4">
              <Plus className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Добавить </span>категорию
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-black border-orange-500 max-w-md">
            <DialogHeader>
              <DialogTitle className="text-orange-500">Новая категория</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name_lt" className="text-orange-300">Название (LT)</Label>
                <Input
                  id="name_lt"
                  value={newCategory.name_lt}
                  onChange={(e) => setNewCategory({ ...newCategory, name_lt: e.target.value })}
                  className="bg-black border-orange-500 text-orange-500 h-12 text-lg"
                  placeholder="Lietuviškai"
                />
              </div>
              <div>
                <Label htmlFor="name_uk" className="text-orange-300">Название (UK)</Label>
                <Input
                  id="name_uk"
                  value={newCategory.name_uk}
                  onChange={(e) => setNewCategory({ ...newCategory, name_uk: e.target.value })}
                  className="bg-black border-orange-500 text-orange-500 h-12 text-lg"
                  placeholder="Українською"
                />
              </div>
              <div>
                <Label htmlFor="parent_id" className="text-orange-300">Родительская категория</Label>
                <Select
                  value={newCategory.parent_id ? newCategory.parent_id : NO_PARENT_VALUE}
                  onValueChange={(value) => setNewCategory({ ...newCategory, parent_id: value === NO_PARENT_VALUE ? '' : value })}
                >
                  <SelectTrigger id="parent_id" className="bg-black border-orange-500 text-orange-500 h-12 text-lg">
                    <SelectValue placeholder="Без родителя" />
                  </SelectTrigger>
                  <SelectContent className="bg-black border-orange-500">
                    <SelectItem value={NO_PARENT_VALUE} className="text-orange-500">Без родителя</SelectItem>
                    {parentCandidates.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id} className="text-orange-500">
                        {cat.name_uk}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button onClick={createCategory} className="bg-orange-500 text-black hover:bg-orange-600 h-12 flex-1">
                  Создать
                </Button>
                <Button variant="outline" onClick={() => setIsCategoryDialogOpen(false)} className="border-orange-500 text-orange-500 h-12 flex-1">
                  Отмена
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      
      <div className="space-y-3">
        {categories.map((category, index) => (
          <div key={category.id} className="flex items-center justify-between p-4 bg-gray-900 border border-orange-500 rounded-lg">
            <div className="flex items-center gap-4">
              <span className="text-orange-500 font-semibold text-lg">{category.name_uk}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => moveCategoryUp(index)}
                disabled={(() => {
                  const currentParent = categories[index]?.parent_id ?? null
                  for (let i = index - 1; i >= 0; i--) {
                    if ((categories[i]?.parent_id ?? null) === currentParent) return false
                  }
                  return true
                })()}
                className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-black p-2 h-10 w-10"
              >
                <ArrowUp className="w-4 h-4" />
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => moveCategoryDown(index)}
                disabled={(() => {
                  const currentParent = categories[index]?.parent_id ?? null
                  for (let i = index + 1; i < categories.length; i++) {
                    if ((categories[i]?.parent_id ?? null) === currentParent) return false
                  }
                  return true
                })()}
                className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-black p-2 h-10 w-10"
              >
                <ArrowDown className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingCategory(category)
                  setIsEditCategoryDialogOpen(true)
                }}
                className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-black p-2 h-10 w-10"
              >
                <Edit className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => deleteCategory(category.id)}
                className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white p-2 h-10 w-10"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Диалог редактирования категории */}
      <Dialog open={isEditCategoryDialogOpen} onOpenChange={setIsEditCategoryDialogOpen}>
        <DialogContent className="bg-black border-orange-500 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-orange-500">Редактировать категорию</DialogTitle>
          </DialogHeader>
          {editingCategory && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name_lt" className="text-orange-300">Название (LT)</Label>
                <Input
                  id="edit-name_lt"
                  value={editingCategory.name_lt}
                  onChange={(e) => setEditingCategory({ ...editingCategory, name_lt: e.target.value })}
                  className="bg-black border-orange-500 text-orange-500 h-12 text-lg"
                  placeholder="Lietuviškai"
                />
              </div>
              <div>
                <Label htmlFor="edit-name_uk" className="text-orange-300">Название (UK)</Label>
                <Input
                  id="edit-name_uk"
                  value={editingCategory.name_uk}
                  onChange={(e) => setEditingCategory({ ...editingCategory, name_uk: e.target.value })}
                  className="bg-black border-orange-500 text-orange-500 h-12 text-lg"
                  placeholder="Українською"
                />
              </div>
              <div>
                <Label htmlFor="edit-parent_id" className="text-orange-300">Родительская категория</Label>
                <Select
                  value={editingCategory.parent_id ? editingCategory.parent_id : NO_PARENT_VALUE}
                  onValueChange={(value) => setEditingCategory({ ...editingCategory, parent_id: value === NO_PARENT_VALUE ? null : value })}
                >
                  <SelectTrigger id="edit-parent_id" className="bg-black border-orange-500 text-orange-500 h-12 text-lg">
                    <SelectValue placeholder="Без родителя" />
                  </SelectTrigger>
                  <SelectContent className="bg-black border-orange-500">
                    <SelectItem value={NO_PARENT_VALUE} className="text-orange-500">Без родителя</SelectItem>
                    {parentCandidates
                      .filter((c) => c.id !== editingCategory.id)
                      .map((cat) => (
                        <SelectItem key={cat.id} value={cat.id} className="text-orange-500">
                          {cat.name_uk}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button onClick={updateCategory} className="bg-orange-500 text-black hover:bg-orange-600 h-12 flex-1">
                  Сохранить
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setIsEditCategoryDialogOpen(false)} 
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