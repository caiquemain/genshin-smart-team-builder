"""API de tierlist (com separação entre Consenso Geral, Abismo e Stygian Onslaught)."""
from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.orm import Session
from typing import Optional

from ..database import get_db
from ..models import TierlistSite, TierlistEntry
from ..schemas.tierlist import (
    TierlistImportPayload,
    TierlistResponse, CharacterTierlistResponse, AggregatedTier,
    TierlistEntryOut, TierlistSiteOut,
)

router = APIRouter(prefix="/tierlist", tags=["tierlist"])

VALID_CATEGORIES = ("general", "abyss", "stygian", "all")


def site_category(slug: str) -> str:
    """Classifica um site de tierlist em 'general', 'abyss' ou 'stygian'."""
    if slug == "yshelper-abyss":
        return "abyss"
    if slug == "yshelper-stygian" or slug.startswith("prydwen-stygian-"):
        return "stygian"
    return "general"


def _normalize(tier_index: int, scale_size: int) -> float:
    if scale_size <= 1:
        return 1.0
    return round(1.0 - (tier_index / (scale_size - 1)), 4)


@router.get("/sites", response_model=list[TierlistSiteOut])
def list_sites(
    category: Optional[str] = Query(None, description="Filtrar por categoria (general, abyss, stygian)"),
    db: Session = Depends(get_db),
):
    sites = db.query(TierlistSite).order_by(TierlistSite.slug).all()
    out = [
        TierlistSiteOut(
            slug=s.slug,
            name=s.name,
            url=s.url,
            scale_size=s.scale_size,
            category=site_category(s.slug),
        )
        for s in sites
    ]
    if category and category != "all":
        out = [s for s in out if s.category == category]
    return out


@router.post("/import")
def import_tierlist(payload: TierlistImportPayload, db: Session = Depends(get_db)):
    site = db.query(TierlistSite).filter(TierlistSite.slug == payload.site_slug).one_or_none()
    if not site:
        raise HTTPException(404, detail=f"Site {payload.site_slug} não cadastrado")

    if site.scale_size != len(payload.scale):
        site.scale_size = len(payload.scale)

    scale_map = {label: idx for idx, label in enumerate(payload.scale)}
    inserted = 0
    updated = 0
    invalid_tiers = set()
    deduped: dict[tuple[str, str], "TierlistEntryImport"] = {}
    for entry in payload.entries:
        deduped[(entry.character_slug, entry.role)] = entry

    for (char_slug, role), entry in deduped.items():
        if entry.tier not in scale_map:
            invalid_tiers.add(entry.tier)
            continue
        tier_idx = scale_map[entry.tier]
        norm = _normalize(tier_idx, len(payload.scale))

        existing = (
            db.query(TierlistEntry)
            .filter(
                TierlistEntry.site_id == site.id,
                TierlistEntry.character_slug == char_slug,
                TierlistEntry.role == role,
                TierlistEntry.version == payload.version,
            )
            .one_or_none()
        )
        if existing:
            existing.tier_label = entry.tier
            existing.tier_index = tier_idx
            existing.normalized_value = norm
            existing.source_url = entry.source_url
            updated += 1
        else:
            db.add(TierlistEntry(
                site_id=site.id,
                character_slug=char_slug,
                role=role,
                tier_label=entry.tier,
                tier_index=tier_idx,
                normalized_value=norm,
                version=payload.version,
                source_url=entry.source_url,
            ))
            inserted += 1

    from datetime import datetime, timezone
    site.last_scraped_at = datetime.now(timezone.utc)
    db.commit()

    return {
        "site": payload.site_slug,
        "inserted": inserted,
        "updated": updated,
        "invalid_tiers": list(invalid_tiers),
        "scale_size": len(payload.scale),
    }


def _resolve_site_ids(
    db: Session,
    category: str,
    site_slug: Optional[str] = None,
) -> list[int]:
    sites = db.query(TierlistSite).all()
    if site_slug:
        return [s.id for s in sites if s.slug == site_slug]
    if category == "all":
        return [s.id for s in sites]
    return [s.id for s in sites if site_category(s.slug) == category]


def _fetch_entries(
    db: Session,
    slugs: list[str],
    site_ids: Optional[list[int]] = None,
) -> dict[str, list[TierlistEntryOut]]:
    if not slugs:
        return {}
    q = db.query(TierlistEntry).filter(TierlistEntry.character_slug.in_(slugs))
    if site_ids is not None:
        if not site_ids:
            return {}
        q = q.filter(TierlistEntry.site_id.in_(site_ids))
    entries = q.all()
    out: dict[str, list[TierlistEntryOut]] = defaultdict(list)
    for e in entries:
        out[e.character_slug].append(TierlistEntryOut(
            site_slug=e.site.slug,
            tier_label=e.tier_label,
            tier_master=e.tier_master,
            normalized_value=e.normalized_value,
            role=e.role,
            version=e.version,
            source_url=e.source_url,
        ))
    return out


def _row_to_aggregated(row, entries_by_char) -> AggregatedTier:
    slug = row["character_slug"]
    return AggregatedTier(
        character_slug=slug,
        dominant_role=row["dominant_role"] or "general",
        consensus_tier=row["consensus_tier"],
        consensus_votes=row["consensus_votes"],
        tier_by_avg=row["tier_by_avg"],
        avg_score=round(row["avg_normalized"], 4),
        spread=round(row["spread"], 4),
        tiers_voted=list(row["tiers_voted"] or []),
        num_sites=row["site_count"],
        entries=entries_by_char.get(slug, []),
    )


_CONSENSUS_QUERY = text("""
    WITH per_entry AS (
        SELECT e.character_slug, e.role, e.tier_master, e.normalized_value, e.site_id
        FROM tierlist_entries e
        WHERE e.tier_master IS NOT NULL
          AND e.site_id = ANY(:site_ids)
    ),
    agg AS (
        SELECT
            character_slug,
            COUNT(*) AS votes,
            COUNT(DISTINCT site_id) AS site_count,
            AVG(normalized_value)::float AS avg_normalized,
            MIN(normalized_value)::float AS min_normalized,
            MAX(normalized_value)::float AS max_normalized
        FROM per_entry
        GROUP BY character_slug
    ),
    tier_counts AS (
        SELECT character_slug, tier_master, COUNT(*) AS cnt
        FROM per_entry
        GROUP BY character_slug, tier_master
    ),
    consensus_tier AS (
        SELECT DISTINCT ON (character_slug)
            character_slug,
            tier_master AS consensus_tier,
            cnt AS consensus_votes
        FROM tier_counts
        ORDER BY character_slug, cnt DESC,
            CASE tier_master WHEN 'S+' THEN 1 WHEN 'S' THEN 2 WHEN 'A' THEN 3
                             WHEN 'B' THEN 4 WHEN 'C' THEN 5 WHEN 'D' THEN 6 END
    ),
    dominant_role AS (
        SELECT DISTINCT ON (character_slug)
            character_slug, role
        FROM per_entry
        WHERE role IS NOT NULL
        GROUP BY character_slug, role
        ORDER BY character_slug, COUNT(*) DESC,
            CASE role WHEN 'main_dps' THEN 1 WHEN 'sub_dps' THEN 2
                      WHEN 'support' THEN 3 ELSE 4 END
    ),
    tiers_sorted AS (
        SELECT character_slug,
               array_agg(tier_master ORDER BY
                    CASE tier_master WHEN 'S+' THEN 1 WHEN 'S' THEN 2 WHEN 'A' THEN 3
                                     WHEN 'B' THEN 4 WHEN 'C' THEN 5 WHEN 'D' THEN 6 END
               ) AS tiers_voted
        FROM (SELECT DISTINCT character_slug, tier_master FROM per_entry) d
        GROUP BY character_slug
    )
    SELECT
        a.character_slug,
        dr.role AS dominant_role,
        ct.consensus_tier,
        ct.consensus_votes,
        CASE
            WHEN a.avg_normalized >= 0.9 THEN 'S+'
            WHEN a.avg_normalized >= 0.7 THEN 'S'
            WHEN a.avg_normalized >= 0.5 THEN 'A'
            WHEN a.avg_normalized >= 0.3 THEN 'B'
            WHEN a.avg_normalized >= 0.1 THEN 'C'
            ELSE 'D'
        END AS tier_by_avg,
        a.avg_normalized,
        (a.max_normalized - a.min_normalized)::float AS spread,
        ts.tiers_voted,
        a.site_count
    FROM agg a
    LEFT JOIN consensus_tier ct ON ct.character_slug = a.character_slug
    LEFT JOIN dominant_role dr ON dr.character_slug = a.character_slug
    LEFT JOIN tiers_sorted ts ON ts.character_slug = a.character_slug
    WHERE (:role IS NULL OR dr.role = :role)
    ORDER BY a.avg_normalized DESC, a.character_slug ASC
""")


@router.get("", response_model=TierlistResponse)
def get_tierlist(
    role: Optional[str] = Query(None, description="Filtrar por role (main_dps, sub_dps, support, general)"),
    category: str = Query("general", description="Categoria: general | abyss | stygian | all"),
    site: Optional[str] = Query(None, description="Filtrar por um site específico (ex.: prydwen-stygian-1)"),
    db: Session = Depends(get_db),
):
    if role:
        role = role.replace("-", "_")
    if category not in VALID_CATEGORIES:
        raise HTTPException(400, detail=f"Categoria inválida: {category}")

    site_ids = _resolve_site_ids(db, category, site)
    if not site_ids:
        return TierlistResponse(role=role, items=[])

    rows = db.execute(
        _CONSENSUS_QUERY,
        {"site_ids": site_ids, "role": role},
    ).mappings().all()

    slugs = [r["character_slug"] for r in rows]
    entries_by_char = _fetch_entries(db, slugs, site_ids=site_ids)

    items = [_row_to_aggregated(r, entries_by_char) for r in rows]
    return TierlistResponse(role=role, items=items)


@router.get("/character/{slug}", response_model=CharacterTierlistResponse)
def get_character_tierlist(slug: str, db: Session = Depends(get_db)):
    try:
        row = db.execute(text("""
            SELECT character_slug, dominant_role, consensus_tier, consensus_votes,
                   tier_by_avg, avg_normalized, spread, tiers_voted, site_count
            FROM v_tierlist_consensus
            WHERE character_slug = :slug
        """), {"slug": slug}).mappings().first()
    except ProgrammingError:
        raise HTTPException(500, detail="View v_tierlist_consensus não encontrada.")

    if not row:
        raise HTTPException(404, detail=f"Sem tierlist para {slug}")

    general_site_ids = _resolve_site_ids(db, "general")
    entries_by_char = _fetch_entries(db, [slug], site_ids=general_site_ids)
    aggregated = _row_to_aggregated(row, entries_by_char)
    return CharacterTierlistResponse(character_slug=slug, roles=[aggregated])
