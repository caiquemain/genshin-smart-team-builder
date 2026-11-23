import type { CSSProperties } from 'react'

export const ELEMENT_META: Record<string, { label: string; color: string }> = {
  pyro:     { label: 'Pyro',      color: '#ff9c46' },
  hydro:    { label: 'Hydro',     color: '#4cc2f1' },
  electro:  { label: 'Electro',   color: '#b398ff' },
  cryo:     { label: 'Cryo',      color: '#93e2ff' },
  anemo:    { label: 'Anemo',     color: '#73ffd0' },
  geo:      { label: 'Geo',       color: '#f2c869' },
  dendro:   { label: 'Dendro',    color: '#a5c83b' },
  qualquer: { label: 'PHEC',      color: '#e2e8f0' },
  frozen:   { label: 'Congelado', color: '#7dd3fc' },
  claymore: { label: 'Ataque Pesado', color: '#cbd5e1' },
}

/** Emblema vetorial nítido para cada elemento (sem dependência de .webp inexistente) */
export function ElementSvgIcon({ element, size = 16 }: { element: string; size?: number }) {
  const key = element.toLowerCase()
  const color = ELEMENT_META[key]?.color ?? '#94a3b8'

  switch (key) {
    case 'pyro':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12.3 2.5C12.3 2.5 17.8 6.4 17.8 12.2C17.8 16.3 15.1 19.6 12 20.5C8.5 19.6 6.2 16.4 6.2 12.6C6.2 9.6 7.9 7.1 9.4 5.6C9.3 7.3 10.1 8.5 10.9 8.9C10.5 6.4 11.4 3.9 12.3 2.5Z"
            fill={color}
          />
          <path
            d="M12 11.4C13.6 12.8 14.4 14.4 14.4 16C14.4 17.6 13.3 18.8 12 19.2C10.7 18.8 9.6 17.6 9.6 16C9.6 14.6 10.4 13.2 12 11.4Z"
            fill="#fff3e0"
            opacity="0.85"
          />
        </svg>
      )
    case 'hydro':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 2.6C12 2.6 5.8 9.8 5.8 14.4C5.8 18 8.6 20.8 12 20.8C15.4 20.8 18.2 18 18.2 14.4C18.2 9.8 12 2.6 12 2.6Z"
            fill={color}
          />
          <path
            d="M9.6 14.2C9.6 16 10.8 17.3 12.5 17.6"
            stroke="#e0f7ff"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <circle cx="14.2" cy="11.5" r="1.2" fill="#e0f7ff" opacity="0.85" />
        </svg>
      )
    case 'electro':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.6" opacity="0.55" />
          <path
            d="M13.6 3.5L6.8 13H11.6L10.4 20.5L17.2 11H12.4L13.6 3.5Z"
            fill={color}
          />
        </svg>
      )
    case 'cryo':
    case 'frozen':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 2.5V21.5M3.8 7.2L20.2 16.8M20.2 7.2L3.8 16.8"
            stroke={color}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <polygon points="12,7.5 15.8,9.8 15.8,14.2 12,16.5 8.2,14.2 8.2,9.8" fill={color} opacity="0.35" stroke={color} strokeWidth="1.4" />
          <circle cx="12" cy="12" r="2" fill="#ffffff" />
        </svg>
      )
    case 'anemo':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4 9.5H15.2C17.2 9.5 18.6 8.1 18.6 6.4C18.6 4.7 17.2 3.5 15.5 3.5C14 3.5 12.9 4.4 12.6 5.6"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M3.5 13.5H17.4C19.2 13.5 20.5 14.8 20.5 16.4C20.5 18 19.2 19.2 17.6 19.2C16.2 19.2 15.2 18.4 14.9 17.2"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M6.5 17.2H11.5"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.75"
          />
        </svg>
      )
    case 'geo':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <polygon
            points="12,2.5 20,10 16.5,20.5 7.5,20.5 4,10"
            fill={color}
            opacity="0.28"
            stroke={color}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <polygon points="12,5.8 16.6,10.5 12,17.2 7.4,10.5" fill={color} />
        </svg>
      )
    case 'dendro':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 2.8C16.8 5.2 19.5 9.2 19.5 13.5C19.5 17.6 16.2 20.5 12 20.5C7.8 20.5 4.5 17.6 4.5 13.5C4.5 9.2 7.2 5.2 12 2.8Z"
            fill={color}
            opacity="0.28"
            stroke={color}
            strokeWidth="1.7"
          />
          <path
            d="M12 6.2C14.7 8.4 16 11 16 13.6C16 16 14.2 17.8 12 17.8C9.8 17.8 8 16 8 13.6C8 11 9.3 8.4 12 6.2Z"
            fill={color}
          />
          <path d="M12 9.5V19.8" stroke="#1e293b" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      )
    case 'claymore':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M18.8 3.2L20.8 5.2L10.4 15.6L8.4 13.6L18.8 3.2Z" fill={color} />
          <path d="M7.2 12.4L11.6 16.8M8.8 15.2L5.2 18.8L4 20" stroke={color} strokeWidth="2" strokeLinecap="round" />
        </svg>
      )
    default:
      // qualquer (Pyro / Hydro / Electro / Cryo)
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="3.4" fill="#ff9c46" />
          <circle cx="16" cy="8" r="3.4" fill="#4cc2f1" />
          <circle cx="8" cy="16" r="3.4" fill="#b398ff" />
          <circle cx="16" cy="16" r="3.4" fill="#93e2ff" />
        </svg>
      )
  }
}

export function ElementPill({ element }: { element: string }) {
  const key = element.toLowerCase()
  const meta = ELEMENT_META[key] ?? { label: element, color: '#94a3b8' }
  return (
    <span
      className="element-pill"
      style={{ '--el-color': meta.color } as CSSProperties}
      title={meta.label}
    >
      <span className="element-pill-svg">
        <ElementSvgIcon element={key} size={14} />
      </span>
      <span className="element-pill-label">{meta.label}</span>
    </span>
  )
}

interface EmblemPalette {
  primary: string
  secondary: string
}

const REACTION_PALETTES: Record<string, EmblemPalette> = {
  vaporize:          { primary: '#ff9c46', secondary: '#4cc2f1' },
  melt:              { primary: '#ff9c46', secondary: '#93e2ff' },
  overloaded:        { primary: '#ff7043', secondary: '#b398ff' },
  electro_charged:   { primary: '#4cc2f1', secondary: '#b398ff' },
  frozen:            { primary: '#93e2ff', secondary: '#4cc2f1' },
  superconduct:      { primary: '#93e2ff', secondary: '#b398ff' },
  swirl:             { primary: '#73ffd0', secondary: '#38bdf8' },
  crystallize:       { primary: '#f2c869', secondary: '#fde68a' },
  burning:           { primary: '#ff7043', secondary: '#a5c83b' },
  shatter:           { primary: '#93e2ff', secondary: '#e2e8f0' },
  bloom:             { primary: '#a5c83b', secondary: '#4cc2f1' },
  hyperbloom:        { primary: '#a5c83b', secondary: '#b398ff' },
  burgeon:           { primary: '#a5c83b', secondary: '#ff9c46' },
  quicken:           { primary: '#a5c83b', secondary: '#c084fc' },
  aggravate:         { primary: '#b398ff', secondary: '#a5c83b' },
  spread:            { primary: '#84cc16', secondary: '#b398ff' },
  lunar_bloom:       { primary: '#6ee7b7', secondary: '#818cf8' },
  lunar_charged:     { primary: '#818cf8', secondary: '#38bdf8' },
  lunar_crystallize: { primary: '#fcd34d', secondary: '#818cf8' },
  stellar_conduct:   { primary: '#f472b6', secondary: '#93e2ff' },
  stellar_swirl:     { primary: '#f472b6', secondary: '#73ffd0' },
}

/** Emblema artístico SVG dedicado a cada uma das 21 reações elementais */
export function ReactionEmblem({ slug, size = 48 }: { slug: string; size?: number }) {
  const pal = REACTION_PALETTES[slug] ?? { primary: '#818cf8', secondary: '#38bdf8' }
  const gradId = `rg-${slug}`

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="6" y1="6" x2="42" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={pal.primary} />
          <stop offset="100%" stopColor={pal.secondary} />
        </linearGradient>
      </defs>

      {/* Halo externo */}
      <circle cx="24" cy="24" r="21" fill={`url(#${gradId})`} opacity="0.14" />
      <circle cx="24" cy="24" r="20" stroke={`url(#${gradId})`} strokeWidth="1.5" opacity="0.55" />

      {slug === 'vaporize' && (
        <>
          <path d="M17 11C17 11 25 16.8 25 24.5C25 29.8 21.5 34 17.5 35.2C13 34 10 29.8 10 25C10 21 12.2 17.6 14 15.6C13.8 17.8 14.8 19.3 15.8 19.8C15.3 16.5 16 13.2 17 11Z" fill={pal.primary} />
          <path d="M31.5 13C31.5 13 24.5 21.2 24.5 26.8C24.5 31 27.6 34.4 31.5 34.4C35.4 34.4 38.5 31 38.5 26.8C38.5 21.2 31.5 13 31.5 13Z" fill={pal.secondary} opacity="0.92" />
          <path d="M21 10C22.5 8 25.5 8 27 10" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" opacity="0.8" />
        </>
      )}

      {slug === 'melt' && (
        <>
          <path d="M18 11C18 11 26 17 26 24.5C26 30 22.3 34.2 18.2 35.4C13.5 34.2 10.5 30 10.5 25.2C10.5 21.2 12.8 17.6 14.8 15.6C14.6 17.8 15.6 19.3 16.6 19.8C16 16.6 16.8 13.2 18 11Z" fill={pal.primary} />
          <path d="M31 14V32M23.2 18.5L38.8 27.5M38.8 18.5L23.2 27.5" stroke={pal.secondary} strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="31" cy="23" r="3" fill="#ffffff" />
        </>
      )}

      {slug === 'overloaded' && (
        <>
          <polygon points="24,8 27.5,17 37,13 31.5,21.5 40,26 30.5,28.5 34,38 24.5,32 16,38 18.5,28.5 9,26 17.5,21.5 12,13 20.5,17" fill={`url(#${gradId})`} />
          <path d="M25.5 15L20 24.5H24.2L22.6 33L28.5 23.5H24.3L25.5 15Z" fill="#fff7ed" />
        </>
      )}

      {slug === 'electro_charged' && (
        <>
          <path d="M21 11C21 11 12.5 20.6 12.5 27.2C12.5 32.2 16.3 36 21 36C25.7 36 29.5 32.2 29.5 27.2C29.5 20.6 21 11 21 11Z" fill={pal.primary} opacity="0.88" />
          <path d="M31.5 12L23.5 24H29L26.8 36L36.5 22H30.5L31.5 12Z" fill={pal.secondary} stroke="#1e1b4b" strokeWidth="1" />
        </>
      )}

      {slug === 'frozen' && (
        <>
          <polygon points="24,9 36.5,16.2 36.5,31.8 24,39 11.5,31.8 11.5,16.2" fill={`url(#${gradId})`} opacity="0.28" stroke={pal.primary} strokeWidth="2" />
          <path d="M24 11V37M12.8 17.5L35.2 30.5M35.2 17.5L12.8 30.5" stroke={pal.primary} strokeWidth="2" strokeLinecap="round" />
          <polygon points="24,18 29,21 29,27 24,30 19,27 19,21" fill="#e0f2fe" />
        </>
      )}

      {slug === 'superconduct' && (
        <>
          <path d="M18 13V33M10 18L26 28M26 18L10 28" stroke={pal.primary} strokeWidth="2.2" strokeLinecap="round" />
          <path d="M32 11L25 23.5H30L28 36L37 22H31.8L32 11Z" fill={pal.secondary} />
        </>
      )}

      {slug === 'swirl' && (
        <>
          <path d="M24 10C31.7 10 38 16.3 38 24C38 29.5 34.4 34 29.5 35.8" stroke={pal.primary} strokeWidth="2.6" strokeLinecap="round" />
          <path d="M24 38C16.3 38 10 31.7 10 24C10 18.5 13.6 14 18.5 12.2" stroke={pal.secondary} strokeWidth="2.6" strokeLinecap="round" />
          <path d="M18 24C18 20.7 20.7 18 24 18C27.3 18 30 20.7 30 24C30 26.8 28 29.2 25.3 29.8" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
          <circle cx="24" cy="24" r="2.6" fill={pal.primary} />
        </>
      )}

      {slug === 'crystallize' && (
        <>
          <path d="M24 9L36 15V25C36 32 30.6 36.8 24 39C17.4 36.8 12 32 12 25V15L24 9Z" fill={pal.primary} opacity="0.24" stroke={pal.primary} strokeWidth="2" />
          <polygon points="24,14 31,22 24,33 17,22" fill={`url(#${gradId})`} />
        </>
      )}

      {slug === 'burning' && (
        <>
          <path d="M24 10C30 13.5 33.5 19 33.5 25.2C33.5 31.2 29.2 35.8 24 35.8C18.8 35.8 14.5 31.2 14.5 25.2C14.5 19 18 13.5 24 10Z" fill={pal.secondary} opacity="0.35" stroke={pal.secondary} strokeWidth="1.8" />
          <path d="M24.2 12C24.2 12 31 17.2 31 24.4C31 29.4 27.8 33.5 24 34.6C19.8 33.5 17 29.5 17 24.8C17 21.2 19 18.2 20.8 16.4C20.6 18.5 21.6 19.9 22.6 20.4C22.1 17.2 23 14.2 24.2 12Z" fill={pal.primary} />
        </>
      )}

      {slug === 'shatter' && (
        <>
          <polygon points="15,13 24,10 22,22 12,24" fill={pal.primary} opacity="0.85" />
          <polygon points="27,11 36,16 33,25 25,21" fill={pal.secondary} opacity="0.9" />
          <polygon points="14,27 23,25 25,36 16,35" fill={pal.secondary} opacity="0.75" />
          <polygon points="27,25 36,28 32,37 26,34" fill={pal.primary} opacity="0.85" />
          <path d="M24 10L24 38M12 24L36 24" stroke="#0f172a" strokeWidth="1.8" />
        </>
      )}

      {slug === 'bloom' && (
        <>
          <path d="M24 12C29.5 15.5 33 20.2 33 25.5C33 30.8 29 35 24 35C19 35 15 30.8 15 25.5C15 20.2 18.5 15.5 24 12Z" fill={pal.primary} />
          <circle cx="24" cy="25" r="5.5" fill={pal.secondary} opacity="0.9" />
          <circle cx="24" cy="25" r="2.2" fill="#f0fdf4" />
        </>
      )}

      {slug === 'hyperbloom' && (
        <>
          <path d="M12 31C16 25 21 20 33 14" stroke={pal.secondary} strokeWidth="2.8" strokeLinecap="round" />
          <polygon points="36,12 29,21 27,16 22,14" fill={pal.primary} />
          <circle cx="15" cy="30" r="5" fill={pal.primary} opacity="0.9" />
          <path d="M31 24L27 30H30.5L29.2 36L34.8 29H31.2L31 24Z" fill={pal.secondary} />
        </>
      )}

      {slug === 'burgeon' && (
        <>
          <polygon points="24,9 28,17.5 37,15 32,23 39,29 29.5,30 31,38 24,33 17,38 18.5,30 9,29 16,23 11,15 20,17.5" fill={pal.secondary} />
          <circle cx="24" cy="24" r="6.5" fill={pal.primary} />
          <circle cx="24" cy="24" r="2.8" fill="#fefce8" />
        </>
      )}

      {slug === 'quicken' && (
        <>
          <circle cx="24" cy="24" r="12" stroke={`url(#${gradId})`} strokeWidth="2.2" strokeDasharray="5 3" />
          <path d="M25.5 13L17.5 24.5H23.2L21.8 35L30.5 23.5H24.8L25.5 13Z" fill={`url(#${gradId})`} />
        </>
      )}

      {slug === 'aggravate' && (
        <>
          <path d="M25.5 10L16 24.5H22.8L20.8 38L32 22.5H25L25.5 10Z" fill={pal.primary} />
          <path d="M32 13L35 16L32 19M13 29L16 32L13 35" stroke={pal.secondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}

      {slug === 'spread' && (
        <>
          <path d="M24 10C29.5 14 33 19 33 24.8C33 30.2 29 34.5 24 34.5C19 34.5 15 30.2 15 24.8C15 19 18.5 14 24 10Z" fill={pal.primary} />
          <path d="M24 14V34M24 22L29 18M24 26L19 22" stroke="#1e293b" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="34" cy="14" r="2.5" fill={pal.secondary} />
          <circle cx="14" cy="33" r="2.5" fill={pal.secondary} />
        </>
      )}

      {(slug === 'lunar_bloom' || slug === 'lunar_charged' || slug === 'lunar_crystallize') && (
        <>
          <path
            d="M28.5 11.5C21.8 12.2 16.5 17.8 16.5 24.6C16.5 31.8 22.4 37.5 29.6 37.5C32.2 37.5 34.6 36.7 36.6 35.4C33.8 36 30.7 35.2 28.4 33C24.2 29 24.2 22.2 28.4 18.1C30.4 16.1 33 15.2 35.6 15.4C33.7 13 31.2 11.7 28.5 11.5Z"
            fill={`url(#${gradId})`}
          />
          <circle cx="15" cy="16" r="2.2" fill={pal.primary} />
          <path d="M33 21L34.2 23.8L37 25L34.2 26.2L33 29L31.8 26.2L29 25L31.8 23.8L33 21Z" fill="#ffffff" />
        </>
      )}

      {(slug === 'stellar_conduct' || slug === 'stellar_swirl') && (
        <>
          <path
            d="M24 9L27.6 19.6L38.5 24L27.6 28.4L24 39L20.4 28.4L9.5 24L20.4 19.6L24 9Z"
            fill={`url(#${gradId})`}
          />
          <circle cx="24" cy="24" r="3.5" fill="#ffffff" />
        </>
      )}
    </svg>
  )
}
