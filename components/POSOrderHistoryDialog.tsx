"use client"

import { memo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { CompletedOrder } from "@/types/pos"

interface POSOrderHistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  completedOrders: CompletedOrder[]
  readyForDeliveryCount: number
  language: "uk" | "lt"
  t: Record<string, string>
  deliveringOrders: Set<string>
  getOrderStatusColor: (status?: string) => string
  translateOrderStatus: (status?: string) => string
  markOrderAsDelivered: (orderId: string) => void
  onDeleteClick: (order: CompletedOrder) => void
  onReorderClick?: (order: CompletedOrder) => void
}

function POSOrderHistoryDialog({
  open,
  onOpenChange,
  completedOrders,
  readyForDeliveryCount,
  language,
  t,
  deliveringOrders,
  getOrderStatusColor,
  translateOrderStatus,
  markOrderAsDelivered,
  onDeleteClick,
  onReorderClick,
}: POSOrderHistoryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-w-[95vw] bg-gray-900 border-gray-700 text-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-orange-500 text-xl font-bold flex items-center gap-2">
            📋 {t.orderHistoryToday}
            <span className={`text-black text-sm px-2 py-1 rounded-full font-black ${
              readyForDeliveryCount > 0 ? 'bg-green-500 animate-pulse' : 'bg-orange-500'
            }`}>
              {readyForDeliveryCount}
            </span>
            {readyForDeliveryCount > 0 && (
              <span className="text-green-400 text-sm font-medium">
                {language === 'uk' ? 'готові до видачі' : 'paruošti išdavimui'}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {completedOrders.length === 0 ? (
            <p className="text-gray-400 text-center py-8">
              {t.noOrdersYet}
            </p>
          ) : (
            <div className="space-y-3">
              {completedOrders.map((order) => {
                const normalizedStatus = (order.status || '').toString().trim().toLowerCase()
                const displayNumber = order.daily_number ?? order.id

                return (
                <div key={order.id} className={`rounded-lg p-4 border ${
                  order.status === 'cancelled' 
                    ? 'bg-gradient-to-br from-red-900/20 to-gray-800 border-red-500 opacity-70' 
                    : order.is_preorder 
                      ? 'bg-gradient-to-br from-purple-900/20 to-gray-800 border-purple-500 shadow-purple-500/30 shadow-lg' 
                      : 'bg-gray-800 border-gray-700'
                }`}>
                  {/* Заголовок заказа */}
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-orange-400 font-bold">#{String(displayNumber)}</span>
                        <span className={`text-xs px-2 py-1 rounded-full ${getOrderStatusColor(order.status)}`}>
                          {translateOrderStatus(order.status)}
                        </span>
                        {order.is_preorder && (
                          <span className="text-xs font-bold px-2 py-1 rounded-full bg-purple-600 text-white border border-purple-400">
                            ⏰ {t.preorder}
                          </span>
                        )}
                        {order.is_preorder && order.preorder_time && (
                          <span className="text-xs font-bold px-2 py-1 rounded-full bg-purple-900 text-purple-300 border border-purple-500">
                            ⏰ {order.preorder_time}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400">
                        {order.timestamp.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-orange-500">
                        €{order.total.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-400">
                        {order.orderType}
                      </div>
                    </div>
                  </div>

                  {/* Контакты и скидка */}
                  {(order.customer_name || order.phone_number || order.table_number) && (
                    <div className="mb-3 p-2 bg-gray-700 rounded text-xs">
                      {order.customer_name && (
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-gray-400">👤</span>
                          <span className="text-white">{order.customer_name}</span>
                        </div>
                      )}
                      {order.phone_number && (
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-gray-400">📞</span>
                          <span className="text-white">{order.phone_number}</span>
                        </div>
                      )}
                      {order.table_number && (
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-gray-400">🪑</span>
                          <span className="text-white">{language === 'uk' ? 'Стіл' : 'Stalas'} {order.table_number}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Товары */}
                  <div className="space-y-2">
                    {order.items.map((item, idx) => (
                      <div key={`${item.id}-${idx}`} className="flex justify-between items-start text-sm">
                        <div className="flex-1">
                          <div className="text-white font-medium">
                            {item.name[language]} x{item.quantity}
                          </div>
                          {item.selectedModifiers && item.selectedModifiers.length > 0 && (
                            <div className="text-xs text-orange-300 mt-1">
                              {item.selectedModifiers.map(mod => mod.name[language]).join(", ")}
                            </div>
                          )}
                          {item.comment && (
                            <div className="text-xs text-blue-400 mt-1 italic">💬 {item.comment}</div>
                          )}
                        </div>
                        <div className="text-orange-400 font-medium ml-2">
                          €{((item.price + (item.selectedModifiers || []).reduce((sum, mod) => sum + mod.price, 0)) * item.quantity).toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Действия */}
                  {order.status === 'ready' && (
                    <div className="mt-4 pt-3 border-t border-gray-600">
                      <Button
                        onClick={() => markOrderAsDelivered(order.id)}
                        disabled={deliveringOrders.has(order.id)}
                        className={`w-full font-black py-6 text-2xl ${
                          deliveringOrders.has(order.id)
                            ? 'bg-gray-500 cursor-wait opacity-50'
                            : 'bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-500/50 hover:shadow-green-500/70 transition-all'
                        }`}
                      >
                        {deliveringOrders.has(order.id) ? '⏳ Обработка...' : t.delivery}
                      </Button>
                    </div>
                  )}

                  {/* Кнопка дозамовлення - тільки для нових замовлень */}
                  {onReorderClick && order.status === 'new' && (
                    <div className="mt-4 pt-3 border-t border-gray-600">
                      <Button
                        onClick={() => onReorderClick(order)}
                        className="w-full bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 hover:from-blue-700 hover:via-blue-600 hover:to-cyan-600 text-white font-black py-6 text-xl shadow-lg shadow-blue-500/50 hover:shadow-blue-500/70 hover:scale-[1.02] transition-all duration-200 border-2 border-blue-400"
                      >
                        <span className="flex items-center justify-center gap-2">
                          ➕ {language === 'uk' ? 'Дозамовити' : 'Papildyti užsakymą'}
                        </span>
                      </Button>
                    </div>
                  )}

                  {/* Кнопка отмены только для активных (new/ready) заказов */}
                  {(normalizedStatus === 'new' || normalizedStatus === 'ready') && (
                    <div className="mt-4 pt-3 border-t border-gray-600">
                      <Button
                        variant="outline"
                        onClick={() => onDeleteClick(order)}
                        className="w-full border-red-500 text-red-400 hover:bg-red-500 hover:text-white"
                      >
                        🗑️ {language === 'uk' ? 'Скасувати замовлення' : 'Atšaukti užsakymą'}
                      </Button>
                    </div>
                  )}
                </div>
                )
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default memo(POSOrderHistoryDialog)
