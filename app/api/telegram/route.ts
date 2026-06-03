import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/database'

// GET - отримати налаштування Telegram
export async function GET() {
  try {
    const db = getDatabase()
    
    // Створюємо таблицю якщо не існує
    db.exec(`
      CREATE TABLE IF NOT EXISTS telegram_settings (
        id INTEGER PRIMARY KEY,
        bot_token TEXT,
        chat_id TEXT,
        enabled INTEGER DEFAULT 0,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `)
    
    const settings = db.prepare('SELECT * FROM telegram_settings WHERE id = 1').get() as any
    
    return NextResponse.json({
      success: true,
      settings: settings || { bot_token: '', chat_id: '', enabled: false }
    })
  } catch (error) {
    console.error('[Telegram API] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to get settings' }, { status: 500 })
  }
}

// POST - зберегти налаштування або відправити сповіщення
export async function POST(request: Request) {
  try {
    const db = getDatabase()
    const body = await request.json()
    const { action } = body
    
    // Створюємо таблицю якщо не існує
    db.exec(`
      CREATE TABLE IF NOT EXISTS telegram_settings (
        id INTEGER PRIMARY KEY,
        bot_token TEXT,
        chat_id TEXT,
        enabled INTEGER DEFAULT 0,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `)
    
    if (action === 'save_settings') {
      const { bot_token, chat_id, enabled } = body
      
      const existing = db.prepare('SELECT id FROM telegram_settings WHERE id = 1').get()
      
      if (existing) {
        db.prepare(`
          UPDATE telegram_settings 
          SET bot_token = ?, chat_id = ?, enabled = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = 1
        `).run(bot_token, chat_id, enabled ? 1 : 0)
      } else {
        db.prepare(`
          INSERT INTO telegram_settings (id, bot_token, chat_id, enabled)
          VALUES (1, ?, ?, ?)
        `).run(bot_token, chat_id, enabled ? 1 : 0)
      }
      
      return NextResponse.json({ success: true, message: 'Settings saved' })
    }
    
    if (action === 'send_low_stock') {
      // Отримуємо налаштування
      const settings = db.prepare('SELECT * FROM telegram_settings WHERE id = 1').get() as any
      
      if (!settings || !settings.bot_token || !settings.chat_id) {
        return NextResponse.json({ 
          success: false, 
          error: 'Telegram не налаштовано. Введіть Bot Token та Chat ID.' 
        }, { status: 400 })
      }
      
      // Отримуємо товари з низькими залишками
      const lowStockItems = db.prepare(`
        SELECT name_uk, current_stock, min_stock, unit 
        FROM inventory_items 
        WHERE current_stock <= min_stock
        ORDER BY current_stock ASC
      `).all() as any[]
      
      if (lowStockItems.length === 0) {
        return NextResponse.json({ 
          success: true, 
          message: 'Немає товарів з низькими залишками' 
        })
      }
      
      const telegramUrl = `https://api.telegram.org/bot${settings.bot_token}/sendMessage`
      const MAX_MESSAGE_LENGTH = 4000 // Telegram limit is 4096, leave some margin
      
      // Формуємо повідомлення по частинах
      const messages: string[] = []
      let currentMessage = `⚠️ *УВАГА! Низькі залишки на складі*\n\n`
      currentMessage += `📦 Товарів з критичними залишками: *${lowStockItems.length}*\n\n`
      
      let messageCount = 1
      
      for (let i = 0; i < lowStockItems.length; i++) {
        const item = lowStockItems[i]
        const status = item.current_stock <= 0 ? '🔴' : '🟡'
        const itemText = `${status} *${item.name_uk}*\n   Залишок: ${item.current_stock.toFixed(1)} ${item.unit} (мін: ${item.min_stock} ${item.unit})\n\n`
        
        // Перевіряємо чи не перевищить ліміт
        if ((currentMessage + itemText).length > MAX_MESSAGE_LENGTH) {
          // Додаємо footer до поточного повідомлення
          currentMessage += `\n_Частина ${messageCount}..._`
          messages.push(currentMessage)
          
          // Починаємо нове повідомлення
          messageCount++
          currentMessage = `⚠️ *Низькі залишки (продовження ${messageCount})*\n\n`
        }
        
        currentMessage += itemText
      }
      
      // Додаємо останнє повідомлення з датою
      currentMessage += `\n📅 ${new Date().toLocaleString('uk-UA')}`
      messages.push(currentMessage)
      
      // Відправляємо всі повідомлення
      let sentCount = 0
      for (const message of messages) {
        const response = await fetch(telegramUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: settings.chat_id,
            text: message,
            parse_mode: 'Markdown'
          })
        })
        
        const result = await response.json()
        
        if (!result.ok) {
          console.error('[Telegram API] Send error:', result)
          return NextResponse.json({ 
            success: false, 
            error: `Помилка Telegram (повідомлення ${sentCount + 1}/${messages.length}): ${result.description || 'Unknown error'}` 
          }, { status: 400 })
        }
        
        sentCount++
        
        // Невелика затримка між повідомленнями
        if (sentCount < messages.length) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }
      
      return NextResponse.json({ 
        success: true, 
        message: `Сповіщення відправлено! (${lowStockItems.length} товарів у ${messages.length} ${messages.length === 1 ? 'повідомленні' : 'повідомленнях'})` 
      })
    }
    
    if (action === 'test') {
      const { bot_token, chat_id } = body
      
      if (!bot_token || !chat_id) {
        return NextResponse.json({ 
          success: false, 
          error: 'Введіть Bot Token та Chat ID' 
        }, { status: 400 })
      }
      
      const telegramUrl = `https://api.telegram.org/bot${bot_token}/sendMessage`
      
      const response = await fetch(telegramUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chat_id,
          text: '✅ Тестове повідомлення від POS системи!\n\nНалаштування Telegram працюють коректно.',
          parse_mode: 'Markdown'
        })
      })
      
      const result = await response.json()
      
      if (!result.ok) {
        return NextResponse.json({ 
          success: false, 
          error: `Помилка: ${result.description || 'Перевірте Bot Token та Chat ID'}` 
        }, { status: 400 })
      }
      
      return NextResponse.json({ success: true, message: 'Тестове повідомлення відправлено!' })
    }
    
    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('[Telegram API] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to process request' }, { status: 500 })
  }
}
