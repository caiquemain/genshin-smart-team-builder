import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { useLanguage } from '../context/LanguageContext'
import { artifactIconUrl } from '../config'
import type { ArtifactSetDetail, ArtifactPieceSlot } from '../types'

const SLOT_LABELS: Record<string, string> = {
  EQUIP_BRACER: 'Flor da Vida',
  EQUIP_NECKLACE: 'Pluma da Morte',
  EQUIP_SHOES: 'Ampulheta do Tempo',
  EQUIP_RING: 'Cálice de Espaço',
  EQUIP_DRESS: 'Coroa da Razão',
}

const SLOT_ORDER = ['EQUIP_BRACER', 'EQUIP_NECKLACE', 'EQUIP_SHOES', 'EQUIP_RING', 'EQUIP_DRESS']

function PieceCard({ slotKey, piece }: { slotKey: string; piece: ArtifactPieceSlot }) {
  const img = artifactIconUrl(piece.icon)
  return (
    <div className="piece-card">
      <div className="piece-card-icon">
        {img ? <img src={img} alt={piece.name} loading="lazy" /> : <span>?</span>}
      </div>
      <div className="piece-card-body">
        <div className="piece-card-slot">{SLOT_LABELS[slotKey] ?? slotKey}</div>
        <div className="piece-card-name">{piece.name}</div>
        {piece.description && (
          <p className="piece-card-desc">{piece.description}</p>
        )}
      </div>
    </div>
  )
}

export default function ArtifactDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const { lang } = useLanguage()
  const [artifact, setArtifact] = useState<ArtifactSetDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) return
    setArtifact(null)
    setError(null)
    api.getArtifact(slug, lang).then(setArtifact).catch((e) => setError(String(e)))
  }, [slug, lang])

  if (error) return <p className="error">Erro: {error}</p>
  if (!artifact) return <p className="status">Carregando...</p>

  const img = artifactIconUrl(artifact.icon)
  const pieces = artifact.pieces || {}
  const orderedSlots = SLOT_ORDER.filter((s) => s in pieces)

  return (
    <div className="artifact-page">
      <Link to="/artifacts" className="back">← Artefatos</Link>

      <div className="artifact-hero">
        <div className="artifact-hero-icon">
          {img ? <img src={img} alt={artifact.name} /> : <span>?</span>}
        </div>
        <div className="artifact-hero-info">
          <div className="artifact-hero-rarity">{'★'.repeat(artifact.rarity_max)}</div>
          <h1>{artifact.name}</h1>
          {artifact.level_list && (
            <p className="artifact-hero-levels">
              Raridades disponíveis: {artifact.level_list.join('★, ')}★
            </p>
          )}
          {artifact.source && (
            <p className="artifact-hero-source">
              <span className="artifact-source-label">Fonte:</span> {artifact.source}
            </p>
          )}
        </div>
      </div>

      <h2>Bônus do conjunto</h2>
      <div className="artifact-bonuses">
        {artifact.two_piece_bonus && (
          <div className="artifact-bonus-card bonus-2pc">
            <div className="bonus-badge">2 peças</div>
            <p>{artifact.two_piece_bonus}</p>
          </div>
        )}
        {artifact.four_piece_bonus && (
          <div className="artifact-bonus-card bonus-4pc">
            <div className="bonus-badge">4 peças</div>
            <p>{artifact.four_piece_bonus}</p>
          </div>
        )}
      </div>

      {orderedSlots.length > 0 && (
        <>
          <h2>Peças</h2>
          <div className="pieces-grid">
            {orderedSlots.map((slotKey) => (
              <PieceCard key={slotKey} slotKey={slotKey} piece={pieces[slotKey]} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
