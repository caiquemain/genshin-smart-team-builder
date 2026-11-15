import { useEffect, useState } from 'react'
import { TrendingUp } from 'lucide-react'

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

export default function CharacterStatsTable({ slug }: { slug: string }) {
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

  return (
    <div className="char-stats-table-wrap">
      <table className="char-stats-table">
        <thead>
          <tr>
            <th>Ascensão</th>
            <th>HP</th>
            <th>ATK</th>
            <th>DEF</th>
            <th>{stats.substat_name || 'Substat'}</th>
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
                  {s.substat > 0 ? `+${s.substat}%` : '—'}
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
