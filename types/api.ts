// API Response Types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// Menu API Types
export interface MenuItemResponse {
  id: string | number
  name?: string
  name_lt?: string
  name_uk?: string
  price: number
  category?: string
  category_id?: string
  image?: string
  available?: boolean
  description?: string
  modifiers?: ModifierResponse[]
}

export interface ModifierResponse {
  id: string | number
  name?: string
  name_lt?: string
  name_uk?: string
  groupName?: string
  group_name?: string
  groupId?: string
  group_id?: string
  options?: ModifierOptionResponse[]
}

export interface ModifierOptionResponse {
  id: string | number
  name?: string
  name_lt?: string
  name_uk?: string
  price: number
}

export interface CategoryResponse {
  id: string | number
  name_lt: string
  name_uk: string
}

export interface MenuApiResponse {
  menu: MenuItemResponse[]
  categories: CategoryResponse[]
}

// Orders API Types
export interface OrderItemResponse {
  id?: string
  name: string
  price: number
  quantity: number
  modifiers?: string[]
}

export interface OrderResponse {
  id: string | number
  items: OrderItemResponse[]
  total: number
  status: 'new' | 'preparing' | 'ready' | 'completed'
  timestamp: string
  orderType?: string
  order_type?: string
  ordertype?: string
  estimatedTime?: number
  estimated_time?: number
}

export interface OrdersApiResponse {
  orders: OrderResponse[]
}

// Inventory API Types
export interface InventoryItemResponse {
  id: string | number
  name_lt: string
  name_uk: string
  unit: string
  current_stock: number
  min_stock: number
  max_stock: number
  cost_per_unit: number
}

export interface InventoryMovementResponse {
  id: string | number
  inventory_item_id: string | number
  movement_type: 'in' | 'out'
  quantity: number
  cost_per_unit?: number
  total_cost?: number
  reason?: string
  created_at: string
  created_by?: string
  item_name_lt?: string
  item_name_uk?: string
}

// Reports API Types
export interface SalesDataResponse {
  date: string
  revenue: number
  orders: number
  avgOrderValue: number
}

export interface ProductAnalytics {
  name: string
  category: string
  quantity: number
  revenue: number
  percentage: number
}

export interface ProductAnalyticsResponse {
  name: string
  quantity: number
  revenue: number
}

export interface PaymentStats {
  method: string
  count: number
  revenue: number
  percentage: number
  color: string
}

export interface PaymentMethodStats {
  method: string
  count: number
  revenue: number
  percentage: number
  color: string
}

export interface PaymentStatsResponse {
  method: string
  count: number
  revenue: number
  color?: string
}
