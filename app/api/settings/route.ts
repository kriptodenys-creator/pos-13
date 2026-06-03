import { getDatabase } from "@/lib/database"

export async function GET(request: Request) {
  try {
    const db = getDatabase()
    
    if (!db) {
      return new Response(JSON.stringify({ success: false, error: 'Database not available' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Получаем все настройки
    const stmt = db.prepare(`
      SELECT key, value FROM settings
    `)
    const rows = stmt.all() as any[]
    
    const settings: Record<string, any> = {}
    for (const row of rows) {
      settings[row.key] = row.value
    }

    return new Response(JSON.stringify({ success: true, settings }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[API] Error getting settings:', error)
    return new Response(JSON.stringify({ success: false, error: 'Failed to get settings' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const db = getDatabase()
    
    if (!db) {
      return new Response(JSON.stringify({ success: false, error: 'Database not available' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Сохранение одной настройки
    if (body.action === 'set' || (body.key && body.value !== undefined)) {
      try {
        const key = body.key || body.action === 'set' ? body.key : null
        const value = body.value
        
        if (!key) {
          return new Response(JSON.stringify({ success: false, error: 'Missing key' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        const stmt = db.prepare(`
          INSERT OR REPLACE INTO settings (key, value)
          VALUES (?, ?)
        `)
        stmt.run(key, String(value))

        return new Response(JSON.stringify({ success: true, key, value }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      } catch (error) {
        console.error('[API] Error setting single setting:', error)
        return new Response(JSON.stringify({ success: false, error: 'Failed to set setting' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    }

    // Сохранение нескольких настроек
    if (body.action === 'saveMultiple' && body.settings) {
      try {
        const tx = db.transaction(() => {
          const stmt = db.prepare(`
            INSERT OR REPLACE INTO settings (key, value)
            VALUES (?, ?)
          `)
          
          for (const [key, value] of Object.entries(body.settings)) {
            stmt.run(key, String(value))
          }
        })
        
        tx()

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      } catch (error) {
        console.error('[API] Error saving multiple settings:', error)
        return new Response(JSON.stringify({ success: false, error: 'Failed to save settings' }), {
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
    console.error('[API] Error in settings route:', error)
    return new Response(JSON.stringify({ success: false, error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
