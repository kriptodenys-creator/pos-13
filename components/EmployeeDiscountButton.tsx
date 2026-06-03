"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Percent, X } from 'lucide-react'
import EmployeePinModal from './EmployeePinModal'

interface EmployeeDiscountButtonProps {
  onDiscountApplied: (discount: { employeeId: number, employeeName: string, discountPercent: number }) => void
  onDiscountRemoved: () => void
  currentDiscount?: { employeeName: string, discountPercent: number } | null
}

export default function EmployeeDiscountButton({ 
  onDiscountApplied, 
  onDiscountRemoved,
  currentDiscount 
}: EmployeeDiscountButtonProps) {
  const [isPinModalOpen, setIsPinModalOpen] = useState(false)

  const handleVerifySuccess = (employeeData: { id: number, name: string, discount_percent: number }) => {
    onDiscountApplied({
      employeeId: employeeData.id,
      employeeName: employeeData.name,
      discountPercent: employeeData.discount_percent
    })
  }

  const handleRemoveDiscount = () => {
    onDiscountRemoved()
  }

  if (currentDiscount && currentDiscount.discountPercent > 0) {
    return (
      <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-lg p-2">
        <Percent className="w-4 h-4 text-green-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-green-400 truncate">
              {currentDiscount.employeeName}
            </span>
            <span className="text-xs text-green-300 whitespace-nowrap">
              -{currentDiscount.discountPercent}%
            </span>
          </div>
        </div>
        <Button
          onClick={handleRemoveDiscount}
          size="sm"
          variant="ghost"
          className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7 w-7 p-0 flex-shrink-0"
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
    )
  }

  return (
    <>
      <Button
        onClick={() => setIsPinModalOpen(true)}
        variant="outline"
        size="icon"
        className="border-orange-500 text-orange-400 hover:bg-orange-500/10 h-9 w-9 flex-shrink-0"
        title="Скидка сотрудника"
      >
        <Percent className="w-5 h-5" />
      </Button>

      <EmployeePinModal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        onVerify={handleVerifySuccess}
      />
    </>
  )
}
