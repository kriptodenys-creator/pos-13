import { getDatabase } from "@/lib/database"

export async function GET(request: Request) {
  try {
    const db = getDatabase()
    
    if (!db) {
      return new Response(JSON.stringify({ success: false, error: 'Database not available', items: [] }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Получаем самые популярные товары (по количеству заказов за последние 7 дней)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const sevenDaysAgoISO = sevenDaysAgo.toISOString()

    try {
      const popularStmt = db.prepare(`
        SELECT 
          oi.menu_item_id,
          SUM(oi.quantity) as total_quantity,
          COUNT(DISTINCT oi.order_id) as order_count
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE o.created_at >= ?
        GROUP BY oi.menu_item_id
        ORDER BY total_quantity DESC
        LIMIT 10
      `)
      
      const popularStats = popularStmt.all(sevenDaysAgoISO) as any[]
      
      // Получаем полные данные о товарах
      if (popularStats.length === 0) {
        return new Response(JSON.stringify({ success: true, items: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      
      const itemIds = popularStats.map(stat => stat.menu_item_id)
      const placeholders = itemIds.map(() => '?').join(',')
      
      const itemsStmt = db.prepare(`
        SELECT 
          id,
          name_lt,
          name_uk,
          price,
          category,
          image
        FROM menu_items
        WHERE id IN (${placeholders})
      `)
      
      const menuItems = itemsStmt.all(...itemIds) as any[]
      
      // Получаем модификаторы и их опции для каждого товара
      const getModifiersWithOptionsStmt = db.prepare(`
        SELECT 
          m.id as mod_id,
          m.name_lt as mod_name_lt,
          m.name_uk as mod_name_uk,
          m.group_name as mod_group_name,
          m.price as mod_price,
          m.type as mod_type,
          m.required as mod_required,
          mo.id as opt_id,
          mo.name_lt as opt_name_lt,
          mo.name_uk as opt_name_uk,
          mo.price as opt_price
        FROM menu_item_modifiers mim
        JOIN modifiers m ON mim.modifier_id = m.id
        LEFT JOIN modifier_options mo ON mo.modifier_id = m.id
        WHERE mim.menu_item_id = ?
        ORDER BY m.group_name, m.name_lt, mo.name_lt
      `)
      
      // Добавляем модификаторы к каждому товару
      const itemsWithModifiers = menuItems.map(item => {
        const rows = getModifiersWithOptionsStmt.all(item.id) as any[]
        const modMap = new Map<string, any>()

        rows.forEach(row => {
          if (!row.mod_id) return
          if (!modMap.has(row.mod_id)) {
            modMap.set(row.mod_id, {
              id: row.mod_id,
              name: { lt: row.mod_name_lt, uk: row.mod_name_uk },
              name_lt: row.mod_name_lt,
              name_uk: row.mod_name_uk,
              group_name: row.mod_group_name,
              price: row.mod_price,
              type: row.mod_type,
              required: !!row.mod_required,
              options: []
            })
          }

          if (row.opt_id) {
            const mod = modMap.get(row.mod_id)!
            // Проверяем, не добавлена ли опция ранее
            if (!mod.options.some((opt: any) => opt.id === row.opt_id)) {
              mod.options.push({
                id: row.opt_id,
                name: { lt: row.opt_name_lt, uk: row.opt_name_uk },
                price: row.opt_price || 0
              })
            }
          }
        })

        const modifiers = Array.from(modMap.values())
        console.log(`[API Popular] Item ${item.name_uk}: ${modifiers.length} modifiers (with options)`)

        return {
          ...item,
          name: { lt: item.name_lt, uk: item.name_uk },
          modifiers
        }
      })
      
      // Сортируем товары по популярности
      const itemsMap = new Map(itemsWithModifiers.map(item => [item.id, item]))
      const sortedItems = popularStats
        .map(stat => itemsMap.get(stat.menu_item_id))
        .filter(item => item !== undefined)
      
      console.log(`[API Popular] Returning ${sortedItems.length} items with modifiers`)

      return new Response(JSON.stringify({ success: true, items: sortedItems }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (error) {
      // Если таблица заказов не готова, возвращаем пустой список
      console.log('[API] Popular items query failed, returning empty list:', error)
      return new Response(JSON.stringify({ success: true, items: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  } catch (error) {
    console.error('[API] Error in popular route:', error)
    return new Response(JSON.stringify({ success: false, error: 'Internal server error', items: [] }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
