import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/database'

export async function POST(request: NextRequest) {
  try {
    const { currentPin, newPin } = await request.json()
    
    if (!currentPin || !newPin) {
      return NextResponse.json({ success: false, error: 'Current and new PIN required' }, { status: 400 })
    }
    
    if (newPin.length < 4) {
      return NextResponse.json({ success: false, error: 'PIN must be at least 4 characters' }, { status: 400 })
    }
    
    const db = getDatabase()
    
    // Перевіряємо поточний PIN
    const setting = db.prepare('SELECT value FROM admin_settings WHERE key = ?').get('admin_pin') as any
    const storedPin = setting?.value || '1234'
    
    if (currentPin !== storedPin) {
      // Логуємо невдалу спробу
      try {
        db.prepare(`
          INSERT INTO pin_logs (action, pin_used, success)
          VALUES (?, ?, ?)
        `).run('change_pin_failed', currentPin.substring(0, 2) + '**', 0)
      } catch (e) {
        console.error('[PIN] Error logging:', e)
      }
      
      return NextResponse.json({ success: false, error: 'Current PIN is incorrect' }, { status: 403 })
    }
    
    // Оновлюємо PIN
    if (setting) {
      db.prepare(`
        UPDATE admin_settings 
        SET value = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE key = ?
      `).run(newPin, 'admin_pin')
    } else {
      db.prepare(`
        INSERT INTO admin_settings (key, value) 
        VALUES (?, ?)
      `).run('admin_pin', newPin)
    }
    
    // Логуємо успішну зміну
    try {
      db.prepare(`
        INSERT INTO pin_logs (action, pin_used, success)
        VALUES (?, ?, ?)
      `).run('change_pin_success', newPin.substring(0, 2) + '**', 1)
    } catch (e) {
      console.error('[PIN] Error logging:', e)
    }
    
    console.log('[PIN] PIN changed successfully')
    
    return NextResponse.json({ success: true, message: 'PIN changed successfully' })
  } catch (error) {
    console.error('[PIN] Change PIN error:', error)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}
