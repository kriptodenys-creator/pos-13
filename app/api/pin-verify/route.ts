import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/database'
import { createAdminSessionToken, getAdminSessionCookieName } from '@/lib/adminAuth'

export async function POST(request: NextRequest) {
  try {
    const { pin } = await request.json()
    
    if (!pin) {
      return NextResponse.json({ success: false, error: 'PIN required' }, { status: 400 })
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
    
    // Получаем сохраненный PIN
    const setting = db.prepare('SELECT value FROM admin_settings WHERE key = ?').get('admin_pin') as any
    
    // Если PIN не установлен, используем дефолтный
    const storedPin = setting?.value || '1234'
    
    if (pin === storedPin) {
      // Логируем успешный вход
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
        `).run('verify', pin.substring(0, 2) + '**', 1)
      } catch (e) {
        console.error('[PIN] Error logging:', e)
      }
      
      const res = NextResponse.json({ success: true })
      const cookieName = getAdminSessionCookieName()
      const token = await createAdminSessionToken(24 * 60 * 60)
      res.cookies.set(cookieName, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 24 * 60 * 60,
      })
      return res
    } else {
      // Логируем неудачную попытку
      try {
        db.prepare(`
          INSERT INTO pin_logs (action, pin_used, success)
          VALUES (?, ?, ?)
        `).run('verify', pin.substring(0, 2) + '**', 0)
      } catch (e) {
        console.error('[PIN] Error logging:', e)
      }
      
      return NextResponse.json({ success: false, error: 'Invalid PIN' }, { status: 403 })
    }
  } catch (error) {
    console.error('[PIN] Verification error:', error)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}
