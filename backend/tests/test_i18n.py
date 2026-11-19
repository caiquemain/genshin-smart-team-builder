from types import SimpleNamespace
from unittest.mock import MagicMock

from app.models import Language
from app.services.i18n import parse_language, resolve_character


class TestParseLanguage:
    def test_valid_and_case_insensitive(self):
        assert parse_language("pt") == Language.PT
        assert parse_language("ES") == Language.ES
        assert parse_language("en") == Language.EN
        assert parse_language("jp") == Language.JP

    def test_fallback_to_en(self):
        assert parse_language(None) == Language.EN
        assert parse_language("") == Language.EN
        assert parse_language("xx") == Language.EN


class TestResolveCharacter:
    def test_english_skips_translation_query(self):
        db = MagicMock()
        char = SimpleNamespace(id=1, name="Furina")
        res = resolve_character(db, char, Language.EN)
        assert res == {
            "name": "Furina",
            "title": None,
            "description": None,
            "constellation_name": None,
        }
        db.query.assert_not_called()

    def test_returns_translation_when_present(self):
        db = MagicMock()
        trans = SimpleNamespace(
            name="Furina",
            title="Solista Interminável",
            description="Descrição em PT",
            constellation_name="Animula Choragi",
        )
        db.query.return_value.filter.return_value.one_or_none.return_value = trans
        char = SimpleNamespace(id=1, name="Furina")

        res = resolve_character(db, char, Language.PT)
        assert res["title"] == "Solista Interminável"
        assert res["description"] == "Descrição em PT"
        assert res["constellation_name"] == "Animula Choragi"

    def test_falls_back_to_canonical_name_when_missing(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.one_or_none.return_value = None
        char = SimpleNamespace(id=1, name="Skirk")

        res = resolve_character(db, char, Language.ES)
        assert res["name"] == "Skirk"
        assert res["title"] is None
