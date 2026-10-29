"""Importer de artefatos (Artifact Set) do Project Amber.

Estrutura do endpoint /v2/{lang}/reliquary:
  - Lista: {items: {id: {name, levelList, affixList, icon, sortOrder}}}
  - Detalhe: {id, name, levelList, affixList, icon, suit, source}

`affixList` é um dict com 2 entradas:
  - ID terminando em 0 → 2pc bonus
  - ID terminando em 1 → 4pc bonus

`levelList` = [min_rarity, max_rarity] ex: [4, 5].
"""
import asyncio
import os
import re
from typing import Any

import httpx
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import ArtifactSet, ArtifactSetTranslation, Language

AMBR_BASE = "https://gi.yatta.moe"
API_PATH = "/api/v2"
VH = "32F2"  # mesmo hash de material/avatar

CANONICAL_LANG = "en"
TRANSLATION_LANGS = [
    s.strip() for s in os.getenv("AMBR_LANGS", "pt,es").split(",") if s.strip()
]
CONCURRENCY = int(os.getenv("AMBR_CONCURRENCY", "8"))
REQUEST_DELAY = float(os.getenv("AMBR_REQUEST_DELAY", "0.02"))
HEADERS = {"User-Agent": "GenshinSmartTeamBuilder/0.1 (educational, fan-made)"}


def slugify(name: str) -> str:
    cleaned = name.replace("'", "").replace("’", "")
    return re.sub(r"[^a-z0-9]+", "-", cleaned.lower()).strip("-")


async def fetch_json(client: httpx.AsyncClient, path: str) -> dict[str, Any] | None:
    url = f"{AMBR_BASE}{API_PATH}{path}"
    try:
        resp = await client.get(url, timeout=30.0)
        resp.raise_for_status()
        return resp.json()
    except Exception as exc:
        print(f"[artifacts] erro {path}: {exc}")
        return None


async def fetch_many(client, paths, sem, delay):
    async def _one(p: str) -> tuple[str, dict[str, Any] | None]:
        async with sem:
            await asyncio.sleep(delay)
            return p, await fetch_json(client, p)
    results = await asyncio.gather(*[_one(p) for p in paths])
    return dict(results)


async def fetch_artifact_ids(client) -> list[int]:
    data = await fetch_json(client, f"/{CANONICAL_LANG}/reliquary?vh={VH}")
    if not data:
        return []
    items = (data.get("data") or {}).get("items") or {}
    return sorted(int(k) for k in items.keys() if str(k).isdigit())


def parse_affix_list(affix_list: dict[str, Any] | None) -> tuple[str | None, str | None]:
    """Retorna (two_piece_bonus, four_piece_bonus).

    IDs terminam em 0 (2pc) e 1 (4pc). Ordena por ID e usa posições.
    """
    if not isinstance(affix_list, dict) or not affix_list:
        return None, None
    try:
        sorted_keys = sorted(affix_list.keys(), key=lambda k: int(k))
    except (ValueError, TypeError):
        sorted_keys = sorted(affix_list.keys())
    two_pc = affix_list.get(sorted_keys[0]) if sorted_keys else None
    four_pc = affix_list.get(sorted_keys[1]) if len(sorted_keys) > 1 else None
    return two_pc, four_pc


def parse_artifact_canonical(raw: dict[str, Any], ambr_id: int) -> dict[str, Any] | None:
    name = raw.get("name")
    if not name:
        return None

    level_list = raw.get("levelList") or []
    rarity_max = max(level_list) if level_list else 5

    two_pc, four_pc = parse_affix_list(raw.get("affixList"))

    # source vem como lista de dicts [{name, type}, ...]; extrai o primeiro nome
    source_raw = raw.get("source")
    if isinstance(source_raw, list) and source_raw and isinstance(source_raw[0], dict):
        source = source_raw[0].get("name")
    elif isinstance(source_raw, str):
        source = source_raw
    else:
        source = None

    return {
        "ambr_id": ambr_id,
        "slug": slugify(name),
        "name": name,
        "rarity_max": rarity_max,
        "level_list": level_list,
        "icon": raw.get("icon"),
        "two_piece_bonus": two_pc,
        "four_piece_bonus": four_pc,
        "pieces": raw.get("suit"),
        "source": source,
    }


def parse_artifact_translation(
    raw: dict[str, Any], lang_code: str
) -> dict[str, Any] | None:
    name = raw.get("name")
    if not name:
        return None
    try:
        lang_enum = Language(lang_code)
    except ValueError:
        return None
    two_pc, four_pc = parse_affix_list(raw.get("affixList"))
    return {
        "language": lang_enum,
        "name": name,
        "two_piece_bonus": two_pc,
        "four_piece_bonus": four_pc,
    }


def upsert_artifact_set(db: Session, payload: dict[str, Any]) -> ArtifactSet | None:
    existing = (
        db.query(ArtifactSet).filter(ArtifactSet.ambr_id == payload["ambr_id"]).one_or_none()
    )
    if existing:
        for k, v in payload.items():
            if k == "slug":
                continue
            setattr(existing, k, v)
        db.flush()
        return existing

    # Detecta colisão de slug (raro)
    if db.query(ArtifactSet).filter(ArtifactSet.slug == payload["slug"]).one_or_none():
        payload["slug"] = f"{payload['slug']}-{payload['ambr_id']}"

    obj = ArtifactSet(**payload)
    db.add(obj)
    db.flush()
    return obj


async def main() -> None:
    async with httpx.AsyncClient(headers=HEADERS, follow_redirects=True) as client:
        sem = asyncio.Semaphore(CONCURRENCY)

        ids = await fetch_artifact_ids(client)
        if not ids:
            print("[artifacts] lista vazia; abortando")
            return

        all_langs = [CANONICAL_LANG] + TRANSLATION_LANGS
        print(f"[artifacts] {len(ids)} sets | langs={all_langs} | concurrency={CONCURRENCY}")

        # Fase 1: fetch em paralelo (detalhes de cada set em cada lang)
        paths = [
            f"/{lang}/reliquary/{rid}?vh={VH}" for rid in ids for lang in all_langs
        ]
        print(f"[artifacts] baixando {len(paths)} detalhes em paralelo...")
        raw = await fetch_many(client, paths, sem, REQUEST_DELAY)

        # Fase 2: persistência serial
        print("[artifacts] persistindo...")
        db = SessionLocal()
        try:
            total = 0
            for i, rid in enumerate(ids, 1):
                en = (raw.get(f"/{CANONICAL_LANG}/reliquary/{rid}?vh={VH}") or {}).get("data") or {}
                if not en:
                    continue
                payload = parse_artifact_canonical(en, rid)
                if not payload:
                    continue
                art = upsert_artifact_set(db, payload)
                if art is None:
                    continue

                for lang in TRANSLATION_LANGS:
                    lang_d = (raw.get(f"/{lang}/reliquary/{rid}?vh={VH}") or {}).get("data") or {}
                    trans = parse_artifact_translation(lang_d, lang)
                    if not trans:
                        continue
                    existing_t = (
                        db.query(ArtifactSetTranslation)
                        .filter(
                            ArtifactSetTranslation.artifact_set_id == art.id,
                            ArtifactSetTranslation.language == trans["language"],
                        )
                        .one_or_none()
                    )
                    if existing_t:
                        for k, v in trans.items():
                            setattr(existing_t, k, v)
                    else:
                        db.add(
                            ArtifactSetTranslation(artifact_set_id=art.id, **trans)
                        )

                total += 1
                if i % 15 == 0:
                    print(f"  [{i}/{len(ids)}] {art.slug}")

            db.commit()
            sets_db = db.query(ArtifactSet).count()
            trans_db = db.query(ArtifactSetTranslation).count()
            print(f"[artifacts] concluído. Sets={sets_db} Translations={trans_db}")
        finally:
            db.close()


if __name__ == "__main__":
    asyncio.run(main())
