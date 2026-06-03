"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

interface POSPhoneDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  language: "uk" | "lt"
  phoneNumber: string
  customerName: string
  onPhoneNumberChange: (phone: string) => void
  onCustomerNameChange: (name: string) => void
  onConfirm: () => void
  onCancel: () => void
  t: {
    cancel: string
    confirm: string
  }
}

export default function POSPhoneDialog({
  open,
  onOpenChange,
  language,
  phoneNumber,
  customerName,
  onPhoneNumberChange,
  onCustomerNameChange,
  onConfirm,
  onCancel,
  t
}: POSPhoneDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-w-[95vw] bg-gray-900 border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle className="text-blue-500 text-xl font-bold flex items-center gap-2">
            📞 {language === 'uk' ? 'Номер телефону' : 'Telefono numeris'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label className="block text-sm font-medium text-gray-300 mb-2">
              {language === 'uk' ? 'Номер телефону:' : 'Telefono numeris:'}
            </Label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => onPhoneNumberChange(e.target.value)}
              placeholder={language === 'uk' ? '+380XXXXXXXXX' : '+370XXXXXXXX'}
              className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
            <p className="text-xs text-gray-400 mt-2">
              {language === 'uk' ? 'Формат: +380XXXXXXXXX' : 'Formatas: +370XXXXXXXX'}
            </p>
          </div>
          
          <div>
            <Label className="block text-sm font-medium text-gray-300 mb-2">
              {language === 'uk' ? 'Ім\'я клієнта (необов\'язково):' : 'Kliento vardas (neprivaloma):'}
            </Label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => onCustomerNameChange(e.target.value)}
              placeholder={language === 'uk' ? 'Введіть ім\'я' : 'Įveskite vardą'}
              className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
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
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold"
              disabled={!phoneNumber.trim()}
            >
              ✓ {t.confirm}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
