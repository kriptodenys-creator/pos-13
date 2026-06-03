'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import AdminProtection from '@/components/AdminProtection'
import { ArrowLeft, Send, Settings, CheckCircle, AlertTriangle, MessageCircle, Clock } from 'lucide-react'
import { startAutoCheck } from '@/lib/telegram-auto-check'

export default function TelegramSettingsPage() {
  const [settings, setSettings] = useState({
    bot_token: '',
    chat_id: '',
    enabled: false
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [testing, setTesting] = useState(false)
  const [gettingChatId, setGettingChatId] = useState(false)
  const [availableChats, setAvailableChats] = useState<Array<{chat_id: string, chat_type: string, chat_title?: string}>>([])
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch('/api/telegram')
        const data = await res.json()
        if (data.success && data.settings) {
          setSettings({
            bot_token: data.settings.bot_token || '',
            chat_id: data.settings.chat_id || '',
            enabled: !!data.settings.enabled
          })
          
          // Запускаємо автоматичну перевірку якщо Telegram увімкнено
          if (data.settings.enabled) {
            startAutoCheck()
          }
        }
      } catch (e) {
        console.error('Failed to load settings:', e)
      } finally {
        setLoading(false)
      }
    }
    loadSettings()
  }, [])

  const saveSettings = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_settings', ...settings })
      })
      const data = await res.json()
      if (data.success) {
        setMessage({ type: 'success', text: 'Налаштування збережено!' })
      } else {
        setMessage({ type: 'error', text: data.error || 'Помилка збереження' })
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Помилка збереження' })
    } finally {
      setSaving(false)
    }
  }

  const testConnection = async () => {
    setTesting(true)
    setMessage(null)
    try {
      const res = await fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'test', 
          bot_token: settings.bot_token,
          chat_id: settings.chat_id
        })
      })
      const data = await res.json()
      if (data.success) {
        setMessage({ type: 'success', text: data.message })
      } else {
        setMessage({ type: 'error', text: data.error })
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Помилка підключення' })
    } finally {
      setTesting(false)
    }
  }

  const sendLowStockNotification = async () => {
    setSending(true)
    setMessage(null)
    try {
      const res = await fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_low_stock' })
      })
      const data = await res.json()
      if (data.success) {
        setMessage({ type: 'success', text: data.message })
      } else {
        setMessage({ type: 'error', text: data.error })
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Помилка відправки' })
    } finally {
      setSending(false)
    }
  }

  const getChatId = async () => {
    if (!settings.bot_token) {
      setMessage({ type: 'error', text: 'Спочатку введіть Bot Token' })
      return
    }
    
    setGettingChatId(true)
    setMessage(null)
    setAvailableChats([])
    
    try {
      const res = await fetch('/api/telegram/get-chat-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bot_token: settings.bot_token })
      })
      const data = await res.json()
      
      if (data.success && data.chats && data.chats.length > 0) {
        setAvailableChats(data.chats)
        setMessage({ type: 'success', text: data.message })
      } else {
        setMessage({ 
          type: 'error', 
          text: data.message || 'Чатів не знайдено. Напишіть боту /start або додайте його в групу, потім спробуйте знову.' 
        })
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Помилка отримання Chat ID' })
    } finally {
      setGettingChatId(false)
    }
  }

  if (loading) {
    return (
      <AdminProtection>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <p>Завантаження...</p>
        </div>
      </AdminProtection>
    )
  }

  return (
    <AdminProtection>
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-2xl mx-auto">
          <header className="mb-6 flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.href = '/admin'}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Назад
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <MessageCircle className="w-6 h-6 text-blue-500" />
                Telegram сповіщення
              </h1>
              <p className="text-gray-500 text-sm">
                Налаштування сповіщень про низькі залишки
              </p>
            </div>
          </header>

          {message && (
            <div className={`mb-4 p-4 rounded-lg flex items-center gap-2 ${
              message.type === 'success' 
                ? 'bg-green-100 text-green-800 border border-green-300' 
                : 'bg-red-100 text-red-800 border border-red-300'
            }`}>
              {message.type === 'success' ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <AlertTriangle className="w-5 h-5" />
              )}
              {message.text}
            </div>
          )}

          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Налаштування бота
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="bot_token">Bot Token</Label>
                <Input
                  id="bot_token"
                  type="password"
                  value={settings.bot_token}
                  onChange={(e) => setSettings({ ...settings, bot_token: e.target.value })}
                  placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Отримайте токен у @BotFather в Telegram
                </p>
              </div>

              <div>
                <Label htmlFor="chat_id">Chat ID</Label>
                <div className="flex gap-2">
                  <Input
                    id="chat_id"
                    value={settings.chat_id}
                    onChange={(e) => setSettings({ ...settings, chat_id: e.target.value })}
                    placeholder="-1001234567890 або 123456789"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={getChatId}
                    disabled={gettingChatId || !settings.bot_token}
                  >
                    {gettingChatId ? 'Пошук...' : '🔍 Знайти'}
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Натисніть "Знайти" щоб автоматично отримати доступні чати
                </p>
                
                {availableChats.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-sm font-medium text-gray-700">Доступні чати:</p>
                    {availableChats.map((chat) => (
                      <button
                        key={chat.chat_id}
                        onClick={() => setSettings({ ...settings, chat_id: chat.chat_id })}
                        className="w-full text-left p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900">{chat.chat_title}</p>
                            <p className="text-xs text-gray-500">
                              {chat.chat_type === 'group' || chat.chat_type === 'supergroup' ? '👥 Група' : '👤 Особистий чат'}
                            </p>
                          </div>
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded">{chat.chat_id}</code>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Увімкнути сповіщення</Label>
                  <p className="text-xs text-gray-500">
                    Автоматичні сповіщення про низькі залишки
                  </p>
                </div>
                <Switch
                  checked={settings.enabled}
                  onCheckedChange={(checked) => setSettings({ ...settings, enabled: checked })}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={saveSettings} disabled={saving}>
                  {saving ? 'Збереження...' : 'Зберегти'}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={testConnection} 
                  disabled={testing || !settings.bot_token || !settings.chat_id}
                >
                  {testing ? 'Тестування...' : 'Тест підключення'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="w-5 h-5" />
                Відправити сповіщення
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                Відправити список товарів з низькими залишками в Telegram прямо зараз.
              </p>
              <Button 
                onClick={sendLowStockNotification} 
                disabled={sending || !settings.bot_token || !settings.chat_id}
                className="w-full"
              >
                <Send className="w-4 h-4 mr-2" />
                {sending ? 'Відправка...' : 'Відправити сповіщення про залишки'}
              </Button>
            </CardContent>
          </Card>

          <Card className="mt-6 bg-green-50 border-green-200">
            <CardHeader>
              <CardTitle className="text-green-800 text-lg flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Автоматичні сповіщення
              </CardTitle>
            </CardHeader>
            <CardContent className="text-green-700 text-sm space-y-2">
              <p className="font-bold">⏰ Сповіщення відправляються автоматично щодня о 9:00 ранку</p>
              <p>Якщо Telegram увімкнено, система автоматично перевіряє залишки на складі та відправляє сповіщення про товари з низькими залишками.</p>
              <p className="text-xs text-green-600 mt-2">💡 Ви також можете відправити сповіщення вручну в будь-який час, натиснувши кнопку вище.</p>
            </CardContent>
          </Card>

          <Card className="mt-6 bg-blue-50 border-blue-200">
            <CardHeader>
              <CardTitle className="text-blue-800 text-lg">Як налаштувати?</CardTitle>
            </CardHeader>
            <CardContent className="text-blue-700 text-sm space-y-2">
              <p><strong>1.</strong> Створіть бота в Telegram через @BotFather</p>
              <p><strong>2.</strong> Скопіюйте Bot Token та вставте вище</p>
              <p><strong>3.</strong> Додайте бота в групу або напишіть йому /start</p>
              <p><strong>4.</strong> Дізнайтесь Chat ID через @userinfobot або @getidsbot</p>
              <p><strong>5.</strong> Натисніть "Тест підключення" для перевірки</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminProtection>
  )
}
