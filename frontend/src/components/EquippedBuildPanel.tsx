import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Gem, ShieldCheck, Swords, AlertCircle, CheckCircle2 } from 'lucide-react'
import { api } from '../api/client'
import { artifactIconUrl, iconUrl } from '../config'
import { useLanguage } from '../context/LanguageContext'
import type { GoodCharState } from '../utils/good-parser'
import {
  auditEquippedBuild,
  buildArtifactSetLookup,
  buildWeaponLookup,
  computeCharacterBuildStats,
  formatCanonicalStatValue,
  loadCharacterStatsDataset,
  STAT_SHORT_LABEL_PT,
  type CharacterStatsDataset,
} from '../utils/char-stats-calc'
import type { ArtifactSetSummary, CharacterBuild, WeaponSummary } from '../types'

interface EquippedBuildPanelProps {
  slug: string
  element: string
  weaponType: string
  goodState: GoodCharState
  recommendedBuild?: CharacterBuild | null
}

function cvTierClass(cv: number): string {
  if (cv >= 210) return 'cv-insane'
  if (cv >= 180) return 'cv-great'
  if (cv >= 140) return 'cv-good'
  return 'cv-mid'
}

export default function EquippedBuildPanel({
  slug,
  element,
  weaponType,
  goodState,
  recommendedBuild,
}: EquippedBuildPanelProps) {
  const { lang } = useLanguage()
  const [statsDataset, setStatsDataset] = useState<CharacterStatsDataset>({})
  const [weapons, setWeapons] = useState<WeaponSummary[]>([])
  const [artifactSets, setArtifactSets] = useState<ArtifactSetSummary[]>([])

  useEffect(() => {
    let active = true
    loadCharacterStatsDataset().then((d) => {
      if (active) setStatsDataset(d)
    })
    api
      .listWeapons(lang, { weapon_type: weaponType, limit: 200 })
      .then((res) => {
        if (active) setWeapons(res.items)
      })
      .catch(() => {})
    api
      .listArtifacts(lang, { limit: 200 })
      .then((res) => {
        if (active) setArtifactSets(res.items)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [lang, weaponType])

  const weaponLookup = useMemo(() => buildWeaponLookup(weapons), [weapons])
  const artifactSetLookup = useMemo(() => buildArtifactSetLookup(artifactSets), [artifactSets])

  const computed = useMemo(
    () =>
      computeCharacterBuildStats({
        slug,
        element,
        goodState,
        statsDataset,
        weaponLookup,
        artifactSetLookup,
      }),
    [slug, element, goodState, statsDataset, weaponLookup, artifactSetLookup],
  )

  const audit = useMemo(
    () => auditEquippedBuild(computed, recommendedBuild),
    [computed, recommendedBuild],
  )

  const primaryBonus =
    computed.physicalDmgBonus > computed.elemDmgBonus && computed.physicalDmgBonus >= 20
      ? { label: 'Dano Físico', value: `${computed.physicalDmgBonus.toFixed(1)}%` }
      : computed.healingBonus > computed.elemDmgBonus && computed.healingBonus >= 15
        ? { label: 'Bônus Cura', value: `${computed.healingBonus.toFixed(1)}%` }
        : {
            label: STAT_SHORT_LABEL_PT[computed.elemDmgKey] ?? 'Dano Elem.',
            value: `${computed.elemDmgBonus.toFixed(1)}%`,
          }

  return (
    <section id="minha-build" className="char-section-anchor eb-section">
      <div className="eb-header">
        <div>
          <h2 className="eb-title">Minha Build Equipada</h2>
          <div className="eb-subtitle">
            <span>Lv. {computed.level}</span>
            <span>·</span>
            <span>C{computed.cons}</span>
            <span>·</span>
            <span>
              Talentos {computed.talents.na}/{computed.talents.es}/{computed.talents.eb}
            </span>
            {computed.activeSets.length > 0 && (
              <>
                <span>·</span>
                <span className="eb-active-sets">
                  {computed.activeSets.map((s) => `${s.pieces}pc ${s.name}`).join(' + ')}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="eb-badges">
          {computed.hasArtifacts && (
            <span className={`eb-cv-badge ${cvTierClass(computed.totalCritValue)}`} title="Crit Value total dos substats dos artefatos (2×Taxa + Dano Crít)">
              {computed.totalCritValue.toFixed(1)} CV
            </span>
          )}
          <span className={`eb-audit-badge status-${audit.status}`}>
            {audit.status === 'built' ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
            {audit.label}
          </span>
        </div>
      </div>

      {/* Stats finais calculados + Arma equipada */}
      <div className="eb-top-grid">
        <div className="eb-stats-card">
          <div className="eb-card-label">Stats Calculados (Base + Arma + Artefatos + 2pc)</div>
          <div className="eb-stats-grid">
            <div className="eb-stat-item">
              <span className="eb-stat-name">Vida</span>
              <strong className="eb-stat-val">
                {computed.hasBaseData ? computed.totalHp.toLocaleString('pt-BR') : '—'}
              </strong>
            </div>
            <div className="eb-stat-item">
              <span className="eb-stat-name">ATQ</span>
              <strong className="eb-stat-val">
                {computed.hasBaseData ? computed.totalAtk.toLocaleString('pt-BR') : '—'}
              </strong>
            </div>
            <div className="eb-stat-item">
              <span className="eb-stat-name">DEF</span>
              <strong className="eb-stat-val">
                {computed.hasBaseData ? computed.totalDef.toLocaleString('pt-BR') : '—'}
              </strong>
            </div>
            <div className="eb-stat-item">
              <span className="eb-stat-name">Proficiência (EM)</span>
              <strong className="eb-stat-val">{computed.em}</strong>
            </div>
            <div className="eb-stat-item">
              <span className="eb-stat-name">Taxa Crítica</span>
              <strong className="eb-stat-val is-crit">{computed.critRate.toFixed(1)}%</strong>
            </div>
            <div className="eb-stat-item">
              <span className="eb-stat-name">Dano Crítico</span>
              <strong className="eb-stat-val is-crit">{computed.critDmg.toFixed(1)}%</strong>
            </div>
            <div className="eb-stat-item">
              <span className="eb-stat-name">Recarga (ER)</span>
              <strong className="eb-stat-val">{computed.er.toFixed(1)}%</strong>
            </div>
            <div className="eb-stat-item">
              <span className="eb-stat-name">{primaryBonus.label}</span>
              <strong className="eb-stat-val">{primaryBonus.value}</strong>
            </div>
          </div>
          <div className="eb-stats-note">
            * Não inclui buffs condicionais de passivas de 4pc, passivas de arma ou ressonância de time.
          </div>
        </div>

        <div className="eb-weapon-card">
          <div className="eb-card-label">
            <Swords size={12} style={{ verticalAlign: 'middle', marginRight: 5 }} />
            Arma Equipada
          </div>
          {computed.weapon ? (
            <div className="eb-weapon-body">
              <div className="eb-weapon-icon">
                {iconUrl(computed.weapon.icon) ? (
                  <img src={iconUrl(computed.weapon.icon)!} alt={computed.weapon.name} />
                ) : (
                  <Swords size={22} />
                )}
              </div>
              <div className="eb-weapon-info">
                <Link to={`/weapons/${computed.weapon.slug}`} className="eb-weapon-name">
                  {computed.weapon.name}
                </Link>
                <div className="eb-weapon-meta">
                  <span className="eb-weapon-rarity">{'★'.repeat(computed.weapon.rarity)}</span>
                  <span>Lv. {computed.weapon.level}</span>
                  <span>R{computed.weapon.refinement}</span>
                </div>
                <div className="eb-weapon-stats">
                  <span>ATQ Base: <strong>{computed.weapon.baseAtk}</strong></span>
                  {computed.weapon.subKey && computed.weapon.subVal > 0 && (
                    <span>
                      {STAT_SHORT_LABEL_PT[computed.weapon.subKey]}:{' '}
                      <strong>{formatCanonicalStatValue(computed.weapon.subKey, computed.weapon.subVal)}</strong>
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="eb-empty-note">Nenhuma arma equipada detectada no GOOD JSON.</p>
          )}

          {audit.notes.length > 0 && (
            <div className="eb-audit-box">
              <div className="eb-card-label">
                <ShieldCheck size={12} style={{ verticalAlign: 'middle', marginRight: 5 }} />
                Diagnóstico vs Build Recomendada
              </div>
              <ul className="eb-audit-notes">
                {audit.notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Os 5 artefatos equipados */}
      {computed.hasArtifacts ? (
        <div className="eb-artifacts-grid">
          {computed.pieces.map((p, idx) => {
            const artImg = artifactIconUrl(p.setIcon)
            return (
              <div key={`${p.slotKey}-${idx}`} className="eb-art-card">
                <div className="eb-art-head">
                  <div className="eb-art-icon">
                    {artImg ? <img src={artImg} alt={p.setName} loading="lazy" /> : <Gem size={16} />}
                  </div>
                  <div className="eb-art-head-info">
                    <div className="eb-art-slot-row">
                      <span className="eb-art-slot">{p.slotLabel}</span>
                      <span className="eb-art-lv">+{p.level}</span>
                    </div>
                    <Link to={`/artifacts/${p.setSlug}`} className="eb-art-set-name" title={p.setName}>
                      {p.setName}
                    </Link>
                  </div>
                </div>

                <div className="eb-art-main">
                  <span className="eb-art-main-label">{p.mainStatLabel}</span>
                  <strong className="eb-art-main-val">
                    {p.mainStatKey
                      ? formatCanonicalStatValue(p.mainStatKey, p.mainStatValue)
                      : '—'}
                  </strong>
                </div>

                <ul className="eb-art-subs">
                  {p.substats.map((sub, si) => {
                    const isCrit = sub.key === 'crit_rate' || sub.key === 'crit_dmg'
                    return (
                      <li key={si} className={isCrit ? 'is-crit-sub' : ''}>
                        <span>{sub.label}</span>
                        <strong>+{sub.formatted}</strong>
                      </li>
                    )
                  })}
                </ul>

                <div className="eb-art-foot">
                  <span className="eb-art-stars">{'★'.repeat(p.rarity)}</span>
                  <span className="eb-art-cv">{p.critValue.toFixed(1)} CV</span>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="eb-empty-artifacts">
          Nenhum artefato equipado encontrado no GOOD JSON para este personagem. Importe um arquivo GOOD completo no <Link to="/planner">Planejador</Link> para ver as 5 peças e o Crit Value aqui.
        </div>
      )}
    </section>
  )
}
