import { Link } from 'react-router-dom'
import type { CharacterSummary } from '../types'

const ELEMENT_EMOJI: Record<string, string> = {
  pyro: '🔥', hydro: '💧', electro: '⚡', cryo: '❄️',
  anemo: '🌀', geo: '🪨', dendro: '🌿',
}

export default function CharacterCard({ char }: { char: CharacterSummary }) {
  return (
    <Link to={`/characters/${char.slug}`} className="card">
      <div className="card-rarity">{'★'.repeat(char.rarity)}</div>
      <div className="card-emoji">{ELEMENT_EMOJI[char.element] ?? '?'}</div>
      <div className="card-name">{char.name}</div>
      <div className="card-meta">
        {char.element} · {char.weapon_type}
      </div>
      {char.region && <div className="card-region">{char.region}</div>}
    </Link>
  )
}
