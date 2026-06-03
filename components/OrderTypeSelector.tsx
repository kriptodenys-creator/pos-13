"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Store, Phone, ShoppingBag, Car } from "lucide-react"

interface OrderTypeSelectorProps {
  selectedOrderType: string
  onOrderTypeChange: (type: string) => void
  language?: "uk" | "lt"
}

export default function OrderTypeSelector({
  selectedOrderType,
  onOrderTypeChange,
  language = "uk"
}: OrderTypeSelectorProps) {
  const [showDeliveryDialog, setShowDeliveryDialog] = useState(false)

  const orderTypes = [
    {
      id: 'dine-in',
      name: { uk: 'В закладі', lt: 'Vietoje' },
      icon: <Store className="w-5 h-5" />,
      color: 'bg-green-600'
    },
    {
      id: 'phone',
      name: { uk: 'По телефону', lt: 'Telefonu' },
      icon: <Phone className="w-5 h-5" />,
      color: 'bg-blue-600'
    },
    {
      id: 'takeaway',
      name: { uk: 'На винос', lt: 'Išsinešti' },
      icon: <ShoppingBag className="w-5 h-5" />,
      color: 'bg-purple-600'
    },
    {
      id: 'delivery',
      name: { uk: 'Доставка', lt: 'Pristatymas' },
      icon: <Car className="w-5 h-5" />,
      color: 'bg-orange-600'
    }
  ]

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        {orderTypes.map((type) => (
          <Button
            key={type.id}
            variant={selectedOrderType === type.name[language] || selectedOrderType.startsWith(type.name[language]) ? "default" : "outline"}
            size="default"
            onClick={() => {
              if (type.id === 'delivery') {
                setShowDeliveryDialog(true)
              } else {
                onOrderTypeChange(type.name[language])
              }
            }}
            className={`${
              selectedOrderType === type.name[language] || selectedOrderType.startsWith(type.name[language])
                ? type.color + " text-white border-transparent shadow-lg"
                : `border-gray-600 text-gray-300 bg-transparent hover:${type.color} hover:text-white hover:border-transparent hover:shadow-lg`
            } flex items-center gap-3 text-base sm:text-lg p-4 sm:p-5 h-16 sm:h-18 transition-all duration-200 hover:scale-105 font-bold`}
          >
            {type.icon}
            <span className="truncate">{type.name[language]}</span>
          </Button>
        ))}
      </div>

      {/* Диалог выбора службы доставки */}
      <Dialog open={showDeliveryDialog} onOpenChange={setShowDeliveryDialog}>
        <DialogContent className="bg-gray-900 border-orange-500 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-orange-500">
              {language === 'uk' ? 'Выберите службу доставки' : 'Pasirinkite pristatymo tarnybą'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3">
            <Button
              className="h-14 text-left justify-start gap-3 bg-blue-600 hover:bg-blue-700 text-white text-lg font-bold"
              onClick={() => {
                const deliveryName = language === 'uk' ? 'Доставка' : 'Pristatymas'
                onOrderTypeChange(`${deliveryName} • Wolt`)
                setShowDeliveryDialog(false)
              }}
            >
              🚙 Wolt
            </Button>
            <Button
              className="h-14 text-left justify-start gap-3 bg-green-600 hover:bg-green-700 text-white text-lg font-bold"
              onClick={() => {
                const deliveryName = language === 'uk' ? 'Доставка' : 'Pristatymas'
                onOrderTypeChange(`${deliveryName} • Bolt`)
                setShowDeliveryDialog(false)
              }}
            >
              🚗 Bolt Food
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
