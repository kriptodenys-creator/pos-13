import { getDatabase } from '@/lib/database'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const db = getDatabase()

    if (body.action === 'create') {
      const id = `slot_item_${Date.now()}_${Math.floor(Math.random() * 10000)}`
      
      db.prepare(`
        INSERT INTO combo_slot_items (id, combo_slot_id, menu_item_id, price_delta, is_fryer, cooking_time, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        body.combo_slot_id,
        body.menu_item_id,
        body.price_delta || 0,
        body.is_fryer ? 1 : 0,
        body.cooking_time || 180,
        0
      )

      return NextResponse.json({ success: true, id })
    }

    if (body.action === 'update') {
      db.prepare(`
        UPDATE combo_slot_items
        SET is_fryer = ?, cooking_time = ?
        WHERE id = ?
      `).run(
        body.is_fryer ? 1 : 0,
        body.cooking_time || 180,
        body.id
      )
      return NextResponse.json({ success: true })
    }

    if (body.action === 'delete') {
      db.prepare('DELETE FROM combo_slot_items WHERE id = ?').run(body.id)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('[Combo Slot Items API] Error:', error)
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 })
  }
}
