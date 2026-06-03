import { getDatabase } from '@/lib/database'

function isCancelStatus(status: string) {
  const s = String(status || '').toLowerCase()
  return s.includes('cancel') || s.includes('скасован') || s.includes('atšaukt')
}

function isKitchenStatus(status: string) {
  const s = String(status || '').toLowerCase()
  return (
    s.includes('prepar') ||
    s.includes('kitchen') ||
    s.includes('cook') ||
    s.includes('готов') ||
    s.includes('готу') ||
    s.includes('kuh') ||
    s.includes('virt') ||
    s.includes('ruoš') ||
    s.includes('make') ||
    s.includes('in progress')
  )
}

function ensureInventoryMovementsIdempotency(db: any) {
  try {
    const cols = db.prepare('PRAGMA table_info(inventory_movements)').all() as any[]
    const hasKey = cols.some((c: any) => String(c.name) === 'idempotency_key')
    if (!hasKey) {
      db.exec('ALTER TABLE inventory_movements ADD COLUMN idempotency_key TEXT')
    }
  } catch (e) {
    console.warn('[API] inventory_movements idempotency_key migration warning:', e)
  }

  try {
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_movements_idempotency_key ON inventory_movements(idempotency_key)')
  } catch (e) {
    console.warn('[API] inventory_movements idempotency index warning:', e)
  }
}

function deductInventoryForOrder(db: any, orderId: string, orderType: string, logPrefix: string) {
  ensureInventoryMovementsIdempotency(db)

  const getOrderItems = db.prepare(`
    SELECT id as order_item_id, menu_item_id, quantity
    FROM order_items
    WHERE order_id = ?
  `)

  const getModifiersForOrderItem = db.prepare(`
    SELECT modifier_id
    FROM order_item_modifiers
    WHERE order_item_id = ?
  `)

  const getRecipes = db.prepare(`
    SELECT ri.inventory_item_id, ri.quantity, ri.recipe_unit,
           ii.name_uk, ii.name_lt, ii.unit, ii.unit_weight, ii.current_stock
    FROM recipes r
    JOIN recipe_ingredients ri ON r.id = ri.recipe_id
    LEFT JOIN inventory_items ii ON ri.inventory_item_id = ii.id
    WHERE r.menu_item_id = ?
  `)

  const getModifierIngredients = db.prepare(`
    SELECT moi.inventory_item_id, moi.quantity, moi.unit as recipe_unit,
           ii.name_uk, ii.name_lt, ii.unit as stock_unit, ii.current_stock, ii.unit_weight
    FROM modifier_option_ingredients moi
    LEFT JOIN inventory_items ii ON moi.inventory_item_id = ii.id
    WHERE moi.modifier_option_id = ?
  `)

  const updateInventoryStock = db.prepare(`
    UPDATE inventory_items
    SET current_stock = current_stock - ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `)

  const insertInventoryMovementOut = db.prepare(`
    INSERT OR IGNORE INTO inventory_movements
    (inventory_item_id, movement_type, quantity, reason, reference_id, idempotency_key)
    VALUES (?, 'out', ?, 'Списание по заказу', ?, ?)
  `)

  const normalizeNumber = (v: any) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }

  const tryDeduct = (inventoryItemId: string, quantityInBaseUnits: number, key: string, extraReason: string) => {
    const qty = normalizeNumber(quantityInBaseUnits)
    if (qty <= 0) return

    const insertRes = insertInventoryMovementOut.run(String(inventoryItemId), String(qty), String(orderId), String(key))
    if ((insertRes as any)?.changes === 0) {
      console.log(`${logPrefix} ℹ️ Skip duplicate OUT movement key=${key}`)
      return
    }

    // Only decrease stock if movement was actually inserted
    updateInventoryStock.run(String(qty), String(inventoryItemId))
    if (extraReason) {
      console.log(`${logPrefix} ✅ OUT ${extraReason}: ${inventoryItemId} - ${qty}`)
    }
  }

  const orderItems = getOrderItems.all(String(orderId)) as any[]
  for (const oi of orderItems) {
    const orderItemId = String(oi.order_item_id)
    const menuItemId = String(oi.menu_item_id)
    const itemQty = normalizeNumber(oi.quantity) || 1

    // Deduct recipe ingredients
    try {
      const recipes = getRecipes.all(menuItemId) as any[]
      for (const recipe of recipes) {
        const recipeQuantity = normalizeNumber(recipe.quantity)
        const recipeUnit = String(recipe.recipe_unit || 'g')
        const stockUnit = String(recipe.unit || 'g')

        let quantityInBaseUnits = recipeQuantity * itemQty

        const isWeightItem = stockUnit === 'g' || stockUnit === 'kg' || stockUnit === 'l' || stockUnit === 'ml'
        const isPieceItem = stockUnit === 'pcs' || stockUnit === 'pack'

        if (isWeightItem) {
          if (recipeUnit === 'kg') {
            quantityInBaseUnits = recipeQuantity * itemQty * 1000
          } else if (recipeUnit === 'l') {
            quantityInBaseUnits = recipeQuantity * itemQty * 1000
          } else if (recipeUnit === 'g' || recipeUnit === 'ml') {
            quantityInBaseUnits = recipeQuantity * itemQty
          }
          if (stockUnit === 'kg' && recipeUnit === 'g') {
            quantityInBaseUnits = (recipeQuantity * itemQty) / 1000
          }
          if (stockUnit === 'l' && recipeUnit === 'ml') {
            quantityInBaseUnits = (recipeQuantity * itemQty) / 1000
          }
        } else if (isPieceItem) {
          quantityInBaseUnits = recipeQuantity * itemQty
        }

        const invId = String(recipe.inventory_item_id)
        const key = `out:${orderId}:oi:${orderItemId}:mi:${menuItemId}:inv:${invId}`
        tryDeduct(invId, quantityInBaseUnits, key, `recipe oi=${orderItemId}`)
      }
    } catch (e) {
      console.warn(`${logPrefix} ⚠️ Recipe deduction failed for menu_item_id=${menuItemId}:`, e)
    }

    // Deduct modifier ingredients
    try {
      const mods = getModifiersForOrderItem.all(orderItemId) as any[]
      for (const m of mods) {
        const modId = String(m.modifier_id)
        if (!modId) continue
        const ingredients = getModifierIngredients.all(modId) as any[]
        for (const ing of ingredients) {
          const recipeQuantity = normalizeNumber(ing.quantity)
          const recipeUnit = String(ing.recipe_unit || 'g')
          const stockUnit = String(ing.stock_unit || 'g')
          let quantityInBaseUnits = recipeQuantity * itemQty

          const isWeightItem = stockUnit === 'g' || stockUnit === 'kg' || stockUnit === 'l' || stockUnit === 'ml'
          const isPieceItem = stockUnit === 'pcs' || stockUnit === 'pack'

          if (isWeightItem) {
            if (recipeUnit === 'kg') {
              quantityInBaseUnits = recipeQuantity * itemQty * 1000
            } else if (recipeUnit === 'l') {
              quantityInBaseUnits = recipeQuantity * itemQty * 1000
            } else if (recipeUnit === 'g' || recipeUnit === 'ml') {
              quantityInBaseUnits = recipeQuantity * itemQty
            }
            if (stockUnit === 'kg' && recipeUnit === 'g') {
              quantityInBaseUnits = (recipeQuantity * itemQty) / 1000
            }
            if (stockUnit === 'l' && recipeUnit === 'ml') {
              quantityInBaseUnits = (recipeQuantity * itemQty) / 1000
            }
          } else if (isPieceItem) {
            quantityInBaseUnits = recipeQuantity * itemQty
          }

          const invId = String(ing.inventory_item_id)
          const key = `out:${orderId}:oi:${orderItemId}:mod:${modId}:inv:${invId}`
          tryDeduct(invId, quantityInBaseUnits, key, `modifier oi=${orderItemId}`)
        }
      }
    } catch (e) {
      console.warn(`${logPrefix} ⚠️ Modifier deduction failed for order_item_id=${orderItemId}:`, e)
    }
  }

  // Materials deduction depending on order type (bag/napkins/tray liner)
  try {
    const takeawayTypes = ['takeaway', 'з собою', 'на винос', 'išsinešti', 'to-go', 'delivery', 'доставка', 'pristatymas', 'wolt', 'bolt', 'telefonu', 'по телефону']
    const dineInTypes = ['dine-in', 'dine_in', 'в залі', 'в зале', 'в закладі', 'salėje', 'vietoje', 'in-house']
    const isTakeaway = takeawayTypes.some(t => String(orderType || '').toLowerCase().includes(t.toLowerCase()))
    const isDineIn = dineInTypes.some(t => String(orderType || '').toLowerCase().includes(t.toLowerCase()))

    const findItem = db.prepare(`
      SELECT id, current_stock, name_uk, name_lt
      FROM inventory_items
      WHERE name_uk LIKE ? COLLATE NOCASE OR name_lt LIKE ? COLLATE NOCASE
      LIMIT 1
    `)

    const deductByNames = (itemNames: string[], quantity: number, label: string) => {
      let item: any = null
      for (const itemName of itemNames) {
        const searchPattern = `%${String(itemName).toLowerCase()}%`
        item = findItem.get(searchPattern, searchPattern) as any
        if (item) break
      }
      if (!item) return
      const invId = String(item.id)
      const key = `out:${orderId}:mat:${label}:inv:${invId}`
      tryDeduct(invId, quantity, key, `material ${label}`)
    }

    if (isTakeaway) {
      deductByNames(['maiselis', 'maishelis', 'maišelis', 'paket', 'пакет', 'package', 'bag', 'упаковка', 'pakuote'], 1, 'bag')
      deductByNames(['serveteles', 'servetele', 'servetėlė', 'servetėlės', 'servetky', 'серветка', 'серветки', 'napkin', 'салфетка'], 1, 'napkin')
    } else if (isDineIn) {
      deductByNames(['padeklas', 'padėklas', 'padekliukas', 'pidkladka', 'підкладка', 'підкладка для підносу', 'tray liner', 'подложка', 'popierine'], 1, 'tray')
      deductByNames(['serveteles', 'servetele', 'servetėlė', 'servetėlės', 'servetky', 'серветка', 'серветки', 'napkin', 'салфетка'], 1, 'napkin')
    }
  } catch (e) {
    console.warn(`${logPrefix} ⚠️ Materials deduction failed:`, e)
  }
}

function returnInventoryForOrder(db: any, orderId: string, logPrefix: string) {
  const movements = db.prepare(
    `
      SELECT inventory_item_id, movement_type, quantity
      FROM inventory_movements
      WHERE (reference_id = ? OR reference_id = ?)
        AND movement_type IN ('out', 'in')
    `,
  ).all(String(orderId), orderId) as any[]

  if (!movements || movements.length === 0) {
    console.log(`${logPrefix} ℹ️ movements not found for order`, orderId)
    return
  }

  const netByItem = new Map<string, number>()
  for (const m of movements) {
    const itemId = String((m as any).inventory_item_id)
    const q = Number((m as any).quantity) || 0
    const sign = (m as any).movement_type === 'out' ? 1 : -1
    netByItem.set(itemId, (netByItem.get(itemId) || 0) + sign * q)
  }

  const itemsToReturn = Array.from(netByItem.entries()).filter(([, net]) => net > 0)
  if (itemsToReturn.length === 0) {
    console.log(`${logPrefix} ℹ️ inventory already returned (net <= 0) for order`, orderId)
    return
  }

  const returnToStock = db.prepare(
    `
      UPDATE inventory_items
      SET current_stock = current_stock + ?
      WHERE id = ?
    `,
  )

  const insertReturnMovement = db.prepare(
    `
      INSERT INTO inventory_movements
      (inventory_item_id, movement_type, quantity, reason, reference_id)
      VALUES (?, 'in', ?, ?, ?)
    `,
  )

  for (const [itemId, quantity] of itemsToReturn) {
    const currentItem = db
      .prepare(`SELECT name_uk, name_lt, current_stock FROM inventory_items WHERE id = ?`)
      .get(itemId) as any
    const beforeStock = currentItem ? currentItem.current_stock : 0

    returnToStock.run(quantity, itemId)
    insertReturnMovement.run(itemId, quantity, `Повернення через скасування замовлення #${orderId}`, String(orderId))

    const afterStock = beforeStock + quantity
    const itemName = currentItem ? currentItem.name_lt || currentItem.name_uk : itemId
    console.log(`${logPrefix} ✅ Returned: ${itemName} (${itemId}) - was: ${beforeStock}, now: ${afterStock}`)
  }
}

function ensureCancelledAtColumn(db: any) {
  try {
    db.exec('ALTER TABLE orders ADD COLUMN cancelled_at DATETIME')
  } catch {
    // already exists
  }
}

export async function GET(request: Request) {
  try {
    const db = getDatabase()

    // Убеждаемся, что поле comment существует в таблице order_items
    try {
      // Проверяем, существует ли поле comment
      const tableInfo = db.prepare("PRAGMA table_info(order_items)").all() as any[]
      const hasCommentField = tableInfo.some(column => column.name === 'comment')
      
      if (!hasCommentField) {
        db.exec(`ALTER TABLE order_items ADD COLUMN comment TEXT DEFAULT ''`)
        console.log('[API] Добавлено поле comment в таблицу order_items')
      }
    } catch (error) {
      console.error('[API] Ошибка при добавлении поля comment:', error)
    }

    // Добавляем колонки для скидки сотрудника если их нет
    try {
      const ordersTableInfo = db.prepare('PRAGMA table_info(orders)').all() as any[]
      const ordersColumns = ordersTableInfo.map((col: any) => col.name)
      
      if (!ordersColumns.includes('employee_discount_id')) {
        db.prepare('ALTER TABLE orders ADD COLUMN employee_discount_id INTEGER').run()
      }
      if (!ordersColumns.includes('employee_discount_name')) {
        db.prepare('ALTER TABLE orders ADD COLUMN employee_discount_name TEXT').run()
      }
      if (!ordersColumns.includes('employee_discount_percent')) {
        db.prepare('ALTER TABLE orders ADD COLUMN employee_discount_percent INTEGER').run()
      }
      if (!ordersColumns.includes('employee_discount_amount')) {
        db.prepare('ALTER TABLE orders ADD COLUMN employee_discount_amount REAL').run()
      }
    } catch (migrationError) {
      console.error('[API GET] ⚠️ Ошибка миграции orders:', migrationError)
      // Продолжаем работу даже если миграция не удалась
    }

    // Получаем параметры фильтрации из URL
    const url = new URL(request.url)
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')
    const isHistoryRequest = url.searchParams.get('history') === '1' || !!from || !!to

    // Проверяем какие колонки доступны для безопасного SELECT
    const ordersTableInfo = db.prepare('PRAGMA table_info(orders)').all() as any[]
    const availableColumns = ordersTableInfo.map((col: any) => col.name)
    
    const hasDiscountColumns = 
      availableColumns.includes('employee_discount_id') &&
      availableColumns.includes('employee_discount_name') &&
      availableColumns.includes('employee_discount_percent') &&
      availableColumns.includes('employee_discount_amount')

    const hasDailyNumberColumns =
      availableColumns.includes('business_date') &&
      availableColumns.includes('daily_number')

    const conditions: string[] = []
    const params: any[] = []

    if (!isHistoryRequest) {
      conditions.push(`o.status NOT IN ('completed','cancelled','delivered')`)
    }
    if (from) {
      conditions.push('o.created_at >= ?')
      params.push(from)
    }
    if (to) {
      conditions.push('o.created_at < ?')
      params.push(to)
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    let query = `
      SELECT 
        o.id,
        ${hasDailyNumberColumns ? 'o.business_date,' : ''}
        ${hasDailyNumberColumns ? 'o.daily_number,' : ''}
        o.total,
        o.order_type,
        o.status,
        o.table_number,
        o.customer_name,
        o.phone_number,
        o.estimated_time,
        o.is_preorder,
        o.preorder_time,
        ${hasDiscountColumns ? 'o.employee_discount_id,' : ''}
        ${hasDiscountColumns ? 'o.employee_discount_name,' : ''}
        ${hasDiscountColumns ? 'o.employee_discount_percent,' : ''}
        ${hasDiscountColumns ? 'o.employee_discount_amount,' : ''}
        o.created_at,
        o.updated_at
      FROM orders o
      ${whereClause}
    `
    
    query += ` ORDER BY o.created_at DESC LIMIT 1000`

    // ОПТИМІЗОВАНО: Отримуємо всі дані одним JOIN запитом замість циклів
    let ordersData: any[] = []
    try {
      // Один запит для отримання всіх замовлень з позиціями та модифікаторами
      const joinQuery = `
        SELECT 
          o.id as order_id,
          ${hasDailyNumberColumns ? 'o.business_date,' : ''}
          ${hasDailyNumberColumns ? 'o.daily_number,' : ''}
          o.total,
          o.order_type,
          o.status,
          o.table_number,
          o.customer_name,
          o.phone_number,
          o.estimated_time,
          o.is_preorder,
          o.preorder_time,
          ${hasDiscountColumns ? 'o.employee_discount_id,' : ''}
          ${hasDiscountColumns ? 'o.employee_discount_name,' : ''}
          ${hasDiscountColumns ? 'o.employee_discount_percent,' : ''}
          ${hasDiscountColumns ? 'o.employee_discount_amount,' : ''}
          o.created_at,
          o.updated_at,
          oi.id as item_id,
          oi.menu_item_id,
          oi.quantity,
          oi.price,
          oi.original_price,
          oi.happy_hour_discount,
          COALESCE(oi.comment, '') as comment,
          mi.name_lt as item_name_lt,
          mi.name_uk as item_name_uk,
          mi.category,
          m.id as mod_id,
          m.name_lt as mod_name_lt,
          m.name_uk as mod_name_uk,
          m.group_name as mod_group_name,
          oim.price as mod_price,
          m.type as mod_type
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
        LEFT JOIN order_item_modifiers oim ON oi.id = oim.order_item_id
        LEFT JOIN modifiers m ON oim.modifier_id = m.id
      `
      
      let finalQuery = joinQuery
      if (whereClause) {
        finalQuery += ` ${whereClause}`
      }
      finalQuery += ` ORDER BY o.created_at DESC, oi.id, m.id`

      ordersData = db.prepare(finalQuery).all(...params) as any[]
      console.log(`[API GET] Отримано ${ordersData.length} рядків даних одним запитом`)
    } catch (queryError) {
      console.error('[API GET] Ошибка выполнения JOIN запроса:', queryError)
      throw queryError
    }

    // Групуємо дані в структуру замовлень з позиціями та модифікаторами
    const ordersMap = new Map<number, any>()
    const itemsMap = new Map<string, any>()
    
    ordersData.forEach((row: any) => {
      const orderId = row.order_id
      
      // Створюємо замовлення якщо ще не існує
      if (!ordersMap.has(orderId)) {
        ordersMap.set(orderId, {
          id: orderId,
          ...(hasDailyNumberColumns ? { business_date: row.business_date, daily_number: row.daily_number } : {}),
          total: row.total,
          order_type: row.order_type,
          status: row.status,
          table_number: row.table_number,
          customer_name: row.customer_name,
          phone_number: row.phone_number,
          estimated_time: row.estimated_time,
          is_preorder: row.is_preorder,
          preorder_time: row.preorder_time,
          ...(hasDiscountColumns ? {
            employee_discount_id: row.employee_discount_id,
            employee_discount_name: row.employee_discount_name,
            employee_discount_percent: row.employee_discount_percent,
            employee_discount_amount: row.employee_discount_amount,
          } : {}),
          created_at: row.created_at,
          updated_at: row.updated_at,
          items: []
        })
      }
      
      // Додаємо позицію якщо є
      if (row.item_id) {
        const itemKey = `${orderId}_${row.item_id}`
        
        if (!itemsMap.has(itemKey)) {
          const item = {
            id: row.menu_item_id,
            order_item_id: row.item_id,
            name: row.item_name_uk,
            name_lt: row.item_name_lt,
            name_uk: row.item_name_uk,
            quantity: row.quantity,
            price: row.price,
            original_price: row.original_price,
            happy_hour_discount: row.happy_hour_discount,
            category: row.category,
            comment: row.comment || '',
            modifiers: []
          }
          itemsMap.set(itemKey, item)
          ordersMap.get(orderId)!.items.push(item)
        }
        
        // Додаємо модифікатор якщо є
        if (row.mod_id) {
          const item = itemsMap.get(itemKey)!
          // Перевіряємо чи модифікатор вже доданий
          if (!item.modifiers.some((m: any) => m.id === row.mod_id)) {
            item.modifiers.push({
              id: row.mod_id,
              name: row.mod_name_uk,
              name_lt: row.mod_name_lt,
              name_uk: row.mod_name_uk,
              group_name: row.mod_group_name,
              price: row.mod_price,
              type: row.mod_type
            })
          }
        }
      }
    })
    
    const ordersWithItems = Array.from(ordersMap.values())
    console.log(`[API GET] Сформовано ${ordersWithItems.length} замовлень`)

    return new Response(JSON.stringify({ orders: ordersWithItems }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60'
      }
    })
  } catch (error) {
    console.error("[v0] Ошибка получения заказов:", error)
    console.error("[v0] Stack trace:", error instanceof Error ? error.stack : 'No stack trace')
    return new Response(JSON.stringify({ 
      error: "Failed to get orders", 
      details: error instanceof Error ? error.message : String(error) 
    }), { 
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    // Body received
    
    const { order, orderId } = body as { order: any; orderId?: string }
    if (!order) {
      console.error('[API] No order data provided')
      return Response.json({ success: false, error: 'No order data provided' }, { status: 400 })
    }
    
    const db = getDatabase()

    // Убеждаемся, что поле comment существует в таблице order_items
    try {
      // Проверяем, существует ли поле comment
      const tableInfo = db.prepare("PRAGMA table_info(order_items)").all() as any[]
      const hasCommentField = tableInfo.some(column => column.name === 'comment')
      
      if (!hasCommentField) {
        db.exec(`ALTER TABLE order_items ADD COLUMN comment TEXT DEFAULT ''`)
        console.log('[API] Добавлено поле comment в таблицу order_items')
      }
    } catch (error) {
      console.error('[API] Ошибка при добавлении поля comment:', error)
    }

    if (order) {
      let newOrderId: string | number | bigint | null = null

      // Добавляем колонки для скидки если их нет (миграция)
      try {
        const tableInfo = db.prepare('PRAGMA table_info(orders)').all() as any[]
        const columns = tableInfo.map(col => col.name)
        
        if (!columns.includes('employee_discount_id')) {
          db.prepare('ALTER TABLE orders ADD COLUMN employee_discount_id INTEGER').run()
          console.log('✅ Добавлена колонка employee_discount_id')
        }
        if (!columns.includes('employee_discount_name')) {
          db.prepare('ALTER TABLE orders ADD COLUMN employee_discount_name TEXT').run()
          console.log('✅ Добавлена колонка employee_discount_name')
        }
        if (!columns.includes('employee_discount_percent')) {
          db.prepare('ALTER TABLE orders ADD COLUMN employee_discount_percent INTEGER').run()
          console.log('✅ Добавлена колонка employee_discount_percent')
        }
        if (!columns.includes('employee_discount_amount')) {
          db.prepare('ALTER TABLE orders ADD COLUMN employee_discount_amount REAL').run()
          console.log('✅ Добавлена колонка employee_discount_amount')
        }
      } catch (migrationError) {
        console.error('⚠️ Ошибка миграции orders (возможно колонки уже существуют):', migrationError)
      }

      // Добавляем колонки для скидок счастливых часов в order_items
      try {
        const itemsTableInfo = db.prepare('PRAGMA table_info(order_items)').all() as any[]
        const itemsColumns = itemsTableInfo.map(col => col.name)
        
        if (!itemsColumns.includes('original_price')) {
          db.prepare('ALTER TABLE order_items ADD COLUMN original_price REAL').run()
          console.log('✅ Добавлена колонка original_price в order_items')
        }
        if (!itemsColumns.includes('happy_hour_discount')) {
          db.prepare('ALTER TABLE order_items ADD COLUMN happy_hour_discount INTEGER DEFAULT 0').run()
          console.log('✅ Добавлена колонка happy_hour_discount в order_items')
        }
      } catch (migrationError) {
        console.error('⚠️ Ошибка миграции order_items:', migrationError)
      }

      try {
        const tableInfo = db.prepare('PRAGMA table_info(orders)').all() as any[]
        const columns = tableInfo.map(col => col.name)

        if (!columns.includes('total_client')) {
          db.prepare('ALTER TABLE orders ADD COLUMN total_client REAL').run()
        }
        if (!columns.includes('total_computed')) {
          db.prepare('ALTER TABLE orders ADD COLUMN total_computed REAL').run()
        }

        if (!columns.includes('business_date')) {
          db.prepare('ALTER TABLE orders ADD COLUMN business_date TEXT').run()
        }
        if (!columns.includes('daily_number')) {
          db.prepare('ALTER TABLE orders ADD COLUMN daily_number TEXT').run()
        }
      } catch (migrationError) {
        console.error('⚠️ Ошибка миграции orders totals:', migrationError)
      }

      const transaction = db.transaction(() => {
        // Starting transaction
        
        const employeeDiscount = (order as any).employee_discount
        
        // Сумма заказа из запроса - використовуємо її замість перерахунку
        const incomingTotal = Number(order.total) || 0
        const orderType = order.orderType || order.order_type || 'dine-in'
        const status = order.status || 'new'
        const tableNumber = (order.tableNumber || order.table_number || '').toString()
        const customerName = (order.customerName || order.customer_name || '').toString()
        const phoneNumber = (order.phoneNumber || order.phone_number || '').toString()
        const estimatedTimeNum = Number(order.estimatedTime || order.estimated_time || 10)
        const isPreorderNum = Number((order as any).is_preorder) ? 1 : 0
        const preorderTime = (order as any).preorder_time ? String((order as any).preorder_time) : null

        const getHappyHoursDayColumn = () => {
          try {
            const cols = db.prepare('PRAGMA table_info(happy_hours)').all() as any[]
            const hasDaysOfWeek = cols.some((c: any) => String(c.name) === 'days_of_week')
            return hasDaysOfWeek ? 'days_of_week' : 'day_of_week'
          } catch {
            return 'day_of_week'
          }
        }

        const dayColumn = getHappyHoursDayColumn()

        const getHappyHourDiscountPercent = (itemId: string, categoryId: string) => {
          try {
            const now = new Date()
            const dayOfWeek = now.getDay()
            const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
            const rows = db
              .prepare(
                `
                SELECT item_id, category_id, discount_percent, start_time, end_time, ${dayColumn} as day_of_week
                FROM happy_hours
                WHERE active = 1
              `
              )
              .all() as any[]

            let maxDiscount = 0
            for (const hh of rows) {
              const hhItemIdStr = String(hh?.item_id ?? '')
              const hhCategoryIdStr = String(hh?.category_id ?? '')
              const hhDay = hh?.day_of_week !== undefined && hh?.day_of_week !== null ? Number(hh.day_of_week) : null

              if (hhDay !== null && hhDay !== 7 && hhDay !== dayOfWeek) {
                continue
              }

              if (hh?.start_time && hh?.end_time) {
                if (currentTime < hh.start_time || currentTime > hh.end_time) {
                  continue
                }
              }

              if (hhItemIdStr && hhItemIdStr !== itemId) {
                continue
              }
              if (hhCategoryIdStr && hhCategoryIdStr !== categoryId) {
                continue
              }

              const pct = Number(hh?.discount_percent) || 0
              if (pct > maxDiscount) {
                maxDiscount = pct
              }
            }

            return maxDiscount
          } catch {
            return 0
          }
        }

        const selectMenuItem = db.prepare(`SELECT id, price, category FROM menu_items WHERE id = ?`)
        const selectModifier = db.prepare(`SELECT id, price FROM modifiers WHERE id = ?`)

        // Готуємо список позицій для вставки (всі, що прийшли з фронту)
        let itemsForInsert: any[] = ((order as any).items || []).map((it: any) => ({
          id: it.id,
          quantity: it.quantity || 1,
          price: Number(it.price) || 0,
          comment: it.comment || '',
          original_price: it.original_price ?? it.price ?? 0,
          happy_hour_discount: it.happy_hour_discount ?? 0,
          comboData: it.combo_data ? JSON.parse(it.combo_data) : undefined,
          modifiers: (it.modifiers || it.selectedModifiers || []).map((mod: any) => ({
            id: mod.id,
            name_lt: mod.name_lt || mod.name?.lt || mod.name || '',
            name_uk: mod.name_uk || mod.name?.uk || mod.name || '',
            price: mod.price || 0,
            group_name: mod.group_name || mod.groupName || '',
            type: mod.type || 'addon',
            required: mod.required || 0,
          }))
        }))

        const computedSubtotal = itemsForInsert.reduce((sum, it) => {
          const qty = Number(it.quantity) || 0
          const itemIdStr = String(it.id)
          const menuRow = selectMenuItem.get(itemIdStr) as any

          const serverMenuPrice = menuRow ? Number(menuRow.price) || 0 : 0
          const categoryId = menuRow ? String(menuRow.category ?? '') : String((it as any).category ?? '')

          const hhDiscountPercent = getHappyHourDiscountPercent(itemIdStr, categoryId)
          const serverBasePrice = hhDiscountPercent > 0
            ? serverMenuPrice * (1 - hhDiscountPercent / 100)
            : serverMenuPrice

          const mods = Array.isArray(it.modifiers)
            ? it.modifiers.reduce((ms: number, m: any) => {
                const modIdStr = String(m?.id ?? '')
                if (!modIdStr) return ms
                const modRow = selectModifier.get(modIdStr) as any
                const serverModPrice = modRow ? Number(modRow.price) || 0 : 0
                return ms + serverModPrice
              }, 0)
            : 0

          // Fallback safety: if menu item is missing in DB, keep client price but treat it as suspicious
          const baseToUse = menuRow ? serverBasePrice : Number(it.price) || 0
          return sum + (baseToUse + mods) * qty
        }, 0)

        const employeeDiscountPercent = Number(employeeDiscount?.discount_percent) || 0
        const employeeDiscountAmountFromClient = Number(employeeDiscount?.discount_amount) || 0
        const employeeDiscountAmount = employeeDiscountPercent > 0
          ? Math.round((computedSubtotal * (employeeDiscountPercent / 100)) * 100) / 100
          : employeeDiscountAmountFromClient

        const computedTotalRaw = computedSubtotal - employeeDiscountAmount
        const computedTotal = Math.max(0, Math.round(computedTotalRaw * 100) / 100)

        const mismatch = Math.abs((incomingTotal || 0) - computedTotal)
        if (mismatch > 2) {
          const strict = String(process.env.STRICT_TOTAL_VALIDATION || '').toLowerCase() === '1'
          const msg = `Total mismatch: client=${incomingTotal} computed=${computedTotal}`
          if (strict) {
            throw new Error(msg)
          }
          console.warn('[API] ⚠️ ' + msg)
        }

        // Якщо передано orderId - оновлюємо існуюче замовлення
        // Беремо надісланий список і додаємо старі позиції, яких нема в надісланому (на випадок якщо фронт не підхопив старі)
        // Використовуємо суму з фронтенду - вона вже враховує всі фактори (упаковку, знижки тощо)
        let totalNum = computedTotal
        if (orderId) {
          console.log('[API] Оновлення існуючого замовлення:', orderId)

          if (isCancelStatus(status)) {
            const before = db.prepare('SELECT status FROM orders WHERE id = ?').get(orderId) as any
            if (before?.status && !isCancelStatus(String(before.status))) {
              returnInventoryForOrder(db, String(orderId), '[API POST Cancel]')
            }
          }
          
          // Отримуємо існуючі позиції разом з модифікаторами та інформацією про страву
          const existingRows = db.prepare(`
            SELECT 
              oi.id as order_item_id,
              oi.menu_item_id as id, 
              oi.quantity, oi.price, oi.comment, oi.original_price, oi.happy_hour_discount, oi.combo_data,
              mi.name_lt as item_name_lt, mi.name_uk as item_name_uk, mi.category as item_category,
              m.id as mod_id, m.name_lt, m.name_uk, m.group_name, m.price as mod_price, m.type, m.required
            FROM order_items oi
            LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
            LEFT JOIN order_item_modifiers oim ON oi.id = oim.order_item_id
            LEFT JOIN modifiers m ON m.id = oim.modifier_id
            WHERE oi.order_id = ?
          `).all(orderId) as any[]

          const existingItemsMap = new Map<string, any>()
          existingRows.forEach(row => {
            const key = `${row.order_item_id}`
            if (!existingItemsMap.has(key)) {
              existingItemsMap.set(key, {
                id: row.id,
                name: row.item_name_uk || row.item_name_lt || 'Без названия',
                name_uk: row.item_name_uk || 'Без названия',
                name_lt: row.item_name_lt || 'Be pavadinimo',
                category: row.item_category || '',
                quantity: row.quantity,
                price: row.price,
                comment: row.comment,
                original_price: row.original_price ?? row.price,
                happy_hour_discount: row.happy_hour_discount ?? 0,
                comboData: row.combo_data ? JSON.parse(row.combo_data) : undefined,
                modifiers: [] as any[]
              })
            }
            if (row.mod_id) {
              existingItemsMap.get(key).modifiers.push({
                id: row.mod_id,
                name_lt: row.name_lt,
                name_uk: row.name_uk,
                price: row.mod_price || 0,
                group_name: row.group_name || '',
                type: row.type || 'addon',
                required: row.required || 0,
              })
            }
          })
          const existingItems = Array.from(existingItemsMap.values())

          // Створюємо ключі для надісланих позицій, щоб не дублювати
          const makeKey = (it: any) => `${it.id}|${it.comment || ''}|${it.price}|${JSON.stringify((it.modifiers || []).map((m: any) => m.id))}|${it.combo_data ? JSON.stringify(it.combo_data) : ''}`
          const incomingKeys = new Set(itemsForInsert.map(makeKey))

          // Додаємо ті старі позиції, яких немає в надісланих (підстраховка)
          const missingOld = existingItems.filter(it => !incomingKeys.has(makeKey(it)))
          if (missingOld.length > 0) {
            console.log(`[API] Додаємо ${missingOld.length} старих позицій до дозамовлення`)
            itemsForInsert = [...itemsForInsert, ...missingOld]
          }
          console.log(`[API] Всього позицій для збереження: ${itemsForInsert.length}`)
          // Зберігаємо суму з фронтенду - вона вже враховує всі фактори (упаковку, знижки тощо)

          // Видаляємо старі позиції та їх модифікатори
          db.prepare('DELETE FROM order_item_modifiers WHERE order_item_id IN (SELECT id FROM order_items WHERE order_id = ?)').run(orderId)
          db.prepare('DELETE FROM order_items WHERE order_id = ?').run(orderId)

          // Оновлюємо дані замовлення
          const updateOrder = db.prepare(`
            UPDATE orders 
            SET total = ?, order_type = ?, customer_name = ?, phone_number = ?,
                is_preorder = ?, preorder_time = ?,
                employee_discount_id = ?, employee_discount_name = ?, 
                employee_discount_percent = ?, employee_discount_amount = ?,
                total_client = ?, total_computed = ?,
                updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')
            WHERE id = ?
          `)
          
          updateOrder.run(
            String(totalNum),
            String(orderType),
            String(customerName),
            String(phoneNumber),
            String(isPreorderNum),
            preorderTime,
            employeeDiscount ? employeeDiscount.employee_id : null,
            employeeDiscount ? employeeDiscount.employee_name : null,
            employeeDiscount ? employeeDiscount.discount_percent : null,
            employeeDiscount ? employeeDiscount.discount_amount : null,
            String(incomingTotal),
            String(computedTotal),
            orderId
          )
          
          newOrderId = String(orderId)
        } else {
          // Створюємо нове замовлення
          const businessDate = new Date().toISOString().split('T')[0]
          const row = db
            .prepare(`SELECT COALESCE(MAX(CAST(daily_number AS INTEGER)), 0) as m FROM orders WHERE business_date = ?`)
            .get(businessDate) as any
          const nextDailyNumber = String((Number(row?.m) || 0) + 1).padStart(3, '0')

          const insertOrder = db.prepare(`
            INSERT INTO orders (
              total, order_type, status, table_number, customer_name, phone_number,
              estimated_time, created_at, updated_at, is_preorder, preorder_time,
              employee_discount_id, employee_discount_name, employee_discount_percent, employee_discount_amount,
              total_client, total_computed,
              business_date, daily_number
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, STRFTIME('%Y-%m-%dT%H:%M:%fZ','now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)

          const res = insertOrder.run(
            String(totalNum),
            String(orderType),
            String(status),
            String(tableNumber),
            String(customerName),
            String(phoneNumber),
            String(estimatedTimeNum),
            String(((order as any).timestamp ? new Date((order as any).timestamp) : new Date()).toISOString()),
            String(isPreorderNum),
            preorderTime,
            employeeDiscount ? employeeDiscount.employee_id : null,
            employeeDiscount ? employeeDiscount.employee_name : null,
            employeeDiscount ? employeeDiscount.discount_percent : null,
            employeeDiscount ? employeeDiscount.discount_amount : null,
            String(incomingTotal),
            String(computedTotal),
            String(businessDate),
            String(nextDailyNumber)
          )
          newOrderId = res.lastInsertRowid
        }
        
        // Order inserted or updated
        if (!newOrderId) {
          throw new Error('Не удалось получить ID заказа.')
        }

        const insertOrderItem = db.prepare(`
          INSERT INTO order_items (order_id, menu_item_id, quantity, price, comment, original_price, happy_hour_discount, combo_data)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
        
        // Prepare statements for inventory deduction (updated for new recipe structure)
        const getRecipes = db.prepare(`
          SELECT ri.inventory_item_id, ri.quantity, ri.recipe_unit, 
                 ii.name_uk, ii.name_lt, ii.unit, ii.unit_weight
          FROM recipes r
          JOIN recipe_ingredients ri ON r.id = ri.recipe_id
          LEFT JOIN inventory_items ii ON ri.inventory_item_id = ii.id
          WHERE r.menu_item_id = ?
        `)
        
        // Також перевіряем полуфабрикаты (они теж зберігаються в inventory_items)
        const checkInventoryItem = db.prepare(`
          SELECT current_stock, name_uk, name_lt FROM inventory_items WHERE id = ?
        `)
        const updateInventoryStock = db.prepare(`
          UPDATE inventory_items 
          SET current_stock = current_stock - ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `)
        const insertInventoryMovement = db.prepare(`
          INSERT INTO inventory_movements 
          (inventory_item_id, movement_type, quantity, reason, reference_id)
          VALUES (?, 'out', ?, ?, ?)
        `)
        const checkModifier = db.prepare(`SELECT id, group_name FROM modifiers WHERE id = ?`)
        const insertModifier = db.prepare(`
          INSERT INTO modifiers (id, name_lt, name_uk, group_name, price, type, required)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
        const updateModifierWithoutGroup = db.prepare(`
          UPDATE modifiers 
          SET name_lt = ?, name_uk = ?, price = ?, type = ?, required = ?
          WHERE id = ? AND (group_name IS NULL OR group_name = '')
        `)
        const insertOrderItemModifier = db.prepare(`
          INSERT INTO order_item_modifiers (order_item_id, modifier_id, price)
          VALUES (?, ?, ?)
        `)

        const findMenuItemById = db.prepare(`SELECT id FROM menu_items WHERE id = ?`)
        const insertMenuItem = db.prepare(`
          INSERT INTO menu_items (id, name_lt, name_uk, price, category)
          VALUES (?, ?, ?, ?, ?)
        `)

        // Ensure category exists in database
        const findCategoryById = db.prepare(`SELECT id FROM categories WHERE id = ?`)
        const insertCategory = db.prepare(`
          INSERT OR IGNORE INTO categories (id, name_lt, name_uk) 
          VALUES (?, ?, ?)
        `)
        
        function ensureCategoryExists(categoryId: string): string {
          if (!categoryId) return 'cat_other'
          
          const existingCategory = findCategoryById.get(categoryId)
          if (!existingCategory) {
            // Create category if it doesn't exist
            const categoryName = 'Інше'
            insertCategory.run(categoryId, categoryName, categoryName)
            console.log('[v0] Створено нову категорію:', { id: categoryId, name: categoryName })
          }
          return categoryId
        }

        if (itemsForInsert && Array.isArray(itemsForInsert)) {
          // Processing order items (включаючи старі при дозамовленні)
          for (const item of itemsForInsert) {
            // Processing item
            console.log('[API] Обработка блюда:', (item as any).id, '| Количество:', (item as any).quantity)
            let menuItem = findMenuItemById.get((item as any).id)
            
            // If menu item doesn't exist, create it first
            if (!menuItem) {
              const genId = item?.id && typeof item.id === 'string' ? item.id : `mi_${Date.now()}_${Math.floor(Math.random()*10000)}`
              const name_uk = typeof item.name === 'string' ? item.name : (item?.name_uk || 'Без названия')
              const name_lt = (item as any)?.name_lt || name_uk
              const categoryId = ensureCategoryExists((item as any)?.category)
              try {
                insertMenuItem.run(String(genId), String(name_lt), String(name_uk), String(item.price), String(categoryId))
                console.log('[v0] Создано новое блюдо в меню:', { id: genId, name_uk, price: item.price, categoryId })
                menuItem = { id: genId }
              } catch (createErr) {
                console.error('[v0] Не удалось создать блюдо в меню:', createErr)
                continue // Skip this item if we can't create it
              }
            }
            
            if (menuItem) {
              const originalPrice = (item as any).original_price || (item as any).price
              const happyHourDiscount = (item as any).happy_hour_discount || 0
              
              const orderItemResult = insertOrderItem.run(
                String(newOrderId), 
                String((menuItem as any).id), 
                String((item as any).quantity), 
                String((item as any).price), 
                String((item as any).comment || ''),
                String(originalPrice),
                String(happyHourDiscount),
                (item as any).comboData ? JSON.stringify((item as any).comboData) : null
              )
              const orderItemId = orderItemResult.lastInsertRowid

              // Automatic ingredient deduction (updated for new recipe structure)
              // ВАЖЛИВО: ВАРІАНТ 1 — списання інгредієнтів робимо ТІЛЬКИ при переході в "кухонний" статус (через PUT)
              const shouldDeductIngredients = false
              
              if (!shouldDeductIngredients) {
                console.log(`[API] ℹ️ Variant 1: skipping inventory deduction in POST (status: "${status}")`)
              }
              
              try {
                const recipes = shouldDeductIngredients ? getRecipes.all((menuItem as any).id) : []
                if (shouldDeductIngredients && recipes.length > 0) {
                  console.log('[API] Рецепты для блюда', (menuItem as any).id, ':', recipes.length, 'ингредиентов')
                }
                
                // Собираем список модификаторов "без" для этого товара
                const excludedIngredients = new Set<string>()
                if (item.modifiers && Array.isArray(item.modifiers)) {
                  for (const m of item.modifiers) {
                    const modName = ((m as any)?.name_uk || (m as any)?.name_lt || m?.name || '').toLowerCase()
                    // Проверяем, начинается ли с "без" или "be" (литовский)
                    if (modName.startsWith('без ') || modName.startsWith('be ')) {
                      // Извлекаем название ингредиента после "без" или "be"
                      const ingredientName = modName.replace(/^(без|be)\s+/i, '').trim()
                      excludedIngredients.add(ingredientName)
                      // Ingredient excluded by modifier
                    }
                  }
                }
                
                for (const recipe of recipes) {
                  const recipeQuantity = (recipe as any).quantity
                  const recipeUnit = (recipe as any).recipe_unit || 'g'
                  const stockUnit = (recipe as any).unit || 'g'
                  
                  // ПРАВИЛО: Склад завжди зберігає в базових одиницях:
                  // - Вагові товари → грами (g)
                  // - Штучні товари → штуки (pcs)
                  // Рецепт може використовувати будь-які одиниці, але списання завжди в базових
                  
                  // Конвертуємо кількість з рецепту в базові одиниці складу
                  let quantityInBaseUnits = recipeQuantity * (item as any).quantity
                  
                  // Визначаємо базову одиницю товару на складі
                  const isWeightItem = stockUnit === 'g' || stockUnit === 'kg' || stockUnit === 'l' || stockUnit === 'ml'
                  const isPieceItem = stockUnit === 'pcs' || stockUnit === 'pack'
                  
                  if (isWeightItem) {
                    // Вагові товари: склад в грамах, рецепт може бути в г/кг/л/мл
                    if (recipeUnit === 'kg') {
                      quantityInBaseUnits = (recipeQuantity * (item as any).quantity) * 1000 // кг → г
                    } else if (recipeUnit === 'l') {
                      quantityInBaseUnits = (recipeQuantity * (item as any).quantity) * 1000 // л → мл (якщо склад в мл)
                    } else if (recipeUnit === 'g' || recipeUnit === 'ml') {
                      quantityInBaseUnits = recipeQuantity * (item as any).quantity // вже в базових
                    }
                    // Якщо склад в кг, а рецепт в г - конвертуємо
                    if (stockUnit === 'kg' && recipeUnit === 'g') {
                      quantityInBaseUnits = (recipeQuantity * (item as any).quantity) / 1000
                    }
                    // Якщо склад в л, а рецепт в мл - конвертуємо
                    if (stockUnit === 'l' && recipeUnit === 'ml') {
                      quantityInBaseUnits = (recipeQuantity * (item as any).quantity) / 1000
                    }
                  } else if (isPieceItem) {
                    // Штучні товари: склад в штуках, рецепт завжди в штуках
                    quantityInBaseUnits = recipeQuantity * (item as any).quantity
                  }
                  
                  // Перевіряємо наявність на складі перед списанням
                  const inventoryCheck = checkInventoryItem.get((recipe as any).inventory_item_id)
                  const availableStock = inventoryCheck ? (inventoryCheck as any).current_stock : 0
                  const inventoryName = inventoryCheck ? ((inventoryCheck as any).name_uk || (inventoryCheck as any).name_lt || '').toLowerCase() : ''
                  
                  console.log('[API] Інгредієнт:', inventoryName, '| Рецепт:', recipeQuantity, recipeUnit, '| Склад (базова одиниця):', stockUnit, '| Потрібно:', quantityInBaseUnits.toFixed(3), '| Доступно:', availableStock)
                  
                  // Перевіряємо, чи не виключений цей інгредієнт модифікатором
                  let shouldExclude = false
                  for (const excludedName of excludedIngredients) {
                    if (inventoryName.includes(excludedName) || excludedName.includes(inventoryName)) {
                      shouldExclude = true
                      console.log('[API] Інгредієнт виключено модифікатором:', inventoryName)
                      break
                    }
                  }
                  
                  if (shouldExclude) {
                    continue
                  }
                  
                  // Списуємо зі складу (тільки якщо достатньо)
                  if (availableStock >= quantityInBaseUnits) {
                    updateInventoryStock.run(String(quantityInBaseUnits), String((recipe as any).inventory_item_id))
                    insertInventoryMovement.run(
                      String((recipe as any).inventory_item_id),
                      String(quantityInBaseUnits),
                      String(newOrderId)
                    )
                    console.log('[API] ✅ Списано:', inventoryName, '-', quantityInBaseUnits.toFixed(3), stockUnit)
                  } else {
                    console.warn('[API] ⚠️ НЕДОСТАТНЬО НА СКЛАДІ:', inventoryName, '| Потрібно:', quantityInBaseUnits.toFixed(3), stockUnit, '| Доступно:', availableStock, stockUnit)
                    console.warn('[API] ⚠️ СПИСАННЯ НЕ ВИКОНАНО - недостатній залишок!')
                    // Списання НЕ виконується, якщо недостатньо товару
                  }
                }
              } catch (inventoryError) {
                console.warn('[v0] Ошибка списания ингредиентов:', inventoryError)
                console.warn('[v0] Inventory error details:', inventoryError instanceof Error ? inventoryError.message : inventoryError)
              }

              // Обработка модификаторов позиции
              if (orderItemId && item.modifiers && Array.isArray(item.modifiers)) {
                // Processing modifiers
                for (const m of item.modifiers) {
                  const mid = m?.id
                  const m_name_uk = (m as any)?.name_uk || m?.name || 'Без названия'
                  const m_name_lt = (m as any)?.name_lt || m?.name || 'Be pavadinimo'
                  const m_group_name = (m as any)?.group_name || (m as any)?.groupName?.uk || (m as any)?.groupName?.lt || ''
                  const m_price = Number(m?.price) || 0
                  const m_type = (m?.type as string) || 'addon'
                  const m_required = (m as any)?.required ? 1 : 0
                  
                  // Checking modifier
                  
                  // Проверяем существует ли модификатор
                  const existing = mid ? checkModifier.get(String(mid)) as any : null
                  
                  if (existing) {
                    // Modifier exists
                    // Модификатор существует - создаем запись связи модификатора с позицией заказа
                    insertOrderItemModifier.run(String(orderItemId), String(mid), String(m_price))
                  } else {
                    // Creating modifier
                    // Создаем модификатор, если его нет
                    try {
                      insertModifier.run(
                        String(mid),
                        m_name_lt,
                        m_name_uk,
                        m_group_name,
                        String(m_price),
                        m_type,
                        m_required
                      )
                      // Modifier created
                      // Теперь создаем связь
                      insertOrderItemModifier.run(String(orderItemId), String(mid), String(m_price))
                    } catch (createError) {
                      console.error(`[API] ❌ Failed to create modifier ${mid}:`, createError)
                    }
                  }
                  
                  // Списание ингредиентов из модификатора
                  // ВАЖЛИВО: Списання відбувається ТІЛЬКИ якщо замовлення НЕ скасоване
                  try {
                    const modifierIngredients = shouldDeductIngredients ? db.prepare(`
                      SELECT moi.inventory_item_id, moi.quantity, moi.unit as recipe_unit,
                             ii.name_uk, ii.name_lt, ii.unit as stock_unit, ii.current_stock, ii.unit_weight
                      FROM modifier_option_ingredients moi
                      LEFT JOIN inventory_items ii ON moi.inventory_item_id = ii.id
                      WHERE moi.modifier_option_id = ?
                    `).all(String(mid)) : []
                    
                    if (shouldDeductIngredients && modifierIngredients && modifierIngredients.length > 0) {
                      console.log('[API] Списание ингредиентов модификатора:', m_name_uk, '| Ингредиентов:', modifierIngredients.length)
                      
                      for (const modIngredient of modifierIngredients) {
                        const recipeQuantity = (modIngredient as any).quantity
                        const recipeUnit = (modIngredient as any).recipe_unit || 'g'
                        const stockUnit = (modIngredient as any).stock_unit || 'g'
                        const availableStock = (modIngredient as any).current_stock || 0
                        const ingredientName = (modIngredient as any).name_uk || (modIngredient as any).name_lt || 'Невідомий'
                        
                        // ПРАВИЛО: Склад завжди зберігає в базових одиницях (г/шт)
                        // Конвертуємо кількість з рецепту модифікатора в базові одиниці
                        let quantityInBaseUnits = recipeQuantity * (item as any).quantity
                        
                        const isWeightItem = stockUnit === 'g' || stockUnit === 'kg' || stockUnit === 'l' || stockUnit === 'ml'
                        const isPieceItem = stockUnit === 'pcs' || stockUnit === 'pack'
                        
                        if (isWeightItem) {
                          // Вагові товари: склад в грамах
                          if (recipeUnit === 'kg') {
                            quantityInBaseUnits = (recipeQuantity * (item as any).quantity) * 1000 // кг → г
                          } else if (recipeUnit === 'l') {
                            quantityInBaseUnits = (recipeQuantity * (item as any).quantity) * 1000 // л → мл
                          } else if (recipeUnit === 'g' || recipeUnit === 'ml') {
                            quantityInBaseUnits = recipeQuantity * (item as any).quantity // вже в базових
                          }
                          // Конвертація якщо склад в кг/л
                          if (stockUnit === 'kg' && recipeUnit === 'g') {
                            quantityInBaseUnits = (recipeQuantity * (item as any).quantity) / 1000
                          }
                          if (stockUnit === 'l' && recipeUnit === 'ml') {
                            quantityInBaseUnits = (recipeQuantity * (item as any).quantity) / 1000
                          }
                        } else if (isPieceItem) {
                          // Штучні товари: склад в штуках
                          quantityInBaseUnits = recipeQuantity * (item as any).quantity
                        }
                        
                        console.log('[API] Модифікатор інгредієнт:', ingredientName, '| Рецепт:', recipeQuantity, recipeUnit, '| Склад (базова):', stockUnit, '| Потрібно:', quantityInBaseUnits.toFixed(3), '| Доступно:', availableStock)
                        
                        if (availableStock >= quantityInBaseUnits) {
                          updateInventoryStock.run(String(quantityInBaseUnits), String((modIngredient as any).inventory_item_id))
                          insertInventoryMovement.run(
                            String((modIngredient as any).inventory_item_id),
                            String(quantityInBaseUnits),
                            String(newOrderId)
                          )
                          console.log('[API] ✅ Списано з модифікатора:', ingredientName, '-', quantityInBaseUnits.toFixed(3), stockUnit)
                        } else {
                          console.warn('[API] ⚠️ НЕДОСТАТНЬО НА СКЛАДІ для модифікатора:', ingredientName, '| Потрібно:', quantityInBaseUnits.toFixed(3), stockUnit, '| Доступно:', availableStock, stockUnit)
                          console.warn('[API] ⚠️ СПИСАННЯ НЕ ВИКОНАНО - недостатній залишок!')
                        }
                      }
                    }
                  } catch (modifierInventoryError) {
                    console.warn('[API] Ошибка списания ингредиентов модификатора:', modifierInventoryError)
                  }
                }
              }
            }
          }
        }

        // ВАРІАНТ 1 — матеріали списуються разом зі списанням інгредієнтів при переході в кухонний статус (PUT)
      })

      transaction()
      console.log("[API] Order created:", newOrderId)
      
      // Broadcast SSE event for real-time sync to kitchen
      try {
        const { broadcastEvent } = await import('@/lib/sse')
        broadcastEvent({
          type: 'order-created',
          data: { orderId: String(newOrderId), timestamp: Date.now() }
        })
        console.log("[API] SSE broadcast sent for new order:", newOrderId)
      } catch (sseError) {
        console.error("[API] Failed to broadcast SSE event:", sseError)
      }
      
      return Response.json({ success: true, order: { ...order, id: newOrderId } })
    } else {
      // Логика для синхронизации нескольких заказов (body.orders)
      // ... here you can leave existing logic or work on it
    }

    return Response.json({ success: false, error: "Invalid request data" }, { status: 400 })
  } catch (error) {
    // Расширенное логирование ошибки сервера
    console.error("[v0] Ошибка сохранения заказа:", error instanceof Error ? error.message : error, error)
    console.error("[v0] Stack trace:", error instanceof Error ? error.stack : 'No stack trace')

    if (error instanceof Error && error.message.startsWith('Total mismatch:')) {
      return Response.json(
        {
          success: false,
          error: error.message,
        },
        { status: 400 },
      )
    }
    
    // Log the specific SQL error details
    if (error instanceof Error && error.message.includes('FOREIGN KEY constraint failed')) {
      console.error("[v0] FOREIGN KEY constraint failed - checking database schema...")
      try {
        const db = getDatabase()
        const pragmaResult = db.prepare('PRAGMA foreign_key_check').all()
        console.error("[v0] Foreign key violations:", pragmaResult)
      } catch (pragmaError) {
        console.error("[v0] Error checking foreign keys:", pragmaError)
      }
    }
    
    return Response.json(
      {
        success: false,
        error:
          error instanceof Error
            ? `${error.name}: ${error.message}`
            : typeof error === "string"
              ? error
              : "Failed to save order",
      },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  let orderId: string | undefined
  let status: string | undefined
  
  try {
    const rawBody = await request.text()
    if (!rawBody || rawBody.trim().length === 0) {
      console.error('[v0] API PUT: Пустое тело запроса')
      return Response.json({ success: false, error: 'Empty request body' }, { status: 400 })
    }

    let requestData: any
    try {
      requestData = JSON.parse(rawBody)
    } catch (e) {
      console.error('[v0] API PUT: Некорректный JSON в теле запроса:', rawBody)
      return Response.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
    }

    orderId = requestData.orderId
    status = requestData.status
    console.log("[v0] API PUT: Получен запрос на обновление заказа", orderId, "статус:", status)
    
    if (!orderId || !status) {
      console.error("[v0] API PUT: Отсутствуют обязательные параметры - orderId:", orderId, "status:", status)
      return Response.json({ success: false, error: "Missing orderId or status" }, { status: 400 })
    }
    
    const db = getDatabase()

    // Проверяем и добавляем поле updated_at если его нет
    try {
      const tableInfo = db.prepare('PRAGMA table_info(orders)').all() as any[]
      const hasUpdatedAt = tableInfo.some(col => col.name === 'updated_at')
      
      if (!hasUpdatedAt) {
        db.prepare('ALTER TABLE orders ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP').run()
        console.log('[API] Добавлено поле updated_at в таблицу orders')
      }
    } catch (migrationError) {
      console.warn('[API] Ошибка миграции updated_at (возможно поле уже существует):', migrationError)
    }

    console.log("[v0] API PUT: Выполняем SQL запрос для заказа", orderId, "статус:", status)

    const beforeUpdate = db.prepare('SELECT id, status FROM orders WHERE id = ?').get(orderId) as any
    console.log("[v0] API PUT: Статус ДО обновления:", beforeUpdate)

    if (!beforeUpdate) {
      console.log("[v0] API PUT: Заказ не найден, ID:", orderId)
      return Response.json({ success: false, error: 'Order not found' }, { status: 404 })
    }

    const isCancelling = isCancelStatus(status)
    if (isCancelling) {
      ensureCancelledAtColumn(db)
    }

    const applyUpdate = db.transaction(() => {
      const current = db.prepare('SELECT id, status FROM orders WHERE id = ?').get(orderId) as any
      if (!current) {
        throw new Error('OrderNotFound')
      }

      if (isCancelling && !isCancelStatus(String(current.status || ''))) {
        console.log(`[API PUT] ⚠️ Скасування замовлення ${orderId} - повертаємо інгредієнти на склад`)
        returnInventoryForOrder(db, String(orderId), '[API PUT Cancel]')
      }

      if (isCancelling) {
        db.prepare(
          `
            UPDATE orders
            SET status = ?, cancelled_at = CURRENT_TIMESTAMP, updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')
            WHERE id = ?
          `,
        ).run(status, orderId)
      } else {
        db.prepare(
          `
            UPDATE orders
            SET status = ?, updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')
            WHERE id = ?
          `,
        ).run(status, orderId)
      }
    })

    try {
      applyUpdate()
    } catch (e: any) {
      if (e instanceof Error && e.message === 'OrderNotFound') {
        return Response.json({ success: false, error: 'Order not found' }, { status: 404 })
      }
      throw e
    }

    const result = { changes: 1 }

    let appliedStatus = status

    // Проверяем статус после обновления
    const afterUpdate = db.prepare('SELECT id, status FROM orders WHERE id = ?').get(orderId) as any
    appliedStatus = afterUpdate?.status || status
    console.log("[v0] API PUT: Статус ПОСЛЕ обновления:", afterUpdate)
    console.log("[v0] API PUT: Успешно обновлен статус заказа", orderId, "на", appliedStatus)
    
    // ВАРІАНТ 1 — списання інгредієнтів/матеріалів тільки при переході в кухонний статус
    try {
      const beforeStatus = String(beforeUpdate?.status || '')
      const nowStatus = String(appliedStatus || status)

      const enteredKitchen = !isKitchenStatus(beforeStatus) && isKitchenStatus(nowStatus)
      const isCancelledNow = isCancelStatus(nowStatus)

      if (enteredKitchen && !isCancelledNow) {
        const orderRow = db.prepare('SELECT order_type FROM orders WHERE id = ?').get(orderId) as any
        const orderTypeStr = String(orderRow?.order_type || '')
        console.log(`[API PUT] 🍳 Entered kitchen status. Deduct inventory for order ${orderId} (type=${orderTypeStr})`)

        db.transaction(() => {
          deductInventoryForOrder(db, String(orderId), orderTypeStr, '[API PUT Kitchen]')
        })()
      }
    } catch (e) {
      console.warn('[API PUT] ⚠️ Failed to deduct inventory on kitchen transition:', e)
    }
    // Отправляем SSE уведомление всем подключенным устройствам для real-time синхронизации
    try {
      const { broadcastEvent } = await import('@/lib/sse')
      broadcastEvent({
        type: 'order-status-updated',
        data: { orderId, status: appliedStatus, timestamp: Date.now() }
      })
      console.log("[v0] API PUT: SSE событие отправлено всем устройствам")
    } catch (e) {
      console.warn("[v0] API PUT: Не удалось отправить SSE событие:", e)
    }
    
    return Response.json({ success: true, orderId, status })
  } catch (error) {
    console.error("[v0] Критическая ошибка обновления заказа:", error)
    console.error("[v0] Стек ошибки:", error instanceof Error ? error.stack : 'Нет стека')
    console.error("[v0] Параметры запроса - orderId:", orderId, "status:", status)
    return Response.json({ 
      success: false, 
      error: "Failed to update order", 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const rawBody = await request.text()
    if (!rawBody || rawBody.trim().length === 0) {
      console.error('[v0] API DELETE: Пустое тело запроса')
      return Response.json({ success: false, error: 'Empty request body' }, { status: 400 })
    }

    let requestData: any
    try {
      requestData = JSON.parse(rawBody)
    } catch (e) {
      console.error('[v0] API DELETE: Некорректный JSON в теле запроса:', rawBody)
      return Response.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
    }

    const { orderId } = requestData
    
    if (!orderId) {
      return Response.json({ success: false, error: "Order ID required" }, { status: 400 })
    }
    
    const db = getDatabase()
    
    // Получаем данные заказа
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any
    
    if (!order) {
      return Response.json({ success: false, error: "Order not found" }, { status: 404 })
    }
    
    const currentStatus = (order.status || '').toLowerCase()
    const isClosed = ['delivered', 'completed', 'cancelled'].includes(currentStatus)
    
    // Добавляем поля для отмены если их нет
    ensureCancelledAtColumn(db)
    
    const cancelTx = db.transaction(() => {
      const current = db.prepare('SELECT status FROM orders WHERE id = ?').get(orderId) as any
      if (!current) {
        throw new Error('OrderNotFound')
      }

      const curStatus = String(current.status || '').toLowerCase()
      const closed = ['delivered', 'completed', 'cancelled'].includes(curStatus)

      if (!closed) {
        console.log(`[API DELETE] ⚠️ Скасування замовлення ${orderId} - повертаємо інгредієнти на склад`)
        returnInventoryForOrder(db, String(orderId), '[API DELETE Cancel]')
      } else {
        console.log(`[API DELETE] ℹ️ Order ${orderId} already closed (${curStatus}), skip inventory return`)
      }

      db.prepare(
        `
          UPDATE orders
          SET status = 'cancelled',
              cancelled_at = CURRENT_TIMESTAMP,
              updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')
          WHERE id = ?
        `,
      ).run(orderId)
    })

    try {
      cancelTx()
    } catch (e: any) {
      if (e instanceof Error && e.message === 'OrderNotFound') {
        return Response.json({ success: false, error: 'Order not found' }, { status: 404 })
      }
      throw e
    }
    
    // Отправляем SSE уведомление всем подключенным устройствам для real-time синхронизации
    try {
      const { broadcastEvent } = await import('@/lib/sse')
      broadcastEvent({
        type: 'order-status-updated',
        data: { orderId, status: 'cancelled', timestamp: Date.now() }
      })
      console.log("[API] SSE broadcast sent for cancelled order:", orderId)
    } catch (sseError) {
      console.error("[API] Failed to broadcast SSE event:", sseError)
    }
    
    console.log("[API] Order cancelled:", orderId)
    return Response.json({ 
      success: true, 
      orderId,
      status: 'cancelled',
      message: "Order cancelled successfully" 
    })
  } catch (error) {
    console.error("[API] Ошибка отмены заказа:", error)
    return Response.json({ success: false, error: "Failed to cancel order" }, { status: 500 })
  }
}
