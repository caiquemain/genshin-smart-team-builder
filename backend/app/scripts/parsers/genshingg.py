"""Parser para guias .txt copiados do Genshin.gg (genshin.gg/characters/<slug>/).

Extrai no formato JSON canônico usado por `parse_guides.py` e `import_guides.py`:
  - weapons (ranking #1-#5 com refinamento R1-R5 quando indicado)
  - artifacts_4pc e artifacts_2pc (pares 2+2 explícitos!)
  - stats (Sands, Goblet, Circlet, Substats)
  - teams (título + 4 membros com sufixo de elemento removido)
"""
import re
from ..parse_kqm_guide import (
    collapse_ws,
    parse_stat_cell,
    strip_parentheses,
    to_slug,
    to_stat_keys,
)


_ELEMENT_SUFFIX = re.compile(r'(Pyro|Hydro|Cryo|Electro|Anemo|Geo|Dendro)$')
_REFINEMENT_SUFFIX = re.compile(r'\s+R([1-5])$')


def _slice_between(text: str, start_pat: str, end_pats: list[str]) -> str:
    m = re.search(start_pat, text, re.MULTILINE)
    if not m:
        return ""
    start = m.end()
    end = len(text)
    for ep in end_pats:
        em = re.search(ep, text[start:], re.MULTILINE)
        if em:
            end = min(end, start + em.start())
    return text[start:end].strip()


def _parse_stat_line(raw: str) -> list[str]:
    cleaned = raw.replace("/", ",")
    return parse_stat_cell(cleaned)


def parse_weapons(text: str) -> list[dict]:
    sec = _slice_between(
        text,
        r'^[^\n]+ Best Weapons\s*$',
        [r'^[^\n]+ Best Artifacts\s*$'],
    )
    if not sec:
        return []

    lines = [l.strip() for l in sec.splitlines() if l.strip()]
    weapons: list[dict] = []
    seen: set[str] = set()
    i = 0

    while i < len(lines):
        if lines[i].isdigit():
            rank = int(lines[i])
            i += 1
            block = []
            while i < len(lines) and not lines[i].isdigit():
                block.append(lines[i])
                i += 1
            if not block:
                continue
            raw_name = block[0]
            refinement_note = ""
            # Linha 2 costuma repetir o nome, às vezes com " R5" no final
            for b in block:
                rm = _REFINEMENT_SUFFIX.search(b)
                if rm:
                    refinement_note = f" R{rm.group(1)}"
                    break
            clean_name = _REFINEMENT_SUFFIX.sub("", raw_name).strip()
            slug = to_slug(clean_name)
            if slug and slug not in seen:
                seen.add(slug)
                weapons.append({
                    "weapon_slug": slug,
                    "weapon_name": strip_parentheses(clean_name),
                    "rarity": 5 if rank == 1 else 4,
                    "notes": f"Rank #{rank}{refinement_note} (Genshin.gg)".strip(),
                })
            continue
        i += 1

    return weapons


def parse_artifacts(text: str) -> tuple[list[dict], list[dict]]:
    sec = _slice_between(
        text,
        r'^[^\n]+ Best Artifacts\s*$',
        [r'^[^\n]+ Best Stats\s*$'],
    )
    if not sec:
        return [], []

    lines = [l.strip() for l in sec.splitlines() if l.strip()]
    four: list[dict] = []
    two: list[dict] = []
    seen_4: set[str] = set()
    seen_2: set[tuple[str, str]] = set()

    # Cada bloco começa com rank '1', '2', '3', '4', '5' (em linha sozinha), seguido por:
    # - 4pc: Name, Name, '4'
    # - 2+2: Name1, Name1, '2', Name2, Name2, '2'
    i = 0
    expected_rank = 1
    while i < len(lines):
        if lines[i] == str(expected_rank):
            rank = expected_rank
            expected_rank += 1
            i += 1
            sets_in_entry: list[tuple[str, int]] = []
            while i < len(lines) and lines[i] != str(expected_rank):
                # Coleta nomes até achar '4' ou '2'
                names = []
                while i < len(lines) and lines[i] not in ("2", "4") and lines[i] != str(expected_rank):
                    names.append(lines[i])
                    i += 1
                if i < len(lines) and lines[i] in ("2", "4"):
                    pieces = int(lines[i])
                    i += 1
                    if names:
                        sets_in_entry.append((names[0], pieces))
                else:
                    break

            if len(sets_in_entry) == 1 and sets_in_entry[0][1] == 4:
                name = sets_in_entry[0][0]
                slug = to_slug(name)
                if slug and slug not in seen_4:
                    seen_4.add(slug)
                    four.append({
                        "artifact_set_slug": slug,
                        "artifact_set_name": strip_parentheses(name),
                        "notes": f"Rank #{rank} (Genshin.gg)",
                    })
            elif len(sets_in_entry) == 2 and sets_in_entry[0][1] == 2 and sets_in_entry[1][1] == 2:
                n1, n2 = sets_in_entry[0][0], sets_in_entry[1][0]
                s1, s2 = to_slug(n1), to_slug(n2)
                pair_key = tuple(sorted((s1, s2)))
                if s1 and s2 and pair_key not in seen_2:
                    seen_2.add(pair_key)
                    two.append({
                        "set1_slug": s1,
                        "set1_name": strip_parentheses(n1),
                        "set2_slug": s2,
                        "set2_name": strip_parentheses(n2),
                        "notes": f"Rank #{rank} 2pc+2pc (Genshin.gg)",
                    })
            continue
        i += 1

    return four, two


def parse_stats(text: str) -> dict:
    sec = _slice_between(
        text,
        r'^[^\n]+ Best Stats\s*$',
        [r'^Character Builds by ', r'^Showcase\s*$', r'^Best [^\n]+ Teams\s*$'],
    )
    result = {"sands": [], "goblet": [], "circlet": [], "substats": []}
    if not sec:
        return result

    lines = [l.strip() for l in sec.splitlines() if l.strip()]
    for i, line in enumerate(lines):
        if line == "Sands:" and i + 1 < len(lines):
            result["sands"] = _parse_stat_line(lines[i + 1])
        elif line == "Goblet:" and i + 1 < len(lines):
            result["goblet"] = _parse_stat_line(lines[i + 1])
        elif line == "Circlet:" and i + 1 < len(lines):
            result["circlet"] = _parse_stat_line(lines[i + 1])
        elif line == "Substats:" and i + 1 < len(lines):
            raw = re.sub(r'[>=/]+', ',', lines[i + 1])
            for p in raw.split(','):
                p = strip_parentheses(p.strip())
                for k in to_stat_keys(p):
                    if k not in result["substats"]:
                        result["substats"].append(k)

    return result


def parse_teams(text: str) -> list[dict]:
    sec = _slice_between(
        text,
        r'^Best [^\n]+ Teams\s*$',
        [r'^[^\n]+ Talents\s*$', r'^[^\n]+ Passives\s*$'],
    )
    if not sec:
        return []

    lines = [l.strip() for l in sec.splitlines() if l.strip()]
    teams: list[dict] = []
    seen: set[tuple[str, ...]] = set()

    i = 0
    while i < len(lines):
        # Título do time não termina com elemento colado; próximas linhas terminam com Element
        if not _ELEMENT_SUFFIX.search(lines[i]):
            title = lines[i]
            j = i + 1
            slugs: list[str] = []
            while j < len(lines) and _ELEMENT_SUFFIX.search(lines[j]) and len(slugs) < 4:
                char_name = _ELEMENT_SUFFIX.sub("", lines[j]).strip()
                slug = to_slug(char_name)
                if slug and slug not in slugs:
                    slugs.append(slug)
                j += 1
            if len(slugs) >= 3:
                key = tuple(sorted(slugs))
                if key not in seen:
                    seen.add(key)
                    pretty = " — ".join(s.replace("-", " ").title() for s in slugs)
                    teams.append({
                        "character_slugs": slugs,
                        "main_character": slugs[0],
                        "raw_line": f"{collapse_ws(title)} ({pretty})"[:150],
                        "description": f"{collapse_ws(title)} — Genshin.gg",
                        "slot_alternatives": {},
                    })
                i = j
                continue
        i += 1

    return teams


def parse_guide(text: str, char_slug: str) -> dict:
    weapons = parse_weapons(text)
    four, two = parse_artifacts(text)
    stats = parse_stats(text)
    teams = parse_teams(text)

    source_url = f"https://genshin.gg/characters/{char_slug}/"
    references = [{
        "url": source_url,
        "title": f"Genshin.gg {char_slug.replace('-', ' ').title()} Build",
    }]

    return {
        "source": "Genshin.gg",
        "source_slug": "genshingg",
        "source_url": source_url,
        "character_slug": char_slug,
        "build": {
            "name": "Genshin.gg Build",
            "build_data": {
                "weapons": weapons[:12],
                "artifacts_4pc": four[:5],
                "artifacts_2pc": two[:5],
                "sands_stat": stats["sands"],
                "goblet_stat": stats["goblet"],
                "circlet_stat": stats["circlet"],
                "substat_priority": stats["substats"],
                "er_requirement": None,
                "talent_priority": None,
                "combos": [],
                "notes": None,
                "references": references,
            },
        },
        "notable_teammates": [],
        "teams": teams,
    }
