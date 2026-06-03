import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/database'

interface CreateComboSlot {
  title?: { lt?: string; uk?: string }
  type?: 'menu_item_choice' | 'modifier'
  required?: boolean
  minSelection?: number
  maxSelection?: number
  items?: Array<{
    menuItemId: string
    priceDelta?: number
    is_fryer?: boolean
    cooking_time?: number
    modifiers?: Array<{
      modifierId: string
      required?: boolean
      minSelection?: number
      maxSelection?: number
    }>
  }>
  modifiers?: Array<{
    modifierId: string
    required?: boolean
    minSelection?: number
    maxSelection?: number
  }>
}

interface UpsertComboRequest {
  menuItemId: string
  priceOverride?: number | null
  slots?: CreateComboSlot[]
}

async function loadComboDetails(comboId: string) {
  const db = getDatabase()

  const comboSet = db
    .prepare(
      `
      SELECT 
        cs.id as combo_set_id,
        cs.menu_item_id,
        cs.is_active,
        cs.price_override,
        mi.name_uk as menu_item_name_uk,
        mi.name_lt as menu_item_name_lt,
        mi.price as menu_item_price
      FROM combo_sets cs
      JOIN menu_items mi ON cs.menu_item_id = mi.id
      WHERE cs.id = ?
      `
    )
    .get(comboId) as any

  if (!comboSet) return null

  const slots = db
    .prepare(
      `
      SELECT id, combo_set_id, title_lt, title_uk, slot_type, required, min_selection, max_selection, sort_order
      FROM combo_slots
      WHERE combo_set_id = ?
      ORDER BY sort_order
      `
    )
    .all(comboId) as any[]

  const slotItems = db
    .prepare(
      `
      SELECT 
        csi.id,
        csi.combo_slot_id,
        csi.menu_item_id,
        csi.price_delta,
        csi.is_available,
        csi.sort_order,
        csi.is_fryer,
        csi.cooking_time,
        mi.name_uk as item_name_uk,
        mi.name_lt as item_name_lt,
        mi.price as item_price
      FROM combo_slot_items csi
      JOIN menu_items mi ON csi.menu_item_id = mi.id
      WHERE csi.combo_slot_id IN (SELECT id FROM combo_slots WHERE combo_set_id = ?)
      ORDER BY csi.sort_order
      `
    )
    .all(comboId) as any[]

  const slotModifiers = db
    .prepare(
      `
      SELECT 
        csm.id,
        csm.combo_slot_id,
        csm.modifier_id,
        csm.required,
        csm.min_selection,
        csm.max_selection,
        csm.sort_order,
        m.name_uk as modifier_name_uk,
        m.name_lt as modifier_name_lt,
        m.type as modifier_type
      FROM combo_slot_modifiers csm
      JOIN modifiers m ON csm.modifier_id = m.id
      WHERE csm.combo_slot_id IN (SELECT id FROM combo_slots WHERE combo_set_id = ?)
      ORDER BY csm.sort_order
      `
    )
    .all(comboId) as any[]

  const slotItemModifiers = db
    .prepare(
      `
      SELECT 
        csim.id as slot_item_modifier_id,
        csim.combo_slot_item_id,
        csim.modifier_id,
        csim.required,
        csim.min_selection,
        csim.max_selection,
        csim.sort_order,
        m.name_uk as modifier_name_uk,
        m.name_lt as modifier_name_lt,
        m.type as modifier_type
      FROM combo_slot_item_modifiers csim
      JOIN modifiers m ON csim.modifier_id = m.id
      WHERE csim.combo_slot_item_id IN (
        SELECT csi.id
        FROM combo_slot_items csi
        WHERE csi.combo_slot_id IN (SELECT id FROM combo_slots WHERE combo_set_id = ?)
      )
      ORDER BY csim.sort_order
      `
    )
    .all(comboId) as any[]

  const optionRows = db
    .prepare(
      `
      SELECT id, modifier_id, name_uk, name_lt, price
      FROM modifier_options
      ORDER BY id
      `
    )
    .all() as any[]

  const optionsByModifier = new Map<string, any[]>()
  for (const opt of optionRows) {
    if (!optionsByModifier.has(opt.modifier_id)) optionsByModifier.set(opt.modifier_id, [])
    optionsByModifier.get(opt.modifier_id)!.push(opt)
  }

  const itemsBySlot = new Map<string, any[]>()
  for (const it of slotItems) {
    if (!itemsBySlot.has(it.combo_slot_id)) itemsBySlot.set(it.combo_slot_id, [])
    itemsBySlot.get(it.combo_slot_id)!.push(it)
  }

  const modifiersBySlot = new Map<string, any[]>()
  for (const sm of slotModifiers) {
    if (!modifiersBySlot.has(sm.combo_slot_id)) modifiersBySlot.set(sm.combo_slot_id, [])
    modifiersBySlot.get(sm.combo_slot_id)!.push(sm)
  }

  const itemModifiersBySlotItem = new Map<string, any[]>()
  for (const row of slotItemModifiers) {
    if (!itemModifiersBySlotItem.has(row.combo_slot_item_id)) itemModifiersBySlotItem.set(row.combo_slot_item_id, [])
    itemModifiersBySlotItem.get(row.combo_slot_item_id)!.push(row)
  }

  const combo = {
    id: comboSet.combo_set_id,
    menuItemId: comboSet.menu_item_id,
    priceOverride: comboSet.price_override ?? null,
    name: { uk: comboSet.menu_item_name_uk, lt: comboSet.menu_item_name_lt },
    price: Number(comboSet.price_override ?? comboSet.menu_item_price),
    categoryName: comboSet.category_id
      ? { uk: comboSet.category_name_uk || '', lt: comboSet.category_name_lt || '' }
      : null,
    categoryColor: comboSet.category_color || null,
    slots: slots.map((s: any) => {
      const slot: any = {
        id: s.id,
        title: { lt: s.title_lt, uk: s.title_uk },
        type: s.slot_type,
        required: Boolean(s.required),
        minSelection: s.min_selection,
        maxSelection: s.max_selection,
      }

      if (s.slot_type === 'menu_item_choice') {
        slot.items = (itemsBySlot.get(s.id) || []).map((it: any) => ({
          id: it.id,
          menuItemId: it.menu_item_id,
          name: { uk: it.item_name_uk, lt: it.item_name_lt },
          price: Number(it.item_price) + Number(it.price_delta || 0),
          priceDelta: Number(it.price_delta || 0),
          is_fryer: Boolean(it.is_fryer),
          cooking_time: Number(it.cooking_time || 180),
          modifiers: (itemModifiersBySlotItem.get(it.id) || []).map((mrow: any) => ({
            id: mrow.slot_item_modifier_id,
            modifierId: mrow.modifier_id,
            name: { uk: mrow.modifier_name_uk, lt: mrow.modifier_name_lt },
            type: mrow.modifier_type,
            required: Boolean(mrow.required),
            minSelection: mrow.min_selection,
            maxSelection: mrow.max_selection,
            options: (optionsByModifier.get(mrow.modifier_id) || []).map((opt: any) => ({
              id: opt.id,
              name: { uk: opt.name_uk, lt: opt.name_lt },
              price: Number(opt.price) || 0,
              isDefault: Boolean(opt.is_default),
            })),
          })),
        }))
      } else if (s.slot_type === 'modifier') {
        slot.modifiers = (modifiersBySlot.get(s.id) || []).map((sm: any) => ({
          id: sm.id,
          modifierId: sm.modifier_id,
          name: { uk: sm.modifier_name_uk, lt: sm.modifier_name_lt },
          type: sm.modifier_type,
          required: Boolean(sm.required),
          minSelection: sm.min_selection,
          maxSelection: sm.max_selection,
          options: (optionsByModifier.get(sm.modifier_id) || []).map((opt: any) => ({
            id: opt.id,
            name: { uk: opt.name_uk, lt: opt.name_lt },
            price: Number(opt.price) || 0,
            isDefault: Boolean(opt.is_default),
          })),
        }))
      }

      return slot
    }),
  }

  return combo
}

function upsertComboInTx(comboId: string, payload: UpsertComboRequest) {
  const db = getDatabase()

  const tx = db.transaction(() => {
    const existing = db.prepare('SELECT id FROM combo_sets WHERE id = ?').get(comboId) as any
    if (!existing) {
      throw new Error('Combo not found')
    }

    db.prepare('UPDATE combo_sets SET menu_item_id = ?, price_override = ? WHERE id = ?').run(
      payload.menuItemId,
      payload.priceOverride ?? null,
      comboId
    )

    // Remove existing structure
    const slotIds = db.prepare('SELECT id FROM combo_slots WHERE combo_set_id = ?').all(comboId) as any[]
    const slotIdList = slotIds.map(r => r.id)

    if (slotIdList.length > 0) {
      const placeholders = slotIdList.map(() => '?').join(',')
      const slotItemIds = db
        .prepare(`SELECT id FROM combo_slot_items WHERE combo_slot_id IN (${placeholders})`)
        .all(...slotIdList) as any[]
      const slotItemIdList = slotItemIds.map(r => r.id)

      if (slotItemIdList.length > 0) {
        const p2 = slotItemIdList.map(() => '?').join(',')
        db.prepare(`DELETE FROM combo_slot_item_modifiers WHERE combo_slot_item_id IN (${p2})`).run(
          ...slotItemIdList
        )
      }

      db.prepare(`DELETE FROM combo_slot_items WHERE combo_slot_id IN (${placeholders})`).run(...slotIdList)
      db.prepare(`DELETE FROM combo_slot_modifiers WHERE combo_slot_id IN (${placeholders})`).run(...slotIdList)
      db.prepare('DELETE FROM combo_slots WHERE combo_set_id = ?').run(comboId)
    }

    const insertSlot = db.prepare(`
      INSERT INTO combo_slots (id, combo_set_id, title_lt, title_uk, slot_type, required, min_selection, max_selection, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const insertSlotItem = db.prepare(`
      INSERT INTO combo_slot_items (id, combo_slot_id, menu_item_id, price_delta, is_available, sort_order, is_fryer, cooking_time)
      VALUES (?, ?, ?, ?, 1, ?, ?, ?)
    `)

    const insertSlotModifier = db.prepare(`
      INSERT INTO combo_slot_modifiers (id, combo_slot_id, modifier_id, required, min_selection, max_selection, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)

    const insertSlotItemModifier = db.prepare(`
      INSERT INTO combo_slot_item_modifiers (id, combo_slot_item_id, modifier_id, required, min_selection, max_selection, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)

    const genId = () => String(Date.now()) + Math.random().toString(16).slice(2)

    const slots = payload.slots || []

    for (let i = 0; i < slots.length; i++) {
      const s = slots[i]
      const slotId = genId()

      const title = s.title || {}
      const titleLt = title.lt || ''
      const titleUk = title.uk || ''

      const slotType = s.type || 'menu_item_choice'
      const required = s.required ? 1 : 0
      const minSelection = Number(s.minSelection ?? 0)
      const maxSelection = Number(s.maxSelection ?? 1)

      insertSlot.run(slotId, comboId, titleLt, titleUk, slotType, required, minSelection, maxSelection, i)

      if (slotType === 'menu_item_choice') {
        const items = s.items || []
        for (let j = 0; j < items.length; j++) {
          const it = items[j]
          const slotItemId = genId()
          insertSlotItem.run(slotItemId, slotId, it.menuItemId, Number(it.priceDelta || 0), j, it.is_fryer ? 1 : 0, Number(it.cooking_time || 180))

          const itemMods = it.modifiers || []
          for (let k = 0; k < itemMods.length; k++) {
            const im = itemMods[k]
            insertSlotItemModifier.run(
              genId(),
              slotItemId,
              im.modifierId,
              im.required ? 1 : 0,
              Number(im.minSelection ?? 0),
              Number(im.maxSelection ?? 1),
              k
            )
          }
        }
      } else if (slotType === 'modifier') {
        const mods = s.modifiers || []
        for (let j = 0; j < mods.length; j++) {
          const m = mods[j]
          insertSlotModifier.run(
            genId(),
            slotId,
            m.modifierId,
            m.required ? 1 : 0,
            Number(m.minSelection ?? 0),
            Number(m.maxSelection ?? 1),
            j
          )
        }
      }
    }
  })

  tx()
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const combo = await loadComboDetails(id)
    if (!combo) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true, combo })
  } catch (e) {
    console.error('[API] GET /api/combos/[id] error:', e)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const body = (await req.json()) as UpsertComboRequest

    if (!body?.menuItemId) {
      return NextResponse.json({ success: false, error: 'menuItemId required' }, { status: 400 })
    }

    upsertComboInTx(id, body)

    const combo = await loadComboDetails(id)
    return NextResponse.json({ success: true, combo })
  } catch (e: any) {
    const message = typeof e?.message === 'string' ? e.message : 'Server error'
    const status = message === 'Combo not found' ? 404 : 500
    console.error('[API] PUT /api/combos/[id] error:', e)
    return NextResponse.json({ success: false, error: message }, { status })
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const db = getDatabase()

    const tx = db.transaction(() => {
      const slotIds = db.prepare('SELECT id FROM combo_slots WHERE combo_set_id = ?').all(id) as any[]
      const slotIdList = slotIds.map(r => r.id)

      if (slotIdList.length > 0) {
        const placeholders = slotIdList.map(() => '?').join(',')
        const slotItemIds = db
          .prepare(`SELECT id FROM combo_slot_items WHERE combo_slot_id IN (${placeholders})`)
          .all(...slotIdList) as any[]
        const slotItemIdList = slotItemIds.map(r => r.id)

        if (slotItemIdList.length > 0) {
          const p2 = slotItemIdList.map(() => '?').join(',')
          db.prepare(`DELETE FROM combo_slot_item_modifiers WHERE combo_slot_item_id IN (${p2})`).run(
            ...slotItemIdList
          )
        }

        db.prepare(`DELETE FROM combo_slot_items WHERE combo_slot_id IN (${placeholders})`).run(...slotIdList)
        db.prepare(`DELETE FROM combo_slot_modifiers WHERE combo_slot_id IN (${placeholders})`).run(...slotIdList)
        db.prepare('DELETE FROM combo_slots WHERE combo_set_id = ?').run(id)
      }

      db.prepare('DELETE FROM combo_sets WHERE id = ?').run(id)
    })

    tx()

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[API] DELETE /api/combos/[id] error:', e)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}
