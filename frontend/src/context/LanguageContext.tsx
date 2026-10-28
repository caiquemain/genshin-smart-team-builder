import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { LanguageCode } from '../types'

const STORAGE_KEY = 'gsb.lang'
const DEFAULT_LANG: LanguageCode = 'pt'

interface LanguageContextValue {
  lang: LanguageCode
  setLang: (lang: LanguageCode) => void
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LanguageCode>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return (stored as LanguageCode) || DEFAULT_LANG
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, lang)
    document.documentElement.lang = lang === 'jp' ? 'ja' : lang === 'kr' ? 'ko' : lang
  }, [lang])

  const setLang = useCallback((l: LanguageCode) => setLangState(l), [])

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used inside <LanguageProvider>')
  return ctx
}
