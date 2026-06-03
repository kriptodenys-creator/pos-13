import { NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/database"

function ensureCategoriesSchema(db: any) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name_lt TEXT NOT NULL,
      name_uk TEXT NOT NULL,
      parent_id TEXT DEFAULT NULL,
      color TEXT DEFAULT '#6b7280',
      order_index INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  const columns = db.prepare("PRAGMA table_info(categories)").all() as any[]
  const has = (name: string) => columns.some((c) => String(c.name) === name)

  if (!has('color')) {
    try {
      db.exec("ALTER TABLE categories ADD COLUMN color TEXT DEFAULT '#6b7280'")
    } catch {}
  }

  if (!has('order_index')) {
    try {
      db.exec('ALTER TABLE categories ADD COLUMN order_index INTEGER DEFAULT 0')
    } catch {}
  }

  if (!has('parent_id')) {
    try {
      db.exec('ALTER TABLE categories ADD COLUMN parent_id TEXT DEFAULT NULL')
    } catch {}
  }

  if (!has('updated_at')) {
    try {
      db.exec('ALTER TABLE categories ADD COLUMN updated_at TEXT')
    } catch {}
  }
}

export async function GET() {
  try {
    const db = getDatabase()
    ensureCategoriesSchema(db)
    const categories = db.prepare("SELECT * FROM categories ORDER BY COALESCE(parent_id, ''), order_index ASC, created_at ASC").all()
    return new NextResponse(JSON.stringify(categories), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    })
  } catch (error) {
    console.error("Error fetching categories:", error)
    return new NextResponse(JSON.stringify({ error: "Failed to fetch categories" }), { 
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (body && body.action === 'updateOrder') {
      const categories = Array.isArray(body.categories) ? body.categories : []
      const db = getDatabase()
      ensureCategoriesSchema(db)
      const tx = db.transaction(() => {
        const stmt = db.prepare('UPDATE categories SET order_index = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        for (const c of categories) {
          const id = String(c?.id || '')
          if (!id) continue
          const order_index = Number(c?.order_index || 0)
          stmt.run(order_index, id)
        }
      })
      tx()
      return new NextResponse(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      })
    }

    const { name_lt, name_uk, parent_id } = body || {}
    
    if (!name_lt || !name_uk) {
      return new NextResponse(JSON.stringify({ error: "Name in both languages is required" }), { 
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      })
    }

    const db = getDatabase()
    ensureCategoriesSchema(db)
    
    // Получаем максимальный order_index (в пределах родителя)
    const parentId = parent_id ? String(parent_id) : null
    const maxOrderResult = parentId
      ? (db.prepare("SELECT MAX(order_index) as max_order FROM categories WHERE parent_id = ?").get(parentId) as any)
      : (db.prepare("SELECT MAX(order_index) as max_order FROM categories WHERE parent_id IS NULL").get() as any)
    const nextOrder = (maxOrderResult?.max_order || 0) + 1
    
    const id = `cat_${Date.now()}`
    
    const stmt = db.prepare(`
      INSERT INTO categories (id, name_lt, name_uk, parent_id, order_index) 
      VALUES (?, ?, ?, ?, ?)
    `)
    
    stmt.run(id, name_lt, name_uk, parentId, nextOrder)
    
    // Invalidate cache by sending a message to clients
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const channel = new BroadcastChannel('menu-updates')
        channel.postMessage({ type: 'categories-updated' })
        channel.close()
      } catch (e) {
        console.warn('Could not notify clients of category update:', e)
      }
    }
    
    return new NextResponse(JSON.stringify({ 
      success: true, 
      category: { id, name_lt, name_uk, parent_id: parentId, order_index: nextOrder }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  } catch (error) {
    console.error("Error creating category:", error)
    return new NextResponse(JSON.stringify({ error: "Failed to create category" }), { 
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { id, name_lt, name_uk, parent_id } = await request.json()
    
    if (!id || !name_lt || !name_uk) {
      return new NextResponse(JSON.stringify({ error: "ID and names are required" }), { 
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      })
    }

    const db = getDatabase()
    ensureCategoriesSchema(db)
    const stmt = db.prepare(`
      UPDATE categories 
      SET name_lt = ?, name_uk = ?, parent_id = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `)
    
    const parentId = parent_id ? String(parent_id) : null
    const result = stmt.run(name_lt, name_uk, parentId, id)
    
    if (result.changes === 0) {
      return new NextResponse(JSON.stringify({ error: "Category not found" }), { 
        status: 404,
        headers: {
          'Content-Type': 'application/json'
        }
      })
    }
    
    // Invalidate cache by sending a message to clients
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const channel = new BroadcastChannel('menu-updates')
        channel.postMessage({ type: 'categories-updated' })
        channel.close()
      } catch (e) {
        console.warn('Could not notify clients of category update:', e)
      }
    }
    
    return new NextResponse(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  } catch (error) {
    console.error("Error updating category:", error)
    const details = error instanceof Error ? error.message : String(error)
    return new NextResponse(JSON.stringify({ error: `Failed to update category: ${details}` }), { 
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return new NextResponse(JSON.stringify({ error: "Category ID is required" }), { 
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      })
    }

    const db = getDatabase()
    ensureCategoriesSchema(db)
    const tx = db.transaction(() => {
      db.prepare('UPDATE categories SET parent_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE parent_id = ?').run(id)
      const del = db.prepare("DELETE FROM categories WHERE id = ?").run(id)
      return del?.changes || 0
    })
    const changes = Number(tx() || 0)
    
    if (changes === 0) {
      return new NextResponse(JSON.stringify({ error: "Category not found" }), { 
        status: 404,
        headers: {
          'Content-Type': 'application/json'
        }
      })
    }
    
    // Invalidate cache by sending a message to clients
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const channel = new BroadcastChannel('menu-updates')
        channel.postMessage({ type: 'categories-updated' })
        channel.close()
      } catch (e) {
        console.warn('Could not notify clients of category update:', e)
      }
    }
    
    return new NextResponse(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  } catch (error) {
    console.error("Error deleting category:", error)
    return new NextResponse(JSON.stringify({ error: "Failed to delete category" }), { 
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  }
}