"use client"

import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Clock, ChefHat, CheckCircle, AlertCircle, Maximize2, Volume2, VolumeX, BellRing, Store, Phone, ShoppingBag, Car, Globe } from "lucide-react"
import { initBroadcastChannel, onBroadcastSyncEvent, createPollingFallback, createSSEManager, type SyncEvent } from "@/lib/sync"

// Типы данных
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

interface KitchenOrder {
  id: string
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
  tableNumber?: string
  customerName?: string
}

// Переводы для кухонного дисплея
const translations = {
  uk: {
    titleShort: "Кухня",
    noActiveOrders: "Немає активних замовлень",
    newOrdersWillAppear: "Нові замовлення з'являться тут",
    loadingOrders: "Завантаження замовлень...",
    errorLoadingOrders: "Помилка завантаження замовлень",
    lastSavedData: "Показані останні збережені дані",
    fullscreen: "Повний екран",
    exit: "Вийти",
    soundOn: "Звук УВІМК",
    soundOff: "Звук ВИМК",
    table: "Стіл",
    startCooking: "Почати готувати",
    ready: "Готово",
    completed: "Видано",
    overdue: "ПРОСТРОЧЕНО",
    status: {
      new: "Новий",
      preparing: "Готується",
      ready: "Готовий",
      completed: "Виданий"
    },
    orderTypes: {
      dineIn: "ЗАЛ",
      phone: "ТЕЛЕФОН",
      takeaway: "ВИНОС",
      delivery: "ДОСТАВКА",
      unknown: "НЕВІДОМО"
    },
    preorderReminder: "Напоминание о предзаказе",
    minutesUntilPreorder: "мин до предзаказа",
    startCookingNow: "Начинайте готовить сейчас",
    preorderTime: "Время предзаказа"
  },
  lt: {
    titleShort: "Virtuvė",
    noActiveOrders: "Nėra aktyvių užsakymų",
    newOrdersWillAppear: "Nauji užsakymai atsiras čia",
    loadingOrders: "Kraunami užsakymai...",
    errorLoadingOrders: "Klaida kraunant užsakymus",
    lastSavedData: "Rodomi paskutiniai išsaugoti duomenys",
    fullscreen: "Visas ekranas",
    exit: "Išeiti",
    soundOn: "Garsas ĮJUNGTAS",
    soundOff: "Garsas IŠJUNGTAS",
    table: "Stalas",
    startCooking: "Pradėti gaminti",
    ready: "Paruošta",
    completed: "Išduota",
    overdue: "VĖLUOJA",
    status: {
      new: "Naujas",
      preparing: "Gaminamas",
      ready: "Paruoštas",
      completed: "Išduotas"
    },
    orderTypes: {
      dineIn: "SALĖ",
      phone: "TELEFONAS",
      takeaway: "IŠSINEŠTI",
      delivery: "PRISTATYMAS",
      unknown: "NEŽINOMA"
    },
    preorderReminder: "Išankstinio užsakymo priminimas",
    minutesUntilPreorder: "min iki išankstinio užsakymo",
    startCookingNow: "Pradėkite gaminti dabar",
    preorderTime: "Išankstinio užsakymo laikas"
  }
}

type Language = "uk" | "lt"

const getStatusConfig = (language: Language) => ({
  new: {
    label: translations[language].status.new,
    color: "bg-orange-500",
    textColor: "text-orange-700",
    bgColor: "bg-orange-50 border-orange-200",
    icon: <AlertCircle className="w-5 h-5" />,
  },
  preparing: {
    label: translations[language].status.preparing,
    color: "bg-yellow-500",
    textColor: "text-yellow-700",
    bgColor: "bg-yellow-50 border-yellow-200",
    icon: <ChefHat className="w-5 h-5" />,
  },
  ready: {
    label: translations[language].status.ready,
    color: "bg-green-500",
    textColor: "text-green-700",
    bgColor: "bg-green-50 border-green-200",
    icon: <CheckCircle className="w-5 h-5" />,
  },
  completed: {
    label: translations[language].status.completed,
    color: "bg-gray-500",
    textColor: "text-gray-700",
    bgColor: "bg-gray-50 border-gray-200",
    icon: <CheckCircle className="w-5 h-5" />,
  },
})

const getOrderTypeConfig = (orderType: string) => {
  const normalizedType = orderType.toLowerCase()
  
  if (normalizedType.includes('телефон') || normalizedType.includes('telefonas') || normalizedType.includes('phone')) {
    return {
      label: 'ТЕЛЕФОН',
      color: 'bg-blue-600 text-white border-blue-400',
      icon: <Phone className="w-full h-full" />
    }
  }
  
  if (normalizedType.includes('винос') || normalizedType.includes('išsinešti') || normalizedType.includes('takeaway')) {
    return {
      label: 'ВИНОС',
      color: 'bg-green-600 text-white border-green-400',
      icon: <ShoppingBag className="w-full h-full" />
    }
  }
  
  if (normalizedType.includes('доставка') || normalizedType.includes('pristatymas') || normalizedType.includes('delivery')) {
    return {
      label: 'ДОСТАВКА',
      color: 'bg-purple-600 text-white border-purple-400',
      icon: <Car className="w-full h-full" />
    }
  }
  
  // По умолчанию - в зале
  return {
    label: 'ЗАЛ',
    color: 'bg-orange-600 text-white border-orange-400',
    icon: <Store className="w-full h-full" />
  }
}

export default function KitchenDisplay() {
  const [orders, setOrders] = useState<KitchenOrder[]>([])
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [lastNewOrderIds, setLastNewOrderIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [language, setLanguage] = useState<Language>("lt")
  const [soundEnabled, setSoundEnabled] = useState(false)
  const audioContextRef = useRef<AudioContext | null>(null)
  const lastPlayRef = useRef<number>(0)
  const playedNewOrderSounds = useRef<Set<string>>(new Set())
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const preorderCheckInterval = useRef<NodeJS.Timeout | null>(null)
  const overdueCheckRef = useRef<Set<string>>(new Set())
  const preorderAlertedRef = useRef<Set<string>>(new Set())

  const t = translations[language]
  const statusConfig = getStatusConfig(language)

  // Вычисление рабочего диапазона кухни: 21:00 предыдущего дня — 21:00 текущего (или следующего) дня
  const getKitchenWorkRange = () => {
    const now = new Date()
    const today21 = new Date(now)
    today21.setHours(21, 0, 0, 0)

    let from = new Date(today21)
    let to = new Date(today21)

    if (now < today21) {
      // Сейчас до 21:00 — берём диапазон с 21:00 предыдущего дня до 21:00 сегодня
      from.setDate(from.getDate() - 1)
      // to уже равно сегодня 21:00
    } else {
      // Сейчас после 21:00 — берём диапазон с 21:00 сегодня до 21:00 завтра
      to.setDate(to.getDate() + 1)
    }

    const toISO = to.toISOString()
    const fromISO = from.toISOString()
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    return { fromISO, toISO, fromLocal: fmt(from), toLocal: fmt(to) }
  }

  // Функция для проверки, должен ли предзаказ отображаться
  const shouldShowPreorder = (order: KitchenOrder): boolean => {
    if (!order.is_preorder || !order.preorder_time) {
      return true // Обычные заказы показываем всегда
    }
    
    const now = new Date()
    const currentTime = now.getHours() * 60 + now.getMinutes()
    const [hours, minutes] = order.preorder_time.split(':').map(Number)
    const preorderTime = hours * 60 + minutes
    
    // Показываем предзаказ за 15 минут до времени
    const timeDifference = preorderTime - currentTime
    
    console.log(`[Kitchen] Проверка предзаказа #${order.id}:`, {
      currentTime: `${Math.floor(currentTime/60)}:${(currentTime%60).toString().padStart(2,'0')}`,
      preorderTime: order.preorder_time,
      timeDifference: timeDifference,
      shouldShow: timeDifference <= 15
    })
    
    return timeDifference <= 15
  }



  // Функция для получения цвета блюда по индексу
  const getDishColor = (index: number) => {
    const colors = [
      { border: "border-l-blue-500 border-blue-500", bg: "" },
      { border: "border-l-green-500 border-green-500", bg: "" },
      { border: "border-l-purple-500 border-purple-500", bg: "" },
      { border: "border-l-orange-500 border-orange-500", bg: "" },
      { border: "border-l-pink-500 border-pink-500", bg: "" },
      { border: "border-l-indigo-500 border-indigo-500", bg: "" },
    ]
    return colors[index % colors.length]
  }

  // Функция для получения цвета модификатора по типу
  const getModifierColor = (modifier: any) => {
    const modifierType = modifier.type || modifier.modifier_type || ''
    
    const modifierName = modifier.name || modifier.name_uk || modifier.name_lt || ''
    const displayModifierName =
      language === 'uk'
        ? (modifier.name_uk || modifier.name || modifier.name_lt || '')
        : (modifier.name_lt || modifier.name || modifier.name_uk || '')
    const groupName = modifier.groupName || modifier.group_name || ''
    const searchText = (modifierName + ' ' + groupName).toLowerCase()
    
    if (String(displayModifierName).trim().toLowerCase() === 'atskirai') {
      return 'bg-yellow-400 text-black px-3 py-1 rounded border-4 border-red-700'
    }
    
    // Определяем цвет по типу модификатора с фоном для лучшей видимости
    switch (modifierType.toLowerCase()) {
      case 'sauce':
      case 'соус':
      case 'padažas':
        return 'bg-red-600 text-white px-2 py-1 rounded' // Красный для соусов
        
      case 'size':
      case 'размер':
      case 'dydis':
        return 'bg-blue-600 text-white px-2 py-1 rounded' // Синий для размеров
        
      case 'addon':
      case 'добавка':
      case 'priedas':
        return 'bg-purple-600 text-white px-2 py-1 rounded' // Фиолетовый для добавок
        
      case 'cheese':
      case 'сыр':
      case 'sūris':
        return 'bg-amber-600 text-white px-2 py-1 rounded' // Янтарный для сыра
        
      case 'meat':
      case 'мясо':
      case 'mėsa':
        return 'bg-orange-600 text-white px-2 py-1 rounded' // Оранжевый для мяса
        
      case 'vegetable':
      case 'овощи':
      case 'daržovės':
        return 'bg-green-600 text-white px-2 py-1 rounded' // Зелёный для овощей
        
      case 'drink':
      case 'напиток':
      case 'gėrimas':
        return 'bg-cyan-600 text-white px-2 py-1 rounded' // Голубой для напитков
        
      default:
        // Fallback: если тип не определен, используем улучшенную логику по названию
        
        
        // Соусы - красный
        if (searchText.includes('соус') || searchText.includes('padažas') || searchText.includes('sauce') ||
            searchText.includes('кетчуп') || searchText.includes('майонез') || searchText.includes('горчиц') ||
            searchText.includes('чесночн') || searchText.includes('острый') || searchText.includes('йогурт')) {
          return 'bg-red-600 text-white px-2 py-1 rounded'
        }
        
        // Овощи и исключения - зеленый
        else if (searchText.includes('огурц') || searchText.includes('помидор') || searchText.includes('лук') ||
                 searchText.includes('салат') || searchText.includes('капуст') || searchText.includes('перец') ||
                 searchText.includes('без') || searchText.includes('овощ') || searchText.includes('daržov') || 
                 searchText.includes('vegetable')) {
          return 'bg-green-600 text-white px-2 py-1 rounded'
        }
        
        // Размеры - синий
        else if (searchText.includes('размер') || searchText.includes('dydis') || searchText.includes('size') ||
                 searchText.includes('больш') || searchText.includes('малень') || searchText.includes('средн') ||
                 searchText.includes('didelis') || searchText.includes('mažas')) {
          return 'bg-blue-600 text-white px-2 py-1 rounded'
        }
        
        // Сыр - янтарный
        else if (searchText.includes('сыр') || searchText.includes('sūris') || searchText.includes('cheese') ||
                 searchText.includes('cheddar') || searchText.includes('моцарелла') || searchText.includes('parmesan')) {
          return 'bg-amber-600 text-white px-2 py-1 rounded'
        }
        
        // Мясо - оранжевый
        else if (searchText.includes('кур') || searchText.includes('свини') || searchText.includes('говя') ||
                 searchText.includes('шашлык') || searchText.includes('kebabas') || searchText.includes('mėsa') ||
                 searchText.includes('kepta')) {
          return 'bg-orange-600 text-white px-2 py-1 rounded'
        }
        
        // Напитки - голубой
        else if (searchText.includes('чай') || searchText.includes('кофе') || searchText.includes('cola') ||
                 searchText.includes('sprite') || searchText.includes('fanta') || searchText.includes('gėrimas')) {
          return 'bg-cyan-600 text-white px-2 py-1 rounded'
        }
        
        // Добавки - фиолетовый
        else if (searchText.includes('добавк') || searchText.includes('priedas') || searchText.includes('addon') ||
                 searchText.includes('дополнительн') || searchText.includes('экстра') || searchText.includes('двойн')) {
          return 'bg-purple-600 text-white px-2 py-1 rounded'
        }
        
        // По умолчанию - серый
        else {
          return 'bg-gray-600 text-white px-2 py-1 rounded'
        }
    }
  }

  const playNotificationSound = async (isOverdue = false) => {
    console.log("[v0] playNotificationSound called:", { soundEnabled, isOverdue })
    
    if (!soundEnabled) {
      console.log("[v0] Звук отключен пользователем")
      return
    }

    try {
      console.log("[v0] Attempting to play sound...")
      
      if (!audioContextRef.current) {
        console.log("[v0] Creating new AudioContext...")
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }
      const audioContext = audioContextRef.current
      console.log("[v0] AudioContext state:", audioContext.state)

      if (audioContext.state === "suspended") {
        console.log("[v0] Resuming suspended AudioContext...")
        await audioContext.resume()
        console.log("[v0] AudioContext resumed, new state:", audioContext.state)
      }

      const now = Date.now()
      if (now - lastPlayRef.current < 700) {
        console.log("[v0] Sound throttled, too soon since last play")
        return
      }
      lastPlayRef.current = now

      console.log("[v0] Creating oscillator and gain node...")
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      if (isOverdue) {
        console.log("[v0] Setting up overdue sound...")
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime)
        oscillator.frequency.setValueAtTime(1200, audioContext.currentTime + 0.1)
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2)
        oscillator.frequency.setValueAtTime(1200, audioContext.currentTime + 0.3)
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.4)
        gainNode.gain.setValueAtTime(0.9, audioContext.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1.0)
        oscillator.start(audioContext.currentTime)
        oscillator.stop(audioContext.currentTime + 1.0)
        console.log("[v0] Звук просроченного заказа воспроизведен")
      } else {
        console.log("[v0] Setting up normal notification sound...")
        oscillator.frequency.setValueAtTime(1000, audioContext.currentTime)
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.1)
        oscillator.frequency.setValueAtTime(1200, audioContext.currentTime + 0.2)
        oscillator.frequency.setValueAtTime(900, audioContext.currentTime + 0.3)
        gainNode.gain.setValueAtTime(0.8, audioContext.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.8)
        oscillator.start(audioContext.currentTime)
        oscillator.stop(audioContext.currentTime + 0.8)
        console.log("[v0] Звуковое уведомление воспроизведено")
      }
    } catch (error) {
      console.error("[v0] Ошибка воспроизведения звука:", error)
      
      try {
        console.log("[v0] Trying fallback HTML5 Audio...")
        const audio = new Audio()
        // Простой beep звук
        audio.src = "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT"
        audio.volume = isOverdue ? 0.7 : 0.5
        const playPromise = audio.play()
        if (playPromise !== undefined) {
          await playPromise
          console.log("[v0] Fallback звук воспроизведен успешно")
        }
      } catch (fallbackError) {
        console.error("[v0] Fallback звук тоже не сработал:", fallbackError)
        
        // Последняя попытка - простой click звук
        try {
          console.log("[v0] Trying simple click sound...")
          if (!audioRef.current) {
            audioRef.current = new Audio()
            // Простой click звук в base64
            audioRef.current.src = "data:audio/mpeg;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdTb3VuZEJhbmsuY29tIC8gTGFTb25vdGhlcXVlLm9yZwBURU5DAAAAHQAAAFN1cmZlciBvbiB0aGUgSW50ZXJuZXQAVFNTRQAAAA8AAANMYXZmNTcuODMuMTAwAAAAAAAAAAAAAAD/80DEAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQsRbAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQMSkAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
          }
          audioRef.current.volume = isOverdue ? 0.8 : 0.6
          await audioRef.current.play()
          console.log("[v0] Simple click sound played")
        } catch (clickError) {
          console.error("[v0] All sound methods failed:", clickError)
          // Показываем визуальное уведомление если звук не работает
          if (isOverdue) {
            document.title = `🔴 ${t.overdue}! - ${t.titleShort}`
            setTimeout(() => { document.title = t.titleShort }, 3000)
          }
        }
      }
    }
  }

  const enableSound = async () => {
    try {
      console.log("[v0] enableSound called")
      setSoundEnabled(true)
      if (typeof window !== 'undefined') {
        localStorage.setItem('soundEnabled', 'true')
      }
      console.log("[v0] Sound enabled, creating AudioContext...")
      
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
        console.log("[v0] New AudioContext created, state:", audioContextRef.current.state)
      }
      
      if (audioContextRef.current.state === 'suspended') {
        console.log("[v0] AudioContext suspended, resuming...")
        await audioContextRef.current.resume()
        console.log("[v0] AudioContext resumed, new state:", audioContextRef.current.state)
      }
      
      console.log("[v0] Playing test sound...")
      await playNotificationSound(false)
    } catch (e) {
      console.error('[v0] Не удалось активировать звук:', e)
      alert('Ошибка активации звука: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  const disableSound = () => {
    setSoundEnabled(false)
    if (typeof window !== 'undefined') {
      localStorage.setItem('soundEnabled', 'false')
    }
  }

  // Проверка просроченных заказов
  const checkOverdueOrders = async () => {
    if (!soundEnabled) return

    const currentOverdueIds = new Set<string>()
    
    orders.forEach(order => {
      const elapsedTime = getElapsedTime(order.timestamp)
      const isOverdue = elapsedTime > (order.estimatedTime || 10)
      
      if (isOverdue && (order.status === 'new' || order.status === 'preparing')) {
        currentOverdueIds.add(order.id)
        
        // Если заказ стал просроченным (не был просроченным раньше)
        if (!overdueCheckRef.current.has(order.id)) {
          playNotificationSound(true)
        }
      }
    })
    
    overdueCheckRef.current = currentOverdueIds
  }

  useEffect(() => {
    let isMounted = true
    const fetchOrders = async () => {
      try {
        setError(null)
        const { fromISO, toISO, fromLocal, toLocal } = getKitchenWorkRange()
        console.log('[Kitchen] Fetch range:', { fromLocal, toLocal, fromISO, toISO })
        const response = await fetch(`/api/orders?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}`)
        
        if (!isMounted) return
        
        if (!response.ok) {
          throw new Error('Ошибка загрузки заказов')
        }
        
        const data = await response.json()
        
        if (isMounted) {
          const ordersData = data.orders || data || []
          console.log('[Kitchen] API returned orders:', ordersData.length, 'orders')
          if (!Array.isArray(ordersData)) {
            throw new Error('Invalid orders data format')
          }
          
          const processedOrders = ordersData
            .filter((order: any) => {
              const shouldShow = order.status !== 'cancelled' && order.status !== 'delivered' && order.status !== 'completed'
              if (!shouldShow) {
                console.log('[Kitchen] Filtering out order', order.id, 'with status:', order.status)
              }
              return shouldShow
            })
            .map((order: any) => {
              // Validate and parse timestamp - використовуємо created_at з бази даних
              let timestamp: Date
              try {
                // Пріоритет: created_at з бази даних, потім timestamp
                const timeValue = order.created_at || order.timestamp
                
                if (!timeValue || typeof timeValue === 'object') {
                  console.warn(`[Kitchen] Invalid timestamp for order ${order.id}:`, timeValue)
                  timestamp = new Date() // Use current time as fallback
                } else {
                  // Парсимо дату - якщо це UTC, конвертуємо в локальний час
                  timestamp = new Date(timeValue)
                  if (isNaN(timestamp.getTime())) {
                    console.warn(`[Kitchen] Invalid date for order ${order.id}:`, timeValue)
                    timestamp = new Date()
                  }
                }
              } catch (e) {
                console.error(`[Kitchen] Error parsing timestamp for order ${order.id}:`, e)
                timestamp = new Date()
              }

              const mappedOrder = {
                ...order,
                daily_number: order.daily_number != null ? String(order.daily_number) : undefined,
                orderType: order.orderType || order.order_type || order.ordertype,
                estimatedTime: order.estimatedTime || order.estimated_time,
                timestamp,
                is_preorder: Boolean(Number(order.is_preorder)),
                preorder_time: order.preorder_time || null,
                tableNumber: order.table_number || order.tableNumber,
                customerName: order.customer_name || order.customerName
              }
              console.log(`[Kitchen] Order #${order.id} orderType:`, mappedOrder.orderType)
              return mappedOrder
            })

          // Detect new orders and play notification
          const currentNewOrderIds = new Set<string>(
            processedOrders
              .filter((order: any) => order.status === 'new')
              .map((order: any) => String(order.id))
          )
          
          console.log("[v0] Order detection:", {
            currentNewOrderIds: Array.from(currentNewOrderIds),
            lastNewOrderIds: Array.from(lastNewOrderIds),
            soundEnabled
          })
          
          const hasNewOrders = Array.from(currentNewOrderIds).some((id) => !lastNewOrderIds.has(id))
          console.log("[v0] Has new orders:", hasNewOrders)
          
          if (hasNewOrders) {
            // Проверяем, какие заказы действительно новые и ещё не проигрывали звук
            const trulyNewOrders = Array.from(currentNewOrderIds).filter(id => 
              !lastNewOrderIds.has(id) && !playedNewOrderSounds.current.has(id)
            )
            
            if (trulyNewOrders.length > 0) {
              console.log("[v0] Playing sound for truly new orders:", trulyNewOrders)
              await playNotificationSound(false)
              
              // Отмечаем, что для этих заказов уже проиграли звук
              trulyNewOrders.forEach(id => playedNewOrderSounds.current.add(id))
            }
          }
          setLastNewOrderIds(currentNewOrderIds)

          // Обновляем заказы, но сохраняем статусы недавно обновленных
          setOrders(prevOrders => {
            const now = Date.now()
            return processedOrders.map((newOrder: any) => {
              const lastUpdate = lastUpdateTime.current.get(newOrder.id)
              // Если заказ был обновлен менее 5 секунд назад, сохраняем его локальный статус
              if (lastUpdate && (now - lastUpdate) < 5000) {
                const prevOrder = prevOrders.find(o => o.id === newOrder.id)
                if (prevOrder) {
                  console.log(`[Kitchen] Сохраняем локальный статус для заказа ${newOrder.id}: ${prevOrder.status}`)
                  return { ...newOrder, status: prevOrder.status }
                }
              }
              return newOrder
            })
          })
          
          try {
            if (typeof window !== 'undefined') {
              localStorage.setItem('kitchenOrders', JSON.stringify(processedOrders))
            }
          } catch (e) {
            console.error('Ошибка сохранения в localStorage:', e)
          }
        }
      } catch (err) {
        if (isMounted) {
          const errorMsg = err instanceof Error ? err.message : 'Произошла ошибка'
          setError(errorMsg)
          console.error('[Kitchen] Ошибка загрузки заказов:', errorMsg, err)
          
          try {
            if (typeof window !== 'undefined') {
              const savedOrders = localStorage.getItem('kitchenOrders')
              if (savedOrders) {
                const parsed = JSON.parse(savedOrders)
                setOrders(parsed.map((o: any) => ({
                  ...o,
                  timestamp: new Date(o.timestamp)
                })))
              }
            }
          } catch (e) {
            console.error('Ошибка загрузки из localStorage:', e)
          }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    fetchOrders()
    
    // Инициализация улучшенной синхронизации
    initBroadcastChannel()
    
    // SSE менеджер с улучшенным reconnect
    const sseManager = createSSEManager(
      '/api/events',
      async (event) => {
        try {
          console.log('[Kitchen SSE] 📨 Получено сообщение:', event.data)
          const data = JSON.parse(event.data)
          console.log('[Kitchen SSE] 📦 Распарсенные данные:', data)
          
          if (data.type === 'order-created') {
            const newOrderId = data.data?.orderId
            console.log('[Kitchen SSE] 🆕 New order created:', newOrderId, 'Current orders:', orders.length)
            console.log('[Kitchen SSE] Fetching orders immediately...')
            await fetchOrders()
            console.log('[Kitchen SSE] ✅ Orders fetched, new count:', orders.length)

          } else if (data.type === 'order-status-updated') {
            // Immediate fetch to prevent flicker/race
            console.log(`[Kitchen SSE] � Order status updated: ${data.data.orderId} -> ${data.data.status}`)
            await fetchOrders()
          }
        } catch (e) {
          console.error('[Kitchen SSE] ❌ Message parse error:', e)
        }
      },
      () => {
        console.log('[Kitchen SSE] Connection error, fallback polling active')
      },
      {
        staleTimeoutMs: 15000,
        onStale: async () => {
          try {
            console.log('[Kitchen SSE] Watchdog: SSE silent, forcing fetchOrders')
            await fetchOrders()
          } catch (e) {
            console.error('[Kitchen SSE] Watchdog fetchOrders failed:', e)
          }
        },
      }
    )
    
    // Запускаем SSE
    sseManager.connect()
    
    // Polling fallback на случай если SSE не работает
    const polling = createPollingFallback(async () => {
      try {
        await fetchOrders()
      } catch (error) {
        console.error('[Kitchen] Polling fetch failed:', error)
      }
    }, 1000) // Уменьшили интервал до 1с для быстрого обновления
    
    // Запускаем polling как страховку
    polling.start()
    
    // Подписка на BroadcastChannel события
    const unsubscribeBroadcast = onBroadcastSyncEvent(async (event: SyncEvent) => {
      console.log('[Kitchen] BroadcastChannel event:', event)
      
      if (event.type === 'order-status-updated') {
        console.log(`[Kitchen] 🔄 Order status updated via BroadcastChannel: ${event.data.orderId} -> ${event.data.status}`)
        // Immediate fetch to prevent race with optimistic updates
        setTimeout(async () => {
          try {
            await fetchOrders()
          } catch (error) {
            console.error('[Kitchen] BroadcastChannel status update fetch failed:', error)
          }
        }, 100)
      } else if (event.type === 'order-created') {
        // Новый заказ - перезагружаем
        setTimeout(async () => {
          try {
            await fetchOrders()
          } catch (error) {
            console.error('[Kitchen] Order created reload failed:', error)
          }
        }, 200)
      }
    })
    
    // Cleanup при размонтировании
    return () => {
      sseManager.destroy()
      polling.stop()
      unsubscribeBroadcast()
      console.log('[Kitchen] Sync system cleaned up')
    }
  }, [isMounted])

  useEffect(() => {
    setIsMounted(true)
    // Оновлюємо час кожні 10 секунд замість 1 для економії ресурсів на слабких ПК
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 10000) // 10 секунд замість 1 - достатньо для кухні
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedSound = localStorage.getItem('soundEnabled')
      if (storedSound !== null) {
        const enabled = storedSound === 'true'
        setSoundEnabled(enabled)
        if (enabled) {
          enableSound().catch(() => {})
        }
      }
      
      // Загружаем сохраненный язык
      const storedLanguage = localStorage.getItem('kitchenLanguage')
      if (storedLanguage && (storedLanguage === 'uk' || storedLanguage === 'lt')) {
        setLanguage(storedLanguage as Language)
      }
      
      // Инициализируем lastNewOrderIds из localStorage чтобы избежать ложных уведомлений
      const storedOrders = localStorage.getItem('kitchenOrders')
      if (storedOrders) {
        try {
          const parsed = JSON.parse(storedOrders)
          const existingNewOrderIds = new Set<string>(
            parsed
              .filter((order: any) => order.status === 'new')
              .map((order: any) => String(order.id))
          )
          setLastNewOrderIds(existingNewOrderIds)
          console.log("[v0] Initialized lastNewOrderIds from localStorage:", Array.from(existingNewOrderIds))
        } catch (e) {
          console.error("[v0] Error parsing stored orders:", e)
        }
      }
    }
  }, [])

  // Проверяем просроченные заказы каждую минуту
  useEffect(() => {
    const overdueInterval = setInterval(checkOverdueOrders, 60000) // каждую минуту
    return () => clearInterval(overdueInterval)
  }, [orders, soundEnabled])


  // Звуковой сигнал для предзаказов при входе в окно 15 минут до времени
  useEffect(() => {
    if (preorderCheckInterval.current) {
      clearInterval(preorderCheckInterval.current)
      preorderCheckInterval.current = null
    }

    const checkPreorders = () => {
      if (!soundEnabled) return
      const now = new Date()
      const currentMinutes = now.getHours() * 60 + now.getMinutes()

      orders.forEach((order) => {
        if (!order.is_preorder || !order.preorder_time) return
        const [h, m] = order.preorder_time.split(':').map(Number)
        const preorderMinutes = (h || 0) * 60 + (m || 0)
        const diff = preorderMinutes - currentMinutes // мин до предзаказа

        // Сигнал один раз при входе в окно 0..15 минут до времени предзаказа
        if (diff <= 15 && diff >= 0) {
          const id = String(order.id)
          if (!preorderAlertedRef.current.has(id)) {
            playNotificationSound(false)
              .catch(() => {})
            preorderAlertedRef.current.add(id)
          }
        }

        // Очистка флага после прохождения времени (-1 и меньше)
        if (diff < 0 && preorderAlertedRef.current.has(String(order.id))) {
          preorderAlertedRef.current.delete(String(order.id))
        }
      })
    }

    // Проверяем чаще, чтобы не пропускать момент входа в окно
    preorderCheckInterval.current = setInterval(checkPreorders, 15000) // каждые 15 сек
    // Мгновенная проверка при изменении orders
    checkPreorders()

    return () => {
      if (preorderCheckInterval.current) {
        clearInterval(preorderCheckInterval.current)
        preorderCheckInterval.current = null
      }
    }
  }, [orders, soundEnabled])

  const getElapsedTime = (timestamp: Date | string) => {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      console.error('Invalid date:', timestamp)
      return 0
    }
    const elapsed = Math.floor((currentTime.getTime() - date.getTime()) / 1000 / 60)
    // Захист від негативних значень (якщо timestamp в майбутньому через проблеми з timezone)
    return Math.max(0, elapsed)
  }

  const formatTime = (date: Date | string): string => {
    try {
      const d = typeof date === 'string' ? new Date(date) : date
      if (!(d instanceof Date) || isNaN(d.getTime())) {
        return '--:--:--'
      }
      
      // Форматуємо час у локальному часовому поясі
      const hours = d.getHours().toString().padStart(2, '0')
      const minutes = d.getMinutes().toString().padStart(2, '0')
      const seconds = d.getSeconds().toString().padStart(2, '0')
      
      return `${hours}:${minutes}:${seconds}`
    } catch (error) {
      console.error('Error formatting time:', error)
      return '--:--:--'
    }
  }

  // Защита от двойного клика и отслеживание последнего обновления
  const [updatingOrders, setUpdatingOrders] = useState<Set<string>>(new Set())
  const lastUpdateTime = useRef<Map<string, number>>(new Map())

  const updateOrderStatus = async (orderId: string, newStatus: KitchenOrder["status"]) => {
    // Проверяем, не обновляется ли уже этот заказ
    if (updatingOrders.has(orderId)) {
      console.log(`[Kitchen] Заказ ${orderId} уже обновляется, пропускаем`)
      return
    }

    console.log('[Kitchen Status] 🔄 Updating order status:', {
      orderId,
      oldStatus: orders.find(o => o.id === orderId)?.status,
      newStatus
    })

    try {
      // Добавляем заказ в список обновляемых
      setUpdatingOrders(prev => new Set(prev).add(orderId))
      
      // Сохраняем время обновления
      lastUpdateTime.current.set(orderId, Date.now())

      // ОПТИМИСТИЧНОЕ ОБНОВЛЕНИЕ - обновляем UI мгновенно
      console.log('[Kitchen Status] ⚡ Optimistic UI update')
      setOrders((prev) => {
        const updated = prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
        if (typeof window !== 'undefined') {
          localStorage.setItem('kitchenOrders', JSON.stringify(updated))
        }
        return updated
      })

      console.log('[Kitchen Status] 📡 Sending PUT request to API...')
      const response = await fetch("/api/orders", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orderId, status: newStatus }),
      })

      console.log('[Kitchen Status] 📥 API response:', {
        status: response.status,
        ok: response.ok
      })

      if (response.ok) {
        // Обновляем локально
        setOrders((prev) => {
          const updated = prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
          if (typeof window !== 'undefined') {
            localStorage.setItem('kitchenOrders', JSON.stringify(updated))
          }
          return updated
        })
        
        // Очищаем звуковые метки для завершённых заказов
        if (newStatus === "completed") {
          playedNewOrderSounds.current.delete(orderId)
          overdueCheckRef.current.delete(orderId)
        }
        
        console.log('[Kitchen Status] ✅ Order status updated successfully')
        console.log('[Kitchen Status] 📡 SSE will broadcast order-status-updated event to all clients')
      }
    } catch (error) {
      console.log("[v0] Ошибка API при обновлении статуса, используем localStorage:", error)
      
      // Fallback: обновляем локально
      setOrders((prev) => {
        const updatedOrders = prev.map((order) => (String(order.id) === String(orderId) ? { ...order, status: newStatus } : order))
        if (typeof window !== 'undefined') {
          localStorage.setItem("kitchenOrders", JSON.stringify(updatedOrders))
        }
        
        // Очищаем звуковые метки для завершённых заказов (локальная версия)
        if (newStatus === "completed") {
          playedNewOrderSounds.current.delete(orderId)
        }
        
        return updatedOrders
      })
    } finally {
      // Убираем заказ из списка обновляемых
      setUpdatingOrders(prev => {
        const newSet = new Set(prev)
        newSet.delete(orderId)
        return newSet
      })
    }
  }

  // Фильтруем заказы с учетом времени предзаказа (мемоизация)
  const activeOrders = useMemo(() => orders.filter((order) => {
    const shouldShow = order.status !== "completed" && shouldShowPreorder(order)
    // Отладочная информация для всех заказов
    console.log(`[Kitchen] Заказ #${order.id}:`, {
      status: order.status,
      is_preorder: order.is_preorder,
      preorder_time: order.preorder_time,
      shouldShowPreorder: shouldShowPreorder(order),
      shouldShow: shouldShow
    })
    return shouldShow
  }), [orders])
  
  // Отладочная информация о фильтрации (мемоизация)
  useEffect(() => {
    console.log(`[Kitchen] Всего заказов: ${orders.length}, Активных: ${activeOrders.length}`)
    console.log(`[Kitchen] Предзаказов среди активных:`, activeOrders.filter(o => o.is_preorder).length)
  }, [orders.length, activeOrders.length])

  const getNextStatus = useCallback((currentStatus: KitchenOrder["status"]): KitchenOrder["status"] | null => {
    switch (currentStatus) {
      case "new":
        return "preparing"
      case "preparing":
        return "ready"
      case "ready":
        return null // Повар не может перевести дальше, только POS система
      default:
        return null
    }
  }, [])

  const getNextStatusLabel = useCallback((currentStatus: KitchenOrder["status"]): string => {
    switch (currentStatus) {
      case "new":
        return t.startCooking
      case "preparing":
        return t.ready
      case "ready":
        return "" // Нет кнопки для готовых заказов
      default:
        return ""
    }
  }, [t])

  const toggleLanguage = useCallback(() => {
    const newLanguage = language === "uk" ? "lt" : "uk"
    setLanguage(newLanguage)
    if (typeof window !== 'undefined') {
      localStorage.setItem('kitchenLanguage', newLanguage)
    }
  }, [language])

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }, [])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange)
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange)
  }, [])

  const getOrderTypeConfig = (orderType: string) => {
    console.log('[Kitchen] getOrderTypeConfig called with:', orderType)
    
    // Нормализуем тип заказа
    const normalizedType = orderType?.toLowerCase().trim() || ''
    
    switch (normalizedType) {
      case "в заведении":
      case "в закладі":
      case "valgoma vietoje":
      case "vietoje":
      case "dine-in":
      case "dine in":
        return {
          color: "bg-emerald-600 text-white border-emerald-700 shadow-emerald-500/30",
          icon: <Store className="w-full h-full" />,
          label: t.orderTypes.dineIn,
          bgAccent: "bg-emerald-50 border-emerald-200"
        }
      case "по телефону":
      case "telefonu":
      case "phone":
        return {
          color: "bg-blue-600 text-white border-blue-700 shadow-blue-500/50", 
          icon: <Phone className="w-full h-full" />,
          label: t.orderTypes.phone,
          bgAccent: "bg-blue-50 border-blue-200"
        }
      case "на вынос":
      case "на винос":
      case "išsinešimui":
      case "išsinešti":
      case "takeaway":
      case "take-away":
        return {
          color: "bg-violet-600 text-white border-violet-700 shadow-violet-500/30",
          icon: <ShoppingBag className="w-full h-full" />,
          label: t.orderTypes.takeaway,
          bgAccent: "bg-violet-50 border-violet-200"
        }
      case "доставка • wolt":
      case "pristatymas • wolt":
      case "delivery • wolt":
        return {
          color: "bg-blue-600 text-white border-blue-700 shadow-blue-500/50",
          icon: <Car className="w-full h-full" />,
          label: "🚙 Wolt",
          bgAccent: "bg-blue-50 border-blue-200"
        }
      case "доставка • bolt":
      case "pristatymas • bolt":
      case "delivery • bolt":
        return {
          color: "bg-green-600 text-white border-green-700 shadow-green-500/50",
          icon: <Car className="w-full h-full" />,
          label: "🚗 Bolt",
          bgAccent: "bg-green-50 border-green-200"
        }
      case "доставка":
      case "pristatymas":
      case "delivery":
        return {
          color: "bg-amber-600 text-white border-amber-700 shadow-amber-500/30",
          icon: <Car className="w-full h-full" />,
          label: t.orderTypes.delivery,
          bgAccent: "bg-amber-50 border-amber-200"
        }
      default:
        return {
          color: "bg-slate-600 text-white border-slate-700 shadow-slate-500/30",
          icon: <Store className="w-full h-full" />,
          label: orderType?.toUpperCase() || t.orderTypes.unknown,
          bgAccent: "bg-slate-50 border-slate-200"
        }
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t.loadingOrders}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-700 rounded-lg m-4">
        <p className="font-medium">{t.errorLoadingOrders}</p>
        <p className="text-sm">{error}</p>
        <p className="text-sm mt-2">{t.lastSavedData}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white p-2 sm:p-3 md:p-4 lg:p-6">
      <div className="max-w-full mx-auto">
        <header className="mb-3 sm:mb-4 md:mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={toggleLanguage}
                className="flex items-center gap-2 text-xs sm:text-sm border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-black"
              >
                <Globe className="w-4 h-4" />
                <span className="hidden sm:inline">{language === "uk" ? "LT" : "UK"}</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={toggleFullscreen}
                className="flex items-center gap-2 text-xs sm:text-sm"
              >
                <Maximize2 className="w-4 h-4" />
                <span className="hidden sm:inline">{isFullscreen ? t.exit : t.fullscreen}</span>
              </Button>

            </div>

            <div className="flex-1 min-w-0">
              <p className="text-orange-400 mt-1 text-xs sm:text-sm md:text-base truncate">
                {isMounted ? currentTime.toLocaleTimeString("ru-RU") : "--:--:--"}
              </p>
            </div>
          </div>
        </header>

        {/* Кнопка включения звука */}
        {!soundEnabled && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-300 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-yellow-800 font-bold">Звуковые уведомления отключены</h3>
                <p className="text-yellow-700 text-sm">Нажмите для включения звука новых заказов</p>
              </div>
              <Button
                onClick={enableSound}
                className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold px-6 py-3"
              >
                <Volume2 className="w-5 h-5 mr-2" />
                Включить звук
              </Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 md:gap-8 lg:gap-6 touch-manipulation">
          {activeOrders
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
            .map((order) => {
            const config = statusConfig[order.status]
            const elapsedTime = getElapsedTime(order.timestamp)
            const isOverdue = elapsedTime > (order.estimatedTime || 10)
            const nextStatus = getNextStatus(order.status)

            return (
              <Card
                key={`${order.id}-${Math.floor(currentTime.getTime() / 600000)}`}
                className={`bg-white border-gray-300 ${
                  order.status === "ready"
                    ? "opacity-50 bg-gray-100 border-green-500/50"
                    : order.is_preorder 
                      ? "border-purple-500 shadow-purple-500/30 shadow-lg bg-gradient-to-br from-purple-50 to-white" 
                      : isOverdue 
                        ? "border-red-500 shadow-red-500/20 shadow-md animate-pulse bg-red-50" 
                        : "border-gray-300"
                } transition-all duration-200 touch-manipulation shadow-lg overflow-hidden`}
              >
                <CardHeader className="pb-3 p-4 sm:p-6 md:p-8">
                  <div className={`flex items-center justify-between gap-2 sm:gap-3 md:gap-4 flex-wrap max-w-full ${
                    isOverdue ? "bg-red-50 rounded-t-lg -m-2 p-2 mb-1" : ""
                  }`}>
                    <div className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-wrap max-w-full">
                      <CardTitle className={`text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold ${
                        isOverdue ? "text-red-600 animate-pulse" : "text-gray-900"
                      }`}>
                        #{String((order as any).daily_number ?? order.id)}
                      </CardTitle>
                      
                      {/* Индикатор предзаказа */}
                      {order.is_preorder && (
                        <Badge className="bg-purple-600 text-white border-purple-400 border-2 px-3 py-1 text-sm font-bold shadow-lg animate-pulse">
                          ⏰ ПРЕДЗАКАЗ
                        </Badge>
                      )}
                      <Badge className={`px-3 sm:px-4 md:px-5 py-3 sm:py-4 md:py-5 ${getOrderTypeConfig(order.orderType || '').color} flex items-center justify-center font-bold shadow-xl border-3 rounded-full min-w-[50px] sm:min-w-[60px] md:min-w-[70px] lg:min-w-[80px] aspect-square`}
                        title={getOrderTypeConfig(order.orderType || '').label}
                      >
                        <div className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 lg:w-8 lg:h-8">
                          {getOrderTypeConfig(order.orderType || '').icon}
                        </div>
                      </Badge>
                      <div className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 md:px-4 py-1 sm:py-2 md:py-3 rounded-full border-2 font-bold text-sm sm:text-base md:text-lg lg:text-xl ${
                        isOverdue 
                          ? "text-red-700 font-bold bg-red-100 border-red-500 shadow-red-500/30 animate-pulse" 
                          : "text-gray-700 bg-gray-100 border-gray-400"
                      }`}>
                        <Clock className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5" />
                        <span className="font-bold">{elapsedTime}м</span>
                      </div>
                      
                      {/* Время предзаказа */}
                      {order.is_preorder && order.preorder_time && (
                        <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 md:px-3 py-1 sm:py-1.5 md:py-2 rounded-full border-2 font-bold text-sm sm:text-base md:text-lg lg:text-xl bg-purple-100 border-purple-500 text-purple-800 shadow-purple-500/30 whitespace-nowrap">
                          <span className="text-lg">⏰</span>
                          <span className="font-bold">{order.preorder_time}</span>
                        </div>
                      )}

                      {order.estimatedTime && <span className="text-gray-600 text-xs sm:text-sm md:text-base">/{order.estimatedTime}м</span>}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1 text-xs text-gray-700">
                    <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                      {order.tableNumber && (
                        <span className="bg-gray-800 text-white px-1 sm:px-2 py-1 rounded text-xs font-medium flex-shrink-0">
                          {t.table} {order.tableNumber}
                        </span>
                      )}
                      {order.customerName && <span className="font-medium truncate min-w-0">{order.customerName}</span>}
                      {order.phone_number && (
                        <span className="bg-blue-600 text-white px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-sm sm:text-base font-bold flex-shrink-0 shadow-md flex items-center gap-1">
                          <Phone className="w-3 h-3 sm:w-4 sm:h-4" />
                          {order.phone_number}
                        </span>
                      )}
                    </div>

                  </div>
                </CardHeader>

                <CardContent className="space-y-3 sm:space-y-4 md:space-y-6 p-4 sm:p-6 md:p-8 pt-0">
                  <div className="space-y-2">
                    {order.items.map((item, index) => {
                      const dishColor = getDishColor(index)
                      const hasMultipleQuantity = item.quantity > 1
                      return (
                      <div key={`${item.id}-${index}`} className={`space-y-1 border-l-4 border-2 ${dishColor.border} rounded-lg pl-3 pr-2 py-2 ${
                        hasMultipleQuantity ? 'bg-gradient-to-r from-orange-50 via-yellow-50 to-orange-50 shadow-lg shadow-orange-500/30 border-orange-400' : ''
                      }`}>
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <span className={`font-black text-gray-900 text-lg sm:text-xl md:text-2xl lg:text-3xl block ${
                              hasMultipleQuantity ? 'text-orange-600' : ''
                            }`}>
                              {item.name}
                            </span>
                            {item.notes && (
                              <p className="text-xs text-gray-600 italic mt-1 line-clamp-2">{item.notes}</p>
                            )}
                            {item.comment && (
                              <div className="mt-2 p-2 bg-blue-50 rounded border-l-4 border-blue-500">
                                <p className="text-sm text-blue-800 font-medium">
                                  💬 {item.comment}
                                </p>
                              </div>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <span className={`font-semibold px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 rounded text-base sm:text-lg md:text-xl ${
                              hasMultipleQuantity 
                                ? 'text-white bg-gradient-to-r from-orange-600 to-red-600 shadow-lg shadow-orange-500/50 font-black border-2 border-orange-300' 
                                : 'text-white bg-gray-800'
                            }`}>
                              x{item.quantity}
                            </span>
                          </div>
                        </div>

                        {item.modifiers && Array.isArray(item.modifiers) && item.modifiers.length > 0 && (
                          <div className="ml-2 sm:ml-4 md:ml-6 space-y-2 sm:space-y-3">
                            <div className="flex flex-wrap gap-2 sm:gap-3 md:gap-4">
                              {item.modifiers.map((modifier, modIndex) => (
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
                        updatingOrders.has(order.id)
                          ? "bg-gray-500 cursor-wait opacity-50"
                          : order.status === "new"
                            ? "bg-orange-600 hover:bg-orange-700"
                            : order.status === "preparing"
                              ? "bg-green-600 hover:bg-green-700"
                              : "bg-blue-600 hover:bg-blue-700"
                      }`}
                      onClick={() => updateOrderStatus(order.id, nextStatus)}
                      disabled={updatingOrders.has(order.id)}
                    >
                      {updatingOrders.has(order.id) ? "⏳ Обработка..." : getNextStatusLabel(order.status)}
                    </Button>
                  )}

                  <div className="text-xs text-gray-600 text-center">
                    {isMounted ? formatTime(order.timestamp) : "--:--:--"}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {activeOrders.length === 0 && (
          <div className="text-center py-6 sm:py-8 md:py-12">
            <ChefHat className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 text-orange-600 mx-auto mb-3 sm:mb-4" />
            <h3 className="text-base sm:text-lg md:text-xl font-semibold text-orange-600 mb-2">{t.noActiveOrders}</h3>
            <p className="text-gray-700 text-sm md:text-base">{t.newOrdersWillAppear}</p>
          </div>
        )}
      </div>
    </div>
  )
}
