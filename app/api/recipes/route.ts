import { getDatabase } from "@/lib/database"

// GET - получить рецепты для блюда или все рецепты
export async function GET(request: Request) {
  try {
    const db = getDatabase()
    
    // Перевіряємо та додаємо колонку recipe_unit якщо не існує
    try {
      const columns = db.prepare("PRAGMA table_info(recipe_ingredients)").all() as any[]
      const hasRecipeUnit = columns.some((col: any) => col.name === 'recipe_unit')
      
      if (!hasRecipeUnit) {
        db.exec("ALTER TABLE recipe_ingredients ADD COLUMN recipe_unit TEXT DEFAULT 'g'")
        console.log('[API] Added recipe_unit column to recipe_ingredients')
      }
    } catch (e) {
      console.warn('[API] Error checking recipe_unit column:', e)
    }
    
    const url = new URL(request.url)
    const menuItemId = url.searchParams.get('menu_item_id')

    if (menuItemId) {
      // Получить рецепт для конкретного блюда
      const recipe = db.prepare(`
        SELECT r.*, mi.name_uk as menu_item_name_uk, mi.name_lt as menu_item_name_lt
        FROM recipes r
        JOIN menu_items mi ON r.menu_item_id = mi.id
        WHERE r.menu_item_id = ?
      `).get(menuItemId) as any

      if (!recipe) {
        return Response.json({ recipe: null, ingredients: [] })
      }

      // Получить ингредиенты рецепта
      const ingredients = db.prepare(`
        SELECT 
          ri.*,
          ii.name_uk as ingredient_name_uk,
          ii.name_lt as ingredient_name_lt,
          ii.unit,
          ii.unit_weight,
          ii.current_stock,
          ii.cost_per_unit
        FROM recipe_ingredients ri
        JOIN inventory_items ii ON ri.inventory_item_id = ii.id
        WHERE ri.recipe_id = ?
      `).all(recipe.id)

      return Response.json({ recipe, ingredients })
    }

    // Получить все рецепты с ингредиентами
    const recipes = db.prepare(`
      SELECT 
        r.*,
        mi.name_uk as menu_item_name_uk,
        mi.name_lt as menu_item_name_lt,
        mi.price as menu_item_price
      FROM recipes r
      JOIN menu_items mi ON r.menu_item_id = mi.id
      ORDER BY mi.name_uk
    `).all()

    // Получить ингредиенты для каждого рецепта
    const recipesWithIngredients = recipes.map((recipe: any) => {
      const ingredients = db.prepare(`
        SELECT 
          ri.*,
          ii.name_uk as ingredient_name_uk,
          ii.name_lt as ingredient_name_lt,
          ii.unit,
          ii.unit_weight,
          ii.cost_per_unit
        FROM recipe_ingredients ri
        JOIN inventory_items ii ON ri.inventory_item_id = ii.id
        WHERE ri.recipe_id = ?
      `).all(recipe.id)

      const totalCost = ingredients.reduce((sum: number, ing: any) => 
        sum + (ing.quantity * (ing.cost_per_unit || 0)), 0)

      return {
        ...recipe,
        ingredients,
        totalCost
      }
    })

    return Response.json({ recipes: recipesWithIngredients })
  } catch (error) {
    console.error('[API] Error getting recipes:', error)
    return Response.json({ error: 'Failed to get recipes' }, { status: 500 })
  }
}

// POST - создать или обновить рецепт
export async function POST(request: Request) {
  try {
    const db = getDatabase()
    const body = await request.json()
    const { menu_item_id, ingredients } = body

    if (!menu_item_id) {
      return Response.json({ error: 'menu_item_id is required' }, { status: 400 })
    }

    if (!ingredients || !Array.isArray(ingredients)) {
      return Response.json({ error: 'ingredients array is required' }, { status: 400 })
    }

    // Перевіряємо структуру таблиці recipes
    try {
      const columns = db.prepare("PRAGMA table_info(recipes)").all() as any[]
      console.log('[API] recipes columns:', columns)
    } catch (e) {
      console.error('[API] Error checking recipes table:', e)
    }

    const transaction = db.transaction(() => {
      // Проверяем, существует ли уже рецепт для этого блюда
      let recipe = db.prepare(`SELECT id FROM recipes WHERE menu_item_id = ?`).get(menu_item_id) as any

      if (!recipe) {
        // Создаем новый рецепт - id має бути INTEGER, тому не вказуємо його (автоінкремент)
        db.prepare(`
          INSERT INTO recipes (menu_item_id)
          VALUES (?)
        `).run(String(menu_item_id))
        
        // Отримуємо створений рецепт
        recipe = db.prepare(`SELECT id FROM recipes WHERE menu_item_id = ?`).get(menu_item_id) as any
      }

      // Удаляем старые ингредиенты
      db.prepare(`DELETE FROM recipe_ingredients WHERE recipe_id = ?`).run(recipe.id)

      // Добавляем новые ингредиенты - id має бути INTEGER з автоінкрементом
      const insertIngredient = db.prepare(`
        INSERT INTO recipe_ingredients (recipe_id, inventory_item_id, quantity, recipe_unit)
        VALUES (?, ?, ?, ?)
      `)

      for (const ing of ingredients) {
        if (ing.inventory_item_id && ing.quantity > 0) {
          const recipeUnit = ing.recipe_unit || 'g'
          insertIngredient.run(recipe.id, ing.inventory_item_id, ing.quantity, recipeUnit)
        }
      }

      return recipe.id
    })

    const recipeId = transaction()
    return Response.json({ success: true, recipe_id: recipeId, message: 'Recipe saved successfully' })
  } catch (error) {
    console.error('[API] Error saving recipe:', error)
    return Response.json({ error: 'Failed to save recipe' }, { status: 500 })
  }
}

// DELETE - удалить рецепт
export async function DELETE(request: Request) {
  try {
    const db = getDatabase()
    const url = new URL(request.url)
    const menuItemId = url.searchParams.get('menu_item_id')

    if (!menuItemId) {
      return Response.json({ error: 'menu_item_id is required' }, { status: 400 })
    }

    const recipe = db.prepare(`SELECT id FROM recipes WHERE menu_item_id = ?`).get(menuItemId) as any
    
    if (!recipe) {
      return Response.json({ error: 'Recipe not found' }, { status: 404 })
    }

    const transaction = db.transaction(() => {
      db.prepare(`DELETE FROM recipe_ingredients WHERE recipe_id = ?`).run(recipe.id)
      db.prepare(`DELETE FROM recipes WHERE id = ?`).run(recipe.id)
    })

    transaction()
    return Response.json({ success: true, message: 'Recipe deleted successfully' })
  } catch (error) {
    console.error('[API] Error deleting recipe:', error)
    return Response.json({ error: 'Failed to delete recipe' }, { status: 500 })
  }
}
