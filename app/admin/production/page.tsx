'use client'

import { useState, useEffect } from "react"
import { ProductionManager } from "@/components/admin/production/ProductionManager"

interface InventoryItem {
  id: string
  name_lt: string
  name_uk: string
  unit: string
  current_stock: number
  min_stock: number
  cost_per_unit: number
  unit_weight?: number
}

export default function ProductionPage() {
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadInventoryItems()
  }, [])

  const loadInventoryItems = async () => {
    try {
      const response = await fetch('/api/inventory')
      const data = await response.json()
      if (data.success) {
        setInventoryItems(data.items)
      }
    } catch (error) {
      console.error('Error loading inventory:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-orange-500 text-xl">Загрузка...</div>
      </div>
    )
  }

  if (inventoryItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="text-orange-500 text-xl">Нет товаров на складе</div>
        <div className="text-gray-400">Сначала добавьте товары в разделе "Склад"</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <ProductionManager 
        inventoryItems={inventoryItems}
        onProductionComplete={loadInventoryItems}
      />
    </div>
  )
}
