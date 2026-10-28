import { useLanguage } from '../context/LanguageContext'
import type { LanguageCode } from '../types'

const OPTIONS: { code: LanguageCode; label: string }[] = [
  { code: 'pt', label: 'PT' },
  { code: 'en', label: 'EN' },
  { code: 'es', label: 'ES' },
]

export default function LanguageSwitcher() {
  const { lang, setLang } = useLanguage()
  return (
    <select
      value={lang}
      onChange={(e) => setLang(e.target.value as LanguageCode)}
      className="lang-switcher"
      aria-label="Idioma"
    >
      {OPTIONS.map((o) => (
        <option key={o.code} value={o.code}>{o.label}</option>
      ))}
    </select>
  )
}
