import type { BestiaryData } from '../types/bestiary';
import { loadBestiaryData } from './bestiary-data';

let cachedBestiary: BestiaryData | null = null;

export async function getBestiaryData(): Promise<BestiaryData> {
  if (cachedBestiary) return cachedBestiary;
  cachedBestiary = await loadBestiaryData();
  return cachedBestiary;
}

export function getWLDropMultiplier(wl: number): number {
  const table: Record<number, number> = {
    0: 0.3, 1: 0.4, 2: 0.5, 3: 0.6, 4: 0.7, 
    5: 0.8, 6: 0.9, 7: 0.95, 8: 1.0, 9: 1.0
  };
  return table[wl] ?? 1.0;
}

export interface KillsResult {
  monsterName: string;
  kills: number;
  dropRate: number;
}

export function calculateKills(
  itemSlug: string,
  missingQty: number,
  wl: number,
  bestiary: BestiaryData
): KillsResult | null {
  if (missingQty <= 0) return null;
  
  let bestMonster = null;
  let bestRate = 0;

  for (const monster of Object.values(bestiary)) {
    for (const drop of monster.drops) {
      if (drop.slug === itemSlug && drop.rate && drop.rate > bestRate) {
        bestRate = drop.rate;
        bestMonster = monster;
      }
    }
  }

  if (!bestMonster) return null;

  const wlMult = getWLDropMultiplier(wl);
  const adjustedRate = bestRate * wlMult;
  const kills = Math.ceil(missingQty / (adjustedRate / 100));
  
  return { 
    monsterName: bestMonster.name, 
    kills, 
    dropRate: adjustedRate 
  };
}

/**
 * Calcula kills para uma família inteira, considerando alquimia (3:1).
 * O array `family` DEVE estar ordenado do tier mais baixo para o mais alto.
 */
export function calculateFamilyKills(
  family: string[],
  inventory: Record<string, number>,
  required: Record<string, number>,
  wl: number,
  bestiary: BestiaryData
): KillsResult | null {
  let surplus = 0;  // Excedente acumulado (em unidades do tier atual)
  let totalKills = 0;
  let monsterName = '';
  let dropRate = 0;
  const monsters = new Set<string>();

  for (let i = 0; i < family.length; i++) {
    const slug = family[i];
    const need = required[slug] ?? 0;
    const have = inventory[slug] ?? 0;
    
    // Excedente do tier inferior convertido para este tier
    const fromAlchemy = Math.floor(surplus / 3);
    
    const available = have + fromAlchemy;
    const missing = Math.max(0, need - available);
    
    // O excedente deste tier para o próximo
    surplus = Math.max(0, available - need);
    
    if (missing > 0) {
      const kills = calculateKills(slug, missing, wl, bestiary);
      if (kills) {
        totalKills += kills.kills;
        monsters.add(kills.monsterName);
        if (!monsterName) {
          monsterName = kills.monsterName;
          dropRate = kills.dropRate;
        }
      }
    }
  }
  
  if (totalKills === 0) return null;
  
  // Se houver múltiplos monstros, retorna "Monstros variados"
  const finalName = monsters.size > 1 
    ? `${monsters.size} tipos de monstros` 
    : monsterName;
  
  return { monsterName: finalName, kills: totalKills, dropRate };
}
