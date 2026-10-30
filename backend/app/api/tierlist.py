"""API de tierlist."""
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


def _normalize(tier_index: int, scale_size: int) -> float:
    if scale_size <= 1:
        return 1.0
    return round(1.0 - (tier_index / (scale_size - 1)), 4)


@router.get("/sites", response_model=list[TierlistSiteOut])
def list_sites(db: Session = Depends(get_db)):
    return db.query(TierlistSite).order_by(TierlistSite.slug).all()


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


def _fetch_entries(db: Session, slugs: list[str]) -> dict[str, list[TierlistEntryOut]]:
    if not slugs:
        return {}
    entries = (
        db.query(TierlistEntry)
        .filter(TierlistEntry.character_slug.in_(slugs))
        .all()
    )
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


@router.get("", response_model=TierlistResponse)
def get_tierlist(
    role: Optional[str] = Query(None, description="Filtrar por role (main_dps, sub_dps, support, general)"),
    db: Session = Depends(get_db),
):
    if role:
        role = role.replace("-", "_")

    try:
        rows = db.execute(text("""
            SELECT character_slug, dominant_role, consensus_tier, consensus_votes,
                   tier_by_avg, avg_normalized, spread, tiers_voted, site_count
            FROM v_tierlist_consensus
            WHERE (:role IS NULL OR dominant_role = :role)
            ORDER BY avg_normalized DESC
        """), {"role": role}).mappings().all()
    except ProgrammingError:
        raise HTTPException(
            500,
            detail="View v_tierlist_consensus não encontrada. Rode backend/app/scripts/create_view.sql no banco.",
        )

    slugs = [r["character_slug"] for r in rows]
    entries_by_char = _fetch_entries(db, slugs)

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

    entries_by_char = _fetch_entries(db, [slug])
    aggregated = _row_to_aggregated(row, entries_by_char)
    return CharacterTierlistResponse(character_slug=slug, roles=[aggregated])
