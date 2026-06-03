import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/database'

export async function GET() {
  try {
    const db = getDatabase()
    
    // Проверяем какие колонки существуют в таблице modifiers
    const columns = db.prepare("PRAGMA table_info(modifiers)").all() as any[]
    const hasMenuItemId = columns.some((c) => c.name === 'menu_item_id')
    const hasGroupName = columns.some((c) => c.name === 'group_name')
    
    // Добавляем недостающие колонки если их нет
    if (!hasGroupName) {
      try {
        db.exec(`ALTER TABLE modifiers ADD COLUMN group_name TEXT`)
      } catch (e) {
        // Колонка уже существует или другая ошибка
      }
    }
    
    if (!hasMenuItemId) {
      try {
        db.exec(`ALTER TABLE modifiers ADD COLUMN menu_item_id TEXT`)
      } catch (e) {
        // Колонка уже существует или другая ошибка
      }
    }
    
    // Получаем все модификаторы с их опциями
    const modifiers = db.prepare(`
      SELECT 
        m.id,
        m.name_lt,
        m.name_uk,
        m.price,
        m.type,
        m.required,
        ${hasGroupName ? 'm.group_name,' : ''}
        ${hasMenuItemId ? 'm.menu_item_id,' : ''}
        m.created_at
      FROM modifiers m
      ORDER BY m.created_at DESC
    `).all()

    // Для каждого модификатора получаем его опции
    const modifiersWithOptions = modifiers.map((modifier: any) => {
      const options = db.prepare(`
        SELECT id, name_lt, name_uk, price
        FROM modifier_options 
        WHERE modifier_id = ?
        ORDER BY name_uk
      `).all(modifier.id)

      const result: any = {
        id: modifier.id,
        name_lt: modifier.name_lt,
        name_uk: modifier.name_uk,
        price: modifier.price,
        type: modifier.type,
        required: modifier.required,
        created_at: modifier.created_at,
        options: options || []
      }
      
      if (hasGroupName && modifier.group_name !== undefined) {
        result.group_name = modifier.group_name
      }
      
      if (hasMenuItemId && modifier.menu_item_id !== undefined) {
        result.menu_item_id = modifier.menu_item_id
      }
      
      return result
    })

    return NextResponse.json({
      success: true,
      modifiers: modifiersWithOptions,
      count: modifiers.length
    })

  } catch (error) {
    console.error('Error fetching modifiers:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch modifiers' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name_lt, name_uk, price, type, required, menu_item_id, group_name, options } = body

    if (!name_lt || !name_uk) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: name_lt, name_uk' },
        { status: 400 }
      )
    }

    const db = getDatabase()
    
    // Проверяем какие колонки существуют в таблице modifiers
    const columns = db.prepare("PRAGMA table_info(modifiers)").all() as any[]
    const hasMenuItemId = columns.some((c) => c.name === 'menu_item_id')
    const hasGroupName = columns.some((c) => c.name === 'group_name')
    
    // Добавляем недостающие колонки если их нет
    if (!hasGroupName) {
      try {
        db.exec(`ALTER TABLE modifiers ADD COLUMN group_name TEXT`)
      } catch (e) {
        // Колонка уже существует
      }
    }
    
    if (!hasMenuItemId) {
      try {
        db.exec(`ALTER TABLE modifiers ADD COLUMN menu_item_id TEXT`)
      } catch (e) {
        // Колонка уже существует
      }
    }
    
    // Начинаем транзакцию
    const transaction = db.transaction(() => {
      // Создаем модификатор с учетом доступных колонок
      let insertSQL = `INSERT INTO modifiers (name_lt, name_uk, price, type, required`
      let values = [name_lt, name_uk, parseFloat(price || '0') || 0, type || 'addon', required ? 1 : 0]
      
      if (hasGroupName) {
        insertSQL += `, group_name`
        values.push(group_name || null)
      }
      
      if (hasMenuItemId) {
        insertSQL += `, menu_item_id`
        values.push(menu_item_id || null)
      }
      
      insertSQL += `) VALUES (${values.map(() => '?').join(', ')})`
      
      const modifierResult = db.prepare(insertSQL).run(...values)

      const modifierId = modifierResult.lastInsertRowid

      // Добавляем опции если есть
      if (options && Array.isArray(options)) {
        const insertOption = db.prepare(`
          INSERT INTO modifier_options (modifier_id, name_lt, name_uk, price)
          VALUES (?, ?, ?, ?)
        `)

        for (const option of options) {
          if (option.name_lt && option.name_uk) {
            insertOption.run(
              modifierId, 
              option.name_lt, 
              option.name_uk, 
              parseFloat(option.price || '0') || 0
            )
          }
        }
      }

      return modifierId
    })

    const modifierId = transaction()

    const responseModifier: any = {
      id: modifierId,
      name_lt,
      name_uk,
      price: parseFloat(price || '0') || 0,
      type: type || 'addon',
      required: required ? 1 : 0
    }
    
    if (hasGroupName) {
      responseModifier.group_name = group_name
    }
    
    if (hasMenuItemId) {
      responseModifier.menu_item_id = menu_item_id
    }

    return NextResponse.json({
      success: true,
      modifier: responseModifier
    })

  } catch (error) {
    console.error('Error creating modifier:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create modifier' },
      { status: 500 }
    )
  }
}
