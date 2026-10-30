"""API de tierlist."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
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
    """Normaliza pro intervalo 0.0 - 1.0 (rank-based, top-down)."""
    if scale_size <= 1:
        return 1.0
    return round(1.0 - (tier_index / (scale_size - 1)), 4)


@router.get("/sites", response_model=list[TierlistSiteOut])
def list_sites(db: Session = Depends(get_db)):
    """Lista os sites de tierlist disponíveis."""
    return db.query(TierlistSite).order_by(TierlistSite.slug).all()


@router.post("/import")
def import_tierlist(payload: TierlistImportPayload, db: Session = Depends(get_db)):
    """Importa uma tierlist de um site (manual ou scraping).

    Exemplo de payload:
    {
      "site_slug": "game8",
      "scale": ["SS", "S", "A", "B", "C"],
      "version": "5.8",
      "entries": [
        {"character_slug": "raiden-shogun", "role": "main-dps", "tier": "S"},
        {"character_slug": "raiden-shogun", "role": "support", "tier": "S"}
      ]
    }
    """
    site = db.query(TierlistSite).filter(TierlistSite.slug == payload.site_slug).one_or_none()
    if not site:
        raise HTTPException(404, detail=f"Site {payload.site_slug} não cadastrado")

    # Atualiza scale_size se mudou
    if site.scale_size != len(payload.scale):
        site.scale_size = len(payload.scale)

    scale_map = {label: idx for idx, label in enumerate(payload.scale)}
    inserted = 0
    updated = 0
    invalid_tiers = set()
    # Dedupe dentro do payload: se a mesma (char, role) aparecer 2x, last-wins
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


def _consolidate_tier(avg: float) -> str:
    """Converte média normalizada em label legível."""
    if avg >= 0.85: return "S+"
    if avg >= 0.70: return "S"
    if avg >= 0.55: return "A"
    if avg >= 0.40: return "B"
    if avg >= 0.20: return "C"
    return "D"


@router.get("", response_model=TierlistResponse)
def get_tierlist(
    role: Optional[str] = Query(None, description="Filtrar por role"),
    version: Optional[str] = Query(None, description="Filtrar por versão"),
    db: Session = Depends(get_db),
):
    """Tierlist agregada (média ponderada igual de todos os sites)."""
    query = db.query(
        TierlistEntry.character_slug,
        TierlistEntry.role,
        func.avg(TierlistEntry.normalized_value).label("avg_score"),
        func.count(TierlistEntry.id).label("num_sites"),
    )
    if role:
        query = query.filter(TierlistEntry.role == role)
    if version:
        query = query.filter(TierlistEntry.version == version)
    rows = query.group_by(TierlistEntry.character_slug, TierlistEntry.role).all()

    items = []
    for row in rows:
        # Busca entries individuais
        entries_q = db.query(TierlistEntry).filter(
            TierlistEntry.character_slug == row.character_slug,
            TierlistEntry.role == row.role,
        )
        if version:
            entries_q = entries_q.filter(TierlistEntry.version == version)
        entries = entries_q.all()

        items.append(AggregatedTier(
            character_slug=row.character_slug,
            role=row.role,
            avg_score=round(row.avg_score, 4),
            num_sites=row.num_sites,
            tier_consolidated=_consolidate_tier(row.avg_score),
            entries=[
                TierlistEntryOut(
                    site_slug=e.site.slug,
                    tier_label=e.tier_label,
                    normalized_value=e.normalized_value,
                    role=e.role,
                    version=e.version,
                    source_url=e.source_url,
                ) for e in entries
            ],
        ))

    # Ordena por score descendente
    items.sort(key=lambda x: -x.avg_score)

    return TierlistResponse(role=role, items=items)


@router.get("/character/{slug}", response_model=CharacterTierlistResponse)
def get_character_tierlist(slug: str, db: Session = Depends(get_db)):
    """Todas as tiers de um personagem, agrupadas por role."""
    roles = (
        db.query(TierlistEntry.role)
        .filter(TierlistEntry.character_slug == slug)
        .distinct()
        .all()
    )
    if not roles:
        raise HTTPException(404, detail=f"Sem tierlist para {slug}")

    result = []
    for (role,) in roles:
        entries = (
            db.query(TierlistEntry)
            .filter(
                TierlistEntry.character_slug == slug,
                TierlistEntry.role == role,
            )
            .all()
        )
        avg = sum(e.normalized_value for e in entries) / len(entries)
        result.append(AggregatedTier(
            character_slug=slug,
            role=role,
            avg_score=round(avg, 4),
            num_sites=len(entries),
            tier_consolidated=_consolidate_tier(avg),
            entries=[
                TierlistEntryOut(
                    site_slug=e.site.slug,
                    tier_label=e.tier_label,
                    normalized_value=e.normalized_value,
                    role=e.role,
                    version=e.version,
                    source_url=e.source_url,
                ) for e in entries
            ],
        ))

    return CharacterTierlistResponse(character_slug=slug, roles=result)
