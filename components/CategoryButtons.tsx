"use client"

import { memo } from "react"
import { Button } from "@/components/ui/button"

interface Category {
  id: string
  name: { lt: string; uk: string }
}

interface CategoryButtonsProps {
  categories: Category[]
  selectedCategory: string | null
  language: "lt" | "uk"
  onCategorySelect: (categoryId: string | null) => void
  showAllButton?: boolean
  allButtonText?: { lt: string; uk: string }
  showPopularButton?: boolean
}

const CategoryButtons = memo(({
  categories,
  selectedCategory,
  language,
  onCategorySelect,
  showAllButton = true,
  allButtonText = { lt: "Visi", uk: "Всі" },
  showPopularButton = false
}: CategoryButtonsProps) => {
  
  const getCategoryColor = (index: number) => {
    const colors = [
      {
        active: "bg-gradient-to-r from-orange-500 to-red-500 text-white border-orange-400 shadow-lg shadow-orange-500/50",
        inactive: "bg-black text-orange-400 border-gray-700 hover:bg-gradient-to-r hover:from-orange-500 hover:to-red-500 hover:text-white hover:border-orange-400"
      },
      {
        active: "bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-blue-400 shadow-lg shadow-blue-500/50",
        inactive: "bg-black text-blue-400 border-gray-700 hover:bg-gradient-to-r hover:from-blue-500 hover:to-cyan-500 hover:text-white hover:border-blue-400"
      },
      {
        active: "bg-gradient-to-r from-green-500 to-emerald-500 text-white border-green-400 shadow-lg shadow-green-500/50",
        inactive: "bg-black text-green-400 border-gray-700 hover:bg-gradient-to-r hover:from-green-500 hover:to-emerald-500 hover:text-white hover:border-green-400"
      },
      {
        active: "bg-gradient-to-r from-purple-500 to-pink-500 text-white border-purple-400 shadow-lg shadow-purple-500/50",
        inactive: "bg-black text-purple-400 border-gray-700 hover:bg-gradient-to-r hover:from-purple-500 hover:to-pink-500 hover:text-white hover:border-purple-400"
      },
      {
        active: "bg-gradient-to-r from-yellow-500 to-orange-500 text-white border-yellow-400 shadow-lg shadow-yellow-500/50",
        inactive: "bg-black text-yellow-400 border-gray-700 hover:bg-gradient-to-r hover:from-yellow-500 hover:to-orange-500 hover:text-white hover:border-yellow-400"
      },
      {
        active: "bg-gradient-to-r from-red-500 to-rose-500 text-white border-red-400 shadow-lg shadow-red-500/50",
        inactive: "bg-black text-red-400 border-gray-700 hover:bg-gradient-to-r hover:from-red-500 hover:to-rose-500 hover:text-white hover:border-red-400"
      }
    ]
    return colors[index % colors.length]
  }

  return (
    <div className="flex flex-wrap gap-2 sm:gap-3 mb-4">
      {showAllButton && (
        <Button
          variant={selectedCategory === null ? "default" : "outline"}
          onClick={() => onCategorySelect(null)}
          className={`mb-4 text-lg sm:text-xl px-6 sm:px-8 py-4 sm:py-5 transition-all duration-300 font-bold relative overflow-hidden ${
            selectedCategory === null
              ? "bg-gradient-to-r from-gray-700 to-gray-900 text-white border-gray-600 shadow-lg shadow-gray-500/50"
              : "border-gray-500 text-gray-400 hover:bg-gray-700 hover:text-white hover:border-gray-600"
          }`}
        >
          {allButtonText[language]}
          {selectedCategory === null && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 animate-pulse"></div>
          )}
        </Button>
      )}
      
      {showPopularButton && (
        <Button
          variant={selectedCategory === 'popular' ? "default" : "outline"}
          onClick={() => onCategorySelect('popular')}
          className={`mb-4 text-lg sm:text-xl px-6 sm:px-8 py-4 sm:py-5 relative overflow-hidden transition-all duration-300 font-bold ${
            selectedCategory === 'popular'
              ? "bg-gradient-to-r from-red-500 to-pink-500 text-white hover:from-red-600 hover:to-pink-600 shadow-xl shadow-red-500/40 border-2 border-red-400"
              : "bg-gradient-to-r from-red-500/80 to-pink-500/80 text-white hover:from-red-600 hover:to-pink-600 border-2 border-red-400/50 hover:shadow-xl hover:shadow-red-500/30 hover:scale-105"
          }`}
        >
          <span className="flex items-center gap-2">
            🔥
            <span className="font-semibold">{language === 'uk' ? 'Популярні' : 'Populiarūs'}</span>
          </span>
          {selectedCategory === 'popular' && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 animate-pulse"></div>
          )}
        </Button>
      )}
      
      {categories.map((cat, index) => {
        const colorScheme = getCategoryColor(index)
        return (
          <Button
            key={cat.id}
            variant={selectedCategory === cat.id ? "default" : "outline"}
            onClick={() => onCategorySelect(cat.id)}
            className={`mb-4 text-lg sm:text-xl px-6 sm:px-8 py-4 sm:py-5 transition-all duration-300 font-bold ${
              selectedCategory === cat.id
                ? colorScheme.active
                : colorScheme.inactive
            }`}
          >
            {cat.name[language]}
          </Button>
        )
      })}
    </div>
  )
})

CategoryButtons.displayName = 'CategoryButtons'

export default CategoryButtons
