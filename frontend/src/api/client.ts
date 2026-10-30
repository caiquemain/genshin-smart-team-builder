import type { Substitute, BuildPreset,
  AscensionCost,
  CharacterBuild,
  TeamTemplateListResponse,
  TeamTemplateDetail,
  ArchetypesResponse,
  ArtifactSetListResponse,
  ArtifactSetDetail,
  TeamAnalysisResponse,
  WeaponSummary,
  WeaponListResponse,
  WeaponDetail,
  WeaponAscensionResponse,
  CharacterDetail,
  CharacterListResponse,
  Enums,
  LanguageCode,
  ReactionListResponse,
  TalentCost,
  TeamCreate,
  TeamDetail,
  TeamListResponse,
  TeamTierInfo,
} from '../types'
import type { TierlistResponse, CharacterTierlistResponse, TierlistSite } from '../types/tierlist'

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
  listTemplates: (filters: { archetype?: string; main_character?: string; character_slug?: string } = {}) =>
    request<TeamTemplateListResponse>('/teams/templates', filters),
  getTemplate: (id: number) => request<TeamTemplateDetail>(`/teams/templates/${id}`),
  listArchetypes: () => request<ArchetypesResponse>('/teams/templates/archetypes'),
  listArtifacts: (lang: LanguageCode, filters: { rarity?: number; limit?: number } = {}) =>
    request<ArtifactSetListResponse>('/artifacts', { lang, ...filters }),
  getArtifact: (slug: string, lang: LanguageCode) =>
    request<ArtifactSetDetail>(`/artifacts/${slug}`, { lang }),
  analyzeTeam: (slugs: string[], lang: LanguageCode) =>
    fetch(`${API_URL}/teams/analyze?lang=${lang}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ character_slugs: slugs }),
    }).then(async (r) => {
      if (!r.ok) throw new Error(`API ${r.status}: ${await r.text()}`)
      return r.json() as Promise<TeamAnalysisResponse>
    }),
  listWeapons: (lang: LanguageCode, filters: { weapon_type?: string; rarity?: number; limit?: number } = {}) =>
    request<WeaponListResponse>('/weapons', { lang, ...filters }),
  getWeapon: (slug: string, lang: LanguageCode) =>
    request<WeaponDetail>(`/weapons/${slug}`, { lang }),
  getWeaponAscension: (slug: string, fromLevel: number, toLevel: number, lang: LanguageCode) =>
    request<WeaponAscensionResponse>(`/weapons/${slug}/ascension`, {
      from_level: fromLevel, to_level: toLevel, lang,
    }),
  listTeams: (lang: LanguageCode) =>
    request<TeamListResponse>('/teams', { lang }),
  getTeam: (id: number, lang: LanguageCode) =>
    request<TeamDetail>(`/teams/${id}`, { lang }),
  createTeam: (payload: TeamCreate, lang: LanguageCode) =>
    fetch(`${API_URL}/teams?lang=${lang}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(async (r) => {
      if (!r.ok) throw new Error(`API ${r.status}: ${await r.text()}`)
      return r.json() as Promise<TeamDetail>
    }),
  deleteTeam: (id: number) =>
    fetch(`${API_URL}/teams/${id}`, { method: 'DELETE' }).then((r) => {
      if (!r.ok) throw new Error(`API ${r.status}`)
    }),
  getTierlist: (params: { role?: string; version?: string } = {}) =>
    request<TierlistResponse>('/tierlist', params),
  getTierlistSites: () => request<TierlistSite[]>('/tierlist/sites'),
  getCharacterTierlist: (slug: string) =>
    request<CharacterTierlistResponse>(`/tierlist/character/${slug}`),
  previewTier: (characterSlugs: string[]) =>
    fetch(`${API_URL}/teams/preview-tier`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ character_slugs: characterSlugs }),
    }).then(async (r) => {
      if (!r.ok) throw new Error(`API ${r.status}: ${await r.text()}`)
      return r.json() as Promise<TeamTierInfo>
    }),
  listPresets: (characterSlug: string) => request<BuildPreset[]>(`/presets/${characterSlug}`),
  createPreset: (payload: { character_slug: string, name: string, build_data: CharacterBuild }) =>
    fetch(`${API_URL}/presets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then((r) => {
      if (!r.ok) throw new Error(`API ${r.status}`)
      return r.json() as Promise<BuildPreset>
    }),
  deletePreset: (presetId: number) =>
    fetch(`${API_URL}/presets/${presetId}`, { method: 'DELETE' }).then((r) => { if (!r.ok) throw new Error('Err') }),
  updateSlotSubstitutes: (teamId: number, position: number, substitutes: Substitute[], lang: LanguageCode) =>
    fetch(`${API_URL}/teams/${teamId}/slots/${position}/substitutes?lang=${lang}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(substitutes),
    }).then((r) => {
      if (!r.ok) throw new Error(`API ${r.status}`)
      return r.json() as Promise<TeamDetail>
    }),
  updateTeamMembers: (teamId: number, characterSlugs: string[], lang: LanguageCode) =>
    fetch(`${API_URL}/teams/${teamId}/members?lang=${lang}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ character_slugs: characterSlugs }),
    }).then((r) => {
      if (!r.ok) throw new Error(`API ${r.status}`)
      return r.json() as Promise<TeamDetail>
    }),
  updateTeamBuilds: (teamId: number, builds: Record<number, CharacterBuild>, lang: LanguageCode) =>
    fetch(`${API_URL}/teams/${teamId}/builds?lang=${lang}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ builds }),
    }).then(async (r) => {
      if (!r.ok) throw new Error(`API ${r.status}: ${await r.text()}`)
      return r.json()
    }),
  getAscensionCost: (slug: string, fromLevel: number, toLevel: number, lang: LanguageCode) =>
    request<AscensionCost>(`/characters/${slug}/ascension`, {
      from_level: fromLevel,
      to_level: toLevel,
      lang,
    }),
  getTalentCost: (slug: string, na: number, es: number, eb: number, target: number, lang: LanguageCode) =>
    request<TalentCost>(`/characters/${slug}/talents`, {
      na, es, eb, target, lang,
    }),
}
