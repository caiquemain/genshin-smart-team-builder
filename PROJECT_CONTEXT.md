# PROJECT_CONTEXT.md

> Arquivo vivo de contexto do projeto. **Sempre atualizar** ao final de cada sessão.
> Última atualização: **2026-11-22** — Consultor da Conta (4 abas), Builds/Stats/Mochila, Backup Google Drive, Enka UID, GOOD v2 completo e Scanner Nativo Linux (PipeWire Wayland + OCR)

---

## 1. Visão geral

**Nome:** Genshin Smart Team Builder & Resource Calculator
**Objetivo:** Plataforma web bilíngue (PT-BR/EN) para montagem e recomendação de times (incluindo Abismo 2 times e Stygian 3 times sem conflito), **Consultor da Conta**, cálculo de stats/builds e auditoria de artefatos, planejador offline de recursos com backup em nuvem (Google Drive) e scanner nativo de inventário para Linux. Viés acadêmico (UNINASSAU — Ciência de Dados + Eng. de Software + Projeto de Extensão).
**Estágio:** Aplicação completa em dev local (Docker Compose + CLI Linux), com suítes de testes automatizados (backend Pytest, frontend Vitest 40 testes, linux-scanner Pytest 8 testes).

---

## 2. Stack

| Camada | Tecnologia | Versão |
|---|---|---|
| Backend | FastAPI + SQLAlchemy + Alembic | Python 3.11+ / 3.14 |
| Banco | PostgreSQL | 16-alpine |
| Frontend | React 18 + TypeScript + Vite + Vitest | Node 20+ / 24 |
| Scanner Linux | Python + Tesseract OCR + PipeWire (`xdg-desktop-portal`/GStreamer) + `mss`/`xdotool`/`ydotool` | `genshin-kamera-linux 0.1.0` |
| Container | Docker Compose | — |
| Estilo | CSS puro (`styles.css` único) | — |
| Tooltips | `@floating-ui/react` (`FloatingPortal`) | — |
| Ícones | `lucide-react` (SVGs, sem emojis) + ícones locais `.webp` | — |

Portas (dev): Frontend `8080`, Backend `8000`, Postgres `5432`.

---

## 3. Como rodar (dev)

    cd ~/projects/genshin-smart-team-builder
    docker compose up -d
    docker compose ps

Env: `POSTGRES_USER=genshin`, `POSTGRES_PASSWORD=genshin`, `POSTGRES_DB=genshin_db`.

Conexão psql (user é `genshin`, NÃO `postgres`):

    docker compose exec -T db psql -U genshin -d genshin_db -c "\dt"

---

## 4. Estrutura de pastas

    genshin-smart-team-builder/
    ├── backend/
    │   ├── alembic/versions/       → migrations versionadas
    │   ├── tests/                  → 17 suítes Pytest
    │   └── app/
    │       ├── api/                → characters, teams, weapons, artifacts, reactions,
    │       │                          templates, talents, ascension, meta, tierlist,
    │       │                          presets, recommendations, enka
    │       ├── models/             → modelos + tabelas `*_translations` + `text_translations`
    │       ├── schemas/            → Pydantic schemas
    │       ├── scripts/            → parse_guides, import_guides, import_tierlists,
    │       │                          sync_weapon_sources, translate_guides,
    │       │                          export_planner_data, enrich_substitutes
    │       ├── seed/               → import_from_ambr (EN/PT/ES)
    │       └── services/           → synergy, team_tier, i18n, guide_i18n, presets,
    │                                  substitutes, pull_advisor, upgrade_advisor,
    │                                  artifact_advisor, endgame_composer, enka
    ├── frontend/src/
    │   ├── api/                    → client.ts
    │   ├── components/             → 38 componentes (modais, tooltips, cards, backup, UID, builds)
    │   ├── context/                → LanguageContext
    │   ├── pages/                  → 18 páginas (ver §5)
    │   ├── types/                  → good, planner, tierlist, etc.
    │   ├── utils/                  → stats, char-stats-calc, artifact-bag-auditor,
    │   │                              build-card-png, domain-schedule, account-backup,
    │   │                              google-drive-sync, good-parser, inventory-mapper,
    │   │                              planner-compute, planner-recompute, planner-storage,
    │   │                              kills-compute, resin, xp-costs, roster, slug-resolver,
    │   │                              weaponSources + `__tests__/` (12 arquivos, 40 testes)
    │   └── styles.css
    ├── linux-scanner/              → `genshin-kamera-linux` (scanner nativo Linux GOOD v2)
    │   ├── genshin_kamera/         → cli, scanners, geometry, ocr, parsers, catalog,
    │   │                              backend_input, portal_capture
    │   ├── tests/                  → test_parsers.py (8 testes)
    │   ├── install.sh
    │   └── README.md
    ├── update_game_data.py / update.sh
    ├── docker-compose.yml
    ├── README.md
    └── PROJECT_CONTEXT.md

---

## 5. Frontend

### Rotas (`App.tsx`)

| Rota | Componente | Status |
|---|---|---|
| `/` | `CharactersPage` | OK |
| `/characters/:slug` | `CharacterDetailPage` (c/ `EquippedBuildPanel`, `CharacterArtifactsModal`, `AscensionSection`, `TalentSection`) | OK |
| `/roster` | `RosterPage` (3 abas: Roster, Minhas Builds & Stats, Mochila de Artefatos + Enka UID + GOOD v2) | OK |
| `/pull-advisor` · `/consultor` | `PullAdvisorPage` — **Consultor da Conta** (4 abas: Quem Pegar, Quem Upar, Artefatos & Domínios, Abismo & Stygian) | OK |
| `/weapons` · `/weapons/:slug` | `WeaponsPage` (c/ tags de obtenção) · `WeaponDetailPage` | OK |
| `/artifacts` · `/artifacts/:slug` | `ArtifactsPage` · `ArtifactDetailPage` | OK |
| `/teams` · `/teams/new` · `/teams/:id` | `TeamsPage` · `TeamBuilderPage` · `TeamDetailPage` (c/ `KQMExportCard`) | OK |
| `/planner` · `/planner/characters` | `PlannerPage` (c/ `TodayFarmWidget`, workflow zero-JSON, GOOD v2 + Seelie) · `PlannerCharactersPage` | OK |
| `/inventory` | `InventoryAuditPage` (redesign full-width, editor inline, materiais GOOD v2 + Seelie) | OK |
| `/bestiary` | `BestiaryPage` (c/ taxas de drop e `BestiaryMonsterModal`) | OK |
| `/tierlist` | `TierlistPage` (12 fontes: Geral, Abismo 30d, Stygian 30d) | OK |
| `/reactions` | `ReactionsPage` | OK |
| Nav global | `BackupSyncModal` (Export/Import `.json` + Sync Google Drive) · `LanguageSwitcher` | OK |

### Principais Componentes Novos (Nov/2026)

- `BackupSyncModal` (backup local `.json` + Google Drive OAuth auto-sync)
- `UidImportModal` (importação de personagem/arma/artefatos via Enka.Network UID)
- `TodayFarmWidget` (agenda de domínios "O que farmar hoje" no Planejador)
- `EquippedBuildPanel` + `CharacterArtifactsModal` (visualizador e editor manual de artefatos/armas/nível + metas de status + exportação PNG)
- `KQMExportCard` (card de build do time) · `TeamSlotSubstitutesModal` · `BuildSubstitutesEditor` · `BuildReferencesEditor`

---

## 6. Backend — endpoints

- **Characters:** `GET /characters` · `GET /characters/{slug}` · `GET /characters/{slug}/build`
- **Weapons:** `GET /weapons` · `GET /weapons/{slug}` · `GET /weapons/{slug}/ascension`
- **Artifacts:** `GET /artifacts` · `GET /artifacts/{slug}`
- **Reactions:** `GET /reactions`
- **Templates & Presets:** `GET /templates/archetypes` · `GET /templates` · `GET /templates/{id}` · `/presets/*`
- **Teams:** `POST /teams` · `GET /teams` · `GET /teams/{id}` · `DELETE /teams/{id}` · `POST /teams/analyze` · `PUT /teams/{id}/builds` · `POST /teams/preview-tier`
- **Talents / Ascension / Meta:** `GET /talents/{slug}/talents` · `GET /ascension/{slug}/ascension` · `GET /meta/enums`
- **Tierlist:** `GET /tierlist` · `GET /tierlist/character/{slug}` · `GET /tierlist/sites` · `POST /tierlist/import`
- **Recommendations (Consultor da Conta):** `POST /recommendations/pulls` · `POST /recommendations/upgrades` · `POST /recommendations/artifacts` · `POST /recommendations/endgame-teams`
- **Enka.Network Proxy:** `GET /enka/{uid}` (cacheado, retorna personagens, armas e artefatos da vitrine)

### Migrations (ordem)
1-14. Legado (Schema inicial, weapons, artifacts, tierlists).
15. `b96ba14b2abd_add_translation_tables_for_talents_`
16. `2041a237fb91_add_translation_tables_for_talents_`
17+. `weapon_source` (tags de obtenção), `text_translations` (cache de tradução de notas dos guias), campos extras de tierlist/endgame.

---

## 7. Features prontas

- DB completo com PT/ES traduzidos para chars, talentos, passivos e constelações.
- Calculadora de ascensão + talentos.
- **Team Builder**: drag-and-drop, sinergia refinada, tier badge, build KQM na página.
- **Tierlist Aggregator**: 6 sites, 758 entries, 127 chars.
- **Planner Completo (v3)**:
  - Import de JSON do Seelie.
  - Cálculo de XP de personagem (Livros) e Arma (Minérios).
  - Estimativa de Mora total (Level up + Ascensão + Talentos + Armas).
  - Cálculo de Ley Lines de XP e Mora.
  - **Modo de Edição**: Alterar nível (atual/meta), constelação, talentos (NA/ES/EB).
  - **Marcos de Ascensão** (checkboxes para pular ascensões indesejadas).
  - **Status**: Ativo / Inativo (Inativos são ignorados nos totais globais).
  - Ordenação padrão por Prioridade (Ativos Pendentes > Ativos Completos > Inativos).
  - **Tooltips** (resina/descrição) em todos os ícones de materiais nos cards.

---

## 8. Em progresso / pendente

- [x] Space UI (fundo animado com constelações e meteoros).
- [x] Traduções PT/ES completas.
- [x] Planner v3 (Edição, XP, Leylines).
- [ ] **Refinar cálculo da Página de Personagem** (`AscensionSection` e `TalentSection`) com a mesma fonte de XP/Leylines (`xp-costs.ts`).
- [ ] Builds KQM manuais para os ~120 chars restantes.
- [ ] Refinar roles 1:1 (127 chars) — destrava sinergia + tier do time.
- [ ] Deploy público + README.

---

## 9. Banco de dados — contagens

| Item | Valor |
|---|---|
| characters | 127 |
| weapons | ~250 |
| artifact_sets | ? |
| teams | ? |
| tierlist_entries | 758 |
| character_talent_translations | 720 |
| character_passive_translations | 812 |
| character_constellation_translations | 1440 |

---

## 10. Decisões arquiteturais

- **Team tier** = média arredondada (half-up) do `consensus_tier`.
- **Traduções**: Tabelas espelho (`*_translations`). EN vem da base, PT/ES das tabelas espelho com `joinedload`.
- **Planner XP**: Tabela centralizada em `xp-costs.ts`. Usa tabela oficial por nível (interpolação linear). Mora de XP = 20% do XP. Armas 5★ base, multiplicador por raridade.
- **Planner Marcos**: `current > M` significa que passou (auto-check, disabled). `current <= M < goal` são checkboxes que o user marca se for fazer a ascensão. Default é vazio (user escolhe).
- **Planner Status**: `is_inactive` ignora o char na soma de mora e resina do `recomputeAggregates`. Mas o modal dele continua calculando tudo normalmente.
- **SpaceBackground**: SVG de constelações + span de meteoros no `App.tsx`. CSS `constellationBreath` e `meteorFall`.
- `isPositioned` obrigatório em todo tooltip (`opacity: 0` inline).
- Hierarquia z-index: modal 10000 → picker 10100 → tooltip 20000.

---

## 11. Armadilhas conhecidas

1. **Backend em Docker não pega mudanças** — sempre `restart backend`.
2. **`alembic revision --autogenerate` cria migrations duplicadas** — verificar.
3. **Yatta retorna HTML cru** (`<color>`, `{LINK#...}`) — `stripHtml` e `cleanDescription` filtram.
4. **Meteoros precisam de `-45deg`** pra ficarem fluidos.
5. **Cards do Planner**: `PlannerCharacterCard` não pode ter `title` nativo do browser para tooltip, pois o `<ItemTooltip>` já cuida disso.

---

## 12. Backlog / roadmap

- **(A) Refatorar Página de Personagem** (AscensionSection + TalentSection) com XP/Leylines.
- **(B) Builds KQM manuais** para ~120 chars.
- **(C) Refinar roles 1:1** (127 chars).
- **(D) Deploy público + README.**

---

## 13. Sessão 2026-10-29 (histórico)
*Migração de build, Abas do editor, Page TeamDetail, pickers.*

## 14. Git — estado

Branch: `main`

**Último commit (2026-10-31):**
`feat(planner): edição completa de metas, cálculo de XP/Leylines e UI refinada`

---

## 15. Tierlist Aggregator
6 sites, 758 entries, 127 chars. `consensus_tier` (moda) e `tier_by_avg`.

---

## 16. ⏸️ ONDE PARAMOS (sessão 2026-10-30)
> SUPERSEDED.

---

## 17. Sessão 2026-10-30 — Tierlist Aggregator
Importação e View.

---

## 18. Sessão 2026-10-31 — Team tier badge
Badge S/A/B e preview.

---

## 19. Sessão 2026-10-31 — Traduções + Build KQM
Tabelas espelho, `joinedload`, build KQM na página, refinamento de sinergia.

---

## 20. Sessão 2026-10-31 — Tema Nod-Krai
SpaceBackground, glassmorphism, hover por elemento.

---

## 21. Sessão 2026-10-31 — Planner v3

### XP e Mora de Level Up (A Grande Correção)
O Planner antes só calculava Materiais de Ascensão e Talentos. Agora ele calcula:
- **XP e Livros**: `Hero's Wit` (personagem) e `Mystic Ore` (armas), calculados com base no nível atual e meta (interpolação).
- **Mora de Level Up**: 20% do XP para chars, 10% do XP para armas.
- **Ley Lines**: Estima quantas `Ley Line of Revelation` (XP) e `Ley Line of Wealth` (Mora) são necessárias para bancar o farm.

### UI do Modal
- `PlannerCharacterModal` ganhou uma barra superior (4 colunas) com Mora Total, Resina, Ley Line XP e Ley Line Mora.
- Inputs de Nível: `<Minus>` `<input>` `<Plus>` + marcos (1, 20, 40...).
- Ascensões: Lógica corrigida. Agora são checkboxes grandes e visíveis. O sistema NÃO marca automaticamente o nível em que o personagem está travado (`current > M`, não `>=`).
- Status: Toggle de Ativo/Inativo. Se inativo, o char não conta nos totais globais da página do planner.
- Armas: Nível de arma atrelado à meta do personagem. Suporta adicionar, remover e trocar via `PlannerWeaponPicker`. Também possui checkboxes de ascensão.

### Tooltips
- `PlannerCharacterCard` (o card da lista) agora usa `ItemTooltip` nos ícones dos materiais.
- Passar o mouse num item mostra descrição, raridade e a estimativa de resina (ex: "2 runs", "Com sorte / Média / Sem sorte").

### Ordenação
- A lista de `PlannerCharactersPage` agora ordena por **Prioridade** por padrão:
  1. Ativos com pendência (precisa farmar)
  2. Ativos completos
  3. Inativos
  - Dentro de cada grupo: A-Z.

  ---

## 22. Sessão 2026-11-01/02 — Planner 100% Offline, GOOD Import, AR/WL, Alquimia

### Arquitetura de dados (FIM das 200 queries)

- **`planner-data.json` estático** (1.6 MB, ~200 KB gzip) gerado por `backend/app/scripts/export_planner_data.py`.
- Contém: 127 chars, 276 weapons, 509 materials, `global_max` (teto), `families` (alquimia).
- **Frontend NÃO chama mais `/api/characters/.../ascension` nem `/talents`**. Tudo é lookup local via `utils/planner-compute.ts`.
- Script roda manualmente quando o DB muda: `docker compose exec backend python -m app.scripts.export_planner_data`.
- ⚠️ **Lição crítica**: NUNCA usar `joinedload` em múltiplas coleções (gerou 40M de rows e swap/OOM). **Sempre `selectinload`**.
- ⚠️ **Rede de segurança**: `mem_limit: 3g` + `memswap_limit: 3g` no backend do docker-compose.
- Script tem `--limit N` pra testar com 3 chars antes de rodar full.

### Utils novos do frontend

- `utils/planner-data.ts`: loader + cache em memória. `pickLang()` pra tradução.
- `utils/slug-resolver.ts`: resolve `hutao`/`HuTao`/`hu-tao` → `hu-tao` via `normalize()` + aliases.
- `utils/planner-compute.ts`: `computeAscensionCost`, `computeTalentCost`, `computeWeaponAscension` substituem as chamadas de API.
- `utils/good-parser.ts` + `types/good.ts`: parseiam JSON do HoYoLAB.

### Import GOOD + Merge (Planner v5)

- UI tem **dois inputs**: Seelie (metas/inventário) e GOOD (estado atual).
- **GOOD = fonte da verdade** pra `current.level`, `cons`, `talents`, `weapon equipped`.
- **Seelie = fonte da verdade** pra `goal.level`, inventário, `inactive`, `ar`, `wl`.
- **Storage v5**: `gsb.planner.v5 = { seelie, good }`. Migração automática de v4.
- Se GOOD desatualizado (`GOOD.level < Seelie.current.level`), usa GOOD mesmo + warning.
- Se GOOD tem arma diferente do Seelie, mantém a do Seelie.

### Alquimia + Teto Global

- `planner-data.json` tem `global_max` (máximo necessário pra 100% do jogo) e `families` (grupos 3:1).
- `MaterialCard` mostra badges verdes ("Teto Global Atingido") ou azuis ("Conversível via Alquimia").
- `MaterialGroupCard`: agrupa tiers da mesma família num card só, ordenado pela ordem do Seelie (`SEELIE_ORDER`).
- Boss semanal + outras famílias especiais são renderizados **individualmente** (não agrupados), mas agrupados na ordenação por família.

### AR / WL (World Level)

- `SeelieData` ganhou `ar?: number` e `wl?: number` (vêm do JSON do Seelie).
- `utils/xp-costs.ts`: tabela `LEYLINE_XP_BY_WL` e `LEYLINE_MORA_BY_WL`:
  - WL 6-9: 122.500 XP / 60.000 Mora por run
  - WL 0-5: valores menores (tabela completa no código)
- `SettingsModal.tsx` permite editar AR e WL manualmente. Recalcula automaticamente.
- `computeCharXp(from, to, wl)` e `computeMoraLeyline(mora, wl)` aceitam WL.
- WL 9 **não altera** Ley Line (só garante 3 boss mats).

### Ordem exata do Seelie

- `SEELIE_ORDER` em `PlannerPage.tsx`: array com a ordem exata dos materiais no inventário do Seelie.
- Agrupa por família (`families`) e ordena pelo índice no array.
- Ordem: Elite (horn, chaos, prism...) → Comum (mask, scroll, slime...) → Boss Normal → Boss Semanal → Gema → Talento → Domínio.

### Boss Normal vs Semanal

- `planner-data.json` agora tem `is_weekly: true` nos 42 materiais dos 14 chefes semanais.
- Detecção no Python: `source` do DB contém `"Challenge Reward"`.
- 14 chefes detectados automaticamente: Wolf of the North, Stormterror, Azhdaha, Childe, Signora, Guardian of Eternity, Shouki no Kami, All-Devouring Narwhal, Guardian of Apep's Oasis, The Knave, Lord of Eroded Primal Fire, The Game Before the Gate, The Doctor, Il Dottore.
- `recomputeAggregates` (planner-recompute.ts) faz a separação: `boss40` (normal) + `weekly` (semanal).

---

## 23. Sessão 2026-11-02 — Fix AMBR Import Traveler + Auditoria de Inventário

### Bug do import AMBR (Traveler)

- `import_from_ambr.py` descartava IDs compostos (`10000005-anemo`, etc.) porque usava `isdigit()`.
- Fix em `fetch_character_ids`: aceitar IDs com hífen. Filtrar só Aether (`10000005-*`), ignorar Lumine (`10000007-*`) pra evitar duplicatas.
- Fix em `parse_canonical`: aceitar `cid` opcional, forçar `name = "Traveler (Element)"` e `slug = "traveler-element"`.
- Resultado: **39 talent materials por Traveler** (antes era 0).
- `Manekin` e `Manekina` são ignorados (element=None, não são jogáveis).

### Página de Auditoria (`/inventory`)

- `InventoryAuditPage.tsx` em `frontend/src/pages/`.
- Mostra todos os 509 materiais do `planner-data.json` numa tabela.
- Colunas: Ícone, Slug, Nome (PT/EN), Categoria, Raridade, **Semanal?**, **Qtd no inventário**.
- Ordenação por quantidade (maiores primeiro).
- Filtros: busca por nome/slug, filtro por categoria, toggle "Só os que eu tenho".
- Lê `plan.inventory_resolved` do localStorage. Se não tem plano, tenta ler `seelie.inventory` e fazer resolve na hora.
- **Uso**: pra bater dados com a wiki quando algo parece faltar.

### Editor de Item Inline

- Antes era um modal global, virou editor por item.
- Clicar no card do material abre `ItemEditModal.tsx` pra editar quantidade.
- Em `MaterialGroupCard` (agrupado), o tooltip lista cada tier com botão "Editar".
- `handleSaveItem(slug, qty)` atualiza `plan.inventory_resolved` e recalcula.

### Bug pendente (RESOLVER ANTES DE VOLTAR)

- `inventory-mapper.ts` só mapeava **111 de 528** itens do Seelie.
- Causa: drops de mobs (`mask` tier 2 → `ominous-mask`) não eram traduzidos.
- Fix tentativo: `resolveInventory(invRaw, catalog, families)` agora aceita o 3º parâmetro `families` e faz lookup `families[item.item][item.tier]`.
- **Status**: `InventoryAuditPage.tsx` e `PlannerPage.tsx` já passam `data.families`.
- **Verificar**: se ainda estiver em 111 itens, investigar o formato do `item` do Seelie (pode ter prefixos diferentes como `common_rare`, `wam`, etc).

---

## 24. Estado atual (2026-11-04)

### Funcionalidades prontas
- ✅ Planner 100% offline (planner-data.json)
- ✅ Import Seelie + GOOD com merge v5
- ✅ Alquimia 3:1 + Teto Global + Transmutação (Solvente)
- ✅ AR/WL configurável
- ✅ 14 chefes semanais detectados
- ✅ Traveler com 39 talent mats
- ✅ Página de auditoria `/inventory` — **443 slugs resolvidos, 0 unmapped**
- ✅ Editor inline de quantidade por item

### Correções da sessão 2026-11-03/04 (Inventory 100%)
- **`inventory-mapper.ts`**: `SKIP_TYPES` (`xp`/`wep_xp`/`resin`), filtro `value > 0`,
  workaround `l_bone` (Seelie duplica Frostnight nos tiers 0/1; só o tier 2 é
  `lightless-bone` real). 111 → 443 slugs resolvidos.
- **`InventoryAuditPage.tsx`**: NUNCA confia em `gsb.planner.plan.inventory_resolved`
  (cache histórico). Sempre re-resolve do `gsb.planner.v5.seelie.inventory` bruto.
  Loga `[audit]` com contagem de slugs/unmapped/ambiguous pra debug vivo.
- **`export_planner_data.py`**: 38 → 162 famílias.
  - `COMMON_MOB_FAMILIES`: 50 famílias
  - `TALENT_FAMILIES`: 24 famílias × 3 tiers
  - `WAM_FAMILIES`: 24 famílias × 4 tiers
  - `FAMILY_KEY_ALIASES`: 14 (gemas base-curta, typos)
  - `SINGLE_SLUG_ALIASES`: 35 (Signora, Doctor, chefes novos, locals)
  - Fix: `rich-red-satin`→`rich-red-brocade`, typos `sentrys-`/`warriors-`/`dull-prism`/`polar-prism`

### Lições críticas
- **`docker compose cp` é perigoso de rodar de `backend/`** — cria `backend/frontend/`.
  Sempre rodar do root (`cd ~/projects/genshin-smart-team-builder` primeiro).
- **BuildKit cacheia o `COPY . .`** mesmo com `--no-cache` se o delta do context
  for pequeno. Verificar sempre com `wc -c /usr/share/nginx/html/planner-data.json`.
- **Seelie exports tem bugs**: `l_bone` triplicado, typos (`vayuda_turqoise`,
  `mist_veiled_elixer`), `signora_flower`/`signora_wings`/`signora_heart` fora de ordem tier.

### Pendências (próxima sessão)
- [ ] **Item A**: `AscensionSection` + `TalentSection` com `xp-costs.ts` (mesmo padrão do Planner)
- [ ] Builds KQM manuais (~120 chars)
- [ ] Refinar roles 1:1 (127 chars)
- [ ] Deploy público (Cloudflare Pages + Fly.io + Neon)

### Git
- Branch: `main`
- Commits pendentes: 4 (AMBR+export, offline+utils, GOOD+alquimia, inventory+docs)

---

## 25. Prompt pra próxima sessão

> "Lê o PROJECT_CONTEXT.md. A auditoria de inventário está 100% resolvida
> (443 slugs, 0 unmapped). Agora queremos atacar o item A do roadmap:
> aplicar `xp-costs.ts` (XP de personagem + XP de arma + Ley Lines)
> nas seções `AscensionSection` e `TalentSection` da página de personagem,
> igual já foi feito no Planner. Pra isso, manda os 5 arquivos:
> `CharacterDetailPage.tsx`, `AscensionSection.tsx`, `TalentSection.tsx`,
> `planner-compute.ts`, `xp-costs.ts`. Aí a gente faz o mesmo processo:
> ler antes de chutar."

---

## 26. Sessão 2026-11-04 — Redesign da Página de Inventário + Descoberta API Yatta

### Página de Inventário (`/inventory`) — Redesign Completo
- **Layout Full-Width**: Agora a página usa o mesmo truque do `TierlistPage` (`main.container:has(.inventory-page)`) para quebrar o limite de largura do container principal e ocupar a tela toda.
- **Cards de Item (`InventoryMaterialCard`)**:
  - Visual repaginado: ícone, nome, meta, barra de progresso e controles de edição (`+` / `-` e input).
  - Bordas roxas para destacar a área editável.
  - Edição inline que reflete no `localStorage` (`gsb.planner.v5`) e recalcula na hora.
- **Lógica de Barras**: O progresso das barras agora é calculado com base nas **metas do plano** (`plan.tier_groups`), não no `global_max` do jogo inteiro. Cores: verde (completo), amarelo (parcial), vermelho (faltando).
- **Ordenação Hierárquica**: 
  1. **Categoria**: Comum → Elite → Domínio → Boss → Semanal → Gema → Talento → Local.
  2. **Status da Família**: Pendente → Completo → Resto.
  3. **Agrupamento**: Itens da mesma família (ex: Máscaras, Pergaminhos) ficam lado a lado.
  4. **Raridade**: Tier baixo para tier alto.
- **Filtros (Tabs)**: Todos, Comum, Elite, Domínio, Boss, Semanal, Gema, Talento, Local.

### Descoberta: API do Yatta (Project Amber)
- Encontramos o endpoint exato para pegar a **chance de drop (drop rate)** de cada material por monstro.
- Exemplo: `curl -s "https://gi.yatta.moe/api/v2/en/monster/21010101?vh=37F4" | jq '.data.entries."21010101".reward'`
- **Retorno**: Contém o nome do item, raridade e o campo `count` (ex: `"0.42"` significa 42% de chance).
- **Próximos passos planejados**:
  - **(A)** Usar essas taxas para calcular "Kills Necessários" no `ItemTooltip` do Planner.
  - **(B)** Criar uma nova página de **Bestiário** (`/bestiary`) com a lore dos monstros, seus drops e as porcentagens exatas.

### Git
- Branch: `main`
- Status: Alterações no Inventário prontas para commit.

---

## 27. Sessão 2026-11-04 — Página de Bestiário

### Novas Rotas e Páginas
- **`/bestiary`** (`BestiaryPage.tsx`): Página com grid de todos os monstros, abas por tipo (Hilichurl, Boss, etc.) e busca por nome.
- **Modal de Detalhes** (`BestiaryMonsterModal.tsx`): Abre ao clicar no card, mostrando lore completa, drops e porcentagens. Fecha com **ESC** ou clique fora.

### Componentes Criados
- **`BestiaryMonsterIcon.tsx`**: Resolve o path da imagem baseado no prefixo:
  - `UI_MonsterIcon_*` → `/assets/UI/monster/` (Yatta)
  - `UI_ItemIcon_*` → `/assets/UI/` (Yatta padrão)
- **`BestiaryMonsterCard.tsx`**: Card do grid.
- **`BestiaryMonsterTooltip.tsx`**: Tooltip no hover usando `@floating-ui/react` (igual ao `TierlistTooltip`). Mostra tipo, descrição curta (220 chars) e drops com %.

### Correções Críticas (CSS / Imagens)
- **Imagens quebradas**: O `iconUrl()` antigo não servia para monstros. Descobrimos via `curl` que o path correto do Yatta para monstros é `/assets/UI/monster/`. O `BestiaryMonsterIcon` agora faz a detecção automática pelo prefixo.
- **Grid Desuniforme**: Adicionado `.bestiary-card-wrapper` com `height: 100%` e `display: flex` para igualar as alturas dos cards. O `.bestiary-card-name` ganhou `height: 38px` e `line-clamp: 2` para forçar sempre duas linhas, mantendo o alinhamento dos drops e ícones no rodapé.

### Git
- Branch: `main`
- Commit: `feat(bestiary): implementa página de bestiário com tooltips, modal e grid uniforme`

---

## 28. Sessão 2026-11-04 — Firulas: Cursores da Paimon e Favicon

### Cursores Customizados (Paimon)
- Baixamos o pack **"Paimon or Emergency Food"** do site `rw-designer.com`.
- Os arquivos `.cur` foram renomeados e movidos para `frontend/public/cursors/`:
  - `paimon-default.cur` (Seta normal)
  - `paimon-pointer.cur` (Mãozinha para links/botões)
  - `paimon-text.cur` (Cursor de texto para inputs)
  - `paimon-not-allowed.cur` (Para botões desabilitados)
  - `paimon-wait.cur` (Para estados de loading)
  - `paimon-crosshair.cur` (Para sliders/range)
- O `styles.css` foi atualizado com as regras `cursor: url(...)` em escopo global, botões, inputs e estados de disabled/loading.
- ⚠️ **Atenção**: Os cursores não funcionam em telas touch (mobile/tablet).

### Favicon (Primogem SVG)
- Devido a bloqueios de anti-bot da Wikia e do GitHub, o download de PNGs da Paimon falhava (retornava HTML).
- **Solução**: Criamos um favicon nativo em **SVG** (`frontend/public/paimon-favicon.svg`) representando a Primogem (estrela dourada).
- A tag `<link rel="icon" type="image/svg+xml" href="/paimon-favicon.svg?v=3" />` foi injetada no `<head>` do `index.html`.
- O `?v=3` serve para forçar o navegador a ignorar o cache antigo do favicon.

### Correção Crítica no CSS (Build do Vite)
- O build do Docker estava falhando (`Unexpected }`) porque o `styles.css` tinha **chaves órfãs** sobrando de animações antigas.
- Corrigimos removendo as linhas 184 e 5702 que continham fechamentos de chaves soltos.
- **Lição**: Sempre que o Vite reclamar de CSS no Docker, verificar se não há `}` sobrando no arquivo.

### Git
- Branch: `main`
- Commit: `feat(ui): adiciona cursores da Paimon, favicon SVG e finaliza bestiário`

---

## 29. Sessão 2026-11-05 — Exportação de Build (KQM Style) & Ícones Locais

### Exportação de Card (KQM Style)
- **`KQMExportCard.tsx`**: Componente oculto na DOM que gera um cartão 1200x900 usando `html-to-image`.
- **`html-to-image`**: Biblioteca adicionada para converter o componente React em um PNG de alta resolução (`pixelRatio: 2`).
- **Botão Global**: Agora o `TeamDetailPage` tem um botão "Exportar Build" no topo da página (com gradiente da cor do elemento). A exportação pega sempre o Main DPS do time.
- **Efeitos Visuais**: Títulos do card (Armas, Artefatos, etc.) têm um brilho (`text-shadow` e gradiente linear) baseado na cor do elemento do personagem principal.

### Arquitetura de Ícones Locais (Fim do CORS)
- **O Problema**: O `html-to-image` travava ao tentar ler imagens externas da Yatta (CORS / Tainted Canvas).
- **A Solução**: Baixamos todos os ícones (armas, artefatos, talentos, personagens) via script Python, convertemos para `.webp` (super leve) e salvamos em `frontend/public/icons/`.
- **`config.ts`**: Atualizado para buscar as imagens em `/icons/` (local) em vez da URL da Yatta. Adicionado `?v=2` para quebrar o cache de imagens quebradas no navegador.
- **Splash Arts**: Ficam em `frontend/public/splash_arts/{slug}.webp`, carregadas por cima do card exportado usando `object-fit: cover` e `object-position: top center`.

### Travas de Segurança (Race Conditions)
- **Download Duplo**: Adicionado `isExportingRef` no `TeamDetailPage` para garantir que o `toPng` rode apenas uma vez por clique.
- **Ícones Faltando**: O state `talentsLoaded` impede que a exportação ocorra antes dos ícones dos talentos serem buscados na API. O `onError` do React troca imagens quebradas por um pixel transparente invisível, evitando que o `html-to-image` quebre.

### Pendências / Próximos Passos
- [ ] Alguns ícones de talentos e armas falharam no download da Yatta (aprox. 300). É preciso investigar os paths e adicionar fallbacks (ou aceitar que alguns ficarão invisíveis).
- [ ] Polir o layout interno do `KQMExportCard` (espaçamento e alinhamento fino).
- [ ] Implementar as "Sinergias em cartas" com o efeito de corte diagonal nos substitutos excedentes.

### Git
- Branch: `main`
- Commit: `feat(export): implementa exportação de build estilo KQM e migra ícones para local`

---

## 31. Sessão 2026-11-05 — Inteligência de Farm: Kills + Alquimia

### Cálculo de Kills Necessárias
- **`kills-compute.ts`**: Cruza o `bestiary-data.json` com os materiais do Planner.
- **Nível do Mundo (WL)**: Ajusta a taxa de drop (WL 8/9 = 1.0x, menores reduzem).
- **Alquimia em Cadeia**: `calculateFamilyKills` simula a conversão 3:1 dos tiers inferiores para os superiores antes de calcular as kills.

### UI do Tooltip
- **`ItemTooltip.tsx`**: Exibe a seção de "Farm de Monstros" com o nome do monstro (PT-BR), a quantidade estimada e a chance de drop.
- **Integração**: Injetado no `PlannerPage` (grupos), `PlannerCharacterCard` e `PlannerCharacterModal`.

### Correções
- Tradução do `bestiary-data.json` para PT-BR.
- Ícones de Mora e XP baixados e adicionados ao projeto.

---

## 32. Sessão 2026-11-05 — Página do Personagem Inteligente + Ícones de Talentos

### Inteligência na Página do Personagem
- **`AscensionSection.tsx`**: Integrado com `computeCharXp` e `computeMoraLeyline`. Mostra materiais de ascensão + Hero's Wit + Mora de level up + Ley Line XP + Ley Line Mora. Seletor de WL embutido.
- **`TalentSection.tsx`**: Agora exibe a Ley Line de Mora necessária para cobrir o custo de talentos, com seletor de WL.

### Assets
- Baixados ~600 ícones de `UI_Talent_S_*` (constelações) e `UI_Talent_U_*` (passivas).
- Criado `download_talents_passives.py` para manutenção.

### UI
- Emojis removidos do Planner em favor de ícones Lucide (`CheckCircle2`, `FlaskConical`, `AlertTriangle`, `Sprout`, `Leaf`, `Shield`, `Skull`, `CalendarDays`, `Gem`, `BookOpen`, `MapPin`, `ClipboardList`).

---

## 33. Sessão 2026-11-15 — KQM Build, Stats por Nível e Times Relacionados

### O que foi feito
- **Importação KQM**: Parser e importador do KQM estão funcionando. O Skirk já tem a Build KQM completa (armas, artefatos, stats, talentos e combos) e 15 times relacionados.
- **Nova Seção "Times com este personagem"**: Adicionada na página do personagem, listando os times do KQM que ele participa. O personagem atual é destacado em dourado.
- **Stats por Ascensão**: Tabela gerada dinamicamente (`character-stats.json`) mostrando HP, ATK, DEF e Substat (Crit DMG, Crit Rate, etc) nos níveis 1, 20, 40, 50, 60, 70, 80 e 90.
- **Main Stats & Talentos**: A Build KQM agora usa pills azuis para os valores e ícones circulares para a prioridade de talentos.
- **Cursor Help**: Adicionado o cursor da Paimon "?" (`paimon-help.png`) para tooltips.

### Dívida Técnica (Para Verificar no Lançamento)
- [ ] **Fórmula de Stats**: O multiplicador `1.375` usado para calcular HP/ATK/DEF nos níveis de ascensão foi ajustado manualmente para o Skirk. Personagens com scaling diferente (ex: Nilou/HP, Noelle/DEF) podem ter pequenas divergências. **Precisa ser validado e ajustado contra os valores reais do jogo** para todos os 127 personagens.
- [ ] **Tradução KQM**: As notas das armas e artefatos importados do KQM estão em inglês. Pode ser necessário traduzir futuramente.
- [ ] **Imagens dos Times**: O fallback de imagens nos cards de time (na página do personagem) usa a API, mas vale conferir se todos os ícones estão resolvendo corretamente.

### Git
- Commit: `feat(character): KQM build import, stats table por nível e times relacionados`

### Dívida Técnica Adicionada em 2026-11-15
- [ ] **Análise de time imprecisa**: A seção "Análise do time" (score 0-100, warnings, sugestões) foi **removida da UI** (modal de template + TeamDetailPage) por ser imprecisa — um time KQM premium como `Skirk — Furano — Escoffier — Vodyanitsa` aparecia como "20/100 RUIM". O backend ainda calcula (`POST /teams/analyze`), mas a UI não exibe mais. **Para retornar ao roadmap**, o serviço de análise (`backend/app/services/synergy.py` ou similar) precisa ser reescrito com base nos arquétipos reais do KQM (Freeze, Hyperbloom, Vaporize...) em vez de uma pontuação genérica.

---

## 34. Sessão 2026-11-15 (continuação) — Importação Furina + Parser multi-layout

### O que foi feito
- **Furina importada**: Build `KQM Build` com 12 armas · 5 sets 4pc · 1 set 2pc · stats completos (sands HP%/ER%, goblet HP%/Hydro, circlet CRIT Rate/CRIT DMG) · substats ER > CRIT DMG = CRIT Rate > HP% · talent `Burst > Skill`.
- **19 TeamTemplates da Furina**: A KQM lista 5 seções `Example Teams` (uma principal + 4 dentro de arquétipos Vaporize/Freeze/Electro-Charged/Quickbloom). O parser agora coleta todas — antes só a última sobrevivia.
- **Build `Build Oficial` da Furina coexistiu** sem conflito (nome diferente de `KQM Build`).
- **Skirk intacta**: Build `KQM Build` continua com 8 armas · 3 4pc · 9 combos (não foi reimportada).

### Estado do banco
- `CharacterBuildPreset`: Skirk (1) + Furina (2)
- `TeamTemplate`: 34 total (15 Skirk + 19 Furina)

### Parser — 3 layouts suportados
`parse_kqm_guide.py` agora lida com:
1. **Tiered** — `5★ Name\tDesc` (Skirk)
2. **Flat** — `Name\tDesc` sem marcador de raridade (Furina)
3. **Slash** — `A / B / C / D` numa linha (categoria "CRIT Swords")

### Bugs corrigidos nesta sessão
**`parse_kqm_guide.py`:**
- `parse_stat_cell`: trata `" or "` (`HP% or ER%`) e `=` (`CRIT DMG = CRIT Rate`) como separadores
- `parse_talent_priority`: aceita `≥` e `=` além de `>`
- `parse_teams`: usa `find_all_sections` para coletar TODAS as seções `Example Teams`
- `parse_teams`: filtro `PLACEHOLDER_SLUGS` remove templates (`Furina — Pyro — ... — Flex/Healer`)
- `parse_artifacts`: split de `4pc Set A / 4pc Set B` na mesma linha
- `parse_weapons`: fallback `_parse_weapons_flat` quando nenhum bloco tiered é encontrado

**`import_kqm.py`:**
- `resolve_weapon` / `resolve_artifact`: canonicalizam apóstrofo tipográfico U+2019 (`'`) vs ASCII (`'`) antes de comparar por nome — resolveu `Silken Moon's Serenade`

### Dívida Técnica Adicionada em 2026-11-15 (continuação)
- [ ] **`detect_archetype` incompleto**: Não cobre vaporize, electro-charged, mono hydro, mono geo nem quickbloom. 9 de 34 TeamTemplates (26%) ficam `unknown` ou parcialmente errados. Expandir heurística com regras por elemento (2+ pyro → vaporize, 2+ electro + hydro → EC, 3+ mesmo elemento → mono X).
- [ ] **Convenções de slug inconsistentes no seed**: `Weapon.slug` mantém `-s-` para apóstrofo (`serenity-s-call`), `ArtifactSet.slug` remove (`silken-moons-serenade`). Workaround atual: `_canon_name` + `_name_filter` no `import_kqm.py`. Fix definitivo: padronizar geração de slug num script único de seed.
- [ ] **Combos em prosa (Furina)**: Furina não tem seção `Combos` no KQM — as rotações estão como `Sample Rotation` dentro de cada time. Parser retorna `[]` corretamente, mas UI perde essa informação. Avaliar extrair como `rotation_notes` por time no futuro.

### Git (pendente)
- Commit sugerido: `feat(import): Furina KQM build + parser multi-layout + slug apostrophe fix`

---

## 35. Sessão 2026-11-15 (continuação) — Fix de slugs no roster

### Bug corrigido
`useRoster` comparava slugs brutos entre DB (`kuki-shinobu`, `kamisato-ayaka`, `hu-tao`) e GOOD/Seelie (`shinobu`, `ayaka`, `hutao`) — sem normalização. Personagens com prefixo de sobrenome ou nome composto não marcavam como "possuídos". Sintoma reportado: Kuki e Ayaka apareciam como "não tenho" mesmo estando no Seelie.

### Fix
- `normKey()`: lowercase + remove não-alfanumérico + aplica `CHAR_ALIASES`
- `CHAR_ALIASES`: mapeia formas curtas (`ayaka`, `kazuha`, `shinobu`, `kokomi`, `raiden`, `sara`, `heizou`, `yae`, `itto`, `ayato`) para a forma canônica concatenada
- `useEffect` normaliza `good` map e `seelieSlugs` ao carregar
- `get()` normaliza o slug consultado antes de buscar
- `ownedCount` normaliza tudo antes de somar
- Manual continua salvo em slug **bruto** (não quebra dados antigos)

### Validado (10/10)
kuki-shinobu, kamisato-ayaka, hu-tao, kaedehara-kazuha, sangonomiya-kokomi, raiden-shogun, kujou-sara, shikanoin-heizou, yun-jin, lan-yan — todos agora casam com GOOD/Seelie.

### Dívida Técnica nova
- [ ] **Alinhar backend e frontend**: `CHAR_ALIASES` está duplicado em `import_kqm.py` (backend) e `roster.ts` (frontend). Avaliar extrair para JSON compartilhado (`shared/aliases.json`) ou endpoint `/api/aliases`.

---

## 36. Sessão 2026-11-15 (continuação) — Badge de posse no personagem + fix de GOOD vs Seelie

### O que foi feito
- **Badge de posse no `CharacterDetailPage`**: mostra `Tenho · C{N} GOOD/Seelie` (verde) ou `Não tenho` (cinza), com botão "Personalizar" que abre editor inline (checkbox + pills C0–C6 + botão "Remover override").
- **`useRoster` integrado na página do personagem**: badge reativo (usa o mesmo hook do `/roster` e do `TeamTemplateModal`).
- **Ícones Lucide**: `CheckCircle2` (posse), `XCircle` (não tenho), `Pencil` (personalizar), `RotateCcw` (remover override) — sem emojis, seguindo a convenção do projeto.

### Bugs corrigidos
1. **GOOD vs Seelie — precedência errada**: `useRoster` caía no Seelie mesmo quando o GOOD estava presente, inflando o contador (92 vs 74) e marcando como "tenho" chars que o usuário só **planeja** pegar (Seelie é planejador, GOOD é fonte da verdade).
   - Fix: `get()` só cai no Seelie se `good.size === 0`. `ownedCount` idem.
2. **`parseGoodData` retornava Map vazio**: `resolveCharSlug` dependia de `buildIndexes` (só chamado em `PlannerPage.tsx:405` e `_DebugPage.tsx:19`). Em `/characters/:slug` direto, `charIndex` era `null` → resolver retornava `null` → todos os 74 chars skipados → Map vazio → Aino (e todos) caíam no Seelie.
   - Fix: fallback `|| normKey(...)` em `good-parser.ts` (characters + weapons + weaponSlug). `normKey` exportado do `slug-resolver.ts` (lowercase + remove separadores).
3. **Defensive arrays**: `parseGoodData` agora usa `Array.isArray(data?.characters)` e `Array.isArray(data?.weapons)` — não estoura se o GOOD estiver incompleto.
4. **`catch {}` silencioso**: trocado por `catch (e) { console.error(...) }` no `useEffect` do `useRoster` (para erros de parse não passarem em branco).

### Validado
- Aino: `Tenho · C2 GOOD` (antes: `Tenho Seelie` — errado)
- `/roster` contador: **74 / 127** (antes: 92 — inflado pelo Seelie)
- Kuki, Ayaka, Hu Tao: continuam `Tenho · GOOD` ✅

### Dívida Técnica nova
- [ ] **`buildIndexes` não é global**: só roda em `PlannerPage` e `_DebugPage`. Ideal: mover para um `PlannerProvider` (context) que carrega o planner-data uma vez, ou fazer `buildIndexes` lazy/idempotente dentro de `parseGoodData` lendo de `localStorage`. Workaround atual: fallback `normKey` (cobre os casos comuns mas perde mapeamento PT/EN do `charIndex`).

---

## 37. Sessão 2026-11-15 (continuação) — Roster v2 + atalhos + fix do céu

### O que foi feito
- **Roster v2**: design premium (cards com glow por elemento), filtros ricos (elemento/raridade/arma/status), bulk actions (marcar visíveis, marcar 4★, desmarcar, limpar overrides), upload GOOD drag-and-drop.
- **Seletor de constelação**: trigger compacto `C{n}` no card que abre popover com pills C0–C6 legíveis (antes era grid de 7 mini-pills ilegível no card de 140px). Fecha ao clicar fora, z-index do card sobe (`has-cons-open`) para o popover não ser cortado pelos vizinhos.
- **Atalhos de teclado no `/roster`**: `/` foca busca, `?` abre painel de atalhos, Tab navega cards, `←→`/`↑↓` navegam, `0-6` definem constelação, `Espaço`/`Enter` toggle owned, `Backspace`/`Delete` remove override, `Esc` blur/fecha painel.
- **Link "Meu Roster" na nav**: adicionado entre Personagens e Armas (rota `/roster` já existia mas o link faltava).

### Bugs corrigidos
- **Estrelas cadentes invertidas**: cauda estava em `right: 100%` (esquerda da cabeça) com gradient `90deg` (branco na direita) + movimento `translate(-800, 800)` (baixo-esquerda). Visualmente a cauda "liderava" e a cabeça parecia estar embaixo. Fix: `left: 100%` + `270deg` nos dois blocos `.meteor::before` — cauda agora segue a cabeça.
- **Popover de constelação cortado**: `.roster-card` com `overflow: hidden` cortava o popover. Fix: `overflow: visible` + classe `.has-cons-open` no card com `z-index: 50` (popover com `z-index: 9999`).

### Notas
- Duplicata no link "Meu Roster" (patch rodou 2x no `App.tsx`) — removida manualmente.
- Bulk actions + upload GOOD cobrem o caso de usuário novo sem GOOD/Seelie (marca 4★ de uma vez, depois só os 5★).

---

## 38. Sessão 2026-11-15 (continuação) — Stress-test parser + Arlecchino/Neuvillette

### Parser validado em 4 layouts

| Char | Armas | 4pc | Combos | Times | Sands | Talent |
|---|---|---|---|---|---|---|
| skirk | 11 | 3 | 9 | 15 | `atk_pct` | `Skill > Burst` |
| furina | 12 | 5 | 0 | 19 | `hp_pct, er` | `Burst > Skill` |
| arlecchino | 12 | 5 | 4 | 23 | `atk_pct, em` | `Burst > Skill` |
| neuvillette | 12 | 3 | 0 | 31 | `hp_pct` | `Burst > Skill` |

Layouts cobertos:
- **Skirk**: tiered `5★ Name\tDesc`
- **Furina**: flat `Name\tDesc` + 5 seções Example Teams
- **Arlecchino**: híbrido + `Combo Notation` com TAB
- **Neuvillette**: flat + 6 Example Teams + categorias `Recommended 5★ Options\tSurf's Up, ...`

### Bugs corrigidos no parser

1. **Arlecchino zerava combos**: `Combo Notation` faltava no `or` chain. Fix: adicionado.
2. **`N2C and N3C` virava 1 combo**: split de `" and "` adicionado.
3. **Headers de categoria lidos como arma**: `Recommended 5-Star Options\tSurf's Up, Nocturne's...` era 1 arma chamada "Recommended...". Fix: `WEAPON_CATEGORY_HEADER` regex + expandir cada arma da **1ª linha** do desc (o resto é parágrafo explicativo).
4. **`4pc A, 4pc B` concatenados**: split por `/` não pegava vírgula. Fix: `[,/]` no split de artifacts.

### Bugs corrigidos no importador

1. **`import re` faltando**: crashava com `PLACEHOLDER_PATTERN`.
2. **Aliases de chars**:
   - `dendro-traveler` → `traveler-dendro` (e todos os elementos)
   - `core-*`/`secondary-*` são placeholders → `PLACEHOLDER_PATTERN` skippa
3. **Aliases de armas/sets separados**:
   - `WEAPON_ALIASES`: `symphonist-of-scent` → `symphonist-of-scents`, `jadefall-splendor` → `jadefall-s-splendor`
   - `ARTIFACT_ALIASES`: `night-of-the-sky-s-unveiling` → `night-of-the-skys-unveiling`
4. **Dedup de times entre guias**: mesmo time com ordem de chars diferente (Furina+Neuv+Kazuha+Xilonen) duplicava porque dedup era só por `name`. Fix: dedup adicional por `tuple(sorted(character_slugs))`. Duplicata conhecida deletada manualmente.

### Estado final do banco

- `CharacterBuildPreset`: Skirk, Furina, Arlecchino, Neuvillette
- `TeamTemplate`: **87** (era 34 antes da sessão) — **zero duplicatas**

### Dívida Técnica nova

- [ ] **Flex merge**: quando um time aparece em 2 guias com flex diferente (ex: Pyro Traveler no guia da Furina vs Lisa no do Neuvillette), só uma versão é mantida. Merge é ideal mas parser não extrai flex estruturado.
- [ ] **Dedup O(N²)**: para 1000+ teams vai ficar lento. Cache de `set(canonical_keys)` antes do loop.

### Próximos passos sugeridos

1. **Escalar para todos os personagens** (parser robusto em 4 layouts; agora é só colar `.txt` e rodar).
2. **Atacar `detect_archetype`** (agora com 87 times, ~26% `unknown` fica muito visível no filtro de `/teams`).

---

## 39. Sessão 2026-11-16 — Team customizado por guia (`--create-team`)

### O que foi feito
- **Flag `--create-team`** no `import_kqm.py`: cria 1 `Team` customizável por guia (main = char importado, flex = outros 3 do primeiro time do KQM).
- **Naming**: `"{CharName} — Principal"` (opção B). Sem "KQM" no nome; atribuição em `description` + `references`.
- **Parser extrai `references`**: `{url, title}` com link do KQM.
- **Parser extrai `weapon_refinement`**: regex `\bR([1-5])\b` na `notes`. Default 1.

### Estado do banco
5 `Team`s customizados:

| id | nome | origem |
|---|---|---|
| 4 | 'Skirk Freeze (KQM)' | manual (via curl externo) — preservado |
| 6 | 'Skirk — Principal' | auto |
| 8 | 'Arlecchino — Principal' | auto |
| 10 | 'Furina — Principal' | auto |
| 11 | 'Neuvillette — Principal' | auto |

Cada com 4 `TeamCharacter`s, main com build completa + `references`, flex com preset (se existir) ou vazio, `substitutes=[]` (user preenche manualmente).

### Bugs corrigidos
1. `Team`/`TeamCharacter` faltando no import do `import_kqm.py` (NameError).
2. `from app.models import (...)` multi-linha corrompido por regex mal feito.
3. `create_team_from_build` sem `normalize_slug` → `kazuha` virava flex inválido. Fix: normalize + skip placeholders.

### Decisões de design
- **Duplicata entre guias**: `Furina — Principal` e `Neuvillette — Principal` compartilham os mesmos 4 chars (mains diferentes). Mantidos ambos (opção A).
- **`--create-team` default OFF** — imports existentes leves.
- **`substitutes` sempre vazio** — KQM não estrutura alternativas por slot de forma confiável; user preenche.

---

## 40. Sessão 2026-11-16 — Sync chars 5.5+ (Mitya, Valeriy)

### O que foi feito
- **AMBR sync**: `docker compose exec -e AMBR_MAX_CHARACTERS=0 backend python -m app.seed.import_from_ambr` → 127 → **129 chars** (Mitya, Valeriy).
- **26 icons baixados** via scripts existentes:
  - `download_missing.py` → 2 AvatarIcon + 4 Skill_E/S
  - `download_talents_passives.py` → 20 constelações/passivas (Mitya C1-C6 + passivas, Valeriy C1-C6 + passivas)
- **Routine de sync pós-AMBR** (documentada para futuras versões):
  1. `docker compose exec -e AMBR_MAX_CHARACTERS=0 backend python -m app.seed.import_from_ambr`
  2. `python3 download_missing.py`
  3. `python3 download_talents_passives.py`
  4. `docker compose exec backend python -m app.scripts.export_planner_data`
  5. `python3 download_assets.py`
  6. `docker compose build --no-cache frontend && docker compose up -d frontend`

### Dívida Técnica
- [ ] **`enrich_substitutes.py` não implementado**: os 4 auto teams (`id=6,8,10,11`) têm `substitutes=[]`. Precisa criar script que preenche por elemento (mesmo elemento, não-DPS, SUPPORT primeiro). Ficou pra próxima sessão.
- [ ] **`download_talents.py`**: hardcoded com 3 icons (Skill_A_01, Skill_E_SkirkNew_01, Skill_S_SkirkNew_01). Redundante (download_missing cobre).
- [ ] **`?v=2` no `iconUrl()`**: cache do browser não invalida quando arquivos novos são adicionados. Bump pra `?v=3` quando próximo lote de assets chegar.


---

## 41. Sessao 2026-11-18 — Automacao de sync (update_game_data.py)

### O que foi feito
- **update_game_data.py**: orquestrador unico pra sync pos-versao. 6 passos idempotentes:
  1. **AMBR sync** (-e AMBR_MAX_CHARACTERS=0) — chars novos do jogo
  2. **Inventario DB vs FS** — calcula o que falta em frontend/public/icons/
  3. **Downloads via scripts existentes** (download_missing, download_talents_passives, download_assets, export_planner_data)
  4. **Rede de seguranca** — se scripts deixaram gaps, baixa direto do Yatta/Enka (nao depende de planner-data.json)
  5. **Cache bump** — auto-incrementa ?v=N no config.ts
  6. **Rebuild frontend** (docker compose build --no-cache)
- **update.sh**: wrapper (./update.sh = python3 update_game_data.py)
- **Flags**: --dry-run, --check-only, --skip-ambr, --skip-downloads, --no-rebuild, --force

### Caso de uso
Saiu versao nova do Genshin? Roda `./update.sh`. Pronto, tudo sincronizado em ~30-60s.

So verificar (read-only): `python3 update_game_data.py --check-only`
- Exit 0 = tudo OK
- Exit 1 = N faltando

### Fix do backend/frontend/ (root cause)
- **Problema:** export_planner_data() rodando dentro do container (WORKDIR=/app = host backend/) criava backend/frontend/public/planner-data.json (lixo) toda execucao.
- **Fix:** export_planner_data() do automator agora move o arquivo pro lugar certo + limpa o diretorio backend/frontend/ stray.
- **Validado:** rodando --force, o log mostra "planner-data.json movido" e `ls backend/frontend/` retorna "No such file or directory".

### Bugs que o automator expos
- **export_planner_data.py** nao inclui Local Specialties + Boss Materials de chars 5.x recentes (Fairy Wormwood, Kristallfold, Shattered Stability Anchor estavam no DB+Yatta mas nao no JSON).
- **Rede de seguranca** no passo 3.5 cobre esse gap sem depender do export.

### Divida Tecnica
- [ ] enrich_substitutes.py (sessao 39) ainda nao implementado — 4 auto teams (id=6,8,10,11) com substitutes=[].
- [ ] download_talents.py redundante (hardcoded 3 icons do Skirk).
- [ ] export_planner_data.py incluir Local Specialties + Boss Materials de 5.x.
- [ ] planner-data.json gera diff a cada execucao do ./update.sh mesmo sem mudanca real (timestamp interno). Considerar hash/diff-check antes de escrever.


---

## 42. Sessao 2026-11-18 — enrich_substitutes + README

### O que foi feito
- **enrich_substitutes.py**: preenche TeamCharacter.substitutes por elemento.
  - **DPS_SLUGS hardcoded** (verificado, nao chute): Hydro (neuvillette, mualani, ayato), Pyro (arlecchino, hu-tao, yoimiya, lyney, klee, diluc, gaming, mavuika, yanfei), Cryo (skirk, wriothesley, ganyu, ayaka, eula, freminet), Electro (clorinde, cyno, sethos, razor), Anemo (xiao, wanderer, heizou), Geo (itto, navia, ningguang), Dendro (alhaitham, tighnari, kinich), Mixed (chasca, varesa).
  - **SUPPORT_SLUGS**: ordena buffers/healers primeiro nas alternatives.
  - **Regras**: slot 1 (main) nunca substitui; DPS conhecido nunca substitui; flex/support ganha ate 8 alternatives do mesmo elemento.
  - **Flags**: --team-ids, --skip-ids, --dry-run.

### Validado nos 4 auto teams
- id=6 (Skirk): 24 subs
- id=8 (Arlecchino): 24 subs
- id=10 (Furina): 16 subs — pos 2 Neuvillette com 0 (DPS!)
- id=11 (Neuvillette): 24 subs

**Caso critico validado:** Neuvillette em Furina - Principal ficou com subs=0 (DPS Hydro, nao faz sentido sugerir outro Hydro).

### README — secao "Como atualizar"
Documentado:
- ./update.sh (sync completo, 30-60s)
- Flags do update_game_data.py
- Troubleshooting (AMBR 404, backend/frontend/ lixo, icone nao baixa)
- Como importar guias KQM (parse_kqm_guide + import_kqm --create-team)
- Como enriquecer substitutes em times existentes

### Divida Tecnica
- [ ] enrich_substitutes.py — DPS_SLUGS hardcoded. Quando sairem novos DPS, precisa atualizar. Considerar detectar via KQM guides (main_character) quando cobertura ficar suficiente.
- [ ] export_planner_data.py incluir Local Specialties + Boss Materials de 5.x
- [ ] download_talents.py redundante (hardcoded 3 icons do Skirk)
- [ ] planner-data.json gera diff sem mudanca real (timestamp interno)

---

## 43. Sessões 2026-11-19 a 2026-11-22 — Consultor da Conta, Builds/Stats, Backup Drive, Enka UID, GOOD v2 & Scanner Nativo Linux

### 1. Tierlist 12 Fontes, Guias 5 Fontes & i18n
- **Tierlists (12 fontes):** adicionados parsers para **Prydwen 7.2** (Overall + 3 bosses do Stygian), **GameWith 7.2** multi-aba e **YS Helper** (Abismo + Stygian com taxa de uso e times). Abas separadas na `TierlistPage` (Consenso Geral, Abismo 30d, Stygian 30d).
- **Guias & Armas:** tags de obtenção de armas (`sync_weapon_sources.py` + filtros na `WeaponsPage`), tradução cacheada multi-provedor (`translate_guides.py` com Google Translate batch POST, Ollama local, Gemini e DeepL).

### 2. Planejador Zero-JSON, Agenda de Domínios & Backup Google Drive
- **Workflow zero-JSON** (`5e1f6a2`): usuários sem Seelie/GOOD podem adicionar/remover personagens manualmente no Planejador, importar direto do Roster e gerenciar inventário standalone.
- **Widget "O que farmar hoje"** (`4109bc3` — `domain-schedule.ts`, `TodayFarmWidget.tsx`): mostra livros de talento e materiais de arma farmáveis no dia atual (com suporte ao domingo livre e fuso do servidor).
- **Backup Local & Google Drive** (`account-backup.ts`, `google-drive-sync.ts`, `BackupSyncModal.tsx`): exportação/restauração completa em `.json` + sincronização automática com Google Drive via OAuth.

### 3. Importação por UID via Enka.Network
- Proxy backend (`backend/app/api/enka.py` + `services/enka.py`) e modal no frontend (`UidImportModal.tsx`): importa personagens da vitrine, níveis, constelações, talentos, armas **e artefatos equipados** diretamente pelo UID (`e63175a`, `6caefe4`).

### 4. Consultor da Conta (`/pull-advisor` / `/consultor`) — 4 Abas
- Renomeado de *Pull Advisor* para **Consultor da Conta** (`4ce2ef0`, `6caefe4`):
  1. **Quem Pegar** (`pull_advisor.py`): recomendações personalizadas por cobertura elemental/Main DPS + Simulador de Banner.
  2. **Quem Upar** (`upgrade_advisor.py`): ranking de ROI (nível, talentos, qualidade de time e meta Stellar).
  3. **Artefatos & Domínios** (`artifact_advisor.py`): calcula eficiência de resina por domínio cruzando sets recomendados e auditoria dos artefatos GOOD da conta.
  4. **Abismo & Stygian** (`endgame_composer.py`): compositor automático livre de conflito para **2 times (Abismo Espiral)** ou **3 times (Stygian Onslaught)**.

### 5. Builds Equipadas, Stats Reais, Edição Manual, Auditor de Mochila & Cards PNG
- **Stats Reais & Metas** (`char-stats-calc.ts`): calcula HP/ATK/DEF/CR/CD/ER/EM finais a partir dos artefatos GOOD + arma + ascensão, e analisa metas (`analyzeStatTargets`: ER%, proporção 1:2 de Crítico ciente de bônus de 4pc como Marechaussee/Obsidian/Blizzard, e EM).
- **UI de Builds** (`8a06869`, `f77deb1`, `6caefe4`):
  - Nova aba **Minhas Builds & Stats** no `RosterPage` + `EquippedBuildPanel` no `CharacterDetailPage`.
  - `CharacterArtifactsModal`: modal para visualizar e **editar manualmente** artefatos, arma e nível (`saveManualCharacterGear`), sem depender de scanner.
  - Nova aba **Mochila de Artefatos** (`artifact-bag-auditor.ts`): audita peças equipadas e na mochila (`+0`..`+20`), classificando potencial, upgrades prioritários e descartáveis para Strongbox.
  - Exportação de **Build Card em PNG** via Canvas (`build-card-png.ts`).

### 6. Suporte completo ao `rogerioth/Inventory_Kamera` (GOOD v2) + Scanner Nativo Linux
- **GOOD v2 completo no app** (`e9ecde9`): `types/good.ts` agora aceita `materials`, `unactivatedSubstats` (6.0+), `kamera_version`, `lock` em armas e seções parciais; `resolveGoodMaterials` em `inventory-mapper.ts` mapeia materiais GOOD para o Planejador e `/inventory`; uploads parciais fazem **mesclagem inteligente** por seção em `gsb.planner.v5`.
- **Scanner Nativo Linux (`linux-scanner/` — `genshin-kamera-linux`)** (`e9ecde9`..`84d14dd`):
  - Calibração 16:9/16:10 baseada no `rogerioth/Inventory_Kamera`, grade `8×4` calibrada pixel a pixel (32 ícones/página), detecção do banner *Definição de Elixir Santificador*, cadeado coral-vermelho 5.x/6.x e substat `(A ser ativado)` / `(unactivated)` da 6.0+.
  - Captura nativa **sem flash no Ubuntu GNOME / KDE Wayland** via **`xdg-desktop-portal` ScreenCast + PipeWire + GStreamer** (`portal_capture.py`), além de X11 (`mss`) e wlroots (`grim`).
  - Cliques confiáveis em Wine/Proton/Heroic via `xdotool` (hold de 55ms) e `ydotool` (v0.1.8/v1.0+), recorte automático da pílula escura do nível (`crop_dark_badge` em `ocr.py`), `--calibrate` com OCR ao vivo e `--test-click`.
  - **Validado em campo** no Ubuntu GNOME Wayland + Heroic Launcher (548 artefatos 5★ exportados em PT-BR com sets de Nod-Krai carregados direto de `http://localhost:8000/artifacts`).

### Estado de Testes (2026-11-22)
- Backend: 17 arquivos de teste em `backend/tests/`
- Frontend: 12 arquivos / **40 testes** passando (`npm test -- --run`) + `tsc && vite build` limpo
- Linux Scanner: **8 testes** passando (`linux-scanner/tests/test_parsers.py`)

