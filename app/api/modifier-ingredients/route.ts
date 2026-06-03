import { getDatabase } from "@/lib/database"

export async function GET(request: Request) {
  try {
    const db = getDatabase()
    const url = new URL(request.url)
    const modifierOptionId = url.searchParams.get('modifier_option_id')

    if (modifierOptionId) {
      const ingredients = db.prepare(`
        SELECT 
          moi.*,
          ii.name_uk as ingredient_name_uk,
          ii.name_lt as ingredient_name_lt,
          ii.unit as stock_unit,
          ii.current_stock,
          ii.cost_per_unit
        FROM modifier_option_ingredients moi
        JOIN inventory_items ii ON moi.inventory_item_id = ii.id
        WHERE moi.modifier_option_id = ?
      `).all(modifierOptionId)

      return Response.json({ success: true, ingredients })
    }

    const allIngredients = db.prepare(`
      SELECT 
        moi.*,
        mo.name_uk as option_name_uk,
        mo.name_lt as option_name_lt,
        m.name_uk as modifier_name_uk,
        m.name_lt as modifier_name_lt,
        ii.name_uk as ingredient_name_uk,
        ii.name_lt as ingredient_name_lt,
        ii.unit
      FROM modifier_option_ingredients moi
      JOIN modifier_options mo ON moi.modifier_option_id = mo.id
      JOIN modifiers m ON mo.modifier_id = m.id
      JOIN inventory_items ii ON moi.inventory_item_id = ii.id
      ORDER BY m.name_uk, mo.name_uk
    `).all()

    return Response.json({ success: true, ingredients: allIngredients })
  } catch (error) {
    console.error('[API] Error getting modifier ingredients:', error)
    return Response.json({ error: 'Failed to get modifier ingredients' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const db = getDatabase()
    const body = await request.json()
    const { modifier_option_id, ingredients } = body

    console.log('[API] Saving modifier ingredients:', { modifier_option_id, ingredients })

    if (!modifier_option_id) {
      return Response.json({ error: 'modifier_option_id is required' }, { status: 400 })
    }

    if (!ingredients || !Array.isArray(ingredients)) {
      return Response.json({ error: 'ingredients array is required' }, { status: 400 })
    }

    // Проверяем и создаем таблицу если не существует
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS modifier_option_ingredients (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          modifier_option_id TEXT NOT NULL,
          inventory_item_id TEXT NOT NULL,
          quantity REAL NOT NULL,
          unit TEXT DEFAULT 'g',
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (modifier_option_id) REFERENCES modifier_options (id) ON DELETE CASCADE,
          FOREIGN KEY (inventory_item_id) REFERENCES inventory_items (id)
        )
      `)
      
      // Добавляем колонку unit если таблица уже существует
      try {
        db.exec(`ALTER TABLE modifier_option_ingredients ADD COLUMN unit TEXT DEFAULT 'g'`)
      } catch (e) {
        // Колонка уже существует, игнорируем
      }
      
      console.log('[API] Table modifier_option_ingredients checked/created')
    } catch (tableError) {
      console.error('[API] Error creating table:', tableError)
    }

    const transaction = db.transaction(() => {
      // Удаляем старые ингредиенты
      db.prepare(`DELETE FROM modifier_option_ingredients WHERE modifier_option_id = ?`).run(modifier_option_id)
      console.log('[API] Deleted old ingredients for:', modifier_option_id)

      // Добавляем новые ингредиенты
      const insertIngredient = db.prepare(`
        INSERT INTO modifier_option_ingredients (modifier_option_id, inventory_item_id, quantity, unit)
        VALUES (?, ?, ?, ?)
      `)

      for (const ing of ingredients) {
        if (ing.inventory_item_id && ing.quantity > 0) {
          const unit = ing.unit || 'g'
          console.log('[API] Inserting ingredient:', { ...ing, unit })
          insertIngredient.run(modifier_option_id, ing.inventory_item_id, ing.quantity, unit)
        }
      }
    })

    transaction()
    console.log('[API] Transaction completed successfully')
    return Response.json({ success: true, message: 'Modifier ingredients saved successfully' })
  } catch (error) {
    console.error('[API] Error saving modifier ingredients:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return Response.json({ 
      success: false,
      error: 'Failed to save modifier ingredients', 
      details: errorMessage 
    }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const db = getDatabase()
    const url = new URL(request.url)
    const modifierOptionId = url.searchParams.get('modifier_option_id')

    if (!modifierOptionId) {
      return Response.json({ error: 'modifier_option_id is required' }, { status: 400 })
    }

    db.prepare(`DELETE FROM modifier_option_ingredients WHERE modifier_option_id = ?`).run(modifierOptionId)
    
    return Response.json({ success: true, message: 'Modifier ingredients deleted successfully' })
  } catch (error) {
    console.error('[API] Error deleting modifier ingredients:', error)
    return Response.json({ error: 'Failed to delete modifier ingredients' }, { status: 500 })
  }
}
