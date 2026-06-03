"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import type { Modifier } from "@/types/pos"

interface MenuItem {
  id: string
  name: { lt: string; uk: string }
  modifiers?: Modifier[]
}

interface POSAddonsDialogProps {
  isOpen: boolean
  onClose: () => void
  language: "lt" | "uk"
  selectedItem: MenuItem | null
  selectedModifiers: Modifier[]
  onToggleModifier: (modifier: Modifier) => void
  getModifierColor: (index: number, isSelected: boolean) => string
  isAddonGroup: (modifier: Modifier) => boolean
}

// Функция для определения эмодзи добавки
const getAddonEmoji = (nameObj: { lt?: string; uk?: string } | string): string => {
  const name = (typeof nameObj === 'string' ? nameObj : (nameObj?.lt || nameObj?.uk || '')).toLowerCase()
  if (name.includes('fri') || name.includes('картоф') || name.includes('bulv') || name.includes('french')) return '🍟'
  if (name.includes('rice') || name.includes('ryž') || name.includes('рис')) return '🍚'
  if (name.includes('salad') || name.includes('salot') || name.includes('салат')) return '🥗'
  if (name.includes('sūri') || name.includes('moz') || name.includes('feta') || name.includes('cheese') || name.includes('сыр')) return '🧀'
  if (name.includes('bacon') || name.includes('šonin') || name.includes('kump') || name.includes('bekon') || name.includes('бекон') || name.includes('ham')) return '🥓'
  if (name.includes('pomidor') || name.includes('tomat') || name.includes('помид') || name.includes('томат')) return '🍅'
  if (name.includes('agurk') || name.includes('cucumber') || name.includes('огур')) return '🥒'
  if (name.includes('svogūn') || name.includes('svogun') || name.includes('onion') || name.includes('лук')) return '🧅'
  if (name.includes('jalap') || name.includes('chili') || name.includes('čili') || name.includes('aštr') || name.includes('остр')) return '🌶️'
  if (name.includes('gryb') || name.includes('mushroom') || name.includes('гриб')) return '🍄'
  if (name.includes('kukurūz') || name.includes('kukuruz') || name.includes('corn') || name.includes('кукуруз')) return '🌽'
  if (name.includes('avokad') || name.includes('avocad') || name.includes('авокад')) return '🥑'
  if (name.includes('kiauš') || name.includes('kiaušini') || name.includes('egg') || name.includes('яйц')) return '🥚'
  if (name.includes('alyvuog') || name.includes('olive') || name.includes('олив')) return '🫒'
  if (name.includes('kapar') || name.includes('capers') || name.includes('капер')) return '🧂'
  if (name.includes('padaž') || name.includes('sauce') || name.includes('соус') || name.includes('ketchup') || name.includes('majonez') || name.includes('майон') || name.includes('кетч')) return '🧴'
  return '➕'
}

export default function POSAddonsDialog({
  isOpen,
  onClose,
  language,
  selectedItem,
  selectedModifiers,
  onToggleModifier,
  getModifierColor,
  isAddonGroup
}: POSAddonsDialogProps) {
  
  const translations = {
    uk: {
      title: "Добавки",
      noAddons: "Для этого блюда нет доступных добавок",
      noModifiers: "Для этого блюда нет модификаторов"
    },
    lt: {
      title: "Priedai",
      noAddons: "Šiam patiekalui nėra priedų",
      noModifiers: "Šiam patiekalui nėra modifikatorių"
    }
  }

  const t = translations[language]

  const addonModifiers = selectedItem?.modifiers?.filter(modifier => isAddonGroup(modifier)) || []
  const hasAddons = addonModifiers.length > 0

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-w-[95vw] bg-gray-900 border-gray-700 text-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-green-500 text-xl sm:text-2xl font-bold">
            {t.title}
          </DialogTitle>
        </DialogHeader>
        {selectedItem && (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-xl font-bold text-white">{selectedItem.name[language]}</h3>
            </div>

            {hasAddons ? (
              <div className="space-y-4">
                {addonModifiers.map((modifier, modifierIndex) => {
                  if (modifier.options && modifier.options.length > 0) {
                    return (
                      <div key={`addon-modifier-${modifier.id}-${modifierIndex}`}>
                        <Label className="text-white font-bold text-lg mb-3 block">
                          {modifier.name[language]}
                        </Label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                          {modifier.options.map((option, optionIndex) => {
                            const isSelected = selectedModifiers.some((sm) => sm.id === option.id)
                            const colorClass = getModifierColor(optionIndex, isSelected)
                            return (
                              <div
                                key={`addon-option-${option.id}-${optionIndex}`}
                                className={`p-6 rounded-xl cursor-pointer transition-all duration-300 border-2 touch-manipulation active:scale-95 ${colorClass}`}
                                onClick={() => onToggleModifier({
                                  id: option.id,
                                  name: option.name,
                                  price: option.price,
                                  groupName: modifier.name,
                                  groupId: modifier.id,
                                  type: modifier.type || 'addon',
                                  required: modifier.required || false,
                                  options: []
                                } as Modifier)}
                              >
                                <div className="text-center">
                                  <div className="text-3xl mb-2">{getAddonEmoji(option.name)}</div>
                                  <div className="text-base font-bold mb-2 whitespace-nowrap overflow-hidden text-ellipsis">{option.name[language]}</div>
                                  {option.price > 0 && (
                                    <div className="text-lg opacity-90 font-bold text-green-300">
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
                  } else {
                    // Если опций нет, показываем сам модификатор
                    return (
                      <div key={`addon-modifier-${modifier.id}-${modifierIndex}`}>
                        <Label className="text-white font-bold text-lg">
                          {modifier.name[language]}
                        </Label>
                        <div className="mt-2">
                          <div
                            className={`flex items-center justify-between px-8 py-5 rounded-xl cursor-pointer transition-all duration-300 border-2 touch-manipulation active:scale-95 ${
                              getModifierColor(modifierIndex, selectedModifiers.some((sm) => sm.id === modifier.id))
                            }`}
                            onClick={() => onToggleModifier(modifier)}
                          >
                            <span className="text-base font-bold truncate">{modifier.name[language]}</span>
                            <span className="text-lg font-bold text-green-300">
                              {modifier.price > 0 ? `+€${modifier.price.toFixed(2)}` : ""}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  }
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-6xl mb-4">🍟</div>
                <p className="text-gray-400 text-lg">
                  {selectedItem.modifiers && selectedItem.modifiers.length > 0 ? t.noAddons : t.noModifiers}
                </p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
