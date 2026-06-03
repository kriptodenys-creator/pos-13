import { getDatabase } from '@/lib/database'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const db = getDatabase()
    const slots = db.prepare(`
      SELECT * FROM combo_slots
      WHERE combo_set_id = ?
      ORDER BY sort_order ASC
    `).all(params.id)

    // Load items for each slot
    const slotsWithItems = await Promise.all(
      slots.map(async (slot: any) => {
        const items = db.prepare(`
          SELECT 
            csi.*,
            mi.name_uk,
            mi.name_lt
          FROM combo_slot_items csi
          LEFT JOIN menu_items mi ON csi.menu_item_id = mi.id
          WHERE csi.combo_slot_id = ?
          ORDER BY csi.sort_order ASC
        `).all(slot.id)

        return {
          ...slot,
          items: items.map((item: any) => ({
            ...item,
            menu_item: {
              name_uk: item.name_uk,
              name_lt: item.name_lt
            }
          }))
        }
      })
    )

    return NextResponse.json({ slots: slotsWithItems })
  } catch (error) {
    console.error('[Combo Slots API] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch slots' }, { status: 500 })
  }
}
