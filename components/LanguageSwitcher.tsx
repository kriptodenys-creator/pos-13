'use client'

import { useLanguage } from '@/hooks/useLanguage'
import { Button } from '@/components/ui/button'

export default function LanguageSwitcher() {
  const { language, toggleLanguage } = useLanguage()

  return (
    <Button
      variant="outline"
      onClick={toggleLanguage}
      className="font-bold"
      size="lg"
    >
      {language === 'uk' ? '🇺🇦 УКР' : '🇱🇹 LT'}
    </Button>
  )
}
