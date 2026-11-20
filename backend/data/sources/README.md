# Fontes de Dados (Multi-Source)

Esta pasta centraliza todas as fontes brutas externas do projeto, separadas em duas áreas:

- [`guides/`](./guides/) — Guias de build, times e substitutos por personagem (`.txt` / `.csv`)
- [`tierlists/`](./tierlists/) — Snapshots de tierlists e taxas de uso endgame por site/versão (`.csv` / `.txt`)

---

## 1. Guias (`guides/`)

Salve os arquivos `.txt` (copiados do guia do personagem) usando o slug do personagem como nome do arquivo (ex.: `skirk.txt`, `raiden-shogun.txt`).

| Pasta | Fonte | Status do Parser |
|---|---|---|
| `guides/kqm/` | KeqingMains (`keqingmains.com`) | Ativo (`parse_kqm_guide.py`) |
| `guides/game8/` | Game8 (`game8.co`) | Ativo (`parsers/game8.py`) |
| `guides/genshingg/` | Genshin.gg (`genshin.gg`) | Ativo (`parsers/genshingg.py`) |
| `guides/gamewith/` | GameWith (`gamewith.net`) | Ativo (`parsers/gamewith.py`) |
| `guides/helper_sheet/` | Genshin Impact Helper Team Sheet | Ativo (`parsers/helper_sheet.py` — 7 CSVs elementais, 119 chars) |

### Como processar e importar guias

```bash
# 1. Parsear todas as fontes configuradas (gera JSONs canônicos em backend/data/parsed/<fonte>/)
docker compose exec backend python -m app.scripts.parse_guides --all

# Ou apenas uma fonte específica:
docker compose exec backend python -m app.scripts.parse_guides --source kqm

# 2. Importar no banco (faz merge multi-fonte em TeamTemplate + popula slot_substitutes)
docker compose exec backend python -m app.scripts.import_guides --all --create-team
```

---

## 2. Tierlists (`tierlists/`)

Veja [`tierlists/README.md`](./tierlists/README.md) para detalhes sobre as pastas de tierlists editoriais e dados endgame (Abismo / Stygian Onslaught / Teatro Imaginário).
