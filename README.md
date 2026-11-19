# Genshin Smart Team Builder & Resource Calculator

Plataforma web para planejamento estratégico de times, guias visuais e cálculo preditivo de recursos em Genshin Impact.

Projeto extensionista — UNINASSAU / Ciência de Dados.

## Stack
- Backend: FastAPI + SQLAlchemy + PostgreSQL
- Frontend: React (próxima etapa)
- Infra: Docker + Docker Compose

## Fonte de dados

Os dados de personagens, armas, artefatos e materiais são importados do
[Project Amber](https://gi.yatta.moe) — base comunitária aberta de Genshin Impact.

- API: `https://gi.yatta.moe/api/v2/{lang}/avatar` (endpoint usado no importer)
- Importer: `backend/app/seed/import_from_ambr.py`
- O `vh` (version hash) muda a cada patch. Se o endpoint retornar 404, atualize
  `VH` no importer.

Este é um projeto fan-made, sem afiliação com a HoYoverse / Cognosphere.

## Como atualizar os dados do jogo

Quando sai uma versão nova do Genshin (chars, armas, artefatos, materiais novos).

### Update automático (recomendado)

    ./update.sh

Faz tudo em ~30-60s:

1. **AMBR sync** — puxa chars novos da API `gi.yatta.moe`
2. **Inventário DB vs FS** — detecta ícones faltando em `frontend/public/icons/`
3. **Downloads** — scripts existentes + rede de segurança (Yatta/Enka)
4. **Cache bump** — incrementa `?v=N` no `frontend/src/config.ts`
5. **Rebuild frontend** — `docker compose build --no-cache frontend`

### Verificar sem mexer em nada (read-only)

    python3 update_game_data.py --check-only

Exit code:
- `0` — tudo OK
- `1` — N ícones faltando

### Flags úteis

| Flag | Efeito |
|---|---|
| `--dry-run` | Simula sem tocar em nada |
| `--check-only` | Só inventário (exit informativo) |
| `--skip-ambr` | Pula sync de chars |
| `--skip-downloads` | Pula downloads via scripts |
| `--no-rebuild` | Não rebuilda frontend |
| `--force` | Roda mesmo se nada faltando |

### Adicionar/atualizar guias KQM

1. Salvar o `.txt` em `backend/data/kqm/{slug}.txt`
2. Rodar:

       docker compose exec backend python -m app.scripts.parse_kqm_guide data/kqm/
       docker compose exec backend python -m app.scripts.import_kqm data/parsed/{slug}-only --create-team

O `--create-team` cria 1 `Team` customizável com a build completa do main char
(armas, artefatos, stats, talentos, combos, references) + substituições
automáticas por elemento nos slots de support.

### Enriquecer substitutes dos times existentes

    # Dry-run (só mostra)
    docker compose exec backend python -m app.scripts.enrich_substitutes --team-ids 6,8,10,11 --dry-run

    # Roda de verdade
    docker compose exec backend python -m app.scripts.enrich_substitutes --team-ids 6,8,10,11

### Quando o update falha

**AMBR retorna 404:** o `vh` (version hash) muda a cada patch. Atualizar no
`backend/app/seed/import_from_ambr.py`.

**Ícone não baixa:** a rede de segurança tenta Yatta primeiro, depois Enka.
Se ambos falham, o ícone não existe no CDN (raro em chars antigos).

**`backend/frontend/` aparece como lixo:** bug já corrigido em sessão 41.
O automator move + limpa automaticamente.
