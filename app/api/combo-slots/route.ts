import { getDatabase } from '@/lib/database'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const db = getDatabase()

    if (body.action === 'create') {
      const id = `slot_${Date.now()}_${Math.floor(Math.random() * 10000)}`
      
      db.prepare(`
        INSERT INTO combo_slots (id, combo_set_id, title_lt, title_uk, slot_type, required, min_selection, max_selection, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        body.combo_set_id,
        body.title_lt,
        body.title_uk,
        body.slot_type,
        body.required ? 1 : 0,
        body.min_selection,
        body.max_selection,
        0
      )

      const slot = db.prepare('SELECT * FROM combo_slots WHERE id = ?').get(id)
      return NextResponse.json({ success: true, slot })
    }

    if (body.action === 'delete') {
      db.prepare('DELETE FROM combo_slots WHERE id = ?').run(body.id)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('[Combo Slots API] Error:', error)
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 })
  }
}
