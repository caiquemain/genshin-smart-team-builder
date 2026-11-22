"""Testes unitários dos parsers EN/PT, catálogo, geometria e export GOOD v2 do genshin-kamera."""
from pathlib import Path
import json

from genshin_kamera.catalog import GameCatalog, load_default_catalog, to_good_key
from genshin_kamera.geometry import (
    RARITY_COLORS,
    WindowGeometry,
    card_rect,
    crop_artifact_level,
    crop_artifact_substats,
    detect_rarity_from_rgb,
    inventory_grid_centers,
)
from genshin_kamera.parsers import (
    build_good_v2_payload,
    parse_artifact_level,
    parse_artifact_substats,
    parse_equipped_character,
    parse_item_count_header,
    parse_main_stat_key,
    parse_material_quantity,
    parse_refinement,
    parse_slot_key,
    parse_weapon_level_and_ascension,
    write_good_json,
)


def _make_catalog() -> GameCatalog:
    # Carrega sem tentar rede (api_url=None), usando planner-data.json real + defaults embutidos
    return load_default_catalog(api_url=None)


def test_to_good_key_converts_names_and_slugs():
    assert to_good_key("Marechaussee Hunter") == "MarechausseeHunter"
    assert to_good_key("Hero's Wit") == "HerosWit"
    assert to_good_key("kaedehara-kazuha") == "KaedeharaKazuha"
    assert to_good_key("Scroll of the Hero of Cinder City") == "ScrollOfTheHeroOfCinderCity"


def test_catalog_loads_planner_data_and_matches_en_and_pt():
    cat = _make_catalog()
    # Defaults embutidos (sets + materiais)
    assert cat.match("artifact_sets", "Caçador das Sombras") == "MarechausseeHunter"
    assert cat.match("artifact_sets", "Marechaussee Hunter") == "MarechausseeHunter"
    assert cat.match("artifact_sets", "Selo da Insulação") == "EmblemOfSeveredFate"
    assert cat.match("materials", "EXP do Herói") == "HerosWit"
    assert cat.match("materials", "Dream Solvent") == "DreamSolvent"
    assert cat.match("materials", "Coroa da Sabedoria") == "CrownOfInsight"

    # Dados carregados de frontend/public/planner-data.json
    assert len(cat.characters) > 50
    assert len(cat.weapons) > 50
    assert cat.match("characters", "Furina") == "Furina"
    assert cat.match("characters", "Kaedehara Kazuha") == "KaedeharaKazuha"
    assert cat.match("weapons", "Favonius Sword") == "FavoniusSword"


def test_parse_slot_and_main_stat_en_and_pt():
    assert parse_slot_key("Flower of Life") == "flower"
    assert parse_slot_key("Flor da Vida") == "flower"
    assert parse_slot_key("Plume of Death") == "plume"
    assert parse_slot_key("Pena da Morte") == "plume"
    assert parse_slot_key("Sands of Eon") == "sands"
    assert parse_slot_key("Areia do Tempo") == "sands"
    assert parse_slot_key("Goblet of Eonothem") == "goblet"
    assert parse_slot_key("Cálice de Erátema") == "goblet"
    assert parse_slot_key("Circlet of Logos") == "circlet"
    assert parse_slot_key("Tiara de Logos") == "circlet"

    assert parse_main_stat_key("HP", slot_key="flower") == "hp"
    assert parse_main_stat_key("ATQ", slot_key="plume") == "atk"
    assert parse_main_stat_key("Energy Recharge", slot_key="sands") == "enerRech_"
    assert parse_main_stat_key("Recarga de Energia", slot_key="sands") == "enerRech_"
    assert parse_main_stat_key("Bônus de Dano Hydro", slot_key="goblet") == "hydro_dmg_"
    assert parse_main_stat_key("Pyro DMG Bonus", slot_key="goblet") == "pyro_dmg_"
    assert parse_main_stat_key("Taxa CRÍT.", slot_key="circlet") == "critRate_"
    assert parse_main_stat_key("CRIT DMG", slot_key="circlet") == "critDMG_"
    assert parse_main_stat_key("Vida", slot_key="sands") == "hp_"


def test_parse_artifact_level_and_substats_en_with_unactivated():
    assert parse_artifact_level("+20") == 20
    assert parse_artifact_level(" +0 ") == 0
    assert parse_artifact_level("invalid") == -1

    ocr_en = """
    • CRIT Rate+10.5%
    • CRIT DMG+21.8%
    • Energy Recharge+11.0%
    • Elemental Mastery+23 (unactivated)
    2-Piece Set: Hydro DMG Bonus +15%
    """
    subs, unact = parse_artifact_substats(ocr_en)
    assert subs == [
        {"key": "critRate_", "value": 10.5},
        {"key": "critDMG_", "value": 21.8},
        {"key": "enerRech_", "value": 11.0},
    ]
    assert unact == [{"key": "eleMas", "value": 23}]


def test_parse_artifact_substats_pt_and_decimal_recovery():
    ocr_pt = """
    • Taxa CRÍT.+105%
    • Dano CRÍT.+14,8%
    • Vida+508
    • ATQ+9,9% (não ativado)
    Conjunto de 2 Peças: Vida +20%
    """
    subs, unact = parse_artifact_substats(ocr_pt)
    assert subs == [
        {"key": "critRate_", "value": 10.5},  # 105% recuperado -> 10.5%
        {"key": "critDMG_", "value": 14.8},
        {"key": "hp", "value": 508},
    ]
    assert unact == [{"key": "atk_", "value": 9.9}]


def test_parse_equipped_weapon_and_materials():
    cat = _make_catalog()
    assert parse_equipped_character("Equipped: Furina", cat) == "Furina"
    assert parse_equipped_character("Equipado por: Kaedehara Kazuha", cat) == "KaedeharaKazuha"
    assert parse_equipped_character("Intensificação em 20% e o Dano", cat) == ""
    assert parse_equipped_character("", cat) == ""

    assert parse_weapon_level_and_ascension("Lv. 90/90") == (90, 6)
    assert parse_weapon_level_and_ascension("Nv. 80/90") == (80, 6)
    assert parse_weapon_level_and_ascension("Lv. 80/80") == (80, 5)
    assert parse_weapon_level_and_ascension("Lv. 20/40") == (20, 1)

    assert parse_refinement("Refinement Rank 5") == 5
    assert parse_refinement("R1") == 1
    assert parse_item_count_header("342/2100") == 342
    assert parse_material_quantity("Possuído: 1,234") == 1234
    assert parse_material_quantity("Owned: 85") == 85


def test_geometry_16_9_vs_16_10_and_sanctified_shift():
    from genshin_kamera.geometry import is_locked_rgb

    w169 = WindowGeometry(0, 0, 1920, 1080)
    w1610 = WindowGeometry(0, 0, 1920, 1200)
    assert w169.is_16_9 is True
    assert w1610.is_16_9 is False

    c169 = card_rect(w169)
    assert c169.width > 400 and c169.height > 700
    assert len(inventory_grid_centers(w169)) == 32

    lv_norm = crop_artifact_level(494, 841, is_16_9=True, is_sanctified=False)
    lv_sanc = crop_artifact_level(494, 841, is_16_9=True, is_sanctified=True)
    assert lv_sanc.y > lv_norm.y

    sub_norm = crop_artifact_substats(494, 841, is_16_9=True, is_sanctified=False)
    sub_sanc = crop_artifact_substats(494, 841, is_16_9=True, is_sanctified=True)
    assert sub_sanc.y > sub_norm.y

    for rarity, rgb in RARITY_COLORS.items():
        assert detect_rarity_from_rgb(rgb) == rarity

    # Cadeado travado coral-vermelho (Genshin 5.x/6.x) vs destravado cinza
    assert is_locked_rgb((171, 146, 147)) is True
    assert is_locked_rgb((210, 205, 198)) is False

    cat = _make_catalog()
    assert cat.match("artifact_sets", "Noite da Revelação do Céu:") == "NightOfTheSkysUnveiling"


def test_build_and_write_good_v2_payload(tmp_path: Path):
    payload = build_good_v2_payload(
        artifacts=[
            {
                "setKey": "MarechausseeHunter",
                "slotKey": "flower",
                "level": 20,
                "rarity": 5,
                "mainStatKey": "hp",
                "location": "Furina",
                "lock": True,
                "substats": [{"key": "critRate_", "value": 10.5}],
                "unactivatedSubstats": [{"key": "eleMas", "value": 21}],
            }
        ],
        materials={"Mora": 5000000, "HerosWit": 320},
    )
    assert payload["format"] == "GOOD"
    assert payload["version"] == 2
    assert "kamera_version" in payload
    assert "characters" not in payload  # scan parcial não inclui chaves vazias
    assert "weapons" not in payload
    assert len(payload["artifacts"]) == 1
    assert payload["materials"]["HerosWit"] == 320

    out_path = write_good_json(payload, tmp_path)
    assert out_path.is_file()
    loaded = json.loads(out_path.read_text(encoding="utf-8"))
    assert loaded == payload
