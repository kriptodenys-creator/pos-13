import { NextResponse } from 'next/server'

// API для отримання Chat ID через webhook
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { bot_token } = body
    
    if (!bot_token) {
      return NextResponse.json({ 
        success: false, 
        error: 'Bot Token не вказано' 
      }, { status: 400 })
    }
    
    // Отримуємо останні оновлення від бота
    const telegramUrl = `https://api.telegram.org/bot${bot_token}/getUpdates`
    
    const response = await fetch(telegramUrl)
    const data = await response.json()
    
    if (!data.ok) {
      return NextResponse.json({ 
        success: false, 
        error: `Помилка Telegram: ${data.description}` 
      }, { status: 400 })
    }
    
    // Шукаємо останні чати
    const chats: Array<{chat_id: string, chat_type: string, chat_title?: string, username?: string}> = []
    
    if (data.result && data.result.length > 0) {
      // Збираємо унікальні чати
      const uniqueChats = new Map()
      
      data.result.forEach((update: any) => {
        const message = update.message || update.channel_post
        if (message && message.chat) {
          const chatId = message.chat.id.toString()
          if (!uniqueChats.has(chatId)) {
            uniqueChats.set(chatId, {
              chat_id: chatId,
              chat_type: message.chat.type,
              chat_title: message.chat.title || message.chat.first_name || 'Без назви',
              username: message.chat.username || null
            })
          }
        }
      })
      
      chats.push(...uniqueChats.values())
    }
    
    return NextResponse.json({ 
      success: true, 
      chats: chats,
      message: chats.length > 0 
        ? `Знайдено ${chats.length} чат(ів)` 
        : 'Чатів не знайдено. Напишіть боту /start або додайте його в групу.'
    })
  } catch (error) {
    console.error('[Get Chat ID] Error:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Помилка при отриманні Chat ID' 
    }, { status: 500 })
  }
}
