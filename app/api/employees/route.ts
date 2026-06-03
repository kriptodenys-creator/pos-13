import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/database'

 function getEmployeesColumns(db: any) {
   const cols = db.prepare('PRAGMA table_info(employees)').all() as any[]
   const has = (name: string) => cols.some((c) => String(c.name) === name)
   return { cols, has }
 }

function ensureEmployeesTable(db: any) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      pin TEXT NOT NULL,
      discount_percent REAL NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  try {
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_pin ON employees(pin)')
  } catch {
    // ignore
  }

  const { has } = getEmployeesColumns(db)

  if (!has('discount_percent')) {
    try {
      db.exec('ALTER TABLE employees ADD COLUMN discount_percent REAL')
    } catch {}
  }

  if (!has('is_active')) {
    try {
      db.exec('ALTER TABLE employees ADD COLUMN is_active INTEGER')
    } catch {}
  }

  if (!has('created_at')) {
    try {
      db.exec('ALTER TABLE employees ADD COLUMN created_at TEXT')
    } catch {}
  }

  if (!has('updated_at')) {
    try {
      db.exec('ALTER TABLE employees ADD COLUMN updated_at TEXT')
    } catch {}
  }

  const { has: has2 } = getEmployeesColumns(db)
  if (has2('discount_percent')) {
    try {
      db.exec('UPDATE employees SET discount_percent = 0 WHERE discount_percent IS NULL')
    } catch {}
  }
  if (has2('is_active')) {
    try {
      db.exec('UPDATE employees SET is_active = 1 WHERE is_active IS NULL')
    } catch {}
  }
  if (has2('created_at')) {
    try {
      db.exec('UPDATE employees SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL')
    } catch {}
  }
  if (has2('updated_at')) {
    try {
      db.exec('UPDATE employees SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL')
    } catch {}
  }
}

function normalizePin(pin: unknown) {
  const s = String(pin ?? '').trim()
  return s.replace(/\D/g, '')
}

export async function GET() {
  try {
    const db = getDatabase()
    ensureEmployeesTable(db)

    const { has } = getEmployeesColumns(db)
    const select = [
      'id',
      'name',
      has('discount_percent') ? 'discount_percent' : '0 as discount_percent',
      has('is_active') ? 'is_active' : '1 as is_active',
      has('created_at') ? 'created_at' : 'NULL as created_at',
      has('updated_at') ? 'updated_at' : 'NULL as updated_at'
    ].join(', ')

    const orderBy = has('is_active') ? 'is_active DESC, name ASC' : 'name ASC'
    const employees = db.prepare(`SELECT ${select} FROM employees ORDER BY ${orderBy}`).all()

    return NextResponse.json({ success: true, employees })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const action = String(body?.action || '')

    const db = getDatabase()
    ensureEmployeesTable(db)
    const cols = getEmployeesColumns(db)

    if (action === 'verify') {
      const pin = normalizePin(body?.pin)
      if (!pin || pin.length < 4) {
        return NextResponse.json({ success: false, error: 'PIN required (min 4 digits)' }, { status: 400 })
      }

      const select = [
        'id',
        'name',
        cols.has('discount_percent') ? 'COALESCE(discount_percent, 0) as discount_percent' : '0 as discount_percent'
      ].join(', ')

      const whereActive = cols.has('is_active') ? 'AND COALESCE(is_active, 1) = 1' : ''

      const employee = db
        .prepare(`SELECT ${select} FROM employees WHERE pin = ? ${whereActive} LIMIT 1`)
        .get(pin)

      if (!employee) {
        return NextResponse.json({ success: false, error: 'Invalid PIN' }, { status: 403 })
      }

      return NextResponse.json({ success: true, employee })
    }

    if (action === 'create') {
      const name = String(body?.name ?? '').trim()
      const pin = normalizePin(body?.pin)
      const discountPercent = Number(body?.discount_percent)

      if (!name) {
        return NextResponse.json({ success: false, error: 'Name required' }, { status: 400 })
      }
      if (!pin || pin.length < 4) {
        return NextResponse.json({ success: false, error: 'PIN required (min 4 digits)' }, { status: 400 })
      }
      if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
        return NextResponse.json({ success: false, error: 'discount_percent must be 0..100' }, { status: 400 })
      }

      const insertCols: string[] = ['name', 'pin']
      const valuesSql: string[] = ['?', '?']
      const params: any[] = [name, pin]

      if (cols.has('discount_percent')) {
        insertCols.push('discount_percent')
        valuesSql.push('?')
        params.push(discountPercent)
      }

      if (cols.has('is_active')) {
        insertCols.push('is_active')
        valuesSql.push('1')
      }

      if (cols.has('created_at')) {
        insertCols.push('created_at')
        valuesSql.push('CURRENT_TIMESTAMP')
      }

      if (cols.has('updated_at')) {
        insertCols.push('updated_at')
        valuesSql.push('CURRENT_TIMESTAMP')
      }

      const res = db.prepare(`INSERT INTO employees (${insertCols.join(', ')}) VALUES (${valuesSql.join(', ')})`).run(...params)

      return NextResponse.json({ success: true, id: res.lastInsertRowid })
    }

    if (action === 'update') {
      const id = Number(body?.id)
      if (!Number.isFinite(id)) {
        return NextResponse.json({ success: false, error: 'Invalid id' }, { status: 400 })
      }

      const name = String(body?.name ?? '').trim()
      const pinRaw = body?.pin
      const pin = pinRaw === undefined ? undefined : normalizePin(pinRaw)
      const discountPercentRaw = body?.discount_percent
      const isActiveRaw = body?.is_active

      if (name === '') {
        return NextResponse.json({ success: false, error: 'Name required' }, { status: 400 })
      }

      const fields: string[] = []
      const params: any[] = []

      if (name) {
        fields.push('name = ?')
        params.push(name)
      }

      if (pin !== undefined) {
        if (!pin || pin.length < 4) {
          return NextResponse.json({ success: false, error: 'PIN must be min 4 digits' }, { status: 400 })
        }
        fields.push('pin = ?')
        params.push(pin)
      }

      if (discountPercentRaw !== undefined) {
        const discountPercent = Number(discountPercentRaw)
        if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
          return NextResponse.json({ success: false, error: 'discount_percent must be 0..100' }, { status: 400 })
        }
        fields.push('discount_percent = ?')
        params.push(discountPercent)
      }

      if (isActiveRaw !== undefined) {
        const isActive = isActiveRaw ? 1 : 0
        if (cols.has('is_active')) {
          fields.push('is_active = ?')
          params.push(isActive)
        }
      }

      if (cols.has('updated_at')) {
        fields.push('updated_at = CURRENT_TIMESTAMP')
      }

      if (fields.length === 0) {
        return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 })
      }

      const sql = `UPDATE employees SET ${fields.join(', ')} WHERE id = ?`
      params.push(id)

      const result = db.prepare(sql).run(...params)

      if (result.changes === 0) {
        return NextResponse.json({ success: false, error: 'Employee not found' }, { status: 404 })
      }

      return NextResponse.json({ success: true, id })
    }

    if (action === 'delete') {
      const id = Number(body?.id)
      if (!Number.isFinite(id)) {
        return NextResponse.json({ success: false, error: 'Invalid id' }, { status: 400 })
      }

      const result = db.prepare('DELETE FROM employees WHERE id = ?').run(id)
      if (result.changes === 0) {
        return NextResponse.json({ success: false, error: 'Employee not found' }, { status: 404 })
      }

      return NextResponse.json({ success: true, id })
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
