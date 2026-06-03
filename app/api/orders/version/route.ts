export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { getDatabase } from '@/lib/database'

export async function GET() {
  try {
    const db = getDatabase()

    // Prefer updated_at if it exists
    let hasUpdatedAt = false
    try {
      const tableInfo = db.prepare('PRAGMA table_info(orders)').all() as any[]
      hasUpdatedAt = tableInfo.some((c) => c.name === 'updated_at')
    } catch {
      hasUpdatedAt = false
    }

    const row = hasUpdatedAt
      ? (db.prepare(`SELECT MAX(updated_at) as v FROM orders`).get() as any)
      : (db.prepare(`SELECT MAX(created_at) as v FROM orders`).get() as any)

    const version = row?.v ? String(row.v) : ''

    return Response.json({ success: true, version })
  } catch (e: any) {
    console.error('[API /orders/version] error:', e)
    return Response.json(
      { success: false, error: e?.message || String(e), stack: e?.stack || undefined },
      { status: 500 }
    )
  }
}
