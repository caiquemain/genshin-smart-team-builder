# PROJECT_CONTEXT.md

> Arquivo vivo de contexto do projeto. **Sempre atualizar** ao final de cada sessão.
> Última atualização: **2026-10-31** — Traduções i18n + Build KQM na página + refinamento de sinergia

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

Portas (dev): Frontend `8080`, Backend `8000`, Postgres `5432`.

---

## 3. Como rodar (dev)

    cd ~/projects/genshin-smart-team-builder
    docker compose up -d
    docker compose ps

Serviços no compose:
- db       → postgres:16-alpine (container genshin_db)
- init     → alembic upgrade head && python -m app.seed.run (one-shot)
- backend  → FastAPI (container genshin_backend)
- frontend → nginx servindo build Vite (container genshin_frontend)

Env: `POSTGRES_USER=genshin`, `POSTGRES_PASSWORD=genshin`, `POSTGRES_DB=genshin_db`.

Conexão psql (user é genshin, NÃO postgres):

    docker compose exec -T db psql -U genshin -d genshin_db -c "\dt"

---

## 4. Estrutura de pastas

    genshin-smart-team-builder/
    ├── backend/
    │   ├── alembic/versions/       → 16 migrations (ver §6)
    │   └── app/
    │       ├── api/                → characters, teams, weapons, artifacts, reactions,
    │       │                          templates, talents, ascension, meta, tierlist
    │       ├── models/             → artifact, base, build_preset, character (c/ translations),
    │       │                          guide, material, reaction, team, team_template, weapon, tierlist
    │       ├── schemas/            → artifact, ascension, build, character, common, reaction,
    │       │                          talent, team, team_analysis, team_template, weapon, tierlist
    │       ├── scripts/            → import_tierlists.sql, create_view.sql
    │       ├── seed/               → seed crítico + import_from_ambr (com PT/ES)
    │       └── services/           → synergy, planner, team_tier, i18n
    ├── frontend/src/
    │   ├── api/                    → client.ts
    │   ├── components/             → ver §5
    │   ├── context/                → LanguageContext (i18n pt/en)
    │   ├── pages/                  → ver §5
    │   ├── types/                  → WeaponSlot, ArtifactSlot, ArtifactPair, CharacterBuild, tierlist
    │   ├── utils/                  → stats.ts
    │   └── styles.css
    ├── docker-compose.yml
    └── PROJECT_CONTEXT.md

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

### Componentes

- ArtifactPickerModal.tsx
- ArtifactTooltip.tsx       ← prop `buildNote` (2026-10-31)
- AscensionSection.tsx
- CharacterBuildEditor.tsx
- CharacterCard.tsx
- ErrorBoundary.tsx
- ItemTooltip.tsx
- LanguageSwitcher.tsx
- PlannerCharacterCard.tsx
- PlannerCharacterModal.tsx
- SubstitutePickerModal.tsx
- TalentSection.tsx
- TeamTierBadge.tsx
- TierlistTooltip.tsx
- WeaponPickerModal.tsx
- WeaponTooltip.tsx         ← prop `buildNote` (2026-10-31)

---

## 6. Backend — endpoints

- Characters: `GET /characters` · `GET /characters/{slug}` · **`GET /characters/{slug}/build`** (NOVO)
- Weapons: `GET /weapons` · `GET /weapons/{slug}` · `GET /weapons/{slug}/ascension`
- Artifacts: `GET /artifacts` · `GET /artifacts/{slug}`
- Reactions: `GET /reactions`
- Templates: `GET /templates/archetypes` · `GET /templates` · `GET /templates/{id}`
- Teams: `POST /teams` · `GET /teams` · `GET /teams/{id}` · `DELETE /teams/{id}` · `POST /teams/analyze` · `PUT /teams/{id}/builds` · `POST /teams/preview-tier`
- Talents: `GET /talents/{slug}/talents`
- Ascension: `GET /ascension/{slug}/ascension`
- Meta: `GET /meta/enums`
- Tierlist: `GET /tierlist` · `GET /tierlist/character/{slug}` · `GET /tierlist/sites` · `POST /tierlist/import`

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
14. e5f6a7b8c9d0_add_tierlist_aggregator
15. **b96ba14b2abd_add_translation_tables_for_talents_** ← cria as 3 tabelas
16. **2041a237fb91_add_translation_tables_for_talents_** ← vazia (autogenerate vazio)

### Fonte de dados
- Seed crítico local (`app.seed.run`)
- `app.seed.import_from_ambr` — importa EN + PT + ES (opcional, rede)
- Imagens: CDN Hoyoverse (`iconUrl`, `artifactIconUrl`)
- Travelers: portraits locais em `frontend/public/travelers/`

---

## 7. Features prontas

- DB completo (chars/weapons/artifacts/reactions/materials/teams/templates/tierlists)
- Calculadora de ascensão + talentos
- Team builder (4 slots, drag-and-drop)
- Análise de sinergia refinada (ver §19)
- Team tier badge em 3 páginas
- ~40 templates KQM
- Editor de build por personagem (Build, Referências, Substitutos, Combos)
- Pickers visuais de arma/artefato
- Tooltips com `isPositioned` gate + `buildNote`
- i18n pt/en via LanguageContext
- **Traduções PT/ES completas** de Talentos/Passivos/Constelações
- **Build KQM na página do personagem** (armas, artefatos, stats, combos)
- Tierlist Aggregator: 6 sites, 758 entries, 127 chars
- Planner completo: 92 chars, filtros, modal 2 colunas

---

## 8. Em progresso / pendente

- [x] Team tier badge
- [x] Traduções Talentos/Passivos/Constelações
- [x] Build KQM na página (piloto: Columbina)
- [x] Refinar sinergia (Skirk/Furina/Escoffier/Vodyanitsa)
- [ ] **Builds KQM manuais** para ~120 chars restantes (só Columbina tem preset)
- [ ] Score de sinergia visível (temporariamente oculto — será refinado char a char)
- [ ] Refinar roles 1:1 (127 chars)
- [ ] Expandir templates KQM (~15 chars)
- [ ] Deploy público + README
- [ ] Página de itens com resina tooltips

---

## 9. Banco de dados — contagens

| Item | Valor |
|---|---|
| characters | 127 |
| weapons | ~250 |
| artifact_sets | ? |
| teams | ? |
| tierlist_entries | 758 |
| v_tierlist_consensus | 127 |
| character_talent_translations | 720 (360 PT + 360 ES) |
| character_passive_translations | 812 (406 PT + 406 ES) |
| character_constellation_translations | 1440 (720 PT + 720 ES) |
| Templates KQM | ~40 |

---

## 10. Decisões arquiteturais

- `build_data` é JSONB → backward-compatible (Pydantic `extra='ignore'`)
- Enums Postgres: sempre `native_enum=False`
- Main Stats no `CharacterBuild` são `list[str]` (com `field_validator(mode='before')`)
- **Slots vs Builds**: Build é do Personagem; Substitutos são do Slot
- **UniqueConstraint**: `PUT /members` usa posições temporárias negativas
- **Auto-Preset**: ao trocar char, backend aplica preset mais recente
- **Layout full-width condicional**: `container-wide` só em `/teams/:id` e `/tierlist`
- **Fetch otimizado na TeamDetailPage**: busca por slug individual
- **Team tier** = média arredondada (half-up) do `consensus_tier`
- **Preview-tier** (`POST /teams/preview-tier`) não persiste
- **Traduções em tabelas espelho** (padrão `weapon_translations`):
  - Base: texto EN
  - `*_translations`: PT/ES com FK
  - Endpoint: `joinedload(translations)` + `_pick_translation(obj, lang)`
- **Build KQM na página**:
  - Endpoint `GET /characters/{slug}/build` (separado)
  - Frontend busca armas/artefatos por slug
  - Notas KQM vão no **tooltip** (`buildNote`), não no card
  - Card usa `--char-accent` (mesmo padrão de Talentos/Passivos/Constelações)
- `isPositioned` obrigatório em todo tooltip (`opacity: 0` inline)
- CSS dos tooltips: **nunca** `animation: opacity` — usar `transition`
- z-index: modal 10000 → picker 10100 → tooltip 20000

---

## 11. Armadilhas conhecidas

1. `backdrop-filter` em overlay quebra `position:fixed` → tooltips usam Portal
2. `animation: tooltip-fade` sobrescreve `opacity: isPositioned ? 1 : 0` → flash no 0,0
3. `CharacterBuild` antigo é ignorado pelo `extra='ignore'`
4. Enums Postgres: `native_enum=False`
5. `psql`: user é `genshin`
6. **Model ORM precisa declarar `tier_master`** (senão `AttributeError`)
7. Slugs de Traveler: sempre `hyphen` (`traveler-cryo`)
8. `consensus_tier` ≠ `tier_by_avg` em ~20% dos casos
9. `team_tier` usa `consensus_tier`
10. `preview-tier` no builder: **debounce 300ms**
11. **Yatta retorna HTML cru com `<color>` + `{LINK#...}{/LINK}`** — `stripHtml` deve remover AMBOS mantendo conteúdo interno
12. **Yatta PT/ES pode duplicar nome+tipo no início da descrição** — `cleanDescription` filtra as primeiras linhas por segurança
13. **Backend em Docker não pega mudanças automaticamente** — sempre `restart backend` após alterar `.py`
14. **`joinedload(translations)` é obrigatório** — sem isso o N+1 estoura timeout
15. **`alembic revision --autogenerate` cria migrations duplicadas** se rodar 2x sem `upgrade head`

---

## 12. Backlog / roadmap

- **(A) Builds KQM manuais** (principal agora): popular preset para cada char relevante
- **(B) Refinar roles 1:1** (127 chars) — destrava sinergia + tier
- **(C) Expandir templates KQM** (~15 chars)
- **(D) Deploy público + README**
- **(E) Página de itens** com tooltips de resina
- **(F) Sistema de usuário** (login, times por conta, wishlist)
- **(G) Refinar sinergia** (mono-geo, mono-pyro válidos)
- **(H) Re-exibir score de sinergia** (após refinar por char)

---

## 13. Sessão 2026-10-29

- Schema `CharacterBuild` migrado: `weapons[]`, `artifacts_4pc[]`, `artifacts_2pc[]`, notes por slot
- Abas Referências/Substituições/Combos
- Main Stats multi-select
- `/teams/:id` (TeamDetailPage)
- CharacterPickerModal, SubstitutePickerModal
- WeaponPickerModal + ArtifactPickerModal
- CharacterBuildEditor reescrito
- Fix z-index tooltips (20000) + flash no 0,0
- Commit: `eed34f0`

---

## 14. Git — estado

Branch: `main`

**Commits desta sessão (2026-10-31):**
- `feat(i18n): traduções de talentos, passivos e constelações via Ambr`
- `feat(character): build KQM integrada na página do personagem`
- `feat(synergy): restrição de elemento (Skirk/Escoffier) + healer forte (Furina)`

**Commits anteriores:**
- `f7f34d1` feat(team-builder): live preview tier while building
- `ceb43c5` feat(team): team tier badge from tierlist consensus
- `aba9d87` fix(tierlist): normalize Mobalytics + Prydwen Overall to 'general' role
- `eed34f0` feat(templates+builds): KQM team templates, pickers, per-item build notes

---

## 15. Tierlist Aggregator — resumo

6 sites, 758 entries, 127 chars. `v_tierlist_consensus` expõe `consensus_tier` (moda), `tier_by_avg` (média), `spread`, `tiers_voted`, `dominant_role`. Ver §17.

---

## 16. ⏸️ ONDE PARAMOS (sessão 2026-10-30)

> SUPERSEDED pela §18/§19.

---

## 17. Sessão 2026-10-30 — Tierlist Aggregator completo

- 6 sites importados (Genshin.gg, GenshinLab, Game8, Mobalytics, Prydwen, GameWith)
- 758 entries, 127 chars na view
- `TierlistPage` grid 6 colunas, filtros role/tier/element, tooltip floating-ui

---

## 18. Sessão 2026-10-31 — Team tier badge (3 páginas)

- `services/team_tier.py`: `compute_team_tier` (S+=6…D=1, round half-up)
- `POST /teams/preview-tier` (não persiste)
- `TeamTierBadge.tsx` (sm/lg, tooltip floating-ui)
- Preview ao vivo no builder (debounce 300ms)
- Validado: Skirk Freeze = S+ (média 5.5)

---

## 19. Sessão 2026-10-31 — Traduções + Build KQM + Refinamento de sinergia

### Traduções completas (Yatta/Ambr)
- 3 tabelas espelho novas:
  - `character_talent_translations` (720 rows — 360 PT + 360 ES)
  - `character_passive_translations` (812 rows — 406 PT + 406 ES)
  - `character_constellation_translations` (1440 rows — 720 PT + 720 ES)
- `import_from_ambr.py` agora salva PT/ES para os 3 (antes só salvava EN)
- `characters.py` usa `joinedload(translations)` + `_pick_translation(obj, lang)`
- EN continua vindo da tabela base (fallback), PT/ES vêm das tabelas espelho

### Build KQM na página do personagem
- `GET /characters/{slug}/build` retorna `{name, build_data}`
- `CharacterDetailPage.tsx`:
  - Busca preset no mount (`fetch`)
  - Carrega imagens das armas/artefatos individualmente por slug
  - Card `.kqm-build-card` (fundo `#131820`, borda `var(--char-accent)`)
  - Seção de stats (Main Stats, Substats como badges, Requisitos, Combos)
  - Se não tem preset, cai no fallback heurístico (antigo)
- `WeaponTooltip` e `ArtifactTooltip` aceitam prop `buildNote` (nota do KQM aparece dentro do tooltip)
- `stripHtml` melhorado: remove `<color>` e `{LINK#...}{/LINK}` mantendo conteúdo
- `cleanDescription` remove duplicação nome+tipo do Yatta em PT/ES
- Badges `.kqm-substat-badge` com setas `›` para prioridade de substats

### Refinamento de sinergia (backend `services/synergy.py`)
- **Skirk** exige time 100% Cryo/Hydro → `-30` se violar
- **Escoffier** exige 100% Cryo/Hydro → `-25` se violar
- **Furina** exige healer forte curado (`FURINA_HEALERS`) → `-20` se faltar
- **Vodyanitsa** reclassificada como `healer_active` (cura + buff + RES shred)
- **Healer redundante** (só `healer_active`, sem outras tags, e já tem outro healer) → `-15`
- Sinergias de dupla valem muito mais que tags genéricas
- Skirk + Vodyanitsa buffada pra 15 pts (era 10)
- **Score visível temporariamente oculto** no frontend (só reações + warnings) — será re-exibido depois do refinamento char a char

### TeamDetailPage — recálculo ao trocar membro
- Após `PUT /members`, dispara busca de assets (armas/artefatos novos) + `POST /analyze`
- Análise atualiza na hora (sem precisar de F5)

### Testado
- `curl /characters/columbina?lang=pt` → talentos em PT ✅
- Trocar Vodyanitsa por Barbara → sinergia penaliza (healer redundante) ✅
- Build KQM da Columbina renderiza com imagens + tooltips ✅

### Prompt para próxima sessão
> "Lê o PROJECT_CONTEXT.md. Vamos popular builds KQM pros próximos chars: [X, Y, Z]."
