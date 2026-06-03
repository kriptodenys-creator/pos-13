'use client'

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
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
import { Plus, Trash2, Edit, ChefHat, Package, Settings, ArrowUp, ArrowDown, ArrowLeft, Grid3X3, List, Search } from "lucide-react"
import AdminProtection from "@/components/AdminProtection"
import { CategoryManager } from "@/components/admin/menu/CategoryManager"
import { MenuItemManager } from "@/components/admin/menu/MenuItemManager"
import { ModifierManager } from "@/components/admin/menu/ModifierManager"
import { SettingsManager } from "@/components/admin/menu/SettingsManager"

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

interface Category {
  id: string
  name_lt: string
  name_uk: string
  order_index?: number
  parent_id?: string | null
}

export default function AdminMenuPage() {
  const router = useRouter()
  // Функция для уведомления POS о изменениях меню
  const notifyPOSMenuUpdate = () => {
    try {
      const bc = new BroadcastChannel('menu-updates')
      bc.postMessage({ 
        type: 'menu-updated',
        timestamp: Date.now()
      })
      bc.close()
      console.log('[Admin] ✅ POS уведомлена об обновлении меню')
    } catch (e) {
      console.warn('[Admin] Не удалось уведомить POS:', e)
    }
  }

  const [categories, setCategories] = useState<Category[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [modifiers, setModifiers] = useState<Modifier[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [showSettingsDialog, setShowSettingsDialog] = useState(false)
  const [packagingCost, setPackagingCost] = useState<number>(0.30)
  const [woltPackagingCost, setWoltPackagingCost] = useState<number>(0.30)
  const [boltPackagingCost, setBoltPackagingCost] = useState<number>(0.40)
  
  // Состояния для планшетной версии
  const [activeTab, setActiveTab] = useState<'categories' | 'items' | 'modifiers'>('categories')
  const [searchTerm, setSearchTerm] = useState('')

  // Load data
  useEffect(() => {
    loadCategories()
    loadMenuItems()
    loadModifiers()
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/settings')
      if (response.ok) {
        const data = await response.json()
        if (data.settings.packaging_cost) {
          setPackagingCost(parseFloat(data.settings.packaging_cost))
        }
        if (data.settings.wolt_packaging_cost) {
          setWoltPackagingCost(parseFloat(data.settings.wolt_packaging_cost))
        }
        if (data.settings.bolt_packaging_cost) {
          setBoltPackagingCost(parseFloat(data.settings.bolt_packaging_cost))
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error)
    }
  }

  const saveSettings = async () => {
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'saveMultiple',
          settings: {
            packaging_cost: packagingCost,
            wolt_packaging_cost: woltPackagingCost,
            bolt_packaging_cost: boltPackagingCost
          }
        })
      })

      if (response.ok) {
        alert('Настройки сохранены!')
        setShowSettingsDialog(false)
        notifyPOSMenuUpdate() // Уведомляем POS
      }
    } catch (error) {
      console.error('Error saving settings:', error)
      alert('Ошибка сохранения настроек')
    }
  }

  const updateOldModifiers = async () => {
    if (!confirm('Обновить все модификаторы без группы?\n\nМодификаторы будут сгруппированы по типу:\n- addon → Добавки\n- sauce → Соусы\n- size → Размеры')) {
      return
    }

    try {
      const response = await fetch('/api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateOldModifiers'
        })
      })

      if (response.ok) {
        const result = await response.json()
        alert(`Обновлено модификаторов: ${result.updated || 0}`)
        loadModifiers()
      } else {
        alert('Ошибка обновления модификаторов')
      }
    } catch (error) {
      console.error('Error updating modifiers:', error)
      alert('Ошибка обновления модификаторов')
    }
  }

  const loadCategories = async () => {
    try {
      const response = await fetch('/api/categories', { cache: 'no-store' })
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      // Сортируем по parent_id и order_index
      const sortedCategories = data.sort((a: Category, b: Category) => {
        const ap = a.parent_id ?? ''
        const bp = b.parent_id ?? ''
        if (ap !== bp) return String(ap).localeCompare(String(bp))
        return (a.order_index || 0) - (b.order_index || 0)
      })
      setCategories(sortedCategories)
    } catch (error) {
      console.error('Error loading categories:', error)
      alert('Ошибка загрузки категорий')
    }
  }

  const loadMenuItems = async () => {
    try {
      const response = await fetch('/api/menu?includeAll=1')
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      setMenuItems(data.menu || [])
    } catch (error) {
      console.error('Error loading menu items:', error)
      alert('Ошибка загрузки меню')
    }
  }

  const loadModifiers = async () => {
    try {
      const response = await fetch('/api/menu?listModifiers=1', { cache: 'no-store' })
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      setModifiers(data.modifiers || [])
    } catch (error) {
      console.error('Error loading modifiers:', error)
      alert('Ошибка загрузки модификаторов')
    }
  }


  const updateCategoriesOrder = async (updatedCategories: Category[]) => {
    try {
      const byParent = new Map<string, Category[]>()
      for (const c of updatedCategories) {
        const key = c.parent_id ?? ''
        if (!byParent.has(key)) byParent.set(key, [])
        byParent.get(key)!.push(c)
      }

      const normalizedForSave: Category[] = []
      for (const [_, group] of byParent.entries()) {
        group.forEach((cat, index) => {
          normalizedForSave.push({
            ...cat,
            order_index: index
          })
        })
      }

      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateOrder',
          categories: normalizedForSave.map((cat) => ({
            id: cat.id,
            order_index: cat.order_index
          }))
        })
      })

      if (response.ok) {
        await loadCategories()
        notifyPOSMenuUpdate()
      }
    } catch (error) {
      console.error('Error updating categories order:', error)
      alert('Ошибка обновления порядка категорий')
    }
  }


  // Filter menu items by selected category
  const filteredMenuItems = selectedCategory === 'all' 
    ? menuItems 
    : (() => {
        const childIds = categories
          .filter((c) => c.parent_id === selectedCategory)
          .map((c) => c.id)
        const allowed = new Set<string>([selectedCategory, ...childIds])
        return menuItems.filter((item) => allowed.has(item.category))
      })()

  // Фильтрация по поисковому запросу
  const searchFilteredItems = filteredMenuItems.filter(item => 
    item.name_uk.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.name_lt.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <AdminProtection>
      <div className="min-h-screen bg-black text-orange-500 p-2 sm:p-4">
        <div className="max-w-7xl mx-auto">
          <header className="mb-4 sm:mb-6">
            <div className="flex flex-col gap-4 sm:gap-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-orange-500">Управление меню</h1>
                  <p className="text-orange-300 mt-1 sm:mt-2 text-sm sm:text-base">Категории, товары и рецепты</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    onClick={() => {
                      localStorage.removeItem("adminAuthenticated")
                      localStorage.removeItem("adminLoginTime")
                      document.cookie = "adminAuthenticated=; path=/; max-age=0"
                      router.push("/")
                    }}
                    className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                  >
                    <span className="hidden sm:inline">Вихід</span>
                    <span className="sm:hidden">Вих</span>
                  </Button>
                </div>
              </div>
              
              {/* Упрощенная навигация - оставляем только главную и POS */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  asChild
                  className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-black bg-transparent text-xs sm:text-sm"
                >
                  <a href="/admin">🏠 Главная</a>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowSettingsDialog(true)}
                  className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-black bg-transparent text-xs sm:text-sm"
                >
                  <Package className="w-4 h-4 mr-1" />
                  Упаковка
                </Button>
                <Button
                  variant="outline"
                  asChild
                  className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-black bg-transparent text-xs sm:text-sm"
                >
                  <a href="/">Назад к POS</a>
                </Button>
              </div>
            </div>
          </header>

          {/* Планшетная навигация */}
          <div className="mb-4">
            <div className="flex gap-2 overflow-x-auto pb-2">
              <Button
                variant={activeTab === 'categories' ? "default" : "outline"}
                onClick={() => setActiveTab('categories')}
                className={`flex-shrink-0 ${activeTab === 'categories' ? 'bg-orange-500 text-black' : 'border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-black'}`}
              >
                <Grid3X3 className="w-4 h-4 mr-2" />
                Категории
              </Button>
              <Button
                variant={activeTab === 'items' ? "default" : "outline"}
                onClick={() => setActiveTab('items')}
                className={`flex-shrink-0 ${activeTab === 'items' ? 'bg-orange-500 text-black' : 'border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-black'}`}
              >
                <List className="w-4 h-4 mr-2" />
                Товары
              </Button>
              <Button
                variant={activeTab === 'modifiers' ? "default" : "outline"}
                onClick={() => setActiveTab('modifiers')}
                className={`flex-shrink-0 ${activeTab === 'modifiers' ? 'bg-orange-500 text-black' : 'border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-black'}`}
              >
                <Settings className="w-4 h-4 mr-2" />
                Модификаторы
              </Button>
            </div>
          </div>

          {/* Поиск для товаров */}
          {activeTab === 'items' && (
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-orange-500 w-4 h-4" />
                <Input
                  type="text"
                  placeholder="Поиск товаров..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-black border-orange-500 text-orange-500 focus:border-orange-400"
                />
              </div>
            </div>
          )}

          {/* Категории */}
          {activeTab === 'categories' && (
            <div className="mb-6">
              <CategoryManager 
                categories={categories} 
                onCategoriesChange={setCategories}
                loadCategories={loadCategories}
                updateCategoriesOrder={updateCategoriesOrder}
                notifyPOSMenuUpdate={notifyPOSMenuUpdate}
              />
            </div>
          )}

          {/* Товары */}
          {activeTab === 'items' && (
            <div className="mb-6">
              <MenuItemManager 
                menuItems={searchFilteredItems}
                categories={categories}
                modifiers={modifiers}
                selectedCategory={selectedCategory}
                onCategoryChange={setSelectedCategory}
                loadMenuItems={loadMenuItems}
                notifyPOSMenuUpdate={notifyPOSMenuUpdate}
                setMenuItems={setMenuItems}
              />
            </div>
          )}

          {/* Модификаторы */}
          {activeTab === 'modifiers' && (
            <div className="mb-6">
              <div className="flex gap-2 mb-4">
                <Button
                  asChild
                  className="bg-orange-500 text-black hover:bg-orange-600 flex-1 h-12 text-lg"
                >
                  <a href="/admin/modifiers">Управление модификаторами</a>
                </Button>
                <Button
                  asChild
                  className="bg-green-500 text-black hover:bg-green-600 flex-1 h-12 text-lg"
                >
                  <a href="/admin/modifier-groups">
                    <Settings className="w-5 h-5 mr-2" />
                    Управление группами
                  </a>
                </Button>
              </div>
              <ModifierManager 
                modifiers={modifiers}
                loadModifiers={loadModifiers}
                notifyPOSMenuUpdate={notifyPOSMenuUpdate}
              />
            </div>
          )}

          <SettingsManager 
            showSettingsDialog={showSettingsDialog}
            setShowSettingsDialog={setShowSettingsDialog}
            packagingCost={packagingCost}
            setPackagingCost={setPackagingCost}
            woltPackagingCost={woltPackagingCost}
            setWoltPackagingCost={setWoltPackagingCost}
            boltPackagingCost={boltPackagingCost}
            setBoltPackagingCost={setBoltPackagingCost}
            saveSettings={saveSettings}
            notifyPOSMenuUpdate={notifyPOSMenuUpdate}
          />
        </div>
      </div>
    </AdminProtection>
  )
}
