import { useQuery } from '@tanstack/react-query'

interface ReportsParams {
  type: 'sales' | 'inventory'
  dateFrom?: string
  dateTo?: string
}

export function useReports({ type, dateFrom, dateTo }: ReportsParams) {
  return useQuery({
    queryKey: ['reports', type, dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams({
        type,
        ...(dateFrom && { dateFrom }),
        ...(dateTo && { dateTo })
      })
      
      const response = await fetch(`/api/reports?${params}`)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      return response.json()
    },
    staleTime: 2 * 60 * 1000, // 2 минуты
    gcTime: 10 * 60 * 1000, // 10 минут в кеше
    enabled: !!dateFrom && !!dateTo, // Загружать только если даты указаны
  })
}

export function usePreviousPeriodReports({ type, dateFrom, dateTo }: ReportsParams) {
  return useQuery({
    queryKey: ['reports', 'previous', type, dateFrom, dateTo],
    queryFn: async () => {
      if (!dateFrom || !dateTo) return null
      
      // Вычисляем предыдущий период
      const currentStart = new Date(dateFrom)
      const currentEnd = new Date(dateTo)
      const periodLength = Math.ceil((currentEnd.getTime() - currentStart.getTime()) / (1000 * 60 * 60 * 24))
      
      const previousEnd = new Date(currentStart)
      previousEnd.setDate(previousEnd.getDate() - 1)
      const previousStart = new Date(previousEnd)
      previousStart.setDate(previousStart.getDate() - periodLength + 1)
      
      const params = new URLSearchParams({
        type,
        dateFrom: previousStart.toISOString().split('T')[0],
        dateTo: previousEnd.toISOString().split('T')[0]
      })
      
      const response = await fetch(`/api/reports?${params}`)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      return response.json()
    },
    staleTime: 5 * 60 * 1000, // 5 минут
    enabled: !!dateFrom && !!dateTo,
  })
}
