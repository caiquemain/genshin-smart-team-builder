# PROJECT_CONTEXT.md

> Arquivo vivo de contexto do projeto. **Sempre atualizar** ao final de cada sessão.
> Última atualização: **2026-10-29** — build editor + pickers + abas de referências, substitutos e combos

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

**Feito (sessão atual):**
- Instalação e uso do `lucide-react` para substituir emojis na UI
- Animações de entrada (glassmorphism, cards flutuantes)
- Anel de Score animado com `conic-gradient`
- Modal `SubstitutePickerModal` redesenhado como um grid de 5 cartas lado a lado (estilo Gacha)
- Hover states elegantes em todas as cartas

**Feito (sessão atual):**
- Aplicado Glassmorphism e animações em cascata nos cards de personagens (`/`)
- Título e nomes com gradientes metálicos
- Substituição dos `<select>` nativos por filtros em 'Pill' (botões) com ícones coloridos
- Cores de armas definidas (Sword = Prata, Claymore = Âmbar, Polearm = Vermelho, Bow = Verde, Catalyst = Roxo)
- Glow e drop-shadow nos ícones dos filtros

**Feito (sessão atual):**
- WeaponsPage reescrita com filtros em Pill (tipo + raridade + busca)
- Tooltips (WeaponTooltip) adicionados em cada card de arma
- Fix do cálculo: cards mostram `max_base_atk` (Lv.90) em vez de `base_atk` (Lv.1)
- Cards com glassmorphism, glow da raridade e animação em cascata
- Ícones Lucide por tipo de arma (Sword/Shield/Swords/Target/Crosshair)

**Pendente imediato:**
- Nenhum bloqueante.

**Feito (sessão atual):**
- Aplicado Glassmorphism e animações em cascata nos cards de personagens (`/`)
- Título e nomes com gradientes metálicos
- Substituição dos `<select>` nativos por filtros em 'Pill' (botões) com ícones coloridos
- Cores de armas definidas (Sword = Prata, Claymore = Âmbar, Polearm = Vermelho, Bow = Verde, Catalyst = Roxo)
- Glow e drop-shadow nos ícones dos filtros

**Feito (sessão atual):**
- WeaponsPage reescrita com filtros em Pill (tipo + raridade + busca)
- Tooltips (WeaponTooltip) adicionados em cada card de arma
- Fix do cálculo: cards mostram `max_base_atk` (Lv.90) em vez de `base_atk` (Lv.1)
- Cards com glassmorphism, glow da raridade e animação em cascata
- Ícones Lucide por tipo de arma (Sword/Shield/Swords/Target/Crosshair)

**Pendente imediato:**
- Nenhum bloqueante. — sessão fechada com commit eed34f0 em origin/main

**Próximo passo (próxima sessão):**
1. Escolher roadmap A/B/C/D (sugestão: B primeiro — fecha fluxo end-to-end do usuário)
2. (Opcional) Rodar psql correto e preencher §9

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
