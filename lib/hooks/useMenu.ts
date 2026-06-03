import { useQuery } from '@tanstack/react-query'

export interface MenuItem {
  id: string
  name_lt: string
  name_uk: string
  price: number
  category: string
  image?: string
  modifiers?: unknown[]
}

export interface Category {
  id: string
  name_lt: string
  name_uk: string
}

export function useMenu() {
  return useQuery({
    queryKey: ['menu'],
    queryFn: async () => {
      const response = await fetch('/api/menu')
      if (!response.ok) {
        throw new Error('Failed to fetch menu')
      }
      const data = await response.json()
      return {
        menu: data.menu as MenuItem[],
        categories: data.categories as Category[]
      }
    },
    staleTime: 5 * 60 * 1000, // 5 минут - меню редко меняется
    gcTime: 30 * 60 * 1000, // 30 минут в кеше
  })
}

export function useOrders(from?: string, to?: string) {
  return useQuery({
    queryKey: ['orders', from, to],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (from) params.append('from', from)
      if (to) params.append('to', to)
      
      const response = await fetch(`/api/orders?${params.toString()}`)
      if (!response.ok) {
        throw new Error('Failed to fetch orders')
      }
      const data = await response.json()
      return data.orders
    },
    staleTime: 10 * 1000, // 10 секунд - заказы обновляются часто
    refetchInterval: 30 * 1000, // Автообновление каждые 30 секунд
  })
}
