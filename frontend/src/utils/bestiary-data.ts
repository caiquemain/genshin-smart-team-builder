import type { BestiaryData } from '../types/bestiary';

const URL = '/bestiary-data.json';

let cached: BestiaryData | null = null;
let inflight: Promise<BestiaryData> | null = null;

export async function loadBestiaryData(): Promise<BestiaryData> {
  if (cached) return cached;
  if (inflight) return inflight;

  inflight = (async () => {
    const res = await fetch(URL, { cache: 'default' });
    if (!res.ok) throw new Error(`Falha ao carregar ${URL}: HTTP ${res.status}`);
    const data: BestiaryData = await res.json();
    cached = data;
    return data;
  })().finally(() => { inflight = null });

  return inflight;
}
