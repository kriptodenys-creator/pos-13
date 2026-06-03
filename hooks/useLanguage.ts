import { useState, useEffect } from 'react'
import type { Language } from '@/lib/translations'

const LANGUAGE_KEY = 'app_language'

export function useLanguage() {
  const [language, setLanguageState] = useState<Language>('uk')

  useEffect(() => {
    // Завантажити мову з localStorage
    const savedLanguage = localStorage.getItem(LANGUAGE_KEY) as Language | null
    if (savedLanguage && (savedLanguage === 'uk' || savedLanguage === 'lt')) {
      setLanguageState(savedLanguage)
    }
  }, [])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem(LANGUAGE_KEY, lang)
  }

  const toggleLanguage = () => {
    const newLang: Language = language === 'uk' ? 'lt' : 'uk'
    setLanguage(newLang)
  }

  return {
    language,
    setLanguage,
    toggleLanguage,
  }
}
