"""Testes para o classificador de arquétipos de time baseado em reações elementais."""
import json
from pathlib import Path

from app.scripts.import_kqm import PLACEHOLDER_PATTERN, SKIP_SLUGS, normalize_slug
from app.services.archetype_classifier import classify_team_archetype


EL_MAP = {
    "arlecchino": "pyro",
    "mavuika": "pyro",
    "gaming": "pyro",
    "xiangling": "pyro",
    "bennett": "pyro",
    "chevreuse": "pyro",
    "thoma": "pyro",
    "furina": "hydro",
    "neuvillette": "hydro",
    "yelan": "hydro",
    "xingqiu": "hydro",
    "sangonomiya-kokomi": "hydro",
    "nilou": "hydro",
    "columbina": "hydro",
    "citlali": "cryo",
    "ganyu": "cryo",
    "shenhe": "cryo",
    "escoffier": "cryo",
    "skirk": "cryo",
    "mika": "cryo",
    "eula": "cryo",
    "clorinde": "electro",
    "ororon": "electro",
    "fischl": "electro",
    "kuki-shinobu": "electro",
    "raiden-shogun": "electro",
    "ineffa": "electro",
    "flins": "electro",
    "iansan": "electro",
    "nahida": "dendro",
    "alhaitham": "dendro",
    "emilie": "dendro",
    "kinich": "dendro",
    "lauma": "dendro",
    "traveler-dendro": "dendro",
    "collei": "dendro",
    "kaedehara-kazuha": "anemo",
    "sucrose": "anemo",
    "xianyun": "anemo",
    "ifa": "anemo",
    "faruzan": "anemo",
    "xiao": "anemo",
    "xilonen": "geo",
    "zhongli": "geo",
    "noelle": "geo",
    "albedo": "geo",
    "gorou": "geo",
    "navia": "geo",
    "chiori": "geo",
    "zibai": "geo",
    "illuga": "geo",
}


def test_classify_reaction_archetypes_covers_previous_unknowns():
    assert classify_team_archetype(["furina", "gaming", "bennett", "xianyun"], EL_MAP) == "vaporize"
    assert classify_team_archetype(["mavuika", "bennett", "xilonen", "furina"], EL_MAP) == "vaporize"
    assert classify_team_archetype(["arlecchino", "citlali", "bennett", "xilonen"], EL_MAP) == "melt"
    assert classify_team_archetype(["furina", "ganyu", "shenhe", "escoffier"], EL_MAP) == "freeze"
    assert classify_team_archetype(["furina", "clorinde", "ororon", "xilonen"], EL_MAP) == "electro_charged"
    assert classify_team_archetype(["neuvillette", "kuki-shinobu", "traveler-dendro", "collei"], EL_MAP) == "hyperbloom"
    assert classify_team_archetype(["neuvillette", "thoma", "nahida", "xingqiu"], EL_MAP) == "burgeon"
    assert classify_team_archetype(["arlecchino", "bennett", "emilie", "kaedehara-kazuha"], EL_MAP) == "burning"
    assert classify_team_archetype(["alhaitham", "nahida", "fischl", "zhongli"], EL_MAP, main_character="alhaitham") == "spread"
    assert classify_team_archetype(["clorinde", "fischl", "nahida", "kaedehara-kazuha"], EL_MAP, main_character="clorinde") == "aggravate"
    assert classify_team_archetype(["arlecchino", "chevreuse", "fischl", "bennett"], EL_MAP) == "overload"
    assert classify_team_archetype(["eula", "raiden-shogun", "mika", "furina"], EL_MAP) == "superconduct"
    assert classify_team_archetype(["furina", "sangonomiya-kokomi", "kaedehara-kazuha", "xingqiu"], EL_MAP) == "mono_hydro"
    assert classify_team_archetype(["furina", "noelle", "albedo", "gorou"], EL_MAP) == "mono_geo"
    assert classify_team_archetype(["navia", "bennett", "xiangling", "zhongli"], EL_MAP) == "crystallize"
    assert classify_team_archetype(["xiao", "faruzan", "xianyun", "furina"], EL_MAP) == "hypercarry"


def test_classify_lunar_archetypes():
    assert classify_team_archetype(["neuvillette", "ineffa", "columbina", "kaedehara-kazuha"], EL_MAP) == "lunar_charged"
    assert classify_team_archetype(["furina", "flins", "ineffa", "sucrose"], EL_MAP) == "lunar_charged"
    assert classify_team_archetype(["neuvillette", "ineffa", "lauma", "columbina"], EL_MAP) == "lunar_bloom"
    assert classify_team_archetype(["zibai", "illuga", "columbina", "xilonen"], EL_MAP) == "lunar_crystallize"


def test_zero_unknowns_across_all_parsed_teams():
    repo_root = Path(__file__).resolve().parents[2]
    planner_path = repo_root / "frontend" / "public" / "planner-data.json"
    parsed_dir = repo_root / "backend" / "data" / "parsed"
    if not planner_path.is_file() or not parsed_dir.is_dir():
        return

    planner = json.loads(planner_path.read_text(encoding="utf-8"))["characters"]
    el_map = {slug: info["element"].lower() for slug, info in planner.items() if info.get("element")}

    unknowns = []
    for p in parsed_dir.rglob("*-teams.json"):
        raw = json.loads(p.read_text(encoding="utf-8"))
        teams = raw if isinstance(raw, list) else raw.get("teams") or []
        for t in teams:
            slugs = [
                normalize_slug(s)
                for s in (t.get("members") or t.get("character_slugs") or [])
                if s and normalize_slug(s) not in SKIP_SLUGS and not PLACEHOLDER_PATTERN.match(normalize_slug(s))
            ]
            if not slugs:
                continue
            arch = classify_team_archetype(slugs, el_map, main_character=slugs[0], team_name=t.get("raw_line"))
            if arch == "unknown":
                unknowns.append(slugs)

    assert unknowns == [], f"Times ainda classificados como unknown: {unknowns[:10]}"
