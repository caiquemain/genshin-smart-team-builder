# Genshin Smart Team Builder & Resource Calculator

Plataforma web para planejamento estratégico de times, guias multi-fonte, tierlist agregada (Consenso Geral + Endgame Sazonal 30d), **Pull Advisor** e cálculo preditivo de recursos em Genshin Impact.

Projeto extensionista — UNINASSAU / Ciência de Dados.

## Stack
- **Backend:** FastAPI + SQLAlchemy + Alembic + PostgreSQL 16
- **Frontend:** React 18 + TypeScript + Vite + Vitest
- **Infra:** Docker + Docker Compose

## Fonte de dados
Os dados de personagens, armas, artefatos e materiais são importados do [Project Amber](https://gi.yatta.moe) — base comunitária aberta de Genshin Impact.
- API: `https://gi.yatta.moe/api/v2/{lang}/avatar`
- Importer: `backend/app/seed/import_from_ambr.py`
- O `vh` (version hash) muda a cada patch. Se o endpoint retornar 404, atualize `VH` no importer.

Este é um projeto fan-made, sem afiliação com a HoYoverse / Cognosphere.

---

## Guia Rápido de Atualização (Quando Sair Patch Novo, ex.: 7.3)

### 1. Atualizar a base do jogo (Personagens, Armas, Artefatos, Ícones)

```bash
./update.sh
```

Faz tudo em ~30–60s:
1. **AMBR sync** — puxa novos personagens/armas/artefatos da API `gi.yatta.moe`
2. **Inventário DB vs FS** — detecta ícones faltando em `frontend/public/icons/`
3. **Downloads** — baixa ícones faltantes (Yatta/Enka)
4. **Cache bump** — incrementa `?v=N` em `frontend/src/config.ts`
5. **Rebuild frontend** — `docker compose build --no-cache frontend`

Flags úteis do `update_game_data.py`:
- `python3 update_game_data.py --check-only` — só verifica ícones faltando (não altera nada)
- `python3 update_game_data.py --dry-run` — simula sem gravar
- `python3 update_game_data.py --skip-ambr` / `--skip-downloads` / `--no-rebuild` / `--force`

---

### 2. Atualizar Tierlists & Endgame (12 Fontes Automatizadas)

Todas as fontes ficam em `backend/data/sources/tierlists/<site>/`. Basta salvar o arquivo do patch novo (ex.: `7.3.txt` ou `7.3.html`) na pasta correspondente:

| Categoria | Pasta (`--site`) | Formato | Como salvar |
|---|---|---|---|
| **Geral** | `genshin-gg/` | `7.3.txt` | Ctrl+A → Ctrl+C na página `genshin.gg/tier-list/` |
| **Geral** | `genshinlab/` | `7.3.txt` | Ctrl+A → Ctrl+C na página `genshinlab.com/tier-list/` |
| **Geral** | `game8/` | `7.3.txt` | Ctrl+A → Ctrl+C na página de Tier List da Game8 |
| **Geral** | `mobalytics/` | `7.3.txt` | Ctrl+A → Ctrl+C na página `mobalytics.gg/genshin-impact/tier-list` |
| **Geral** | `gamewith/` | `7.3.txt` | Colar as abas (`On-Field` + `Off-Field`, ou todas as 5 abas) no mesmo `.txt` |
| **Geral** | `icy-veins/` | `7.3.txt` | Ctrl+A → Ctrl+C na página `icy-veins.com/genshin-impact/tier-list` |
| **Geral** | `prydwen/` | `7.3.txt` | Ctrl+A → Ctrl+C na aba **Overall** do Prydwen |
| **Abismo (30d)** | `yshelper-abyss/` | `7.3.html` | `Ctrl+S` (Salvar Página) no Spiral Abyss Usage Statistics |
| **Stygian (30d)** | `yshelper-stygian/` | `7.3.html` | `Ctrl+S` (Salvar Página) no Stygian Onslaught Usage Statistics |
| **Stygian (30d)** | `prydwen-stygian-1/` | `7.3.txt` | Ctrl+A → Ctrl+C na aba do **Boss 1** no Prydwen *(nome do chefe atualiza sozinho!)* |
| **Stygian (30d)** | `prydwen-stygian-2/` | `7.3.txt` | Ctrl+A → Ctrl+C na aba do **Boss 2** no Prydwen |
| **Stygian (30d)** | `prydwen-stygian-3/` | `7.3.txt` | Ctrl+A → Ctrl+C na aba do **Boss 3** no Prydwen |

*(Dica: o importador sempre escolhe o arquivo com a maior versão `X.Y` dentro da pasta — evite deixar arquivos soltos com números maiores no nome, como `games8.txt`.)*

```bash
# Importar TODAS as 12 fontes de tierlist (atualiza Consenso Geral, Abismo e Stygian)
docker compose exec backend python -m app.scripts.import_tierlists --all

# Importar também os times reais mais usados do YS Helper (taxa de uso >= 3.0%)
# Obs.: nunca sobrescreve nome/descrição de times que já vieram de KQM/Game8/GameWith/Genshin.gg!
docker compose exec backend python -m app.scripts.import_tierlists --site yshelper-abyss --teams-only
docker compose exec backend python -m app.scripts.import_tierlists --site yshelper-stygian --teams-only

# Ou importar apenas um site específico (use --dry-run para testar antes):
docker compose exec backend python -m app.scripts.import_tierlists --site prydwen --dry-run
docker compose exec backend python -m app.scripts.import_tierlists --site prydwen
```

---

### 3. Atualizar Guias, Builds e Times Recomendados (5 Fontes)

Pastas em `backend/data/sources/guides/`:
- `kqm/` — guias `.txt` do KeqingMains (`{slug}.txt`, ex.: `skirk.txt`)
- `game8/` — guias `.txt` da Game8 (`{slug}.txt`)
- `genshingg/` — guias `.txt` do Genshin.gg (`{slug}.txt`)
- `gamewith/` — guias `.txt` da GameWith (`{slug}.txt`)
- `helper_sheet/` — 7 CSVs elementais (`anemo.csv`, `cryo.csv`, `dendro.csv`, `electro.csv`, `geo.csv`, `hydro.csv`, `pyro.csv`) da Genshin Impact Helper Team Sheet (cobre todos os 119+ personagens!)

```bash
# 1. Converter .txt / .csv em JSONs canônicos em backend/data/parsed/<fonte>/
docker compose exec backend python -m app.scripts.parse_guides --all

# Ou apenas uma fonte específica:
docker compose exec backend python -m app.scripts.parse_guides --source kqm

# 2. Importar builds + fazer merge multi-fonte em TeamTemplate (com substitutos curados)
# Obs.: guias editoriais (KQM > Game8 > GameWith > Genshin.gg) prevalecem sobre descrições do YS Helper.
docker compose exec backend python -m app.scripts.import_guides --all

# (Opcional) Usar --create-team se quiser criar um time em "Meus times" para novos guias:
docker compose exec backend python -m app.scripts.import_guides --source kqm --create-team
```

---

### 4. Migrations, Rebuild e Testes

Sempre que puxar mudanças novas do GitHub (`git pull origin main`):

```bash
# 1. Aplicar migrations do banco (idempotente)
docker compose exec backend alembic upgrade head

# 2. Reiniciar backend (se houver mudança em Python)
docker compose restart backend

# 3. Rebuild do frontend (se houver mudança em React/TS/CSS)
docker compose build --no-cache frontend && docker compose up -d frontend

# 4. Rodar testes automatizados
docker compose exec backend pytest -v
```

*(Para consultas rápidas no Postgres local via Docker: `docker compose exec db psql -U genshin -d genshin_db`)*

---

### Troubleshooting

- **AMBR retorna 404:** o `vh` (version hash) muda a cada patch. Atualize `VH` em `backend/app/seed/import_from_ambr.py`.
- **Ícone não baixa:** a rede de segurança tenta Yatta primeiro e depois Enka. Se ambos falharem, o ícone ainda não existe no CDN.
- **Enriquecer substitutos de times customizados antigos:**
  ```bash
  docker compose exec backend python -m app.scripts.enrich_substitutes --team-ids 6,8,10,11 --dry-run
  docker compose exec backend python -m app.scripts.enrich_substitutes --team-ids 6,8,10,11
  ```
