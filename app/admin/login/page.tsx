"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Lock, Eye, EyeOff } from "lucide-react"

export default function AdminLogin() {
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      // Проверяем PIN через API
      const response = await fetch('/api/pin-verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pin: password }),
      })

      const data = await response.json()

      if (data.success) {
        console.log('Login successful, redirecting...')
        // Redirect to admin dashboard
        router.push("/admin")
      } else {
        console.log('Login failed - wrong PIN')
        setError("Неправильний PIN-код")
      }
    } catch (error) {
      console.error('Login error:', error)
      setError('Помилка входу')
    }
    
    setIsLoading(false)
  }

  if (!isMounted) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4" suppressHydrationWarning>
      <Card className="w-full max-w-md bg-gray-900 border-orange-500">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-orange-500 flex items-center justify-center gap-2">
            <Lock className="w-6 h-6" />
            Вхід в адмін панель
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-orange-300">
                PIN-код
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-gray-900 border-orange-500 text-orange-500 pr-10"
                  placeholder="Введіть PIN-код"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 text-orange-400 hover:text-orange-300"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>

            {error && (
              <div className="text-red-400 text-sm text-center bg-red-500/10 border border-red-500/20 rounded p-2">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-orange-500 text-black hover:bg-orange-600"
              disabled={isLoading}
            >
              {isLoading ? "Перевірка..." : "Увійти"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Button
              variant="outline"
              className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-black"
              onClick={() => router.push("/")}
            >
              Повернутися до POS
            </Button>
          </div>

          <div className="mt-4 text-xs text-gray-500 text-center">
            <p>PIN за замовчуванням: <span className="text-orange-400 font-mono">1234</span></p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
