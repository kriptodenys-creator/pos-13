"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import AdminProtection from "@/components/AdminProtection"
import { ArrowLeft, Lock, Eye, EyeOff, Save, Shield } from "lucide-react"
import { useRouter } from "next/navigation"

export default function AdminSettingsPage() {
  const router = useRouter()
  const [currentPin, setCurrentPin] = useState("")
  const [newPin, setNewPin] = useState("")
  const [confirmPin, setConfirmPin] = useState("")
  const [showCurrentPin, setShowCurrentPin] = useState(false)
  const [showNewPin, setShowNewPin] = useState(false)
  const [showConfirmPin, setShowConfirmPin] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")

    if (newPin !== confirmPin) {
      setError("Новий PIN та підтвердження не співпадають")
      return
    }

    if (newPin.length < 4) {
      setError("PIN повинен містити мінімум 4 символи")
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/admin/change-pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ currentPin, newPin }),
      })

      const data = await response.json()

      if (data.success) {
        setSuccess("✅ PIN успішно змінено!")
        setCurrentPin("")
        setNewPin("")
        setConfirmPin("")
        
        // Через 2 секунди перенаправляємо на логін
        setTimeout(() => {
          localStorage.removeItem("adminAuthenticated")
          localStorage.removeItem("adminLoginTime")
          router.push("/admin/login")
        }, 2000)
      } else {
        setError(data.error || "Помилка зміни PIN")
      }
    } catch (error) {
      console.error('Change PIN error:', error)
      setError('Помилка з\'єднання з сервером')
    }

    setIsLoading(false)
  }

  return (
    <AdminProtection>
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-orange-900 text-white p-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <Button
              variant="outline"
              onClick={() => router.push("/admin")}
              className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-black"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Назад
            </Button>
            <h1 className="text-2xl font-bold text-orange-500 flex items-center gap-2">
              <Shield className="w-6 h-6" />
              Налаштування безпеки
            </h1>
            <div className="w-24"></div>
          </div>

          {/* Change PIN Card */}
          <Card className="bg-gray-900 border-orange-500">
            <CardHeader>
              <CardTitle className="text-xl text-orange-500 flex items-center gap-2">
                <Lock className="w-5 h-5" />
                Зміна PIN-коду адміністратора
              </CardTitle>
              <CardDescription className="text-gray-400">
                Змініть PIN-код для входу в адмін-панель. Після зміни вам потрібно буде увійти заново.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePin} className="space-y-4">
                {/* Current PIN */}
                <div className="space-y-2">
                  <Label htmlFor="currentPin" className="text-orange-300">
                    Поточний PIN-код
                  </Label>
                  <div className="relative">
                    <Input
                      id="currentPin"
                      type={showCurrentPin ? "text" : "password"}
                      value={currentPin}
                      onChange={(e) => setCurrentPin(e.target.value)}
                      className="bg-gray-800 border-orange-500 text-white pr-10"
                      placeholder="Введіть поточний PIN"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 text-orange-400 hover:text-orange-300"
                      onClick={() => setShowCurrentPin(!showCurrentPin)}
                    >
                      {showCurrentPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                {/* New PIN */}
                <div className="space-y-2">
                  <Label htmlFor="newPin" className="text-orange-300">
                    Новий PIN-код
                  </Label>
                  <div className="relative">
                    <Input
                      id="newPin"
                      type={showNewPin ? "text" : "password"}
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value)}
                      className="bg-gray-800 border-orange-500 text-white pr-10"
                      placeholder="Введіть новий PIN (мінімум 4 символи)"
                      required
                      minLength={4}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 text-orange-400 hover:text-orange-300"
                      onClick={() => setShowNewPin(!showNewPin)}
                    >
                      {showNewPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                {/* Confirm PIN */}
                <div className="space-y-2">
                  <Label htmlFor="confirmPin" className="text-orange-300">
                    Підтвердіть новий PIN-код
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirmPin"
                      type={showConfirmPin ? "text" : "password"}
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value)}
                      className="bg-gray-800 border-orange-500 text-white pr-10"
                      placeholder="Введіть новий PIN ще раз"
                      required
                      minLength={4}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 text-orange-400 hover:text-orange-300"
                      onClick={() => setShowConfirmPin(!showConfirmPin)}
                    >
                      {showConfirmPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded p-3">
                    ❌ {error}
                  </div>
                )}

                {/* Success Message */}
                {success && (
                  <div className="text-green-400 text-sm bg-green-500/10 border border-green-500/20 rounded p-3">
                    {success}
                  </div>
                )}

                {/* Submit Button */}
                <Button
                  type="submit"
                  className="w-full bg-orange-500 text-black hover:bg-orange-600 font-bold"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    "Зміна PIN..."
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Змінити PIN-код
                    </>
                  )}
                </Button>
              </form>

              {/* Security Tips */}
              <div className="mt-6 p-4 bg-gray-800/50 border border-orange-500/30 rounded">
                <h3 className="text-sm font-semibold text-orange-400 mb-2">💡 Поради з безпеки:</h3>
                <ul className="text-xs text-gray-400 space-y-1">
                  <li>• Використовуйте складний PIN (мінімум 4 символи)</li>
                  <li>• Не використовуйте очевидні комбінації (1234, 0000, тощо)</li>
                  <li>• Регулярно змінюйте PIN-код</li>
                  <li>• Не діліться PIN-кодом з іншими</li>
                  <li>• Після зміни PIN ви будете автоматично вийдені з системи</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminProtection>
  )
}
