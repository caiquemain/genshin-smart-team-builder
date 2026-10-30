import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Sword, Shield, Swords, Target, Crosshair, Star, Search } from 'lucide-react'
import { api } from '../api/client'
import { useLanguage } from '../context/LanguageContext'
import { iconUrl } from '../config'
import WeaponTooltip from '../components/WeaponTooltip'
import type { WeaponSummary } from '../types'

const WEAPON_ICONS: Record<string, any> = {
  sword: Sword, claymore: Shield, polearm: Swords, bow: Target, catalyst: Crosshair,
}
const WEAPON_LABEL: Record<string, string> = {
  sword: 'Espada', claymore: 'Espadão', polearm: 'Lança', bow: 'Arco', catalyst: 'Catalisador',
}
const WEAPON_COLORS: Record<string, string> = {
  sword: '#e2e8f0', claymore: '#d97706', polearm: '#f87171', bow: '#4ade80', catalyst: '#c084fc',
}

function formatStatLabel(raw: string | null): string {
  if (!raw) return '—'
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatStatValue(stat: string | null, value: number | null): string {
  if (value == null) return '—'
  const pctStats = ['crit_rate', 'crit_dmg', 'hp_pct', 'atk_pct', 'def_pct',
    'er', 'healing_bonus', 'physical_dmg',
    'pyro_dmg', 'hydro_dmg', 'electro_dmg', 'cryo_dmg', 'anemo_dmg', 'geo_dmg', 'dendro_dmg']
  if (stat && pctStats.includes(stat)) return `${value.toFixed(1)}%`
  return String(Math.round(value))
}

function WeaponCard({ weapon }: { weapon: WeaponSummary }) {
  const img = iconUrl(weapon.icon)
  const Icon = WEAPON_ICONS[weapon.weapon_type]
  const rarityColor = weapon.rarity === 5 ? '#e0a647' : weapon.rarity === 4 ? '#a35bd8' : weapon.rarity === 3 ? '#5a8fd8' : '#94a3b8'

  // Fix: usa max (Lv.90) com fallback pro base (Lv.1)
  const atk = weapon.max_base_atk ?? weapon.base_atk
  const substat = weapon.max_secondary_stat_value ?? weapon.secondary_stat_value

  const card = (
    <Link
      to={`/weapons/${weapon.slug}`}
      className="weapon-card"
      style={{ '--rarity-color': rarityColor } as React.CSSProperties}
    >
      <div className="weapon-card-glow" />
      <div className="weapon-card-rarity">{'★'.repeat(weapon.rarity)}</div>
      <div className="weapon-card-icon">
        {img ? <img src={img} alt={weapon.name} loading="lazy" /> : <span>?</span>}
      </div>
      <div className="weapon-card-name">{weapon.name}</div>
      <div className="weapon-card-type">
        <Icon size={14} />
        {WEAPON_LABEL[weapon.weapon_type]}
      </div>
      <div className="weapon-card-stats">
        <div className="weapon-stat">
          <span className="weapon-stat-label">ATK (Lv.90)</span>
          <span className="weapon-stat-value">{atk}</span>
        </div>
        {weapon.secondary_stat && (
          <div className="weapon-stat">
            <span className="weapon-stat-label">{formatStatLabel(weapon.secondary_stat)}</span>
            <span className="weapon-stat-value">{formatStatValue(weapon.secondary_stat, substat)}</span>
          </div>
        )}
      </div>
    </Link>
  )

  return <WeaponTooltip weapon={weapon}>{card}</WeaponTooltip>
}

export default function WeaponsPage() {
  const { lang } = useLanguage()
  const [weapons, setWeapons] = useState<WeaponSummary[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [weaponType, setWeaponType] = useState('')
  const [rarity, setRarity] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    setLoading(true)
    api.listWeapons(lang, {
      weapon_type: weaponType || undefined,
      rarity: rarity ? Number(rarity) : undefined,
      limit: 200,
    })
      .then((d) => { setWeapons(d.items); setError(null) })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [lang, weaponType, rarity])

  const filtered = useMemo(() => {
    if (!search.trim()) return weapons
    const q = search.toLowerCase()
    return weapons.filter((w) => w.name.toLowerCase().includes(q))
  }, [weapons, search])

  return (
    <div>
      <h1>Armas</h1>

      <div className="premium-filters">
        {/* Busca */}
        <div className="filter-group" style={{ flex: '1 1 300px', maxWidth: 400 }}>
          <span className="filter-label">Buscar</span>
          <div className="premium-search">
            <Search size={16} />
            <input
              type="text"
              placeholder="Buscar arma pelo nome..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Tipo */}
        <div className="filter-group">
          <span className="filter-label">Tipo</span>
          <div className="filter-pills">
            {(['sword', 'claymore', 'polearm', 'bow', 'catalyst'] as const).map((w) => {
              const Icon = WEAPON_ICONS[w]
              const color = WEAPON_COLORS[w]
              const isActive = weaponType === w
              return (
                <button
                  key={w}
                  className={`filter-pill ${isActive ? 'active' : ''}`}
                  style={{ '--pill-color': color } as React.CSSProperties}
                  onClick={() => setWeaponType(isActive ? '' : w)}
                >
                  <Icon size={16} />
                  {WEAPON_LABEL[w]}
                </button>
              )
            })}
          </div>
        </div>

        {/* Raridade */}
        <div className="filter-group">
          <span className="filter-label">Raridade</span>
          <div className="filter-pills">
            {['5', '4', '3'].map((r) => {
              const isActive = rarity === r
              const color = r === '5' ? '#e0a647' : r === '4' ? '#a35bd8' : '#5a8fd8'
              return (
                <button
                  key={r}
                  className={`filter-pill ${isActive ? 'active' : ''}`}
                  style={{ '--pill-color': color } as React.CSSProperties}
                  onClick={() => setRarity(isActive ? '' : r)}
                >
                  <Star size={16} fill={isActive ? 'currentColor' : 'none'} />
                  {r}★
                </button>
              )
            })}
          </div>
        </div>

        {(weaponType || rarity || search) && (
          <button
            className="clear-filters-btn"
            onClick={() => { setWeaponType(''); setRarity(''); setSearch('') }}
          >
            Limpar Filtros
          </button>
        )}
      </div>

      {loading && <p className="status">Carregando...</p>}
      {error && <p className="error">Erro: {error}</p>}

      {!loading && !error && (
        <>
          <p className="status">{filtered.length} arma(s)</p>
          <div className="weapons-grid">
            {filtered.map((w) => <WeaponCard key={w.slug} weapon={w} />)}
          </div>
        </>
      )}
    </div>
  )
}
