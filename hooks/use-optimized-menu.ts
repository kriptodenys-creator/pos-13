import { useState, useEffect, useCallback, useMemo } from 'react'

interface MenuItem {
  id: string
  name: { lt: string; uk: string }
  price: number
  category: string
  image?: string
  modifiers?: Modifier[]
}

interface Modifier {
  id: string
  name: { lt: string; uk: string }
  price: number
  type: string
  required?: boolean
}

interface Category {
  id: string
  name: { lt: string; uk: string }
}

// Кэш для меню
const menuCache = new Map<string, { data: MenuItem[]; timestamp: number }>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 минут

export function useOptimizedMenu() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Мемоизированная функция загрузки меню
  const loadMenu = useCallback(async () => {
    const cacheKey = 'menu-data'
    const cached = menuCache.get(cacheKey)
    
    // Проверяем кэш
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      setMenuItems(cached.data)
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch('/api/menu?fallbackAllModifiers=1&listCategories=1', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      const normalizedMenu: MenuItem[] = Array.isArray(data?.menu)
        ? data.menu.map((mi: any) => ({
            id: String(mi.id),
            name: {
              lt: mi?.name_lt || mi?.name || '',
              uk: mi?.name_uk || mi?.name || ''
            },
            price: Number(mi.price) || 0,
            category: String(mi.category ?? mi.category_id ?? ''),
            image: mi.image || '',
            modifiers: Array.isArray(mi.modifiers) ? mi.modifiers.flatMap((mod: any) => {
              if (Array.isArray(mod.options) && mod.options.length > 0) {
                return mod.options.map((option: any) => ({
                  id: option.id,
                  name: option.name || { lt: option.name_lt || '', uk: option.name_uk || '' },
                  price: Number(option.price) || 0,
                  type: mod.type || 'addon',
                  required: mod.required || false
                }))
              } else {
                return [{
                  id: mod.id,
                  name: mod.name || { lt: mod.name_lt || '', uk: mod.name_uk || '' },
                  price: Number(mod.price) || 0,
                  type: mod.type || 'addon',
                  required: mod.required || false
                }]
              }
            }) : []
          }))
        : []

      const normalizedCategories: Category[] = data.categories ? data.categories.map((cat: any) => ({
        id: cat.id,
        name: { lt: cat.name_lt || '', uk: cat.name_uk || '' }
      })) : []

      // Сохраняем в кэш
      menuCache.set(cacheKey, { data: normalizedMenu, timestamp: Date.now() })

      setMenuItems(normalizedMenu)
      setCategories(normalizedCategories)
    } catch (error) {
      console.error('[useOptimizedMenu] Ошибка загрузки меню:', error)
      setError(error instanceof Error ? error.message : 'Ошибка загрузки меню')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Мемоизированная фильтрация по категориям
  const getItemsByCategory = useCallback((categoryId: string) => {
    if (categoryId === 'all') {
      return menuItems
    }
    return menuItems.filter(item => item.category === categoryId)
  }, [menuItems])

  // Мемоизированный поиск товара по ID
  const getItemById = useCallback((id: string) => {
    return menuItems.find(item => item.id === id)
  }, [menuItems])

  // Мемоизированная статистика меню
  const menuStats = useMemo(() => ({
    totalItems: menuItems.length,
    totalCategories: categories.length,
    itemsByCategory: categories.reduce((acc, cat) => {
      acc[cat.id] = menuItems.filter(item => item.category === cat.id).length
      return acc
    }, {} as Record<string, number>),
    averagePrice: menuItems.length > 0 
      ? menuItems.reduce((sum, item) => sum + item.price, 0) / menuItems.length 
      : 0
  }), [menuItems, categories])

  // Инвалидация кэша
  const invalidateCache = useCallback(() => {
    menuCache.clear()
    loadMenu()
  }, [loadMenu])

  useEffect(() => {
    loadMenu()

    // Подписка на обновления меню через BroadcastChannel
    if (typeof window !== 'undefined') {
      const menuChannel = new BroadcastChannel('menu-updates')
      menuChannel.onmessage = (event) => {
        if (event.data.type === 'menu-updated') {
          console.log('[useOptimizedMenu] Получено обновление меню')
          invalidateCache()
        }
      }

      return () => {
        menuChannel.close()
      }
    }
  }, [loadMenu, invalidateCache])

  return {
    menuItems,
    categories,
    isLoading,
    error,
    loadMenu,
    getItemsByCategory,
    getItemById,
    menuStats,
    invalidateCache
  }
}
