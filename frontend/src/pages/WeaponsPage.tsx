import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { useLanguage } from '../context/LanguageContext'
import { iconUrl } from '../config'
import { categoryInfo } from '../utils/categories'
import type { WeaponSummary } from '../types'

const WEAPON_TYPE_EMOJI: Record<string, string> = {
  sword: '⚔️', claymore: '🗡️', polearm: '🔱', bow: '🏹', catalyst: '📖',
}

const WEAPON_TYPE_LABEL: Record<string, string> = {
  sword: 'Espada', claymore: 'Espadão', polearm: 'Lança', bow: 'Arco', catalyst: 'Catalisador',
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
  return (
    <Link to={`/weapons/${weapon.slug}`} className={`weapon-card rarity-${weapon.rarity}`}>
      <div className="weapon-card-rarity">{'★'.repeat(weapon.rarity)}</div>
      <div className="weapon-card-icon">
        {img ? <img src={img} alt={weapon.name} loading="lazy" /> : <span>?</span>}
      </div>
      <div className="weapon-card-name">{weapon.name}</div>
      <div className="weapon-card-type">
        {WEAPON_TYPE_EMOJI[weapon.weapon_type]} {WEAPON_TYPE_LABEL[weapon.weapon_type]}
      </div>
      <div className="weapon-card-stats">
        <div className="weapon-stat">
          <span className="weapon-stat-label">ATK base</span>
          <span className="weapon-stat-value">{weapon.base_atk}</span>
        </div>
        {weapon.secondary_stat && (
          <div className="weapon-stat">
            <span className="weapon-stat-label">{formatStatLabel(weapon.secondary_stat)}</span>
            <span className="weapon-stat-value">{formatStatValue(weapon.secondary_stat, weapon.secondary_stat_value)}</span>
          </div>
        )}
      </div>
    </Link>
  )
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
      limit: 300,
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

      <div className="filters">
        <input
          type="text"
          placeholder="Buscar arma..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="filter-search"
        />
        <select value={weaponType} onChange={(e) => setWeaponType(e.target.value)}>
          <option value="">Tipo (todos)</option>
          <option value="sword">Espada</option>
          <option value="claymore">Espadão</option>
          <option value="polearm">Lança</option>
          <option value="bow">Arco</option>
          <option value="catalyst">Catalisador</option>
        </select>
        <select value={rarity} onChange={(e) => setRarity(e.target.value)}>
          <option value="">Raridade (todas)</option>
          <option value="5">5★</option>
          <option value="4">4★</option>
          <option value="3">3★</option>
          <option value="2">2★</option>
          <option value="1">1★</option>
        </select>
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
