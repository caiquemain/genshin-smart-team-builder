"""Endpoint de importação via UID público (Enka.Network)."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Language
from ..schemas.enka import EnkaImportResponse
from ..services.enka import fetch_and_parse_enka_uid
from .deps import get_language

router = APIRouter(prefix="/enka", tags=["enka"])


@router.get("/{uid}", response_model=EnkaImportResponse)
def import_from_enka_uid(
    uid: str,
    lang: Language = Depends(get_language),
    db: Session = Depends(get_db),
) -> EnkaImportResponse:
    """Busca a vitrine pública de um UID no Enka.Network e resolve personagens/armas."""
    result = fetch_and_parse_enka_uid(db, uid, lang)
    return EnkaImportResponse(**result)
