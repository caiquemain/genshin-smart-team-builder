# Fontes de Tierlists & Endgame Usage

Cada subpasta representa um site/fonte de tierlist ou taxa de uso endgame.
Use nomes versionados para manter histórico por patch (ex.: `7.2.txt`, `7.1.csv`) ou por modo endgame no YS Helper (`abyss.txt`, `stygian.txt`, `theater.txt`).

## Pastas disponíveis

| Pasta | Fonte | Escala / Tipo | Arquivos atuais |
|---|---|---|---|
| `genshin-gg/` | Genshin.gg (`genshin.gg/tier-list/`) | 5 níveis (`S`..`D`) + role | `7.1.csv` |
| `genshinlab/` | GenshinLab (`genshinlab.com/tier-list/`) | 6 níveis (`SS`..`D`) | `7.1.csv` |
| `game8/` | Game8 (`game8.co`) | 7 níveis (`SS`..`D`) | `7.1.csv` |
| `mobalytics/` | Mobalytics (`mobalytics.gg`) | 9 níveis (`S`..`F`) | `7.1.csv` |
| `gamewith/` | GameWith (`gamewith.net`) | 6 níveis (`SS`..`D`) | `7.1.csv` |
| `prydwen/` | Prydwen (`prydwen.gg/genshin/tier-list`) | Editorial | *(pronto para receber `.txt`/`.csv`)* |
| `icy-veins/` | Icy Veins (`icy-veins.com/genshin-impact/tier-list`) | 6 níveis (`S+`..`D`) + 3 roles | `7.2.txt` (parser ativo) |
| `yshelper/` | YS Helper (Abismo + Stygian Onslaught / Teatro Imaginário) | Taxa de uso (%) | *(pronto para `abyss.txt`, `stygian.txt`, `theater.txt`)* |

## Como importar no banco

```bash
# Importar apenas um site (ex.: Icy Veins — cadastra o site automaticamente se não existir)
docker compose exec backend python -m app.scripts.import_tierlists --site icy-veins

# Simular sem salvar (dry-run)
docker compose exec backend python -m app.scripts.import_tierlists --site icy-veins --dry-run

# Reimportar todos os sites que possuem arquivos aqui (mantém Prydwen intacto se pasta estiver vazia)
docker compose exec backend python -m app.scripts.import_tierlists --all
```

## Script SQL legado (7.1)

O snapshot SQL consolidado (já com o bloco do `GameWith` corrigido dentro da transação) continua disponível em `backend/app/scripts/import_tierlists.sql`.
