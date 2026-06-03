"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

interface POSPreorderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  language: "uk" | "lt"
  preorderTime: string
  onPreorderTimeChange: (time: string) => void
  onConfirm: () => void
  onCancel: () => void
  t: {
    preorderTime: string
    selectTime: string
    cancel: string
    confirm: string
  }
}

export default function POSPreorderDialog({
  open,
  onOpenChange,
  language,
  preorderTime,
  onPreorderTimeChange,
  onConfirm,
  onCancel,
  t
}: POSPreorderDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-w-[95vw] bg-gray-900 border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle className="text-purple-500 text-xl font-bold flex items-center gap-2">
            ⏰ {t.preorderTime}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label className="block text-sm font-medium text-gray-300 mb-2">
              {t.selectTime}:
            </Label>
            <input
              type="time"
              lang={language}
              value={preorderTime}
              onChange={(e) => onPreorderTimeChange(e.target.value)}
              className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-lg text-center font-mono"
              step={60}
              autoFocus
            />
            <p className="text-xs text-gray-400 mt-2">
              {language === 'uk' ? 'Формат 24 години: 00:00–23:59' : '24 valandų formatas: 00:00–23:59'}
            </p>
          </div>
          
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onCancel}
              className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-700 bg-transparent"
            >
              {t.cancel}
            </Button>
            <Button
              onClick={onConfirm}
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold"
              disabled={!preorderTime}
            >
              ✓ {t.confirm}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
