"use client"

import { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { X, Check, AlertCircle } from 'lucide-react'

interface EmployeePinModalProps {
  isOpen: boolean
  onClose: () => void
  onVerify: (employeeData: { id: number, name: string, discount_percent: number }) => void
}

export default function EmployeePinModal({ isOpen, onClose, onVerify }: EmployeePinModalProps) {
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setPin('')
      setError('')
      // Фокус на инпут при открытии
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
    }
  }, [isOpen])

  const handleVerifyPin = async () => {
    if (!pin || pin.length < 4) {
      setError('PIN код повинен містити мінімум 4 цифри')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', pin })
      })

      const data = await response.json()

      if (data.success && data.employee) {
        onVerify(data.employee)
        onClose()
      } else {
        setLoading(false)
      }
    } catch {
      console.error('PIN verification failed')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleVerifyPin()
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  const handlePinInput = (value: string) => {
    // Только цифры
    const numericValue = value.replace(/\D/g, '')
    setPin(numericValue)
    setError('')
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-700 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-orange-500 flex items-center gap-2">
            🔐 PIN код співробітника
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">
              Введіть PIN код для отримання знижки
            </label>
            <Input
              ref={inputRef}
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => handlePinInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="••••"
              className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 text-center text-2xl tracking-widest focus:border-orange-500"
              disabled={loading}
            />
            <p className="text-xs text-gray-400 text-center">
              Мінімум 4 цифри
            </p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded p-3 flex items-center gap-2 text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={onClose}
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-800"
              disabled={loading}
            >
              <X className="w-4 h-4 mr-2" />
              Скасувати
            </Button>
            <Button
              onClick={handleVerifyPin}
              className="bg-orange-600 hover:bg-orange-700 text-white"
              disabled={loading || pin.length < 4}
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              Підтвердити
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
