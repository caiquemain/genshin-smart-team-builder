import { useState } from 'react'
import { api } from '../api/client'
import { useLanguage } from '../context/LanguageContext'
import BuildSubstitutesEditor from './BuildSubstitutesEditor'
import type { TeamDetail, TeamMemberWithBuild, Substitute } from '../types'

export default function TeamSlotSubstitutesModal({
  team,
  member,
  onClose,
  onSave
}: {
  team: TeamDetail
  member: TeamMemberWithBuild
  onClose: () => void
  onSave: (updatedTeam: TeamDetail) => void
}) {
  const { lang } = useLanguage()
  const [substitutes, setSubstitutes] = useState<Substitute[]>(member.substitutes || [])
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const updated = await api.updateSlotSubstitutes(team.id, member.position, substitutes, lang)
      onSave(updated)
      onClose()
    } catch (e) {
      console.error(e)
      alert("Erro ao salvar as alternativas do slot.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="picker-overlay" onClick={onClose}>
      <div className="picker-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
        <div className="picker-header">
          <div>
            <div className="picker-title">Alternativas para {member.character.name}</div>
            <div className="picker-subtitle">Quem pode substituir este slot no time?</div>
          </div>
          <button className="picker-close" onClick={onClose} aria-label="Fechar">✕</button>
        </div>

        <div className="picker-body" style={{ padding: '24px' }}>
          <BuildSubstitutesEditor
            substitutes={substitutes}
            currentCharacterSlug={member.character.slug}
            onChange={setSubstitutes}
          />
        </div>

        <div className="picker-footer">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar Alternativas'}
          </button>
        </div>
      </div>
    </div>
  )
}
