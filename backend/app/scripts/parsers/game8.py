"""Parser para guias .txt copiados do Game8 (game8.co/games/Genshin-Impact).

Extrai no formato JSON canônico usado por `parse_guides.py` e `import_guides.py`:
  - weapons (seção ranqueada com qualquer rótulo de tier + resumo + tabela All/Other Weapons)
  - artifacts_4pc (seção ranqueada com qualquer rótulo de tier + resumo)
  - stats (Sands, Goblet, Circlet, Substats) + er_requirement (Goal Stat Values)
  - talent_priority (1st > 2nd > 3rd)
  - notable_teammates (tabela 'Notable Teammates' -> Alternative / Explanation)
  - teams (Best Team Comps multi-linha com substitutos empilhados por coluna + General Team Comps + inferência 3/4)
  - tier_ratings (Main DPS / Sub-DPS / Support / Exploration)
"""
import re
from ..parse_kqm_guide import (
    collapse_ws,
    parse_stat_cell,
    to_slug,
    to_stat_keys,
    strip_parentheses,
)


_TALENT_MAP = {
    "normal attack": "Normal",
    "normal": "Normal",
    "elemental skill": "Skill",
    "skill": "Skill",
    "elemental burst": "Burst",
    "burst": "Burst",
}

_HOW_TO_GET = {"gacha", "battle pass", "crafted", "event", "fishing", "shop", "quest", "free"}


def _clean_game8_item_line(line: str) -> str:
    """Extrai o nome limpo de linhas do Game8 nos formatos:
    - 'Genshin Impact - Tome of the Eternal Flow Image Tome of the Eternal Flow'
    - 'Genshin - Marechaussee Hunter ImageMarechaussee Hunter'
    - 'Genshin Impact - Surf Surf's Up'
    - 'Genshin - NeuvilletteNeuvillette'
    - 'The Dockhand The Dockhand's Assistant'
    """
    s = line.strip()
    if not s:
        return ""
    if "Image" in s:
        after = s.rsplit("Image", 1)[1].strip()
        if after:
            return after
    m = re.match(r'^Genshin(?:\s+Impact)?\s*-\s*(.+)$', s)
    if m:
        rest = m.group(1).strip()
    else:
        rest = s

    # Repetição exata colada: "NeuvilletteNeuvillette" ou "Lan YanLan Yan"
    if len(rest) % 2 == 0:
        half = len(rest) // 2
        if rest[:half] == rest[half:]:
            return rest[:half].strip()

    # Prefixo repetido com espaço: "Surf Surf's Up", "The Dockhand The Dockhand's Assistant"
    words = rest.split()
    for k in range(1, min(4, len(words))):
        prefix = " ".join(words[:k]).lower()
        tail = " ".join(words[k:])
        if tail.lower().startswith(prefix):
            return tail.strip()

    return rest


def _parse_stat_text(raw: str) -> list[str]:
    cleaned = re.sub(
        r'\b(Hydro|Pyro|Cryo|Electro|Anemo|Geo|Dendro|Physical)\s+DMG%',
        r'\1 DMG',
        raw,
        flags=re.IGNORECASE,
    )
    cleaned = re.sub(r'Healing\s+Bonus%', 'Healing Bonus', cleaned, flags=re.IGNORECASE)
    cleaned = cleaned.replace("/", ",")
    return parse_stat_cell(cleaned)


def _trim_at_footer(text: str) -> str:
    """Corta seções de comentários/lista de todos os personagens no rodapé."""
    for marker in (
        "\nGenshin Impact Related Guides\n",
        "\nAll Playable Characters\n",
        "\nComment\n",
    ):
        idx = text.find(marker)
        if idx != -1:
            return text[:idx]
    return text


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


def _is_game8_asset_line(line: str) -> bool:
    s = line.strip()
    return bool(re.match(r'^Genshin(?:\s+Impact)?\s*-\s*.+\bImage\b', s))


def _is_tier_header_line(lines: list[str], idx: int) -> bool:
    """Detecta rótulos de linha de tabela (Best-in-Slot, Alternative, F2P (Event), For ATK Buffs, etc.)
    seguidos imediatamente por uma linha de asset do Game8."""
    s = lines[idx].strip()
    if not s or len(s) > 40 or s.endswith('.') or '\t' in s or 'Image' in s:
        return False
    if s.startswith(("Best Weapons for", "Best Artifact Sets for", "All Recommended", "Other ", "List of ")):
        return False
    j = idx + 1
    while j < len(lines) and not lines[j].strip():
        j += 1
    return j < len(lines) and _is_game8_asset_line(lines[j])


def parse_tier_ratings(text: str) -> dict[str, str]:
    """Extrai 'Tier List Rankings' (Main DPS / Sub-DPS / Support / Exploration)."""
    lines = text.splitlines()
    for i, line in enumerate(lines):
        if line.strip() == "Tier List Rankings" and i + 2 < len(lines):
            headers = [h.strip() for h in lines[i + 1].split("\t") if h.strip()]
            values = [v.strip() for v in lines[i + 2].split("\t") if v.strip()]
            out = {}
            for h, v in zip(headers, values):
                if v and v != "-":
                    out[h] = v
            return out
    return {}


def parse_er_requirement(text: str) -> str | None:
    """Extrai 'Energy Recharge\t180% or above' de 'Goal Stat Values'."""
    for line in text.splitlines():
        if line.startswith("Energy Recharge\t"):
            val = line.split("\t", 1)[1].strip()
            if val:
                return val
    return None


def parse_talent_priority(text: str) -> str | None:
    lines = [l.strip() for l in text.splitlines()]
    for i, line in enumerate(lines):
        if line == "1st\t2nd\t3rd" and i + 1 < len(lines):
            cols = [c.strip() for c in lines[i + 1].split("\t") if c.strip()]
            mapped = [_TALENT_MAP.get(c.lower(), c) for c in cols]
            if mapped:
                return " > ".join(mapped)
    return None


def parse_weapons(text: str) -> list[dict]:
    weapons: list[dict] = []
    seen: set[str] = set()

    def _add(name: str, notes: str = "", rarity: int = 5):
        clean = strip_parentheses(name).strip()
        slug = to_slug(clean)
        if not slug or len(clean) < 3 or slug in seen:
            return
        seen.add(slug)
        weapons.append({
            "weapon_slug": slug,
            "weapon_name": clean,
            "rarity": rarity,
            "notes": collapse_ws(notes)[:250] if notes else None,
        })

    # 1) Seção "Best Weapons" ranqueada (qualquer rótulo seguido por asset Game8)
    wpn_sec = _slice_between(
        text,
        r'^Best Weapons for [^\n]+\s*$',
        [r'^Recommended Weapons\tHow to Get\s*$', r'^[^\n]+ Best Artifacts\s*$', r'^List of All .* Weapons\s*$'],
    )
    if wpn_sec:
        lines = [l.strip() for l in wpn_sec.splitlines()]
        i = 0
        while i < len(lines):
            if _is_tier_header_line(lines, i):
                tier_label = lines[i]
                i += 1
                while i < len(lines) and not lines[i]:
                    i += 1
                if i < len(lines):
                    wname = _clean_game8_item_line(lines[i])
                    i += 1
                    desc_parts = []
                    while i < len(lines) and not _is_tier_header_line(lines, i):
                        if lines[i].startswith(("All Recommended Weapons", "Other ", "List of All ")):
                            break
                        if lines[i]:
                            desc_parts.append(lines[i])
                        i += 1
                    note = f"[{tier_label}] " + " ".join(desc_parts) if desc_parts else tier_label
                    _add(wname, note)
                    continue
            i += 1

    # 2) Tabela "Best Weapon\tAlternative Weapons" no resumo de build
    build_sec = _slice_between(
        text,
        r'^Best Weapon\tAlternative Weapons\s*$',
        [r'^Best Artifact\tArtifact Stats\s*$', r'^[^\n]+ Talent Priority\s*$'],
    )
    if build_sec:
        for line in build_sec.splitlines():
            line = line.strip()
            if not line:
                continue
            wname = _clean_game8_item_line(line)
            _add(wname, "Recomendada na build principal (Game8)")

    # 3) Tabela "Recommended Weapons\tHow to Get"
    all_sec = _slice_between(
        text,
        r'^Recommended Weapons\tHow to Get\s*$',
        [r'^List of All .* Weapons\s*$', r'^[^\n]+ Best Artifacts\s*$'],
    )
    if all_sec:
        lines = [l.strip() for l in all_sec.splitlines() if l.strip()]
        idx = 0
        while idx < len(lines):
            raw = lines[idx]
            if raw.lower() in _HOW_TO_GET:
                idx += 1
                continue
            next_is_how = idx + 1 < len(lines) and lines[idx + 1].lower() in _HOW_TO_GET
            if "Image" in raw or next_is_how:
                wname = _clean_game8_item_line(raw)
                how = lines[idx + 1] if next_is_how else ""
                note = f"Fonte: {how} (Game8)" if how else "Recomendada (Game8)"
                _add(wname, note, rarity=4 if how.lower() in ("crafted", "battle pass", "event", "fishing") else 5)
                idx += 2 if next_is_how else 1
            else:
                idx += 1

    return weapons


def parse_artifacts(text: str) -> tuple[list[dict], list[dict]]:
    four: list[dict] = []
    seen: set[str] = set()

    def _add(name: str, notes: str = ""):
        clean = strip_parentheses(name).strip()
        slug = to_slug(clean)
        if not slug or len(clean) < 3 or slug in seen:
            return
        seen.add(slug)
        four.append({
            "artifact_set_slug": slug,
            "artifact_set_name": clean,
            "notes": collapse_ws(notes)[:250] if notes else None,
        })

    # 1) Seção ranqueada "Best Artifact Sets for ..."
    art_sec = _slice_between(
        text,
        r'^Best Artifact Sets for [^\n]+\s*$',
        [r'^[^\n]+ Artifact Stat Priority\s*$', r'^List of Artifacts'],
    )
    if art_sec:
        lines = [l.strip() for l in art_sec.splitlines()]
        i = 0
        while i < len(lines):
            if _is_tier_header_line(lines, i):
                label = lines[i]
                i += 1
                while i < len(lines) and not lines[i]:
                    i += 1
                if i < len(lines):
                    aname = _clean_game8_item_line(lines[i])
                    i += 1
                    desc_parts = []
                    while i < len(lines) and not _is_tier_header_line(lines, i):
                        if lines[i]:
                            desc_parts.append(lines[i])
                        i += 1
                    note = f"[{label}] " + " ".join(desc_parts) if desc_parts else label
                    _add(aname, note)
                    continue
            i += 1

    # 2) Fallback: resumo "Best Artifact\tArtifact Stats" e "Alternate Artifact(s)"
    summary_sec = _slice_between(
        text,
        r'^Best Artifact\tArtifact Stats\s*$',
        [r'^General Team Comps\s*$', r'^[^\n]+ Talent Priority\s*$'],
    )
    if summary_sec:
        for line in summary_sec.splitlines():
            s = line.strip()
            if "Image" in s and not any(k in s for k in ("Hourglass", "Goblet", "Circlet")):
                _add(_clean_game8_item_line(s), "Recomendado na build principal (Game8)")

    return four, []


def parse_stats(text: str) -> dict:
    result = {"sands": [], "goblet": [], "circlet": [], "substats": []}
    lines = [l.strip() for l in text.splitlines()]

    # 1) Resumo: "Genshin - HourglassSands: HP%"
    for line in lines:
        if "Sands:" in line and not result["sands"]:
            result["sands"] = _parse_stat_text(line.split("Sands:", 1)[1])
        elif "Goblet:" in line and not result["goblet"]:
            result["goblet"] = _parse_stat_text(line.split("Goblet:", 1)[1])
        elif "Circlet:" in line and not result["circlet"]:
            result["circlet"] = _parse_stat_text(line.split("Circlet:", 1)[1])

    # 2) Seção "Stat Priority"
    for i, line in enumerate(lines):
        if line == "Genshin - Hourglass" and i + 1 < len(lines) and not result["sands"]:
            result["sands"] = _parse_stat_text(lines[i + 1])
        elif line == "Genshin - Goblet" and i + 1 < len(lines) and not result["goblet"]:
            result["goblet"] = _parse_stat_text(lines[i + 1])
        elif line == "Genshin - Circlet" and i + 1 < len(lines) and not result["circlet"]:
            result["circlet"] = _parse_stat_text(lines[i + 1])

    # 3) Substats: prefere linha "Substats:" (com '>'), fallback para lista numerada
    for i, line in enumerate(lines):
        if line == "Substats:" and i + 1 < len(lines):
            raw = lines[i + 1]
            raw = re.sub(r'[>=]+', ',', raw)
            for p in raw.split(','):
                p = strip_parentheses(p.strip())
                for k in to_stat_keys(p):
                    if k not in result["substats"]:
                        result["substats"].append(k)
            break

    if not result["substats"]:
        for i, line in enumerate(lines):
            if line == "Artifact Sub Stats":
                j = i + 1
                while j < len(lines) and re.match(r'^\d+\.\s+', lines[j]):
                    raw = strip_parentheses(re.sub(r'^\d+\.\s+', '', lines[j]).strip())
                    for k in to_stat_keys(raw):
                        if k not in result["substats"]:
                            result["substats"].append(k)
                    j += 1
                break

    return result


def parse_notable_teammates(text: str) -> list[dict]:
    """Extrai a tabela 'Notable Teammates' do Game8:
      Alternative\tExplanation
      Genshin - NeuvilletteNeuvillette\tDPS
      Neuvillette and Furina benefit each other...
    """
    sec = _slice_between(
        text,
        r'^Notable Teammates\s*$',
        [r'^[^\n]+ Constellations\s*$', r'^[^\n]+ Ascension and Talent Materials\s*$'],
    )
    if not sec:
        return []

    lines = [l.strip() for l in sec.splitlines() if l.strip()]
    teammates: list[dict] = []
    seen: set[str] = set()
    i = 0
    while i < len(lines):
        line = lines[i]
        if "\t" in line and re.match(r'^Genshin(?:\s+Impact)?\s*-', line):
            left, role = line.split("\t", 1)
            char_name = _clean_game8_item_line(left)
            slug = to_slug(char_name)
            role = role.strip() or "Teammate"
            i += 1
            desc_parts = []
            while i < len(lines) and not ("\t" in lines[i] and re.match(r'^Genshin(?:\s+Impact)?\s*-', lines[i])):
                desc_parts.append(lines[i])
                i += 1
            if slug and slug not in seen:
                seen.add(slug)
                teammates.append({
                    "character_slug": slug,
                    "character_name": char_name,
                    "category": role,
                    "notes": collapse_ws(" ".join(desc_parts))[:220],
                })
            continue
        i += 1
    return teammates


def _parse_image_strip_team(line: str) -> list[str]:
    """Parseia linha 'Genshin - Neuvillette ImageGenshin - Escoffier Image...' -> ['neuvillette', ...]"""
    matches = re.findall(r'Genshin(?:\s+Impact)?\s*-\s*([A-Za-z0-9 \'-]+?)\s+Image', line)
    slugs: list[str] = []
    for name in matches:
        s = to_slug(name.strip())
        if s and s not in slugs:
            slugs.append(s)
    return slugs


def _parse_multiline_team_table(block_lines: list[str]) -> tuple[list[str], dict[str, list[str]]]:
    """Parseia uma tabela de 4 colunas do Game8 onde células podem ter vários chars empilhados
    separados por newline e colunas separadas por '\\t'.

    Ex.:
      Genshin - FurinaFurina\tGenshin - XilonenXilonen
      Genshin - ShinobuShinobu\tGenshin - KazuhaKazuha
      Genshin - SucroseSucrose\tGenshin - WriothesleyWriothesley
      Genshin - NeuvilletteNeuvillette
    Split por '\\t' gera 4 células:
      [Furina], [Xilonen, Shinobu], [Kazuha, Sucrose], [Wriothesley, Neuvillette]
    """
    joined = "\n".join(block_lines)
    raw_cells = joined.split("\t")
    if not (3 <= len(raw_cells) <= 4):
        return [], {}

    primary_slugs: list[str] = []
    slot_alternatives: dict[str, list[str]] = {}

    for pos, cell in enumerate(raw_cells, start=1):
        cell_lines = [l.strip() for l in cell.splitlines() if l.strip()]
        cell_slugs: list[str] = []
        for cl in cell_lines:
            if not re.match(r'^Genshin(?:\s+Impact)?\s*-', cl):
                continue
            name = _clean_game8_item_line(cl)
            s = to_slug(name)
            if s and s not in cell_slugs:
                cell_slugs.append(s)
        if not cell_slugs:
            return [], {}
        primary_slugs.append(cell_slugs[0])
        if len(cell_slugs) > 1:
            slot_alternatives[str(pos)] = cell_slugs[1:]

    # Remove alternativas que já estão nos slots primários
    primary_set = set(primary_slugs)
    cleaned_alts = {
        k: [s for s in alts if s not in primary_set]
        for k, alts in slot_alternatives.items()
    }
    cleaned_alts = {k: v for k, v in cleaned_alts.items() if v}
    return primary_slugs, cleaned_alts


def _infer_sibling_alternatives(teams: list[dict]) -> None:
    """Quando 2 times do MESMO guia compartilham 3 de 4 personagens, o 4º personagem
    de um time é uma alternativa curada pelo próprio guia para o 4º do outro!"""
    for i, t1 in enumerate(teams):
        s1 = t1["character_slugs"]
        if len(s1) != 4:
            continue
        set1 = set(s1)
        for j, t2 in enumerate(teams):
            if i == j:
                continue
            s2 = t2["character_slugs"]
            if len(s2) != 4:
                continue
            set2 = set(s2)
            diff1 = set1 - set2
            diff2 = set2 - set1
            if len(diff1) == 1 and len(diff2) == 1:
                only1 = next(iter(diff1))
                only2 = next(iter(diff2))
                pos = s1.index(only1) + 1
                if pos == 1:
                    continue
                bucket = t1.setdefault("slot_alternatives", {}).setdefault(str(pos), [])
                if only2 not in bucket:
                    bucket.append(only2)


def parse_teams(text: str) -> list[dict]:
    teams: list[dict] = []
    by_key: dict[tuple[str, ...], dict] = {}

    def _add_team(
        slugs: list[str],
        raw_name: str,
        summary: str | None = None,
        slot_alts: dict[str, list[str]] | None = None,
    ):
        if len(slugs) < 3:
            return
        slot_alts = slot_alts or {}
        key = tuple(sorted(slugs))
        if key in by_key:
            existing = by_key[key]
            if summary and not existing.get("description"):
                existing["description"] = summary
            for k, alts in slot_alts.items():
                cur = existing.setdefault("slot_alternatives", {}).setdefault(k, [])
                for s in alts:
                    if s not in cur:
                        cur.append(s)
            return
        pretty = " — ".join(s.replace("-", " ").title() for s in slugs)
        entry = {
            "character_slugs": slugs,
            "main_character": slugs[0],
            "raw_line": raw_name or pretty,
            "description": summary,
            "slot_alternatives": dict(slot_alts),
        }
        by_key[key] = entry
        teams.append(entry)

    # 1) Seção detalhada "{Char} Best Team Comps" (suporta células multi-linha com substitutos!)
    comp_sec = _slice_between(
        text,
        r'^[^\n]+ Best Team Comps\s*$',
        [r'^Notable Teammates\s*$', r'^[^\n]+ Constellations\s*$', r'^[^\n]+ Ascension and Talent Materials\s*$'],
    )
    if comp_sec:
        lines = [l.strip() for l in comp_sec.splitlines()]
        i = 0
        while i < len(lines):
            if re.match(r'^Genshin(?:\s+Impact)?\s*-', lines[i]) and "\t" in lines[i]:
                title = lines[i - 1] if i > 0 and lines[i - 1] and "\t" not in lines[i - 1] else ""
                block = []
                while i < len(lines) and re.match(r'^Genshin(?:\s+Impact)?\s*-', lines[i]):
                    block.append(lines[i])
                    i += 1
                slugs, slot_alts = _parse_multiline_team_table(block)
                summary = None
                if i + 1 < len(lines) and lines[i] == "Team Summary":
                    summary = collapse_ws(lines[i + 1])[:300]
                if slugs:
                    pretty_line = " — ".join(s.replace("-", " ").title() for s in slugs)
                    raw_label = f"{title} ({pretty_line})" if title else pretty_line
                    _add_team(slugs, raw_label[:150], summary, slot_alts)
                continue
            i += 1

    # 2) Bloco "General Team Comps" no topo (pode conter variações extras!)
    gen_sec = _slice_between(
        text,
        r'^General Team Comps\s*$',
        [r'^[^\n]+ Talent Priority\s*$', r'^[^\n]+ Best Weapons\s*$'],
    )
    if gen_sec:
        lines = [l.strip() for l in gen_sec.splitlines()]
        for i, line in enumerate(lines):
            if "Image" in line and line.count("Genshin") >= 3:
                slugs = _parse_image_strip_team(line)
                if slugs:
                    desc = lines[i + 1] if i + 1 < len(lines) and "Image" not in lines[i + 1] else None
                    pretty_line = " — ".join(s.replace("-", " ").title() for s in slugs)
                    _add_team(slugs, pretty_line, collapse_ws(desc)[:300] if desc else None)

    _infer_sibling_alternatives(teams)
    return teams


def parse_guide(text: str, char_slug: str) -> dict:
    clean_text = _trim_at_footer(text)
    weapons = parse_weapons(clean_text)
    four, two = parse_artifacts(clean_text)
    stats = parse_stats(clean_text)
    talent_priority = parse_talent_priority(clean_text)
    er_requirement = parse_er_requirement(clean_text)
    notable_teammates = parse_notable_teammates(clean_text)
    teams = parse_teams(clean_text)
    tier_ratings = parse_tier_ratings(clean_text)

    source_url = "https://game8.co/games/Genshin-Impact"
    references = [{
        "url": source_url,
        "title": f"Game8 {char_slug.replace('-', ' ').title()} Build Guide",
    }]

    return {
        "source": "Game8",
        "source_slug": "game8",
        "source_url": source_url,
        "character_slug": char_slug,
        "tier_ratings": tier_ratings,
        "build": {
            "name": "Game8 Build",
            "build_data": {
                "weapons": weapons[:12],
                "artifacts_4pc": four[:5],
                "artifacts_2pc": two[:5],
                "sands_stat": stats["sands"],
                "goblet_stat": stats["goblet"],
                "circlet_stat": stats["circlet"],
                "substat_priority": stats["substats"],
                "er_requirement": er_requirement,
                "talent_priority": talent_priority,
                "combos": [],
                "notes": None,
                "references": references,
            },
        },
        "notable_teammates": notable_teammates,
        "teams": teams,
    }
