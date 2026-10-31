# PROJECT_CONTEXT.md

> Arquivo vivo de contexto do projeto. **Sempre atualizar** ao final de cada sessão.
> Última atualização: **2026-10-31** — Planner v3: Edição de metas, XP, Leylines e Status

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

Env: `POSTGRES_USER=genshin`, `POSTGRES_PASSWORD=genshin`, `POSTGRES_DB=genshin_db`.

Conexão psql (user é genshin, NÃO postgres):

    docker compose exec -T db psql -U genshin -d genshin_db -c "\dt"

---

## 4. Estrutura de pastas

    genshin-smart-team-builder/
    ├── backend/
    │   ├── alembic/versions/       → 16 migrations
    │   └── app/
    │       ├── api/                → characters, teams, weapons, artifacts, reactions,
    │       │                          templates, talents, ascension, meta, tierlist
    │       ├── models/             → (c/ translations)
    │       ├── schemas/            → 
    │       ├── scripts/            → 
    │       ├── seed/               → import_from_ambr (PT/ES)
    │       └── services/           → synergy, planner, team_tier, i18n
    ├── frontend/src/
    │   ├── api/                    → client.ts
    │   ├── components/             → ver §5
    │   ├── context/                → LanguageContext
    │   ├── pages/                  → ver §5
    │   ├── types/                  → WeaponSlot, ArtifactSlot, CharacterBuild, tierlist, planner
    │   ├── utils/                  → stats.ts, resin.ts, xp-costs.ts, planner-recompute.ts
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
| /teams/new | TeamBuilderPage | OK |
| /teams/templates/:id | TemplateDetailPage | OK |
| /teams/:id | TeamDetailPage | OK |
| /tierlist | TierlistPage | OK |
| /planner | PlannerPage | OK |
| /planner/characters | PlannerCharactersPage | OK |
| /reactions | ReactionsPage | OK |

### Componentes

- ArtifactPickerModal, ArtifactTooltip
- CharacterBuildEditor, CharacterCard
- **PlannerCharacterCard (com ItemTooltip), PlannerCharacterModal (edição completa)**
- **PlannerWeaponPicker (novo)**
- SpaceBackground
- TeamTierBadge, TierlistTooltip
- WeaponPickerModal, WeaponTooltip
- ItemTooltip

---

## 6. Backend — endpoints

- Characters: `GET /characters` · `GET /characters/{slug}` · `GET /characters/{slug}/build`
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
1-14. Legado (Schema inicial, weapons, artifacts, tierlists).
15. **b96ba14b2abd_add_translation_tables_for_talents_** (cria tabelas de tradução)
16. **2041a237fb91_add_translation_tables_for_talents_** (vazia/no-op)

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

### Prompt para próxima sessão
> "Lê o PROJECT_CONTEXT.md. Vamos aplicar a mesma fonte de XP/Leylines (`xp-costs.ts`) na página de personagem (`AscensionSection` e `TalentSection`)."
