"use client"

import { memo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { NameDict, ModifierOption } from "@/types/pos"

export interface ModifierGroup {
  id: string | number
  name: NameDict
  type?: string
  required?: boolean
  options?: ModifierOption[]
  groupId?: string
}

export interface ModifierSelected {
  id: string | number
  name: NameDict
  price: number
  groupName: NameDict
  groupId: string
  type?: string
  required?: boolean
  options?: ModifierOption[]
}

export interface MenuItemLite {
  id: string | number
  name: NameDict
  modifiers?: ModifierGroup[]
}

interface POSModifierDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  language: "uk" | "lt"
  selectedItem: MenuItemLite | null
  selectedModifiers: ModifierSelected[]
  toggleModifier: (modifier: ModifierSelected) => void
  getModifierColor: (index: number, isSelected: boolean) => string
  onCancel: () => void
  onConfirm: () => void
  isAddonGroup?: (group: ModifierGroup) => boolean
  onShowMeatDialog?: () => void
  onShowAddonsDialog?: () => void
}

const getGroupEmoji = (group: ModifierGroup): string => {
  const type = String(group.type || '').toLowerCase()
  const name = `${group.name?.lt || ''} ${group.name?.uk || ''}`.toLowerCase()
  if (type === 'sauce' || name.includes('соус') || name.includes('padaž') || name.includes('sauce')) return '🧴'
  if (type === 'size' || name.includes('размер') || name.includes('dydis') || name.includes('size')) return '📏'
  if (type === 'addon' || name.includes('добав') || name.includes('pried')) return '🧩'
  return '✨'
}

const POSModifierDialog = memo(({
  open,
  onOpenChange,
  language,
  selectedItem,
  selectedModifiers,
  toggleModifier,
  getModifierColor,
  onCancel,
  onConfirm,
  isAddonGroup,
  onShowMeatDialog,
  onShowAddonsDialog
}: POSModifierDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-w-[95vw] bg-gray-900 border-gray-700 text-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-orange-500 text-xl sm:text-2xl font-bold">
            {language === "uk" ? "Модифікатори" : "Modifikatoriai"}
          </DialogTitle>
        </DialogHeader>
        {selectedItem && (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-xl font-bold text-white">{selectedItem.name[language]}</h3>
            </div>

            {/* Кнопки для открытия диалогов выбора мяса и добавок */}
            {(onShowMeatDialog || onShowAddonsDialog) && (
              <div className="space-y-3 sm:space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {onShowMeatDialog && (
                    <Button
                      variant="outline"
                      className="border-orange-500 text-orange-400 hover:bg-orange-500 hover:text-black bg-gray-800/50 backdrop-blur-sm text-lg py-4 h-16 transition-all duration-200 hover:scale-105"
                      onClick={onShowMeatDialog}
                    >
                      <div className="flex items-center justify-center gap-3">
                        <span className="text-2xl">🥩</span>
                        <span className="font-bold">
                          {language === "uk" ? "Вибрати м'ясо" : "Pasirinkti mėsą"}
                        </span>
                        {selectedModifiers.filter(m => m.groupId === 'meat-selection').length > 0 && (
                          <span className="bg-orange-500 text-black px-2 py-1 rounded-full text-sm font-bold">
                            {selectedModifiers.filter(m => m.groupId === 'meat-selection').length}
                          </span>
                        )}
                      </div>
                    </Button>
                  )}
                  
                  {onShowAddonsDialog && (
                    <Button
                      variant="outline"
                      className="border-green-500 text-green-400 hover:bg-green-500 hover:text-black bg-gray-800/50 backdrop-blur-sm text-lg py-4 h-16 transition-all duration-200 hover:scale-105"
                      onClick={onShowAddonsDialog}
                    >
                      <div className="flex items-center justify-center gap-3">
                        <span className="text-2xl">🧩</span>
                        <span className="font-bold">
                          {language === "uk" ? "Добавки" : "Priedai"}
                        </span>
                        {isAddonGroup && selectedModifiers.filter(m => {
                          const group: ModifierGroup = { id: m.groupId, name: m.groupName, groupId: m.groupId }
                          return isAddonGroup(group)
                        }).length > 0 && (
                          <span className="bg-green-500 text-black px-2 py-1 rounded-full text-sm font-bold">
                            {selectedModifiers.filter(m => {
                              const group: ModifierGroup = { id: m.groupId, name: m.groupName, groupId: m.groupId }
                              return isAddonGroup(group)
                            }).length}
                          </span>
                        )}
                      </div>
                    </Button>
                  )}
                </div>
              </div>
            )}

            {selectedItem.modifiers && selectedItem.modifiers.length > 0 ? (
              <div className="space-y-4">
                {selectedItem.modifiers
                  .filter(modifier => !isAddonGroup || !isAddonGroup(modifier)) // Исключаем добавки из основного диалога
                  .sort((a, b) => {
                    // Определяем приоритеты для сортировки
                    const getPriority = (modifier: ModifierGroup) => {
                      // Соусы первыми
                      if (modifier.type === 'sauce' || 
                          modifier.name?.lt?.toLowerCase().includes('падаж') || 
                          modifier.name?.uk?.toLowerCase().includes('соус')) {
                        return 1;
                      }
                      // Затем размеры
                      if (modifier.type === 'size') {
                        return 2;
                      }
                      // Все остальные
                      return 3;
                    };
                    
                    const priorityA = getPriority(a);
                    const priorityB = getPriority(b);
                    
                    if (priorityA !== priorityB) {
                      return priorityA - priorityB;
                    }
                    
                    // Если приоритеты равны, сортируем по имени
                    return (a.name?.[language] || '').localeCompare(b.name?.[language] || '');
                  })
                  .map((modifier, modifierIndex) => {
                  if (modifier.options && modifier.options.length > 0) {
                    // Сетка карточек для всех модификаторов
                    return (
                      <div key={`modifier-${modifier.id}-${modifierIndex}`}>
                        <Label className="text-white font-bold text-lg mb-3 block">
                          <span className="mr-2">{getGroupEmoji(modifier)}</span>
                          {modifier.name[language]}
                        </Label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                          {modifier.options.map((option, optionIndex) => {
                            const isSelected = selectedModifiers.some((sm) => sm.id === option.id)
                            const colorClass = getModifierColor(optionIndex, isSelected)

                            return (
                              <div
                                key={`option-${option.id}-${optionIndex}`}
                                className={`p-6 rounded-xl cursor-pointer transition-all duration-300 border-2 touch-manipulation active:scale-95 ${colorClass}`}
                                onClick={() => toggleModifier({
                                  id: option.id,
                                  name: option.name,
                                  price: option.price,
                                  groupName: modifier.name,
                                  groupId: modifier.id,
                                  type: modifier.type || 'addon',
                                  required: modifier.required || false,
                                  options: []
                                } as ModifierSelected)}
                              >
                                <div className="text-center">
                                  <div className="text-lg font-bold mb-2 whitespace-nowrap overflow-hidden text-ellipsis">{option.name[language]}</div>
                                  {option.price > 0 && (
                                    <div className="text-base opacity-90 font-bold text-orange-300">
                                      +€{option.price.toFixed(2)}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  }
                  return null
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                {language === "uk" ? "Немає доступних модифікаторів" : "Nėra galimų modifikatorių"}
              </div>
            )}

            {/* Кнопки действий */}
            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                onClick={onCancel}
                className="flex-1 bg-gray-700 border-gray-600 text-white hover:bg-gray-600 h-16 text-lg font-bold"
              >
                {language === "uk" ? "Скасувати" : "Atšaukti"}
              </Button>
              <Button
                onClick={onConfirm}
                className="flex-1 bg-orange-600 hover:bg-orange-700 text-white h-16 text-lg font-bold"
              >
                {language === "uk" ? "Додати до замовлення" : "Pridėti į užsakymą"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
})

POSModifierDialog.displayName = 'POSModifierDialog'

export default POSModifierDialog