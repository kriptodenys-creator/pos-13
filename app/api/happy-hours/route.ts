import { getDatabase } from "@/lib/database"

function getHappyHoursColumns(db: any): Array<{ name: string; notnull: boolean }> {
  try {
    return (db.prepare("PRAGMA table_info(happy_hours)").all() as any[]).map((c) => ({
      name: String((c as any).name),
      notnull: Boolean((c as any).notnull),
    }))
  } catch {
    return []
  }
}

function ensureHappyHoursSchema(db: any) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS happy_hours (
      id TEXT PRIMARY KEY,
      item_id TEXT,
      category_id TEXT,
      discount_percent REAL NOT NULL,
      start_time TEXT,
      end_time TEXT,
      day_of_week INTEGER,
      active BOOLEAN DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  const columns = db.prepare("PRAGMA table_info(happy_hours)").all() as any[]
  const has = (name: string) => columns.some((c) => String(c.name) === name)

  if (!has('item_id')) {
    try {
      db.exec('ALTER TABLE happy_hours ADD COLUMN item_id TEXT')
    } catch {}
  }

  if (!has('category_id')) {
    try {
      db.exec('ALTER TABLE happy_hours ADD COLUMN category_id TEXT')
    } catch {}
  }

  if (!has('discount_percent')) {
    try {
      db.exec('ALTER TABLE happy_hours ADD COLUMN discount_percent REAL DEFAULT 0')
    } catch {}
  }

  if (!has('start_time')) {
    try {
      db.exec('ALTER TABLE happy_hours ADD COLUMN start_time TEXT')
    } catch {}
  }

  if (!has('end_time')) {
    try {
      db.exec('ALTER TABLE happy_hours ADD COLUMN end_time TEXT')
    } catch {}
  }

  if (!has('day_of_week')) {
    try {
      db.exec('ALTER TABLE happy_hours ADD COLUMN day_of_week INTEGER')
    } catch {}
  }

  // Legacy schema compatibility: some DBs use days_of_week (plural) and may enforce NOT NULL.
  if (!has('days_of_week')) {
    try {
      db.exec('ALTER TABLE happy_hours ADD COLUMN days_of_week INTEGER')
    } catch {}
  }

  if (!has('active')) {
    try {
      db.exec('ALTER TABLE happy_hours ADD COLUMN active BOOLEAN DEFAULT 1')
    } catch {}
  }
  if (!has('created_at')) {
    try {
      db.exec('ALTER TABLE happy_hours ADD COLUMN created_at TEXT DEFAULT CURRENT_TIMESTAMP')
    } catch {}
  }
  if (!has('updated_at')) {
    try {
      db.exec('ALTER TABLE happy_hours ADD COLUMN updated_at TEXT DEFAULT CURRENT_TIMESTAMP')
    } catch {}
  }
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text()
    if (!rawBody || rawBody.trim().length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'Empty request body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    let body: any
    try {
      body = JSON.parse(rawBody)
    } catch {
      return new Response(JSON.stringify({ success: false, error: 'Invalid JSON body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const db = getDatabase()

    ensureHappyHoursSchema(db)

    const schemaCols = getHappyHoursColumns(db)
    const hasSchemaCol = (name: string) => schemaCols.some((c) => c.name === name)
    const isSchemaNotNull = (name: string) => schemaCols.some((c) => c.name === name && c.notnull)
    const dayColumn = hasSchemaCol('days_of_week') ? 'days_of_week' : 'day_of_week'

    if (!db) {
      return new Response(JSON.stringify({ success: false, error: 'Database not available' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Проверка скидок счастливых часов
    if (body.action === 'checkDiscounts') {
      try {
        const items = body.items || []
        const discounts: Record<string, number> = {}

        // Получаем текущее время
        const now = new Date()
        const dayOfWeek = now.getDay() // 0 = воскресенье, 1 = понедельник и т.д.
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

        // Получаем все скидки счастливых часов
        let happyHours: any[] = []
        try {
          const happyHoursStmt = db.prepare(`
            SELECT id, item_id, category_id, discount_percent, start_time, end_time, ${dayColumn} as day_of_week
            FROM happy_hours
            WHERE active = 1
          `)
          happyHours = happyHoursStmt.all() as any[]
        } catch (tableError) {
          // Таблица может не существовать или быть пустой - это нормально
          console.log('[API] Happy hours table not ready yet, returning empty discounts')
          happyHours = []
        }

        // Проверяем каждый товар
        for (const item of items) {
          const itemIdStr = String((item && (item.id ?? item.itemId)) ?? '')
          const categoryIdStr = String((item && item.categoryId) ?? '')
          let maxDiscount = 0

          for (const hh of happyHours) {
            const hhItemIdStr = String((hh && hh.item_id) ?? '')
            const hhCategoryIdStr = String((hh && hh.category_id) ?? '')
            const hhDay = hh && hh.day_of_week !== undefined && hh.day_of_week !== null ? Number(hh.day_of_week) : null

            // Проверяем день недели
            // Legacy: when days_of_week is NOT NULL we store 7 as 'any day'
            if (hhDay !== null && hhDay !== 7 && hhDay !== dayOfWeek) {
              continue
            }

            // Проверяем время
            if (hh.start_time && hh.end_time) {
              if (currentTime < hh.start_time || currentTime > hh.end_time) {
                continue
              }
            }

            // Проверяем применимость к товару
            if (hhItemIdStr && hhItemIdStr !== itemIdStr) {
              continue
            }

            if (hhCategoryIdStr && hhCategoryIdStr !== categoryIdStr) {
              continue
            }

            // Если скидка применима, берём максимальную
            if (hh.discount_percent > maxDiscount) {
              maxDiscount = hh.discount_percent
            }
          }

          if (maxDiscount > 0) {
            discounts[itemIdStr] = maxDiscount
          }
        }

        return new Response(JSON.stringify({ success: true, discounts }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      } catch (error) {
        console.error('[API] Error checking discounts:', error)
        return new Response(JSON.stringify({ success: false, error: 'Failed to check discounts' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    }

    // Получение всех счастливых часов
    if (body.action === 'getAll' || !body.action) {
      try {
        const stmt = db.prepare(`
          SELECT id, item_id, category_id, discount_percent, start_time, end_time, ${dayColumn} as day_of_week, active
          FROM happy_hours
          ORDER BY start_time ASC
        `)
        const happyHours = stmt.all()

        return new Response(JSON.stringify({ success: true, happyHours }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      } catch (error) {
        console.error('[API] Error getting happy hours:', error)
        return new Response(JSON.stringify({ success: false, error: 'Failed to get happy hours' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    }

    // Создание счастливых часов
    if (body.action === 'create') {
      try {
        const { item_id, category_id, discount_percent, start_time, end_time, day_of_week } = body

        const percentNum = Number(discount_percent)
        if (!Number.isFinite(percentNum) || percentNum <= 0 || percentNum > 100) {
          return new Response(JSON.stringify({ success: false, error: 'Invalid discount_percent (must be 1..100)' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        const itemId = item_id ? String(item_id) : null
        const categoryId = category_id ? String(category_id) : null
        if (!itemId && !categoryId) {
          return new Response(JSON.stringify({ success: false, error: 'Either item_id or category_id is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        const id = `hh_${Date.now()}_${Math.floor(Math.random() * 10000)}`

        const cols = schemaCols
        const hasCol = hasSchemaCol
        const isNotNull = isSchemaNotNull

        // Some existing databases have a legacy NOT NULL `name` column.
        const nameValue = `HH ${categoryId ? `cat:${categoryId}` : `item:${itemId}`}`

        const itemIdVal = itemId ?? (isNotNull('item_id') ? '' : null)
        const categoryIdVal = categoryId ?? (isNotNull('category_id') ? '' : null)
        const startTimeVal = start_time ? String(start_time) : (isNotNull('start_time') ? '' : null)
        const endTimeVal = end_time ? String(end_time) : (isNotNull('end_time') ? '' : null)
        const wantsAnyDay = day_of_week === null || day_of_week === undefined
        const dayOfWeekValRaw = wantsAnyDay ? null : Number(day_of_week)
        const dayOfWeekVal =
          dayOfWeekValRaw !== null && Number.isFinite(dayOfWeekValRaw)
            ? dayOfWeekValRaw
            : (dayColumn === 'days_of_week' ? 7 : (isNotNull(dayColumn) ? 7 : null))

        const runInsert = (withName: boolean) => {
          const sql = withName
            ? `
                INSERT INTO happy_hours (id, name, item_id, category_id, discount_percent, start_time, end_time, ${dayColumn}, active)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
              `
            : `
                INSERT INTO happy_hours (id, item_id, category_id, discount_percent, start_time, end_time, ${dayColumn}, active)
                VALUES (?, ?, ?, ?, ?, ?, ?, 1)
              `

          const stmt = db.prepare(sql)
          if (withName) {
            const nameVal = nameValue || (isNotNull('name') ? 'HH' : '')
            return stmt.run(id, nameVal, itemIdVal, categoryIdVal, percentNum, startTimeVal, endTimeVal, dayOfWeekVal)
          }
          return stmt.run(id, itemIdVal, categoryIdVal, percentNum, startTimeVal, endTimeVal, dayOfWeekVal)
        }

        try {
          runInsert(hasCol('name'))
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          // If DB has legacy NOT NULL `name` constraint but PRAGMA didn't surface it, retry with name.
          if (!hasCol('name') && msg.includes('happy_hours.name')) {
            runInsert(true)
          } else {
            throw e
          }
        }

        return new Response(JSON.stringify({ success: true, id }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        })
      } catch (error) {
        console.error('[API] Error creating happy hours:', error)
        return new Response(JSON.stringify({
          success: false,
          error: `Failed to create happy hours: ${error instanceof Error ? error.message : String(error)}`
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    }

    // Обновление счастливых часов
    if (body.action === 'update') {
      try {
        const { id, discount_percent, start_time, end_time, day_of_week, active } = body

        const setParts: string[] = [
          'discount_percent = ?',
          'start_time = ?',
          'end_time = ?',
          'active = ?'
        ]

        // Keep both columns in sync if both exist
        if (hasSchemaCol('day_of_week')) setParts.push('day_of_week = ?')
        if (hasSchemaCol('days_of_week')) setParts.push('days_of_week = ?')

        const sql = `UPDATE happy_hours SET ${setParts.join(', ')} WHERE id = ?`
        const stmt = db.prepare(sql)

        const wantsAnyDay = day_of_week === null || day_of_week === undefined
        const dayValue = wantsAnyDay
          ? (dayColumn === 'days_of_week' ? 7 : (isSchemaNotNull(dayColumn) ? 7 : null))
          : Number(day_of_week)

        const params: any[] = [
          Number(discount_percent),
          start_time ?? null,
          end_time ?? null,
          active ? 1 : 0,
        ]
        if (hasSchemaCol('day_of_week')) params.push(dayValue)
        if (hasSchemaCol('days_of_week')) params.push(dayValue)
        params.push(id)

        const result = stmt.run(...params)

        if (result.changes === 0) {
          return new Response(JSON.stringify({ success: false, error: 'Happy hours not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        return new Response(JSON.stringify({ success: true, id }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      } catch (error) {
        console.error('[API] Error updating happy hours:', error)
        return new Response(JSON.stringify({ success: false, error: 'Failed to update happy hours' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    }

    // Удаление счастливых часов
    if (body.action === 'delete') {
      try {
        const { id } = body

        const stmt = db.prepare('DELETE FROM happy_hours WHERE id = ?')
        const result = stmt.run(id)

        if (result.changes === 0) {
          return new Response(JSON.stringify({ success: false, error: 'Happy hours not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        return new Response(JSON.stringify({ success: true, id }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      } catch (error) {
        console.error('[API] Error deleting happy hours:', error)
        return new Response(JSON.stringify({ success: false, error: 'Failed to delete happy hours' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    }

    return new Response(JSON.stringify({ success: false, error: 'Unknown action' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[API] Error in happy-hours route:', error)
    return new Response(JSON.stringify({ success: false, error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
