import { memo } from 'react'
import type React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"

interface OrderItem {
  id: string
  name: string
  quantity: number
  price: number
  category: string
  notes?: string
  comment?: string
  modifiers?: Array<{
    id: string
    name: string
    name_lt?: string
    name_uk?: string
    price: number
    groupName?: string
  }>
}

type OrderTypeInfo = {
  color: string
  icon: React.ReactNode
  label: string
}

interface KitchenOrder {
  id: string
  daily_number?: string
  items: OrderItem[]
  status: "new" | "preparing" | "ready" | "completed"
  timestamp: Date
  total: number
  customer_name?: string
  phone_number?: string
  table_number?: string
  orderType?: string
  preorder_time?: string
  is_preorder?: boolean
  estimatedTime?: number
}

interface OrderCardProps {
  order: KitchenOrder
  language: 'uk' | 'lt'
  nextStatus: KitchenOrder["status"] | null
  isOverdue: boolean
  isUpdating: boolean
  onUpdateStatus: (orderId: string, newStatus: KitchenOrder["status"]) => void
  getNextStatusLabel: (status: KitchenOrder["status"]) => string
  formatTime: (date: Date | string) => string
  getModifierColor: (modifier: OrderItem['modifiers'] extends Array<infer M> ? M : unknown) => string
  getOrderTypeInfo: (orderType?: string) => OrderTypeInfo
}

export const OrderCard = memo<OrderCardProps>(({
  order,
  language,
  nextStatus,
  isOverdue,
  isUpdating,
  onUpdateStatus,
  getNextStatusLabel,
  formatTime,
  getModifierColor,
  getOrderTypeInfo
}) => {
  const orderTypeInfo = getOrderTypeInfo(order.orderType)
  const displayNumber = order.daily_number ?? order.id
  
  return (
    <Card
      className={`${
        order.status === "new"
          ? "border-orange-500 bg-gradient-to-br from-orange-50 to-red-50 shadow-orange-500/50"
          : order.status === "preparing"
            ? "border-yellow-500 bg-gradient-to-br from-yellow-50 to-orange-50 shadow-yellow-500/50"
            : "border-green-500 bg-gradient-to-br from-green-50 to-emerald-50 shadow-green-500/50"
      } shadow-2xl border-4 hover:scale-[1.02] transition-transform duration-200`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-gray-900 drop-shadow-lg">
            #{displayNumber}
          </CardTitle>
          <div className="flex flex-col items-end gap-2">
            <Badge
              className={`${
                order.status === "new"
                  ? "bg-orange-600 hover:bg-orange-700 text-white"
                  : order.status === "preparing"
                    ? "bg-yellow-600 hover:bg-yellow-700 text-white"
                    : "bg-green-600 hover:bg-green-700 text-white"
              } text-base sm:text-lg md:text-xl lg:text-2xl px-4 py-2 font-bold shadow-lg`}
            >
              {order.status === "new"
                ? (language === 'uk' ? "НОВИЙ" : "NAUJAS")
                : order.status === "preparing"
                  ? (language === 'uk' ? "ГОТУЄТЬСЯ" : "GAMINAMAS")
                  : language === 'uk' ? "ГОТОВИЙ" : "PARUOŠTAS"}
            </Badge>
            
            {order.is_preorder && order.preorder_time && (
              <Badge className="bg-purple-600 text-white text-sm sm:text-base px-3 py-1 font-bold">
                ⏰ {order.preorder_time}
              </Badge>
            )}
            
            {isOverdue && (
              <Badge className="bg-red-600 text-white text-sm sm:text-base px-3 py-1 font-bold animate-pulse">
                <AlertCircle className="w-4 h-4 mr-1 inline" />
                {language === 'uk' ? 'Прострочено' : 'Vėluoja'}
              </Badge>
            )}
          </div>
        </div>

        {order.orderType && (
          <div className="mt-2">
            <Badge className={`${orderTypeInfo.color} text-white text-sm sm:text-base px-3 py-1.5 font-bold shadow-md`}>
              {orderTypeInfo.icon}
              <span className="ml-2">{orderTypeInfo.label}</span>
            </Badge>
          </div>
        )}

        {(order.customer_name || order.phone_number || order.table_number) && (
          <div className="mt-2 space-y-1 text-sm sm:text-base text-gray-700">
            {order.customer_name && (
              <div className="font-semibold">👤 {order.customer_name}</div>
            )}
            {order.phone_number && (
              <div className="font-semibold">📞 {order.phone_number}</div>
            )}
            {order.table_number && (
              <div className="font-semibold">🪑 {language === 'uk' ? 'Стіл' : 'Stalas'} {order.table_number}</div>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent>
        <div className="space-y-3">
          {order.items.map((item, itemIndex) => {
            const hasModifiers = item.modifiers && item.modifiers.length > 0
            return (
              <div
                key={itemIndex}
                className={`p-3 sm:p-4 rounded-lg ${
                  hasModifiers ? 'bg-white/90 border-2 border-gray-300' : 'bg-white/70'
                } shadow-md`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <Badge className="bg-blue-600 text-white text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black px-3 py-1 min-w-[3rem] justify-center shadow-lg">
                        {item.quantity}×
                      </Badge>
                      <span className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black text-gray-900 drop-shadow-md font-extrabold">
                        {item.name}
                      </span>
                    </div>
                    {item.notes && (
                      <div className="mt-2 text-sm sm:text-base md:text-lg text-gray-600 italic pl-16">
                        📝 {item.notes}
                      </div>
                    )}
                    {item.comment && (
                      <div className="mt-2 p-3 bg-blue-100 rounded-lg border-l-4 border-blue-500 pl-16">
                        <div className="text-sm sm:text-base md:text-lg text-blue-800 font-medium">
                          💬 {item.comment}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {hasModifiers && (
                  <div className="mt-3 pl-4 border-l-4 border-orange-400">
                    <div className="flex flex-wrap gap-2">
                      {item.modifiers!.map((modifier, modIndex) => (
                        <span
                          key={modIndex}
                          className={`${getModifierColor(modifier)} text-sm sm:text-base md:text-lg lg:text-xl font-bold drop-shadow-lg`}
                          style={{ textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)' }}
                        >
                          {language === 'uk' ? (modifier.name_uk || modifier.name) : (modifier.name_lt || modifier.name)}
                          {(modifier.price || 0) > 0 && ` (+€${(modifier.price || 0).toFixed(2)})`}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {nextStatus && (
          <Button
            className={`w-full mt-4 h-12 text-base font-bold touch-manipulation ${
              isUpdating
                ? "bg-gray-500 cursor-wait opacity-50"
                : order.status === "new"
                  ? "bg-orange-600 hover:bg-orange-700"
                  : order.status === "preparing"
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-blue-600 hover:bg-blue-700"
            }`}
            onClick={() => onUpdateStatus(order.id, nextStatus)}
            disabled={isUpdating}
          >
            {isUpdating ? "⏳ Обработка..." : getNextStatusLabel(order.status)}
          </Button>
        )}

        <div className="text-xs text-gray-400 text-center mt-2">
          {formatTime(order.timestamp)}
        </div>
      </CardContent>
    </Card>
  )
})

OrderCard.displayName = 'OrderCard'
