import { addSystemLog } from '@/lib/systemLogs'
import type { Database as SqliteDatabase } from 'better-sqlite3'
import { printToUSB, type PrintOrderData } from '@/lib/printer'

let schedulerStarted = false

function getTodayDateStr() {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function nextDay(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map((x) => Number(x))
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + 1)
  const yyyy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function ensureOrderItemModifiersTable(db: SqliteDatabase) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS order_item_modifiers (
      id TEXT PRIMARY KEY,
      order_item_id TEXT NOT NULL,
      modifier_id TEXT NOT NULL,
      modifier_option_id TEXT NOT NULL,
      price REAL NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)
}

function ensureAdminSettingsTable(db: SqliteDatabase) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)
}

type DailyItem = {
  name: string
  completed_quantity: number
  completed_amount: number
  cancelled_quantity: number
  cancelled_amount: number
}

type DailyStats = {
  date: string
  items: DailyItem[]
  totals: { completed_quantity: number; completed_amount: number; cancelled_quantity: number; cancelled_amount: number }
}

function getDailyStatsForToday(db: SqliteDatabase): DailyStats {
  const date = getTodayDateStr()
  const from = `${date} 00:00:00`
  const to = `${nextDay(date)} 00:00:00`

  ensureOrderItemModifiersTable(db)

  const rows = db
    .prepare(
      `
      WITH mods AS (
        SELECT order_item_id, SUM(COALESCE(price, 0)) as mod_price
        FROM order_item_modifiers
        GROUP BY order_item_id
      )
      SELECT
        COALESCE(mi.name_lt, mi.name_uk, '') as name,
        SUM(CASE WHEN o.status = 'completed' THEN COALESCE(oi.quantity, 0) ELSE 0 END) as completed_quantity,
        SUM(CASE WHEN o.status = 'completed' THEN (COALESCE(oi.price, 0) + COALESCE(mods.mod_price, 0)) * COALESCE(oi.quantity, 0) ELSE 0 END) as completed_amount,
        SUM(CASE WHEN o.status = 'cancelled' THEN COALESCE(oi.quantity, 0) ELSE 0 END) as cancelled_quantity,
        SUM(CASE WHEN o.status = 'cancelled' THEN (COALESCE(oi.price, 0) + COALESCE(mods.mod_price, 0)) * COALESCE(oi.quantity, 0) ELSE 0 END) as cancelled_amount
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN mods ON mods.order_item_id = oi.id
      LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
      WHERE o.created_at >= ? AND o.created_at < ?
        AND o.status IN ('completed', 'cancelled')
      GROUP BY mi.name_lt, mi.name_uk
      ORDER BY (completed_quantity + cancelled_quantity) DESC, (completed_amount + cancelled_amount) DESC
      `
    )
    .all(from, to) as Array<Record<string, unknown>>

  const items: DailyItem[] = rows.map((r) => ({
    name: String(r.name ?? ''),
    completed_quantity: Number(r.completed_quantity ?? 0),
    completed_amount: Number(r.completed_amount ?? 0),
    cancelled_quantity: Number(r.cancelled_quantity ?? 0),
    cancelled_amount: Number(r.cancelled_amount ?? 0),
  }))

  const totals = items.reduce(
    (acc, it) => {
      acc.completed_quantity += it.completed_quantity
      acc.completed_amount += it.completed_amount
      acc.cancelled_quantity += it.cancelled_quantity
      acc.cancelled_amount += it.cancelled_amount
      return acc
    },
    { completed_quantity: 0, completed_amount: 0, cancelled_quantity: 0, cancelled_amount: 0 }
  )

  return { date, items, totals }
}

function getLastPrintedDate(db: SqliteDatabase): string | null {
  ensureAdminSettingsTable(db)
  try {
    const row = db.prepare(`SELECT value FROM admin_settings WHERE key = ?`).get('daily_stats_last_print_date') as
      | { value?: unknown }
      | undefined
    const v = row?.value != null ? String(row.value) : ''
    return v.trim() ? v.trim() : null
  } catch {
    return null
  }
}

function setLastPrintedDate(db: SqliteDatabase, date: string) {
  ensureAdminSettingsTable(db)
  db.prepare(`INSERT OR REPLACE INTO admin_settings(key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)`).run(
    'daily_stats_last_print_date',
    String(date)
  )
}

function formatMoney(n: number) {
  return n.toFixed(2)
}

async function printDailyStats(db: SqliteDatabase) {
  const stats = getDailyStatsForToday(db)

  const headerLines: string[] = []
  headerLines.push(`Sales stats ${stats.date}`)
  headerLines.push(`Total qty: ${stats.totals.completed_quantity}`)
  headerLines.push(`Total EUR: ${formatMoney(stats.totals.completed_amount)}`)
  if (stats.totals.cancelled_quantity > 0 || stats.totals.cancelled_amount > 0) {
    headerLines.push(`Cancelled qty: ${stats.totals.cancelled_quantity}`)
    headerLines.push(`Cancelled EUR: ${formatMoney(stats.totals.cancelled_amount)}`)
  }

  const order: PrintOrderData = {
    id: `STATS ${stats.date}`,
    orderType: headerLines.join(' | '),
    timestamp: new Date(),
    items: stats.items.map((it) => ({
      name: `${it.name}  ${formatMoney(it.completed_amount)} EUR`,
      quantity: it.completed_quantity,
      modifiers: it.cancelled_quantity > 0 ? [`cancelled x${it.cancelled_quantity} (${formatMoney(it.cancelled_amount)} EUR)`] : [],
    })),
  }

  const res = await printToUSB(order)
  if (!res.success) {
    addSystemLog({ level: 'error', message: 'Daily stats print failed', context: res.errors })
  }
}

export async function printDailyStatsNow(db: SqliteDatabase, markAsPrinted: boolean = false) {
  const today = getTodayDateStr()
  await printDailyStats(db)
  if (markAsPrinted) {
    setLastPrintedDate(db, today)
  }
}

export function startDailyStatsPrinter(db: SqliteDatabase) {
  if (schedulerStarted) return
  schedulerStarted = true

  if (process.env.DAILY_STATS_PRINT_ENABLED !== '1') {
    addSystemLog({ level: 'info', message: 'Daily stats printer is disabled (set DAILY_STATS_PRINT_ENABLED=1)' })
    return
  }

  const tick = async () => {
    try {
      const now = new Date()
      const today = getTodayDateStr()

      // печатаем один раз в день после 20:00 (если сервер был выключен ровно в 20:00 — напечатает при первом запуске после)
      const shouldPrintNow = now.getHours() >= 20
      if (!shouldPrintNow) return

      const lastPrinted = getLastPrintedDate(db)
      if (lastPrinted === today) return

      await printDailyStats(db)
      setLastPrintedDate(db, today)
      addSystemLog({ level: 'info', message: `Daily stats printed for ${today}` })
    } catch (e) {
      addSystemLog({
        level: 'error',
        message: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
        context: { where: 'startDailyStatsPrinter.tick' },
      })
    }
  }

  // первый тик почти сразу
  setTimeout(() => {
    tick().catch(() => {})
  }, 5000)

  // затем раз в минуту
  setInterval(() => {
    tick().catch(() => {})
  }, 60_000)
}
