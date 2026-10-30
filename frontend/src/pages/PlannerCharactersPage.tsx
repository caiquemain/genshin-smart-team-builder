import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Users, Flame, Droplets, Snowflake, Zap, Wind, Mountain, Leaf } from 'lucide-react'
import PlannerCharacterCard from '../components/PlannerCharacterCard'
import type { Plan } from '../types/planner'

const ELEMENT_COLORS: Record<string, string> = {
  pyro: '#ff9c46', hydro: '#4cc2f1', electro: '#b398ff', cryo: '#93e2ff',
  anemo: '#73ffd0', geo: '#f2c869', dendro: '#a5c83b',
}
const ELEMENT_ICONS: Record<string, any> = {
  pyro: Flame, hydro: Droplets, electro: Zap, cryo: Snowflake,
  anemo: Wind, geo: Mountain, dendro: Leaf,
}

// Mapa de elementos a partir do slug (via API de personagens)
const ELEMENT_MAP: Record<string, string> = {
  // Pyro
  hutao: 'pyro', yoimiya: 'pyro', diluc: 'pyro', klee: 'pyro', klee_: 'pyro',
  amber: 'pyro', xiangling: 'pyro', bennett: 'pyro', xinyan: 'pyro', yanfei: 'pyro',
  tohma: 'pyro', thoma: 'pyro', yoimiya_: 'pyro', dehya: 'pyro', lyney: 'pyro',
  gaming: 'pyro', arlecchino: 'pyro', mavuika: 'pyro', durin: 'pyro', nicole: 'pyro',
  // Hydro
  barbara: 'hydro', xingqiu: 'hydro', mona: 'hydro', tartaglia: 'hydro',
  kokomi: 'hydro', ayato: 'hydro', yelan: 'hydro', nilou: 'hydro',
  candace: 'hydro', neuvillette: 'hydro', furina: 'hydro', sigewinne: 'hydro',
  mualani: 'hydro', columbina: 'hydro', vodyanitsa: 'hydro', aino: 'hydro', dahlia: 'hydro',
  // Electro
  razor: 'electro', beidou: 'electro', lisa: 'electro', keqing: 'electro',
  fischl: 'electro', shogun: 'electro', yae_miko: 'electro', kuki: 'electro',
  shinobu: 'electro', sara: 'electro', dori: 'electro', cyno: 'electro',
  clorinde: 'electro', ororon: 'electro', iansan: 'electro', varesa: 'electro',
  ineffa: 'electro', flins: 'electro', alyosha: 'electro',
  // Cryo
  qiqi: 'cryo', kaeya: 'cryo', chongyun: 'cryo', ganyu: 'cryo', ayaka: 'cryo',
  diona: 'cryo', rosaria: 'cryo', eula: 'cryo', shenhe: 'cryo', layla: 'cryo',
  mika: 'cryo', wriothesley: 'cryo', charlotte: 'cryo', freminet: 'cryo',
  chevreuse: 'pyro', citlali: 'cryo', skirk: 'cryo', escoffier: 'cryo',
  odette: 'cryo', lohen: 'cryo', sandrone: 'cryo',
  // Anemo
  jean: 'anemo', sucrose: 'anemo', venti: 'anemo', xiao: 'anemo', kazuha: 'anemo',
  sayu: 'anemo', heizou: 'anemo', wanderer: 'anemo', faruzan: 'anemo', lynette: 'anemo',
  xianyun: 'anemo', chasca: 'anemo', ifa: 'anemo', lanyan: 'anemo',
  mizuki: 'anemo', jahoda: 'anemo', varka: 'anemo', prune: 'anemo', vesna: 'anemo',
  // Geo
  ningguang: 'geo', noelle: 'geo', zhongli: 'geo', albedo: 'geo', gorou: 'geo',
  itto: 'geo', arataki_itto: 'geo', yunjin: 'geo', chiori: 'geo', navia: 'geo',
  kachina: 'geo', xilonen: 'geo', zibai: 'geo', illuga: 'geo', linnea: 'geo',
  // Dendro
  collei: 'dendro', tighnari: 'dendro', nahida: 'dendro', baizhu: 'dendro',
  kaveh: 'dendro', yaoyao: 'dendro', kirara: 'dendro', alhaitham: 'dendro',
  kinich: 'dendro', emilie: 'dendro', nefer: 'dendro', lauma: 'dendro',
}

function elementOf(slug: string): string | undefined {
  const normalized = slug.toLowerCase().replace(/-/g, '_')
  return ELEMENT_MAP[normalized] ?? ELEMENT_MAP[slug]
}

export default function PlannerCharactersPage() {
  const [plan, setPlan] = useState<Plan | null>(null)
  const [elementFilter, setElementFilter] = useState('')

  useEffect(() => {
    try {
      const raw = localStorage.getItem('gsb.planner.plan')
      if (raw) setPlan(JSON.parse(raw))
    } catch {}
  }, [])

  const filtered = useMemo(() => {
    if (!plan) return []
    if (!elementFilter) return plan.chars
    return plan.chars.filter((c) => elementOf(c.slug) === elementFilter)
  }, [plan, elementFilter])

  if (!plan) {
    return (
      <div className="planner-empty-state">
        <h1>Personagens do Planner</h1>
        <p>Nenhum plano carregado. Importe o JSON e clique em <strong>Calcular custo total</strong>.</p>
        <Link to="/planner" className="btn-primary">← Voltar ao Planner</Link>
      </div>
    )
  }

  return (
    <div>
      <div className="planner-chars-header">
        <Link to="/planner" className="planner-back-link"><ArrowLeft size={16} /> Voltar ao Planner</Link>
        <h1><Users size={32} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }} /> Personagens do Planner</h1>
        <p className="planner-chars-subtitle">{plan.chars.length} personagens no plano</p>
      </div>

      <div className="plan-element-filter">
        <button
          className={`plan-element-pill ${elementFilter === '' ? 'active' : ''}`}
          onClick={() => setElementFilter('')}
        >
          Todos
        </button>
        {Object.entries(ELEMENT_COLORS).map(([el, color]) => {
          const Icon = ELEMENT_ICONS[el]
          if (!Icon) return null
          return (
            <button
              key={el}
              className={`plan-element-pill ${elementFilter === el ? 'active' : ''}`}
              style={{ '--pill-color': color } as React.CSSProperties}
              onClick={() => setElementFilter(elementFilter === el ? '' : el)}
            >
              <Icon size={14} />
              {el.charAt(0).toUpperCase() + el.slice(1)}
            </button>
          )
        })}
      </div>

      <div className="plan-chars-grid">
        {filtered.map((c) => (
          <PlannerCharacterCard
            key={c.slug}
            char={c}
            element={elementOf(c.slug)}
            inventory={plan.inventory_resolved}
          />
        ))}
      </div>
    </div>
  )
}
