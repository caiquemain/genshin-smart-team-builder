import { useEffect } from 'react'
import { X, Sword, Sparkles, Gem, Coins, Zap, AlertCircle, Check } from 'lucide-react'
import { iconUrl } from '../config'
import { useLanguage } from '../context/LanguageContext'
import type { AggregateMaterial, CharBreakdown } from '../types/planner'
import { estimateResin } from '../utils/resin'

const ELEMENT_COLORS: Record<string, string> = {
  pyro: '#ff9c46', hydro: '#4cc2f1', electro: '#b398ff', cryo: '#93e2ff',
  anemo: '#73ffd0', geo: '#f2c869', dendro: '#a5c83b',
}
const ELEMENT_ICON_NAME: Record<string, string> = {
  pyro: 'UI_Buff_Element_Fire', hydro: 'UI_Buff_Element_Water',
  electro: 'UI_Buff_Element_Electric', cryo: 'UI_Buff_Element_Ice',
  anemo: 'UI_Buff_Element_Wind', geo: 'UI_Buff_Element_Rock',
  dendro: 'UI_Buff_Element_Grass',
}
const RARITY_GRADIENTS: Record<number, string> = {
  1: 'linear-gradient(160deg,rgba(79,88,100,0.75) 0%,rgba(95,102,115,0.75) 39%,rgba(135,147,156,0.75) 100%)',
  2: 'linear-gradient(160deg,rgba(72,87,92,0.75) 0%,rgba(72,107,103,0.75) 39%,rgba(98,152,113,0.75) 100%)',
  3: 'linear-gradient(160deg,rgba(81,84,116,0.75) 0%,rgba(80,104,135,0.75) 39%,rgba(75,160,180,0.75) 100%)',
  4: 'linear-gradient(160deg,rgba(89,84,130,0.75) 0%,rgba(120,102,157,0.75) 39%,rgba(183,133,201,0.75) 100%)',
  5: 'linear-gradient(160deg,rgba(105,84,83,0.75) 0%,rgba(161,112,78,0.75) 39%,rgba(228,171,82,0.75) 100%)',
}

function formatMoraShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`
  return String(n)
}

function mergeMatsIntoMap(target: Map<string, AggregateMaterial>, mats: any[]) {
  for (const m of mats ?? []) {
    const existing = target.get(m.slug)
    if (existing) {
      existing.quantity += m.quantity
    } else {
      target.set(m.slug, {
        ...m,
        resin_estimate: (m as any).resin_estimate ?? estimateResin(m.category, m.quantity),
      })
    }
  }
}

function MaterialRow({ material, have, lang }: { material: AggregateMaterial; have: number; lang: string }) {
  const img = iconUrl(material.icon)
  const isComplete = have >= material.quantity && material.quantity > 0
  const missing = Math.max(0, material.quantity - have)
  return (
    <div className={`plan-modal-mat-row ${isComplete ? 'is-complete' : have > 0 ? 'is-partial' : ''}`}>
      <div className="plan-modal-mat-icon" style={{ background: RARITY_GRADIENTS[material.rarity ?? 1] }}>
        {img ? <img src={img} alt={material.name} loading="lazy" /> : <span>?</span>}
      </div>
      <div className="plan-modal-mat-info">
        <div className="plan-modal-mat-name">{material.name}</div>
        <div className="plan-modal-mat-qty">
          <span className="plan-modal-qty-total">{material.quantity.toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US')}</span>
          {have > 0 && !isComplete && (
            <span className="plan-modal-qty-missing">
              (falta {missing.toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US')})
            </span>
          )}
          {isComplete && <span className="plan-modal-qty-check"><Check size={12} /></span>}
        </div>
      </div>
    </div>
  )
}

export default function PlannerCharacterModal({
  char, element, inventory, onClose,
}: {
  char: CharBreakdown
  element: string | undefined
  inventory: Record<string, number>
  onClose: () => void
}) {
  const { lang } = useLanguage()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const accent = element ? ELEMENT_COLORS[element] ?? '#7dd3fc' : '#7dd3fc'
  const img = iconUrl(char.icon) || (element ? iconUrl(ELEMENT_ICON_NAME[element]) : null)
  const cons = char.char_goal?.cons ?? 0
  const curLevel = char.char_goal?.current.level
  const goalLevel = char.char_goal?.goal.level

  // === Agrupa materiais ===
  const ascensionMats: AggregateMaterial[] = []
  if (char.ascension) {
    const map = new Map<string, AggregateMaterial>()
    mergeMatsIntoMap(map, char.ascension.materials)
    ascensionMats.push(...map.values())
    if (char.ascension.total_mora > 0) {
      ascensionMats.push({
        slug: '__mora_asc__', name: 'Mora', icon: 'UI_ItemIcon_202', rarity: 3,
        category: 'mora', description: null, source: null,
        quantity: char.ascension.total_mora, resin_estimate: 0,
      })
    }
  }

  const talentMats: AggregateMaterial[] = []
  if (char.talents) {
    const map = new Map<string, AggregateMaterial>()
    mergeMatsIntoMap(map, char.talents.grand_total_materials)
    talentMats.push(...map.values())
    if (char.talents.grand_total_mora > 0) {
      talentMats.push({
        slug: '__mora_tal__', name: 'Mora', icon: 'UI_ItemIcon_202', rarity: 3,
        category: 'mora', description: null, source: null,
        quantity: char.talents.grand_total_mora, resin_estimate: 0,
      })
    }
  }

  const weaponMats: AggregateMaterial[] = []
  for (const w of char.weapons) {
    if (w.cost) {
      const map = new Map<string, AggregateMaterial>()
      mergeMatsIntoMap(map, w.cost.materials)
      weaponMats.push(...map.values())
      if (w.cost.total_mora > 0) {
        weaponMats.push({
          slug: `__mora_w_${w.slug}__`, name: 'Mora', icon: 'UI_ItemIcon_202', rarity: 3,
          category: 'mora', description: null, source: null,
          quantity: w.cost.total_mora, resin_estimate: 0,
        })
      }
    }
  }

  // === Totais ===
  const totalMora =
    (char.ascension?.total_mora ?? 0) +
    (char.talents?.grand_total_mora ?? 0) +
    char.weapons.reduce((sum, w) => sum + (w.cost?.total_mora ?? 0), 0)

  // Resina: só conta o que falta
  const allResin = [...ascensionMats, ...talentMats, ...weaponMats].reduce((sum, m) => {
    const have = inventory[m.slug] ?? 0
    const missing = Math.max(0, m.quantity - have)
    if (missing === 0) return sum
    // Mora: ~60k por 20 resin
    if (m.slug.startsWith('__mora_')) {
      return sum + Math.ceil(missing / 60000) * 20
    }
    return sum + (m.resin_estimate || 0)
  }, 0)
  const estimatedDays = Math.ceil(allResin / 180)

  return (
    <div className="plan-modal-overlay" onClick={onClose}>
      <div className="plan-modal" onClick={(e) => e.stopPropagation()}>
        {/* HEADER */}
        <div className="plan-modal-header">
          <div className="plan-modal-portrait" style={{ background: `color-mix(in srgb, ${accent} 25%, transparent)` }}>
            {img ? <img src={img} alt={char.name} /> : <span>?</span>}
            <div className="plan-modal-portrait-gradient" />
          </div>
          <div className="plan-modal-header-info">
            <h2 className="plan-modal-name" style={{ color: accent }}>{char.name}</h2>
            <div className="plan-modal-meta">
              <span style={{ color: accent }}>{element ? element.charAt(0).toUpperCase() + element.slice(1) : ''}</span>
              <span>·</span>
              <span>C{cons}</span>
              {curLevel != null && goalLevel != null && (
                <>
                  <span>·</span>
                  <span>Nv. {curLevel} → {goalLevel}</span>
                </>
              )}
            </div>
            <div className="plan-modal-badges">
              {char.is_inactive && (
                <span className="plan-modal-badge plan-modal-badge-inactive">
                  {lang === 'en' ? 'Inactive' : 'Inativo'}
                </span>
              )}
              {char.is_complete && !char.is_inactive && (
                <span className="plan-modal-badge plan-modal-badge-complete">
                  <Check size={12} /> {lang === 'en' ? 'Complete' : 'Completo'}
                </span>
              )}
              {!char.is_complete && !char.is_inactive && (
                <span className="plan-modal-badge plan-modal-badge-pending">
                  <AlertCircle size={12} /> {lang === 'en' ? 'Pending' : 'Pendente'}
                </span>
              )}
            </div>
          </div>
          <button className="plan-modal-close" onClick={onClose} aria-label="Fechar">
            <X size={20} />
          </button>
        </div>

        {/* BODY - 2 colunas */}
        <div className="plan-modal-body">
          {/* COLUNA ESQUERDA: Talentos + Armas + Summary */}
          <div className="plan-modal-col-left">
            {char.talent_goal && (
              <section className="plan-modal-section">
                <h3 className="plan-modal-section-title">
                  <Sparkles size={16} /> {lang === 'en' ? 'Talents' : 'Talentos'}
                </h3>
                <div className="plan-modal-talents">
                  {(['normal', 'skill', 'burst'] as const).map((key) => {
                    const t = char.talent_goal![key]
                    if (!t) return null
                    const pct = Math.min(100, (t.current / 10) * 100)
                    const goalPct = Math.min(100, (t.goal / 10) * 100)
                    const isMax = t.current === t.goal
                    return (
                      <div key={key} className="plan-modal-talent">
                        <div className="plan-modal-talent-label">
                          {key === 'normal' ? (lang === 'en' ? 'Normal' : 'Normal') :
                           key === 'skill' ? (lang === 'en' ? 'Skill' : 'Skill') :
                           (lang === 'en' ? 'Burst' : 'Burst')}
                        </div>
                        <div className="plan-modal-talent-bar">
                          <div className="plan-modal-talent-fill" style={{ width: `${pct}%`, background: accent }} />
                          <div className="plan-modal-talent-goal" style={{ width: `${goalPct}%`, background: accent }} />
                        </div>
                        <div className="plan-modal-talent-range">
                          {isMax ? (lang === 'en' ? 'MAX' : 'MÁX') : `${t.current} → ${t.goal}`}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {char.weapons.length > 0 && (
              <section className="plan-modal-section">
                <h3 className="plan-modal-section-title">
                  <Sword size={16} /> {lang === 'en' ? 'Weapons' : 'Armas'} ({char.weapons.length})
                </h3>
                <div className="plan-modal-weapons">
                  {char.weapons.map((w, i) => (
                    <div key={`${w.slug}-${i}`} className="plan-modal-weapon">
                      <div className="plan-modal-weapon-icon" style={{ background: RARITY_GRADIENTS[w.rarity] }}>
                        {iconUrl(w.icon) ? <img src={iconUrl(w.icon)!} alt={w.name} /> : <span>?</span>}
                      </div>
                      <div className="plan-modal-weapon-info">
                        <div className="plan-modal-weapon-name">{w.name}</div>
                        <div className="plan-modal-weapon-meta">
                          Nv. {w.from_level} → {w.to_level}
                          {w.cost?.total_mora > 0 && ` · ${formatMoraShort(w.cost.total_mora)} Mora`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="plan-modal-summary">
              <div className="plan-modal-summary-item">
                <Coins size={18} />
                <div>
                  <div className="plan-modal-summary-label">{lang === 'en' ? 'Total Mora' : 'Mora Total'}</div>
                  <div className="plan-modal-summary-value">{formatMoraShort(totalMora)}</div>
                </div>
              </div>
              <div className="plan-modal-summary-item">
                <Zap size={18} />
                <div>
                  <div className="plan-modal-summary-label">{lang === 'en' ? 'Est. Days' : 'Dias Estimados'}</div>
                  <div className="plan-modal-summary-value">
                    {estimatedDays === 0 ? (lang === 'en' ? 'Ready' : 'Pronto') : estimatedDays}
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* COLUNA DIREITA: Materiais */}
          <div className="plan-modal-col-right">
            {ascensionMats.length > 0 && (
              <section className="plan-modal-section">
                <h3 className="plan-modal-section-title">
                  <Gem size={16} /> {lang === 'en' ? 'Ascension' : 'Ascensão'}
                </h3>
                <div className="plan-modal-mats-grid">
                  {ascensionMats.map((m) => (
                    <MaterialRow key={m.slug} material={m} have={inventory[m.slug] ?? 0} lang={lang} />
                  ))}
                </div>
              </section>
            )}

            {talentMats.length > 0 && (
              <section className="plan-modal-section">
                <h3 className="plan-modal-section-title">
                  <Sparkles size={16} /> {lang === 'en' ? 'Talent Mats' : 'Materiais de Talentos'}
                </h3>
                <div className="plan-modal-mats-grid">
                  {talentMats.map((m) => (
                    <MaterialRow key={m.slug} material={m} have={inventory[m.slug] ?? 0} lang={lang} />
                  ))}
                </div>
              </section>
            )}

            {weaponMats.length > 0 && (
              <section className="plan-modal-section">
                <h3 className="plan-modal-section-title">
                  <Sword size={16} /> {lang === 'en' ? 'Weapon Mats' : 'Materiais de Armas'}
                </h3>
                <div className="plan-modal-mats-grid">
                  {weaponMats.map((m) => (
                    <MaterialRow key={m.slug} material={m} have={inventory[m.slug] ?? 0} lang={lang} />
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>

        {/* FOOTER */}
        <div className="plan-modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            {lang === 'en' ? 'Close' : 'Fechar'}
          </button>
        </div>
      </div>
    </div>
  )
}
