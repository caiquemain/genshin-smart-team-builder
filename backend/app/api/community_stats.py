from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Language
from ..services.community_stats import (
    get_character_community_stats,
    get_community_stats,
)
from .deps import get_language

router = APIRouter(prefix="/community-stats", tags=["community-stats"])


@router.get("")
def read_community_stats(
    lang: Language = Depends(get_language),
    db: Session = Depends(get_db),
) -> dict:
    """Retorna o censo global (40k+ contas) e estatísticas comunitárias do snapshot local.

    Somente leitura: atualizações do snapshot do Paimon.plus são feitas exclusivamente
    via CLI no servidor (`python -m app.scripts.sync_paimon_stats`).
    """
    return get_community_stats(db, lang=lang)


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

