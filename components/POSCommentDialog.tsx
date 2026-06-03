"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import type { OrderItem } from "@/types/pos"

interface POSCommentDialogProps {
  isOpen: boolean
  onClose: () => void
  item: OrderItem | null
  language: "lt" | "uk"
  onSave: (comment: string) => void
}

export default function POSCommentDialog({
  isOpen,
  onClose,
  item,
  language,
  onSave
}: POSCommentDialogProps) {
  const [comment, setComment] = useState("")

  // Обновляем комментарий при открытии диалога
  useEffect(() => {
    if (item) {
      setComment(item.comment || "")
    }
  }, [item])

  const handleSave = () => {
    onSave(comment)
    onClose()
  }

  const handleClose = () => {
    setComment("")
    onClose()
  }

  const translations = {
    uk: {
      title: "Комментарий к блюду",
      specialRequests: "Особые пожелания",
      placeholder: "Например: без лука, острый, хорошо прожарить...",
      cancel: "Отмена",
      save: "Сохранить"
    },
    lt: {
      title: "Patiekalo komentaras",
      specialRequests: "Specialūs pageidavimai",
      placeholder: "Pavyzdžiui: be svogūnų, aštrus, gerai iškepti...",
      cancel: "Atšaukti",
      save: "Išsaugoti"
    }
  }

  const t = translations[language]

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-gray-900 border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle className="text-orange-500">
            {t.title}
          </DialogTitle>
        </DialogHeader>
        {item && (
          <div className="space-y-4">
            <div>
              <Label className="text-white font-medium">
                {item.name[language]}
              </Label>
              {item.selectedModifiers && item.selectedModifiers.length > 0 && (
                <p className="text-xs text-orange-400 mt-1">
                  {item.selectedModifiers.map(mod => mod.name[language]).join(', ')}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="item-comment" className="text-gray-300">
                {t.specialRequests}
              </Label>
              <textarea
                id="item-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t.placeholder}
                className="mt-2 w-full p-3 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-400 resize-none h-20 focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                maxLength={200}
                autoFocus
              />
              <div className="text-xs text-gray-400 text-right mt-1">
                {comment.length}/200
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={handleClose}
                className="border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                {t.cancel}
              </Button>
              <Button
                onClick={handleSave}
                className="bg-orange-500 hover:bg-orange-600 text-black"
              >
                {t.save}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
