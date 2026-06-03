"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { Modifier } from "@/types/pos"

interface POSMeatDialogProps {
  isOpen: boolean
  onClose: () => void
  language: "lt" | "uk"
  selectedModifiers: Modifier[]
  onToggleModifier: (modifier: Modifier) => void
  getModifierColor: (index: number, isSelected: boolean) => string
}

const MEAT_OPTIONS = [
  { id: 'chicken', name: { lt: 'Vištiena', uk: "Курка" }, emoji: '🍗' },
  { id: 'beef', name: { lt: 'Jautiena', uk: "Яловичина" }, emoji: '🥩' },
  { id: 'pork', name: { lt: 'Kiauliena', uk: "Свинина" }, emoji: '🥓' }
]

export default function POSMeatDialog({
  isOpen,
  onClose,
  language,
  selectedModifiers,
  onToggleModifier,
  getModifierColor
}: POSMeatDialogProps) {
  
  const translations = {
    uk: {
      title: "Вибрати м'ясо"
    },
    lt: {
      title: "Pasirinkti mėsą"
    }
  }

  const t = translations[language]

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-w-[95vw] bg-gray-900 border-gray-700 text-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-orange-500 text-xl sm:text-2xl font-bold">
            {t.title}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-4">
            {MEAT_OPTIONS.map((meat, index) => {
              const isSelected = selectedModifiers.some((sm) => sm.id === meat.id)
              const colorClass = getModifierColor(index, isSelected)
              
              return (
                <div
                  key={meat.id}
                  className={`p-6 rounded-lg cursor-pointer transition-all duration-300 border-2 ${colorClass}`}
                  onClick={() => onToggleModifier({
                    id: meat.id,
                    name: meat.name,
                    price: 0,
                    groupName: { lt: 'Mėsa', uk: "М'ясо" },
                    groupId: 'meat-selection',
                    type: 'addon',
                    required: false,
                    options: []
                  } as Modifier)}
                >
                  <div className="text-center">
                    <div className="text-4xl mb-3">{meat.emoji}</div>
                    <div className="text-lg font-bold">{meat.name[language]}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
