from fastapi import Query
from ..services.i18n import parse_language
from ..models import Language


def get_language(lang: str | None = Query(default="en")) -> Language:
    return parse_language(lang)
