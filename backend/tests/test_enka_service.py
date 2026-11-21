"""Testes unitários do parser/serviço de importação via UID (Enka.Network)."""
import pytest
from fastapi import HTTPException

from app.services.enka import (
    DbCharRef,
    DbWeaponRef,
    parse_enka_payload,
    validate_uid,
)


def _sample_refs():
    furina = DbCharRef("furina", "Furina", "UI_AvatarIcon_Furina", 5, "hydro")
    cryo_trav = DbCharRef("traveler-cryo", "Viajante (Cryo)", "UI_AvatarIcon_PlayerGirl", 5, "cryo")
    splendor = DbWeaponRef("splendor-of-tranquil-waters", 11513, "Esplendor das Águas Silenciosas", "UI_EquipIcon_Sword_Regalis", 5)

    chars_by_icon = {furina.icon.lower(): furina}
    chars_by_slug = {furina.slug: furina, cryo_trav.slug: cryo_trav}
    weapons_by_ambr = {11513: splendor}
    weapons_by_icon = {splendor.icon.lower(): splendor}
    store = {
        "10000089": {
            "Element": "Water",
            "SideIconName": "UI_AvatarIcon_Side_Furina",
            "SkillOrder": [10891, 10892, 10895],
        },
        "10000007-705": {
            "Element": "Ice",
            "SideIconName": "UI_AvatarIcon_Side_PlayerGirl",
            "SkillOrder": [100551, 100552, 100555],
        },
    }
    return store, chars_by_icon, chars_by_slug, weapons_by_ambr, weapons_by_icon


def test_validate_uid_accepts_9_or_10_digits_and_rejects_invalid():
    assert validate_uid("612345678") == "612345678"
    assert validate_uid(" 1812345678 ") == "1812345678"

    for bad in ("", "12345", "abc123456", "12345678901"):
        with pytest.raises(HTTPException) as exc:
            validate_uid(bad)
        assert exc.value.status_code == 400


def test_parse_enka_full_showcase_maps_character_traveler_talents_and_weapon():
    store, c_icon, c_slug, w_id, w_icon = _sample_refs()
    raw = {
        "ttl": 60,
        "playerInfo": {
            "nickname": "AetherBR",
            "level": 60,
            "worldLevel": 9,
            "signature": "Farmando Estelar",
        },
        "avatarInfoList": [
            {
                "avatarId": 10000089,
                "propMap": {"4001": {"val": "90"}, "1002": {"val": "6"}},
                "talentIdList": [891, 892],
                "skillLevelMap": {"10891": 2, "10895": 10, "10892": 9},
                "equipList": [
                    {
                        "itemId": 11513,
                        "weapon": {"level": 90, "promoteLevel": 6, "affixMap": {"111513": 1}},
                        "flat": {"icon": "UI_EquipIcon_Sword_Regalis", "rankLevel": 5},
                    }
                ],
            },
            {
                "avatarId": 10000007,
                "skillDepotId": 705,
                "propMap": {"4001": {"val": "90"}, "1002": {"val": "6"}},
                "talentIdList": [1, 2, 3, 4, 5],
                "skillLevelMap": {"100551": 1, "100552": 8, "100555": 9},
                "equipList": [],
            },
        ],
    }

    out = parse_enka_payload("612345678", raw, store, c_icon, c_slug, w_id, w_icon)
    assert out["nickname"] == "AetherBR"
    assert out["ar"] == 60
    assert out["wl"] == 9
    assert out["showcase_hidden"] is False
    assert len(out["characters"]) == 2

    furina = out["characters"][0]
    assert furina["slug"] == "furina"
    assert furina["level"] == 90
    assert furina["cons"] == 2
    assert (furina["na"], furina["es"], furina["eb"]) == (2, 9, 10)
    assert furina["weapon"]["slug"] == "splendor-of-tranquil-waters"
    assert furina["weapon"]["level"] == 90
    assert furina["weapon"]["refinement"] == 2

    trav = out["characters"][1]
    assert trav["slug"] == "traveler-cryo"
    assert trav["cons"] == 5
    assert (trav["na"], trav["es"], trav["eb"]) == (1, 8, 9)


def test_parse_enka_hidden_showcase_falls_back_to_show_avatar_list():
    store, c_icon, c_slug, w_id, w_icon = _sample_refs()
    raw = {
        "ttl": 60,
        "playerInfo": {
            "nickname": "Privado",
            "level": 58,
            "worldLevel": 8,
            "showAvatarInfoList": [{"avatarId": 10000089, "level": 80}],
        },
    }

    out = parse_enka_payload("612345678", raw, store, c_icon, c_slug, w_id, w_icon)
    assert out["showcase_hidden"] is True
    assert len(out["characters"]) == 1
    assert out["characters"][0]["slug"] == "furina"
    assert out["characters"][0]["level"] == 80
    assert out["characters"][0]["has_detail"] is False
