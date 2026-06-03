import { getDatabase } from "@/lib/database"
import { NextResponse } from "next/server"

// POST - выполнить производство
export async function POST(request: Request) {
  try {
    const db = getDatabase()
    
    if (!db) {
      return NextResponse.json({ success: false, error: 'Database not available' }, { status: 503 })
    }

    const body = await request.json()
    const { recipe_id, batch_multiplier = 1 } = body

    if (!recipe_id) {
      return NextResponse.json({ success: false, error: 'Recipe ID required' }, { status: 400 })
    }

    // Получить рецепт
    const recipe = db.prepare(`
      SELECT pr.*, ii.name_uk, ii.unit, ii.current_stock
      FROM production_recipes pr
      LEFT JOIN inventory_items ii ON pr.output_item_id = ii.id
      WHERE pr.id = ?
    `).get(recipe_id) as any

    if (!recipe) {
      return NextResponse.json({ success: false, error: 'Recipe not found' }, { status: 404 })
    }

    // Получить ингредиенты рецепта
    const ingredients = db.prepare(`
      SELECT 
        pri.*,
        ii.name_uk,
        ii.current_stock,
        ii.unit as stock_unit,
        ii.unit_weight
      FROM production_recipe_ingredients pri
      LEFT JOIN inventory_items ii ON pri.inventory_item_id = ii.id
      WHERE pri.recipe_id = ?
    `).all(recipe_id) as any[]

    // Функция конвертации единиц
    const convertUnits = (quantity: number, fromUnit: string, toUnit: string, unitWeight?: number): number => {
      if (fromUnit === toUnit) return quantity

      // Граммы в килограммы
      if (fromUnit === 'g' && toUnit === 'kg') return quantity / 1000
      if (fromUnit === 'kg' && toUnit === 'g') return quantity * 1000

      // Миллилитры в литры
      if (fromUnit === 'ml' && toUnit === 'l') return quantity / 1000
      if (fromUnit === 'l' && toUnit === 'ml') return quantity * 1000

      // Штуки с весом единицы
      if (fromUnit === 'pcs' && (toUnit === 'g' || toUnit === 'kg') && unitWeight) {
        const grams = quantity * unitWeight
        return toUnit === 'kg' ? grams / 1000 : grams
      }

      return quantity
    }

    // Проверить наличие всех ингредиентов
    const insufficientIngredients = []
    for (const ing of ingredients) {
      const requiredQuantity = convertUnits(
        ing.quantity * batch_multiplier,
        ing.unit,
        ing.stock_unit,
        ing.unit_weight
      )

      if (ing.current_stock < requiredQuantity) {
        insufficientIngredients.push({
          name: ing.name_uk,
          required: requiredQuantity,
          available: ing.current_stock,
          unit: ing.stock_unit
        })
      }
    }

    if (insufficientIngredients.length > 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Insufficient ingredients',
        insufficient: insufficientIngredients
      }, { status: 400 })
    }

    // Начать транзакцию
    db.exec('BEGIN TRANSACTION')

    try {
      // Списать ингредиенты
      const updateStock = db.prepare(`
        UPDATE inventory_items 
        SET current_stock = current_stock - ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)

      const insertMovement = db.prepare(`
        INSERT INTO inventory_movements 
        (inventory_item_id, type, quantity, reason, created_at)
        VALUES (?, 'out', ?, ?, CURRENT_TIMESTAMP)
      `)

      for (const ing of ingredients) {
        const deductQuantity = convertUnits(
          ing.quantity * batch_multiplier,
          ing.unit,
          ing.stock_unit,
          ing.unit_weight
        )

        updateStock.run(deductQuantity, ing.inventory_item_id)
        insertMovement.run(
          ing.inventory_item_id,
          deductQuantity,
          `Производство: ${recipe.name_uk} (x${batch_multiplier})`
        )
      }

      // Добавить готовую продукцию
      const outputQuantity = recipe.output_quantity * batch_multiplier
      
      db.prepare(`
        UPDATE inventory_items 
        SET current_stock = current_stock + ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(outputQuantity, recipe.output_item_id)

      db.prepare(`
        INSERT INTO inventory_movements 
        (inventory_item_id, type, quantity, reason, created_at)
        VALUES (?, 'in', ?, ?, CURRENT_TIMESTAMP)
      `).run(
        recipe.output_item_id,
        outputQuantity,
        `Производство (x${batch_multiplier})`
      )

      // Зафиксировать транзакцию
      db.exec('COMMIT')

      return NextResponse.json({ 
        success: true,
        output: {
          item: recipe.name_uk,
          quantity: outputQuantity,
          unit: recipe.unit
        }
      })
    } catch (error) {
      // Откатить транзакцию при ошибке
      db.exec('ROLLBACK')
      throw error
    }
  } catch (error) {
    console.error('Error executing production:', error)
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}

// GET - получить историю производства
export async function GET(request: Request) {
  try {
    const db = getDatabase()
    
    if (!db) {
      return NextResponse.json({ success: false, error: 'Database not available' }, { status: 503 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')

    // Получить последние движения типа "in" с причиной "Производство"
    const history = db.prepare(`
      SELECT 
        im.*,
        ii.name_uk,
        ii.name_lt,
        ii.unit
      FROM inventory_movements im
      LEFT JOIN inventory_items ii ON im.inventory_item_id = ii.id
      WHERE im.type = 'in' AND im.reason LIKE 'Производство%'
      ORDER BY im.created_at DESC
      LIMIT ?
    `).all(limit)

    return NextResponse.json({ success: true, history })
  } catch (error) {
    console.error('Error fetching production history:', error)
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}
