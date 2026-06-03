import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/database'

interface ComboSlot {
  id: string
  combo_set_id: string
  title_lt: string
  title_uk: string
  slot_type: string
  required: number
  min_selection: number
  max_selection: number
  sort_order: number
}

interface SlotItem {
  id: string
  combo_slot_id: string
  menu_item_id: string
  price_delta: number
  is_available: number
  sort_order: number
  is_fryer?: number
  cooking_time?: number
  item_name_uk: string
  item_name_lt: string
  item_price: number
  item_available: number
}

interface SlotModifier {
  id: string
  combo_slot_id: string
  modifier_id: string
  required: number
  min_selection: number
  max_selection: number
  sort_order: number
  modifier_name_uk: string
  modifier_name_lt: string
  modifier_type: string
}

interface ModifierOption {
  id: string
  modifier_id: string
  name_uk: string
  name_lt: string
  price: number
  is_default: number
  sort_order: number
}

interface SlotItemModifierRow {
  slot_item_modifier_id: string
  combo_slot_item_id: string
  modifier_id: string
  required: number
  min_selection: number
  max_selection: number
  sort_order: number
  modifier_name_uk: string
  modifier_name_lt: string
  modifier_type: string
}

interface CreateComboSlot {
  title?: { lt?: string; uk?: string }
  title_uk?: string
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

interface CreateComboRequest {
  menuItemId: string
  priceOverride?: number | null
  slots?: CreateComboSlot[]
}

interface ComboSet {
  combo_set_id: string
  menu_item_id: string
  is_active: number
  price_override?: number | null
  menu_item_name_uk: string
  menu_item_name_lt: string
  menu_item_price: number
  category_id?: string
  image_url?: string
  menu_item_available: number
  category_name_uk?: string
  category_name_lt?: string
  category_color?: string
  category_order_index?: number
}

// GET /api/combos - получить все комбо-наборы
export async function GET(request: NextRequest) {
  try {
    const db = getDatabase()
    const url = new URL(request.url)
    const includeDetails = url.searchParams.get('include') === 'details'

    if (includeDetails) {
      // Полная структура с слотами и вариантами (для POS)
      const combos = db.prepare(`
        SELECT 
          cs.id as combo_set_id,
          cs.menu_item_id,
          cs.is_active,
          cs.price_override,
          mi.name_uk as menu_item_name_uk,
          mi.name_lt as menu_item_name_lt,
          mi.price as menu_item_price,
          mi.category_id,
          mi.image_url,
          mi.is_available as menu_item_available,
          c.name_uk as category_name_uk,
          c.name_lt as category_name_lt,
          c.color as category_color,
          c.order_index as category_order_index
        FROM combo_sets cs
        JOIN menu_items mi ON cs.menu_item_id = mi.id
        LEFT JOIN categories c ON mi.category_id = c.id
        WHERE cs.is_active = 1
        ORDER BY c.order_index, mi.name_uk
      `).all() as ComboSet[]

      const slots = db.prepare(`
        SELECT 
          cs.id as slot_id,
          cs.combo_set_id,
          cs.title_lt as slot_title_lt,
          cs.title_uk as slot_title_uk,
          cs.slot_type,
          cs.required,
          cs.min_selection,
          cs.max_selection,
          cs.sort_order as slot_sort_order
        FROM combo_slots cs
        ORDER BY cs.sort_order
      `).all() as ComboSlot[]

      const slotItems = db.prepare(`
        SELECT 
          csi.id as slot_item_id,
          csi.combo_slot_id,
          csi.menu_item_id,
          csi.price_delta,
          csi.is_available,
          csi.sort_order as slot_item_sort_order,
          mi.name_uk as item_name_uk,
          mi.name_lt as item_name_lt,
          mi.price as item_price,
          mi.is_available as item_available
        FROM combo_slot_items csi
        JOIN menu_items mi ON csi.menu_item_id = mi.id
        ORDER BY csi.sort_order
      `).all() as SlotItem[]

      const slotItemModifiers = db.prepare(`
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
        ORDER BY csim.sort_order
      `).all() as SlotItemModifierRow[]

      const slotModifiers = db.prepare(`
        SELECT 
          csm.id as slot_modifier_id,
          csm.combo_slot_id,
          csm.modifier_id,
          csm.required,
          csm.min_selection,
          csm.max_selection,
          csm.sort_order as slot_modifier_sort_order,
          m.name_uk as modifier_name_uk,
          m.name_lt as modifier_name_lt,
          m.type as modifier_type
        FROM combo_slot_modifiers csm
        JOIN modifiers m ON csm.modifier_id = m.id
        ORDER BY csm.sort_order
      `).all() as SlotModifier[]

      // Группируем слоты и варианты
      const slotsByCombo = new Map<string, ComboSlot[]>()
      slots.forEach((slot: ComboSlot) => {
        if (!slotsByCombo.has(slot.combo_set_id)) {
          slotsByCombo.set(slot.combo_set_id, [])
        }
        slotsByCombo.get(slot.combo_set_id)!.push(slot)
      })

      const itemsBySlot = new Map<string, SlotItem[]>()
      slotItems.forEach((item: SlotItem) => {
        if (!itemsBySlot.has(item.combo_slot_id)) {
          itemsBySlot.set(item.combo_slot_id, [])
        }
        itemsBySlot.get(item.combo_slot_id)!.push(item)
      })

      const modifiersBySlotItem = new Map<string, SlotItemModifierRow[]>()
      slotItemModifiers.forEach((row: SlotItemModifierRow) => {
        if (!modifiersBySlotItem.has(row.combo_slot_item_id)) {
          modifiersBySlotItem.set(row.combo_slot_item_id, [])
        }
        modifiersBySlotItem.get(row.combo_slot_item_id)!.push(row)
      })

      const modifiersBySlot = new Map<string, SlotModifier[]>()
      slotModifiers.forEach((mod: SlotModifier) => {
        if (!modifiersBySlot.has(mod.combo_slot_id)) {
          modifiersBySlot.set(mod.combo_slot_id, [])
        }
        modifiersBySlot.get(mod.combo_slot_id)!.push(mod)
      })

      // Добавляем опции модификаторов
      const modifierOptions = db.prepare(`
        SELECT 
          mo.id,
          mo.modifier_id,
          mo.name_uk,
          mo.name_lt,
          mo.price,
          mo.is_default,
          mo.sort_order
        FROM modifier_options mo
        ORDER BY mo.sort_order
      `).all() as ModifierOption[]

      const optionsByModifier = new Map<string, ModifierOption[]>()
      modifierOptions.forEach((opt: ModifierOption) => {
        if (!optionsByModifier.has(opt.modifier_id)) {
          optionsByModifier.set(opt.modifier_id, [])
        }
        optionsByModifier.get(opt.modifier_id)!.push(opt)
      })

      // Собираем результат
      const result = combos.map((combo: ComboSet) => {
        const comboSlots = (slotsByCombo.get(combo.combo_set_id) || []).map((slot: ComboSlot) => {
          const slotData: any = {
            id: slot.id,
            title: { lt: slot.title_lt, uk: slot.title_uk },
            type: slot.slot_type,
            required: Boolean(slot.required),
            minSelection: slot.min_selection,
            maxSelection: slot.max_selection,
            sortOrder: slot.sort_order
          }

          if (slot.slot_type === 'menu_item_choice') {
            slotData.items = (itemsBySlot.get(slot.id) || [])
              .filter((item: SlotItem) => Boolean(item.is_available && item.item_available))
              .map((item: SlotItem) => ({
                id: item.id,
                menuItemId: item.menu_item_id,
                name: { lt: item.item_name_lt, uk: item.item_name_uk },
                price: Number(item.item_price) + Number(item.price_delta || 0),
                originalPrice: Number(item.item_price),
                priceDelta: Number(item.price_delta || 0),
                sortOrder: item.sort_order,
                modifiers: (modifiersBySlotItem.get(item.id) || []).map((mrow: SlotItemModifierRow) => ({
                  id: mrow.slot_item_modifier_id,
                  modifierId: mrow.modifier_id,
                  name: { lt: mrow.modifier_name_lt, uk: mrow.modifier_name_uk },
                  type: mrow.modifier_type,
                  required: Boolean(mrow.required),
                  minSelection: mrow.min_selection,
                  maxSelection: mrow.max_selection,
                  options: (optionsByModifier.get(mrow.modifier_id) || []).map((opt: ModifierOption) => ({
                    id: opt.id,
                    name: { lt: opt.name_lt, uk: opt.name_uk },
                    price: Number(opt.price),
                    isDefault: Boolean(opt.is_default),
                    sortOrder: opt.sort_order
                  }))
                }))
              }))
          } else if (slot.slot_type === 'modifier') {
            slotData.modifiers = (modifiersBySlot.get(slot.id) || []).map((mod: SlotModifier) => ({
              id: mod.id,
              modifierId: mod.modifier_id,
              name: { lt: mod.modifier_name_lt, uk: mod.modifier_name_uk },
              type: mod.modifier_type,
              required: Boolean(mod.required),
              minSelection: mod.min_selection,
              maxSelection: mod.max_selection,
              options: (optionsByModifier.get(mod.modifier_id) || []).map((opt: ModifierOption) => ({
                id: opt.id,
                name: { lt: opt.name_lt, uk: opt.name_uk },
                price: Number(opt.price),
                isDefault: Boolean(opt.is_default),
                sortOrder: opt.sort_order
              }))
            }))
          }

          return slotData
        })

        return {
          id: combo.combo_set_id,
          menuItemId: combo.menu_item_id,
          name: { lt: combo.menu_item_name_lt, uk: combo.menu_item_name_uk },
          price: combo.price_override !== null && combo.price_override !== undefined
            ? Number(combo.price_override)
            : Number(combo.menu_item_price),
          category: combo.category_id,
          categoryName: combo.category_name_uk ? { 
            lt: combo.category_name_lt, 
            uk: combo.category_name_uk 
          } : undefined,
          categoryColor: combo.category_color,
          categoryOrderIndex: combo.category_order_index,
          image: combo.image_url,
          available: Boolean(combo.menu_item_available),
          slots: comboSlots
        }
      })

      return NextResponse.json({ combos: result })
    } else {
      // Простой список комбо (для админки)
      const combos = db.prepare(`
        SELECT 
          cs.id,
          cs.menu_item_id,
          cs.is_active,
          cs.created_at,
          cs.updated_at,
          mi.name_uk as menu_item_name_uk,
          mi.name_lt as menu_item_name_lt,
          mi.price as menu_item_price
        FROM combo_sets cs
        JOIN menu_items mi ON cs.menu_item_id = mi.id
        ORDER BY cs.created_at DESC
      `).all()

      return NextResponse.json({ combos })
    }
  } catch (error) {
    console.error('[API] Error fetching combos:', error)
    return NextResponse.json(
      { error: 'Failed to fetch combos' },
      { status: 500 }
    )
  }
}

// POST /api/combos - создать новый комбо-набор
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as CreateComboRequest
    const { menuItemId, slots, priceOverride } = body

    if (!menuItemId) {
      return NextResponse.json(
        { error: 'menuItem is required' },
        { status: 400 }
      )
    }

    const db = getDatabase()
    
    // Проверяем, что блюдо существует
    const menuItem = db.prepare('SELECT id FROM menu_items WHERE id = ?').get(menuItemId)
    if (!menuItem) {
      return NextResponse.json(
        { error: 'Menu item not found' },
        { status: 404 }
      )
    }

    // Проверяем, что для этого блюда еще нет комбо
    const existing = db.prepare('SELECT id FROM combo_sets WHERE menu_item_id = ?').get(menuItemId)
    if (existing) {
      return NextResponse.json(
        { error: 'Combo already exists for this menu item' },
        { status: 409 }
      )
    }

    // Создаем комбо-набор
    const comboSetId = `combo_${Date.now()}_${Math.random().toString(36).slice(2)}`
    db.prepare(`
      INSERT INTO combo_sets (id, menu_item_id, is_active, price_override, created_at, updated_at)
      VALUES (?, ?, 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(comboSetId, menuItemId, priceOverride ?? null)

    // Создаем слоты
    if (slots && Array.isArray(slots)) {
      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i] as CreateComboSlot
        const slotId = `slot_${Date.now()}_${i}_${Math.random().toString(36).slice(2)}`
        
        db.prepare(`
          INSERT INTO combo_slots (
            id, combo_set_id, title_lt, title_uk, slot_type, 
            required, min_selection, max_selection, sort_order, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).run(
          slotId,
          comboSetId,
          slot.title?.lt || slot.title_uk || '',
          slot.title?.uk || slot.title_uk || '',
          slot.type || 'menu_item_choice',
          slot.required ? 1 : 0,
          slot.minSelection || 1,
          slot.maxSelection || 1,
          i
        )

        // Добавляем элементы слота (если это выбор блюда)
        if (slot.type === 'menu_item_choice' && slot.items && Array.isArray(slot.items)) {
          for (let j = 0; j < slot.items.length; j++) {
            const item = slot.items[j] as any
            const slotItemId = `slot_item_${Date.now()}_${j}_${Math.random().toString(36).slice(2)}`
            
            db.prepare(`
              INSERT INTO combo_slot_items (
                id, combo_slot_id, menu_item_id, price_delta, is_available, sort_order, is_fryer, cooking_time, created_at, updated_at
              ) VALUES (?, ?, ?, ?, 1, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `).run(
              slotItemId,
              slotId,
              item.menuItemId,
              item.priceDelta || 0,
              j,
              item.is_fryer ? 1 : 0,
              item.cooking_time || 180
            )

            if (item.modifiers && Array.isArray(item.modifiers)) {
              for (let k = 0; k < item.modifiers.length; k++) {
                const imod = item.modifiers[k] as any
                const itemModId = `slot_item_mod_${Date.now()}_${j}_${k}_${Math.random().toString(36).slice(2)}`
                db.prepare(`
                  INSERT INTO combo_slot_item_modifiers (
                    id, combo_slot_item_id, modifier_id, required, min_selection, max_selection, sort_order, created_at, updated_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                `).run(
                  itemModId,
                  slotItemId,
                  imod.modifierId,
                  imod.required ? 1 : 0,
                  imod.minSelection ?? 0,
                  imod.maxSelection ?? 1,
                  k
                )
              }
            }
          }
        }

        // Добавляем модификаторы (если это модификатор)
        if (slot.type === 'modifier' && slot.modifiers && Array.isArray(slot.modifiers)) {
          for (let j = 0; j < slot.modifiers.length; j++) {
            const mod = slot.modifiers[j] as any
            const slotModId = `slot_mod_${Date.now()}_${j}_${Math.random().toString(36).slice(2)}`
            
            db.prepare(`
              INSERT INTO combo_slot_modifiers (
                id, combo_slot_id, modifier_id, required, min_selection, max_selection, sort_order, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `).run(
              slotModId,
              slotId,
              mod.modifierId,
              mod.required ? 1 : 0,
              mod.minSelection || 1,
              mod.maxSelection || 1,
              j
            )
          }
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      comboSetId,
      message: 'Combo created successfully' 
    })
  } catch (error) {
    console.error('[API] Error creating combo:', error)
    return NextResponse.json(
      { error: 'Failed to create combo' },
      { status: 500 }
    )
  }
}
