# PROJECT_CONTEXT.md

> Arquivo vivo de contexto do projeto. **Sempre atualizar** ao final de cada sessão.
> Última atualização: **2026-10-30** — Tierlist Aggregator completo (5 sites, view, backend, frontend)

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
    │   ├── alembic/versions/       → 13 migrations (ver §6)
    │   └── app/
    │       ├── api/                → characters, teams, weapons, artifacts,
    │       │                          reactions, templates, talents, ascension, meta
    │       ├── models/             → artifact, base, character, guide, material,
    │       │                          reaction, team, team_template, weapon
    │       ├── schemas/            → artifact, ascension, build, character, common,
    │       │                          reaction, talent, team, team_analysis,
    │       │                          team_template, weapon
    │       ├── seed/               → seed crítico + import_from_ambr (opcional, rede)
    │       └── services/           → lógica (synergy, planner, etc)
    ├── frontend/src/
    │   ├── api/                    → client.ts
    │   ├── components/             → (ver §5)
    │   ├── context/                → LanguageContext (i18n pt/en)
    │   ├── pages/                  → (ver §5)
    │   ├── types/                  → WeaponSlot, ArtifactSlot, ArtifactPair, CharacterBuild
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
| /planner | PlannerPage | OK |
| /reactions | ReactionsPage | OK |
| /teams/:id | NÃO EXISTE (roadmap B) | PENDENTE |

### Componentes (frontend/src/components/)

- ArtifactPickerModal.tsx   ← NOVO 2026-10-29
- ArtifactTooltip.tsx       ← fix isPositioned 2026-10-29
- AscensionSection.tsx
- CharacterBuildEditor.tsx  ← reescrito 2026-10-29
- CharacterCard.tsx
- ErrorBoundary.tsx
- ItemTooltip.tsx
- LanguageSwitcher.tsx
- TalentSection.tsx
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
Talents:        GET /talents/{slug}/talents
Ascension:      GET /ascension/{slug}/ascension
Meta:           GET /meta/enums

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

### Fonte de dados
- Seed crítico local (app.seed.run) — sem rede
- app.seed.import_from_ambr — opcional, requer rede (falha → loga e segue)
- Imagens: CDN Hoyoverse via iconUrl / artifactIconUrl (config.ts)

---

## 7. Features prontas

- DB com characters / weapons / artifacts / reactions / materials / teams / templates
- Calculadora de ascensão + talentos
- Team builder com drag-and-drop, 4 slots
- Análise de sinergia em tempo real (score 0-100, roles, reações, warnings, sugestões)
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

---

## 8. Em progresso / pendente

- [x] Tooltips dos pickers (resolvido — era animation do CSS sobrescrevendo isPositioned)
- [x] Commit + push da sessão (resolvido 2026-10-29 — commit eed34f0, origin/main)
- [ ] Rodar psql com user correto (genshin) e preencher §9 (opcional, cosmético)

---

## 9. Banco de dados — contagens

Pendente. Comando correto:

    docker compose exec -T db psql -U genshin -d genshin_db -c "
    SELECT 'characters' t, COUNT(*) FROM characters
    UNION ALL SELECT 'weapons', COUNT(*) FROM weapons
    UNION ALL SELECT 'artifact_sets', COUNT(*) FROM artifact_sets
    UNION ALL SELECT 'teams', COUNT(*) FROM teams;
    "

Contagens a preencher:
- Characters: ?
- Weapons: ?
- Artifact sets: ?
- Teams: ?
- Templates KQM: ~40

---

## 10. Decisões arquiteturais

- build_data é JSONB → schemas novos são backward-compatible (Pydantic extra='ignore')
- Enums Postgres: sempre native_enum=False (evita conflito em migrations)
- Main Stats no `CharacterBuild` são `list[str]` (ex: Cálice pode ter Cryo DMG e ATK%). Usa `field_validator(mode='before')` para converter dados antigos (string) em lista.
- **Slots vs Builds**: A Build é do Personagem (`CharacterBuildPreset`). Os Substitutos são do Slot do Time (`TeamCharacter.substitutes` JSONB). Trocar de personagem preserva o Slot e seus substitutos.
- **Proteção de UniqueConstraint**: O endpoint `PUT /members` usa posições temporárias negativas (`-pos - 100`) antes de deletar/inserir, evitando erros de duplicidade.
- **Auto-Preset**: Ao trocar o personagem de um slot, o backend busca o preset mais recente (`CharacterBuildPreset`) daquele char e aplica automaticamente no slot.
- **Layout full-width condicional**: O componente `MainContent` em `App.tsx` usa `useLocation()` pra aplicar `container-wide` (max-width: 100%, 4 colunas) só em `/teams/:id`. Outras rotas mantêm `max-width: 1100px`.
- **Fetch otimizado na TeamDetailPage**: Em vez de `GET /weapons?limit=200` (que falha por validação de teto), a página coleta os slugs em uso (`weapons`, `artifacts_4pc`, `artifacts_2pc`) e busca individualmente via `GET /weapons/{slug}` e `GET /artifacts/{slug}`.
- **Schema retorno de arma**: O `WeaponDetail` no backend agora inclui `max_base_atk=w.max_base_atk` no construtor manual do endpoint `get_weapon` (estava faltando antes).
- **Planner dividido em 2 rotas**: `/planner` (import + cálculo) e `/planner/characters` (cards). O `Plan` completo é serializado em `localStorage` após calcular pra evitar recalcular na navegação.
- **Card de personagem extraído** para `components/PlannerCharacterCard.tsx` (reutilizável). Tipos compartilhados em `types/planner.ts`.
- **Planner - fallback de travelers**: o banco não tem travelers individuais (traveler_anemo, etc), então `resolveSlug` retorna o slug mesmo sem estar no Map (fallback). O card renderiza com ícone do elemento e nome amigável "Traveler (Anemo)".
- **Badges com contraste independente**: card inativo tem opacity 0.55 só em portrait/mats/talents/name, mas badge e nome ficam 100% visíveis (opacity multiplicativo quebrava).
- **Lista de weapons no Planner**: usa `limit: 500` pra pegar todas (eram ~250 no banco).
- **Modal em 2 colunas** (1200px) pra não ter scroll vertical exagerado. Categoria de materiais separada (ascensão/talentos/armas) com grid auto-fill 180px.
- **Estimativa de resina baseada no que falta**: `missing = material.quantity - inventory[slug]`, não no total. Mora tem fórmula especial (`ceil(missing / 60000) * 20`).
- **Biblioteca de Ícones**: `lucide-react` instalada. Todos os emojis de UI foram trocados por SVGs.
- **Animações CSS**: Uso extensivo de `@keyframes` para entrada em cascata (`slideUpFade`, `cardDeal`), hover transitions (`transform`, `box-shadow`) e pulsos (`pulseBorder`).
- **Conic Gradient para Score**: O anel do score usa `conic-gradient` com uma variável CSS `--score` injetada via React.
- i18n via LanguageContext (pt/en)
- Tooltips usam FloatingPortal (renderiza no document.body) — não afetados por backdrop-filter dos modais
- isPositioned é OBRIGATÓRIO em todo tooltip: aplica opacity:0 inline até o Floating UI calcular posição (evita flash no 0,0)
- CSS dos tooltips: NUNCA usar animation de opacity — sobrescreve o opacity inline e reintroduz o flash. Usar transition: opacity 120ms ease-out
- Hierarquia z-index: modal base 10000 → picker 10100 → tooltip 20000 (!important)

---

## 11. Armadilhas conhecidas

1. backdrop-filter em overlay quebra position:fixed de filhos → tooltips usam Portal
2. animation: tooltip-fade sobrescreve opacity: isPositioned ? 1 : 0 → flash no 0,0. NÃO reintroduzir
3. CharacterBuild antigo (flat) é ignorado pelo extra='ignore' → times pré-migração voltam com weapons: [] (sem crash)
4. Enums Postgres: sempre native_enum=False
5. psql no container db: user é genshin, não postgres
6. Feature de templates KQM e build editor foram commitados juntos em eed34f0 (templates estava no limbo antes)

---

## 12. Backlog / roadmap

- (A) Expandir templates (~15 chars faltando: Mavuika, Citlali, Chasca, Nefer, Varessa, Ifa, Xilonen)
- (B) Página /teams/:id com build completa (cards arma/set/stats)
- (C) Deploy público + README (maior gap pra apresentação acadêmica)
- (D) Refinar sinergia (mono-geo, mono-pyro como válidos)

---

## 13. Última sessão (2026-10-29)

**Feito:**
- Schema CharacterBuild migrado: weapons[], artifacts_4pc[], artifacts_2pc[] (pares), cada slot com notes
- Adicionado abas: Referências, Substituições e Combos
- Main Stats alterado para multi-select (lista de strings) com retrocompatibilidade
- Criada a página `/teams/:id` (TeamDetailPage) com renderização de builds completas
- Sistema de troca de personagens via `CharacterPickerModal`
- Sistema de Presets (`character_build_presets`) para salvar e recarregar builds
- Sistema de Substitutos por Slot (`TeamCharacter.substitutes` JSONB)
- Modal visual `SubstitutePickerModal` com notas curadas da KQM
- WeaponPickerModal.tsx + ArtifactPickerModal.tsx (grid visual, busca, ESC, tooltip)
- CharacterBuildEditor.tsx reescrito integrando pickers + notas inline + toggle 4pc/2+2
- CSS novo: picker-*, build-item-*, build-pair-*, build-mode-*
- Fix z-index dos tooltips (20000)
- Fix flash no 0,0: isPositioned inline + animation → transition
- Frontend rebuildado, healthy

**Feito (sessão atual — 3 partes):**

**Parte 1 — Planner completo:**
- `/planner` agora lê os **92 chars** do JSON (não filtra mais por pendência)
- Badges premium (Inativo + Completo) com animações
- Traduções PT/EN em badges, talentos, "Talentos em dia"
- Filtros: elemento, status (pendente/completo/inativo), tipo de pendência, ordenação
- Aliases de personagens (kazuha, sara, lanyan) e armas (the_flute, skyward_harp, the_widsith)
- Travelers via fallback (slug direto + ícone de elemento)
- Ascension `if (current < goal)` — evita 400 em chars maxados

**Parte 2 — Modal de detalhes do personagem:**
- `PlannerCharacterModal.tsx` com **layout 2 colunas**:
  - Esquerda: talentos + armas + summary (Mora + dias)
  - Direita: materiais agrupados (Ascensão / Talentos / Armas)
- **Cálculo de dias corrigido**: só conta o que falta, Mora com fórmula especial (`ceil(missing / 60000) * 20`), mostra "Pronto" quando 0
- i18n completo (badges, labels de talentos, títulos de seção)
- ESC / click-fora / botão Fechar
- 88px de largura, `max-height: 88vh`

**Parte 3 — Tierlist Aggregator (feature nova):**
- Ver seção "🏆 Tierlist Aggregator" acima
- Backend + frontend + 2 sites importados (Mobalytics + Prydwen)
- 126 chars com consenso real (2 sites)



**Pendente imediato (PRÓXIMA SESSÃO):**

1. **Coletar dados dos 3 sites faltantes** (Game8, GameWith, GenshinLab)
   - Usuário deve abrir cada site no navegador
   - `Ctrl+A` + `Ctrl+C` (copiar texto) **ou** `Ctrl+S` (salvar HTML)
   - Colar no chat
   - Eu extraio, aplico aliases e importo via `POST /tierlist/import`

2. **Escalas dos 3 sites:**
   - Game8: SS / S / A / B / C (separado por role)
   - GameWith: SS / S / A / B / C (separado por role)
   - GenshinLab: SS / S / A / B / C / D (e talvez E/F, geral + por role)

**Backlog anotado (não começar sem decidir):**
- Página de itens (`/characters/:slug`, `/weapons/:slug`, `/artifacts/:slug`):
  - Opções de editar
  - Tooltips com resina (com sorte / sem sorte / média)
- Sistema de usuário: login, times por conta, wishlist, histórico de pulls
- Roadmap geral: Deploy público, Template Detail, expandir templates KQM



---

## 14. Git — estado

Branch: main

**Commit desta sessão (feito):** `eed34f0 feat(templates+builds): KQM team templates system, visual weapon/artifact pickers, per-item build notes` (28 files, +4140/-223)

Últimos commits antes desta sessão:

    44bc840 fix(weapons): EM flat scaling + precise crit curve for Lv.90 substats
    9cbb392 feat(ui): artifacts module, weapon/artifact tooltips, Lv.90 max stats
    fdbcbbf feat(weapons): compute max secondary stat at Lv.90
    f4312e7 feat(weapons): compute max base ATK at Lv.90
    0ed6611 fix(synergy): stronger penalty for 3+ on-field DPS

Arquivos modificados nesta sessão (a commitar):
- backend/app/schemas/build.py
- frontend/src/types.ts
- frontend/src/components/WeaponPickerModal.tsx (NOVO)
- frontend/src/components/ArtifactPickerModal.tsx (NOVO)
- frontend/src/components/CharacterBuildEditor.tsx (REESCRITO)
- frontend/src/components/WeaponTooltip.tsx (fix)
- frontend/src/components/ArtifactTooltip.tsx (fix)
- frontend/src/styles.css
- PROJECT_CONTEXT.md (NOVO)


---

## 15. Discussão atual — Tierlist Aggregator

**Contexto:** o usuário quer construir um **agregador de tierlists** que puxa dados de vários sites (KQM, Game8, Prydwen, Genshin.gg, etc) e consolida num único lugar.

**Motivação relatada:** [o usuário vai explicar o porquê — preencher na próxima sessão]

**Perguntas em aberto (a definir):**
- Quais sites agregar?
- Fonte dos dados: scraping, API, ou manual?
- Consolidação: média das notas? votação? weight por site?
- Onde exibir: página nova (`/tierlist`) ou dentro de cada personagem?
- Atualização: manual, cron, ou on-demand?


---

## 16. ⏸️ ONDE PARAMOS (sessão 2026-10-31)

### Estado do último build
- Frontend: **healthy** (`docker compose ps frontend`)
- Backend: **UP** (`curl http://localhost:8000/health`)
- Banco: migrations aplicadas até `d4e5f6g7h8i9` (tierlists)
- Git: último commit `aba9d87` (`fix(tierlist): normalize Mobalytics + Prydwen Overall to 'general' role`)

### O que tá funcionando AGORA
- ✅ Tierlist com **2 sites** (Mobalytics 126 + Prydwen 127)
- ✅ Grid 6 colunas (S+/S/A/B/C/D) **full width** via `:has(.tierlist-page)`
- ✅ 2 avatares grandes por linha (88-96px)
- ✅ Hover mostra tooltip com score + detalhes
- ✅ Filtro por role funciona (Todos=127, Geral=127, outros=0)

### O que tá faltando
- ❌ **3 sites vazios** (Game8, GameWith, GenshinLab) — **próximo passo**
- ⏸️ Backlog: página de itens, sistema de usuário, deploy

### Prompt para a próxima sessão
> "Lê o PROJECT_CONTEXT.md e vamos importar os 3 sites faltantes do Tierlist. Vou mandar o texto ou HTML de cada um (Game8, GameWith, GenshinLab)."

---

## 17. Sessão 2026-10-30 — Tierlist Aggregator completo

### Estado final
- **5 sites importados**: Genshin.gg (124), GenshinLab (127), Game8 (126), Mobalytics (126), Prydwen (127) = **630 entries**
- **127 chars únicos** na view (após merge de travelers Prydwen underscore→hyphen)
- **Backend + frontend** consumindo `v_tierlist_consensus`
- **GameWith** é o único site faltando (HTML não recebido)

### Escala master (6 tiers)

Regra: **topo→S+**, **fundo→D**, meio comprime agrupando.

| Site | Escala original | Mapeamento pra master |
|------|-----------------|------------------------|
| Genshin.gg | S/A/B/C/D (5) | S→S+, S vazio, A→A, B→B, C→C, D→D |
| GenshinLab | SS/S/A/B/C/D (6) | 1:1 |
| Game8 | SS/S/A+/A/B/C/D (7) | SS→S+, S→S, A++A→A, B→B, C→C, D→D |
| Mobalytics | S/A+/A/B+/B/C/D/E/F (9) | S→S+, A++A→S, B++B→A, C+D→B, E→C, F→D |
| Prydwen | T0/T0.5/T1/T1.5/T2/T3/T4/T5 (8) | T0→S+, T0.5+T1→S, T1.5+T2→A, T3→B, T4→C, T5→D |

### Decisões arquiteturais

- **Roles — Genshin.gg é fonte única da verdade**: main_dps / sub_dps / support. Outros sites ficam com role='general' e não votam em role.
- **Game8 comprime colunas**: pega o melhor tier entre Main DPS/Sub-DPS/Support, ignorando a coluna.
- **Genshin.gg não vota em role pra Vesna/Vodyanitsa/Traveler(Pyro)**: 3 órfãos ficam em general. User vai reassinar 1:1.
- **v_tierlist_consensus**: consensus_tier (moda), tier_by_avg (média com thresholds 0.9/0.7/0.5/0.3/0.1), spread (max-min), tiers_voted (array), dominant_role.

### Backend

**Endpoints atualizados** (backend/app/api/tierlist.py):
- GET /tierlist — lê da view, 1 item por char. Query param role opcional.
  Retorna AggregatedTier[]: { character_slug, dominant_role, consensus_tier, consensus_votes, tier_by_avg, avg_score, spread, tiers_voted, num_sites, entries[] }
- GET /tierlist/character/{slug} — idem, 1 char
- GET /tierlist/sites — inalterado
- POST /tierlist/import — inalterado

**Model** models/tierlist.py: adicionado tier_master = Column(String(10), nullable=True). Faltava — foi criado via ALTER TABLE direto e o ORM não conhecia.

**Schemas** schemas/tierlist.py: AggregatedTier reescrito com campos novos; TierlistEntryOut ganhou tier_master.

### Frontend

**pages/TierlistPage.tsx** reescrita:
- Grid 6 colunas: TIER_ORDER = ['S+','S','A','B','C','D'] (sem E/F)
- Header de cada coluna = consensus_tier (moda), não tier_by_avg
- Tooltip do tile (hover): consensus (N/5) · by_avg · spread · tiers_voted · breakdown por site
- Filtros role: Todos / Geral / Main DPS / Sub-DPS / Support
- Toggle grid/list
- Removido dedupe manual no useMemo (backend já retorna único)

**types/tierlist.ts** reescrito: AggregatedTier com campos novos.

### Scripts (idempotentes)

- backend/app/scripts/import_tierlists.sql — DELETE dos 4 sites (não toca Prydwen) + INSERT com tier_master calculado. Rodar a qualquer momento.
- backend/app/scripts/create_view.sql — CREATE OR REPLACE VIEW v_tierlist_consensus.
- backend/app/scripts/tierlist_raw/ — HTMLs brutos (gitignored).

### Migration

e5f6a7b8c9d0_add_tierlist_aggregator.py (encadeada após d4e5f6g7h8i9):
- Adiciona tier_master (idempotente)
- Fix game8.scale_size 5→7
- Insere genshin-gg em tierlist_sites
- Insere 7 travelers em characters
- Cria v_tierlist_consensus
- Tudo idempotente (IF NOT EXISTS, ON CONFLICT DO NOTHING, CREATE OR REPLACE)

### Fixes aplicados nesta sessão

1. ALTER TABLE tierlist_entries ADD COLUMN tier_master
2. tierlist_sites.scale_size game8: 5→7 (estava errado)
3. INSERT genshin-gg em tierlist_sites (não estava cadastrado)
4. UPDATE Prydwen tier_master (mapping 8→6)
5. Model ORM tier_master adicionado em models/tierlist.py (evitava AttributeError)
6. Travelers criados no characters (7 registros, stats placeholder)
7. Prydwen travelers underscore→hyphen (traveler_cryo → traveler-cryo) — estavam duplicando no grid

### Contagens DB (fim da sessão)

| Item | Valor |
|------|-------|
| characters | 127 (120 + 7 travelers) |
| tierlist_entries | 630 (5 sites) |
| v_tierlist_consensus | 127 chars únicos |
| Órfãos em general | 3 (vesna, vodyanitsa, traveler-pyro) |

### Pendente (próxima sessão)

1. **GameWith** — único site faltando. User vai mandar HTML. Pipeline idempotente: acrescentar parser no import_tierlists.sql e rodar de novo.
2. **Roles 1:1** — user vai atribuir manualmente. Os 3 órfãos saem de general nessa passada.
3. **Prydwen version** = 7.1-overall (não 7.1). Cosmético. Fix opcional: UPDATE tierlist_entries SET version='7.1' WHERE site_id=(prydwen) AND version='7.1-overall'.

### Como verificar

curl -s "http://localhost:8000/tierlist" | jq '.items | length'                  # 127
curl -s "http://localhost:8000/tierlist?role=general" | jq '.items | length'    # 3
curl -s "http://localhost:8000/tierlist?role=main_dps" | jq '.items | length'   # 42
curl -s "http://localhost:8000/tierlist?role=sub_dps" | jq '.items | length'    # 29
curl -s "http://localhost:8000/tierlist?role=support" | jq '.items | length'    # 53

### Armadilhas conhecidas (novas)

- Não use e.tier_master via ORM sem adicionar no model — AttributeError. Já resolvido.
- Slugs de Traveler: sempre hyphen (traveler-cryo), nunca underscore. Prydwen é a fonte do bug histórico.
- consensus_tier (moda) e tier_by_avg (média) divergem em ~20% dos casos — é feature, não bug. Grid usa moda; tooltip mostra os dois. Ex: Furina → consensus=S+, by_avg=S (Mobalytics B+ puxa pra baixo).

### UI Refinements (pós-importação)

- **`TierlistTooltip.tsx`**: componente novo usando `@floating-ui/react` (padrão do projeto, `FloatingPortal`, `isPositioned`, `safePolygon`). Fundo opaco (`#0f1218`), cores dinâmicas por elemento (pyro/geo/etc no border e glow), breakdown dos 5 sites com barras e destaque em outliers.
- **Filtros novos**: `tierFilter` (S+/S/A/B/C/D) e `elementFilter` (7 elementos). Filtragem 100% client-side sobre os 127 itens.
- **`SingleTierGrid`**: quando `tierFilter !== 'all'`, substitui o grid de 6 colunas por um grid flat `auto-fill` agrupado por `dominant_role` (Main DPS → Sub-DPS → Support → General), com sub-cabeçalhos e contador por role.
- **Role visível nos cards**: `tierlist-tile-role` mostra role em uppercase pequeno abaixo do nome (grid) e destacado em azul na meta da lista.
- **Fix de posição do tooltip**: `display: contents` no wrapper ref não gerava bounding box → `display: inline-block; width: fit-content`.
