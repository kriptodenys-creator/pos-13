import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { runMigrations } from './migrations'
import { startDailyStatsPrinter } from './dailyStatsPrinter'

// Ensure data directory exists
const dataDir = path.join(process.cwd(), 'data')
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

const dbPath = path.join(dataDir, 'pos_system.db')
const db = new Database(dbPath)

// Enable performance optimizations
db.pragma('journal_mode = WAL') // Write-Ahead Logging for better performance
db.pragma('synchronous = NORMAL') // Balance between speed and reliability
db.pragma('cache_size = 10000') // Increased cache size
db.pragma('temp_store = MEMORY') // Temporary tables in memory
db.pragma('mmap_size = 268435456') // 256MB memory mapping
db.pragma('foreign_keys = ON')

// Run migrations once at startup
runMigrations(db)

startDailyStatsPrinter(db)

// Function to get database instance
export function getDatabase() {
  return db
}

// Interfaces
export interface InventoryItem {
  id: string
  name_lt: string
  name_uk: string
  unit: string
  min_stock: number
  max_stock: number
  current_stock: number
  cost_per_unit: number
  supplier: string | null
  category_id: string | null
  created_at: string
  updated_at: string
}

export interface InventoryCategory {
  id: string
  name_uk: string
  name_lt: string
  color: string
  order_index: number
  created_at: string
}

export interface InventoryMovement {
  id: string
  inventory_item_id: string
  movement_type: 'in' | 'out'
  quantity: number
  reason: string | null
  cost_per_unit: number | null
  total_cost: number | null
  created_by: string | null
  created_at: string
}

export interface MenuItem {
  id: string
  name_uk: string
  name_lt: string
  price: number
  category_id: string
  image_url: string | null
  description_uk: string | null
  description_lt: string | null
  is_available: boolean
  is_fryer?: number
  cooking_time?: number
  created_at: string
  updated_at: string
}

export interface Recipe {
  id: string
  menu_item_id: string
  created_at: string
  updated_at: string
}

export interface RecipeIngredient {
  id: string
  recipe_id: string
  inventory_item_id: string
  quantity: number
}

export interface ModifierOptionIngredient {
  id: string
  modifier_option_id: string
  inventory_item_id: string
  quantity: number
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  name_uk: string
  name_lt: string
  color: string
  order_index: number
  created_at: string
}

export interface Modifier {
  id: string
  name_uk: string
  name_lt: string
  type: 'single' | 'multiple'
  is_required: boolean
  min_selection: number
  max_selection: number
  created_at: string
}

export interface ModifierOption {
  id: string
  modifier_id: string
  name_uk: string
  name_lt: string
  price: number
  is_default: boolean
  created_at: string
}

export interface Order {
  id: string
  table_number: number | null
  order_type: 'dine_in' | 'takeaway' | 'delivery'
  status: 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled'
  total_amount: number
  employee_id: string
  created_at: string
  updated_at: string
}

export interface OrderItem {
  id: string
  order_id: string
  menu_item_id: string
  quantity: number
  price: number
  note: string | null
  status: 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled'
  created_at: string
  updated_at: string
}

export interface OrderItemModifier {
  id: string
  order_item_id: string
  modifier_id: string
  modifier_option_id: string
  price: number
  created_at: string
}

export interface User {
  id: string
  username: string
  password_hash: string
  role: 'admin' | 'manager' | 'cashier' | 'kitchen'
  first_name: string
  last_name: string
  is_active: boolean
  created_at: string
}

export interface Report {
  id: string
  type: string
  data: string // JSON string
  generated_at: string
  generated_by: string
}

// Initialize database with tables
export function initializeDatabase() {
  // Create tables if they don't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name_uk TEXT NOT NULL,
      name_lt TEXT NOT NULL,
      color TEXT DEFAULT '#6b7280',
      order_index INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS menu_items (
      id TEXT PRIMARY KEY,
      name_uk TEXT NOT NULL,
      name_lt TEXT NOT NULL,
      price REAL NOT NULL,
      category_id TEXT,
      image_url TEXT,
      description_uk TEXT,
      description_lt TEXT,
      is_available BOOLEAN DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS modifiers (
      id TEXT PRIMARY KEY,
      name_uk TEXT NOT NULL,
      name_lt TEXT NOT NULL,
      type TEXT NOT NULL, -- 'single' or 'multiple' or custom type
      is_required BOOLEAN DEFAULT 0,
      min_selection INTEGER DEFAULT 0,
      max_selection INTEGER DEFAULT 1,
      is_available BOOLEAN DEFAULT 1,
      is_deleted BOOLEAN DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      category TEXT, -- 'sauce', 'additive', 'ingredient', 'spice_level', 'portion', etc.
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS modifier_options (
      id TEXT PRIMARY KEY,
      modifier_id TEXT NOT NULL,
      name_uk TEXT NOT NULL,
      name_lt TEXT NOT NULL,
      price REAL DEFAULT 0,
      is_default BOOLEAN DEFAULT 0,
      is_available BOOLEAN DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (modifier_id) REFERENCES modifiers (id) ON DELETE CASCADE
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS menu_item_modifiers (
      menu_item_id TEXT,
      modifier_id TEXT,
      PRIMARY KEY (menu_item_id, modifier_id),
      FOREIGN KEY (menu_item_id) REFERENCES menu_items (id) ON DELETE CASCADE,
      FOREIGN KEY (modifier_id) REFERENCES modifiers (id) ON DELETE CASCADE
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      table_number INTEGER,
      order_type TEXT NOT NULL, -- 'dine_in', 'takeaway', 'delivery'
      status TEXT NOT NULL, -- 'pending', 'preparing', 'ready', 'completed', 'cancelled'
      total_amount REAL NOT NULL,
      employee_id TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      menu_item_id TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      price REAL NOT NULL,
      note TEXT,
      status TEXT NOT NULL, -- 'pending', 'preparing', 'ready', 'completed', 'cancelled'
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
      FOREIGN KEY (menu_item_id) REFERENCES menu_items (id)
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS order_item_modifiers (
      id TEXT PRIMARY KEY,
      order_item_id TEXT NOT NULL,
      modifier_id TEXT NOT NULL,
      modifier_option_id TEXT NOT NULL,
      price REAL NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_item_id) REFERENCES order_items (id) ON DELETE CASCADE,
      FOREIGN KEY (modifier_id) REFERENCES modifiers (id),
      FOREIGN KEY (modifier_option_id) REFERENCES modifier_options (id)
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS inventory_items (
      id TEXT PRIMARY KEY,
      name_lt TEXT NOT NULL,
      name_uk TEXT NOT NULL,
      unit TEXT NOT NULL,
      min_stock REAL DEFAULT 0,
      max_stock REAL DEFAULT 100,
      current_stock REAL DEFAULT 0,
      cost_per_unit REAL DEFAULT 0,
      supplier TEXT,
      category_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS inventory_movements (
      id TEXT PRIMARY KEY,
      inventory_item_id TEXT NOT NULL,
      movement_type TEXT NOT NULL, -- 'in' or 'out'
      quantity REAL NOT NULL,
      reason TEXT,
      cost_per_unit REAL,
      total_cost REAL,
      created_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (inventory_item_id) REFERENCES inventory_items (id) ON DELETE CASCADE
    )
  `)

  // Note: The inventory_categories table already exists with a different structure
  // We'll work with the existing table structure

  db.exec(`
    CREATE TABLE IF NOT EXISTS recipes (
      id TEXT PRIMARY KEY,
      menu_item_id TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (menu_item_id) REFERENCES menu_items (id) ON DELETE CASCADE
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS recipe_ingredients (
      id TEXT PRIMARY KEY,
      recipe_id TEXT NOT NULL,
      inventory_item_id TEXT NOT NULL,
      quantity REAL NOT NULL,
      FOREIGN KEY (recipe_id) REFERENCES recipes (id) ON DELETE CASCADE,
      FOREIGN KEY (inventory_item_id) REFERENCES inventory_items (id)
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS modifier_option_ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      modifier_option_id TEXT NOT NULL,
      inventory_item_id TEXT NOT NULL,
      quantity REAL NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (modifier_option_id) REFERENCES modifier_options (id) ON DELETE CASCADE,
      FOREIGN KEY (inventory_item_id) REFERENCES inventory_items (id)
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL, -- 'admin', 'manager', 'cashier', 'kitchen'
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      is_active BOOLEAN DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      data TEXT NOT NULL, -- JSON string
      generated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      generated_by TEXT NOT NULL
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS happy_hours (
      id TEXT PRIMARY KEY,
      item_id TEXT,
      category_id TEXT,
      discount_percent REAL NOT NULL,
      start_time TEXT,
      end_time TEXT,
      day_of_week INTEGER,
      active BOOLEAN DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Create indexes for better performance
  db.exec(`CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_order_items_menu_item ON order_items(menu_item_id)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_order_item_modifiers_order_item ON order_item_modifiers(order_item_id)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON inventory_items(category_id)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_inventory_movements_item ON inventory_movements(inventory_item_id)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_inventory_movements_date ON inventory_movements(created_at)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(created_at)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_orders_status_created_at ON orders(status, created_at DESC)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_recipes_menu_item ON recipes(menu_item_id)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_modifier_option_ingredients_option ON modifier_option_ingredients(modifier_option_id)`)

  console.log('Database initialized successfully')
}