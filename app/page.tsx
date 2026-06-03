"use client"

import { useEffect, useMemo, useRef, useState, Suspense, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import EmployeeDiscountButton from "@/components/EmployeeDiscountButton"
import OrderTypeSelector from "@/components/OrderTypeSelector"
import POSOrderHistoryDialog from "@/components/POSOrderHistoryDialog"
import POSModifierDialog, { ModifierGroup } from "@/components/POSModifierDialog"
import POSComboDialog from "@/components/POSComboDialog"
import POSPreorderDialog from "@/components/POSPreorderDialog"
import POSPhoneDialog from "@/components/POSPhoneDialog"
import POSCart from "@/components/POSCart"
import CategoryButtons from "@/components/CategoryButtons"
import OptimizedMenuCard from "@/components/OptimizedMenuCard"
import POSCommentDialog from "@/components/POSCommentDialog"
import POSMeatDialog from "@/components/POSMeatDialog"
import POSAddonsDialog from "@/components/POSAddonsDialog"
import { usePOSState } from "@/hooks/usePOSState"
import { useMenuData } from "@/hooks/useMenuData"
import { useOrderManagement } from "@/hooks/useOrderManagement"
import { useAudioEffects } from "@/hooks/useAudioEffects"
import { useOrderHistory } from "@/hooks/useOrderHistory"
import { useDialogState } from "@/hooks/useDialogState"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Minus, ShoppingCart, Globe, Trash2, X, Store, Phone, ShoppingBag, CheckCircle, ChefHat, Car, Maximize, Minimize, MessageSquare, ArrowLeft } from "lucide-react"
import Image from "next/image"
import { 
  Language, 
  OrderType, 
  PaymentType, 
  MenuItem, 
  Category, 
  Modifier, 
  ModifierOption,
  OrderItem, 
  CompletedOrder,
  EmployeeDiscount,
  MenuOrderMap
} from "@/types/pos"
import { logger } from "@/lib/logger"
import { fetchWithRetry } from "@/lib/fetchWithRetry"
import { broadcastSyncEvent } from "@/lib/sync"
import { usePosOrdersSync } from "@/hooks/usePosOrdersSync"
import { useOrdersVersionGate } from "@/hooks/useOrdersVersionGate"
import { reconcileCompletedOrders } from "@/lib/services/orderHistorySync"
import { loadCompletedOrdersFromDatabase } from '@/lib/services/completedOrdersRepository'

// categories are loaded from API and stored in component state

const orderTypes = [
  {
    id: "dine-in",
    name: { lt: "Valgoma vietoje", uk: "В закладі" },
    icon: <Store className="w-5 h-5" />,
    color: "bg-emerald-600 hover:bg-emerald-700 border-emerald-500",
  },
  {
    id: "phone",
    name: { lt: "Telefonu", uk: "По телефону" },
    icon: <Phone className="w-5 h-5" />,
    color: "bg-blue-600 hover:bg-blue-700 border-blue-500",
  },
  {
    id: "takeaway",
    name: { lt: "Išsinešimui", uk: "На винос" },
    icon: <ShoppingBag className="w-5 h-5" />,
    color: "bg-purple-600 hover:bg-purple-700 border-purple-500",
  },
  {
    id: "delivery",
    name: { lt: "Pristatymas", uk: "Доставка" },
    icon: <Car className="w-5 h-5" />,
    color: "bg-orange-600 hover:bg-orange-700 border-orange-500",
  },
]

const translations = {
  lt: {
    title: "Meidos",
    subtitle: "",
    menuManagement: "Meniu valdymas",
    kitchenDisplay: "Virtuvės ekranas",
    reports: "Ataskaitos",
    currentOrder: "Dabartinis užsakymas",
    orderEmpty: "Užsakymas tuščias",
    total: "Iš viso:",
    orderType: "Užsakymo tipas:",
    completeOrder: "Užbaigti užsakymą",
    processing: "Apdorojama...",
    saveOrder: "Išsaugoti užsakymą",
    orderSuccess: "Užsakymas sėkmingas!",
    orderNumber: "Užsakymas #",
    done: "Atlikta",
    all: "Visi",
    modifiers: "Papildomos prekės",
    selectModifiers: "Pasirinkite papildomas prekes",
    required: "Privaloma",
    addToOrder: "Pridėti į užsakymą",
    cancel: "Atšaukti",
    orderHistory: "Užsakymų istorija",
    orderHistoryToday: "Dienos užsakymų istorija",
    noOrdersYet: "Užsakymų dar nėra",
    delivery: "Išdavimas",
    completed: "Užbaigta",
    readyForDelivery: "Paruoštas išdavimui",
    preparing: "Gaminamas",
    delivered: "Išduotas",
    sentToKitchen: "Išsiųstas į virtuvę",
    preorder: "Išankstinis užsakymas",
    preorderTime: "Išankstinio užsakymo laikas",
    selectTime: "Pasirinkite laiką",
    orderFor: "Užsakymas",
    now: "Dabar",
    later: "Vėliau",
    scheduledFor: "Suplanuotas",
    confirm: "Patvirtinti",
  },
  uk: {
    title: "Meidos",
    subtitle: "",
    menuManagement: "Управління меню",
    kitchenDisplay: "Кухонний дисплей",
    reports: "Звіти",
    currentOrder: "Поточне замовлення",
    orderEmpty: "Замовлення порожнє",
    total: "Разом:",
    orderType: "Тип замовлення:",
    completeOrder: "Завершити замовлення",
    processing: "Обробка...",
    saveOrder: "Зберегти замовлення",
    orderSuccess: "Замовлення успішне!",
    orderNumber: "Замовлення #",
    done: "Готово",
    all: "Всі",
    modifiers: "Модифікатори",
    selectModifiers: "Оберіть модифікатори",
    required: "Обов'язково",
    addToOrder: "Додати до замовлення",
    cancel: "Скасувати",
    orderHistory: "Історія замовлень",
    orderHistoryToday: "Історія замовлень за день",
    noOrdersYet: "Замовлень поки немає",
    delivery: "Видача",
    completed: "Завершено",
    readyForDelivery: "Готовий до видачі",
    preparing: "Готується",
    delivered: "Виданий",
    sentToKitchen: "Відправлено на кухню",
    preorder: "Передзамовлення",
    preorderTime: "Час передзамовлення",
    selectTime: "Оберіть час",
    orderFor: "Замовлення на",
    now: "Зараз",
    later: "Пізніше",
    scheduledFor: "Заплановано на",
    confirm: "Підтвердити",
  },
}

export default function POSSystem() {
  // Используем usePOSState для синхронизации с customer-display
  const posState = usePOSState()
  const { orderItems, setOrderItems, orderType, setOrderType, selectedOrderTypeId, setSelectedOrderTypeId, customerName, setCustomerName, phoneNumber, setPhoneNumber, employeeDiscount, setEmployeeDiscount } = posState
  
  const [isMounted, setIsMounted] = useState(false)
  const [packagingCost, setPackagingCost] = useState<number>(0.30)
  const [woltPackagingCost, setWoltPackagingCost] = useState<number>(0.30)
  const [boltPackagingCost, setBoltPackagingCost] = useState<number>(0.40)
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>("popular")
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null)
  const [popularItems, setPopularItems] = useState<MenuItem[]>([])
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const [selectedModifiers, setSelectedModifiers] = useState<Modifier[]>([])
  const [isModifierDialogOpen, setIsModifierDialogOpen] = useState(false)
  const [isComboDialogOpen, setIsComboDialogOpen] = useState(false)
  const [language, setLanguage] = useState<"lt" | "uk">("lt")
  
  // Функция для получения локализованного названия типа заказа
  const getOrderTypeName = (orderTypeId: string) => {
    const type = orderTypes.find(t => t.id === orderTypeId)
    return type ? type.name[language] : orderTypeId
  }
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lastOrderId, setLastOrderId] = useState<string | null>(null)
  const [completedOrders, setCompletedOrders] = useState<CompletedOrder[]>([])
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isPreorder, setIsPreorder] = useState(false)
  const [preorderTime, setPreorderTime] = useState('')
  const [itemComments, setItemComments] = useState<Record<string, string>>({})
  const [menuColumns, setMenuColumns] = useState<number>(2)

  // Простой рендер HTML чека для печати (Windows, сеть/USB принтер через диалог браузера)
  const buildTicketHtml = useCallback((order: {
    id: string
    daily_number?: string
    orderType: string
    timestamp: Date
    items: { name: string; quantity: number; modifiers?: string[] }[]
  }) => {
    const dateStr = order.timestamp.toLocaleString()
    const itemsHtml = order.items.map((item) => {
      const modsHtml = (item.modifiers && item.modifiers.length > 0)
        ? item.modifiers.map(m => `<div style="font-size:13px;color:#555;padding-left:12px;">+ ${m}</div>`).join('')
        : ''
      return `
        <div style="display:flex;justify-content:space-between;font-size:16px;margin:4px 0;">
          <span>${item.name}</span>
          <strong>x${item.quantity}</strong>
        </div>
        ${modsHtml}
      `
    }).join('')

    return `
      <html>
        <head>
          <meta charSet="UTF-8" />
          <style>
            @page { size: 58mm auto; margin: 0; }
            body { font-family: 'Arial', sans-serif; width: 58mm; margin: 0 auto; padding: 4mm; }
            .order-num { text-align: center; font-size: 48px; font-weight: 800; margin: 8px 0; color: transparent; -webkit-text-stroke: 2px #000; }
            .meta { text-align: center; font-size: 12px; margin-bottom: 6px; }
            .items { border-top: 1px dashed #999; padding-top: 6px; margin-top: 6px; }
            .items div { font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="order-num">${String(order.daily_number ?? order.id)}</div>
          <div class="meta">${order.orderType || ''}</div>
          <div class="meta">${dateStr}</div>
          <div class="items">${itemsHtml}</div>
        </body>
      </html>
    `
  }, [])

  const printOrderTicket = useCallback((order: {
    id: string
    daily_number?: string
    orderType: string
    timestamp: Date
    items: { name: string; quantity: number; modifiers?: string[] }[]
  }) => {
    if (typeof window === 'undefined') return
    try {
      const html = buildTicketHtml(order)
      const printWindow = window.open('', '_blank', 'width=400,height=600')
      if (!printWindow) return
      printWindow.document.open()
      printWindow.document.write(html)
      printWindow.document.close()
      printWindow.focus()
      // Даем браузеру время отрендерить, затем печать
      setTimeout(() => {
        printWindow.print()
        printWindow.close()
      }, 300)
    } catch (e) {
      logger.error('[Print] Ошибка печати чека:', e)
    }
  }, [buildTicketHtml])

  // Подбираем количество колонок как в Tailwind сетке: grid-cols-2 sm:4 md:5 lg:6 xl:8 2xl:10
  useEffect(() => {
    const computeColumns = () => {
      if (typeof window === 'undefined') return 2
      const w = window.innerWidth
      if (w >= 1536) return 10
      if (w >= 1280) return 8
      if (w >= 1024) return 6
      if (w >= 768) return 5
      if (w >= 640) return 4
      return 2
    }
    const update = () => setMenuColumns(computeColumns())
    update()
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('resize', update)
    }
  }, [])
  
  // Управление диалогами (рефакторинг на хук)
  const dialogs = useDialogState()
  const {
    showSuccessDialog, setShowSuccessDialog,
    showMobileCart, setShowMobileCart,
    showOrderHistory, setShowOrderHistory,
    showPhoneDialog, setShowPhoneDialog,
    showPreorderDialog, setShowPreorderDialog,
    showMeatDialog, setShowMeatDialog,
    showAddonsDialog, setShowAddonsDialog,
    showCommentDialog, setShowCommentDialog,
    showDeleteOrderDialog, setShowDeleteOrderDialog,
    selectedItemForComment, setSelectedItemForComment,
    tempComment, setTempComment,
    orderToDelete, setOrderToDelete,
    deletePin, setDeletePin,
    deletePinError, setDeletePinError,
  } = dialogs
  
  // DnD для перестановки блюд в сетке меню
  const [menuOrderMap, setMenuOrderMap] = useState<Record<string, string[]>>({})
  const [draggingMenuId, setDraggingMenuId] = useState<string | null>(null)
  const isMenuDraggingRef = useRef(false)
  const menuOrderKey = useMemo(() => `${selectedCategory}:${selectedSubcategory ?? ''}`, [selectedCategory, selectedSubcategory])
  const menuStorageKey = useMemo(() => `menuOrder:${menuOrderKey}`, [menuOrderKey])

  useEffect(() => {
    // Загружаем сохраненный порядок карточек для выбранной категории
    try {
      const raw = localStorage.getItem(menuStorageKey)
      if (raw) {
        const ids = JSON.parse(raw)
        if (Array.isArray(ids)) {
          setMenuOrderMap(prev => ({ ...prev, [menuOrderKey]: ids as string[] }))
        }
      }
    } catch {}
  }, [menuStorageKey, menuOrderKey])

  useEffect(() => {
    setSelectedSubcategory(null)
  }, [selectedCategory])

  // Звуковые эффекты (рефакторинг на хук)
  const audio = useAudioEffects()
  
  // История заказов (рефакторинг на хук)
  const orderHistory = useOrderHistory()
  
  // Меню и категории (рефакторинг на хук)
  const menuData = useMenuData()
  
  // Управление заказами (рефакторинг на хук)
  const orderManagement = useOrderManagement({
    orderItems,
    setOrderItems,
    happyHourDiscounts: menuData.happyHourDiscounts,
    packagingCost,
    selectedOrderTypeId,
    playSound: audio.playSound,
    employeeDiscount
  })

  // Используем ref для хранения актуального значения completedOrders
  const completedOrdersRef = useRef(completedOrders)
  useEffect(() => {
    completedOrdersRef.current = completedOrders
  }, [completedOrders])

  const {
    lastVersionRef: lastOrdersVersionRef,
    fetchVersion: fetchOrdersVersion,
    checkAndUpdate: checkOrdersVersionChanged,
  } = useOrdersVersionGate()

  // Используем функцию из хука orderHistory (через ref, чтобы не зависеть от устаревших данных)
  const markOrderAsDelivered = useCallback(async (orderId: string) => {
    await orderHistory.markOrderAsDelivered(
      orderId,
      completedOrdersRef.current,
      setCompletedOrders,
      audio.playSound,
      language
    )
  }, [orderHistory, audio.playSound, language])

  // Мемоизируем функции для диалога истории заказов
  const getOrderStatusColorForDialog = useCallback((status?: string) => {
    return status === 'ready' ? 'text-green-500' : 'text-gray-400'
  }, [])

  const translateOrderStatusForDialog = useCallback((status?: string) => {
    switch(status) {
      case 'ready': return language === 'uk' ? 'Готовий' : 'Paruoštas'
      case 'completed': return language === 'uk' ? 'Виданий' : 'Išduotas'
      case 'cancelled': return language === 'uk' ? 'Скасований' : 'Atšauktas'
      default: return language === 'uk' ? 'Завершений' : 'Užbaigtas'
    }
  }, [language])

  const handleDeleteOrderClick = useCallback((order: CompletedOrder) => {
    setOrderToDelete(order)
    setShowDeleteOrderDialog(true)
  }, [])

  // Функція дозамовлення - завантажує замовлення для редагування
  const handleReorderClick = useCallback((order: CompletedOrder) => {
    // Очищаємо поточний кошик
    setOrderItems([])
    
    // Відновлюємо всі існуючі позиції замовлення в кошик (зберігаємо їх модифікатори)
    const itemsToAdd = order.items.map(item => ({
      id: item.id,
      name: item.name,
      price: item.price,
      original_price: (item.original_price as number | undefined) ?? item.price,
      happy_hour_discount: (item.happy_hour_discount as number | undefined) ?? 0,
      quantity: item.quantity,
      comment: item.comment || '',
      selectedModifiers: (item.selectedModifiers || []).map(mod => ({
        id: mod.id,
        name: mod.name,
        price: mod.price,
        groupName: mod.groupName,
        groupId: mod.groupId,
        type: mod.type,
        required: mod.required,
        options: mod.options,
      })),
      category: item.category,
      tempId: `${item.id}-${Date.now()}-${Math.random()}`
    }))
    setOrderItems(itemsToAdd)
    
    // Встановлюємо тип замовлення та контактні дані
    if (order.orderType) {
      setOrderType(order.orderType)
      
      // Визначаємо selectedOrderTypeId на основі типу замовлення
      const orderTypeLower = order.orderType.toLowerCase()
      if (orderTypeLower.includes('вінос') || orderTypeLower.includes('išsinešti')) {
        setSelectedOrderTypeId('takeaway')
      } else if (orderTypeLower.includes('заведен') || orderTypeLower.includes('vietoje')) {
        setSelectedOrderTypeId('dine-in')
      } else if (orderTypeLower.includes('телефон') || orderTypeLower.includes('telefonu')) {
        setSelectedOrderTypeId('phone')
      } else if (orderTypeLower.includes('доставка') || orderTypeLower.includes('pristatymas')) {
        setSelectedOrderTypeId('delivery')
      }
    }
    
    if (order.customer_name) {
      setCustomerName(order.customer_name)
    }
    
    if (order.phone_number) {
      setPhoneNumber(order.phone_number)
    }
    
    // Зберігаємо ID замовлення — дозамовлення оновлює існуючий запис, додаючи нові позиції
    orderIdRef.current = order.id
    
    // Закриваємо діалог історії
    setShowOrderHistory(false)
    
    // Відтворюємо звук
    audio.playSound('click')
  }, [language, setOrderItems, setOrderType, setSelectedOrderTypeId, setCustomerName, setPhoneNumber, audio])

  const orderIdRef = useRef<string | null>(null)

  useEffect(() => {
    setIsMounted(true)
    
    // Инициализируем аудио при первом взаимодействии пользователя
    const handleFirstInteraction = () => {
      audio.initAudio()
      document.removeEventListener('click', handleFirstInteraction)
      document.removeEventListener('touchstart', handleFirstInteraction)
    }
    
    document.addEventListener('click', handleFirstInteraction)
    document.addEventListener('touchstart', handleFirstInteraction)
    
    // Восстанавливаем текущий заказ из localStorage
    const savedOrder = localStorage.getItem('currentOrder')
    if (savedOrder) {
      try {
        const parsedOrder = JSON.parse(savedOrder)
        if (Array.isArray(parsedOrder) && parsedOrder.length > 0) {
          setOrderItems(parsedOrder)
        }
      } catch (error) {
        logger.warn('Не удалось восстановить заказ из localStorage:', error)
      }
    }
    

    // Восстанавливаем номер телефона
    const savedPhoneNumber = localStorage.getItem('phoneNumber')
    if (savedPhoneNumber) {
      setPhoneNumber(savedPhoneNumber)
    }

    // Регистрируем Service Worker для кеширования (только в production)
    if ('serviceWorker' in navigator && window.location.hostname !== 'localhost') {
      navigator.serviceWorker.register('/sw.js')
        .then(() => logger.log('[SW] Service Worker registered'))
        .catch((error) => logger.warn('[SW] Service Worker registration failed:', error))
    }

    // Восстанавливаем дополнительную информацию заказа
    const savedCustomerName = localStorage.getItem('customerName')
    const savedOrderType = localStorage.getItem('orderType')
    
    if (savedCustomerName) setCustomerName(savedCustomerName)
    if (savedOrderType) setOrderType(savedOrderType)

    // Загружаем историю заказов за сегодня из базы данных
    const loadHistory = async () => {
      try {
        const orders = await loadCompletedOrdersFromDatabaseForPOS()
        setCompletedOrders(orders)
      } catch (error) {
        logger.error('[POS] Ошибка при загрузке истории в useEffect:', error)
        // Попробуем загрузить из localStorage как fallback
        try {
          const cached = localStorage.getItem('completedOrders')
          if (cached) {
            const cachedOrders = JSON.parse(cached)
            setCompletedOrders(cachedOrders)
          }
        } catch (e) {
          logger.error('[POS] Не удалось загрузить из кэша:', e)
        }
      }
    }
    
    // Очищаем старые заказы (старше текущего дня)
    const cleanupOldOrders = async () => {
      try {
        const response = await fetch('/api/orders/cleanup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
        if (response.ok) {
          const data = await response.json()
          logger.log('[POS] Очистка старых заказов завершена:', data)
        }
      } catch (error) {
        logger.warn('[POS] Ошибка при очистке старых заказов:', error)
      }
    }
    
    // Відкладаємо некритичні операції на 1.5 секунди
    setTimeout(() => {
      cleanupOldOrders()
    }, 3000)
    
    // Історію завантажуємо трохи раніше, але теж не одразу
    setTimeout(() => {
      loadHistory()
    }, 1000)
    
    // Слушаем обновления от кухни/других вкладок
    let ordersBc: BroadcastChannel | null = null
    try {
      ordersBc = new BroadcastChannel('orders-sync')
      ordersBc.onmessage = async (ev) => {
        const type = ev?.data?.type
        if (type === 'order-status-updated' || type === 'orders-updated') {
          // Обновляем историю заказов
          await loadHistory()
        }
      }
    } catch (e) {
      logger.error('[POS] Ошибка инициализации BroadcastChannel:', e)
    }
    
    return () => {
      try { ordersBc?.close() } catch {}
    }
  }, [])

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem('customerName', customerName)
    }
  }, [customerName, isMounted])


  useEffect(() => {
    if (isMounted) {
      localStorage.setItem('orderType', orderType)
    }
  }, [orderType, isMounted])

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem('phoneNumber', phoneNumber)
    }
  }, [phoneNumber, isMounted])

  // Очистка аудиоконтекста теперь в хуке useAudioEffects


  const t = translations[language]

  // Функция для перевода статусов заказов
  const translateOrderStatus = (status: string | undefined): string => {
    if (!status) return t.completed
    
    // Нормализуем статус - убираем лишние пробелы и приводим к нижнему регистру
    const normalizedStatus = status.toLowerCase().trim()
    
    // Определяем статус по ключевым словам
    if (normalizedStatus.includes('отправлен') || normalizedStatus.includes('išsiųstas') || normalizedStatus === 'sent') {
      return t.sentToKitchen
    } else if (normalizedStatus.includes('готовится') || normalizedStatus.includes('gaminamas') || normalizedStatus === 'preparing') {
      return t.preparing
    } else if (normalizedStatus.includes('готов') || normalizedStatus.includes('paruoštas') || normalizedStatus === 'ready') {
      return t.readyForDelivery
    } else if (normalizedStatus.includes('выдан') || normalizedStatus.includes('išduotas') || normalizedStatus === 'delivered') {
      return t.delivered
    } else if (normalizedStatus.includes('завершен') || normalizedStatus.includes('užbaigta') || normalizedStatus === 'completed') {
      return t.completed
    } else if (normalizedStatus.includes('скасован') || normalizedStatus.includes('atšaukt') || normalizedStatus === 'cancelled') {
      return language === 'uk' ? 'Скасовано' : 'Atšauktas'
    } else {
      // Если статус не распознан, возвращаем как есть
      return status
    }
  }

  // Функция для получения цвета статуса заказа
  const getOrderStatusColor = (status: string | undefined): string => {
    const translatedStatus = translateOrderStatus(status)
    
    if (translatedStatus === t.readyForDelivery) {
      return 'bg-orange-600 text-white animate-pulse'
    } else if (translatedStatus === t.delivered) {
      return 'bg-green-600 text-white'
    } else if (translatedStatus === t.sentToKitchen) {
      return 'bg-blue-600 text-white'
    } else if (translatedStatus === t.preparing) {
      return 'bg-yellow-600 text-white'
    } else if (translatedStatus === (language === 'uk' ? 'Скасовано' : 'Atšauktas')) {
      return 'bg-red-700 text-white line-through'
    } else {
      return 'bg-gray-600 text-white'
    }
  }

  // Подсчет заказов готовых к выдаче
  const readyForDeliveryCount = useMemo(() => {
    return completedOrders.filter(order => 
      translateOrderStatus(order.status) === t.readyForDelivery
    ).length
  }, [completedOrders, t.readyForDelivery])

  // Функция для получения цвета модификатора (без анимаций для производительности)
  const getModifierColor = (index: number, isSelected: boolean) => {
    const colors = [
      {
        active: "bg-gradient-to-r from-emerald-500 to-green-500 text-white border-emerald-400 shadow-lg",
        inactive: "bg-gray-800 text-emerald-400 border-emerald-400/50 hover:bg-gradient-to-r hover:from-emerald-500 hover:to-green-500 hover:text-white hover:border-emerald-400"
      },
      {
        active: "bg-gradient-to-r from-blue-500 to-indigo-500 text-white border-blue-400 shadow-lg",
        inactive: "bg-gray-800 text-blue-400 border-blue-400/50 hover:bg-gradient-to-r hover:from-blue-500 hover:to-indigo-500 hover:text-white hover:border-blue-400"
      },
      {
        active: "bg-gradient-to-r from-purple-500 to-violet-500 text-white border-purple-400 shadow-lg",
        inactive: "bg-gray-800 text-purple-400 border-purple-400/50 hover:bg-gradient-to-r hover:from-purple-500 hover:to-violet-500 hover:text-white hover:border-purple-400"
      },
      {
        active: "bg-gradient-to-r from-pink-500 to-rose-500 text-white border-pink-400 shadow-lg",
        inactive: "bg-gray-800 text-pink-400 border-pink-400/50 hover:bg-gradient-to-r hover:from-pink-500 hover:to-rose-500 hover:text-white hover:border-pink-400"
      },
      {
        active: "bg-gradient-to-r from-yellow-500 to-amber-500 text-black border-yellow-400 shadow-lg",
        inactive: "bg-gray-800 text-yellow-400 border-yellow-400/50 hover:bg-gradient-to-r hover:from-yellow-500 hover:to-amber-500 hover:text-black hover:border-yellow-400"
      },
      {
        active: "bg-gradient-to-r from-teal-500 to-cyan-500 text-white border-teal-400 shadow-lg",
        inactive: "bg-gray-800 text-teal-400 border-teal-400/50 hover:bg-gradient-to-r hover:from-teal-500 hover:to-cyan-500 hover:text-white hover:border-teal-400"
      },
      {
        active: "bg-gradient-to-r from-orange-500 to-red-500 text-white border-orange-400 shadow-lg",
        inactive: "bg-gray-800 text-orange-400 border-orange-400/50 hover:bg-gradient-to-r hover:from-orange-500 hover:to-red-500 hover:text-white hover:border-orange-400"
      },
    ]

    const colorIndex = index % colors.length
    return isSelected ? colors[colorIndex].active : colors[colorIndex].inactive
  }

  // Определение группы "мясо" по названию на разных языках
  const isMeatGroup = (modifier: Modifier): boolean => {
    const parts = [
      modifier?.name?.lt,
      modifier?.name?.uk,
      modifier?.groupName?.lt,
      modifier?.groupName?.uk,
    ]
      .filter(Boolean)
      .map((s: string) => s.toLowerCase())
    const joined = parts.join(' ')
    return (
      joined.includes('mėsa') ||
      joined.includes("m\u0117sa") ||
      joined.includes("м'яс") ||
      joined.includes('мяс') ||
      joined.includes('meat')
    )
  }
      // Эмодзи для добавок (LT/UK/RU/EN по названию опции)
  const getAddonEmoji = (nameObj: { lt?: string; uk?: string } | string): string => {
    const name = (typeof nameObj === 'string' ? nameObj : (nameObj?.lt || nameObj?.uk || '')).toLowerCase()
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
    if (name.includes('padaž') || name.includes('sauce') || name.includes('соус') || name.includes('ketchup') || name.includes('majonez') || name.includes('majonez') || name.includes('majone') ) return '🥫'
    return '✨'
  }

  // Определение группы "добавки" - используем только тип модификатора и его название
  const isAddonGroup = (group: ModifierGroup): boolean => {
    // Сначала проверяем тип модификатора - это самый надежный способ
    if (group?.type === 'addon') {
      return true;
    }
    
    // Если тип не addon, проверяем только название модификатора (не groupName!)
    const parts = [
      group?.name?.lt,
      group?.name?.uk,
    ]
      .filter(Boolean)
      .map((s: string) => s.toLowerCase())
    const joined = parts.join(' ')
    return (
      joined.includes('pried') || // priedai (LT)
      joined.includes('papild') || // papildai (LT)
      joined.includes('extra') || // extras/add-ons
      joined.includes('addon') || joined.includes('add-on') ||
      joined.includes('добав') || joined.includes('дополн') || // RU
      joined.includes('topping') ||
      joined.includes('добавк') // точное совпадение для "Добавки"
    )
  }

  // Неоновая тема для добавок (упрощенная)
  const getAddonNeonStyle = (nameObj: { lt?: string; uk?: string } | string) => {
    const name = (typeof nameObj === 'string' ? nameObj : (nameObj?.lt || nameObj?.uk || '')).toLowerCase()
    // Базовый (циан)
    let ring = 'ring-cyan-300/80'
    let borderActive = 'border-cyan-300'
    let borderInactive = 'border-cyan-400/30'
    let borderHover = 'hover:border-cyan-300/80'
    let bgActive = 'bg-cyan-900/20'
    let bgHover = 'hover:bg-cyan-900/10'
    let shadowActive = 'shadow-[0_0_22px_rgba(34,211,238,0.9)]'
    let shadowHover = 'hover:shadow-[0_0_18px_rgba(34,211,238,0.6)]'
    let emojiShadow = 'drop-shadow-[0_0_12px_rgba(34,211,238,0.8)]'
    let text = 'text-cyan-200 drop-shadow-[0_0_6px_rgba(34,211,238,0.6)]'

    const set = (
      r: string, ba: string, bi: string, bh: string,
      bga: string, bgh: string, sa: string, sh: string, es: string, t: string
    ) => {
      ring = r; borderActive = ba; borderInactive = bi; borderHover = bh
      bgActive = bga; bgHover = bgh; shadowActive = sa; shadowHover = sh
      emojiShadow = es; text = t
    }

    if (name.includes('sūri') || name.includes('cheese') || name.includes('сыр') || name.includes('moz') || name.includes('feta')) {
      set('ring-amber-300/80','border-amber-300','border-amber-400/30','hover:border-amber-300/80','bg-amber-900/20','hover:bg-amber-900/10','shadow-[0_0_22px_rgba(251,191,36,0.9)]','hover:shadow-[0_0_18px_rgba(251,191,36,0.6)]','drop-shadow-[0_0_12px_rgba(251,191,36,0.8)]','text-amber-200 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]')
    } else if (name.includes('bacon') || name.includes('šonin') || name.includes('bekon') || name.includes('kump') || name.includes('бекон')) {
      set('ring-pink-400/80','border-pink-400','border-pink-500/30','hover:border-pink-400/80','bg-pink-900/20','hover:bg-pink-900/10','shadow-[0_0_22px_rgba(244,114,182,0.9)]','hover:shadow-[0_0_18px_rgba(244,114,182,0.6)]','drop-shadow-[0_0_12px_rgba(244,114,182,0.8)]','text-pink-200 drop-shadow-[0_0_6px_rgba(244,114,182,0.6)]')
    } else if (name.includes('jalap') || name.includes('chili') || name.includes('čili') || name.includes('aštr')) {
      set('ring-red-400/80','border-red-400','border-red-500/30','hover:border-red-400/80','bg-red-900/20','hover:bg-red-900/10','shadow-[0_0_22px_rgba(248,113,113,0.9)]','hover:shadow-[0_0_18px_rgba(248,113,113,0.6)]','drop-shadow-[0_0_12px_rgba(248,113,113,0.8)]','text-red-200 drop-shadow-[0_0_6px_rgba(248,113,113,0.6)]')
    } else if (name.includes('gryb') || name.includes('mushroom')) {
      set('ring-lime-400/80','border-lime-400','border-lime-500/30','hover:border-lime-400/80','bg-lime-900/20','hover:bg-lime-900/10','shadow-[0_0_22px_rgba(163,230,53,0.9)]','hover:shadow-[0_0_18px_rgba(163,230,53,0.6)]','drop-shadow-[0_0_12px_rgba(163,230,53,0.8)]','text-lime-200 drop-shadow-[0_0_6px_rgba(163,230,53,0.6)]')
    } else if (name.includes('pomidor') || name.includes('agurk') || name.includes('svogūn') || name.includes('svogun') || name.includes('salot') || name.includes('avokad') ) {
      set('ring-emerald-400/80','border-emerald-400','border-emerald-500/30','hover:border-emerald-400/80','bg-emerald-900/20','hover:bg-emerald-900/10','shadow-[0_0_22px_rgba(52,211,153,0.9)]','hover:shadow-[0_0_18px_rgba(52,211,153,0.6)]','drop-shadow-[0_0_12px_rgba(52,211,153,0.8)]','text-emerald-200 drop-shadow-[0_0_6px_rgba(52,211,153,0.6)]')
    }

    return { ring, borderActive, borderInactive, borderHover, bgActive, bgHover, shadowActive, shadowHover, emojiShadow, text }
  }

  // Функции для полноэкранного режима
  const enterFullscreen = async () => {
    try {
      const element = document.documentElement
      if (element.requestFullscreen) {
        await element.requestFullscreen()
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const el = element as any
        if (el.webkitRequestFullscreen) {
          await el.webkitRequestFullscreen()
        } else if (el.msRequestFullscreen) {
          await el.msRequestFullscreen()
        }
      }
      setIsFullscreen(true)
    } catch (error) {
      logger.warn('Не удалось войти в полноэкранный режим:', error)
    }
  }

  const exitFullscreen = async () => {
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen()
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const doc = document as any
        if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen()
        } else if (doc.msExitFullscreen) {
          await doc.msExitFullscreen()
        }
      }
      setIsFullscreen(false)
    } catch (error) {
      logger.warn('Не удалось выйти из полноэкранного режима:', error)
    }
  }

  const toggleFullscreen = () => {
    if (isFullscreen) {
      exitFullscreen()
    } else {
      enterFullscreen()
    }
  }

  // Отслеживание изменений полноэкранного режима
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ((document as any).webkitFullscreenElement || (document as any).msFullscreenElement)
      )
      setIsFullscreen(isCurrentlyFullscreen)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
    document.addEventListener('msfullscreenchange', handleFullscreenChange)

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
      document.removeEventListener('msfullscreenchange', handleFullscreenChange)
    }
  }, [])

  // Перестановка карточек меню (DnD)
  const getFilteredMenuItems = useCallback(() => {
    const base = (selectedCategory === 'popular' ? menuData.popularItems : menuData.menuItems)

    if (selectedCategory === 'popular') {
      return base
    }

    const subcategories = menuData.categories.filter((c) => c.parent_id === selectedCategory)
    const hasSubcategories = subcategories.length > 0

    if (hasSubcategories && !selectedSubcategory) {
      // Показываем товары, привязанные напрямую к родительской категории,
      // чтобы они не "пропадали" после добавления подкатегорий.
      return base.filter((item) => item.category === selectedCategory)
    }

    const effectiveCategory = selectedSubcategory ?? selectedCategory
    return base.filter((item) => item.category === effectiveCategory)
  }, [menuData.menuItems, menuData.popularItems, menuData.categories, selectedCategory, selectedSubcategory])

  const getOrderedMenuItems = useCallback(() => {
    const filtered = getFilteredMenuItems()
    const ids = menuOrderMap[menuOrderKey]
    if (!ids || ids.length === 0) return filtered
    const idSet = new Set(ids)
    const ordered: typeof filtered = []
    ids.forEach((id) => {
      const found = filtered.find((it) => it.id === id)
      if (found) ordered.push(found)
    })
    const rest = filtered.filter((it) => !idSet.has(it.id))
    return [...ordered, ...rest]
  }, [getFilteredMenuItems, menuOrderMap, menuOrderKey])


  const reorderMenuGrid = useCallback((sourceId: string, targetId: string) => {
    if (sourceId === targetId) return
    const current = getOrderedMenuItems().map((it) => it.id)
    const fromIndex = current.indexOf(sourceId)
    const toIndex = current.indexOf(targetId)
    if (fromIndex === -1 || toIndex === -1) return
    const updated = [...current]
    const [moved] = updated.splice(fromIndex, 1)
    updated.splice(toIndex, 0, moved)
    setMenuOrderMap((prev) => ({ ...prev, [menuOrderKey]: updated }))
    try { localStorage.setItem(menuStorageKey, JSON.stringify(updated)) } catch {}
  }, [getOrderedMenuItems, menuOrderKey, menuStorageKey])

  const handleMenuDragStart = useCallback((id: string) => (e: React.DragEvent) => {
    isMenuDraggingRef.current = true
    setDraggingMenuId(id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }, [])

  const handleMenuDragOver = useCallback((id: string) => (e: React.DragEvent) => {
    if (!draggingMenuId) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [draggingMenuId])

  const handleMenuDrop = useCallback((id: string) => (e: React.DragEvent) => {
    e.preventDefault()
    const sourceId = draggingMenuId || e.dataTransfer.getData('text/plain')
    if (sourceId) reorderMenuGrid(sourceId, id)
  }, [draggingMenuId, reorderMenuGrid])

  const handleMenuDragEnd = useCallback(() => {
    setDraggingMenuId(null)
    // Небольшая задержка, чтобы клик после drag не сработал
    setTimeout(() => { isMenuDraggingRef.current = false }, 50)
  }, [])

  // Долгое удержание на фото для тач-устройств (long-press → перетаскивание)
  const handleMenuLongPressStart = useCallback((id: string) => (e: React.PointerEvent) => {
    // Срабатывает только на тач-событиях
    if (e.pointerType && e.pointerType !== 'touch') return
    try { e.preventDefault() } catch {}

    let activated = false
    let destroyed = false

    const activate = () => {
      if (destroyed) return
      activated = true
      isMenuDraggingRef.current = true
      setDraggingMenuId(id)
    }

    const timer = window.setTimeout(activate, 250) // длительное удержание 250мс

    const onMove = (ev: PointerEvent) => {
      if (!activated) return
      try { ev.preventDefault() } catch {}
      const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null
      const target = el ? el.closest('[data-menu-id]') as HTMLElement | null : null
      const targetId = target?.dataset?.menuId
      if (targetId && targetId !== id) {
        reorderMenuGrid(id, targetId)
      }
    }

    const onEnd = () => {
      if (destroyed) return
      destroyed = true
      window.clearTimeout(timer)
      if (activated) handleMenuDragEnd()
      window.removeEventListener('pointermove', onMove as EventListener)
      window.removeEventListener('pointerup', onEnd as EventListener)
      window.removeEventListener('pointercancel', onEnd as EventListener)
    }

    window.addEventListener('pointermove', onMove as EventListener, { passive: false })
    window.addEventListener('pointerup', onEnd as EventListener, { once: true })
    window.addEventListener('pointercancel', onEnd as EventListener, { once: true })
  }, [reorderMenuGrid, handleMenuDragEnd])

  // saveOrderToLocalStorage уже объявлена выше

  // Функции для работы с историей заказов в базе данных
  const loadCompletedOrdersFromDatabaseForPOS = async (): Promise<CompletedOrder[]> => {
    return loadCompletedOrdersFromDatabase({ logError: logger.error.bind(logger) })
  }

  // Функции управления заказами перенесены в хук useOrderManagement

  const deleteOrderWithPin = async () => {
    if (!orderToDelete) return
    
    try {
      const response = await fetchWithRetry('/api/orders', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: orderToDelete.id
        })
      })
      
      if (!response) {
        setDeletePinError(language === 'uk' ? 'Помилка з\'єднання. Спробуйте ще раз.' : 'Ryšio klaida. Bandykite dar kartą.')
        return
      }
      
      const data = await response.json()
      
      if (!response.ok) {
        setDeletePinError(data.error || (language === 'uk' ? 'Помилка скасування' : 'Klaida atšaukiant'))
        return
      }
      
      // Успешно отменен - обновляем статус заказа на "cancelled"
      setCompletedOrders(prev => prev.map(o => 
        o.id === orderToDelete.id 
          ? { ...o, status: 'cancelled' }
          : o
      ))
      
      setShowDeleteOrderDialog(false)
      setOrderToDelete(null)
      setDeletePin('')
      setDeletePinError('')
      
      // Обновляем историю из базы данных
      const orders = await loadCompletedOrdersFromDatabaseForPOS()
      setCompletedOrders(orders)
      
      alert(language === 'uk' ? '❌ Замовлення скасовано' : '❌ Užsakymas atšauktas')
      
      // SSE автоматически отправит уведомление через API (order-status-updated event)
    } catch (error) {
      logger.error('[POS] Ошибка отмены заказа:', error)
      setDeletePinError(language === 'uk' ? 'Помилка скасування' : 'Klaida atšaukiant')
    }
  }

  const increaseQuantity = (id: string, modifiers?: Modifier[]) => {
    setOrderItems((prev) => {
      const newItems = prev.map((i) => {
        // Match by id and modifiers for items with same id but different modifiers
        const modifiersMatch = modifiers ? 
          JSON.stringify(i.selectedModifiers) === JSON.stringify(modifiers) :
          true
        return (i.id === id && modifiersMatch) ? { ...i, quantity: i.quantity + 1 } : i
      })
      return newItems
    })
  }

  const decreaseQuantity = (id: string, modifiers?: Modifier[]) => {
    setOrderItems((prev) => {
      const newItems = prev
        .map((i) => {
          // Match by id and modifiers for items with same id but different modifiers
          const modifiersMatch = modifiers ? 
            JSON.stringify(i.selectedModifiers) === JSON.stringify(modifiers) :
            true
          return (i.id === id && modifiersMatch) ? { ...i, quantity: Math.max(0, i.quantity - 1) } : i
        })
        .filter((i) => i.quantity > 0)
      
      return newItems
    })
  }

  const removeFromOrder = (id: string, modifiers?: Modifier[]) => {
    setOrderItems((prev) => {
      const newItems = prev.filter((i) => {
        // Match by id and modifiers for items with same id but different modifiers
        if (modifiers && modifiers.length > 0) {
          return !(i.id === id && JSON.stringify(i.selectedModifiers) === JSON.stringify(modifiers))
        }
        return i.id !== id
      })
      
      // Воспроизводим звук удаления товара
      audio.playSound('remove')
      
      // Если корзина стала пустой, сбрасываем тип заказа
      if (newItems.length === 0) {
        setOrderType('')
        setSelectedOrderTypeId('')
      }
      
      return newItems
    })
  }

  const openCommentDialog = (item: OrderItem) => {
    setSelectedItemForComment(item)
    setTempComment(item.comment || '')
    setShowCommentDialog(true)
  }

  const saveItemComment = () => {
    if (!selectedItemForComment) return
    
    setOrderItems(prev => prev.map(orderItem => 
      orderItem.id === selectedItemForComment.id && 
      JSON.stringify(orderItem.selectedModifiers) === JSON.stringify(selectedItemForComment.selectedModifiers)
        ? { ...orderItem, comment: tempComment }
        : orderItem
    ))
    
    // Также обновляем состояние itemComments для совместимости
    const itemKey = `${selectedItemForComment.id}-${JSON.stringify(selectedItemForComment.selectedModifiers)}`
    setItemComments(prev => ({ ...prev, [itemKey]: tempComment }))
    
    setShowCommentDialog(false)
    setSelectedItemForComment(null)
    setTempComment('')
  }

  // updateQuantity перенесена в хук useOrderManagement

  // Улучшенная работа с модификаторами
  const toggleModifier = (modifier: Modifier) => {
    setSelectedModifiers((prev) => {
        
      const exists = prev.find((m) => m.id === modifier.id)
      
      // Если модификатор уже выбран, убираем его
      if (exists) {
        audio.playSound('remove')
        return prev.filter((m) => m.id !== modifier.id)
      }
      
      // Логика для взаимоисключающих групп (например, мясо)
      if (modifier.groupId === 'meat-selection') {
        // Для мяса разрешаем только один выбор - заменяем предыдущий
        const withoutMeat = prev.filter((m) => m.groupId !== 'meat-selection')
        audio.playSound('add')
        
        // Автоматически закрываем диалог мяса после выбора
        setTimeout(() => {
          setShowMeatDialog(false)
        }, 300) // Небольшая задержка для визуального эффекта
        
        return [...withoutMeat, modifier]
      }
      
      // Для остальных модификаторов - обычное добавление
      audio.playSound('add')
      return [...prev, modifier]
    })
  }

  const handleModifierConfirm = () => {
    if (!selectedItem) return
    audio.playSound('add')
    orderManagement.addToOrder(selectedItem, selectedModifiers)
    setIsModifierDialogOpen(false)
    setSelectedItem(null)
    setSelectedModifiers([])
  }

  const handleComboConfirm = (comboSelection: unknown) => {
    if (!selectedItem) return
    
    // Convert combo selection to combo_data format for storage
    const comboData = {
      comboId: selectedItem.combo?.id,
      selections: comboSelection
    }
    
    audio.playSound('add')
    orderManagement.addToOrder(selectedItem, [], comboData)
    setIsComboDialogOpen(false)
    setSelectedItem(null)
  }

  const handleItemClick = (item: MenuItem) => {
    if (item.combo) {
      // This is a combo item - open combo dialog
      setSelectedItem(item)
      setIsComboDialogOpen(true)
    } else if (item.modifiers && item.modifiers.length > 0) {
      // This is a regular item with modifiers
      setSelectedItem(item)
      setSelectedModifiers([])
      setIsModifierDialogOpen(true)
    } else {
      // Regular item without modifiers
      audio.playSound('add')
      orderManagement.addToOrder(item)
    }
  }

  const totalAmount = orderItems.reduce(
    (sum, it) => sum + (it.price + it.selectedModifiers.reduce((s, m) => s + m.price, 0)) * it.quantity,
    0,
  )

  const completeOrder = async (selectedOrderType?: string, employeeDiscount?: { employeeId: number; employeeName: string; discountPercent: number }) => {
    if (orderItems.length === 0) return
    
    // Защита от множественных кликов
    if (isSubmitting) {
      return
    }
    
    // Проверка обязательного выбора типа заказа
    const finalOrderType = selectedOrderType || orderType
    if (!finalOrderType || finalOrderType.trim() === "") {
      // Показываем предупреждение и не закрываем корзину
      const message = language === 'uk' 
        ? '⚠️ УВАГА!\n\nОберіть тип замовлення перед оформленням:\n• В закладі\n• На винос\n• По телефону' 
        : '⚠️ DĖMESIO!\n\nPasirinkite užsakymo tipą prieš užbaigiant:\n• Vietoje\n• Išsinešti\n• Telefonu'
      alert(message)
      return
    }
    
    // Валидация предзаказа
    if (isPreorder && !preorderTime) {
      alert(language === 'uk' ? 'Введіть час для предзамовлення' : 'Įveskite išankstinio užsakymo laiką')
      return
    }
    
    
    // Устанавливаем флаг обработки
    setIsSubmitting(true)

    // Рассчитываем итоговую сумму с учетом упаковки/скидок
    const { grandTotal, discountAmount } = orderManagement.calculateTotal()

    try {
      // Перевіряємо чи це оновлення існуючого замовлення
      const isUpdatingOrder = orderIdRef.current !== null
      const orderId = orderIdRef.current
      
      console.log('[POS Order] 📝 Starting order creation/update:', {
        isUpdatingOrder,
        orderId,
        orderType: finalOrderType,
        itemsCount: orderItems.length,
        total: grandTotal
      })
      
      // Save order to database first to get the real order ID
      const response = await fetchWithRetry('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId: isUpdatingOrder ? orderId : undefined, // Передаємо ID для оновлення
          order: {
            total: grandTotal,
            orderType: finalOrderType,
            status: 'new',
            estimatedTime: 15,
            timestamp: new Date().toISOString(),
            customer_name: customerName || '',
            phone_number: phoneNumber || '',
            table_number: '',
            is_preorder: isPreorder ? 1 : 0,
            preorder_time: isPreorder ? preorderTime : null,
            employee_discount: employeeDiscount ? {
              employee_id: employeeDiscount.employeeId,
              employee_name: employeeDiscount.employeeName,
              discount_percent: employeeDiscount.discountPercent,
              discount_amount: discountAmount
            } : null,
            items: orderItems.map(item => {
              const originalPrice = (item.original_price as number | undefined) ?? item.price
              const hhDiscount = (item.happy_hour_discount as number | undefined) ?? (menuData.happyHourDiscounts[item.id] || 0)
              const finalPrice = hhDiscount > 0
                ? Number(originalPrice) * (1 - Number(hhDiscount) / 100)
                : Number(originalPrice)
              
              const mappedModifiers = item.selectedModifiers.map(mod => ({
                id: mod.id,
                name: mod.name[language],
                name_uk: mod.name.uk,
                name_lt: mod.name.lt,
                group_name: mod.groupName?.uk || mod.groupName?.lt || '',
                price: mod.price,
                type: mod.type
              }));
              
              
              return {
                id: item.id,
                name: item.name[language],
                quantity: item.quantity,
                price: finalPrice, // Цена с учетом скидки счастливых часов
                original_price: (item.original_price as number | undefined) ?? item.price,
                happy_hour_discount: (item.happy_hour_discount as number | undefined) ?? hhDiscount,
                category: item.category,
                comment: item.comment || '',
                modifiers: mappedModifiers
              };
            })
          }
        })
      })

      if (!response) {
        logger.error('[POS] Не удалось сохранить заказ после нескольких попыток')
        throw new Error('Не удалось подключиться к серверу. Проверьте соединение.')
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        logger.error('Order save failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        })
        throw new Error(`Failed to save order: ${response.status} ${response.statusText}. ${errorData.error || ''}`)
      }

      const result = await response.json()
      console.log('[POS Order] ✅ Order saved to database:', {
        success: result.success,
        orderId: result.order?.id,
        status: result.order?.status
      })
      logger.log('Order saved successfully:', result)
      
      // Use the real order ID from database
      const realOrderId = result.order?.id || `${Date.now() % 100000}`

      const newOrder: CompletedOrder = {
        id: realOrderId.toString(),
        items: [...orderItems],
        total: grandTotal,
        orderType: finalOrderType,
        timestamp: new Date(),
        customer_name: customerName || '',
        phone_number: phoneNumber || '',
        table_number: '',
        status: isPreorder ? t.preorder : t.sentToKitchen,
        preorder_time: isPreorder ? preorderTime : undefined,
        is_preorder: isPreorder,
        employee_discount_id: employeeDiscount?.employeeId || null,
        employee_discount_name: employeeDiscount?.employeeName || null,
        employee_discount_percent: employeeDiscount?.discountPercent || null,
        employee_discount_amount: employeeDiscount ? discountAmount : null,
      }

      // SSE автоматически отправит уведомление через API (order-created event)
      console.log('[POS Order] 📡 SSE notification will be sent by API:', {
        orderId: realOrderId,
        eventType: 'order-created'
      })
      logger.log('[POS] ✅ Уведомление на кухню отправлено через SSE:', realOrderId)

      // Оновлюємо історію замовлень - завжди перезавантажуємо з бази даних
      // щоб отримати актуальну суму та всі позиції після оновлення на сервері
      console.log('[POS Order] 🔄 Reloading order history from database...')
      const updatedOrders = await loadCompletedOrdersFromDatabaseForPOS()
      console.log('[POS Order] ✅ Order history reloaded:', {
        totalOrders: updatedOrders.length,
        newOrderInHistory: updatedOrders.some(o => o.id === realOrderId.toString())
      })
      logger.log(`[POS] ✅ История обновлена після создания заказа, заказов: ${updatedOrders.length}`)
      
      try {
        const printRes = await fetch('/api/print', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: realOrderId }),
        })
        if (!printRes.ok) {
          const errorData = await printRes.json().catch(() => ({}))
          logger.error('[POS] Print failed:', { status: printRes.status, error: errorData })
        }
      } catch (e) {
        logger.error('[POS] Print request failed:', e)
      }

      // Знаходимо оновлене замовлення та логуємо його позиції
      const updatedOrder = updatedOrders.find(o => o.id === realOrderId.toString())
      if (updatedOrder) {
        logger.log(`[POS] 📦 Оновлене замовлення #${updatedOrder.id}: ${updatedOrder.items.length} позицій`)
      }
      
      setCompletedOrders(updatedOrders)
      
      // Воспроизводим мелодичный звук завершения заказа
      audio.playSound('complete')
      
      setOrderItems([]) // Очищаем корзину после завершения заказа
      setCustomerName('') // Очищаем имя клиента
      setPhoneNumber('') // Очищаем номер телефона
      setOrderType('') // Очищаем тип заказа
      setSelectedOrderTypeId('') // Очищаем выбранный тип заказа
      setItemComments({}) // Очищаем комментарии к блюдам
      setEmployeeDiscount(null) // Очищаем скидку сотрудника
      orderIdRef.current = null // Очищаем ID замовлення після завершення
      
      // Очищаем localStorage после завершения заказа
      localStorage.removeItem('currentOrder')
      localStorage.removeItem('customerName')
      localStorage.removeItem('phoneNumber')
      localStorage.removeItem('orderType')
      
      // Сбрасываем предзаказ для следующего заказа
      setIsPreorder(false)
      setPreorderTime('')
      setShowPreorderDialog(false)
      
      // Закрываем корзину только после успешного оформления
      setShowMobileCart(false)

    } catch (error) {
      logger.error('[POS] Ошибка при завершении заказа:', error)
      
      // Воспроизводим звук ошибки
      audio.playSound('error')
      
      // Показываем пользователю детальную ошибку
      alert(`Ошибка при сохранении заказа: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`)
    } finally {
      // Сбрасываем флаг обработки в любом случае
      setIsSubmitting(false)
    }
  }

  // Функции загрузки меню перенесены в хук useMenuData

  // Загрузка меню при монтировании и подписка на обновления
  useEffect(() => {
    if (!isMounted) return

    const initializeMenu = async () => {
      setIsLoading(true)
      const success = await menuData.loadMenuFromAPI()
      if (!success) {
        setMenuItems([])
        setCategories([])
      }
      setIsLoading(false)
    }

    initializeMenu()

    // Периодическое обновление истории заказов (оптимизировано для планшета)
    const updateOrderHistory = async () => {
      try {
        const v = await fetchOrdersVersion()
        if (v && v === lastOrdersVersionRef.current) {
          return
        }
        if (v) {
          lastOrdersVersionRef.current = v
        }

        const orders = await loadCompletedOrdersFromDatabaseForPOS()
        // Используем функциональное обновление чтобы не перезаписывать оптимистичные изменения
        setCompletedOrders(prev => reconcileCompletedOrders(prev, orders))
      } catch (error) {
        logger.error('[POS] Ошибка обновления истории:', error)
      }
    }
    
  }, [isMounted])

  usePosOrdersSync({
    enabled: isMounted,
    checkOrdersVersionChanged,
    completedOrdersRef,
    loadCompletedOrdersFromDatabase: loadCompletedOrdersFromDatabaseForPOS,
    setCompletedOrders,
    playReadySound: () => audio.playSound('complete'),
    onMenuUpdated: async () => {
      await menuData.loadMenuFromAPI()
    },
    logError: (msg, err) => logger.error(msg, err),
  })

  // Добавляем проверку на загрузку данных перед рендерингом
  if (!isMounted || menuData.menuItems.length === 0) {
    return (
      <div className="min-h-screen bg-black text-orange-500 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500 mb-4"></div>
          <p className="text-xl">{language === 'uk' ? 'Завантаження меню...' : 'Kraunamas meniu...'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-orange-500 overflow-x-hidden" style={{ 
      minHeight: '100dvh',
      WebkitUserSelect: 'none',
      userSelect: 'none',
      WebkitTouchCallout: 'none',
      WebkitTapHighlightColor: 'transparent'
    }}>
      <div className="w-full">
        <header className="mb-2 sm:mb-3 bg-gradient-to-r from-gray-800/50 to-gray-700/30 p-2 sm:p-3 border-b border-gray-700/50 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-3">
            {/* Кнопки управления слева */}
            <div className="flex gap-2 items-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLanguage(language === "uk" ? "lt" : "uk")}
                className="border-orange-500/50 text-orange-400 hover:bg-orange-500 hover:text-black bg-gray-800/50 backdrop-blur-sm text-xs transition-all duration-200 hover:scale-105 h-8"
              >
                <Globe className="w-3 h-3 mr-1" />
                {language === "uk" ? "LT" : "UK"}
              </Button>
              <Button
                variant="outline"
                asChild
                className="border-orange-500/50 text-orange-400 hover:bg-orange-500 hover:text-black bg-gray-800/50 backdrop-blur-sm text-xs transition-all duration-200 hover:scale-105 p-1.5 h-8"
                title={t.menuManagement}
              >
                <a href="/admin/login">
                  <ChefHat className="w-3.5 h-3.5" />
                </a>
              </Button>
              <Button
                variant="outline"
                onClick={toggleFullscreen}
                className="border-orange-500/50 text-orange-400 hover:bg-orange-500 hover:text-black bg-gray-800/50 backdrop-blur-sm text-xs transition-all duration-200 hover:scale-105 p-1.5 h-8"
                title={isFullscreen ? "Выйти из полного экрана" : "Полный экран"}
              >
                {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
              </Button>
              
              {/* Кнопка истории заказов - показываем когда есть любые завершенные заказы */}
              {completedOrders.length > 0 && (
                <Button
                  variant="default"
                  size="default"
                  onClick={() => {
                    audio.playSound('click')
                    setShowOrderHistory(true)
                  }}
                  className="relative bg-gray-700 hover:bg-gray-600 text-white border-gray-600 h-16 w-16 p-0 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                >
                  <Badge className={`text-white text-base min-w-[32px] h-8 flex items-center justify-center rounded-full font-black shadow-lg ${
                    readyForDeliveryCount > 0 ? 'bg-green-600' : 'bg-gray-600'
                  }`}>
                    {readyForDeliveryCount}
                  </Badge>
                </Button>
              )}
            </div>
            
            {/* Корзина справа */}
            <div className="flex gap-2 items-center justify-end">
              {/* Корзина в правом углу */}
              <Button
                variant="default"
                size="default"
                onClick={() => {
                  audio.playSound('click')
                  setShowMobileCart(true)
                }}
                className={`text-white font-bold text-xl transition-all duration-300 hover:scale-110 relative ml-auto px-12 py-4 h-16 shadow-lg hover:shadow-xl border-2 min-w-[240px] ${
                orderItems.length > 0 
                  ? "bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 border-orange-400 animate-pulse hover:animate-none shadow-orange-500/50 hover:shadow-orange-500/70"
                  : "bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-500 hover:to-gray-600 border-gray-500 shadow-gray-500/30 hover:shadow-gray-500/50"
              }`}
            >
              <ShoppingCart className="w-7 h-7 mr-3" />
              <span className="text-2xl font-black">
                €{totalAmount.toFixed(2)}
              </span>
              {orderItems.length > 0 && (
                <Badge className="absolute -top-3 -right-3 bg-red-600 text-white text-lg min-w-[36px] h-9 flex items-center justify-center rounded-full font-black shadow-lg animate-bounce border-2 border-white">
                  {orderItems.reduce((sum, item) => sum + item.quantity, 0)}
                </Badge>
              )}
            </Button>
          </div>
        </div>
      </header>
      <div className="w-full px-2 sm:px-3 lg:px-4">
        <div className="w-full">
          <div className="mb-3 sm:mb-4">
            <CategoryButtons
              categories={menuData.categories.filter((c) => !c.parent_id)}
              selectedCategory={selectedCategory}
              language={language}
              onCategorySelect={(categoryId) => {
                audio.playSound('click')
                setSelectedCategory(categoryId ?? 'popular')
              }}
              showAllButton={false}
              allButtonText={{ lt: t.all, uk: t.all }}
              showPopularButton={true}
            />
          </div>

          {selectedCategory !== 'popular' && menuData.categories.some((c) => c.parent_id === selectedCategory) && !selectedSubcategory && (
            <div className="mb-4">
              <div className="text-orange-300 mb-2 text-lg font-semibold">
                {menuData.categories.find((c) => String(c.id) === selectedCategory)?.name?.[language] || ''}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 gap-2 sm:gap-3 touch-manipulation select-none">
                {menuData.categories
                  .filter((c) => c.parent_id === selectedCategory)
                  .map((sub) => (
                    <Button
                      key={String(sub.id)}
                      variant="outline"
                      onClick={() => {
                        audio.playSound('click')
                        setSelectedSubcategory(String(sub.id))
                      }}
                      className="bg-black text-orange-400 border-gray-700 hover:bg-gradient-to-r hover:from-orange-500 hover:to-red-500 hover:text-white hover:border-orange-400 text-lg sm:text-xl px-6 sm:px-8 py-4 sm:py-5 transition-all duration-300 font-bold"
                    >
                      {sub.name[language]}
                    </Button>
                  ))}
              </div>
            </div>
          )}

          {selectedSubcategory && (
            <div className="mb-3 flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  audio.playSound('click')
                  setSelectedSubcategory(null)
                }}
                className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-black"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 gap-2 sm:gap-3 touch-manipulation select-none">
            {getOrderedMenuItems().map((item, index) => {
              const hasDiscount = !!menuData.happyHourDiscounts[item.id];
              const discountPercent = menuData.happyHourDiscounts[item.id];
              const discountedPrice = discountPercent ? (item.price || 0) * (1 - discountPercent / 100) : undefined;
              
              return (
                <OptimizedMenuCard
                  key={item.id}
                  item={item}
                  language={language}
                  isDragging={draggingMenuId === item.id}
                  hasDiscount={hasDiscount}
                  discountPercent={discountPercent}
                  discountedPrice={discountedPrice}
                  priority={index < 6}
                  onClick={() => { 
                    if (!isMenuDraggingRef.current) {
                      audio.playSound('click')
                      handleItemClick(item)
                    }
                  }}
                  onDragStart={handleMenuDragStart(item.id)}
                  onDragOver={handleMenuDragOver(item.id)}
                  onDrop={handleMenuDrop(item.id)}
                  onDragEnd={handleMenuDragEnd}
                  onPointerDown={handleMenuLongPressStart(item.id)}
                />
              );
            })}
            </div>
          </div>
        </div>

        {/* Диалог модификаторов (использует компонент POSModifierDialog) */}
        <POSModifierDialog
          open={isModifierDialogOpen}
          onOpenChange={setIsModifierDialogOpen}
          selectedItem={selectedItem}
          language={language}
          selectedModifiers={selectedModifiers}
          toggleModifier={toggleModifier}
          getModifierColor={getModifierColor}
          isAddonGroup={isAddonGroup}
          onConfirm={handleModifierConfirm}
          onCancel={() => setIsModifierDialogOpen(false)}
          onShowMeatDialog={() => setShowMeatDialog(true)}
          onShowAddonsDialog={() => setShowAddonsDialog(true)}
        />

        {/* Диалог комбо-наборов */}
        <POSComboDialog
          open={isComboDialogOpen}
          onOpenChange={setIsComboDialogOpen}
          combo={selectedItem?.combo ? {
          id: selectedItem.combo.id,
          menuItemId: String(selectedItem.id),
          name: selectedItem.name,
          price: (selectedItem.combo as { priceOverride?: number }).priceOverride ?? selectedItem.price,
          slots: selectedItem.combo.slots
        } : null}
          language={language}
          onConfirm={handleComboConfirm}
        />


        {/* Диалог выбора мяса */}
        <POSMeatDialog
          isOpen={showMeatDialog}
          onClose={() => setShowMeatDialog(false)}
          language={language}
          selectedModifiers={selectedModifiers}
          onToggleModifier={toggleModifier}
          getModifierColor={getModifierColor}
        />
        
        {/* Диалог добавок */}
        <POSAddonsDialog
          isOpen={showAddonsDialog}
          onClose={() => setShowAddonsDialog(false)}
          language={language}
          selectedItem={selectedItem ? { 
            id: String(selectedItem.id), 
            name: selectedItem.name, 
            modifiers: selectedItem.modifiers 
          } : null}
          selectedModifiers={selectedModifiers}
          onToggleModifier={toggleModifier}
          getModifierColor={getModifierColor}
          isAddonGroup={(modifier) => {
            // Определяем, является ли модификатор добавкой
            const groupName = modifier.groupName?.lt?.toLowerCase() || modifier.groupName?.uk?.toLowerCase() || '';
            return groupName.includes('пried') || groupName.includes('добавк') || modifier.type === 'addon';
          }}
        />

        <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
          <DialogContent className="sm:max-w-md max-w-[95vw] bg-gray-900 border-gray-700 text-white">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-orange-500 text-lg sm:text-xl">
                <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 mr-2" />
                {t.orderSuccess}
              </DialogTitle>
            </DialogHeader>
            {completedOrders.length > 0 && (
              <div className="space-y-3 sm:space-y-4">
                <h4 className="text-base sm:text-lg font-semibold text-orange-500">
                  {t.orderNumber}: {completedOrders[completedOrders.length - 1]?.id}
                </h4>
                {completedOrders[completedOrders.length - 1]?.items.map((item, index) => (

                  <div key={`${item.id}-${index}`} className="flex justify-between text-sm sm:text-base">
                    <span className="text-gray-300 flex-1 min-w-0">
                      <span className="truncate block font-medium">
                        {item.name[language]} x{item.quantity}
                      </span>
                      {item.selectedModifiers && item.selectedModifiers.length > 0 && (
                        <div className="text-sm text-orange-300 ml-2 truncate font-semibold">
                          {item.selectedModifiers.map((mod) => 
                            `+ ${mod.name[language]}${(mod.price || 0) > 0 ? ` (+€${(mod.price || 0).toFixed(2)})` : ''}`
                          ).join(", ")}
                        </div>
                      )}
                      {item.comment && (
                        <div className="text-sm text-blue-400 ml-2 italic">
                          💬 {item.comment}
                        </div>
                      )}
                    </span>
                    <span className="text-orange-500 ml-2 flex-shrink-0 text-lg font-bold">
                      €
                      {(
                        ((item.price || 0) + (item.selectedModifiers || []).reduce((sum, mod) => sum + (mod.price || 0), 0)) *
                        item.quantity
                      ).toFixed(2)}
                    </span>
                  </div>
                ))}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 border-red-500 text-red-400 hover:bg-red-500 hover:text-white text-sm sm:text-base"
                    onClick={async () => {
                      const lastOrder = completedOrders[completedOrders.length - 1]
                      if (lastOrder) {
                        try {
                          const response = await fetchWithRetry('/api/orders', {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                              orderId: lastOrder.id, 
                              status: 'cancelled' 
                            })
                          })
                          
                          if (response && response.ok) {
                            // Уведомляем кухню об отмене
                            try {
                              const bc = new BroadcastChannel('orders-sync')
                              bc.postMessage({ type: 'orders-updated', at: Date.now() })
                              bc.close()
                            } catch (e) {
                              logger.warn('Не удалось отправить уведомление:', e)
                            }
                            
                            setShowSuccessDialog(false)
                            alert('Заказ отменен')
                          } else {
                            alert('Ошибка отмены заказа')
                          }
                        } catch (error) {
                          logger.error('Ошибка отмены заказа:', error)
                          alert('Ошибка отмены заказа')
                        }
                      }
                    }}
                  >
                    Отменить заказ
                  </Button>
                  <Button
                    className="flex-1 bg-orange-500 text-black hover:bg-orange-600 text-sm sm:text-base"
                    onClick={() => setShowSuccessDialog(false)}
                  >
                    {t.done}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Мобильная корзина (компонент POSCart) */}
        <POSCart
          isOpen={showMobileCart}
          onClose={() => setShowMobileCart(false)}
          orderItems={orderItems}
          language={language}
          orderType={orderType}
          selectedOrderTypeId={selectedOrderTypeId}
          employeeDiscount={employeeDiscount}
          packagingCost={packagingCost}
          woltPackagingCost={woltPackagingCost}
          boltPackagingCost={boltPackagingCost}
          onOrderTypeChange={(type) => {
            setOrderType(type)
            // Определяем ID типа заказа независимо от языка
            const dineInNames = ['В заведении', 'Vietoje']
            const takeawayNames = ['На винос', 'Išsinešti']
            const phoneNames = ['По телефону', 'Telefonu']
            const deliveryNames = ['Доставка', 'Pristatymas']
            
            if (dineInNames.includes(type)) {
              setSelectedOrderTypeId('dine-in')
            } else if (takeawayNames.includes(type)) {
              setSelectedOrderTypeId('takeaway')
            } else if (phoneNames.includes(type)) {
              setSelectedOrderTypeId('phone')
              setShowPhoneDialog(true)
            } else if (deliveryNames.some(name => type.startsWith(name))) {
              setSelectedOrderTypeId('delivery')
            } else {
              setSelectedOrderTypeId('dine-in')
            }
          }}
          onUpdateQuantity={orderManagement.updateQuantity}
          onClearOrder={() => {
            orderManagement.clearOrder()
            setOrderType('')
            setSelectedOrderTypeId('')
          }}
          onOpenCommentDialog={openCommentDialog}
          onCompleteOrder={async (selectedOrderType?: string, employeeDiscount?: { employeeId: number; employeeName: string; discountPercent: number }) => {
            await completeOrder(selectedOrderType, employeeDiscount)
          }}
          onPreorderClick={() => setShowPreorderDialog(true)}
          onEmployeeDiscountApplied={(d) => setEmployeeDiscount(d)}
          onEmployeeDiscountRemoved={() => setEmployeeDiscount(null)}
          isSubmitting={isSubmitting}
          calculateTotal={orderManagement.calculateTotal}
          translations={{
            currentOrder: t.currentOrder,
            orderEmpty: t.orderEmpty,
            total: t.total,
            completeOrder: t.completeOrder,
            items: language === 'uk' ? 'Товары' : 'Prekės',
            packaging: language === 'uk' ? 'Упаковка' : 'Pakavimas',
            toPay: language === 'uk' ? 'До оплати' : 'Mokėti',
          }}
        />

        {/* Диалог комментария к блюду */}
        <POSCommentDialog
          isOpen={showCommentDialog}
          onClose={() => {
            setShowCommentDialog(false)
            setSelectedItemForComment(null)
            setTempComment('')
          }}
          item={selectedItemForComment}
          language={language}
          onSave={(comment) => {
            if (!selectedItemForComment) return
            
            setOrderItems(prev => prev.map(orderItem => 
              orderItem.id === selectedItemForComment.id && 
              JSON.stringify(orderItem.selectedModifiers) === JSON.stringify(selectedItemForComment.selectedModifiers)
                ? { ...orderItem, comment: comment }
                : orderItem
            ))
            
            const itemKey = `${selectedItemForComment.id}-${JSON.stringify(selectedItemForComment.selectedModifiers)}`
            setItemComments(prev => ({ ...prev, [itemKey]: comment }))
          }}
        />
        {/* Диалог отмены заказа */}
        <Dialog open={showDeleteOrderDialog} onOpenChange={setShowDeleteOrderDialog}>
          <DialogContent className="sm:max-w-md max-w-[95vw] bg-gray-900 border-red-500 text-white">
            <DialogHeader>
              <DialogTitle className="text-red-500 text-xl font-bold">
                🗑️ {language === 'uk' ? 'Скасування замовлення' : 'Užsakymo atšaukimas'}
              </DialogTitle>
            </DialogHeader>
            
            {orderToDelete && (
              <div className="space-y-4">
                <div className="p-4 bg-gray-800 rounded-lg border border-red-500/30">
                  <div className="text-orange-400 font-bold mb-2">
                    {language === 'uk' ? 'Замовлення:' : 'Užsakymas:'} #{orderToDelete.id}
                  </div>
                  <div className="text-gray-300 text-sm">
                    {language === 'uk' ? 'Сума:' : 'Suma:'} <span className="text-white font-bold">€{orderToDelete.total.toFixed(2)}</span>
                  </div>
                  <div className="text-gray-300 text-sm mt-1">
                    {language === 'uk' ? 'Товарів:' : 'Prekių:'} <span className="text-white font-bold">{orderToDelete.items.length}</span>
                  </div>
                </div>

                <div className="bg-red-900/20 border border-red-500 rounded-lg p-3">
                  <p className="text-red-400 text-sm font-medium">
                    ⚠️ {language === 'uk' ? 'Увага! Замовлення буде скасовано. Ця дія незворотна.' : 'Dėmesio! Užsakymas bus atšauktas. Šis veiksmas negrįžtamas.'}
                  </p>
                </div>

                {deletePinError && (
                  <p className="text-red-500 text-sm font-medium">
                    ❌ {deletePinError}
                  </p>
                )}

                <div className="flex gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowDeleteOrderDialog(false)
                      setOrderToDelete(null)
                      setDeletePin('')
                      setDeletePinError('')
                    }}
                    className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-700"
                  >
                    {language === 'uk' ? 'Скасувати' : 'Atšaukti'}
                  </Button>
                  <Button
                    onClick={deleteOrderWithPin}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold"
                  >
                    ❌ {language === 'uk' ? 'Скасувати замовлення' : 'Atšaukti užsakymą'}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Диалог выбора времени предзаказа (рефакторинг на компонент) */}
        <POSPreorderDialog
          open={showPreorderDialog}
          onOpenChange={setShowPreorderDialog}
          language={language}
          preorderTime={preorderTime}
          onPreorderTimeChange={setPreorderTime}
          onConfirm={() => {
            const isMatch = /^\d{2}:\d{2}$/.test(preorderTime)
            let ok = false
            if (isMatch) {
              const [h, m] = preorderTime.split(':').map(Number)
              ok = h >= 0 && h <= 23 && m >= 0 && m <= 59
            }
            if (ok) {
              setIsPreorder(true)
              setShowPreorderDialog(false)
              audio.playSound('click')
            } else {
              alert(
                language === 'uk'
                  ? 'Невірний формат часу (24 години: ЧЧ:ММ)'
                  : 'Neteisingas laiko formatas (24 val.: VV:MM)'
              )
            }
          }}
          onCancel={() => {
            setShowPreorderDialog(false)
            setPreorderTime('')
          }}
          t={t}
        />

        {/* Диалог истории заказов */}
        <POSOrderHistoryDialog
          open={showOrderHistory}
          onOpenChange={setShowOrderHistory}
          language={language}
          t={t}
          completedOrders={completedOrders}
          readyForDeliveryCount={readyForDeliveryCount}
          deliveringOrders={orderHistory.deliveringOrders}
          getOrderStatusColor={getOrderStatusColorForDialog}
          translateOrderStatus={translateOrderStatusForDialog}
          markOrderAsDelivered={markOrderAsDelivered}
          onDeleteClick={handleDeleteOrderClick}
          onReorderClick={handleReorderClick}
        />

        {/* Диалог ввода номера телефона (рефакторинг на компонент) */}
        <POSPhoneDialog
          open={showPhoneDialog}
          onOpenChange={setShowPhoneDialog}
          language={language}
          phoneNumber={phoneNumber}
          customerName={customerName}
          onPhoneNumberChange={setPhoneNumber}
          onCustomerNameChange={setCustomerName}
          onConfirm={() => {
            if (phoneNumber.trim()) {
              setOrderType('phone')
              setShowPhoneDialog(false)
              audio.playSound('click')
            } else {
              alert(language === 'uk' ? 'Введіть номер телефону' : 'Įveskite telefono numerį')
            }
          }}
          onCancel={() => {
            setShowPhoneDialog(false)
            setPhoneNumber('')
            setCustomerName('')
            setSelectedOrderTypeId('')
          }}
          t={t}
        />

        {/* Диалог выбора мяса */}
        <POSMeatDialog
          isOpen={showMeatDialog}
          onClose={() => setShowMeatDialog(false)}
          language={language}
          selectedModifiers={selectedModifiers}
          onToggleModifier={toggleModifier}
          getModifierColor={getModifierColor}
        />
      </div>
    </div>
  )
}
