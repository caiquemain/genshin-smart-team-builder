import { useEffect, useState } from 'react'
import { loadPlannerData, pickLang } from '../utils/planner-data'
import { buildIndexes, resolveCharSlug, resolveWeaponSlug } from '../utils/slug-resolver'
import { computeAscensionCost, computeTalentCost } from '../utils/planner-compute'

export default function _DebugPage() {
  const [log, setLog] = useState<string[]>([])
  const push = (s: string) => setLog((l) => [...l, s])

  useEffect(() => {
    ;(async () => {
      try {
        const data = await loadPlannerData()
        push(`version: ${data.version}`)
        push(`chars: ${Object.keys(data.characters).length}`)
        push(`weapons: ${Object.keys(data.weapons).length}`)
        push(`materials: ${Object.keys(data.materials).length}`)

        buildIndexes(data)
        push(`resolve 'hutao' (seelie): ${resolveCharSlug('hutao')}`)
        push(`resolve 'HuTao' (GOOD): ${resolveCharSlug('HuTao')}`)
        push(`resolve 'kazuha' (seelie): ${resolveCharSlug('kazuha')}`)
        push(`resolve 'KaedeharaKazuha' (GOOD): ${resolveCharSlug('KaedeharaKazuha')}`)
        push(`resolve 'TravelerCryo' (GOOD): ${resolveCharSlug('TravelerCryo')}`)
        push(`resolve 'staff_of_homa': ${resolveWeaponSlug('staff_of_homa')}`)
        push(`resolve 'StaffOfHoma': ${resolveWeaponSlug('StaffOfHoma')}`)

        push(`hu-tao name pt: ${pickLang(data.characters['hu-tao'].name, 'pt')}`)

        const asc = computeAscensionCost(data, 'hu-tao', 1, 90, 'pt')
        push(`hu-tao asc 1→90: ${asc.total_mora} mora, ${asc.phases.length} fases, ${asc.materials.length} materiais`)

        const tal = computeTalentCost(
          data, 'hu-tao',
          { current: 1, goal: 9 },
          { current: 1, goal: 9 },
          { current: 1, goal: 9 },
          'pt',
        )
        push(`hu-tao talent 1→9: ${tal.grand_total_mora} mora, ${tal.grand_total_materials.length} materiais`)
      } catch (e) {
        push(`ERRO: ${String(e)}`)
      }
    })()
  }, [])

  return (
    <div style={{ padding: 24, fontFamily: 'monospace', fontSize: 13, color: 'white' }}>
      <h1>Debug planner-data</h1>
      {log.map((l, i) => <div key={i}>{l}</div>)}
    </div>
  )
}