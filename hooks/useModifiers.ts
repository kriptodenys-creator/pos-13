import { useState, useCallback } from "react"
import type { Modifier } from "@/types/pos"

// Экспортируем тип для обратной совместимости
export type { Modifier }

export function useModifiers() {
  const [selectedModifiers, setSelectedModifiers] = useState<Modifier[]>([])
  const [isModifierDialogOpen, setIsModifierDialogOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<any | null>(null)

  const toggleModifier = useCallback((modifier: Modifier) => {
    setSelectedModifiers((prev) => {
      const exists = prev.find((m) => m.id === modifier.id)
      
      if (exists) {
        return prev.filter((m) => m.id !== modifier.id)
      }

      // Если это модификатор типа "choice" (выбор одного из группы)
      if (modifier.type === 'choice') {
        // Удаляем все модификаторы из той же группы
        const filtered = prev.filter((m) => m.groupId !== modifier.groupId)
        return [...filtered, modifier]
      }

      // Для обычных модификаторов просто добавляем
      return [...prev, modifier]
    })
  }, [])

  const clearModifiers = useCallback(() => {
    setSelectedModifiers([])
  }, [])

  const openModifierDialog = useCallback((item: any) => {
    setSelectedItem(item)
    setSelectedModifiers([])
    setIsModifierDialogOpen(true)
  }, [])

  const closeModifierDialog = useCallback(() => {
    setIsModifierDialogOpen(false)
    setSelectedItem(null)
    setSelectedModifiers([])
  }, [])

  const getModifierColor = useCallback((index: number, isSelected: boolean) => {
    const colors = [
      {
        selected: "bg-gradient-to-br from-orange-500 to-red-500 border-orange-400 text-white shadow-lg shadow-orange-500/50",
        unselected: "bg-gray-800 border-gray-600 text-gray-300 hover:border-orange-400"
      },
      {
        selected: "bg-gradient-to-br from-blue-500 to-cyan-500 border-blue-400 text-white shadow-lg shadow-blue-500/50",
        unselected: "bg-gray-800 border-gray-600 text-gray-300 hover:border-blue-400"
      },
      {
        selected: "bg-gradient-to-br from-green-500 to-emerald-500 border-green-400 text-white shadow-lg shadow-green-500/50",
        unselected: "bg-gray-800 border-gray-600 text-gray-300 hover:border-green-400"
      },
      {
        selected: "bg-gradient-to-br from-purple-500 to-pink-500 border-purple-400 text-white shadow-lg shadow-purple-500/50",
        unselected: "bg-gray-800 border-gray-600 text-gray-300 hover:border-purple-400"
      },
      {
        selected: "bg-gradient-to-br from-yellow-500 to-orange-500 border-yellow-400 text-white shadow-lg shadow-yellow-500/50",
        unselected: "bg-gray-800 border-gray-600 text-gray-300 hover:border-yellow-400"
      },
    ]
    
    const colorScheme = colors[index % colors.length]
    return isSelected ? colorScheme.selected : colorScheme.unselected
  }, [])

  return {
    selectedModifiers,
    setSelectedModifiers,
    isModifierDialogOpen,
    setIsModifierDialogOpen,
    selectedItem,
    setSelectedItem,
    toggleModifier,
    clearModifiers,
    openModifierDialog,
    closeModifierDialog,
    getModifierColor
  }
}
