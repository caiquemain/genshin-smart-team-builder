#!/usr/bin/env python3
"""
parse_kqm_guide.py — Converte um guia .txt do KQM em JSON estruturado.
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


def split_sections(text: str) -> dict[str, str]:
    text = trim_at_toc(text)
    pattern = re.compile(
        r'^(' + '|'.join(re.escape(h) for h in SECTION_HEADERS) + r')\s*$',
        re.MULTILINE,
    )
    matches = list(pattern.finditer(text))
    sections = {}
    for i, m in enumerate(matches):
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        sections[m.group(1)] = text[start:end].strip()
    return sections


# ===== WEAPONS =====
WEAPON_BLOCK = re.compile(
    r'^(?P<tier>[1-5])★[ \t]+(?P<names>[^\n]+?)(?:\t+| {2,})(?P<desc>.+?)(?=\n[1-5]★|\n\n|\Z)',
    re.MULTILINE | re.DOTALL,
)

# Detecta "4★ Name" dentro da lista de nomes (mistura de raridades)
INLINE_TIER = re.compile(r'(?<![0-9])([1-5])★\s*')


def parse_weapons(section: str) -> list[dict]:
    weapons = []
    for m in WEAPON_BLOCK.finditer(section):
        block_tier = int(m.group("tier"))
        desc = collapse_ws(m.group("desc"))[:250]
        names_raw = m.group("names")

        # Verifica se há raridades inline (ex: "Summit Shaper, 4★ The Black Sword")
        inline_matches = list(INLINE_TIER.finditer(names_raw))
        if inline_matches:
            # Divide por posição dos marcadores de raridade
            for i, im in enumerate(inline_matches):
                tier = int(im.group(1))
                start = im.end()
                end = inline_matches[i + 1].start() if i + 1 < len(inline_matches) else len(names_raw)
                segment = names_raw[start:end].strip().rstrip(',').strip()
                for raw in split_respecting_parens(segment):
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


# ===== ARTIFACTS =====
ARTIFACT_LINE = re.compile(
    r'^(?P<pieces>[24])pc[ \t]+(?P<name>[^\n]+?)(?:\t+| {2,})(?P<desc>.+?)(?=\n[24]pc|\n\n|\Z)',
    re.MULTILINE | re.DOTALL,
)


def parse_artifacts(section: str) -> tuple[list, list]:
    four, two = [], []
    for m in ARTIFACT_LINE.finditer(section):
        pieces = int(m.group("pieces"))
        name = strip_parentheses(m.group("name"))
        slug = to_slug(name)
        desc = collapse_ws(m.group("desc"))[:250]
        entry = {"artifact_set_slug": slug, "artifact_set_name": name, "notes": desc}
        (four if pieces == 4 else two).append(entry)
    return four, two


# ===== STATS =====
STAT_ALIASES = {
    "atk%": "atk_pct", "atk": "atk_pct", "atk percent": "atk_pct", "flat atk": "atk_pct",
    "hp%": "hp_pct", "hp": "hp_pct", "flat hp": "hp_pct",
    "def%": "def_pct", "def": "def_pct",
    "em": "em", "elemental mastery": "em",
    "er": "er", "energy recharge": "er",
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
            raw = re.sub(r'[>]+', ',', raw)
            for p in raw.split(','):
                p = strip_parentheses(p.strip())
                for k in to_stat_keys(p):
                    if k not in result["substats"]:
                        result["substats"].append(k)
            break

    return result


def parse_talent_priority(section: str) -> str | None:
    m = re.search(
        r'Talent Priority[\s\n]+([A-Z][A-Za-z]+(?:\s*>\s*[A-Z][A-Za-z]+)+)',
        section,
    )
    if m:
        return re.sub(r'\s*>\s*', ' > ', m.group(1).strip())
    m2 = re.search(r'Talent Priority[\s\n]+([A-Z][A-Za-z]+)', section)
    return m2.group(1).strip() if m2 else None


# ===== COMBOS =====
# Combos que começam com letra ou "C2+:", e contém apenas tokens de combo
COMBO_PREFIX = re.compile(r'^(?:C\d+\+?:\s*)?')
COMBO_TOKEN = re.compile(r'^(?:[a-zA-Z]|[Nn]\d|[QEChHtE]\d?(?:\([^)]+\))?|\[|\]|\d|D|/)')

COMBO_RAW = re.compile(
    r'^(?:C\d+\+?:\s*)?(?P<combo>[a-zA-Z][a-zA-Z0-9 /()\[\]:+]{2,80}?)(?:\t+|$)(?P<desc>.*?)$',
    re.MULTILINE,
)

# Tokens válidos de combo do KQM
VALID_COMBO_TOKEN = re.compile(r'(tE|hE|N\d|N\d\(|Q\b|E\b|D\b|C\d|\[|\])')


def parse_combos(section: str) -> list[str]:
    combos = []
    # Frases que começam com palavras comuns (não são combos)
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
        # Bloqueia frases que começam com palavras comuns
        if combo.lower().startswith(NOISE_PREFIXES):
            continue
        # Heurística: no máximo 2 palavras longas em inglês/português
        if len(re.findall(r'\b[a-z]{4,}\b', combo.lower())) > 2:
            continue
        if combo not in combos:
            combos.append(combo)
    return combos


# ===== TEAMS =====
TEAM_LINE = re.compile(
    r'^(?P<team>[A-Z][a-zA-Z]+[^\n]*?—[^\n]*—[^\n]*—[^\n]+)$',
    re.MULTILINE,
)


def parse_teams(*sections: str) -> list[dict]:
    text = "\n\n".join(sections)
    teams, seen = [], set()
    for m in TEAM_LINE.finditer(text):
        raw = m.group("team")
        parts = [p.strip() for p in re.split(r'\s*—\s*', raw) if p.strip()]
        if not (3 <= len(parts) <= 4):
            continue
        primary = [clean_char_name(p.split('/')[0].strip()) for p in parts]
        slugs = [to_slug(p) for p in primary if to_slug(p)]
        if len(slugs) < 3:
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
    )
    combos = parse_combos(combos_section)[:10]

    teams = parse_teams(
        sections.get("Example Teams", ""),
        sections.get("Limited Roster Alternatives", ""),
    )

    print(f"   [debug] talent_priority={talent_priority!r}")
    print(f"   [debug] sands={stats['sands']} goblet={stats['goblet']} circlet={stats['circlet']}")
    print(f"   [debug] substats={stats['substats']}")
    print(f"   [debug] combos={combos}")

    return {
        "character_slug": char_slug,
        "build": {
            "name": "KQM Build",
            "build_data": {
                "weapons": weapons[:8],
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
