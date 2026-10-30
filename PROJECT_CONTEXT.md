# PROJECT_CONTEXT.md

> Arquivo vivo de contexto do projeto. **Sempre atualizar** ao final de cada sessão.
> Última atualização: **2026-10-31** — Team tier badge em 3 páginas + live preview no builder

---

## 1. Visão geral

**Nome:** Genshin Smart Team Builder & Resource Calculator
**Objetivo:** Montar times de Genshin Impact com análise de sinergia + calcular
recursos de ascensão/talentos. Viés acadêmico (Ciência de Dados + Eng. de Software + Extensão).
**Estágio:** MVP funcional em dev local (Docker), sem deploy público ainda.

---

## 2. Stack

| Camada | Tecnologia | Versão |
|---|---|---|
| Backend | FastAPI + SQLAlchemy + Alembic | Python 3.14.4 |
| Banco | PostgreSQL | 16-alpine |
| Frontend | React + TypeScript + Vite | Node v24.18.0 |
| Container | Docker Compose | — |
| Estilo | CSS puro (styles.css único) | — |
| Tooltips | @floating-ui/react (FloatingPortal) | — |
| Ícones | lucide-react (SVGs, sem emojis) | — |

Portas (dev):
- Frontend: http://localhost:8080
- Backend:  http://localhost:8000 (docs em /docs)
- Postgres: localhost:5432

---

## 3. Como rodar (dev)

    cd ~/projects/genshin-smart-team-builder
    docker compose up -d
    docker compose ps

Serviços no compose:
- db       → postgres:16-alpine (container genshin_db)
- init     → alembic upgrade head && python -m app.seed.run (one-shot)
- backend  → FastAPI (container genshin_backend), espera init terminar
- frontend → nginx servindo build Vite (container genshin_frontend)

Env (.env ou defaults do compose):

    POSTGRES_USER=genshin
    POSTGRES_PASSWORD=genshin
    POSTGRES_DB=genshin_db

Conexão psql (user é genshin, NÃO postgres):

    docker compose exec -T db psql -U genshin -d genshin_db -c "\dt"

---

## 4. Estrutura de pastas (nível 3)

    genshin-smart-team-builder/
    ├── backend/
    │   ├── alembic/versions/       → 14 migrations (ver §6)
    │   └── app/
    │       ├── api/                → characters, teams, weapons, artifacts,
    │       │                          reactions, templates, talents, ascension, meta, tierlist
    │       ├── models/             → artifact, base, character, guide, material,
    │       │                          reaction, team, team_template, weapon, tierlist
    │       ├── schemas/            → artifact, ascension, build, character, common,
    │       │                          reaction, talent, team, team_analysis,
    │       │                          team_template, weapon, tierlist
    │       ├── scripts/            → import_tierlists.sql, create_view.sql
    │       ├── seed/               → seed crítico + import_from_ambr (opcional, rede)
    │       └── services/           → lógica (synergy, planner, team_tier, etc)
    ├── frontend/src/
    │   ├── api/                    → client.ts
    │   ├── components/             → (ver §5)
    │   ├── context/                → LanguageContext (i18n pt/en)
    │   ├── pages/                  → (ver §5)
    │   ├── types/                  → WeaponSlot, ArtifactSlot, ArtifactPair, CharacterBuild, tierlist
    │   ├── utils/                  → stats.ts
    │   └── styles.css
    ├── docker-compose.yml
    └── PROJECT_CONTEXT.md          ← este arquivo

---

## 5. Frontend

### Rotas (App.tsx)

| Rota | Componente | Status |
|---|---|---|
| / | CharactersPage | OK |
| /characters/:slug | CharacterDetailPage | OK |
| /weapons | WeaponsPage | OK |
| /weapons/:slug | WeaponDetailPage | OK |
| /artifacts | ArtifactsPage | OK |
| /artifacts/:slug | ArtifactDetailPage | OK |
| /teams | TeamsPage | OK |
| /teams/new | TeamBuilderPage (aceita ?template_id=X) | OK |
| /teams/templates/:id | TemplateDetailPage | OK |
| /teams/:id | TeamDetailPage | OK |
| /tierlist | TierlistPage | OK |
| /planner | PlannerPage | OK |
| /planner/characters | PlannerCharactersPage | OK |
| /reactions | ReactionsPage | OK |

### Componentes (frontend/src/components/)

- ArtifactPickerModal.tsx   ← NOVO 2026-10-29
- ArtifactTooltip.tsx       ← fix isPositioned 2026-10-29
- AscensionSection.tsx
- CharacterBuildEditor.tsx  ← reescrito 2026-10-29
- CharacterCard.tsx
- ErrorBoundary.tsx
- ItemTooltip.tsx
- LanguageSwitcher.tsx
- PlannerCharacterCard.tsx
- PlannerCharacterModal.tsx
- SubstitutePickerModal.tsx
- TalentSection.tsx
- **TeamTierBadge.tsx        ← NOVO 2026-10-31 (sm/lg, tooltip floating-ui)**
- TierlistTooltip.tsx       ← NOVO 2026-10-30
- WeaponPickerModal.tsx     ← NOVO 2026-10-29
- WeaponTooltip.tsx         ← fix isPositioned 2026-10-29

---

## 6. Backend — endpoints

Characters:     GET /characters · GET /characters/{slug}
Weapons:        GET /weapons · GET /weapons/{slug} · GET /weapons/{slug}/ascension
Artifacts:      GET /artifacts · GET /artifacts/{slug}
Reactions:      GET /reactions
Templates:      GET /templates/archetypes · GET /templates · GET /templates/{id}
Teams:          POST /teams · GET /teams · GET /teams/{id} · DELETE /teams/{id}
                POST /teams/analyze · PUT /teams/{id}/builds
                **POST /teams/preview-tier** (NOVO 2026-10-31)
Talents:        GET /talents/{slug}/talents
Ascension:      GET /ascension/{slug}/ascension
Meta:           GET /meta/enums
Tierlist:       GET /tierlist · GET /tierlist/character/{slug} · GET /tierlist/sites
                POST /tierlist/import

### Migrations (ordem)

1.  7e37ccdc25fd_initial_schema
2.  5e769935ce7b_add_character_passives_and_talent_
3.  dfc3f581619f_add_character_talent_phases_table
4.  fc0433db0f4d_extend_character_with_constellations_
5.  d9c3552b1776_extend_weapon_with_ambr_id_icon_passive_
6.  2af1566265d1_add_weapon_translations
7.  5a51d20184bd_add_weapon_ascension_phases
8.  467dc2f47c42_add_weapon_max_base_atk_for_level_90
9.  caab26b1fc70_add_weapon_max_secondary_stat_value
10. 0e8ca4668ed3_extend_artifact_sets_with_ambr_id_icon_
11. 44bcf19fbbbf_team_templates_schema_v2
12. fb1aa6e3f965_add_team_character_build_data_jsonb
13. d4e5f6g7h8i9_tierlist_aggregator
14. e5f6a7b8c9d0_add_tierlist_aggregator (tier_master, view, travelers)

### Fonte de dados
- Seed crítico local (app.seed.run) — sem rede
- app.seed.import_from_ambr — opcional, requer rede (falha → loga e segue)
- Imagens: CDN Hoyoverse via iconUrl / artifactIconUrl (config.ts)
- Travelers: portraits locais em `frontend/public/travelers/` (CDN Mobalytics bloqueia hotlink)

---

## 7. Features prontas

- DB com characters / weapons / artifacts / reactions / materials / teams / templates / tierlists
- Calculadora de ascensão + talentos
- Team builder com drag-and-drop, 4 slots
- Análise de sinergia em tempo real (score 0-100, roles, reações, warnings, sugestões)
- **Team tier badge em 3 páginas** (`/teams` sm · `/teams/:id` lg · `/teams/new` lg ao vivo com debounce 300ms)
- **`POST /teams/preview-tier`** — calcula tier do time sem persistir (usado pelo builder)
- ~40 templates KQM carregáveis via ?template_id
- Editor de build por personagem (com abas):
  - Aba Build: Multi-arma (BIS + F2P) com refino + notas por escolha
  - Aba Build: Artefatos 4pc OU 2+2 (pares) com notas por escolha
  - Aba Build: Main stats multi-select (tags) + substats ordenáveis
  - Aba Referências: links úteis (KQM, YouTube, planilhas)
  - Aba Substituições: trocar personagem ou mesma char com build diferente
  - Aba Combos: rotações e strings de ataque
- Pickers visuais de arma/artefato (grid, busca, tooltip, ESC)
- Tooltips com isPositioned gate (sem flash no 0,0)
- ESC fecha picker → editor → modal genérico
- i18n pt/en via LanguageContext
- Tierlist Aggregator: 6 sites, 758 entries, 127 chars, view v_tierlist_consensus
- Planner completo: 92 chars, badges, filtros, modal de detalhes (2 colunas)

---

## 8. Em progresso / pendente

- [x] Tooltips dos pickers (resolvido — era animation do CSS sobrescrevendo isPositioned)
- [x] Commit + push da sessão 2026-10-29 (eed34f0)
- [x] Team tier badge (2026-10-31 — f7f34d1 + ceb43c5)
- [ ] Refinar roles 1:1 (127 chars) — destrava sinergia + tier do time mais precisos
- [ ] Expandir templates KQM (~15 chars faltando)
- [ ] Deploy público + README
- [ ] Página de itens com resina tooltips

---

## 9. Banco de dados — contagens

| Item | Valor |
|------|-------|
| characters | 127 (120 + 7 travelers) |
| weapons | ~250 |
| artifact_sets | ? |
| teams | ? |
| tierlist_entries | 758 (6 sites) |
| v_tierlist_consensus | 127 chars únicos |
| Templates KQM | ~40 |

Comando de conferência:

    docker compose exec -T db psql -U genshin -d genshin_db -c "
    SELECT 'characters' t, COUNT(*) FROM characters
    UNION ALL SELECT 'weapons', COUNT(*) FROM weapons
    UNION ALL SELECT 'artifact_sets', COUNT(*) FROM artifact_sets
    UNION ALL SELECT 'teams', COUNT(*) FROM teams
    UNION ALL SELECT 'tierlist_entries', COUNT(*) FROM tierlist_entries;
    "

---

## 10. Decisões arquiteturais

- build_data é JSONB → schemas novos são backward-compatible (Pydantic extra='ignore')
- Enums Postgres: sempre native_enum=False (evita conflito em migrations)
- Main Stats no `CharacterBuild` são `list[str]` (ex: Cálice pode ter Cryo DMG e ATK%). Usa `field_validator(mode='before')` para converter dados antigos (string) em lista.
- **Slots vs Builds**: A Build é do Personagem (`CharacterBuildPreset`). Os Substitutos são do Slot do Time (`TeamCharacter.substitutes` JSONB). Trocar de personagem preserva o Slot e seus substitutos.
- **Proteção de UniqueConstraint**: O endpoint `PUT /members` usa posições temporárias negativas (`-pos - 100`) antes de deletar/inserir, evitando erros de duplicidade.
- **Auto-Preset**: Ao trocar o personagem de um slot, o backend busca o preset mais recente (`CharacterBuildPreset`) daquele char e aplica automaticamente no slot.
- **Layout full-width condicional**: O componente `MainContent` em `App.tsx` usa `useLocation()` pra aplicar `container-wide` (max-width: 100%) só em `/teams/:id` e `/tierlist`. Outras rotas mantêm `max-width: 1100px`.
- **Fetch otimizado na TeamDetailPage**: coleta os slugs em uso (`weapons`, `artifacts_4pc`, `artifacts_2pc`) e busca individualmente via `GET /weapons/{slug}` e `GET /artifacts/{slug}`.
- **Schema retorno de arma**: `WeaponDetail` inclui `max_base_atk=w.max_base_atk` no construtor manual do endpoint `get_weapon`.
- **Planner dividido em 2 rotas**: `/planner` (import + cálculo) e `/planner/characters` (cards). `Plan` serializado em `localStorage`.
- **Planner - fallback de travelers**: `resolveSlug` retorna o slug mesmo sem estar no Map.
- **Badges com contraste independente**: opacity 0.55 só em portrait/mats/talents/name.
- **Lista de weapons no Planner**: usa `limit: 500`.
- **Estimativa de resina baseada no que falta**: `missing = material.quantity - inventory[slug]`. Mora: `ceil(missing / 60000) * 20`.
- **Biblioteca de Ícones**: `lucide-react`. Todos os emojis de UI foram trocados por SVGs.
- **Animações CSS**: `@keyframes` para `slideUpFade`, `cardDeal`, hover transitions, `pulseBorder`.
- **Conic Gradient para Score**: `conic-gradient` com variável CSS `--score`.
- **Team tier = média arredondada (half-up) dos tiers individuais** (S+=6…D=1). Lookup via `v_tierlist_consensus` → `consensus_tier` de cada char. 4 chars → média → tier do time.
- **Preview-tier vs TeamDetail**: `POST /teams/preview-tier` recebe slugs e devolve `{tier, avg_score, breakdown}` sem tocar no banco. `team_tier` inline no `TeamDetail` é computado on-the-fly no GET.
- i18n via LanguageContext (pt/en)
- Tooltips usam FloatingPortal (renderiza no document.body) — não afetados por backdrop-filter
- isPositioned é OBRIGATÓRIO em todo tooltip: `opacity:0` inline até Floating UI calcular posição
- CSS dos tooltips: NUNCA usar animation de opacity — sobrescreve inline e reintroduz flash. Usar `transition: opacity 120ms ease-out`
- Hierarquia z-index: modal base 10000 → picker 10100 → tooltip 20000 (!important)

---

## 11. Armadilhas conhecidas

1. backdrop-filter em overlay quebra position:fixed de filhos → tooltips usam Portal
2. animation: tooltip-fade sobrescreve opacity: isPositioned ? 1 : 0 → flash no 0,0. NÃO reintroduzir
3. CharacterBuild antigo (flat) é ignorado pelo extra='ignore' → times pré-migração voltam com weapons: []
4. Enums Postgres: sempre native_enum=False
5. psql no container db: user é genshin, não postgres
6. **Model ORM precisa declarar `tier_master`** — sem isso, `e.tier_master` dá AttributeError
7. **Slugs de Traveler: sempre hyphen** (`traveler-cryo`), nunca underscore. Prydwen é a fonte do bug histórico
8. **consensus_tier (moda) ≠ tier_by_avg (média) em ~20% dos casos** — é feature, não bug. Grid usa moda; tooltip mostra os dois
9. **Team tier usa consensus_tier, não tier_by_avg** — assim o badge bate com a coluna do grid
10. **`preview-tier` no builder: debounce de 300ms** — chamar em todo `onChange` mata o backend

---

## 12. Backlog / roadmap

- (A) **Refinar roles 1:1** — atribuir role (main_dps/sub_dps/support) manualmente aos 127 chars. Destrava sinergia, tier do time, sugestões do builder
- (B) Expandir templates KQM (~15 chars: Mavuika, Citlali, Chasca, Nefer, Varessa, Ifa, Xilonen)
- (C) Deploy público + README (maior gap pra apresentação acadêmica)
- (D) Página de itens (`/characters/:slug`, `/weapons/:slug`, `/artifacts/:slug`) com tooltips de resina
- (E) Sistema de usuário (login, times por conta, wishlist, histórico de pulls)
- (F) Refinar sinergia (mono-geo, mono-pyro como válidos)

---

## 13. Sessão 2026-10-29

**Feito:**
- Schema CharacterBuild migrado: weapons[], artifacts_4pc[], artifacts_2pc[] (pares), cada slot com notes
- Abas: Referências, Substituições e Combos
- Main Stats → multi-select (`list[str]`) com retrocompatibilidade
- Página `/teams/:id` (TeamDetailPage) com renderização de builds completas
- Sistema de troca de personagens via `CharacterPickerModal`
- Sistema de Presets (`character_build_presets`)
- Sistema de Substitutos por Slot (`TeamCharacter.substitutes` JSONB)
- `SubstitutePickerModal` com notas curadas da KQM
- `WeaponPickerModal.tsx` + `ArtifactPickerModal.tsx`
- `CharacterBuildEditor.tsx` reescrito
- CSS novo: picker-*, build-item-*, build-pair-*, build-mode-*
- Fix z-index dos tooltips (20000)
- Fix flash no 0,0: isPositioned inline + animation → transition
- Commit: `eed34f0`

---

## 14. Git — estado

Branch: main

**Commits desta sessão (2026-10-31):**

    f7f34d1 feat(team-builder): live preview tier while building
    ceb43c5 feat(team): team tier badge from tierlist consensus

**Commit anterior (sessão 2026-10-30, Tierlist):**

    aba9d87 fix(tierlist): normalize Mobalytics + Prydwen Overall to 'general' role

**Commits históricos:**

    eed34f0 feat(templates+builds): KQM team templates, pickers, per-item build notes
    44bc840 fix(weapons): EM flat scaling + precise crit curve for Lv.90 substats
    9cbb392 feat(ui): artifacts module, weapon/artifact tooltips, Lv.90 max stats
    fdbcbbf feat(weapons): compute max secondary stat at Lv.90
    f4312e7 feat(weapons): compute max base ATK at Lv.90
    0ed6611 fix(synergy): stronger penalty for 3+ on-field DPS

---

## 15. Discussão — Tierlist Aggregator

**Contexto:** agregador de tierlists que puxa dados de vários sites (KQM, Game8, Prydwen, Genshin.gg, GenshinLab, Mobalytics, GameWith) e consolida via view.

**Consolidação:** `v_tierlist_consensus` expõe `consensus_tier` (moda), `tier_by_avg` (média), `spread`, `tiers_voted`, `dominant_role`.

**Status:** ✅ completo. 6 sites, 758 entries, 127 chars. Ver §17.

---

## 16. ⏸️ ONDE PARAMOS (sessão 2026-10-30)

> ⚠️ **SUPERSEDED pela §18** — esta seção descreve o estado antes da feature de team tier. Mantida por histórico.

### Estado do último build (na época)
- Frontend: healthy
- Backend: UP
- Banco: migrations até `d4e5f6g7h8i9`
- Git: `aba9d87`

### O que estava faltando
- Roles 1:1
- Prydwen version `7.1-overall` (cosmético)

---

## 17. Sessão 2026-10-30 — Tierlist Aggregator completo

### Estado final
- **6 sites importados**: Genshin.gg (124), GenshinLab (127), Game8 (127), Mobalytics (126), Prydwen (127), GameWith (127) = **758 entries**
- **127 chars únicos** na view
- **Backend + frontend** consumindo `v_tierlist_consensus`
- **GameWith** importado via `curl` (HTML bloqueado, texto colado no chat)

### Escala master (6 tiers)

| Site | Escala original | Mapeamento pra master |
|------|-----------------|------------------------|
| Genshin.gg | S/A/B/C/D (5) | S→S+, S vazio, A→A, B→B, C→C, D→D |
| GenshinLab | SS/S/A/B/C/D (6) | 1:1 |
| Game8 | SS/S/A+/A/B/C/D (7) | SS→S+, S→S, A++A→A, B→B, C→C, D→D |
| Mobalytics | S/A+/A/B+/B/C/D/E/F (9) | S→S+, A++A→S, B++B→A, C+D→B, E→C, F→D |
| Prydwen | T0/T0.5/T1/T1.5/T2/T3/T4/T5 (8) | T0→S+, T0.5+T1→S, T1.5+T2→A, T3→B, T4→C, T5→D |
| GameWith | SS/S/A/B/C/D (6) | 1:1 |

### Decisões arquiteturais
- **Genshin.gg é fonte única da verdade para roles**: main_dps / sub_dps / support. Outros sites ficam com role='general'.
- **Game8 comprime colunas**: pega o melhor tier entre Main DPS/Sub-DPS/Support.
- **v_tierlist_consensus**: `consensus_tier` (moda), `tier_by_avg`, `spread`, `tiers_voted`, `dominant_role`.

### Frontend
- `TierlistPage.tsx`: grid 6 colunas (S+/S/A/B/C/D), filtros role + tier + elemento, toggle grid/list, tooltip floating-ui
- `TierlistTooltip.tsx`: breakdown por site, cores dinâmicas por elemento
- `SingleTierGrid`: quando `tierFilter !== 'all'`, grid flat agrupado por role

### Pendente (herdado)
- **Roles 1:1** — 3 órfãos em general (vesna, vodyanitsa, traveler-pyro)
- Prydwen version = `7.1-overall` (cosmético)

---

## 18. Sessão 2026-10-31 — Team tier badge (3 páginas)

### Estado final
- **Backend**:
  - `services/team_tier.py` com `compute_team_tier` (S+=6, S=5, A=4, B=3, C=2, D=1; média arredondada half-up)
  - `team_tier` inline no `TeamDetail` (computado on-the-fly no GET)
  - `POST /teams/preview-tier` — recebe `{character_slugs}`, retorna `{tier, avg_score, breakdown}` sem persistir
- **Frontend**:
  - `TeamTierBadge.tsx` (variantes sm/lg, tooltip floating-ui com breakdown por char)
  - Preview **ao vivo** no `TeamBuilderPage` com **debounce de 300ms** no `POST /teams/preview-tier`
  - Badge **sm no card** em `/teams`
  - Badge **lg no título** em `/teams/:id`
  - Badge **lg ao vivo** (preview) em `/teams/new`

### Commits
    f7f34d1 feat(team-builder): live preview tier while building
    ceb43c5 feat(team): team tier badge from tierlist consensus

### Algoritmo de tier do time
- Pontuação por tier individual: **S+=6, S=5, A=4, B=3, C=2, D=1**
- `team_tier = round_half_up(média dos 4 personagens)`
- Lookup via `v_tierlist_consensus` → `consensus_tier` de cada char
- **Validado**: Skirk Freeze (KQM) = **S+** — média 5.5: Skirk S (5) + Escoffier S (5) + Furina S+ (6) + Wriothesley S+ (6) = 22/4 = 5.5 → 6 → S+
- **Score de sinergia continua separado** (65/100 no Skirk Freeze). Vai ser refinado quando os roles forem atribuídos 1:1.

### Cobertura do badge
| Página | Variante | Fonte do tier |
|--------|----------|---------------|
| `/teams` | sm no card | `team_tier` inline do GET /teams |
| `/teams/:id` | lg no título | `team_tier` inline do GET /teams/{id} |
| `/teams/new` | lg ao vivo | POST /teams/preview-tier (debounce 300ms) |

### Próximos passos (prioridades sugeridas)
- **A. Refinar roles 1:1** (destrava sinergia + tier do time mais confiáveis) — recomendado
- **B. Expandir KQM templates** (~15 chars: Mavuika, Citlali, Chasca, Nefer, Varessa, Ifa, Xilonen)
- **C. Deploy público + README** (maior gap pra apresentação acadêmica)
- **D. Página de itens** com resina tooltips

### Prompt para a próxima sessão
> "Lê o PROJECT_CONTEXT.md. Escolhi [A/B/C/D]. Bora."
