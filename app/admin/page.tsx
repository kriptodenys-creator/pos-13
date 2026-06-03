'use client'

import { useEffect, useState } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Users, 
  Shield,
  ArrowLeft,
  Menu,
  Clock,
  Monitor,
  BarChart3,
  Package,
  ChefHat,
  AlertTriangle,
  X,
  MessageCircle,
  Factory,
  Tv
} from "lucide-react"
import AdminProtection from "@/components/AdminProtection"

type LowStockItem = {
  id: string
  name_uk: string
  current_stock: number
  min_stock: number
  unit: string
}

export default function AdminPage() {
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([])
  const [showNotification, setShowNotification] = useState(true)

  useEffect(() => {
    const fetchLowStock = async () => {
      try {
        const res = await fetch('/api/inventory?lowStock=1')
        const data = await res.json()
        if (data.items) {
          setLowStockItems(data.items)
        }
      } catch (e) {
        console.error('Failed to fetch low stock items:', e)
      }
    }
    fetchLowStock()
  }, [])

  const adminSections = [
    {
      title: "Кухонний дисплей",
      description: "Перегляд та управління замовленнями на кухні",
      icon: <Monitor className="w-8 h-8" />,
      href: "/kitchen",
      color: "border-red-500 hover:bg-red-500/10"
    },
    {
      title: "Логи системи",
      description: "Помилки та повідомлення для діагностики",
      icon: <AlertTriangle className="w-8 h-8" />,
      href: "/admin/logs",
      color: "border-amber-500 hover:bg-amber-500/10"
    },
    {
      title: "Екран замовлень",
      description: "Дисплей для клієнтів — готується / готово (як у McDonald's)",
      icon: <Tv className="w-8 h-8" />,
      href: "/order-display",
      color: "border-emerald-500 hover:bg-emerald-500/10"
    },
    {
      title: "Комбо-набори",
      description: "Створення та управління комбо-наборами з вибором слотів",
      icon: <Package className="w-8 h-8" />,
      href: "/admin/combos",
      color: "border-green-500 hover:bg-green-500/10"
    },
    {
      title: "Управління меню",
      description: "Додавання та редагування страв, категорій і модифікаторів",
      icon: <Menu className="w-8 h-8" />,
      href: "/admin/menu",
      color: "border-orange-500 hover:bg-orange-500/10"
    },
    {
      title: "Щасливі години",
      description: "Управління знижками за часом та днями тижня",
      icon: <Clock className="w-8 h-8" />,
      href: "/admin/happy-hours",
      color: "border-purple-500 hover:bg-purple-500/10"
    },
    {
      title: "Співробітники",
      description: "Управління співробітниками та знижками по PIN-коду",
      icon: <Users className="w-8 h-8" />,
      href: "/admin/employees",
      color: "border-teal-500 hover:bg-teal-500/10"
    },
    {
      title: "Склад",
      description: "Управління залишками, приход та списання товарів",
      icon: <Package className="w-8 h-8" />,
      href: "/admin/inventory",
      color: "border-blue-500 hover:bg-blue-500/10"
    },
    {
      title: "Приход товару",
      description: "Оформлення приходу товару на склад з автоматичним перерахунком",
      icon: <Package className="w-8 h-8" />,
      href: "/admin/inventory-receipt",
      color: "border-cyan-500 hover:bg-cyan-500/10"
    },
    {
      title: "Рецепти",
      description: "Налаштування інгредієнтів для автоматичного списання",
      icon: <ChefHat className="w-8 h-8" />,
      href: "/admin/recipes",
      color: "border-amber-500 hover:bg-amber-500/10"
    },
    {
      title: "Виробництво",
      description: "Виробництво соусів та супів з інгредієнтів на складі",
      icon: <Factory className="w-8 h-8" />,
      href: "/admin/production",
      color: "border-yellow-500 hover:bg-yellow-500/10"
    },
    {
      title: "Dienos statistika",
      description: "Продані товари за день",
      icon: <BarChart3 className="w-8 h-8" />,
      href: "/admin/stats",
      color: "border-green-500 hover:bg-green-500/10"
    },
    {
      title: "Telegram сповіщення",
      description: "Налаштування сповіщень про низькі залишки в Telegram",
      icon: <MessageCircle className="w-8 h-8" />,
      href: "/admin/telegram",
      color: "border-sky-500 hover:bg-sky-500/10"
    },
    {
      title: "Налаштування безпеки",
      description: "Зміна PIN-коду адміністратора та налаштування доступу",
      icon: <Shield className="w-8 h-8" />,
      href: "/admin/settings",
      color: "border-red-500 hover:bg-red-500/10"
    }
  ]

  return (
    <AdminProtection>
      <div className="min-h-screen bg-black text-orange-500 p-4">
        <div className="max-w-6xl mx-auto">
          <header className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-black bg-transparent"
                onClick={() => window.location.href = '/'}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Назад к POS
              </Button>
              <div>
                <h1 className="text-4xl font-bold text-orange-500 flex items-center gap-3">
                  <Shield className="w-10 h-10" />
                  Панель администратора
                </h1>
                <p className="text-orange-300 mt-2 text-lg">
                  Управление системой ресторана
                </p>
              </div>
            </div>
          </header>

          {/* Сповіщення про низькі залишки */}
          {showNotification && lowStockItems.length > 0 && (
            <div className="mb-6 bg-red-900/50 border-2 border-red-500 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-red-500 font-bold text-lg mb-2">
                      ⚠️ Увага! Низькі залишки ({lowStockItems.length})
                    </h3>
                    <div className="space-y-1">
                      {lowStockItems.slice(0, 5).map((item) => (
                        <div key={item.id} className="text-red-300 text-sm flex items-center gap-2">
                          <span className="font-medium">{item.name_uk}:</span>
                          <span className="text-red-400">
                            {item.current_stock.toFixed(1)} {item.unit}
                          </span>
                          <span className="text-gray-500">
                            (мін: {item.min_stock} {item.unit})
                          </span>
                        </div>
                      ))}
                      {lowStockItems.length > 5 && (
                        <div className="text-red-400 text-sm mt-1">
                          ... та ще {lowStockItems.length - 5} товарів
                        </div>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                      onClick={() => window.location.href = '/admin/inventory?lowStock=1'}
                    >
                      Перейти до складу
                    </Button>
                  </div>
                </div>
                <button
                  onClick={() => setShowNotification(false)}
                  className="text-red-500 hover:text-red-300 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {adminSections.map((section, index) => (
              <div key={index} className="h-full">
                <Card className={`bg-gray-900 border-2 ${section.color} transition-all duration-300 hover:scale-105 cursor-pointer h-full`}
                  onClick={() => window.location.href = section.href}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="text-orange-500">
                        {section.icon}
                      </div>
                      <CardTitle className="text-orange-500 text-xl">
                        {section.title}
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-300 text-sm leading-relaxed">
                      {section.description}
                    </p>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminProtection>
  )
}