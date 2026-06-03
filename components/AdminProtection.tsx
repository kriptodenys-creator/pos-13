"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

interface AdminProtectionProps {
  children: React.ReactNode
}

export default function AdminProtection({ children }: AdminProtectionProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isMounted, setIsMounted] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (!isMounted) return

    const checkAuth = async () => {
      try {
        const res = await fetch('/api/admin/session', { cache: 'no-store' })
        const data: unknown = await res.json().catch(() => ({}))
        const ok = Boolean((data && typeof data === 'object' ? (data as Record<string, unknown>).authenticated : undefined))
        setIsAuthenticated(ok)
        if (!ok) {
          router.push('/admin/login')
        }
      } catch {
        setIsAuthenticated(false)
        router.push('/admin/login')
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [router, isMounted])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-orange-900 flex items-center justify-center" suppressHydrationWarning>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-orange-300" suppressHydrationWarning>Перевірка доступу...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null // Will redirect to login
  }

  return <>{children}</>
}
