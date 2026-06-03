import { useState, useCallback } from "react"
import type { OrderItem, CompletedOrder } from "@/types/pos"

/**
 * Хук для управления состоянием всех диалогов в POS-системе
 * Централизует логику открытия/закрытия диалогов
 */
export function useDialogState() {
  // Диалоги заказа
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  const [showMobileCart, setShowMobileCart] = useState(false)
  const [showOrderHistory, setShowOrderHistory] = useState(false)
  
  // Диалоги типа заказа
  const [showPhoneDialog, setShowPhoneDialog] = useState(false)
  const [showPreorderDialog, setShowPreorderDialog] = useState(false)
  
  // Диалоги модификаторов
  const [isModifierDialogOpen, setIsModifierDialogOpen] = useState(false)
  const [showMeatDialog, setShowMeatDialog] = useState(false)
  const [showAddonsDialog, setShowAddonsDialog] = useState(false)
  const [showCommentDialog, setShowCommentDialog] = useState(false)
  
  // Диалог удаления заказа
  const [showDeleteOrderDialog, setShowDeleteOrderDialog] = useState(false)
  const [orderToDelete, setOrderToDelete] = useState<CompletedOrder | null>(null)
  const [deletePin, setDeletePin] = useState('')
  const [deletePinError, setDeletePinError] = useState('')
  
  // Состояние для комментариев
  const [selectedItemForComment, setSelectedItemForComment] = useState<OrderItem | null>(null)
  const [tempComment, setTempComment] = useState('')

  // Методы для управления диалогами
  const openSuccessDialog = useCallback(() => setShowSuccessDialog(true), [])
  const closeSuccessDialog = useCallback(() => setShowSuccessDialog(false), [])
  
  const openMobileCart = useCallback(() => setShowMobileCart(true), [])
  const closeMobileCart = useCallback(() => setShowMobileCart(false), [])
  
  const openOrderHistory = useCallback(() => setShowOrderHistory(true), [])
  const closeOrderHistory = useCallback(() => setShowOrderHistory(false), [])
  
  const openPhoneDialog = useCallback(() => setShowPhoneDialog(true), [])
  const closePhoneDialog = useCallback(() => setShowPhoneDialog(false), [])
  
  const openPreorderDialog = useCallback(() => setShowPreorderDialog(true), [])
  const closePreorderDialog = useCallback(() => setShowPreorderDialog(false), [])
  
  const openModifierDialog = useCallback(() => setIsModifierDialogOpen(true), [])
  const closeModifierDialog = useCallback(() => setIsModifierDialogOpen(false), [])
  
  const openMeatDialog = useCallback(() => setShowMeatDialog(true), [])
  const closeMeatDialog = useCallback(() => setShowMeatDialog(false), [])
  
  const openAddonsDialog = useCallback(() => setShowAddonsDialog(true), [])
  const closeAddonsDialog = useCallback(() => setShowAddonsDialog(false), [])
  
  const openCommentDialog = useCallback((item: OrderItem) => {
    setSelectedItemForComment(item)
    setShowCommentDialog(true)
  }, [])
  
  const closeCommentDialog = useCallback(() => {
    setShowCommentDialog(false)
    setSelectedItemForComment(null)
    setTempComment('')
  }, [])
  
  const openDeleteOrderDialog = useCallback((order: CompletedOrder) => {
    setOrderToDelete(order)
    setShowDeleteOrderDialog(true)
    setDeletePin('')
    setDeletePinError('')
  }, [])
  
  const closeDeleteOrderDialog = useCallback(() => {
    setShowDeleteOrderDialog(false)
    setOrderToDelete(null)
    setDeletePin('')
    setDeletePinError('')
  }, [])

  // Закрыть все диалоги
  const closeAllDialogs = useCallback(() => {
    setShowSuccessDialog(false)
    setShowMobileCart(false)
    setShowOrderHistory(false)
    setShowPhoneDialog(false)
    setShowPreorderDialog(false)
    setIsModifierDialogOpen(false)
    setShowMeatDialog(false)
    setShowAddonsDialog(false)
    setShowCommentDialog(false)
    setShowDeleteOrderDialog(false)
    setSelectedItemForComment(null)
    setTempComment('')
    setOrderToDelete(null)
    setDeletePin('')
    setDeletePinError('')
  }, [])

  return {
    // Состояния диалогов
    showSuccessDialog,
    showMobileCart,
    showOrderHistory,
    showPhoneDialog,
    showPreorderDialog,
    isModifierDialogOpen,
    showMeatDialog,
    showAddonsDialog,
    showCommentDialog,
    showDeleteOrderDialog,
    
    // Состояния данных
    selectedItemForComment,
    tempComment,
    orderToDelete,
    deletePin,
    deletePinError,
    
    // Сеттеры (для обратной совместимости)
    setShowSuccessDialog,
    setShowMobileCart,
    setShowOrderHistory,
    setShowPhoneDialog,
    setShowPreorderDialog,
    setIsModifierDialogOpen,
    setShowMeatDialog,
    setShowAddonsDialog,
    setShowCommentDialog,
    setShowDeleteOrderDialog,
    setSelectedItemForComment,
    setTempComment,
    setOrderToDelete,
    setDeletePin,
    setDeletePinError,
    
    // Методы управления
    openSuccessDialog,
    closeSuccessDialog,
    openMobileCart,
    closeMobileCart,
    openOrderHistory,
    closeOrderHistory,
    openPhoneDialog,
    closePhoneDialog,
    openPreorderDialog,
    closePreorderDialog,
    openModifierDialog,
    closeModifierDialog,
    openMeatDialog,
    closeMeatDialog,
    openAddonsDialog,
    closeAddonsDialog,
    openCommentDialog,
    closeCommentDialog,
    openDeleteOrderDialog,
    closeDeleteOrderDialog,
    closeAllDialogs,
  }
}
