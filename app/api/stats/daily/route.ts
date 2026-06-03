import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/database'

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

function ensureOrderItemModifiersTable(db: any) {
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

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const date = getTodayDateStr()
    const requestedDate = (url.searchParams.get('date') || '').trim()
    if (requestedDate && requestedDate !== date) {
      return NextResponse.json(
        { success: false, error: 'Stats are available only for today' },
        { status: 403 }
      )
    }
    const status = 'completed_cancelled'

    const from = `${date} 00:00:00`
    const to = `${nextDay(date)} 00:00:00`

    const db = getDatabase()
    ensureOrderItemModifiersTable(db)

    const statusClause = ` AND o.status IN ('completed', 'cancelled') `

    const rows = db
      .prepare(
        `
        WITH mods AS (
          SELECT order_item_id, SUM(COALESCE(price, 0)) as mod_price
          FROM order_item_modifiers
          GROUP BY order_item_id
        )
        SELECT
          oi.menu_item_id as item_id,
          COALESCE(mi.name_uk, '') as name_uk,
          COALESCE(mi.name_lt, '') as name_lt,
          SUM(CASE WHEN o.status = 'completed' THEN COALESCE(oi.quantity, 0) ELSE 0 END) as completed_quantity,
          SUM(CASE WHEN o.status = 'completed' THEN (COALESCE(oi.price, 0) + COALESCE(mods.mod_price, 0)) * COALESCE(oi.quantity, 0) ELSE 0 END) as completed_amount,
          SUM(CASE WHEN o.status = 'cancelled' THEN COALESCE(oi.quantity, 0) ELSE 0 END) as cancelled_quantity,
          SUM(CASE WHEN o.status = 'cancelled' THEN (COALESCE(oi.price, 0) + COALESCE(mods.mod_price, 0)) * COALESCE(oi.quantity, 0) ELSE 0 END) as cancelled_amount
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
        LEFT JOIN mods ON mods.order_item_id = oi.id
        LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
        WHERE o.created_at >= ? AND o.created_at < ?
        ${statusClause}
        GROUP BY oi.menu_item_id, mi.name_uk, mi.name_lt
        ORDER BY (completed_quantity + cancelled_quantity) DESC, (completed_amount + cancelled_amount) DESC
        `
      )
      .all(from, to) as any[]

    const items = rows.map((r) => ({
      item_id: String(r.item_id ?? ''),
      name_uk: String(r.name_uk ?? ''),
      name_lt: String(r.name_lt ?? ''),
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

    return NextResponse.json({ success: true, date, from, to, status, items, totals })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
