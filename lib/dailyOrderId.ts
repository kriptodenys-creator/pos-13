import { getDatabase } from './database'

type BetterSqliteLike = {
  prepare: (sql: string) => {
    all: (params?: unknown) => unknown
    get: (params?: unknown) => unknown
  }
  exec: (sql: string) => void
}

export function generateDailyOrderId(): string {
  const db = getDatabase()
  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD

  // Получаем максимальный номер за сегодня
  const row = db.prepare(`
    SELECT MAX(CAST(SUBSTR(id, 12) AS INTEGER)) as max_num
    FROM orders
    WHERE id LIKE ?
  `).get(`${today}-%`) as { max_num?: number }

  const nextNum = (row?.max_num || 0) + 1
  const orderId = `${today}-${String(nextNum).padStart(3, '0')}` // YYYY-MM-DD-NNN

  return orderId
}

export function ensureDailyOrderIdSchema(db: unknown) {
  const sqlite = db as BetterSqliteLike
  // Убедимся, что таблица orders имеет нужную структуру
  try {
    const tableInfo = sqlite.prepare('PRAGMA table_info(orders)').all() as Array<{ name?: unknown }>
    const hasIdColumn = tableInfo.some(col => col.name === 'id')
    
    if (!hasIdColumn) {
      sqlite.exec(`
        CREATE TABLE orders_new (
          id TEXT PRIMARY KEY,
          table_number INTEGER,
          order_type TEXT NOT NULL,
          status TEXT NOT NULL,
          total_amount REAL NOT NULL,
          employee_id TEXT NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `)
      
      // Копируем данные, если есть
      try {
        sqlite.exec(`
          INSERT INTO orders_new (id, table_number, order_type, status, total_amount, employee_id, created_at, updated_at)
          SELECT id, table_number, order_type, status, total_amount, employee_id, created_at, updated_at
          FROM orders
        `)
      } catch {
        console.warn('[DailyOrderId] No existing orders to migrate')
      }
      
      sqlite.exec('DROP TABLE orders')
      sqlite.exec('ALTER TABLE orders_new RENAME TO orders')
    }
  } catch (e: unknown) {
    console.warn('[DailyOrderId] Schema check failed:', e)
  }
}
