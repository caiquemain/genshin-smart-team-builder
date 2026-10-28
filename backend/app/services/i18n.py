"""Resolve traduções com fallback para o valor canônico (inglês)."""
from typing import Any

from sqlalchemy.orm import Session

from ..models import Character, CharacterTranslation, Language


def resolve_character(db: Session, char: Character, lang: Language) -> dict[str, Any]:
    trans = None
    if lang != Language.EN:
        trans = (
            db.query(CharacterTranslation)
            .filter(
                CharacterTranslation.character_id == char.id,
                CharacterTranslation.language == lang,
            )
            .one_or_none()
        )
    return {
        "name": trans.name if trans else char.name,
        "title": trans.title if trans else None,
        "description": trans.description if trans else None,
        "constellation_name": trans.constellation_name if trans else None,
    }


def parse_language(raw: str | None) -> Language:
    if not raw:
        return Language.EN
    try:
        return Language(raw.lower())
    except ValueError:
        return Language.EN
