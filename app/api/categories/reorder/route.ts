import { NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/database"

export async function POST(request: NextRequest) {
  try {
    const { categories } = await request.json()
    
    if (!Array.isArray(categories)) {
      return NextResponse.json(
        { error: "Categories должен быть массивом" },
        { status: 400 }
      )
    }

    const db = getDatabase()
    
    // Обновляем порядок категорий
    const updateOrder = db.prepare(`
      UPDATE categories 
      SET order_index = ? 
      WHERE id = ?
    `)

    const transaction = db.transaction((categoriesData: Array<{id: string, order_index: number}>) => {
      for (const category of categoriesData) {
        updateOrder.run(category.order_index, category.id)
      }
    })

    transaction(categories)

    return NextResponse.json({ 
      success: true,
      message: "Порядок категорий обновлен" 
    })

  } catch (error) {
    console.error("Ошибка при изменении порядка категорий:", error)
    return NextResponse.json(
      { error: "Ошибка при изменении порядка категорий" },
      { status: 500 }
    )
  }
}
