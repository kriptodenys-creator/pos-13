import { getDatabase } from '@/lib/database'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const db = getDatabase()
    const comboSets = db.prepare(`
      SELECT 
        cs.*,
        mi.name_uk,
        mi.name_lt,
        mi.price
      FROM combo_sets cs
      LEFT JOIN menu_items mi ON cs.menu_item_id = mi.id
      ORDER BY cs.created_at DESC
    `).all()

    return NextResponse.json({ comboSets })
  } catch (error) {
    console.error('[Combo Sets API] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch combo sets' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const db = getDatabase()

    if (body.action === 'create') {
      const id = `combo_${Date.now()}_${Math.floor(Math.random() * 10000)}`
      
      db.prepare(`
        INSERT INTO combo_sets (id, menu_item_id, is_active, price_override)
        VALUES (?, ?, ?, ?)
      `).run(
        id,
        body.menu_item_id,
        body.is_active ? 1 : 0,
        body.price_override || null
      )

      return NextResponse.json({ success: true, id })
    }

    if (body.action === 'delete') {
      db.prepare('DELETE FROM combo_sets WHERE id = ?').run(body.id)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('[Combo Sets API] Error:', error)
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 })
  }
}
