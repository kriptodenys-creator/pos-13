import { getDatabase } from "@/lib/database"

// GET - получить все товары склада или конкретный товар
export async function GET(request: Request) {
  try {
    const db = getDatabase()
    const url = new URL(request.url)
    const id = url.searchParams.get('id')
    const includeMovements = url.searchParams.get('includeMovements') === '1'
    const lowStock = url.searchParams.get('lowStock') === '1'

    // Убедимся что таблица имеет нужные колонки
    ensureInventoryColumns(db)

    if (id) {
      // Получить конкретный товар
      const item = db.prepare(`
        SELECT * FROM inventory_items WHERE id = ?
      `).get(id)

      if (!item) {
        return Response.json({ error: 'Item not found' }, { status: 404 })
      }

      let movements: any[] = []
      if (includeMovements) {
        movements = db.prepare(`
          SELECT * FROM inventory_movements 
          WHERE inventory_item_id = ? 
          ORDER BY created_at DESC 
          LIMIT 50
        `).all(id)
      }

      return Response.json({ item, movements })
    }

    // Получить все товары
    let query = `
      SELECT 
        i.*,
        (SELECT COUNT(*) FROM recipe_ingredients ri WHERE ri.inventory_item_id = i.id) as used_in_recipes
      FROM inventory_items i
    `

    if (lowStock) {
      query += ` WHERE i.current_stock <= i.min_stock`
    }

    query += ` ORDER BY i.name_uk`

    const items = db.prepare(query).all()

    // Получить статистику
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_items,
        SUM(CASE WHEN current_stock <= min_stock THEN 1 ELSE 0 END) as low_stock_count,
        SUM(current_stock * cost_per_unit) as total_value
      FROM inventory_items
    `).get() as any

    return Response.json({ 
      success: true,
      items, 
      stats: {
        totalItems: stats?.total_items || 0,
        lowStockCount: stats?.low_stock_count || 0,
        totalValue: stats?.total_value || 0
      }
    })
  } catch (error) {
    console.error('[API] Error getting inventory:', error)
    return Response.json({ error: 'Failed to get inventory' }, { status: 500 })
  }
}

// POST - создать новый товар или выполнить операцию
export async function POST(request: Request) {
  try {
    const db = getDatabase()
    const body = await request.json()
    const { action } = body

    ensureInventoryColumns(db)

    if (action === 'add_stock') {
      // Приход товара
      const { item_id, quantity, reason, cost_per_unit } = body
      
      if (!item_id || !quantity || quantity <= 0) {
        return Response.json({ error: 'Invalid parameters' }, { status: 400 })
      }

      // Приводимо до правильних типів
      const itemIdStr = String(item_id)
      const qty = Number(quantity) || 0
      const cost = Number(cost_per_unit) || 0
      const reasonText = String(reason || 'Приход товара')
      const totalCost = Number((qty * cost).toFixed(2))

      console.log('[API] add_stock params:', { itemIdStr, qty, cost, reasonText, totalCost })

      // Перевіряємо структуру таблиці
      const tableInfo = db.prepare('PRAGMA table_info(inventory_movements)').all()
      console.log('[API] inventory_movements columns:', tableInfo)

      // Обновляем остаток
      db.prepare(`
        UPDATE inventory_items 
        SET current_stock = current_stock + ?, 
            cost_per_unit = COALESCE(?, cost_per_unit),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(qty, cost > 0 ? cost : null, itemIdStr)

      // Записываем движение - id є INTEGER з автоінкрементом, не вказуємо його
      try {
        db.prepare(`
          INSERT INTO inventory_movements 
          (inventory_item_id, movement_type, quantity, reason, cost_per_unit, total_cost)
          VALUES (?, 'in', ?, ?, ?, ?)
        `).run(String(itemIdStr), qty, String(reasonText), cost, totalCost)
      } catch (insertError) {
        console.error('[API] Insert error details:', insertError)
        throw insertError
      }
      return Response.json({ success: true, message: 'Stock added successfully' })
    }

    if (action === 'remove_stock') {
      // Списание товара (ручное)
      const { item_id, quantity, reason } = body
      
      if (!item_id || !quantity || quantity <= 0) {
        return Response.json({ error: 'Invalid parameters' }, { status: 400 })
      }

      // Приводимо до правильних типів
      const itemIdStr = String(item_id)
      const qty = Number(quantity) || 0
      const reasonText = String(reason || 'Ручное списание')

      // Проверяем наличие
      const item = db.prepare(`SELECT current_stock, cost_per_unit FROM inventory_items WHERE id = ?`).get(itemIdStr) as any
      if (!item) {
        return Response.json({ error: 'Item not found' }, { status: 404 })
      }

      if (item.current_stock < qty) {
        return Response.json({ error: 'Insufficient stock' }, { status: 400 })
      }

      const cost = Number(item.cost_per_unit) || 0
      const totalCost = Number((qty * cost).toFixed(2))

      // Обновляем остаток
      db.prepare(`
        UPDATE inventory_items 
        SET current_stock = current_stock - ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(qty, itemIdStr)

      // Записываем движение - id є INTEGER з автоінкрементом
      db.prepare(`
        INSERT INTO inventory_movements 
        (inventory_item_id, movement_type, quantity, reason, cost_per_unit, total_cost)
        VALUES (?, 'out', ?, ?, ?, ?)
      `).run(itemIdStr, qty, reasonText, cost, totalCost)
      return Response.json({ success: true, message: 'Stock removed successfully' })
    }

    // Создание нового товара
    const { name_uk, name_lt, unit, min_stock, max_stock, current_stock, cost_per_unit, supplier, category_id, image_url, unit_weight } = body

    if (!name_uk || !unit) {
      return Response.json({ error: 'Name and unit are required' }, { status: 400 })
    }

    const id = `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Вимикаємо перевірку зовнішніх ключів
    db.exec('PRAGMA foreign_keys = OFF')
    
    try {
      db.prepare(`
        INSERT INTO inventory_items 
        (id, name_uk, name_lt, unit, min_stock, max_stock, current_stock, cost_per_unit, supplier, category_id, image_url, unit_weight, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(
        id,
        name_uk,
        name_lt || name_uk,
        unit,
        min_stock || 0,
        max_stock || 100,
        current_stock || 0,
        cost_per_unit || 0,
        supplier || null,
        category_id || 'other',
        image_url || null,
        unit_weight || 0
      )
    } finally {
      db.exec('PRAGMA foreign_keys = ON')
    }

    // Если есть начальный остаток, записываем приход
    if (current_stock && current_stock > 0) {
      db.prepare(`
        INSERT INTO inventory_movements 
        (inventory_item_id, movement_type, quantity, reason, cost_per_unit, total_cost)
        VALUES (?, 'in', ?, 'Начальный остаток', ?, ?)
      `).run(id, current_stock, cost_per_unit || 0, (current_stock || 0) * (cost_per_unit || 0))
    }

    return Response.json({ success: true, id, message: 'Item created successfully' })
  } catch (error) {
    console.error('[API] Error in inventory POST:', error)
    return Response.json({ error: 'Failed to process request' }, { status: 500 })
  }
}

// PUT - обновить товар
export async function PUT(request: Request) {
  try {
    const db = getDatabase()
    const body = await request.json()
    const { id, name_uk, name_lt, unit, min_stock, max_stock, cost_per_unit, supplier, category_id, image_url, unit_weight, pieces_per_package, kg_per_piece } = body

    if (!id) {
      return Response.json({ error: 'ID is required' }, { status: 400 })
    }

    ensureInventoryColumns(db)

    const existing = db.prepare(`SELECT id FROM inventory_items WHERE id = ?`).get(id)
    if (!existing) {
      return Response.json({ error: 'Item not found' }, { status: 404 })
    }

    // Тимчасово вимикаємо перевірку зовнішніх ключів
    db.exec('PRAGMA foreign_keys = OFF')
    
    try {
      db.prepare(`
        UPDATE inventory_items 
        SET 
          name_uk = COALESCE(?, name_uk),
          name_lt = COALESCE(?, name_lt),
          unit = COALESCE(?, unit),
          min_stock = COALESCE(?, min_stock),
          max_stock = COALESCE(?, max_stock),
          cost_per_unit = COALESCE(?, cost_per_unit),
          supplier = COALESCE(?, supplier),
          category_id = COALESCE(?, category_id),
          image_url = COALESCE(?, image_url),
          unit_weight = COALESCE(?, unit_weight),
          pieces_per_package = COALESCE(?, pieces_per_package),
          kg_per_piece = COALESCE(?, kg_per_piece),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(name_uk, name_lt, unit, min_stock, max_stock, cost_per_unit, supplier, category_id, image_url, unit_weight, pieces_per_package, kg_per_piece, id)
    } finally {
      // Вмикаємо назад
      db.exec('PRAGMA foreign_keys = ON')
    }

    return Response.json({ success: true, message: 'Item updated successfully' })
  } catch (error) {
    console.error('[API] Error updating inventory item:', error)
    return Response.json({ error: 'Failed to update item' }, { status: 500 })
  }
}

// DELETE - удалить товар
export async function DELETE(request: Request) {
  try {
    const db = getDatabase()
    const url = new URL(request.url)
    const id = url.searchParams.get('id')

    if (!id) {
      return Response.json({ error: 'ID is required' }, { status: 400 })
    }

    // Проверяем, используется ли товар в рецептах
    const usedInRecipes = db.prepare(`
      SELECT COUNT(*) as count FROM recipe_ingredients WHERE inventory_item_id = ?
    `).get(id) as any

    if (usedInRecipes?.count > 0) {
      return Response.json({ 
        error: 'Cannot delete item used in recipes', 
        usedInRecipes: usedInRecipes.count 
      }, { status: 400 })
    }

    // Удаляем движения и сам товар
    const transaction = db.transaction(() => {
      db.prepare(`DELETE FROM inventory_movements WHERE inventory_item_id = ?`).run(id)
      db.prepare(`DELETE FROM inventory_items WHERE id = ?`).run(id)
    })

    transaction()
    return Response.json({ success: true, message: 'Item deleted successfully' })
  } catch (error) {
    console.error('[API] Error deleting inventory item:', error)
    return Response.json({ error: 'Failed to delete item' }, { status: 500 })
  }
}

// Вспомогательная функция для обеспечения наличия нужных колонок
function ensureInventoryColumns(db: any) {
  try {
    // Проверяем колонку reference_id в inventory_movements
    const movementsInfo = db.prepare('PRAGMA table_info(inventory_movements)').all() as any[]
    const hasReferenceId = movementsInfo.some((col: any) => col.name === 'reference_id')
    
    if (!hasReferenceId) {
      try {
        db.exec('ALTER TABLE inventory_movements ADD COLUMN reference_id TEXT')
        console.log('[API] Added reference_id column to inventory_movements')
      } catch (e) {
        // Колонка уже существует
      }
    }

    // Проверяем колонку category_id в inventory_items
    const itemsInfo = db.prepare('PRAGMA table_info(inventory_items)').all() as any[]
    const hasCategoryId = itemsInfo.some((col: any) => col.name === 'category_id')
    
    if (!hasCategoryId) {
      try {
        db.exec("ALTER TABLE inventory_items ADD COLUMN category_id TEXT DEFAULT 'other'")
        console.log('[API] Added category_id column to inventory_items')
      } catch (e) {
        // Колонка уже существует
      }
    }

    // Проверяем колонку image_url в inventory_items
    const hasImageUrl = itemsInfo.some((col: any) => col.name === 'image_url')
    
    if (!hasImageUrl) {
      try {
        db.exec("ALTER TABLE inventory_items ADD COLUMN image_url TEXT")
        console.log('[API] Added image_url column to inventory_items')
      } catch (e) {
        // Колонка уже существует
      }
    }

    // Проверяем колонку unit_weight в inventory_items (вага одиниці в кг)
    const hasUnitWeight = itemsInfo.some((col: any) => col.name === 'unit_weight')
    
    if (!hasUnitWeight) {
      try {
        db.exec("ALTER TABLE inventory_items ADD COLUMN unit_weight REAL DEFAULT 0")
        console.log('[API] Added unit_weight column to inventory_items')
      } catch (e) {
        // Колонка уже существует
      }
    }

    // Проверяем колонку pieces_per_package в inventory_items
    const hasPiecesPerPackage = itemsInfo.some((col: any) => col.name === 'pieces_per_package')
    
    if (!hasPiecesPerPackage) {
      try {
        db.exec("ALTER TABLE inventory_items ADD COLUMN pieces_per_package REAL DEFAULT 0")
        console.log('[API] Added pieces_per_package column to inventory_items')
      } catch (e) {
        // Колонка уже существует
      }
    }

    // Проверяем колонку kg_per_piece в inventory_items
    const hasKgPerPiece = itemsInfo.some((col: any) => col.name === 'kg_per_piece')
    
    if (!hasKgPerPiece) {
      try {
        db.exec("ALTER TABLE inventory_items ADD COLUMN kg_per_piece REAL DEFAULT 0")
        console.log('[API] Added kg_per_piece column to inventory_items')
      } catch (e) {
        // Колонка уже существует
      }
    }
  } catch (e) {
    console.warn('[API] Error ensuring inventory columns:', e)
  }
}
