import { useEffect, useMemo, useState } from 'react'
import { Flame, Droplets, Snowflake, Zap, Leaf, Mountain, Wind, Sword, Crosshair, Shield, Swords, Target, Star } from 'lucide-react'
import { api } from '../api/client'
import { useLanguage } from '../context/LanguageContext'
import CharacterCard from '../components/CharacterCard'
import type { CharacterListResponse, Enums } from '../types'

const ELEMENT_ICONS: Record<string, any> = {
  pyro: Flame, hydro: Droplets, electro: Zap, cryo: Snowflake,
  anemo: Wind, geo: Mountain, dendro: Leaf,
}
const ELEMENT_COLORS: Record<string, string> = {
  pyro: '#ff9c46', hydro: '#4cc2f1', electro: '#b398ff', cryo: '#93e2ff',
  anemo: '#73ffd0', geo: '#f2c869', dendro: '#a5c83b',
}
const WEAPON_COLORS: Record<string, string> = {
  sword: '#e2e8f0',    // Prata
  claymore: '#d97706', // Âmbar
  polearm: '#f87171',  // Vermelho
  bow: '#4ade80',      // Verde
  catalyst: '#c084fc', // Roxo
}
const WEAPON_ICONS: Record<string, any> = {
  sword: Sword,
  claymore: Shield,
  polearm: Swords,
  bow: Target,
  catalyst: Crosshair,
}

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
        limit: 200,
      })
      .then((d) => { setData(d); setError(null) })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [lang, element, weaponType, rarity])

  const items = useMemo(() => data?.items ?? [], [data])

  return (
    <div>
      <h1>Personagens</h1>
      
      {/* FILTROS PREMIUM (PILLS) */}
      <div className="premium-filters">
        
        {/* Elementos */}
        <div className="filter-group">
          <span className="filter-label">Elemento</span>
          <div className="filter-pills">
            {enums?.elements.map((el) => {
              const Icon = ELEMENT_ICONS[el] || Star
              const color = ELEMENT_COLORS[el] || '#94a3b8'
              const isActive = element === el
              return (
                <button
                  key={el}
                  className={`filter-pill ${isActive ? 'active' : ''}`}
                  style={{ '--pill-color': color } as React.CSSProperties}
                  onClick={() => setElement(isActive ? '' : el)}
                >
                  <Icon size={16} />
                  {el.charAt(0).toUpperCase() + el.slice(1)}
                </button>
              )
            })}
          </div>
        </div>

        {/* Armas */}
        <div className="filter-group">
          <span className="filter-label">Arma</span>
          <div className="filter-pills">
            {enums?.weapon_types.map((w) => {
              const Icon = WEAPON_ICONS[w] || Sword
              const isActive = weaponType === w
              return (
                <button
                  key={w}
                  className={`filter-pill ${isActive ? 'active' : ''}`}
                  style={{ '--pill-color': WEAPON_COLORS[w] || '#cbd5e1' } as React.CSSProperties}
                  onClick={() => setWeaponType(isActive ? '' : w)}
                >
                  <Icon size={16} />
                  {w.charAt(0).toUpperCase() + w.slice(1)}
                </button>
              )
            })}
          </div>
        </div>

        {/* Raridade */}
        <div className="filter-group">
          <span className="filter-label">Raridade</span>
          <div className="filter-pills">
            {['5', '4'].map((r) => {
              const isActive = rarity === r
              return (
                <button
                  key={r}
                  className={`filter-pill ${isActive ? 'active' : ''}`}
                  style={{ '--pill-color': r === '5' ? '#e0a647' : '#a35bd8' } as React.CSSProperties}
                  onClick={() => setRarity(isActive ? '' : r)}
                >
                  <Star size={16} fill={isActive ? 'currentColor' : 'none'} />
                  {r}★
                </button>
              )
            })}
          </div>
        </div>

        {/* Botão Limpar Filtros (só aparece se tiver algo selecionado) */}
        {(element || weaponType || rarity) && (
          <button 
            className="clear-filters-btn"
            onClick={() => { setElement(''); setWeaponType(''); setRarity(''); }}
          >
            Limpar Filtros
          </button>
        )}

      </div>

      {loading && <p className="status">Carregando personagens...</p>}
      {error && <p className="status error">Erro: {error}</p>}
      
      <div className="grid">
        {items.map((c) => (
          <CharacterCard key={c.slug} char={c} />
        ))}
      </div>
    </div>
  )
}
