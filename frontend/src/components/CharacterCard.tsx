import { Link } from 'react-router-dom'
import type { CharacterSummary } from '../types'
import { iconUrl } from '../config'

const ELEMENT_EMOJI: Record<string, string> = {
  pyro: '🔥', hydro: '💧', electro: '⚡', cryo: '❄️',
  anemo: '🌀', geo: '🪨', dendro: '🌿',
}

export default function CharacterCard({ char }: { char: CharacterSummary }) {
  const img = iconUrl(char.icon)
  return (
    <Link
      to={`/characters/${char.slug}`}
      className={`card element-${char.element}`}
    >
      <div className="card-rarity">{'★'.repeat(char.rarity)}</div>
      <div className="card-avatar">
        {img
          ? <img src={img} alt={char.name} loading="lazy" />
          : <span className="card-emoji">{ELEMENT_EMOJI[char.element] ?? '?'}</span>}
      </div>
      <div className="card-name">{char.name}</div>
      <div className="card-meta">
        <span>{char.element}</span>
        <span className="card-dot">·</span>
        <span>{char.weapon_type}</span>
      </div>
      {char.region && <div className="card-region">{char.region}</div>}
    </Link>
  )
}
