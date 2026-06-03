import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/database'

export async function POST(request: NextRequest) {
  try {
    const { currentPin, newPin } = await request.json()
    
    if (!currentPin || !newPin) {
      return NextResponse.json({ 
        success: false, 
        error: 'Current PIN and new PIN required' 
      }, { status: 400 })
    }
    
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      return NextResponse.json({ 
        success: false, 
        error: 'New PIN must be 4 digits' 
      }, { status: 400 })
    }
    
    const db = getDatabase()
    
    // Создаем таблицу настроек если её нет
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS admin_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `)
    } catch (e) {
      // Таблица уже существует
    }
    
    // Получаем текущий PIN
    const setting = db.prepare('SELECT value FROM admin_settings WHERE key = ?').get('admin_pin') as any
    const storedPin = setting?.value || '1234'
    
    // Проверяем текущий PIN
    if (currentPin !== storedPin) {
      // Логируем неудачную попытку
      try {
        db.exec(`
          CREATE TABLE IF NOT EXISTS pin_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action TEXT NOT NULL,
            pin_used TEXT NOT NULL,
            success INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `)
        
        db.prepare(`
          INSERT INTO pin_logs (action, pin_used, success)
          VALUES (?, ?, ?)
        `).run('change_pin_failed', currentPin.substring(0, 2) + '**', 0)
      } catch (e) {
        console.error('[PIN] Error logging:', e)
      }
      
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid current PIN' 
      }, { status: 403 })
    }
    
    // Обновляем PIN
    db.prepare(`
      INSERT OR REPLACE INTO admin_settings (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `).run('admin_pin', newPin)
    
    // Логируем успешное изменение
    try {
      db.prepare(`
        INSERT INTO pin_logs (action, pin_used, success)
        VALUES (?, ?, ?)
      `).run('change_pin_success', newPin.substring(0, 2) + '**', 1)
    } catch (e) {
      console.error('[PIN] Error logging:', e)
    }
    
    console.log('[PIN] PIN successfully changed')
    return NextResponse.json({ success: true, message: 'PIN changed successfully' })
  } catch (error) {
    console.error('[PIN] Change error:', error)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}
