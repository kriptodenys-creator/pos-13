import Database from "better-sqlite3"
import path from "path"
import fs from "fs"

let db: Database.Database | null = null
let dbPool: Database.Database[] = []
const MAX_POOL_SIZE = 5

// Пул соединений для улучшенной производительности
export function getDatabaseFromPool(): Database.Database {
  if (dbPool.length > 0) {
    return dbPool.pop()!
  }
  return createNewConnection()
}

export function returnDatabaseToPool(database: Database.Database) {
  if (dbPool.length < MAX_POOL_SIZE) {
    dbPool.push(database)
  } else {
    database.close()
  }
}

function createNewConnection(): Database.Database {
  const dbDir = path.join(process.cwd(), "data")
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }

  const dbPath = path.join(dbDir, "pos_system.db")
  const connection = new Database(dbPath)
  
  // Оптимизация производительности SQLite
  connection.pragma("journal_mode = WAL") // Write-Ahead Logging для лучшей производительности
  connection.pragma("synchronous = NORMAL") // Баланс между скоростью и надежностью
  connection.pragma("cache_size = 10000") // Увеличенный кэш
  connection.pragma("temp_store = MEMORY") // Временные таблицы в памяти
  connection.pragma("mmap_size = 268435456") // 256MB memory mapping
  connection.pragma("foreign_keys = ON")
  
  return connection
}

export function getDatabase(): Database.Database {
  if (!db) {
    db = createNewConnection()
    console.log("[v0] Оптимизированная база данных SQLite подключена")
  }
  return db
}

// Кэш для подготовленных запросов
const preparedStatements = new Map<string, Database.Statement>()

export function getPreparedStatement(sql: string): Database.Statement {
  if (!preparedStatements.has(sql)) {
    const db = getDatabase()
    preparedStatements.set(sql, db.prepare(sql))
  }
  return preparedStatements.get(sql)!
}

// Оптимизированные запросы с индексами
export function createOptimizedIndexes() {
  const db = getDatabase()
  
  try {
    // Индексы для улучшения производительности запросов
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category);
      CREATE INDEX IF NOT EXISTS idx_menu_items_available ON menu_items(available);
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
      CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
      CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
      CREATE INDEX IF NOT EXISTS idx_order_items_menu_item_id ON order_items(menu_item_id);
      CREATE INDEX IF NOT EXISTS idx_menu_item_modifiers_menu_item ON menu_item_modifiers(menu_item_id);
      CREATE INDEX IF NOT EXISTS idx_menu_item_modifiers_modifier ON menu_item_modifiers(modifier_id);
      CREATE INDEX IF NOT EXISTS idx_modifier_options_modifier_id ON modifier_options(modifier_id);
      CREATE INDEX IF NOT EXISTS idx_inventory_items_current_stock ON inventory_items(current_stock);
      CREATE INDEX IF NOT EXISTS idx_inventory_movements_item_id ON inventory_movements(inventory_item_id);
    `)
    console.log("[v0] Созданы оптимизированные индексы")
  } catch (error) {
    console.warn("[v0] Ошибка создания индексов:", error)
  }
}

// Оптимизированная функция инициализации
export async function initializeOptimizedDatabase() {
  const database = getDatabase()

  try {
    const sqlScriptPath = path.join(process.cwd(), "scripts", "01_create_database.sql")
    
    if (fs.existsSync(sqlScriptPath)) {
      const sqlScript = fs.readFileSync(sqlScriptPath, "utf8")
      database.exec(sqlScript)
    }

    // Создаем индексы для производительности
    createOptimizedIndexes()

    // Анализируем таблицы для оптимизации планировщика запросов
    database.exec("ANALYZE")

    console.log("[v0] Оптимизированная база данных инициализирована")
  } catch (error) {
    console.error("[v0] Ошибка инициализации оптимизированной БД:", error)
    throw error
  }
}

// Оптимизированные запросы с батчингом
export class OptimizedQueries {
  private static instance: OptimizedQueries
  private db: Database.Database

  private constructor() {
    this.db = getDatabase()
  }

  public static getInstance(): OptimizedQueries {
    if (!OptimizedQueries.instance) {
      OptimizedQueries.instance = new OptimizedQueries()
    }
    return OptimizedQueries.instance
  }

  // Получение меню с модификаторами одним запросом
  public getMenuWithModifiers(includeUnavailable = false): Array<Record<string, unknown>> {
    try {
      const whereClause = includeUnavailable ? "" : "WHERE COALESCE(mi.available, 1) = 1"
      
      const query = `
        SELECT 
          mi.id,
          mi.name_lt,
          mi.name_uk,
          mi.price,
          mi.category,
          mi.image,
          mi.available
        FROM menu_items mi
        ${whereClause}
        ORDER BY mi.category, mi.name_uk
      `
      
      const stmt = this.db.prepare(query)
      const results = stmt.all()
      
      return results as Array<Record<string, unknown>>
    } catch (error) {
      console.error('[OptimizedQueries] Error getting menu:', error)
      return []
    }
  }

  // Пакетное создание заказов
  public createOrderBatch(orders: Array<Record<string, unknown>>): number[] {
    try {
      const insertOrder = this.db.prepare(`
        INSERT INTO orders (total, order_type, status, table_number, customer_name, estimated_time, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      
      const insertOrderItem = this.db.prepare(`
        INSERT INTO order_items (order_id, menu_item_id, quantity, price)
        VALUES (?, ?, ?, ?)
      `)

      const transaction = this.db.transaction((orders: Array<Record<string, unknown>>) => {
        const orderIds: number[] = []
        
        for (const order of orders) {
          const itemsRaw = order.items
          const items = Array.isArray(itemsRaw) ? (itemsRaw as unknown[]) : []

          const result = insertOrder.run(
            Number(order.total ?? 0),
            String(order.orderType ?? ''),
            String(order.status ?? 'new'),
            String(order.tableNumber ?? ''),
            String(order.customerName ?? ''),
            Number(order.estimatedTime ?? 15),
            new Date().toISOString()
          )
          
          const orderId = result.lastInsertRowid as number
          orderIds.push(orderId)
          
          for (const item of items) {
            const it = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
            insertOrderItem.run(orderId, String(it.id ?? ''), Number(it.quantity ?? 0), Number(it.price ?? 0))
          }
        }
        
        return orderIds
      })
      
      return transaction(orders)
    } catch (error) {
      console.error('[OptimizedQueries] Error creating order batch:', error)
      return []
    }
  }

  // Получение статистики производительности
  public getPerformanceStats(): Record<string, unknown> {
    try {
      const stats = {
        totalMenuItems: this.db.prepare("SELECT COUNT(*) as count FROM menu_items").get(),
        totalOrders: this.db.prepare("SELECT COUNT(*) as count FROM orders").get(),
        totalModifiers: this.db.prepare("SELECT COUNT(*) as count FROM modifiers").get(),
        dbSize: this.db.prepare("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()").get(),
        cacheSize: this.db.prepare("PRAGMA cache_size").get(),
        journalMode: this.db.prepare("PRAGMA journal_mode").get()
      }
      
      return stats as Record<string, unknown>
    } catch (error) {
      console.error('[OptimizedQueries] Error getting performance stats:', error)
      return {}
    }
  }
}

export function closeDatabase() {
  // Закрываем все соединения в пуле
  dbPool.forEach(connection => connection.close())
  dbPool = []
  
  if (db) {
    db.close()
    db = null
    console.log("[v0] Оптимизированная база данных закрыта")
  }
  
  // Очищаем кэш подготовленных запросов
  preparedStatements.clear()
}

// Экспортируем типы (те же что и в оригинальном файле)
export interface MenuItem {
  id: string
  name_lt: string
  name_uk: string
  price: number
  category: string
  image?: string
  created_at: string
  updated_at: string
}

export interface Modifier {
  id: string
  name_lt: string
  name_uk: string
  price: number
  type: "size" | "addon" | "sauce"
  required: boolean
  created_at: string
}

export interface Order {
  id: number
  total: number
  order_type: string
  status: "new" | "preparing" | "ready" | "completed" | "cancelled"
  table_number?: string
  customer_name?: string
  estimated_time: number
  created_at: string
  updated_at: string
}

export interface OrderItem {
  id: number
  order_id: number
  menu_item_id: string
  quantity: number
  price: number
  created_at: string
}

export interface OrderItemModifier {
  id: number
  order_item_id: number
  modifier_id: string
  price: number
  created_at: string
}

export interface InventoryItem {
  id: string
  name_lt: string
  name_uk: string
  unit: string
  current_stock: number
  min_stock: number
  max_stock: number
  cost_per_unit: number
  supplier?: string
  created_at: string
  updated_at: string
}

export interface Recipe {
  id: number
  menu_item_id: string
  inventory_item_id: string
  quantity_needed: number
  created_at: string
}

export interface InventoryMovement {
  id: number
  inventory_item_id: string
  movement_type: "in" | "out" | "adjustment"
  quantity: number
  reason?: string
  reference_id?: string
  cost_per_unit?: number
  total_cost?: number
  created_at: string
  created_by?: string
}
