/**
 * Единый файл типов для POS-системы
 * Содержит все типы, используемые в приложении
 */

// ============================================================================
// Базовые типы
// ============================================================================

export type Language = "lt" | "uk"
export type OrderType = "dine-in" | "phone" | "takeaway"
export type PaymentType = "cash" | "card"

export interface NameDict {
  lt: string
  uk: string
}

// ============================================================================
// Типы модификаторов
// ============================================================================

export interface ModifierOption {
  id: string | number
  name: NameDict
  price: number
}

export interface Modifier {
  id: string | number
  name: NameDict
  groupName: NameDict
  groupId: string
  price: number
  type?: string
  required?: boolean
  options?: ModifierOption[]
}

// ============================================================================
// Типы меню
// ============================================================================

export interface Category {
  id: string | number
  name: NameDict
  parent_id?: string | null
  order_index?: number
}

export interface MenuItem {
  id: string | number
  name: NameDict
  price: number
  category?: string
  category_id?: string
  image?: string
  available?: boolean
  description?: string
  modifiers?: Modifier[]
  combo?: {
    id: string
    slots: any[]
  }
}

// ============================================================================
// Типы заказов
// ============================================================================

export interface OrderItem {
  id: string
  name: NameDict
  price: number
  original_price?: number
  happy_hour_discount?: number
  quantity: number
  selectedModifiers: Modifier[]
  comment?: string
  comboData?: any
  // Дополнительные поля для совместимости
  category?: string
  category_id?: string
  image?: string
  available?: boolean
  description?: string
  modifiers?: Modifier[]
}

export interface CompletedOrder {
  id: string
  business_date?: string
  daily_number?: string
  items: OrderItem[]
  total: number
  orderType: string
  timestamp: Date
  customer_name?: string
  phone_number?: string
  table_number?: string
  status?: string
  preorder_time?: string
  is_preorder?: boolean
  employee_discount_id?: number | null
  employee_discount_name?: string | null
  employee_discount_percent?: number | null
  employee_discount_amount?: number | null
}

// ============================================================================
// Типы для скидок
// ============================================================================

export interface EmployeeDiscount {
  employeeId: number
  employeeName: string
  discountPercent: number
}

// ============================================================================
// Типы для уведомлений
// ============================================================================

export interface OrderNotification {
  orderId: string
  orderNumber: string
  items: Array<{
    name: string
    quantity: number
    price: number
  }>
  total: number
  orderType: string
  timestamp: Date
}

// ============================================================================
// Типы для истории заказов
// ============================================================================

export interface OrderHistoryFilters {
  status?: string
  orderType?: string
  dateFrom?: Date
  dateTo?: Date
}

// ============================================================================
// Типы для статистики
// ============================================================================

export interface OrderStats {
  totalOrders: number
  totalRevenue: number
  averageOrderValue: number
  ordersByType: Record<string, number>
  ordersByStatus: Record<string, number>
}

// ============================================================================
// Типы для конфигурации
// ============================================================================

export interface POSConfig {
  packagingCost: number
  woltPackagingCost: number
  boltPackagingCost: number
  language: Language
  defaultOrderType: OrderType
}

// ============================================================================
// Типы для состояния приложения
// ============================================================================

export interface POSState {
  isMounted: boolean
  isLoading: boolean
  isSubmitting: boolean
  language: Language
  orderType: string
  selectedOrderTypeId: string
  customerName: string
  phoneNumber: string
  employeeDiscount: EmployeeDiscount | null
  isPreorder: boolean
  preorderTime: string
}

// ============================================================================
// Типы для меню (DnD)
// ============================================================================

export interface MenuOrderMap {
  [categoryId: string]: string[]
}

// ============================================================================
// Типы для диалогов
// ============================================================================

export interface DialogState {
  showSuccessDialog: boolean
  showMobileCart: boolean
  showOrderHistory: boolean
  showPhoneDialog: boolean
  showPreorderDialog: boolean
  showMeatDialog: boolean
  showAddonsDialog: boolean
  showCommentDialog: boolean
  showDeleteOrderDialog: boolean
}

// ============================================================================
// Утилитарные типы
// ============================================================================

export type SetState<T> = React.Dispatch<React.SetStateAction<T>>

export type AsyncFunction<T = void> = (...args: any[]) => Promise<T>
