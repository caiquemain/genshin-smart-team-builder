# Fontes de Guias (Multi-Source)

Cada pasta representa um site/fonte independente de guias de Genshin Impact.
Salve os arquivos `.txt` (copiados do guia do personagem) usando o slug do personagem como nome do arquivo (ex.: `skirk.txt`, `raiden-shogun.txt`).

## Pastas disponíveis

| Pasta | Fonte | Status do Parser |
|---|---|---|
| `kqm/` | KeqingMains (`keqingmains.com`) | Ativo (`parse_kqm_guide.py`) |
| `game8/` | Game8 (`game8.co`) | Ativo (`parsers/game8.py`) |
| `genshingg/` | Genshin.gg (`genshin.gg`) | Ativo (`parsers/genshingg.py`) |
| `gamewith/` | GameWith (`gamewith.net`) | Estrutura pronta — adicione 1 `.txt` de amostra para ativar |
| `helper_sheet/` | Genshin Impact Helper Team Sheet | Estrutura pronta — adicione 1 `.txt`/`.csv` de amostra para ativar |

## Como processar e importar

```bash
# 1. Parsear todas as fontes configuradas (gera JSONs canônicos em backend/data/parsed/<fonte>/)
docker compose exec backend python -m app.scripts.parse_guides --all

# Ou apenas uma fonte específica:
docker compose exec backend python -m app.scripts.parse_guides --source kqm

# 2. Importar no banco (faz merge multi-fonte em TeamTemplate + popula slot_substitutes)
docker compose exec backend python -m app.scripts.import_guides --all --create-team
```
