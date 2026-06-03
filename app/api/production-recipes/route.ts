import { getDatabase } from "@/lib/database"
import { NextResponse } from "next/server"

// GET - получить все рецепты производства
export async function GET(request: Request) {
  try {
    const db = getDatabase()
    
    if (!db) {
      return NextResponse.json({ success: false, error: 'Database not available' }, { status: 503 })
    }

    // Создаем таблицы если их нет
    db.exec(`
      CREATE TABLE IF NOT EXISTS production_recipes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        output_item_id TEXT NOT NULL,
        output_quantity REAL NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (output_item_id) REFERENCES inventory_items(id)
      )
    `)

    db.exec(`
      CREATE TABLE IF NOT EXISTS production_recipe_ingredients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recipe_id INTEGER NOT NULL,
        inventory_item_id TEXT NOT NULL,
        quantity REAL NOT NULL,
        unit TEXT DEFAULT 'g',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (recipe_id) REFERENCES production_recipes(id) ON DELETE CASCADE,
        FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id)
      )
    `)

    const { searchParams } = new URL(request.url)
    const recipeId = searchParams.get('recipe_id')

    if (recipeId) {
      // Получить ингредиенты конкретного рецепта
      const ingredients = db.prepare(`
        SELECT 
          pri.*,
          ii.name_uk as ingredient_name_uk,
          ii.name_lt as ingredient_name_lt,
          ii.unit as stock_unit
        FROM production_recipe_ingredients pri
        LEFT JOIN inventory_items ii ON pri.inventory_item_id = ii.id
        WHERE pri.recipe_id = ?
        ORDER BY pri.id
      `).all(recipeId)

      return NextResponse.json({ success: true, ingredients })
    }

    // Получить все рецепты с информацией о выходном продукте
    const recipes = db.prepare(`
      SELECT 
        pr.*,
        ii.name_uk as output_name_uk,
        ii.name_lt as output_name_lt,
        ii.unit as output_unit,
        ii.current_stock as output_current_stock
      FROM production_recipes pr
      LEFT JOIN inventory_items ii ON pr.output_item_id = ii.id
      ORDER BY pr.id DESC
    `).all()

    return NextResponse.json({ success: true, recipes })
  } catch (error) {
    console.error('Error fetching production recipes:', error)
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}

// POST - создать или обновить рецепт производства
export async function POST(request: Request) {
  try {
    const db = getDatabase()
    
    if (!db) {
      return NextResponse.json({ success: false, error: 'Database not available' }, { status: 503 })
    }

    const body = await request.json()
    const { recipe_id, output_item_id, output_quantity, ingredients } = body

    if (recipe_id) {
      // Обновить существующий рецепт
      db.prepare(`
        UPDATE production_recipes 
        SET output_item_id = ?, output_quantity = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(output_item_id, output_quantity, recipe_id)

      // Удалить старые ингредиенты
      db.prepare('DELETE FROM production_recipe_ingredients WHERE recipe_id = ?').run(recipe_id)

      // Добавить новые ингредиенты
      const insertIngredient = db.prepare(`
        INSERT INTO production_recipe_ingredients (recipe_id, inventory_item_id, quantity, unit)
        VALUES (?, ?, ?, ?)
      `)

      for (const ing of ingredients) {
        insertIngredient.run(recipe_id, ing.inventory_item_id, ing.quantity, ing.unit || 'g')
      }

      return NextResponse.json({ success: true, recipe_id })
    } else {
      // Создать новый рецепт
      const result = db.prepare(`
        INSERT INTO production_recipes (output_item_id, output_quantity)
        VALUES (?, ?)
      `).run(output_item_id, output_quantity)

      const newRecipeId = result.lastInsertRowid

      // Добавить ингредиенты
      const insertIngredient = db.prepare(`
        INSERT INTO production_recipe_ingredients (recipe_id, inventory_item_id, quantity, unit)
        VALUES (?, ?, ?, ?)
      `)

      for (const ing of ingredients) {
        insertIngredient.run(newRecipeId, ing.inventory_item_id, ing.quantity, ing.unit || 'g')
      }

      return NextResponse.json({ success: true, recipe_id: newRecipeId })
    }
  } catch (error) {
    console.error('Error saving production recipe:', error)
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}

// DELETE - удалить рецепт производства
export async function DELETE(request: Request) {
  try {
    const db = getDatabase()
    
    if (!db) {
      return NextResponse.json({ success: false, error: 'Database not available' }, { status: 503 })
    }

    const { searchParams } = new URL(request.url)
    const recipeId = searchParams.get('recipe_id')

    if (!recipeId) {
      return NextResponse.json({ success: false, error: 'Recipe ID required' }, { status: 400 })
    }

    db.prepare('DELETE FROM production_recipe_ingredients WHERE recipe_id = ?').run(recipeId)
    db.prepare('DELETE FROM production_recipes WHERE id = ?').run(recipeId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting production recipe:', error)
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}
