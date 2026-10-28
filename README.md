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
