'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Home, ArrowLeft } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="mb-8">
          <div className="text-8xl font-bold text-orange-500 mb-4">404</div>
          <h1 className="text-2xl font-bold text-white mb-2">
            Сторінка не знайдена
          </h1>
          <p className="text-gray-400">
            Вибачте, але сторінка, яку ви шукаете, не існує або була переміщена.
          </p>
        </div>

        <div className="space-y-4">
          <Link href="/">
            <Button className="w-full bg-orange-600 hover:bg-orange-700">
              <Home className="w-4 h-4 mr-2" />
              На головну
            </Button>
          </Link>
          
          <Button 
            variant="outline" 
            onClick={() => window.history.back()}
            className="w-full border-gray-600 text-gray-300 hover:bg-gray-800"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Назад
          </Button>
        </div>

        <div className="mt-8 text-sm text-gray-500">
          <p>Meidos POS System</p>
        </div>
      </div>
    </div>
  )
}
