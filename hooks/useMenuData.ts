import { useState, useEffect } from "react"

export interface MenuItem {
  id: string
  name: { lt: string; uk: string }
  price: number
  category: string
  image?: string
  modifiers?: any[]
}

export interface Category {
  id: string
  name: { lt: string; uk: string }
  order_index: number
  parent_id?: string | null
}

export function useMenuData() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [popularItems, setPopularItems] = useState<MenuItem[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>("popular")
  const [isLoading, setIsLoading] = useState(true)
  const [happyHourDiscounts, setHappyHourDiscounts] = useState<Record<string, number>>({})
  const [packagingCost, setPackagingCost] = useState<number>(0.30)

  const loadPopularItems = async () => {
    try {
      const response = await fetch('/api/popular', { cache: 'no-store' })
      if (response.ok) {
        const data = await response.json()
        if (data.success && Array.isArray(data.items)) {
          const normalized: MenuItem[] = data.items.map((item: any) => ({
            id: item.id,
            name: item.name || { lt: item.name_lt, uk: item.name_uk },
            price: item.price,
            category: item.category,
            image: item.image || "",
            modifiers: item.modifiers || []
          }))
          console.log('[useMenuData] Loaded popular items:', normalized.map(i => `${i.name.uk}: ${i.modifiers?.length || 0} modifiers`))
          setPopularItems(normalized)
        }
      }
    } catch (error) {
      console.error('Ошибка загрузки популярных товаров:', error)
    }
  }

  const loadHappyHourDiscounts = async (items: MenuItem[]) => {
    try {
      // Checking happy hour discounts
      if (!items || items.length === 0) {
        return
      }
      
      // Make a single API call to get all discounts at once
      const response = await fetch('/api/happy-hours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'checkDiscounts',
          items: items.map(item => ({
            id: item.id,
            itemId: item.id, // Добавляем itemId для совместимости
            categoryId: item.category
          }))
        })
      })
      
      // Response received
      
      if (response.ok) {
        const data = await response.json()
        if (data.discounts) {
          setHappyHourDiscounts(data.discounts)
        }
      } else {
        console.warn('[POS] Ошибка загрузки скидок: HTTP', response.status)
      }
    } catch (error) {
      // Silently fail - это не критичная ошибка
      console.debug('[POS] Ошибка загрузки скидок (non-critical):', error instanceof Error ? error.message : error)
    }
  }

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/settings')
      if (response.ok) {
        const data = await response.json()
        if (data.settings.packaging_cost) {
          setPackagingCost(parseFloat(data.settings.packaging_cost))
        }
      }
    } catch (error) {
      console.error('[POS] Ошибка загрузки настроек:', error)
    }
  }

  const loadMenuFromAPI = async (): Promise<boolean> => {
    console.log('[useMenuData] 🔄 Загрузка меню из API...')
    try {
      const response = await fetch('/api/menu?fallbackAllModifiers=1&listCategories=1', { cache: 'no-store' })
      if (!response.ok) {
        console.error('[useMenuData] ❌ Ошибка загрузки меню:', response.status)
        return false
      }
      const data = await response.json()
      console.log('[useMenuData] ✅ Меню получено, товаров:', data?.menu?.length || 0)

      const normalized: MenuItem[] = Array.isArray(data?.menu)
        ? data.menu.map((mi: any) => ({
            id: mi.id,
            name: { lt: mi.name_lt, uk: mi.name_uk },
            price: mi.price,
            category: mi.category,
            image: mi.image || "",
            modifiers: Array.isArray(mi.modifiers) ? mi.modifiers.map((mod: any) => ({
              id: mod.id,
              name: { lt: mod.name_lt || mod.name?.lt || '', uk: mod.name_uk || mod.name?.uk || '' },
              price: mod.price || 0,
              groupName: { lt: mod.group_name_lt || mod.group_name || '', uk: mod.group_name_uk || mod.group_name || '' },
              groupId: mod.group_id || mod.id,
              required: mod.required || false,
              type: mod.type || 'addon',
              options: Array.isArray(mod.options) ? mod.options.map((opt: any) => ({
                id: opt.id,
                name: { lt: opt.name_lt || opt.name?.lt || '', uk: opt.name_uk || opt.name?.uk || '' },
                price: opt.price || 0
              })) : []
            })) : []
          }))
        : []

      const normalizedCategories: Category[] = Array.isArray(data?.categories)
        ? data.categories.map((cat: any) => ({
            id: cat.id,
            name: { lt: cat.name_lt, uk: cat.name_uk },
            order_index: cat.order_index || 0,
            parent_id: cat.parent_id ?? null
          }))
        : []

      setMenuItems(normalized)
      setCategories(normalizedCategories)
      
      // Завантажуємо критичні дані (знижки) одразу
      loadHappyHourDiscounts(normalized).catch(error => {
        console.error('[useMenuData] Ошибка при загрузке скидок:', error)
      })
      
      // Некритичні дані відкладаємо на 1 секунду
      setTimeout(() => {
        Promise.all([
          loadPopularItems(),
          loadSettings()
        ]).catch(error => {
          console.error('[useMenuData] Ошибка при загрузке дополнительных данных:', error)
        })
      }, 1000)
      
      return true
    } catch (error) {
      console.error('Ошибка загрузки меню:', error)
      return false
    }
  }

  // Добавляем периодическое обновление скидок каждые 30 секунд
  useEffect(() => {
    if (menuItems.length > 0) {
      // Начальное обновление скидок
      loadHappyHourDiscounts(menuItems).catch(() => {
        // Silently fail - это не критичная ошибка
      });
      
      // Периодическое обновление скидок
      const interval = setInterval(() => {
        loadHappyHourDiscounts(menuItems).catch(() => {
          // Silently fail - это не критичная ошибка
        });
      }, 30000); // Обновляем каждые 30 секунд
      
      return () => clearInterval(interval);
    }
  }, [menuItems.length]);

  return {
    menuItems,
    categories,
    popularItems,
    selectedCategory,
    setSelectedCategory,
    isLoading,
    setIsLoading,
    happyHourDiscounts,
    packagingCost,
    loadMenuFromAPI,
    loadPopularItems
  }
}