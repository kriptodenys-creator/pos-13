"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, ArrowRight, Check } from "lucide-react"

interface ComboSlot {
  id: string
  title: { lt: string; uk: string }
  type: 'menu_item_choice' | 'modifier'
  required: boolean
  minSelection: number
  maxSelection: number
  items?: Array<{
    id: string
    menuItemId: string
    name: { lt: string; uk: string }
    price: number
    priceDelta: number
    modifiers?: Array<{
      id: string
      modifierId: string
      name: { lt: string; uk: string }
      type: string
      required: boolean
      minSelection: number
      maxSelection: number
      options: Array<{
        id: string
        name: { lt: string; uk: string }
        price: number
        isDefault: boolean
      }>
    }>
  }>
  modifiers?: Array<{
    id: string
    modifierId: string
    name: { lt: string; uk: string }
    type: string
    required: boolean
    minSelection: number
    maxSelection: number
    options: Array<{
      id: string
      name: { lt: string; uk: string }
      price: number
      isDefault: boolean
    }>
  }>
}

interface Combo {
  id: string
  menuItemId: string
  name: { lt: string; uk: string }
  price: number
  slots: ComboSlot[]
}

interface ComboSelection {
  [slotId: string]: {
    type: 'item' | 'modifier'
    selections: string[] // IDs of selected items/modifiers
    itemModifiers?: {
      [itemId: string]: string[] // Selected modifier option IDs for each item
    }
  }
}

interface POSComboDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  combo: Combo | null
  language: "uk" | "lt"
  onConfirm: (selection: ComboSelection) => void
}

export default function POSComboDialog({
  open,
  onOpenChange,
  combo,
  language,
  onConfirm
}: POSComboDialogProps) {
  const [currentSlotIndex, setCurrentSlotIndex] = useState(0)
  const [selection, setSelection] = useState<ComboSelection>({})

  if (!combo) return null

  const currentSlot = combo.slots[currentSlotIndex]
  const isLastSlot = currentSlotIndex === combo.slots.length - 1
  const slotSelection = selection[currentSlot.id] || { type: 'item', selections: [] }

  const updateSlotSelection = (type: 'item' | 'modifier', selections: string[]) => {
    setSelection(prev => {
      const current = prev[currentSlot.id] || { type: 'item', selections: [], itemModifiers: {} }
      return {
        ...prev,
        [currentSlot.id]: { type, selections, itemModifiers: current.itemModifiers || {} }
      }
    })
  }

  const handleItemSelect = (itemId: string) => {
    const newSelections = currentSlot.type === 'menu_item_choice' && currentSlot.maxSelection === 1
      ? [itemId] // Single selection
      : slotSelection.selections.includes(itemId)
        ? slotSelection.selections.filter(id => id !== itemId) // Remove if already selected
        : [...slotSelection.selections, itemId] // Add if not selected

    updateSlotSelection('item', newSelections)
  }

  const handleModifierSelect = (modifierOptionId: string) => {
    const newSelections = currentSlot.maxSelection === 1
      ? [modifierOptionId]
      : slotSelection.selections.includes(modifierOptionId)
        ? slotSelection.selections.filter(id => id !== modifierOptionId)
        : [...slotSelection.selections, modifierOptionId]

    updateSlotSelection('modifier', newSelections)
  }

  const handleItemModifierSelect = (itemId: string, modifierOptionId: string, modifierMaxSelection: number = 1) => {
    setSelection(prev => {
      const current = prev[currentSlot.id] || { type: 'item', selections: [], itemModifiers: {} }
      const itemModifiers = { ...current.itemModifiers }
      const currentModifiers = itemModifiers[itemId] || []
      
      const newModifiers = modifierMaxSelection === 1
        ? [modifierOptionId]
        : currentModifiers.includes(modifierOptionId)
          ? currentModifiers.filter(id => id !== modifierOptionId)
          : [...currentModifiers, modifierOptionId]
      
      itemModifiers[itemId] = newModifiers
      
      return {
        ...prev,
        [currentSlot.id]: { ...current, itemModifiers }
      }
    })
  }

  const canProceed = () => {
    const min = currentSlot.minSelection
    const max = currentSlot.maxSelection
    const selected = slotSelection.selections.length
    if (selected < min || selected > max) return false

    // For menu_item_choice slots, validate required modifiers for selected items
    if (currentSlot.type === 'menu_item_choice' && slotSelection.type === 'item') {
      for (const itemId of slotSelection.selections) {
        const selectedItem = currentSlot.items?.find(item => item.id === itemId)
        if (!selectedItem?.modifiers) continue
        
        for (const modifier of selectedItem.modifiers) {
          if (!modifier.required) continue
          
          const selectedModifiers = slotSelection.itemModifiers?.[itemId] || []
          if (selectedModifiers.length < modifier.minSelection) return false
          if (selectedModifiers.length > modifier.maxSelection) return false
        }
      }
    }

    return true
  }

  const handleNext = () => {
    if (canProceed()) {
      if (isLastSlot) {
        onConfirm(selection)
        onOpenChange(false)
        setSelection({})
        setCurrentSlotIndex(0)
      } else {
        setCurrentSlotIndex(currentSlotIndex + 1)
      }
    }
  }

  const handleBack = () => {
    if (currentSlotIndex > 0) {
      setCurrentSlotIndex(currentSlotIndex - 1)
    }
  }

  const getProgressText = () => {
    return `${currentSlotIndex + 1} / ${combo.slots.length}`
  }

  const isItemSelected = (itemId: string) => {
    return slotSelection.type === 'item' && slotSelection.selections.includes(itemId)
  }

  const isModifierSelected = (optionId: string) => {
    return slotSelection.type === 'modifier' && slotSelection.selections.includes(optionId)
  }

  const isItemModifierSelected = (itemId: string, optionId: string) => {
    const itemModifiers = slotSelection.itemModifiers || {}
    const selectedModifiers = itemModifiers[itemId] || []
    return selectedModifiers.includes(optionId)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-w-[95vw] bg-gray-900 border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle className="text-orange-500 text-xl font-bold">
            {language === "uk" ? "Налаштування комбо" : "Kombo nustatymai"}
          </DialogTitle>
          <div className="text-center">
            <h3 className="text-lg font-semibold text-white">{combo.name[language]}</h3>
            <div className="text-sm text-gray-400 mt-1">{getProgressText()}</div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Slot Title */}
          <div className="text-center">
            <h4 className="text-xl font-bold text-orange-400">
              {currentSlot.title[language]}
            </h4>
            {currentSlot.required && (
              <Badge variant="destructive" className="mt-2">
                {language === "uk" ? "Обов'язково" : "Privaloma"}
              </Badge>
            )}
            <div className="text-sm text-gray-400 mt-1">
              {language === "uk" 
                ? `Оберіть ${currentSlot.minSelection}-${currentSlot.maxSelection} варіант(ів)`
                : `Pasirinkite ${currentSlot.minSelection}-${currentSlot.maxSelection} variantą(us)`
              }
            </div>
          </div>

          {/* Selection Content */}
          <div className="space-y-4">
            {currentSlot.type === 'menu_item_choice' && currentSlot.items && (
              <div className="space-y-3">
                {currentSlot.items.map(item => {
                  const isSelected = isItemSelected(item.id)
                  const isSingleSelection = currentSlot.maxSelection === 1
                  
                  return (
                    <div 
                      key={item.id} 
                      className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        isSelected 
                          ? 'border-orange-500 bg-orange-500/10' 
                          : 'border-gray-600 hover:bg-gray-800'
                      }`}
                      onClick={() => handleItemSelect(item.id)}
                    >
                      {isSingleSelection ? (
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          isSelected ? 'border-orange-500' : 'border-gray-400'
                        }`}>
                          {isSelected && <div className="w-2 h-2 rounded-full bg-orange-500" />}
                        </div>
                      ) : (
                        <div className="w-4 h-4 border-2 rounded flex items-center justify-center border-gray-400">
                          {isSelected && <div className="w-2 h-2 bg-orange-500 rounded" />}
                        </div>
                      )}
                      <div className="flex-1 flex justify-between items-center">
                        <span className="font-medium">{item.name[language]}</span>
                        {item.priceDelta !== 0 && (
                          <span className="text-sm text-orange-400">
                            {item.priceDelta > 0 ? '+' : ''}€{item.priceDelta}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}

                {/* Show modifiers for selected items */}
                {slotSelection.type === 'item' && slotSelection.selections.length > 0 && (
                  <div className="mt-4 space-y-3">
                    {slotSelection.selections.map(itemId => {
                      const selectedItem = currentSlot.items?.find(item => item.id === itemId)
                      if (!selectedItem?.modifiers || selectedItem.modifiers.length === 0) return null
                      
                      return (
                        <div key={itemId} className="ml-4 p-3 bg-gray-800 rounded-lg border border-gray-700">
                          <h5 className="font-semibold text-gray-300 mb-2">
                            {selectedItem.name[language]} - {language === 'uk' ? 'Модифікатори' : 'Modifikatoriai'}
                          </h5>
                          {selectedItem.modifiers.map(modifier => (
                            <div key={modifier.id} className="space-y-2">
                              <h6 className="text-sm font-medium text-gray-400">
                                {modifier.name[language]}
                                {modifier.required && (
                                  <span className="ml-1 text-red-400">*</span>
                                )}
                              </h6>
                              <div className="space-y-1">
                                {modifier.options.map(option => {
                                  const isSelected = isItemModifierSelected(itemId, option.id)
                                  const isSingleSelection = modifier.maxSelection === 1
                                  
                                  return (
                                    <div 
                                      key={option.id} 
                                      className={`flex items-center space-x-2 p-2 rounded border cursor-pointer transition-colors ${
                                        isSelected 
                                          ? 'border-orange-500 bg-orange-500/10' 
                                          : 'border-gray-600 hover:bg-gray-700'
                                      }`}
                                      onClick={() => handleItemModifierSelect(itemId, option.id, modifier.maxSelection)}
                                    >
                                      {isSingleSelection ? (
                                        <div className={`w-3 h-3 rounded-full border-2 flex items-center justify-center ${
                                          isSelected ? 'border-orange-500' : 'border-gray-400'
                                        }`}>
                                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />}
                                        </div>
                                      ) : (
                                        <div className="w-3 h-3 border-2 rounded flex items-center justify-center border-gray-400">
                                          {isSelected && <div className="w-1.5 h-1.5 bg-orange-500 rounded" />}
                                        </div>
                                      )}
                                      <div className="flex-1 flex justify-between items-center">
                                        <span className="text-sm">{option.name[language]}</span>
                                        {option.price > 0 && (
                                          <span className="text-xs text-orange-400">+€{option.price}</span>
                                        )}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {currentSlot.type === 'modifier' && currentSlot.modifiers && (
              <div className="space-y-4">
                {currentSlot.modifiers.map(modifier => (
                  <div key={modifier.id} className="space-y-2">
                    <h5 className="font-semibold text-gray-300">{modifier.name[language]}</h5>
                    <div className="space-y-2">
                      {modifier.options.map(option => {
                        const isSelected = isModifierSelected(option.id)
                        const isSingleSelection = currentSlot.maxSelection === 1
                        
                        return (
                          <div 
                            key={option.id} 
                            className={`flex items-center space-x-3 p-2 rounded border cursor-pointer transition-colors ${
                              isSelected 
                                ? 'border-orange-500 bg-orange-500/10' 
                                : 'border-gray-600 hover:bg-gray-800'
                            }`}
                            onClick={() => handleModifierSelect(option.id)}
                          >
                            {isSingleSelection ? (
                              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                isSelected ? 'border-orange-500' : 'border-gray-400'
                              }`}>
                                {isSelected && <div className="w-2 h-2 rounded-full bg-orange-500" />}
                              </div>
                            ) : (
                              <div className="w-4 h-4 border-2 rounded flex items-center justify-center border-gray-400">
                                {isSelected && <div className="w-2 h-2 bg-orange-500 rounded" />}
                              </div>
                            )}
                            <div className="flex-1 flex justify-between items-center">
                              <span>{option.name[language]}</span>
                              {option.price > 0 && (
                                <span className="text-sm text-orange-400">+€{option.price}</span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Validation Message */}
          {!canProceed() && (
            <div className="text-center text-red-400 text-sm">
              {language === "uk" 
                ? `Оберіть щонайменше ${currentSlot.minSelection} варіант(ів)`
                : `Pasirinkite mažiausiai ${currentSlot.minSelection} variantą(us)`
              }
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex gap-3">
            {currentSlotIndex > 0 && (
              <Button 
                variant="outline" 
                onClick={handleBack}
                className="flex-1 bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                {language === "uk" ? "Назад" : "Atgal"}
              </Button>
            )}
            
            <Button 
              onClick={handleNext}
              disabled={!canProceed()}
              className="flex-1 bg-orange-600 hover:bg-orange-700 text-white disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              {isLastSlot ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  {language === "uk" ? "Готово" : "Baigta"}
                </>
              ) : (
                <>
                  {language === "uk" ? "Далі" : "Toliau"}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
