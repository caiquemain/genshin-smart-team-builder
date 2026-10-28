import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import { useLanguage } from '../context/LanguageContext'
import CharacterCard from '../components/CharacterCard'
import type { CharacterListResponse, Enums } from '../types'

export default function CharactersPage() {
  const { lang } = useLanguage()
  const [data, setData] = useState<CharacterListResponse | null>(null)
  const [enums, setEnums] = useState<Enums | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [element, setElement] = useState('')
  const [weaponType, setWeaponType] = useState('')
  const [rarity, setRarity] = useState('')

  useEffect(() => {
    api.getEnums().then(setEnums).catch((e) => setError(String(e)))
  }, [])

  useEffect(() => {
    setLoading(true)
    api
      .listCharacters(lang, {
        element: element || undefined,
        weapon_type: weaponType || undefined,
        rarity: rarity ? Number(rarity) : undefined,
      })
      .then((d) => { setData(d); setError(null) })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [lang, element, weaponType, rarity])

  const items = useMemo(() => data?.items ?? [], [data])

  return (
    <div>
      <h1>Personagens</h1>
      <div className="filters">
        <select value={element} onChange={(e) => setElement(e.target.value)}>
          <option value="">Elemento (todos)</option>
          {enums?.elements.map((el) => (
            <option key={el} value={el}>{el}</option>
          ))}
        </select>
        <select value={weaponType} onChange={(e) => setWeaponType(e.target.value)}>
          <option value="">Arma (todas)</option>
          {enums?.weapon_types.map((w) => (
            <option key={w} value={w}>{w}</option>
          ))}
        </select>
        <select value={rarity} onChange={(e) => setRarity(e.target.value)}>
          <option value="">Raridade (todas)</option>
          <option value="5">5★</option>
          <option value="4">4★</option>
        </select>
      </div>

      {loading && <p className="status">Carregando...</p>}
      {error && <p className="error">Erro: {error}</p>}
      {data && (
        <>
          <p className="status">{data.pagination.total} personagem(ns) — idioma: {data.language}</p>
          <div className="grid">
            {items.map((c) => <CharacterCard key={c.slug} char={c} />)}
          </div>
        </>
      )}
    </div>
  )
}
