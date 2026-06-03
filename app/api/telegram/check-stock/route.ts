import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/database'

// API для автоматичної перевірки залишків
export async function GET() {
  try {
    const db = getDatabase()
    
    // Отримуємо налаштування Telegram
    const settings = db.prepare('SELECT * FROM telegram_settings WHERE id = 1').get() as any
    
    if (!settings || !settings.enabled || !settings.bot_token || !settings.chat_id) {
      return NextResponse.json({ 
        success: false, 
        message: 'Telegram не налаштовано або вимкнено' 
      })
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
    
    // Формуємо повідомлення
    let message = `⚠️ *ЩОДЕННА ПЕРЕВІРКА СКЛАДУ*\n\n`
    message += `📦 Товарів з критичними залишками: *${lowStockItems.length}*\n\n`
    
    lowStockItems.forEach((item) => {
      const status = item.current_stock <= 0 ? '🔴' : '🟡'
      message += `${status} *${item.name_uk}*\n`
      message += `   Залишок: ${item.current_stock.toFixed(1)} ${item.unit} (мін: ${item.min_stock} ${item.unit})\n\n`
    })
    
    message += `\n📅 ${new Date().toLocaleString('uk-UA')}`
    
    // Відправляємо в Telegram
    const telegramUrl = `https://api.telegram.org/bot${settings.bot_token}/sendMessage`
    
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
      console.error('[Auto Check] Telegram error:', result)
      return NextResponse.json({ 
        success: false, 
        error: `Помилка Telegram: ${result.description}` 
      }, { status: 400 })
    }
    
    return NextResponse.json({ 
      success: true, 
      message: `Сповіщення відправлено! (${lowStockItems.length} товарів)`,
      items_count: lowStockItems.length
    })
  } catch (error) {
    console.error('[Auto Check] Error:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to check stock' 
    }, { status: 500 })
  }
}
