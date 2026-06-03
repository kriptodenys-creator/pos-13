import { getDatabase } from "@/lib/database"

export async function POST(request: Request) {
  try {
    const db = getDatabase()
    const body = await request.json()
    const { movement_type, item_id, quantity, reason, cost_per_unit } = body

    // Валідація: перевірка обов'язкових полів
    if (!item_id || item_id === '') {
      return Response.json({ error: 'Item ID is required' }, { status: 400 })
    }

    if (!movement_type || (movement_type !== 'in' && movement_type !== 'out')) {
      return Response.json({ error: 'Invalid movement type. Must be "in" or "out"' }, { status: 400 })
    }

    // Валідація: перевірка кількості
    const qty = Number(quantity)
    if (!quantity || isNaN(qty) || qty <= 0) {
      return Response.json({ error: 'Quantity must be a positive number' }, { status: 400 })
    }

    // Валідація: максимальна кількість
    if (qty > 100000) {
      return Response.json({ error: 'Quantity too large (max 100000)' }, { status: 400 })
    }

    // Валідація: ціна
    const cost = Number(cost_per_unit) || 0
    if (cost < 0) {
      return Response.json({ error: 'Cost cannot be negative' }, { status: 400 })
    }

    const itemIdStr = String(item_id).trim()
    const reasonText = String(reason || (movement_type === 'in' ? 'Приход товара' : 'Списание товара')).trim()
    
    // Валідація: причина не може бути порожньою
    if (!reasonText || reasonText.length === 0) {
      return Response.json({ error: 'Reason is required' }, { status: 400 })
    }

    const totalCost = Number((qty * cost).toFixed(2))

    // Перевіряємо наявність товару
    const item = db.prepare(`SELECT current_stock, cost_per_unit FROM inventory_items WHERE id = ?`).get(itemIdStr) as any
    if (!item) {
      return Response.json({ error: 'Item not found' }, { status: 404 })
    }

    // Використовуємо транзакцію для атомарності операцій
    const transaction = db.transaction(() => {
      if (movement_type === 'in') {
        // Приход товара
        db.prepare(`
          UPDATE inventory_items 
          SET current_stock = current_stock + ?, 
              cost_per_unit = COALESCE(?, cost_per_unit),
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(qty, cost > 0 ? cost : null, itemIdStr)

        db.prepare(`
          INSERT INTO inventory_movements 
          (inventory_item_id, movement_type, quantity, reason, cost_per_unit, total_cost)
          VALUES (?, 'in', ?, ?, ?, ?)
        `).run(itemIdStr, qty, reasonText, cost, totalCost)
      } else if (movement_type === 'out') {
        // Списание товара
        if (item.current_stock < qty) {
          throw new Error('Insufficient stock')
        }

        const itemCost = Number(item.cost_per_unit) || 0
        const itemTotalCost = Number((qty * itemCost).toFixed(2))

        db.prepare(`
          UPDATE inventory_items 
          SET current_stock = current_stock - ?, 
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(qty, itemIdStr)

        db.prepare(`
          INSERT INTO inventory_movements 
          (inventory_item_id, movement_type, quantity, reason, cost_per_unit, total_cost)
          VALUES (?, 'out', ?, ?, ?, ?)
        `).run(itemIdStr, qty, reasonText, itemCost, itemTotalCost)
      }
    })

    try {
      transaction()
      
      // Broadcast SSE event for real-time sync
      try {
        const { broadcastEvent } = await import('@/lib/sse')
        broadcastEvent({
          type: 'inventory-updated',
          data: { item_id: itemIdStr, movement_type, quantity: qty, timestamp: Date.now() }
        })
      } catch (e) {
        console.warn('[API] Failed to broadcast inventory update:', e)
      }
      
      if (movement_type === 'in') {
        return Response.json({ success: true, message: 'Stock added successfully' })
      } else {
        return Response.json({ success: true, message: 'Stock removed successfully' })
      }
    } catch (transactionError) {
      console.error('[API] Transaction error:', transactionError)
      return Response.json({ 
        error: transactionError instanceof Error ? transactionError.message : 'Transaction failed' 
      }, { status: 400 })
    }

    return Response.json({ error: 'Invalid movement type' }, { status: 400 })
  } catch (error) {
    console.error('[API] Inventory movement error:', error)
    return Response.json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }, { status: 500 })
  }
}
