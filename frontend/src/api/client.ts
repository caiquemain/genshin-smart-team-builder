import type {
  AscensionCost,
  CharacterDetail,
  CharacterListResponse,
  Enums,
  LanguageCode,
  ReactionListResponse,
} from '../types'

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api'

async function request<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
  })
  const url = `${API_URL}${path}${qs.toString() ? '?' + qs.toString() : ''}`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`API ${res.status}: ${body}`)
  }
  return res.json() as Promise<T>
}

export interface CharacterFilters {
  element?: string
  weapon_type?: string
  rarity?: number
  limit?: number
  offset?: number
}

export const api = {
  getEnums: () => request<Enums>('/meta/enums'),
  listCharacters: (lang: LanguageCode, filters: CharacterFilters = {}) =>
    request<CharacterListResponse>('/characters', { lang, ...filters }),
  getCharacter: (slug: string, lang: LanguageCode) =>
    request<CharacterDetail>(`/characters/${slug}`, { lang }),
  listReactions: () => request<ReactionListResponse>('/reactions'),
  getAscensionCost: (slug: string, fromLevel: number, toLevel: number, lang: LanguageCode) =>
    request<AscensionCost>(`/characters/${slug}/ascension`, {
      from_level: fromLevel,
      to_level: toLevel,
      lang,
    }),
}
