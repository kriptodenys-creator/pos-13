"use client"

import { memo } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Plus, Minus, Trash2, MessageSquare } from "lucide-react"
import EmployeeDiscountButton from "@/components/EmployeeDiscountButton"
import OrderTypeSelector from "@/components/OrderTypeSelector"
import type { Modifier } from "@/types/pos"

 const ltNounForm = (n: number, forms: { one: string; few: string; many: string }) => {
   const abs = Math.abs(n)
   const last = abs % 10
   const lastTwo = abs % 100
   if (last === 1 && lastTwo !== 11) return forms.one
   if (last >= 2 && last <= 9 && !(lastTwo >= 12 && lastTwo <= 19)) return forms.few
   return forms.many
 }

 const ltTwoDigitsToWords = (n: number): string => {
   const ones = [
     "nulis",
     "vienas",
     "du",
     "trys",
     "keturi",
     "penki",
     "šeši",
     "septyni",
     "aštuoni",
     "devyni",
   ]
   const teens = [
     "dešimt",
     "vienuolika",
     "dvylika",
     "trylika",
     "keturiolika",
     "penkiolika",
     "šešiolika",
     "septyniolika",
     "aštuoniolika",
     "devyniolika",
   ]
   const tens = [
     "",
     "",
     "dvidešimt",
     "trisdešimt",
     "keturiasdešimt",
     "penkiasdešimt",
     "šešiasdešimt",
     "septyniasdešimt",
     "aštuoniasdešimt",
     "devyniasdešimt",
   ]

   if (n < 10) return ones[n]
   if (n >= 10 && n < 20) return teens[n - 10]
   const t = Math.floor(n / 10)
   const o = n % 10
   return [tens[t], o ? ones[o] : ""].filter(Boolean).join(" ")
 }

 const ltThreeDigitsToWords = (n: number): string => {
   const ones = [
     "nulis",
     "vienas",
     "du",
     "trys",
     "keturi",
     "penki",
     "šeši",
     "septyni",
     "aštuoni",
     "devyni",
   ]
   const hundredsForms = [
     "",
     "šimtas",
     "du šimtai",
     "trys šimtai",
     "keturi šimtai",
     "penki šimtai",
     "šeši šimtai",
     "septyni šimtai",
     "aštuoni šimtai",
     "devyni šimtai",
   ]

   if (n < 100) return ltTwoDigitsToWords(n)
   const h = Math.floor(n / 100)
   const rest = n % 100
   const hundredPart = hundredsForms[h] || `${ones[h]} šimtai`
   return [hundredPart, rest ? ltTwoDigitsToWords(rest) : ""].filter(Boolean).join(" ")
 }

 const ltNumberToWords = (n: number): string => {
   if (!Number.isFinite(n)) return ""
   const num = Math.floor(Math.abs(n))
   if (num === 0) return "nulis"
   if (num < 1000) return ltThreeDigitsToWords(num)

   const thousands = Math.floor(num / 1000)
   const rest = num % 1000
   const thousandWord = ltNounForm(thousands, { one: "tūkstantis", few: "tūkstančiai", many: "tūkstančių" })
   return [
     `${ltNumberToWords(thousands)} ${thousandWord}`,
     rest ? ltThreeDigitsToWords(rest) : "",
   ]
     .filter(Boolean)
     .join(" ")
 }

 const ltMoneyToWords = (amount: number): string => {
   if (!Number.isFinite(amount)) return ""
   let euros = Math.floor(amount)
   let cents = Math.round((amount - euros) * 100)
   if (cents === 100) {
     euros += 1
     cents = 0
   }
   const euroWord = ltNounForm(euros, { one: "euras", few: "eurai", many: "eurų" })
   const centWord = ltNounForm(cents, { one: "centas", few: "centai", many: "centų" })
   const parts = [`${ltNumberToWords(euros)} ${euroWord}`]
   if (cents > 0) parts.push(`${ltNumberToWords(cents)} ${centWord}`)
   return parts.join(" ")
 }

 const ltToRuTranscription = (text: string): string => {
   const lower = text
     .toLowerCase()
     .replaceAll("eu", "эу")
     .replaceAll("dž", "дж")
     .replaceAll("dz", "дз")
     .replaceAll("ie", "е")
     .replaceAll("uo", "уо")
     .replaceAll("ai", "ай")
     .replaceAll("ei", "эй")
     .replaceAll("au", "ау")

   const map: Record<string, string> = {
     "a": "а",
     "ą": "а",
     "b": "б",
     "d": "д",
     "e": "е",
     "č": "ч",
     "ę": "е",
     "ė": "э",
     "f": "ф",
     "g": "г",
     "i": "и",
     "į": "и",
     "k": "к",
     "l": "л",
     "m": "м",
     "n": "н",
     "o": "о",
     "p": "п",
     "r": "р",
     "s": "с",
     "š": "ш",
     "t": "т",
     "u": "у",
     "ų": "у",
     "ū": "у",
     "ž": "ж",
     "y": "и",
     "v": "в",
     "j": "й",
     "c": "ц",
     "h": "х",
     "w": "в",
   }

   return lower
     .split("")
     .map((ch) => map[ch] ?? ch)
     .join("")
     .replaceAll(/\s+/g, " ")
     .trim()
 }

interface CartItem {
  id: string
  name: { lt: string; uk: string }
  price: number
  original_price?: number
  happy_hour_discount?: number
  quantity: number
  selectedModifiers: Modifier[]
  comment?: string
}

interface EmployeeDiscount {
  employeeId: number
  employeeName: string
  discountPercent: number
}

interface POSCartProps {
  isOpen: boolean
  onClose: () => void
  orderItems: CartItem[]
  language: "lt" | "uk"
  orderType: string
  selectedOrderTypeId: string
  employeeDiscount: EmployeeDiscount | null
  packagingCost: number
  woltPackagingCost: number
  boltPackagingCost: number
  onOrderTypeChange: (type: string) => void
  onUpdateQuantity: (itemId: string, modifiers: Modifier[], newQuantity: number) => void
  onClearOrder: () => void
  onOpenCommentDialog: (item: CartItem) => void
  onCompleteOrder: (selectedOrderType?: string, employeeDiscount?: EmployeeDiscount) => void
  onEmployeeDiscountApplied: (discount: EmployeeDiscount) => void
  onEmployeeDiscountRemoved: () => void
  onPreorderClick?: () => void
  isSubmitting?: boolean
  calculateTotal: () => { itemsTotal: number; packagingTotal: number; discountAmount: number; grandTotal: number }
  translations: {
    currentOrder: string
    orderEmpty: string
    total: string
    completeOrder: string
    items: string
    packaging: string
    toPay: string
  }
}

const POSCart = memo(({
  isOpen,
  onClose,
  orderItems,
  language,
  orderType,
  selectedOrderTypeId,
  employeeDiscount,
  packagingCost,
  onOrderTypeChange,
  onUpdateQuantity,
  onClearOrder,
  onOpenCommentDialog,
  onCompleteOrder,
  onEmployeeDiscountApplied,
  onEmployeeDiscountRemoved,
  onPreorderClick,
  isSubmitting = false,
  calculateTotal,
  translations: t
}: POSCartProps) => {
  const { itemsTotal, packagingTotal, discountAmount, grandTotal } = calculateTotal()

  const handleCompleteOrder = () => {
    // Validate that order type is selected before completing
    if (!orderType || orderType.trim() === "") {
      const message = language === 'uk' 
        ? '⚠️ УВАГА!\n\nОберіть тип замовлення перед оформленням:\n• В закладі\n• На винос\n• По телефону' 
        : '⚠️ DĖMESIO!\n\nPasirinkite užsakymo tipą prieš užbaigiant:\n• Vietoje\n• Išsinešti\n• Telefonu'
      alert(message)
      return
    }
    
    onCompleteOrder(orderType, employeeDiscount || undefined)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl max-w-[95vw] bg-gray-900 border-gray-700 text-white max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="text-orange-500 text-2xl font-bold">
              {t.currentOrder}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {orderItems.length > 0 && (
                <>
                  <EmployeeDiscountButton
                    onDiscountApplied={onEmployeeDiscountApplied}
                    onDiscountRemoved={onEmployeeDiscountRemoved}
                    currentDiscount={employeeDiscount ? {
                      employeeName: employeeDiscount.employeeName,
                      discountPercent: employeeDiscount.discountPercent
                    } : null}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onClearOrder}
                    className="bg-red-600 border-red-600 text-white hover:bg-red-700 h-10 w-10 p-0 mr-2"
                  >
                    <Trash2 className="w-5 h-5" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3">
          {orderItems.length > 0 ? (
            <>
              {/* Список товаров */}
              {orderItems.map((item, index) => (
                <div key={`${item.id}-${index}`} className="p-4 bg-gray-8800 rounded-lg space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="flex-1">
                      <h4 className="font-bold text-lg">{item.name[language]}</h4>
                      {item.selectedModifiers && item.selectedModifiers.length > 0 && (
                        <p className="text-base text-orange-300 mt-1 font-semibold">
                          {item.selectedModifiers.map(mod => mod.name[language]).join(", ")}
                        </p>
                      )}
                      {(item.happy_hour_discount || 0) > 0 && (item.original_price ?? item.price) > (item.price || 0) ? (
                        <div className="mt-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm line-through text-gray-500">
                              €{Number(item.original_price ?? item.price).toFixed(2)}
                            </span>
                            <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full font-bold">
                              -{Number(item.happy_hour_discount).toFixed(0)}%
                            </span>
                          </div>
                          <p className="text-orange-500 font-bold text-xl">
                            €{Number(item.price || 0).toFixed(2)}
                          </p>
                        </div>
                      ) : (
                        <p className="text-orange-500 font-bold text-xl mt-1">
                          €{(item.price || 0).toFixed(2)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onOpenCommentDialog(item)}
                        className={`w-10 h-10 p-0 ${
                          item.comment 
                            ? 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700' 
                            : 'bg-blue-500 border-blue-500 text-white hover:bg-blue-600'
                        }`}
                      >
                        <MessageSquare className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onUpdateQuantity(item.id, item.selectedModifiers, item.quantity - 1)}
                        className="w-10 h-10 p-0 bg-black border-black text-white hover:bg-gray-800"
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <span className="w-10 text-center text-base font-medium">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onUpdateQuantity(item.id, item.selectedModifiers, item.quantity + 1)}
                        className="w-10 h-10 p-0 bg-black border-black text-white hover:bg-gray-800"
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Комментарий к блюду */}
                  {item.comment && (
                    <div className="mt-2 p-2 bg-blue-900/30 rounded border-l-2 border-blue-500">
                      <span className="text-xs text-blue-400 italic">
                        💬 {item.comment}
                      </span>
                    </div>
                  )}
                </div>
              ))}

              {/* Итоги */}
              <div className="border-t border-gray-700 pt-4">
                <div className="space-y-3 mb-6">
                  {/* Сумма товаров */}
                  <div className="flex justify-between items-center text-gray-300">
                    <span>{t.items}:</span>
                    <span>€{itemsTotal.toFixed(2)}</span>
                  </div>
                  
                  {/* Упаковка для доставки */}
                  {selectedOrderTypeId === 'delivery' && packagingTotal > 0 && (
                    <div className="flex justify-between items-center text-gray-300">
                      <span className="flex items-center gap-2">
                        📦 {t.packaging}
                        <span className="text-xs text-gray-500">
                          ({orderItems.reduce((sum, item) => sum + item.quantity, 0)} × €{packagingCost.toFixed(2)})
                        </span>
                      </span>
                      <span>€{packagingTotal.toFixed(2)}</span>
                    </div>
                  )}
                  
                  {/* Скидка сотрудника */}
                  {employeeDiscount && employeeDiscount.discountPercent > 0 && (
                    <div className="flex justify-between items-center text-green-400">
                      <span>
                        💳 {employeeDiscount.employeeName} ({employeeDiscount.discountPercent}%)
                      </span>
                      <span>-€{discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                </div>

                {/* Общая сумма */}
                <div className="border-t border-gray-700 pt-4">
                  <div className="flex justify-between items-center text-xl font-bold">
                    <span>{t.toPay}:</span>
                    <span className="text-orange-500">€{grandTotal.toFixed(2)}</span>
                  </div>
                  {language === "lt" && grandTotal > 0 && (
                    <div className="mt-2 text-xs text-gray-400 space-y-1">
                      <div>
                        LT: <span className="text-gray-300">{ltMoneyToWords(grandTotal)}</span>
                      </div>
                      <div className="text-sm text-gray-200">
                        RU транскр.: <span className="font-semibold">{ltToRuTranscription(ltMoneyToWords(grandTotal))}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Выбор типа заказа */}
                <div className="mt-6">
                  <OrderTypeSelector
                    selectedOrderType={orderType}
                    onOrderTypeChange={onOrderTypeChange}
                    language={language}
                  />
                </div>

                {/* Кнопка предзаказа */}
                {onPreorderClick && (
                  <div className="mt-4">
                    <Button
                      variant="outline"
                      onClick={onPreorderClick}
                      className="w-full border-orange-500 text-orange-400 hover:bg-orange-500/10 hover:text-orange-300 h-12 text-base font-semibold"
                    >
                      🕐 {language === "uk" ? "Запланувати замовлення" : "Suplanuoti užsakymą"}
                    </Button>
                  </div>
                )}

                {/* Кнопки действий */}
                <div className="flex flex-col sm:flex-row gap-3 mt-4">
                  <Button
                    variant="outline"
                    onClick={onClose}
                    className="flex-1 bg-gray-700 border-gray-600 text-white hover:bg-gray-600 h-14 text-lg font-bold"
                  >
                    {language === "uk" ? "Продовжити замовлення" : "Tęsti užsakymą"}
                  </Button>
                  <Button
                    onClick={handleCompleteOrder}
                    disabled={isSubmitting}
                    className="flex-1 bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-50 h-14 text-lg font-bold"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center justify-center">
                        <span className="animate-spin mr-2">⏳</span>
                        {language === "uk" ? "Обробка..." : "Apdorojama..."}
                      </span>
                    ) : (
                      t.completeOrder
                    )}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🛒</div>
              <h3 className="text-xl font-semibold text-gray-400 mb-2">{t.orderEmpty}</h3>
              <p className="text-gray-500">
                {language === "uk" ? "Додайте товари до замовлення" : "Pridėkite prekių į užsakymą"}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
})

POSCart.displayName = 'POSCart'

export default POSCart