# Fontes de Tierlists & Endgame Usage

Cada subpasta representa um site/fonte de tierlist ou taxa de uso endgame.
Use nomes versionados para manter histórico por patch (ex.: `7.2.txt`, `7.2.html`, `7.1.csv`).

## Pastas disponíveis

| Pasta | Fonte | Escala / Tipo | Arquivos atuais |
|---|---|---|---|
| `genshin-gg/` | Genshin.gg (`genshin.gg/tier-list/`) | 5 níveis (`S`..`D`) + role | `7.2.txt` (parser `.txt` ativo) |
| `genshinlab/` | GenshinLab (`genshinlab.com/tier-list/`) | 6 níveis (`SS`..`D`) | `7.1.csv` |
| `game8/` | Game8 (`game8.co`) | 7 níveis (`SS`..`D`) | `7.1.csv` |
| `mobalytics/` | Mobalytics (`mobalytics.gg`) | 9 níveis (`S`..`F`) | `7.1.csv` |
| `gamewith/` | GameWith (`gamewith.net`) | 6 níveis (`SS`..`D`) | `7.1.csv` |
| `prydwen/` | Prydwen (`prydwen.gg/genshin/tier-list`) | Editorial | *(pronto para receber `.txt`/`.csv`)* |
| `icy-veins/` | Icy Veins (`icy-veins.com/genshin-impact/tier-list`) | 6 níveis (`S+`..`D`) + 3 roles | `7.2.txt` (parser `.txt` ativo) |
| `yshelper-abyss/` | YS Helper — Spiral Abyss (`YS Abyss`) | 5 níveis (`S+`..`C`) + `% uso` | `7.2.html` (parser `.html` ativo) |
| `yshelper-stygian/` | YS Helper — Stygian Onslaught (`YS Stygian`) | 5 níveis (`S+`..`C`) + `% uso` | `7.2.html` (parser `.html` ativo) |

## Como importar no banco

```bash
# Importar um site específico (cadastra em tierlist_sites automaticamente se não existir)
docker compose exec backend python -m app.scripts.import_tierlists --site icy-veins
# Importar tierlist + times reais do YS Helper (taxa de uso >= 3.0% por padrão)
docker compose exec backend python -m app.scripts.import_tierlists --site yshelper-abyss --with-teams
docker compose exec backend python -m app.scripts.import_tierlists --site yshelper-stygian --with-teams

# Ou importar apenas os times (sem reescrever tierlist_entries):
docker compose exec backend python -m app.scripts.import_tierlists --site yshelper-abyss --teams-only
docker compose exec backend python -m app.scripts.import_tierlists --site yshelper-stygian --teams-only

# Simular sem salvar (dry-run)
docker compose exec backend python -m app.scripts.import_tierlists --site yshelper-abyss --with-teams --dry-run

# Reimportar todos os sites que possuem arquivos aqui (mantém Prydwen intacto se pasta estiver vazia)
docker compose exec backend python -m app.scripts.import_tierlists --all
```

## Script SQL legado (7.1)

O snapshot SQL consolidado (já com o bloco do `GameWith` corrigido dentro da transação) continua disponível em `backend/app/scripts/import_tierlists.sql`.
