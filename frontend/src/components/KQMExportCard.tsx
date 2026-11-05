import React, { forwardRef } from 'react';
import { Hourglass, Wine, Crown } from 'lucide-react';
import { iconUrl, artifactIconUrl } from '../config';
import { formatStatLabel } from '../utils/stats';
import type { TeamMemberWithBuild, WeaponSummary, ArtifactSetSummary, CharacterSummary } from '../types';

interface Props {
  member: TeamMemberWithBuild;
  teamMembers: TeamMemberWithBuild[];
  weapons: Map<string, WeaponSummary>;
  artifacts: Map<string, ArtifactSetSummary>;
  chars: Map<string, CharacterSummary>;
  mainElement: string;
  talentIcons?: { normal?: string; skill?: string; burst?: string };
}

// Pixel transparente 1x1 em Base64 para substituir imagens quebradas
const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

const handleImgError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
  e.currentTarget.src = TRANSPARENT_PIXEL;
  e.currentTarget.style.opacity = '0';
};

export const KQMExportCard = forwardRef<HTMLDivElement, Props>(
  ({ member, teamMembers, weapons, artifacts, chars, mainElement, talentIcons }, ref) => {
    const c = member.character;
    const b = member.build;
    
    const localSplashUrl = `/splash_arts/${c.slug}.webp?v=2`;

    const elementColors: Record<string, string> = {
      cryo: '#93e2ff', hydro: '#4cc2f1', pyro: '#ff9c46', 
      electro: '#b398ff', anemo: '#73ffd0', geo: '#f2c869', dendro: '#a5c83b'
    };
    const glowColor = elementColors[mainElement] || '#b398ff';

    if (!b) return null;

    const mainTeam = teamMembers.filter(tm => tm.character.slug !== c.slug).slice(0, 3);
    const mainTeamSlugs = new Set(teamMembers.map(tm => tm.character.slug));

    const rawSubs = member.substitutes || [];
    const uniqueSubs = Array.from(new Set(rawSubs.map(s => s.character_slug)))
      .map(slug => rawSubs.find(s => s.character_slug === slug))
      .filter(s => s && s.character_slug && !mainTeamSlugs.has(s.character_slug) && chars.has(s.character_slug))
      .slice(0, 3); 

    const getBadgeLabel = (label: string | null) => {
      if (!label) return null;
      if (label.toLowerCase().includes('opção') || label.toLowerCase().includes('option')) return null;
      return label;
    };

    const renderTalentPriority = () => {
      const priorityStr = b.talent_priority || 'Skill > Burst';
      const parts = priorityStr.split('>').map(p => p.trim().toLowerCase());
      
      return (
        <div className="kqm-talent-icons">
          {parts.map((part, idx) => {
            let icon = '';
            let label = part;
            
            if (part.includes('normal') || part === 'na' || part.includes('attack')) { 
              icon = talentIcons?.normal || ''; label = 'Normal'; 
            } else if (part.includes('skill') || part === 'e') { 
              icon = talentIcons?.skill || ''; label = 'Skill'; 
            } else if (part.includes('burst') || part === 'q') { 
              icon = talentIcons?.burst || ''; label = 'Burst'; 
            }

            return (
              <React.Fragment key={idx}>
                {idx > 0 && <span className="kqm-talent-arrow">&gt;</span>}
                {icon ? (
                  <div className="kqm-talent-icon-wrap" title={label}>
                    <img src={iconUrl(icon) || ''} alt={label} onError={handleImgError} />
                  </div>
                ) : (
                  <span className="kqm-talent-text">{label}</span>
                )}
              </React.Fragment>
            );
          })}
        </div>
      );
    };

    return (
      <div 
        ref={ref} 
        className="kqm-export-wrapper" 
        style={{ '--kqm-glow': glowColor } as React.CSSProperties}
      >
        <div className="kqm-export-left">
          <div className="kqm-char-portrait">
            <img 
              src={localSplashUrl} 
              alt={c.name} 
              onError={(e) => {
                // Fallback para o ícone normal se a splash art não existir
                e.currentTarget.src = iconUrl(c.icon) || TRANSPARENT_PIXEL;
                e.currentTarget.style.objectFit = 'cover';
                e.currentTarget.style.borderRadius = '50%';
                e.currentTarget.style.padding = '40px';
              }}
            />
          </div>
          
          <div className="kqm-char-info-gradient"></div>

          <div className="kqm-char-info">
            <h1>{c.name}</h1>
            <div className="kqm-role">
              <span className="kqm-element-icon">{c.element}</span>
              <span>Main DPS</span>
            </div>
            <div className="kqm-stars">{'★'.repeat(c.rarity)}</div>
          </div>
        </div>

        <div className="kqm-export-right">
          <div className="kqm-section kqm-weapons">
            <h2>Armas</h2>
            <div className="kqm-grid">
              {b.weapons.map((w, i) => {
                const info = w.weapon_slug ? weapons.get(w.weapon_slug) : null;
                return (
                  <div key={i} className="kqm-item-card">
                    <div className={`kqm-icon rarity-${info?.rarity ?? 4}`}>
                      {info ? <img src={iconUrl(info.icon)!} alt={info.name} onError={handleImgError} /> : '?'}
                    </div>
                    <div className="kqm-item-name">{info?.name ?? w.weapon_slug}</div>
                    {w.weapon_refinement && <span className="kqm-badge">R{w.weapon_refinement}</span>}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="kqm-row">
            <div className="kqm-section kqm-artifacts">
              <h2>Artefatos</h2>
              <div className="kqm-grid">
                {b.artifacts_4pc.map((a, i) => {
                  const info = a.artifact_set_slug ? artifacts.get(a.artifact_set_slug) : null;
                  return (
                    <div key={`4pc-${i}`} className="kqm-item-card">
                      <div className="kqm-icon">
                        {info ? <img src={artifactIconUrl(info.icon)!} alt={info.name} onError={handleImgError} /> : '?'}
                      </div>
                      <span className="kqm-badge">4pc</span>
                      <div className="kqm-item-name">{info?.name ?? a.artifact_set_slug}</div>
                    </div>
                  );
                })}
                {b.artifacts_2pc.map((p, i) => {
                  const s1 = p.set1_slug ? artifacts.get(p.set1_slug) : null;
                  const s2 = p.set2_slug ? artifacts.get(p.set2_slug) : null;
                  return (
                    <div key={`2pc-${i}`} className="kqm-item-card">
                      <div className="kqm-icon" style={{ fontSize: 14 }}>2+2</div>
                      <div className="kqm-item-name">{s1?.name || p.set1_slug} + {s2?.name || p.set2_slug}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="kqm-section kqm-talents">
              <h2>Prioridade de Talentos</h2>
              <div className="kqm-talent-box">
                {renderTalentPriority()}
              </div>
            </div>
          </div>

          <div className="kqm-row">
            <div className="kqm-section kqm-stats">
              <h2>Status Principais</h2>
              <ul>
                <li><Hourglass size={16} className="stat-icon" /> {b.sands_stat.map(formatStatLabel).join(' / ')}</li>
                <li><Wine size={16} className="stat-icon" /> {b.goblet_stat.map(formatStatLabel).join(' / ')}</li>
                <li><Crown size={16} className="stat-icon" /> {b.circlet_stat.map(formatStatLabel).join(' / ')}</li>
              </ul>
            </div>

            <div className="kqm-section kqm-substats">
              <h2>Substatus</h2>
              <div className="kqm-substat-list">
                {b.substat_priority.map((s, i) => (
                  <span key={i} className="kqm-substat-item">{i + 1}. {formatStatLabel(s)}</span>
                ))}
              </div>
              {b.er_requirement && (
                <div className="kqm-er-req">
                  <strong>Recarga de Energia:</strong> {b.er_requirement}
                </div>
              )}
            </div>
          </div>

          <div className="kqm-section kqm-synergies">
            <h2>Sinergia do Time</h2>
            
            <div className="kqm-synergy-main">
              {mainTeam.map((tm) => {
                const tImg = iconUrl(tm.character.icon);
                return (
                  <div key={tm.character.slug} className="kqm-synergy-card" data-element={tm.character.element}>
                    <div className="kqm-synergy-avatar">
                      {tImg ? <img src={tImg} alt={tm.character.name} onError={handleImgError} /> : '?'}
                    </div>
                    <div className="kqm-synergy-name">{tm.character.name}</div>
                  </div>
                );
              })}
            </div>

            {uniqueSubs.length > 0 && (
              <div className="kqm-substitutes-area">
                <div className="kqm-substitutes-label">Substitutos viáveis:</div>
                <div className="kqm-substitutes-grid">
                  {uniqueSubs.map((sub: any, i: number) => {
                    const subChar = chars.get(sub.character_slug);
                    if (!subChar) return null;
                    const subImg = iconUrl(subChar.icon);
                    const badgeLabel = getBadgeLabel(sub.build_label);
                    
                    return (
                      <div key={`${sub.character_slug}-${i}`} className="kqm-sub-card">
                        <div className="kqm-sub-avatar" data-element={subChar.element}>
                          {subImg ? <img src={subImg} alt={subChar.name} onError={handleImgError} /> : '?'}
                          {badgeLabel && (
                            <span className="kqm-sub-badge">{badgeLabel}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <p className="kqm-footer-text">Gerado pelo Genshin Smart Team Builder</p>
          </div>
        </div>
      </div>
    );
  }
);
