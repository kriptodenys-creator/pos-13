import { getDatabase } from "@/lib/database"

// Prepared statements cache
const preparedStatements = new Map<string, any>()

function getPreparedStatement(db: any, sql: string) {
  if (!preparedStatements.has(sql)) {
    preparedStatements.set(sql, db.prepare(sql))
  }
  return preparedStatements.get(sql)
}

async function ensureDatabase() {
  try {
    return getDatabase()
  } catch (error) {
    console.error("[API] Database connection failed:", error)
    throw error
  }
}

// Таблица опций модификаторов (группы модификаторов имеют несколько опций)
function ensureModifierOptionsTable(db: any) {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS modifier_options (
        id TEXT PRIMARY KEY,
        modifier_id TEXT NOT NULL,
        name_lt TEXT NOT NULL,
        name_uk TEXT NOT NULL,
        price REAL DEFAULT 0,
        FOREIGN KEY (modifier_id) REFERENCES modifiers(id) ON DELETE CASCADE
      );
    `)
  } catch (e) {
    console.error('[API] Failed to ensure modifier_options table:', e)
  }
}
// Гарантируем существование таблицы категорий (для управляемого справочника)
function ensureCategoriesTable(db: any) {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name_lt TEXT NOT NULL,
        name_uk TEXT NOT NULL,
        parent_id TEXT DEFAULT NULL,
        color TEXT DEFAULT '#6b7280',
        order_index INTEGER DEFAULT 0,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `)

    const columns = db.prepare('PRAGMA table_info(categories)').all() as any[]
    const has = (name: string) => columns.some((c) => String(c.name) === name)

    if (!has('parent_id')) {
      try { db.exec('ALTER TABLE categories ADD COLUMN parent_id TEXT DEFAULT NULL') } catch {}
    }
    if (!has('color')) {
      try { db.exec("ALTER TABLE categories ADD COLUMN color TEXT DEFAULT '#6b7280'") } catch {}
    }
    if (!has('order_index')) {
      try { db.exec('ALTER TABLE categories ADD COLUMN order_index INTEGER DEFAULT 0') } catch {}
    }
    if (!has('updated_at')) {
      try { db.exec('ALTER TABLE categories ADD COLUMN updated_at TEXT DEFAULT CURRENT_TIMESTAMP') } catch {}
    }
  } catch (e) {
    console.error('[API] Failed to ensure categories table:', e)
  }
}

// Гарантируем существование связующей таблицы (на случай старых БД)
function ensureMenuItemModifiersTable(db: any) {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS menu_item_modifiers (
        menu_item_id TEXT NOT NULL,
        modifier_id TEXT NOT NULL,
        PRIMARY KEY (menu_item_id, modifier_id),
        FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE,
        FOREIGN KEY (modifier_id) REFERENCES modifiers(id) ON DELETE CASCADE
      );
    `)
  } catch (e) {
    console.error('[API] Failed to ensure menu_item_modifiers table:', e)
  }
}

// Note: we ensure categories table inside handlers when DB is initialized

export async function GET(request: Request) {
  const db = await ensureDatabase()
  
  if (!db) {
    // БД недоступна — не возвращаем демо-меню, чтобы не путать POS
    return new Response(JSON.stringify({ menu: [], error: 'Database not available' }), {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  }

  try {
    const url = new URL(request.url)
    const includeAll = url.searchParams.get('includeAll') === '1'
    const fallbackAll = url.searchParams.get('fallbackAllModifiers') === '1'
    const listModifiers = url.searchParams.get('listModifiers') === '1'
    const listCategories = url.searchParams.get('listCategories') === '1'
    // На всякий случай создадим связующие и справочники
    ensureMenuItemModifiersTable(db)
    ensureCategoriesTable(db)
    ensureModifierOptionsTable(db)
    // Get menu items with their modifiers; by default только доступные, с includeAll=1 — все
    const baseSelect = `
        SELECT 
          mi.id,
          mi.name_lt,
          mi.name_uk,
          mi.price,
          mi.category,
          mi.image,
          COALESCE(mi.available, 1) as available,
          COALESCE(mi.is_fryer, 0) as is_fryer,
          COALESCE(mi.cooking_time, 180) as cooking_time
        FROM menu_items mi
      `
    const where = includeAll ? '' : 'WHERE COALESCE(mi.available, 1) = 1'
    const order = 'ORDER BY mi.category, mi.name_uk'
    
    // Use prepared statement for better performance
    const menuItemsQuery = [baseSelect, where, order].filter(Boolean).join('\n')
    const menuItemsStmt = getPreparedStatement(db, menuItemsQuery)
    const menuItems = menuItemsStmt.all()

    // Get all modifiers and their options in one query for better performance
    const modifiersStmt = getPreparedStatement(db, `
      SELECT 
        m.id,
        m.name_lt,
        m.name_uk,
        m.group_name,
        m.price,
        m.type,
        m.required,
        mim.menu_item_id
      FROM modifiers m
      JOIN menu_item_modifiers mim ON m.id = mim.modifier_id
    `)
    const allModifiers = modifiersStmt.all()
    
    // Get all modifier options in one query
    const optionsStmt = getPreparedStatement(db, `
      SELECT id, modifier_id, name_lt, name_uk, price, order_position FROM modifier_options ORDER BY order_position ASC, name_uk
    `)
    const allOptions = optionsStmt.all()
    const optionsByModifier = new Map<string, any[]>()
    for (const opt of allOptions) {
      if (!optionsByModifier.has(opt.modifier_id)) {
        optionsByModifier.set(opt.modifier_id, [])
      }
      optionsByModifier.get(opt.modifier_id)!.push(opt)
    }
    
    // Group modifiers by menu item
    const modifiersByItem = new Map<string, any[]>()
    for (const mod of allModifiers) {
      if (!modifiersByItem.has(mod.menu_item_id)) {
        modifiersByItem.set(mod.menu_item_id, [])
      }
      modifiersByItem.get(mod.menu_item_id)!.push(mod)
    }

    // Load combo data for menu items
    const combosByMenuItem = new Map<string, any>()
    try {
      const comboStmt = getPreparedStatement(db, `
        SELECT 
          cs.menu_item_id,
          cs.id as combo_set_id,
          cs.is_active,
          cs.price_override,
          csl.id as slot_id,
          csl.title_lt as slot_title_lt,
          csl.title_uk as slot_title_uk,
          csl.slot_type,
          csl.required,
          csl.min_selection,
          csl.max_selection,
          csl.sort_order as slot_sort_order
        FROM combo_sets cs
        LEFT JOIN combo_slots csl ON cs.id = csl.combo_set_id
        WHERE cs.is_active = 1
        ORDER BY csl.sort_order
      `)
      const comboSlots = comboStmt.all()

      const slotItemsStmt = getPreparedStatement(db, `
        SELECT 
          csi.combo_slot_id,
          csi.id as slot_item_id,
          csi.menu_item_id as slot_item_menu_id,
          csi.price_delta,
          csi.sort_order,
          mi.name_uk as item_name_uk,
          mi.name_lt as item_name_lt,
          mi.price as item_price
        FROM combo_slot_items csi
        JOIN menu_items mi ON csi.menu_item_id = mi.id
        ORDER BY csi.sort_order
      `)
      const slotItems = slotItemsStmt.all()

      const slotItemModifiersStmt = getPreparedStatement(db, `
        SELECT
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
      `)
      const slotItemModifiers = slotItemModifiersStmt.all()

      const modifierOptionsStmt = getPreparedStatement(db, `
        SELECT id, modifier_id, name_uk, name_lt, price
        FROM modifier_options
        ORDER BY id
      `)
      const modifierOptions = modifierOptionsStmt.all()

      const optionsByModifier = new Map<string, any[]>()
      modifierOptions.forEach((opt: any) => {
        if (!optionsByModifier.has(opt.modifier_id)) {
          optionsByModifier.set(opt.modifier_id, [])
        }
        optionsByModifier.get(opt.modifier_id)!.push(opt)
      })

      const slotModifiersStmt = getPreparedStatement(db, `
        SELECT 
          csm.combo_slot_id,
          csm.modifier_id,
          csm.required,
          csm.min_selection,
          csm.max_selection,
          m.name_uk as modifier_name_uk,
          m.name_lt as modifier_name_lt,
          m.type as modifier_type
        FROM combo_slot_modifiers csm
        JOIN modifiers m ON csm.modifier_id = m.id
        ORDER BY csm.sort_order
      `)
      const slotModifiers = slotModifiersStmt.all()

      // Group slot items and modifiers
      const itemsBySlot = new Map<string, any[]>()
      slotItems.forEach((item: any) => {
        if (!itemsBySlot.has(item.combo_slot_id)) {
          itemsBySlot.set(item.combo_slot_id, [])
        }
        itemsBySlot.get(item.combo_slot_id)!.push(item)
      })

      const itemModifiersBySlotItem = new Map<string, any[]>()
      slotItemModifiers.forEach((row: any) => {
        if (!itemModifiersBySlotItem.has(row.combo_slot_item_id)) {
          itemModifiersBySlotItem.set(row.combo_slot_item_id, [])
        }
        itemModifiersBySlotItem.get(row.combo_slot_item_id)!.push(row)
      })

      const modifiersBySlot = new Map<string, any[]>()
      slotModifiers.forEach((mod: any) => {
        if (!modifiersBySlot.has(mod.combo_slot_id)) {
          modifiersBySlot.set(mod.combo_slot_id, [])
        }
        modifiersBySlot.get(mod.combo_slot_id)!.push(mod)
      })

      // Build combo structure
      comboSlots.forEach((row: any) => {
        const menuItemId = row.menu_item_id
        if (!combosByMenuItem.has(menuItemId)) {
          combosByMenuItem.set(menuItemId, {
            id: row.combo_set_id,
            priceOverride: row.price_override,
            slots: []
          })
        }

        if (row.slot_id) {
          const slot: any = {
            id: row.slot_id,
            title: { lt: row.slot_title_lt, uk: row.slot_title_uk },
            type: row.slot_type,
            required: Boolean(row.required),
            minSelection: row.min_selection,
            maxSelection: row.max_selection,
            sortOrder: row.slot_sort_order
          }

          if (row.slot_type === 'menu_item_choice') {
            slot.items = (itemsBySlot.get(row.slot_id) || []).map(item => ({
              id: item.slot_item_id,
              menuItemId: item.slot_item_menu_id,
              name: { lt: item.item_name_lt, uk: item.item_name_uk },
              price: Number(item.item_price) + Number(item.price_delta || 0),
              priceDelta: Number(item.price_delta || 0),
              modifiers: (itemModifiersBySlotItem.get(item.slot_item_id) || []).map((mrow: any) => ({
                modifierId: mrow.modifier_id,
                name: { lt: mrow.modifier_name_lt, uk: mrow.modifier_name_uk },
                type: mrow.modifier_type,
                required: Boolean(mrow.required),
                minSelection: mrow.min_selection,
                maxSelection: mrow.max_selection,
                options: (optionsByModifier.get(mrow.modifier_id) || []).map((opt: any) => ({
                  id: opt.id,
                  name: { lt: opt.name_lt, uk: opt.name_uk },
                  price: Number(opt.price) || 0,
                  isDefault: Boolean(opt.is_default)
                }))
              }))
            }))
          } else if (row.slot_type === 'modifier') {
            slot.modifiers = (modifiersBySlot.get(row.slot_id) || []).map(mod => ({
              modifierId: mod.modifier_id,
              name: { lt: mod.modifier_name_lt, uk: mod.modifier_name_uk },
              type: mod.modifier_type,
              required: Boolean(mod.required),
              minSelection: mod.min_selection,
              maxSelection: mod.max_selection
            }))
          }

          combosByMenuItem.get(menuItemId).slots.push(slot)
        }
      })
    } catch (e) {
      console.warn('[API] Failed to load combo data:', e)
    }
    
    // Build menu with modifiers and combo data
    const menuWithModifiers = menuItems.map((item: any) => {
      const itemModifiers = modifiersByItem.get(item.id) || []
      const comboData = combosByMenuItem.get(item.id)
      
      return {
        ...item,
        modifiers: itemModifiers.map((m: any) => ({
          ...m,
          name: { lt: m.name_lt, uk: m.name_uk },
          groupName: m.group_name ? { lt: m.group_name, uk: m.group_name } : undefined,
          options: (optionsByModifier.get(m.id) || []).map((o: any) => ({
            id: o.id,
            name_lt: o.name_lt,
            name_uk: o.name_uk,
            price: Number(o.price) || 0,
            name: { lt: o.name_lt, uk: o.name_uk },
          })),
        })),
        name: { lt: item.name_lt, uk: item.name_uk },
        ...(comboData ? { 
          combo: {
            ...comboData,
            priceOverride: Number(comboData.priceOverride) || undefined
          }
        } : {})
      }
    })

    // При необходимости также вернем полный список модификаторов
    let allMods: any[] | undefined = undefined
    if (listModifiers) {
      try {
        // Проверяем, есть ли колонка category_id
        const modifierColumns = db.prepare("PRAGMA table_info(modifiers)").all() as any[]
        const hasCategoryId = modifierColumns.some((c) => String(c.name) === 'category_id')
        
        const selectFields = hasCategoryId 
          ? 'id, name_lt, name_uk, group_name, category_id, price, type, required'
          : 'id, name_lt, name_uk, group_name, price, type, required'
        
        const modifiersStmt = getPreparedStatement(db, `SELECT ${selectFields} FROM modifiers ORDER BY name_uk`)
        const rows = modifiersStmt.all()
        const mappedMods = rows.map((m: any) => {
          let options: any[] = []
          try {
            // Проверяем, есть ли колонка order_position
            const optColumns = db.prepare("PRAGMA table_info(modifier_options)").all() as any[]
            const hasOrderPosition = optColumns.some((c) => String(c.name) === 'order_position')
            
            const optQuery = hasOrderPosition 
              ? `SELECT id, name_lt, name_uk, price, order_position FROM modifier_options WHERE modifier_id = ? ORDER BY order_position ASC, name_uk`
              : `SELECT id, name_lt, name_uk, price FROM modifier_options WHERE modifier_id = ? ORDER BY name_uk`
            
            const optionsStmt = getPreparedStatement(db, optQuery)
            options = optionsStmt.all(m.id).map((opt: any) => ({ 
              ...opt, 
              order: opt.order_position !== undefined ? opt.order_position : 0 
            }))
          } catch (e) {
            console.warn('[API] Failed to get options for modifier', m.id, ':', e)
          }
          return { ...m, options }
        })

        const seen = new Map<string, any>()
        const norm = (v: any) => String(v ?? '').trim().toLowerCase()
        for (const m of mappedMods) {
          const key = `${norm(m.name_uk)}|${norm(m.name_lt)}|${norm(m.type)}|${norm(m.group_name)}`
          if (!seen.has(key)) {
            seen.set(key, m)
          }
        }
        allMods = Array.from(seen.values())
      } catch (e) {
        console.warn('[API] Failed to list modifiers:', e)
        allMods = []
      }
    }

    // И список категорий
    let categories: any[] | undefined = undefined
    if (listCategories) {
      try {
        const categoriesStmt = getPreparedStatement(db, `SELECT id, name_lt, name_uk, parent_id, order_index FROM categories ORDER BY COALESCE(parent_id, ''), order_index ASC, name_uk ASC`)
        categories = categoriesStmt.all()
      } catch (e) {
        console.warn('[API] Failed to list categories:', e)
        categories = []
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        menu: menuWithModifiers, 
        items: menuWithModifiers, // Для совместимости с тестами
        count: menuWithModifiers.length,
        ...(listModifiers ? { modifiers: allMods } : {}), 
        ...(listCategories ? { categories } : {}) 
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
        },
      }
    )
  } catch (error) {
    console.error('[API] Error in GET /api/menu:', error)
    // Ошибка при запросе — не подменяем меню демо-данными
    return new Response(JSON.stringify({ error: 'Failed to load menu', menu: [] }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const db = await ensureDatabase()
    if (!db) {
      return new Response(JSON.stringify({ success: false, error: 'Database not available' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // На всякий случай создадим таблицы, прежде чем использовать их в любых ветках
    ensureMenuItemModifiersTable(db)
    ensureCategoriesTable(db)

    // Управление категориями
    if (body && body.action === 'createCategory') {
      try {
        const id = (body.id && String(body.id)) || `cat_${Date.now()}_${Math.floor(Math.random() * 10000)}`
        const name_lt = String(body.name_lt || body.name || '').trim()
        const name_uk = String(body.name_uk || body.name || '').trim()
        if (!name_lt || !name_uk) {
          return new Response(JSON.stringify({ success: false, error: 'Missing category name' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
        }
        db.prepare(`INSERT INTO categories (id, name_lt, name_uk) VALUES (?, ?, ?)`).run(id, name_lt, name_uk)
        
        // Broadcast SSE event
        try {
          const { broadcastEvent } = await import('@/lib/sse')
          broadcastEvent({ type: 'menu-updated', data: { action: 'createCategory', id, timestamp: Date.now() } })
        } catch (e) { console.warn('[API] Failed to broadcast:', e) }
        
        return new Response(JSON.stringify({ success: true, id }), { status: 201, headers: { 'Content-Type': 'application/json' } })
      } catch (e: any) {
        console.error('[API] createCategory failed:', e)
        return new Response(JSON.stringify({ success: false, error: e?.message || 'Failed to create category' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
      }
    }

    if (body && body.action === 'renameCategory') {
      try {
        const id = String(body.id || '')
        const name_lt = String(body.name_lt || body.name || '').trim()
        const name_uk = String(body.name_uk || body.name || '').trim()
        if (!id || !name_lt || !name_uk) {
          return new Response(JSON.stringify({ success: false, error: 'Invalid category payload' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
        }
        const res = db.prepare(`UPDATE categories SET name_lt = ?, name_uk = ? WHERE id = ?`).run(name_lt, name_uk, id)
        if (res.changes === 0) {
          return new Response(JSON.stringify({ success: false, error: 'Category not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
        }
        
        // Broadcast SSE event
        try {
          const { broadcastEvent } = await import('@/lib/sse')
          broadcastEvent({ type: 'menu-updated', data: { action: 'renameCategory', id, timestamp: Date.now() } })
        } catch (e) { console.warn('[API] Failed to broadcast:', e) }
        
        return new Response(JSON.stringify({ success: true, id }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      } catch (e: any) {
        console.error('[API] renameCategory failed:', e)
        return new Response(JSON.stringify({ success: false, error: e?.message || 'Failed to rename category' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
      }
    }

    if (body && body.action === 'deleteCategory') {
      try {
        const id = String(body.id || '')
        if (!id) {
          return new Response(JSON.stringify({ success: false, error: 'Missing category id' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
        }
        const tx = db.transaction(() => {
          // Обнулим поле category у блюд этой категории (по ID)
          db.prepare(`UPDATE menu_items SET category = '' WHERE category = ?`).run(id)
          db.prepare(`DELETE FROM categories WHERE id = ?`).run(id)
        })
        tx()
        
        // Broadcast SSE event
        try {
          const { broadcastEvent } = await import('@/lib/sse')
          broadcastEvent({ type: 'menu-updated', data: { action: 'deleteCategory', id, timestamp: Date.now() } })
        } catch (e) { console.warn('[API] Failed to broadcast:', e) }
        
        return new Response(JSON.stringify({ success: true, id }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      } catch (e: any) {
        console.error('[API] deleteCategory failed:', e)
        return new Response(JSON.stringify({ success: false, error: e?.message || 'Failed to delete category' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
      }
    }

    // Полный сброс меню (удаление блюд, модификаторов и связей)
    if (body && body.action === 'resetMenu') {
      try {
        const tx = db.transaction(() => {
          // Безопасно удаляем данные, если таблицы существуют
          try { db.prepare('DELETE FROM menu_item_modifiers').run() } catch {}
          try { db.prepare('DELETE FROM modifiers').run() } catch {}
          try { db.prepare('DELETE FROM menu_items').run() } catch {}
        })
        tx()
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      } catch (e: any) {
        console.error('[API] resetMenu failed:', e)
        return new Response(JSON.stringify({ success: false, error: e?.message || 'Failed to reset menu' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
      }
    }

    // Обновление доступности блюда: { action: 'availability', id, available }
    if (body && body.action === 'availability') {
      try {
        const id = body.id as string
        const available = Boolean(body.available)
        if (!id || typeof id !== 'string') {
          return new Response(JSON.stringify({ success: false, error: 'Missing id' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        const stmt = db.prepare(`UPDATE menu_items SET available = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
        const res = stmt.run(available ? 1 : 0, id)
        if (res.changes === 0) {
          return new Response(JSON.stringify({ success: false, error: 'Menu item not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        
        // Broadcast SSE event for real-time sync
        try {
          const { broadcastEvent } = await import('@/lib/sse')
          broadcastEvent({
            type: 'menu-updated',
            data: { action: 'availability', id, available, timestamp: Date.now() }
          })
        } catch (e) {
          console.warn('[API] Failed to broadcast menu update:', e)
        }
        
        return new Response(JSON.stringify({ success: true, id, available }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      } catch (e) {
        console.error('[API] Ошибка обновления доступности:', e)
        return new Response(JSON.stringify({ success: false, error: 'Failed to update availability' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    }

    // Удаление модификатора: { action: 'deleteModifier', id }
    if (body && body.action === 'deleteModifier') {
      try {
        const id = String(body?.id ?? '').trim()
        console.log('[API] deleteModifier called with id:', id)
        
        if (!id) {
          console.log('[API] deleteModifier: Missing or invalid modifier id')
          return new Response(JSON.stringify({ success: false, error: 'Missing modifier id' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        // Проверяем, существует ли модификатор
        const existingModifier = db.prepare('SELECT id FROM modifiers WHERE id = ?').get(id)
        if (!existingModifier) {
          console.log('[API] deleteModifier: Modifier not found:', id)
          return new Response(JSON.stringify({ success: true, id, message: 'Modifier already deleted' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        const tx = db.transaction(() => {
          // Сначала удаляем опции модификатора
          const deleteOptions = db.prepare('DELETE FROM modifier_options WHERE modifier_id = ?')
          const optionsResult = deleteOptions.run(id)
          console.log('[API] Deleted modifier options:', optionsResult.changes)
          
          // Затем удаляем связи с товарами
          const deleteLinks = db.prepare('DELETE FROM menu_item_modifiers WHERE modifier_id = ?')
          const linksResult = deleteLinks.run(id)
          console.log('[API] Deleted menu item links:', linksResult.changes)
          
          // Проверяем, есть ли ссылки в заказах
          const orderItemsCheck = db.prepare(`
            SELECT COUNT(*) as count FROM order_item_modifiers WHERE modifier_id = ?
          `).get(id) as { count: number }
          
          if (orderItemsCheck && orderItemsCheck.count > 0) {
            console.log('[API] Found order references, deleting them first')
            const deleteOrderRefs = db.prepare('DELETE FROM order_item_modifiers WHERE modifier_id = ?')
            const orderRefsResult = deleteOrderRefs.run(id)
            console.log('[API] Deleted order references:', orderRefsResult.changes)
          }
          
          // Наконец удаляем сам модификатор
          const deleteModifier = db.prepare('DELETE FROM modifiers WHERE id = ?')
          const modifierResult = deleteModifier.run(id)
          console.log('[API] Deleted modifier:', modifierResult.changes)
          
          console.log('[API] deleteModifier results:', {
            options: optionsResult.changes,
            links: linksResult.changes,
            orderRefs: orderItemsCheck?.count || 0,
            modifier: modifierResult.changes
          })
        })
        tx()

        // Broadcast SSE event
        try {
          const { broadcastEvent } = await import('@/lib/sse')
          broadcastEvent({ type: 'menu-updated', data: { action: 'deleteModifier', id, timestamp: Date.now() } })
        } catch (e) { console.warn('[API] Failed to broadcast:', e) }

        console.log('[API] deleteModifier completed successfully for id:', id)
        return new Response(JSON.stringify({ success: true, id }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      } catch (e: any) {
        console.error('[API] deleteModifier failed:', e)
        let errorMessage = 'Failed to delete modifier'
        
        if (e?.message && e.message.includes('FOREIGN KEY constraint failed')) {
          errorMessage = 'Cannot delete modifier: it is still referenced by existing orders or menu items'
        } else if (e?.message) {
          errorMessage = e.message
        }
        
        return new Response(JSON.stringify({ success: false, error: errorMessage }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    }

    // Fallback: поддержка удаления через POST { action: 'delete', id }
    if (body && body.action === 'delete') {
      try {
        const id = body.id as string
        if (!id || typeof id !== 'string') {
          return new Response(JSON.stringify({ success: false, error: 'Missing id' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        const getItem = db.prepare('SELECT id FROM menu_items WHERE id = ?')
        const item = getItem.get(id)
        if (!item) {
          return new Response(JSON.stringify({ success: false, error: 'Menu item not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        const countRef = db.prepare('SELECT COUNT(1) as cnt FROM order_items WHERE menu_item_id = ?').get(id) as { cnt: number }
        if (countRef && countRef.cnt > 0) {
          return new Response(
            JSON.stringify({ success: false, error: 'Cannot delete: item is referenced by existing orders' }),
            { status: 409, headers: { 'Content-Type': 'application/json' } }
          )
        }

        const tx = db.transaction(() => {
          db.prepare('DELETE FROM menu_item_modifiers WHERE menu_item_id = ?').run(id)
          db.prepare('DELETE FROM menu_items WHERE id = ?').run(id)
        })
        tx()

        return new Response(JSON.stringify({ success: true, id }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      } catch (e: any) {
        console.error('[API] POST delete fallback failed:', e)
        return new Response(JSON.stringify({ success: false, error: e?.message || 'Failed to delete menu item' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    }

    // Вариант 1: пакетная загрузка всего меню: { menu: [...] }
    if (body && Array.isArray(body.menu)) {
      const menu = body.menu
      const transaction = db.transaction(() => {
        // Убедимся, что связующая таблица есть
        ensureMenuItemModifiersTable(db)
        db.prepare('DELETE FROM menu_item_modifiers').run()
        db.prepare('DELETE FROM menu_items').run()
        db.prepare('DELETE FROM modifiers').run()

        const insertMenuItem = db.prepare(`
          INSERT INTO menu_items (id, name_lt, name_uk, price, category, image)
          VALUES (?, ?, ?, ?, ?, ?)
        `)
        const insertModifier = db.prepare(`
          INSERT OR IGNORE INTO modifiers (id, name_lt, name_uk, price, type, required)
          VALUES (?, ?, ?, ?, ?, ?)
        `)
        const linkModifier = db.prepare(`
          INSERT INTO menu_item_modifiers (menu_item_id, modifier_id)
          VALUES (?, ?)
        `)

        for (const item of menu) {
          insertMenuItem.run(
            item.id,
            item.name?.lt || item.name_lt || item.name,
            item.name?.uk || item.name_uk || item.name,
            Number(item.price) || 0,
            item.category,
            item.image || null,
          )

          if (Array.isArray(item.modifiers)) {
            for (const modifier of item.modifiers) {
              insertModifier.run(
                modifier.id,
                modifier.name?.lt || modifier.name_lt || modifier.name,
                modifier.name?.uk || modifier.name_uk || modifier.name,
                Number(modifier.price) || 0,
                modifier.type,
                modifier.required ? 1 : 0,
              )
              linkModifier.run(item.id, modifier.id)
            }
          }
        }
      })

      transaction()
      return new Response(JSON.stringify({ success: true, count: body.menu.length }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Создание товара: { action: 'createMenuItem', ... }
    if (body && body.action === 'createMenuItem') {
      try {
        const { id, name, name_lt, name_uk, price, category, description, image, available, modifiers, modifierIds, is_fryer, cooking_time } = body
        const newId = id || `item_${Date.now()}_${Math.floor(Math.random() * 10000)}`
        
        const tx = db.transaction(() => {
          // Создаем товар
          const insertItem = db.prepare(`
            INSERT INTO menu_items (id, name_lt, name_uk, price, category, image, description, available, is_fryer, cooking_time)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
          
          insertItem.run(
            newId,
            name_lt || name || '',
            name_uk || name || '',
            parseFloat(price || '0') || 0,
            category || '',
            image || '',
            description || '',
            available ? 1 : 0,
            is_fryer ? 1 : 0,
            parseInt(cooking_time || '180') || 180
          )
          
          // Связываем с модификаторами
          if (Array.isArray(modifierIds) && modifierIds.length > 0) {
            const linkModifier = db.prepare(`
              INSERT OR IGNORE INTO menu_item_modifiers (menu_item_id, modifier_id)
              VALUES (?, ?)
            `)
            for (const modifierId of modifierIds) {
              if (typeof modifierId === 'string' && modifierId.trim()) {
                linkModifier.run(newId, modifierId)
              }
            }
          }
        })
        
        tx()
        
        return new Response(JSON.stringify({ success: true, id: newId }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' }
        })
      } catch (e: any) {
        console.error('[API] createMenuItem failed:', e)
        return new Response(JSON.stringify({ success: false, error: e?.message || 'Failed to create menu item' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    }

    // Обновление товара: { action: 'updateMenuItem', ... }
    if (body && body.action === 'updateMenuItem') {
      try {
        const { id, name, name_lt, name_uk, price, category, description, image, available, modifierIds, is_fryer, cooking_time } = body
        
        const tx = db.transaction(() => {
          // Обновляем товар
          const updateItem = db.prepare(`
            UPDATE menu_items 
            SET name_lt = ?, name_uk = ?, price = ?, category = ?, image = ?, description = ?, available = ?, is_fryer = ?, cooking_time = ?
            WHERE id = ?
          `)
          
          const result = updateItem.run(
            String(name_lt || name || ''),
            String(name_uk || name || ''),
            Number(parseFloat(String(price || '0')) || 0),
            String(category || ''),
            String(image || ''),
            String(description || ''),
            Number(available ? 1 : 0),
            Number(is_fryer ? 1 : 0),
            parseInt(cooking_time || '180') || 180,
            String(id)
          )
          
          if (result.changes === 0) {
            throw new Error('Menu item not found')
          }
          
          // Обновляем связи с модификаторами
          // Сначала удаляем все существующие связи
          db.prepare('DELETE FROM menu_item_modifiers WHERE menu_item_id = ?').run(String(id))
          
          // Затем добавляем новые связи
          if (Array.isArray(modifierIds) && modifierIds.length > 0) {
            const linkModifier = db.prepare(`
              INSERT OR IGNORE INTO menu_item_modifiers (menu_item_id, modifier_id)
              VALUES (?, ?)
            `)
            for (const modifierId of modifierIds) {
              if (typeof modifierId === 'string' && modifierId.trim()) {
                linkModifier.run(String(id), String(modifierId))
              }
            }
          }
        })
        
        tx()
        
        return new Response(JSON.stringify({ success: true, id }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      } catch (e: any) {
        console.error('[API] updateMenuItem failed:', e)
        return new Response(JSON.stringify({ success: false, error: e?.message || 'Failed to update menu item' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    }

    // Удаление товара: { action: 'deleteMenuItem', id }
    if (body && body.action === 'deleteMenuItem') {
      try {
        const { id } = body
        
        const tx = db.transaction(() => {
          db.prepare('DELETE FROM menu_item_modifiers WHERE menu_item_id = ?').run(id)
          db.prepare('DELETE FROM menu_items WHERE id = ?').run(id)
        })
        tx()
        
        return new Response(JSON.stringify({ success: true, id }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      } catch (e: any) {
        console.error('[API] deleteMenuItem failed:', e)
        return new Response(JSON.stringify({ success: false, error: e?.message || 'Failed to delete menu item' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    }

    // Создание модификатора: { action: 'createModifier', ... }
    if (body && body.action === 'createModifier') {
      try {
        const proposedId: string = (typeof body.id === 'string' && body.id.trim()) ? body.id.trim() : `md_${Date.now()}_${Math.floor(Math.random() * 10000)}`
        const name_lt: string = String(body.name_lt || body.name || '').trim()
        const name_uk: string = String(body.name_uk || body.name || '').trim()
        const price: number = typeof body.price === 'number' ? body.price : 0
        const typeRaw: string = String(body.type || 'addon').trim()
        const type: string = typeRaw || 'addon'
        const required: number = body.required ? 1 : 0
        const options = Array.isArray(body.options) ? body.options : []

        const modifierColumns = db.prepare("PRAGMA table_info(modifiers)").all() as any[]
        const hasGroupName = modifierColumns.some((c) => String(c.name) === 'group_name')
        const group_name: string = String(body.group_name || body.groupName || '').trim()

        if (!name_lt || !name_uk) {
          return new Response(JSON.stringify({ success: false, error: 'Invalid modifier data' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        const norm = (v: any) => String(v ?? '').trim().toLowerCase()
        const existingByName: any = hasGroupName
          ? db.prepare(
              `SELECT id FROM modifiers
               WHERE lower(name_uk) = ?
                 AND lower(name_lt) = ?
                 AND lower(type) = ?
                 AND lower(COALESCE(group_name, '')) = ?
               LIMIT 1`
            ).get(norm(name_uk), norm(name_lt), norm(type), norm(group_name))
          : db.prepare(
              `SELECT id FROM modifiers
               WHERE lower(name_uk) = ?
                 AND lower(name_lt) = ?
                 AND lower(type) = ?
               LIMIT 1`
            ).get(norm(name_uk), norm(name_lt), norm(type))

        const mid: string = existingByName && existingByName.id ? String(existingByName.id) : proposedId

        const upsertModifier = hasGroupName
          ? db.prepare(`
              INSERT OR REPLACE INTO modifiers (id, name_lt, name_uk, group_name, price, type, required)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `)
          : db.prepare(`
              INSERT OR REPLACE INTO modifiers (id, name_lt, name_uk, price, type, required)
              VALUES (?, ?, ?, ?, ?, ?)
            `)

        if (hasGroupName) {
          upsertModifier.run(mid, name_lt, name_uk, group_name || null, price, type, required)
        } else {
          upsertModifier.run(mid, name_lt, name_uk, price, type, required)
        }

        // Создаем таблицу modifier_options если её нет
        db.exec(`
          CREATE TABLE IF NOT EXISTS modifier_options (
            id TEXT PRIMARY KEY,
            modifier_id TEXT NOT NULL,
            name_lt TEXT NOT NULL,
            name_uk TEXT NOT NULL,
            price REAL DEFAULT 0,
            order_position INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (modifier_id) REFERENCES modifiers(id) ON DELETE CASCADE
          )
        `)

        // Перезапишем опции
        const delOpts = db.prepare(`DELETE FROM modifier_options WHERE modifier_id = ?`)
        const insOpt = db.prepare(`
          INSERT OR REPLACE INTO modifier_options (id, modifier_id, name_lt, name_uk, price, order_position)
          VALUES (?, ?, ?, ?, ?, ?)
        `)
        
        delOpts.run(mid)
        for (let i = 0; i < options.length; i++) {
          const o = options[i]
          const oid = (o && typeof o.id === 'string' && o.id.trim()) ? o.id.trim() : `mopt_${Date.now()}_${Math.floor(Math.random() * 10000)}`
          const oname_lt = String(o?.name_lt || o?.name?.lt || o?.name || '').trim() || 'Be pavadinimo'
          const oname_uk = String(o?.name_uk || o?.name?.uk || o?.name || '').trim() || 'Без названия'
          const oprice = typeof o?.price === 'number' ? o.price : 0
          const oorder = o?.order !== undefined ? o.order : i
          
          insOpt.run(oid, mid, oname_lt, oname_uk, oprice, oorder)
        }

        return new Response(JSON.stringify({ success: true, id: mid }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        })
      } catch (e: any) {
        console.error('[API] createModifier failed:', e)
        return new Response(JSON.stringify({ success: false, error: e?.message || 'Failed to create modifier' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    }

    // Обновление модификатора: { action: 'updateModifier', ... }
    if (body && body.action === 'updateModifier') {
      try {
        const { id, name_lt, name_uk, name, type, required, options } = body
        
        const updateModifier = db.prepare(`
          UPDATE modifiers 
          SET name_lt = ?, name_uk = ?, type = ?, required = ?
          WHERE id = ?
        `)
        
        const result = updateModifier.run(
          name_lt || name || '',
          name_uk || name || '',
          type || 'addon',
          required ? 1 : 0,
          id
        )
        
        if (result.changes === 0) {
          return new Response(JSON.stringify({ success: false, error: 'Modifier not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          })
        }
        
        // Обновляем опции
        if (Array.isArray(options)) {
          const delOpts = db.prepare(`DELETE FROM modifier_options WHERE modifier_id = ?`)
          const insOpt = db.prepare(`
            INSERT INTO modifier_options (id, modifier_id, name_lt, name_uk, price, order_position)
            VALUES (?, ?, ?, ?, ?, ?)
          `)
          
          delOpts.run(id)
          for (let i = 0; i < options.length; i++) {
            const option = options[i]
            const optId = option.id || `opt_${Date.now()}_${Math.floor(Math.random() * 10000)}`
            insOpt.run(
              optId, 
              id, 
              option.name_lt || option.name || '', 
              option.name_uk || option.name || '', 
              Number(option.price) || 0,
              option.order !== undefined ? option.order : i
            )
          }
        }
        return new Response(JSON.stringify({ success: true, id }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      } catch (e: any) {
        console.error('[API] updateModifier failed:', e)
        return new Response(JSON.stringify({ success: false, error: e?.message || 'Failed to update modifier' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    }

    // Удаление модификатора (мягкое удаление)
    if (body && body.action === 'softDeleteModifier') {
      try {
        const { id } = body
        const stmt = db.prepare(`UPDATE modifiers SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
        const result = stmt.run(id)
        
        return new Response(JSON.stringify({ 
          success: result.changes > 0, 
          message: result.changes > 0 ? 'Modifier hidden' : 'Modifier not found'
        }), {
          status: result.changes > 0 ? 200 : 404,
          headers: { 'Content-Type': 'application/json' },
        })
      } catch (e: any) {
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    }

    // Полное удаление модификатора
    if (body && body.action === 'deleteModifierLegacy') {
      try {
        const { id } = body
        const tx = db.transaction(() => {
          db.prepare('DELETE FROM modifier_options WHERE modifier_id = ?').run(id)
          db.prepare('DELETE FROM menu_item_modifiers WHERE modifier_id = ?').run(id)
          db.prepare('DELETE FROM modifiers WHERE id = ?').run(id)
        })
        tx()
        
        return new Response(JSON.stringify({ success: true, message: 'Modifier deleted' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      } catch (e: any) {
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    }

    // Изменение доступности модификатора
    if (body && body.action === 'toggleModifierAvailability') {
      try {
        const { id, is_available } = body
        const stmt = db.prepare(`UPDATE modifiers SET is_available = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
        const result = stmt.run(is_available ? 1 : 0, id)
        
        return new Response(JSON.stringify({ 
          success: result.changes > 0,
          is_available
        }), {
          status: result.changes > 0 ? 200 : 404,
          headers: { 'Content-Type': 'application/json' },
        })
      } catch (e: any) {
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    }

    // Вариант 2: одиночное создание блюда
    const { id, name_lt, name_uk, price, category, image, modifiers, modifierIds } = body || {}
    if (!name_lt || !name_uk || typeof price !== 'number' || !category) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid menu data' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const newId: string = (typeof id === 'string' && id.trim()) ? id.trim() : `mi_${Date.now()}_${Math.floor(Math.random() * 10000)}`

    const insertMenuItem = db.prepare(`
      INSERT INTO menu_items (id, name_lt, name_uk, price, category, image)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

    const tx = db.transaction(() => {
      // Убедимся, что связующая таблица есть
      ensureMenuItemModifiersTable(db)
      insertMenuItem.run(newId, name_lt, name_uk, Number(price) || 0, category, image || null)

      if (Array.isArray(modifiers) && modifiers.length > 0) {
        const upsertModifier = db.prepare(`
          INSERT OR IGNORE INTO modifiers (id, name_lt, name_uk, price, type, required)
          VALUES (?, ?, ?, ?, ?, ?)
        `)
        const linkModifier = db.prepare(`
          INSERT OR IGNORE INTO menu_item_modifiers (menu_item_id, modifier_id)
          VALUES (?, ?)
        `)

        for (const m of modifiers) {
          const mid = m?.id || `md_${Date.now()}_${Math.floor(Math.random() * 10000)}`
          const m_name_lt = m?.name_lt || m?.name?.lt || m?.name_uk || 'Be pavadinimo'
          const m_name_uk = m?.name_uk || m?.name?.uk || m?.name_lt || 'Без названия'
          const m_price = typeof m?.price === 'number' ? m.price : 0
          const m_type = m?.type || 'addon'
          const m_required = Boolean(m?.required)

          upsertModifier.run(mid, m_name_lt, m_name_uk, m_price, m_type, m_required ? 1 : 0)
          linkModifier.run(newId, mid)
        }
      } else if (Array.isArray(modifierIds) && modifierIds.length > 0) {
        // Связываем уже существующие модификаторы по ID
        const linkModifier = db.prepare(`
          INSERT OR IGNORE INTO menu_item_modifiers (menu_item_id, modifier_id)
          VALUES (?, ?)
        `)
        for (const mid of modifierIds) {
          if (typeof mid === 'string' && mid.trim()) {
            linkModifier.run(newId, String(mid))
          }
        }
      }
    })

    tx()

    // Invalidate cache by sending a message to clients
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const channel = new BroadcastChannel('menu-updates')
        channel.postMessage({ type: 'menu-updated' })
        channel.close()
      } catch (e) {
        console.warn('Could not notify clients of menu update:', e)
      }
    }

    return new Response(JSON.stringify({ success: true, id: newId }), {
      status: 201,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      },
    })
  } catch (error) {
    console.error('[API] Ошибка POST /api/menu:', error)
    return new Response(JSON.stringify({ success: false, error: 'Failed to save menu' }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      },
    })
  }
}