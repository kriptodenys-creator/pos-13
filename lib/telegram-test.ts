// Простая функция для тестирования Telegram API

export async function testTelegramConnection(botToken: string, chatId: string): Promise<boolean> {
  try {
    const message = `🤖 Тест підключення\n\n✅ Telegram бот успішно підключений до POS системи!\n\n⏰ ${new Date().toLocaleString('uk-UA')}`
    
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML'
      })
    })

    const data = await response.json()
    
    console.log('Telegram API Response:', data)
    
    return data.ok === true
  } catch (error) {
    console.error('Telegram test error:', error)
    return false
  }
}

export async function sendTelegramMessage(
  botToken: string, 
  chatId: string, 
  title: string, 
  message: string
): Promise<boolean> {
  try {
    const fullMessage = `${title}\n\n${message}`
    
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: fullMessage,
        parse_mode: 'HTML'
      })
    })

    const data = await response.json()
    
    console.log('Telegram send result:', data)
    
    if (!data.ok) {
      console.error('Telegram API error:', data.description)
    }
    
    return data.ok === true
  } catch (error) {
    console.error('Telegram send error:', error)
    return false
  }
}
