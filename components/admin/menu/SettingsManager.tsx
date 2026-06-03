'use client'

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface SettingsManagerProps {
  showSettingsDialog: boolean
  setShowSettingsDialog: (show: boolean) => void
  packagingCost: number
  setPackagingCost: (cost: number) => void
  woltPackagingCost: number
  setWoltPackagingCost: (cost: number) => void
  boltPackagingCost: number
  setBoltPackagingCost: (cost: number) => void
  saveSettings: () => void
}

export function SettingsManager({ 
  showSettingsDialog,
  setShowSettingsDialog,
  woltPackagingCost,
  boltPackagingCost,
  packagingCost,
  setWoltPackagingCost,
  setBoltPackagingCost,
  setPackagingCost,
  saveSettings
}: SettingsManagerProps) {
  return (
    <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
      <DialogContent className="bg-black border-orange-500 max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-orange-500 text-xl">Настройки упаковки</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-orange-300 text-lg font-semibold">
              Цены за упаковку
            </Label>
            <p className="text-xs text-gray-400 mt-1 mb-4">
              Для доставки через разные службы
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label htmlFor="wolt-packaging-cost" className="text-blue-300 flex items-center gap-2 text-lg">
                🚙 Wolt (€)
              </Label>
              <Input
                id="wolt-packaging-cost"
                type="number"
                step="0.01"
                min="0"
                value={woltPackagingCost}
                onChange={(e) => setWoltPackagingCost(parseFloat(e.target.value) || 0)}
                className="bg-black border-blue-500 text-blue-300 focus:border-blue-400 h-12 text-lg"
              />
            </div>

            <div>
              <Label htmlFor="bolt-packaging-cost" className="text-green-300 flex items-center gap-2 text-lg">
                🚗 Bolt (€)
              </Label>
              <Input
                id="bolt-packaging-cost"
                type="number"
                step="0.01"
                min="0"
                value={boltPackagingCost}
                onChange={(e) => setBoltPackagingCost(parseFloat(e.target.value) || 0)}
                className="bg-black border-green-500 text-green-300 focus:border-green-400 h-12 text-lg"
              />
            </div>

            <div>
              <Label htmlFor="packaging-cost" className="text-amber-300 flex items-center gap-2 text-lg">
                📦 Общая (€)
              </Label>
              <Input
                id="packaging-cost"
                type="number"
                step="0.01"
                min="0"
                value={packagingCost}
                onChange={(e) => setPackagingCost(parseFloat(e.target.value) || 0)}
                className="bg-black border-amber-500 text-amber-300 focus:border-amber-400 h-12 text-lg"
              />
              <p className="text-xs text-gray-400 mt-1">
                Для заказов без указания службы
              </p>
            </div>
          </div>

          <div className="bg-blue-900/20 border border-blue-500 rounded p-4">
            <p className="text-sm text-blue-300 mb-3">
              💡 <strong>Пример для 3 товаров:</strong>
            </p>
            <div className="space-y-2 text-base">
              <div className="flex justify-between">
                <span>🚙 Wolt:</span>
                <span>€{(woltPackagingCost * 3).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>🚗 Bolt:</span>
                <span>€{(boltPackagingCost * 3).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>📦 Общая:</span>
                <span>€{(packagingCost * 3).toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button onClick={saveSettings} className="flex-1 bg-orange-500 hover:bg-orange-600 h-12 text-lg">
              Сохранить
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setShowSettingsDialog(false)} 
              className="flex-1 border-gray-500 text-gray-300 h-12 text-lg"
            >
              Отмена
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}