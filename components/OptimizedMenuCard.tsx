"use client"

import { memo, useEffect, useState } from "react"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface MenuItem {
  id: string
  name: { lt: string; uk: string }
  price: number
  category: string
  image?: string
  modifiers?: unknown[]
}

interface OptimizedMenuCardProps {
  item: MenuItem
  language: "lt" | "uk"
  isDragging: boolean
  hasDiscount: boolean
  discountPercent?: number
  discountedPrice?: number
  onClick: () => void
  onDragStart: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  onDragEnd: () => void
  onPointerDown: (e: React.PointerEvent) => void
  priority?: boolean // Для перших елементів на екрані
}

const OptimizedMenuCard = memo(({
  item,
  language,
  isDragging,
  hasDiscount,
  discountPercent,
  discountedPrice,
  onClick,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onPointerDown,
  priority = false
}: OptimizedMenuCardProps) => {
  const [imageError, setImageError] = useState(false)
  const [imageLoading, setImageLoading] = useState(true)

  // WebP first: if local file is jpg/png, try .webp; fallback to original on error
  const originalPath = item.image && item.image.trim()
    ? (item.image.startsWith('/') ? item.image : `/uploads/${item.image}`)
    : ''
  const webpPath = originalPath.replace(/\.(jpe?g|png)$/i, '.webp')
  const prefersWebp = /\.(jpe?g|png)$/i.test(originalPath)

  const [imgSrc, setImgSrc] = useState(prefersWebp ? webpPath : originalPath)

  useEffect(() => {
    setImageError(false)
    setImageLoading(true)
    setImgSrc(prefersWebp ? webpPath : originalPath)
  }, [originalPath, prefersWebp, webpPath])

  return (
    <Card
      className={`cursor-pointer hover:shadow-md transition-shadow bg-gray-900 border-gray-700 hover:border-orange-500 ${
        isDragging ? 'ring-2 ring-orange-500 scale-[0.99]' : ''
      }`}
      onClick={onClick}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      data-menu-id={item.id}
    >
      <CardContent className="p-1.5 sm:p-2">
        <div 
          className="aspect-square bg-gray-800 rounded-md mb-1.5 flex items-center justify-center overflow-hidden relative touch-none"
          onPointerDown={onPointerDown}
        >
          {item.image && item.image.trim() && !imageError ? (
            <>
              {imageLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                  <div className="animate-pulse text-gray-600 text-xs">⏳</div>
                </div>
              )}
              <Image
                src={imgSrc}
                alt={item.name[language]}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 20vw, 16vw"
                className="object-cover"
                loading={priority ? undefined : "lazy"}
                priority={priority}
                draggable={false}
                onLoad={() => setImageLoading(false)}
                onError={() => {
                  if (prefersWebp && imgSrc === webpPath) {
                    // Fallback to original if webp fails
                    setImgSrc(originalPath)
                  } else {
                    setImageError(true)
                  }
                  setImageLoading(false)
                }}
                unoptimized={item.image.includes('http')}
              />
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
              <span className="text-3xl mb-1">🍽️</span>
              <span className="text-xs">Нет фото</span>
            </div>
          )}
        </div>

        <h3 className="font-semibold text-sm sm:text-base mb-1 text-white line-clamp-2 leading-tight">
          {item.name[language]}
        </h3>

        <div className="flex items-center justify-between">
          {hasDiscount && discountedPrice !== undefined ? (
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm line-through text-gray-500">
                  €{item.price.toFixed(2)}
                </span>
                <Badge className="bg-red-500 text-white text-xs px-1.5 py-0.5 h-auto">
                  {discountPercent}%
                </Badge>
              </div>
              <span className="text-base sm:text-lg font-bold text-orange-500">
                €{discountedPrice.toFixed(2)}
              </span>
            </div>
          ) : (
            <span className="text-base sm:text-lg font-bold text-orange-500">
              €{item.price.toFixed(2)}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
})

OptimizedMenuCard.displayName = 'OptimizedMenuCard'

export default OptimizedMenuCard
