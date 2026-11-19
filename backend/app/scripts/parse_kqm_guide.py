#!/usr/bin/env python3
"""
parse_kqm_guide.py — Converte um guia .txt do KQM em JSON estruturado.

Suporta dois layouts de Weapons:
  - Tiered: "5★ Name\tDesc" (Skirk)
  - Flat:   "Name\tDesc"     (Furina, sem marcador de raridade)

Times: coleta TODAS as seções "Example Teams" (Furina tem 5).
"""
import argparse
import json
import re
from pathlib import Path


def split_respecting_parens(s: str, sep: str = ',') -> list[str]:
    parts, current, depth = [], [], 0
    for ch in s:
        if ch == '(':
            depth += 1; current.append(ch)
        elif ch == ')':
            depth -= 1; current.append(ch)
        elif ch == sep and depth == 0:
            parts.append(''.join(current)); current = []
        else:
            current.append(ch)
    if current:
        parts.append(''.join(current))
    return [p.strip() for p in parts if p.strip()]


def strip_parentheses(s: str) -> str:
    return re.sub(r'\s*\([^)]*\)', '', s).strip()


def clean_weapon_name(name: str) -> str:
    return re.sub(r'^\d+★\s*', '', name).strip()


def clean_char_name(name: str) -> str:
    """Remove prefixos como 'C6 ', 'C0 ', etc. e sufixos de slash."""
    name = re.sub(r'^C\d+\s+', '', name)
    name = name.split('/')[0].strip()
    return name


def to_slug(name: str) -> str:
    name = clean_weapon_name(name)
    name = clean_char_name(name)
    name = strip_parentheses(name).lower().strip()
    name = re.sub(r'[—–]', '-', name)
    name = re.sub(r'[^a-z0-9]+', '-', name)
    return name.strip('-')


def collapse_ws(s: str) -> str:
    return re.sub(r'\s+', ' ', s).strip()


SECTION_HEADERS = [
    "New Content", "Infographic", "Character Overview", "Playstyles",
    "Talents", "Constellations", "Combos",
    "Combo Notation", "Attack Strings", "Full Combos",
    "Artifacts", "Artifact Stats", "Artifact Sets", "Weapons",
    "Teams", "Teambuilding", "Notable Teammates",
    "Example Teams", "Limited Roster Alternatives", "Credits",
]


def trim_at_toc(text: str) -> str:
    idx = text.find("\nTable of Contents\n")
    if idx == -1:
        idx = text.find("Table of Contents")
    return text[:idx] if idx != -1 else text


_SECTION_PATTERN = re.compile(
    r'^(' + '|'.join(re.escape(h) for h in SECTION_HEADERS) + r')\s*$',
    re.MULTILINE,
)


def split_sections(text: str) -> dict[str, str]:
    """Retorna um dict com a ÚLTIMA ocorrência de cada header (legado)."""
    text = trim_at_toc(text)
    matches = list(_SECTION_PATTERN.finditer(text))
    sections = {}
    for i, m in enumerate(matches):
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        sections[m.group(1)] = text[start:end].strip()
    return sections


def find_all_sections(text: str, header: str) -> list[str]:
    """Retorna TODAS as ocorrências de um header (ex: 'Example Teams' repetido)."""
    text = trim_at_toc(text)
    matches = list(_SECTION_PATTERN.finditer(text))
    results = []
    for i, m in enumerate(matches):
        if m.group(1) != header:
            continue
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        results.append(text[start:end].strip())
    return results


# ===== WEAPONS =====
WEAPON_BLOCK = re.compile(
    r'^(?P<tier>[1-5])★[ \t]+(?P<names>[^\n]+?)(?:\t+| {2,})(?P<desc>.+?)(?=\n[1-5]★|\n\n|\Z)',
    re.MULTILINE | re.DOTALL,
)

INLINE_TIER = re.compile(r'(?<![0-9])([1-5])★\s*')

# Fallback "Flat": Name\tDesc sem marcador de raridade (Furina)
FLAT_WEAPON_LINE = re.compile(
    r'^(?P<name>[A-Z][^\t\n]+?)\t+(?P<desc>[A-Za-z].+?)(?=\n[A-Z][^\t\n]{2,60}\t|\Z)',
    re.MULTILINE | re.DOTALL,
)

# Linha "A / B / C / D" (categoria "CRIT Swords" da Furina)
SLASH_WEAPONS = re.compile(
    r'^(?P<list>[A-Z][^\t\n]+?(?:\s*/\s*[A-Z][^\t\n]+?){2,})\s*$',
    re.MULTILINE,
)

# Headers de categoria do KQM: "Recommended 5-Star Options	Surf's Up, ..."
WEAPON_CATEGORY_HEADER = re.compile(
    r'\b(?:recommended|other|alternative|notable|best|good|top|f2p|budget|craftable|event|battle\s*pass|crit)\b'
    r'.*\b(?:options?|alternatives?|picks?|weapons?|swords?|bows?|catalysts?|polearms?|claymores?)\b',
    re.IGNORECASE,
)


def _parse_weapons_tiered(section: str) -> list[dict]:
    weapons = []
    for m in WEAPON_BLOCK.finditer(section):
        block_tier = int(m.group("tier"))
        desc = collapse_ws(m.group("desc"))[:250]
        names_raw = m.group("names")

        inline = list(INLINE_TIER.finditer(names_raw))
        if inline:
            prefix = names_raw[:inline[0].start()].strip().rstrip(',').strip()
            if prefix:
                for raw in split_respecting_parens(prefix):
                    clean = clean_weapon_name(raw)
                    slug = to_slug(clean)
                    if slug and len(clean) > 2:
                        weapons.append({
                            "weapon_slug": slug,
                            "weapon_name": strip_parentheses(clean),
                            "rarity": block_tier,
                            "notes": desc,
                        })
            for i, im in enumerate(inline):
                tier = int(im.group(1))
                start = im.end()
                end = inline[i + 1].start() if i + 1 < len(inline) else len(names_raw)
                seg = names_raw[start:end].strip().rstrip(',').strip()
                for raw in split_respecting_parens(seg):
                    clean = clean_weapon_name(raw)
                    slug = to_slug(clean)
                    if slug and len(clean) > 2:
                        weapons.append({
                            "weapon_slug": slug,
                            "weapon_name": strip_parentheses(clean),
                            "rarity": tier,
                            "notes": desc,
                        })
        else:
            for raw in split_respecting_parens(names_raw):
                clean = clean_weapon_name(raw)
                slug = to_slug(clean)
                if slug and len(clean) > 2:
                    weapons.append({
                        "weapon_slug": slug,
                        "weapon_name": strip_parentheses(clean),
                        "rarity": block_tier,
                        "notes": desc,
                    })
    return weapons


def _parse_weapons_flat(section: str) -> list[dict]:
    """Formato Furina: 'WeaponName\\tDesc...' — sem 'N★'."""
    weapons, seen = [], set()

    # 1) Linhas "Name\tDesc"
    for m in FLAT_WEAPON_LINE.finditer(section):
        raw_name = m.group("name").strip()
        desc = m.group("desc").strip()
        clean = clean_weapon_name(raw_name)

        # Header de categoria: "Recommended 5-Star Options\tSurf's Up, Nocturne's..."
        if WEAPON_CATEGORY_HEADER.search(clean):
            # So a 1a linha do desc contem a lista (o resto eh paragrafo explicativo)
            first_line = re.split(r'\n+', desc.strip())[0]
            for name in re.split(r'\s*[,/]\s*', first_line):
                name = re.sub(r'\s*\([^)]*\)\s*$', '', name).strip()
                clean_name = clean_weapon_name(name)
                slug = to_slug(clean_name)
                if slug and len(clean_name) > 2 and slug not in seen:
                    seen.add(slug)
                    weapons.append({
                        "weapon_slug": slug,
                        "weapon_name": strip_parentheses(clean_name),
                        "rarity": 5,
                        "notes": "Listado em categoria do KQM",
                    })
            continue

        # Caminho normal
        slug = to_slug(clean)
        if not slug or len(clean) < 3 or slug in seen:
            continue
        seen.add(slug)
        weapons.append({
            "weapon_slug": slug,
            "weapon_name": strip_parentheses(clean),
            "rarity": 4,
            "notes": collapse_ws(desc)[:250],
        })

    # 2) Linha "A / B / C / D" (CRIT Swords)
    for m in SLASH_WEAPONS.finditer(section):
        for name in re.split(r'\s*/\s*', m.group("list")):
            clean = clean_weapon_name(name.strip())
            slug = to_slug(clean)
            if not slug or len(clean) < 3 or slug in seen:
                continue
            seen.add(slug)
            weapons.append({
                "weapon_slug": slug,
                "weapon_name": strip_parentheses(clean),
                "rarity": 5,
                "notes": "CRIT stat stick (ver nota do guia)",
            })

    return weapons


def parse_weapons(section: str) -> list[dict]:
    tiered = _parse_weapons_tiered(section)
    return tiered if tiered else _parse_weapons_flat(section)


# ===== ARTIFACTS =====
ARTIFACT_LINE = re.compile(
    r'^(?P<pieces>[24])pc[ \t]+(?P<name>[^\n]+?)(?:\t+| {2,})(?P<desc>.+?)(?=\n[24]pc|\n\n|\Z)',
    re.MULTILINE | re.DOTALL,
)


def parse_artifacts(section: str) -> tuple[list, list]:
    four, two = [], []
    for m in ARTIFACT_LINE.finditer(section):
        pieces = int(m.group("pieces"))
        desc = collapse_ws(m.group("desc"))[:250]
        raw_name = m.group("name")
        # Separa "Set A / 4pc Set B" OU "Set A, 4pc Set B"
        for sub in re.split(r'\s*[,/]\s*(?=[24]pc\s)', raw_name):
            sub = re.sub(r'^[24]pc\s+', '', sub).strip()
            if not sub:
                continue
            name = strip_parentheses(sub)
            slug = to_slug(name)
            if not slug:
                continue
            entry = {"artifact_set_slug": slug, "artifact_set_name": name, "notes": desc}
            (four if pieces == 4 else two).append(entry)
    return four, two


# ===== STATS =====
STAT_ALIASES = {
    "atk%": "atk_pct", "atk": "atk_pct", "atk percent": "atk_pct", "flat atk": "atk_pct",
    "hp%": "hp_pct", "hp": "hp_pct", "flat hp": "hp_pct",
    "def%": "def_pct", "def": "def_pct",
    "em": "em", "elemental mastery": "em",
    "er": "er", "energy recharge": "er", "er%": "er", "energy recharge%": "er", "em%": "em",
    "crit rate": "crit_rate",
    "crit dmg": "crit_dmg", "crit damage": "crit_dmg",
    "cryo dmg": "cryo_dmg", "cryo dmg bonus": "cryo_dmg",
    "pyro dmg": "pyro_dmg", "pyro dmg bonus": "pyro_dmg",
    "hydro dmg": "hydro_dmg", "hydro dmg bonus": "hydro_dmg",
    "electro dmg": "electro_dmg", "electro dmg bonus": "electro_dmg",
    "anemo dmg": "anemo_dmg", "anemo dmg bonus": "anemo_dmg",
    "geo dmg": "geo_dmg", "geo dmg bonus": "geo_dmg",
    "dendro dmg": "dendro_dmg", "dendro dmg bonus": "dendro_dmg",
    "physical dmg": "physical_dmg", "physical dmg bonus": "physical_dmg",
    "healing bonus": "healing_bonus",
}


def to_stat_keys(raw: str) -> list[str]:
    """Retorna uma LISTA. 'CRIT' vira ['crit_rate', 'crit_dmg']."""
    key = raw.strip().lower()
    if key == "crit":
        return ["crit_rate", "crit_dmg"]
    if key in STAT_ALIASES:
        return [STAT_ALIASES[key]]
    return []


def parse_stat_cell(cell: str) -> list[str]:
    cell = re.sub(r'[≥>≈~=]', ',', cell)
    # "HP% or ER%" / "CRIT Rate or CRIT DMG" → virar lista
    cell = re.sub(r'\s+or\s+', ',', cell, flags=re.IGNORECASE)
    result = []
    for p in cell.split(','):
        p = strip_parentheses(p.strip())
        for k in to_stat_keys(p):
            if k not in result:
                result.append(k)
    return result


def parse_stats(section: str) -> dict:
    result = {"sands": [], "goblet": [], "circlet": [], "substats": []}
    lines = [l.strip() for l in section.splitlines()]

    # Forma 1: "Sands\tGoblet\tCirclet" na mesma linha, valores na próxima
    for i, line in enumerate(lines):
        if "Sands" in line and "Goblet" in line and "Circlet" in line and i + 1 < len(lines):
            cells = re.split(r'\t+|\s{2,}', lines[i + 1])
            if len(cells) >= 3:
                result["sands"] = parse_stat_cell(cells[0])
                result["goblet"] = parse_stat_cell(cells[1])
                result["circlet"] = parse_stat_cell(cells[2])
                break

    # Forma 2: "Sands" / "Goblet" / "Circlet" em linhas separadas, valores na 4ª
    if not result["sands"]:
        for i in range(len(lines) - 3):
            if (lines[i] == "Sands" or lines[i].startswith("Sands\t")) \
               and lines[i + 1].startswith("Goblet") \
               and lines[i + 2].startswith("Circlet"):
                cells = re.split(r'\t+|\s{2,}', lines[i + 3])
                if len(cells) >= 3:
                    result["sands"] = parse_stat_cell(cells[0])
                    result["goblet"] = parse_stat_cell(cells[1])
                    result["circlet"] = parse_stat_cell(cells[2])
                break

    # Substats (Stat Priority)
    for line in lines:
        if "Stat Priority:" in line:
            raw = line.split("Stat Priority:")[1]
            raw = re.sub(r'[>=]+', ',', raw)
            for p in raw.split(','):
                p = strip_parentheses(p.strip())
                for k in to_stat_keys(p):
                    if k not in result["substats"]:
                        result["substats"].append(k)
            break

    return result


# Palavras que NÃO são nomes de talento
TALENT_INVALID_WORDS = {
    "since", "the", "this", "for", "if", "a", "an", "and", "but", "with",
    "without", "leveling", "you", "your", "her", "his", "their", "their",
    "these", "those", "note", "however", "while", "when", "as", "at", "by",
    "from", "of", "to", "in", "on", "over", "under", "level", "levels",
}

VALID_TALENTS = {"normal", "skill", "burst"}


def parse_talent_priority(section: str) -> str | None:
    # 1) "Normal > Skill > Burst" / "Burst ≥ Skill = ..."
    m = re.search(
        r'(Normal(?: Attack)?|Skill|Burst)'
        r'(?:\s*[>≥=]\s*(Normal(?: Attack)?|Skill|Burst)){1,2}',
        section,
        re.IGNORECASE,
    )
    if m:
        full = m.group(0)
        full = re.sub(r'Normal\s*Attack', 'Normal', full, flags=re.IGNORECASE)
        full = re.sub(r'\s*[>≥=]\s*', ' > ', full)
        return full

    # 2) Fallback: "Talent Priority" seguido de algo válido
    m2 = re.search(
        r'Talent Priority[\s\n]+([A-Z][A-Za-z]+(?:\s*[>≥=]\s*[A-Z][A-Za-z]+)*)',
        section,
    )
    if m2:
        candidate = m2.group(1).strip()
        first_word = candidate.split()[0].lower()
        if first_word in TALENT_INVALID_WORDS:
            return None
        if not any(t in candidate.lower() for t in VALID_TALENTS):
            return None
        return candidate

    return None


# ===== COMBOS =====
COMBO_PREFIX = re.compile(r'^(?:C\d+\+?:\s*)?')
VALID_COMBO_TOKEN = re.compile(r'(tE|hE|N\d|N\d\(|Q\b|E\b|D\b|C\d|\[|\])')


def parse_combos(section: str) -> list[str]:
    combos = []
    NOISE_PREFIXES = (
        "note ", "notes ", "click ", "if ", "you ", "this ", "these ",
        "the ", "a ", "an ", "while ", "for ", "use ", "make ", "when ",
    )
    for line in section.splitlines():
        line = line.strip()
        if not line:
            continue
        line = COMBO_PREFIX.sub('', line)
        combo = line.split('\t')[0].strip()
        if not combo or len(combo) > 90:
            continue
        if '>' in combo or '. ' in combo:
            continue
        if not VALID_COMBO_TOKEN.search(combo):
            continue
        if not re.match(r'^[a-zA-Z]', combo):
            continue
        if combo.lower().startswith(NOISE_PREFIXES):
            continue
        if len(re.findall(r'\b[a-z]{4,}\b', combo.lower())) > 2:
            continue
        # Split "N2C and N3C" em 2 combos
        if ' and ' in combo.lower():
            for part in re.split(r'\s+and\s+', combo, flags=re.IGNORECASE):
                part = part.strip()
                if part and part not in combos:
                    combos.append(part)
            continue
        if combo not in combos:
            combos.append(combo)
    return combos


# ===== TEAMS =====
DASH = '[—–]'  # em-dash ou en-dash

TEAM_LINE = re.compile(
    rf'^(?P<team>[A-Z][a-zA-Z]+[^\n]*?{DASH}[^\n]*{DASH}[^\n]*{DASH}[^\n]+)$',
    re.MULTILINE,
)

# Templates do KQM ("Furina — Pyro — Pyro/Hydro — Flex/Healer")
PLACEHOLDER_SLUGS = {
    "flex", "healer", "buffer", "shielder", "subdps", "maindps",
    "pyro", "hydro", "cryo", "electro", "anemo", "geo", "dendro",
    "character", "dps", "support",
}


def parse_teams(*sections: str) -> list[dict]:
    text = "\n\n".join(sections)
    teams, seen = [], set()
    for m in TEAM_LINE.finditer(text):
        raw = m.group("team")
        parts = [p.strip() for p in re.split(rf'\s*{DASH}\s*', raw) if p.strip()]
        if not (3 <= len(parts) <= 4):
            continue
        primary = [clean_char_name(p.split('/')[0].strip()) for p in parts]
        slugs = [to_slug(p) for p in primary if to_slug(p)]
        if len(slugs) < 3:
            continue
        if any(s in PLACEHOLDER_SLUGS for s in slugs):
            continue
        key = tuple(sorted(slugs))
        if key in seen:
            continue
        seen.add(key)
        teams.append({
            "character_slugs": slugs,
            "main_character": slugs[0],
            "raw_line": collapse_ws(raw),
        })
    return teams


def _dedup_teams(teams: list[dict]) -> list[dict]:
    seen = set()
    out = []
    for t in teams:
        key = tuple(sorted(t["character_slugs"]))
        if key in seen:
            continue
        seen.add(key)
        out.append(t)
    return out


def parse_guide(text: str, char_slug: str) -> dict:
    sections = split_sections(text)

    print(f"   [debug] seções: {', '.join(f'{k}({len(v)})' for k, v in sections.items() if len(v) > 5)}")

    weapons = parse_weapons(sections.get("Weapons", ""))
    stats = parse_stats(sections.get("Artifact Stats", sections.get("Artifacts", "")))
    four, two = parse_artifacts(sections.get("Artifact Sets", sections.get("Artifacts", "")))
    talent_priority = parse_talent_priority(sections.get("Talents", ""))

    combos_section = (
        sections.get("Full Combos", "")
        or sections.get("Attack Strings", "")
        or sections.get("Combos", "")
        or sections.get("Combo Notation", "")
    )
    combos = parse_combos(combos_section)[:10]

    # NEW: coleta TODAS as seções "Example Teams" (Furina tem 5)
    all_teams = []
    for sec in find_all_sections(text, "Example Teams"):
        all_teams.extend(parse_teams(sec))
    for sec in find_all_sections(text, "Limited Roster Alternatives"):
        all_teams.extend(parse_teams(sec))
    teams = _dedup_teams(all_teams)

    print(f"   [debug] talent_priority={talent_priority!r}")
    print(f"   [debug] sands={stats['sands']} goblet={stats['goblet']} circlet={stats['circlet']}")
    print(f"   [debug] substats={stats['substats']}")
    print(f"   [debug] combos={combos}")
    print(f"   [debug] Example Teams seções encontradas: {len(find_all_sections(text, 'Example Teams'))}")

    kqm_url = f"https://keqingmains.com/{char_slug}/"
    references = [{
        "url": kqm_url,
        "title": f"KQM {char_slug.replace('-', ' ').title()} Guide",
    }]

    return {
        "character_slug": char_slug,
        "build": {
            "name": "KQM Build",
            "build_data": {
                "weapons": weapons[:12],
                "artifacts_4pc": four[:5],
                "artifacts_2pc": two[:5],
                "sands_stat": stats["sands"],
                "goblet_stat": stats["goblet"],
                "circlet_stat": stats["circlet"],
                "substat_priority": stats["substats"],
                "er_requirement": None,
                "talent_priority": talent_priority,
                "combos": combos,
                "notes": None,
                "references": references,
            },
        },
        "teams": teams,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input", type=Path)
    ap.add_argument("--output", type=Path, default=Path("data/parsed"))
    args = ap.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    print(f"📁 Output: {args.output.resolve()}")

    files = [args.input] if args.input.is_file() else sorted(args.input.glob("*.txt"))
    if not files:
        print(f"❌ Nenhum .txt encontrado em {args.input}")
        return

    for path in files:
        slug = path.stem
        print(f"\n📄 Processando {path.name}...")
        try:
            result = parse_guide(path.read_text(encoding="utf-8"), slug)
        except Exception as e:
            print(f"❌ {path.name}: {e}")
            continue

        (args.output / f"{slug}-build.json").write_text(
            json.dumps({"character_slug": slug, "build": result["build"]},
                       indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        (args.output / f"{slug}-teams.json").write_text(
            json.dumps(result["teams"], indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        b = result["build"]["build_data"]
        print(
            f"✅ {slug}: {len(b['weapons'])} armas, "
            f"{len(b['artifacts_4pc'])} sets 4pc, "
            f"{len(b['combos'])} combos, "
            f"{len(result['teams'])} times"
        )


if __name__ == "__main__":
    main()
