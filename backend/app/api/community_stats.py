from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Language
from ..services.community_stats import (
    fetch_and_save_paimon_snapshot,
    get_character_community_stats,
    get_community_stats,
)
from .deps import get_language

router = APIRouter(prefix="/community-stats", tags=["community-stats"])


@router.get("")
def read_community_stats(
    refresh: bool = Query(default=False, description="Se true, baixa snapshot novo do Paimon.plus"),
    lang: Language = Depends(get_language),
    db: Session = Depends(get_db),
) -> dict:
    """Retorna o censo global (40k+ contas) e estatísticas comunitárias de todos os personagens."""
    return get_community_stats(db, lang=lang, force_refresh=refresh)


@router.get("/character/{slug}")
def read_character_community_stats(
    slug: str,
    lang: Language = Depends(get_language),
    db: Session = Depends(get_db),
) -> dict:
    """Retorna as estatísticas comunitárias (armas, sets, constelações, talentos, medianas) de um personagem."""
    result = get_character_community_stats(db, slug=slug, lang=lang)
    if not result:
        raise HTTPException(status_code=404, detail=f"Sem estatísticas comunitárias para '{slug}'.")
    return result


@router.post("/refresh")
def refresh_community_stats(
    lang: Language = Depends(get_language),
    db: Session = Depends(get_db),
) -> dict:
    """Atualiza o snapshot local consultando `https://paimon.plus/api/statistics`."""
    fetch_and_save_paimon_snapshot()
    data = get_community_stats(db, lang=lang, force_refresh=False)
    return {
        "status": "ok",
        "updated_at": data["updated_at"],
        "total_players": data["census"]["total_players"],
        "total_characters": data["total_characters"],
    }
