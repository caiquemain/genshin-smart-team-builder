import { useEffect, useState } from 'react'
import { TrendingUp } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'

interface StatLevel {
  hp: number
  atk: number
  def: number
  substat: number
}

interface CharStats {
  substat_name: string
  levels: Record<string, StatLevel>
}

const LEVELS = [1, 20, 40, 50, 60, 70, 80, 90]

const FLAT_SUBSTATS = new Set(['elemental mastery', 'em', 'proficiência elemental'])

const SUBSTAT_PT: Record<string, string> = {
  'elemental mastery': 'Proficiência Elemental',
  'energy recharge': 'Recarga de Energia',
  'crit rate': 'Taxa Crítica',
  'crit dmg': 'Dano Crítico',
  'atk': 'ATQ%',
  'hp': 'Vida%',
  'def': 'DEF%',
  'healing bonus': 'Bônus de Cura',
  'pyro dmg bonus': 'Bônus de Dano Pyro',
  'hydro dmg bonus': 'Bônus de Dano Hydro',
  'cryo dmg bonus': 'Bônus de Dano Cryo',
  'electro dmg bonus': 'Bônus de Dano Electro',
  'anemo dmg bonus': 'Bônus de Dano Anemo',
  'geo dmg bonus': 'Bônus de Dano Geo',
  'dendro dmg bonus': 'Bônus de Dano Dendro',
  'physical dmg bonus': 'Bônus de Dano Físico',
}

function isFlatSubstat(name: string | null | undefined): boolean {
  return FLAT_SUBSTATS.has((name || '').trim().toLowerCase())
}

function formatSubstatValue(substatName: string | null | undefined, raw: number): string {
  if (!raw || raw <= 0) return '—'
  if (isFlatSubstat(substatName)) {
    // Proteção extra caso algum dado antigo tenha sido multiplicado por 100 (ex.: 9600 -> 96)
    const val = raw > 500 ? Math.round(raw / 100) : Math.round(raw)
    return `+${val}`
  }
  return `+${raw}%`
}

export default function CharacterStatsTable({ slug }: { slug: string }) {
  const { lang } = useLanguage()
  const [stats, setStats] = useState<CharStats | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch('/character-stats.json')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (data[slug]) setStats(data[slug])
        else setError(true)
      })
      .catch(() => setError(true))
  }, [slug])

  if (error) return <p className="status">Stats por nível não disponíveis.</p>
  if (!stats) return <p className="status">Carregando stats...</p>

  const rawHeader = stats.substat_name || 'Substat'
  const substatHeader =
    lang === 'pt'
      ? SUBSTAT_PT[rawHeader.trim().toLowerCase()] ?? rawHeader
      : rawHeader

  return (
    <div className="char-stats-table-wrap">
      <table className="char-stats-table">
        <thead>
          <tr>
            <th>Ascensão</th>
            <th>HP</th>
            <th>ATK</th>
            <th>DEF</th>
            <th>{substatHeader}</th>
          </tr>
        </thead>
        <tbody>
          {LEVELS.map((lv) => {
            const s = stats.levels[String(lv)]
            if (!s) return null
            const isMax = lv === 90
            return (
              <tr key={lv} className={isMax ? 'is-max' : ''}>
                <td className="level-cell">{lv === 1 ? '1 (base)' : `Lv. ${lv}`}</td>
                <td>{s.hp.toLocaleString('pt-BR')}</td>
                <td>{s.atk.toLocaleString('pt-BR')}</td>
                <td>{s.def.toLocaleString('pt-BR')}</td>
                <td className="substat-cell">
                  {formatSubstatValue(stats.substat_name, s.substat)}
                  {isMax && s.substat > 0 && <TrendingUp size={14} />}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
