"""Parser para guias .txt copiados do GameWith (gamewith.net/genshin-impact/).

Extrai no formato JSON canônico usado por `parse_guides.py` e `import_guides.py`:
  - tier_ratings (Overall + On-Field / Off-Field / DPS / Support / Sustain)
  - weapons (Premium Weapons + Free-to-Play Friendly Weapons, incluindo empates na mesma linha)
  - artifacts_4pc e artifacts_2pc (tabela com estrelas ★)
  - stats (Sands, Goblet, Circlet, Substats) + er_requirement (Stat Goals)
  - talent_priority (ordenado pela contagem de ★)
  - teams (Best Team Comp principal + tabelas 2x2 de Other Team Comps + extração de 'switched out / replaced with')
"""
import re
from ..parse_kqm_guide import (
    collapse_ws,
    parse_stat_cell,
    strip_parentheses,
    to_slug,
    to_stat_keys,
)


_RANK_PREFIX = re.compile(r'^(?:Best(?:\s+F2P)?|\d+(?:st|nd|rd|th)(?:\s*\([^)]*\))?)$', re.IGNORECASE)
_STARS_RE = re.compile(r'★+')


def _dedup_gamewith_name(raw: str) -> str:
    """Limpa nomes duplicados do GameWith (alt text da imagem colado com o texto visível):
    - 'Splendor of Tranquil WatersSplendor of Tranquil Waters' -> 'Splendor of Tranquil Waters'
    - 'Tome Of The Eternal Flow Tome Of The Eternal Flow' -> 'Tome Of The Eternal Flow'
    - 'SerenitySerenity's Call' / 'SurfSurf's Up' / 'WandererWanderer's Troupe' -> 'Serenity's Call'
    - 'DahliaDahlia (C6)' -> 'Dahlia'
    - 'Golden TroupeAny Elemental Skill DMG' -> 'Golden Troupe'
    """
    s = raw.strip()
    if not s:
        return ""
    s = re.sub(r'\s*x[24]$', '', s, flags=re.IGNORECASE).strip()
    s = re.sub(r'\s*\(C\d+\+?\)', '', s).strip()
    s = re.sub(r'Any\s+[A-Z].*$', '', s).strip()

    # Prefixo colado antes de apóstrofo: "SerenitySerenity's Call", "NocturneNocturne's Curtain Call"
    m_ap = re.match(r"^([A-Za-z][A-Za-z\- ]{1,30}?)\1('s\b.*)$", s)
    if m_ap:
        return (m_ap.group(1) + m_ap.group(2)).strip()

    # Duplicação exata colada: "NeuvilletteNeuvillette" ou "Lan YanLan Yan"
    if len(s) % 2 == 0:
        half = len(s) // 2
        if s[:half].lower() == s[half:].lower():
            return s[half:].strip()

    # Duplicação exata separada por espaço: "Tome Of The Eternal Flow Tome Of The Eternal Flow"
    words = s.split()
    if len(words) >= 2 and len(words) % 2 == 0:
        mid = len(words) // 2
        if " ".join(words[:mid]).lower() == " ".join(words[mid:]).lower():
            return " ".join(words[mid:]).strip()

    return s


def _slice_after_article_start(text: str) -> str:
    """Pula o menu lateral gigante (linhas 1-264) e começa no artigo principal."""
    m = re.search(r'^Last Updated:\s+', text, re.MULTILINE)
    return text[m.start():] if m else text


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


def _parse_stat_text(raw: str) -> list[str]:
    cleaned = re.sub(r'\bCRIT\s+Rate\s+or\s+DMG\b', 'CRIT Rate, CRIT DMG', raw, flags=re.IGNORECASE)
    cleaned = cleaned.replace("/", ",")
    return parse_stat_cell(cleaned)


def parse_tier_ratings(text: str) -> dict[str, str]:
    ratings: dict[str, str] = {}
    lines = [l.strip() for l in text.splitlines()]
    for i, line in enumerate(lines):
        if line == "Overall Tier" and i + 1 < len(lines) and lines[i + 1]:
            ratings["Overall"] = lines[i + 1]
        elif line.startswith("On-Field\t") and i + 1 < len(lines):
            headers = [h.strip() for h in line.split("\t") if h.strip()]
            vals = [v.strip() for v in lines[i + 1].split("\t") if v.strip()]
            for h, v in zip(headers, vals):
                if v and v != "-":
                    ratings[h] = v
            break
    return ratings


def parse_er_requirement(text: str) -> str | None:
    for line in text.splitlines():
        if line.startswith("Energy Recharge\t"):
            val = line.split("\t", 1)[1].strip()
            if val:
                return val
    return None


def parse_talent_priority(text: str) -> str | None:
    sec = _slice_between(
        text,
        r"^[^\n]+'s Recommended Talent Priority\s*$",
        [r'^Related Links:', r'^Best Weapon for '],
    )
    if not sec:
        return None

    scores: list[tuple[int, str]] = []
    # Junta linhas quebradas como "O Tears, I Shall Repay\n(Elemental Skill)\t★★★・・"
    raw_lines = [l.strip() for l in sec.splitlines() if l.strip()]
    merged: list[str] = []
    for l in raw_lines:
        if l.startswith("Talent\t"):
            continue
        if "\t" in l and merged and "\t" not in merged[-1]:
            merged[-1] = merged[-1] + " " + l
        else:
            merged.append(l)

    for line in merged:
        if "\t" not in line:
            continue
        left, right = line.split("\t", 1)
        stars = len(_STARS_RE.findall(right)[0]) if _STARS_RE.search(right) else 0
        if stars == 0:
            continue
        low = left.lower()
        if "normal attack" in low:
            tname = "Normal"
        elif "elemental skill" in low:
            tname = "Skill"
        elif "elemental burst" in low:
            tname = "Burst"
        else:
            continue
        scores.append((stars, tname))

    if not scores:
        return None
    scores.sort(key=lambda x: -x[0])
    return " > ".join(t for _, t in scores)


def parse_weapons(text: str) -> list[dict]:
    sec = _slice_between(
        text,
        r'^Best Weapon for [^\n]+\s*$',
        [r'^All Weapon List\s*$', r'^[^\n]+ Best Artifacts\s*$'],
    )
    if not sec:
        return []

    weapons: list[dict] = []
    seen: set[str] = set()
    lines = [l.strip() for l in sec.splitlines() if l.strip()]

    # Recombina cabeçalhos quebrados em 2 linhas, ex.: "2nd\n(Forge)\tSerenity..." ou "2nd (Event/\nForge)\tAsh-Graven..."
    recombined: list[str] = []
    i = 0
    while i < len(lines):
        cur = lines[i]
        if (
            "\t" not in cur
            and i + 1 < len(lines)
            and "\t" in lines[i + 1]
            and (re.match(r'^\d+(?:st|nd|rd|th)', cur) or cur.endswith("/"))
        ):
            recombined.append(f"{cur} {lines[i + 1]}")
            i += 2
            continue
        recombined.append(cur)
        i += 1

    i = 0
    while i < len(recombined):
        line = recombined[i]
        if "\t" in line:
            parts = line.split("\t")
            rank_col = parts[0].strip()
            if _RANK_PREFIX.match(rank_col):
                # Pode ter 2 colunas ("2nd\tWeapon1") quando há empate na linha seguinte ("Weapon2\tHow to Get")
                # ou 3 colunas ("Best\tWeapon1\tHow to Get")
                w_names = [_dedup_gamewith_name(parts[1])]
                how = parts[2].strip() if len(parts) >= 3 else ""
                i += 1
                # Se só tinha 2 colunas, próxima linha tem a 2ª arma empatada + How to Get
                while i < len(recombined) and not recombined[i].startswith("-") and "\t" in recombined[i]:
                    p2 = recombined[i].split("\t")
                    if _RANK_PREFIX.match(p2[0].strip()):
                        break
                    w_names.append(_dedup_gamewith_name(p2[0]))
                    if len(p2) >= 2 and not how:
                        how = p2[1].strip()
                    i += 1
                # Pula linha extra de "How to Get" (ex.: "Natlan Forgeable (Craftable) Weapon")
                while (
                    i < len(recombined)
                    and not recombined[i].startswith("-")
                    and "\t" not in recombined[i]
                    and any(k in recombined[i] for k in ("Weapon", "Banner", "Event", "Battle Pass", "Forgeable"))
                ):
                    i += 1
                # Coleta bullets de detalhes ("- ...")
                bullets = []
                while i < len(recombined) and recombined[i].startswith("-"):
                    bullets.append(recombined[i].lstrip("- ").strip())
                    i += 1

                note_prefix = f"[{rank_col}]"
                if how:
                    note_prefix += f" {how}."
                note = collapse_ws(f"{note_prefix} {' '.join(bullets)}")[:250]
                is_f2p = "f2p" in rank_col.lower() or any(k in how.lower() for k in ("craftable", "forge", "event", "battle pass"))
                for wn in w_names:
                    clean = strip_parentheses(wn).strip()
                    slug = to_slug(clean)
                    if slug and len(clean) >= 3 and slug not in seen:
                        seen.add(slug)
                        weapons.append({
                            "weapon_slug": slug,
                            "weapon_name": clean,
                            "rarity": 4 if is_f2p else 5,
                            "notes": note,
                        })
                continue
        i += 1

    return weapons


def parse_artifacts(text: str) -> tuple[list[dict], list[dict]]:
    sec = _slice_between(
        text,
        r'^[^\n]+ Best Artifacts\s*$',
        [r'^Recommended Artifact Stats\s*$', r'^Related Articles\s*$'],
    )
    if not sec:
        return [], []

    lines = [l.strip() for l in sec.splitlines() if l.strip()]
    four: list[dict] = []
    two: list[dict] = []
    seen_4: set[str] = set()
    seen_2: set[tuple[str, str]] = set()

    i = 0
    while i < len(lines):
        if "\t" in lines[i] and "★" in lines[i]:
            left, stars_col = lines[i].split("\t", 1)
            set_names = []
            # Se a linha anterior (sem tab, sem '-', sem header) também é um nome de set, é um par 2pc+2pc!
            if (
                i > 0
                and "\t" not in lines[i - 1]
                and not lines[i - 1].startswith("-")
                and lines[i - 1] not in ("Details", "Artifact")
                and not lines[i - 1].endswith(".")
                and len(lines[i - 1]) < 65
            ):
                set_names.append(_dedup_gamewith_name(lines[i - 1]))
            set_names.append(_dedup_gamewith_name(left))

            j = i + 1
            bullets = []
            while j < len(lines) and lines[j].startswith("-"):
                bullets.append(lines[j].lstrip("- ").strip())
                j += 1
            note = collapse_ws(" ".join(bullets))[:250] or f"{stars_col.strip()} (GameWith)"

            if len(set_names) == 2:
                s1, s2 = to_slug(set_names[0]), to_slug(set_names[1])
                pair_key = tuple(sorted((s1, s2)))
                if s1 and s2 and pair_key not in seen_2:
                    seen_2.add(pair_key)
                    two.append({
                        "set1_slug": s1,
                        "set1_name": set_names[0],
                        "set2_slug": s2,
                        "set2_name": set_names[1],
                        "notes": note,
                    })
            else:
                name = set_names[0]
                slug = to_slug(name)
                if slug and slug not in seen_4:
                    seen_4.add(slug)
                    four.append({
                        "artifact_set_slug": slug,
                        "artifact_set_name": name,
                        "notes": note,
                    })
            i = j
            continue
        i += 1

    return four, two


def parse_stats(text: str) -> dict:
    result = {"sands": [], "goblet": [], "circlet": [], "substats": []}
    lines = [l.strip() for l in text.splitlines()]

    # Prefere "Recommended Artifact Stats" (mais completo: "Goblet Icon\tMain: HP% or Hydro DMG Bonus")
    for line in lines:
        if line.startswith("Sands Icon\tMain:"):
            result["sands"] = _parse_stat_text(line.split("Main:", 1)[1])
        elif line.startswith("Goblet Icon\tMain:"):
            result["goblet"] = _parse_stat_text(line.split("Main:", 1)[1])
        elif line.startswith("Crown Icon\tMain:") or line.startswith("Circlet Icon\tMain:"):
            result["circlet"] = _parse_stat_text(line.split("Main:", 1)[1])

    # Fallback para o quadro "Best Build for ..."
    for line in lines:
        if "Sands:" in line and not result["sands"]:
            result["sands"] = _parse_stat_text(line.split("Sands:", 1)[1])
        elif line.startswith("Goblet:") and not result["goblet"]:
            result["goblet"] = _parse_stat_text(line.split("Goblet:", 1)[1])
        elif line.startswith("Circlet:") and not result["circlet"]:
            result["circlet"] = _parse_stat_text(line.split("Circlet:", 1)[1])
        elif line.startswith("Priority Sub-Stats\t"):
            raw = re.sub(r'[>=/]+', ',', line.split("\t", 1)[1])
            for p in raw.split(","):
                p = strip_parentheses(p.strip())
                for k in to_stat_keys(p):
                    if k not in result["substats"]:
                        result["substats"].append(k)

    return result


_REPLACE_MENTION = re.compile(
    r'\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)\s+can\s+be\s+(?:switched\s+out\s+for|replaced\s+(?:with|by))\s+([A-Z][a-zA-Z]+(?:\s+or\s+[A-Z][a-zA-Z]+)*)',
)


def _extract_prose_substitutes(slugs: list[str], prose: str) -> dict[str, list[str]]:
    """Extrai substitutos explícitos na descrição do time:
    ex.: 'Dahlia can be switched out for Yelan or Shenhe' -> {'4': ['yelan', 'shenhe']}.
    """
    alts: dict[str, list[str]] = {}
    primary_set = set(slugs)
    for m in _REPLACE_MENTION.finditer(prose):
        target_slug = to_slug(m.group(1))
        if target_slug not in slugs:
            continue
        pos = slugs.index(target_slug) + 1
        if pos == 1:
            continue
        raw_repls = re.split(r'\s*(?:,|/|\bor\b)\s*', m.group(2))
        for r in raw_repls:
            rs = to_slug(r.strip())
            if rs and rs not in primary_set:
                bucket = alts.setdefault(str(pos), [])
                if rs not in bucket:
                    bucket.append(rs)
    return alts


def parse_teams(text: str) -> list[dict]:
    sec = _slice_between(
        text,
        r'^Best Team Comp [^\n]+\s*$',
        [r'^Best Teams For [^\n]+\s*$', r'^Team Rotation of '],
    )
    if not sec:
        return []

    lines = [l.strip() for l in sec.splitlines() if l.strip()]
    teams: list[dict] = []
    seen: set[tuple[str, ...]] = set()

    def _add(title: str, slugs: list[str], desc: str):
        if len(slugs) < 3:
            return
        key = tuple(sorted(slugs))
        if key in seen:
            return
        seen.add(key)
        pretty = " — ".join(s.replace("-", " ").title() for s in slugs)
        raw_line = f"{collapse_ws(title)} ({pretty})"[:150] if title else pretty
        teams.append({
            "character_slugs": slugs,
            "main_character": slugs[0],
            "raw_line": raw_line,
            "description": collapse_ws(desc)[:300] if desc else None,
            "slot_alternatives": _extract_prose_substitutes(slugs, desc),
        })

    i = 0
    while i < len(lines):
        # 1) Tabela principal 4 colunas: "Role1\tRole2\tRole3\tRole4" seguido por "C1\tC2\tC3\tC4"
        if lines[i].count("\t") == 3 and i + 1 < len(lines) and lines[i + 1].count("\t") == 3:
            title = lines[i - 1] if i > 0 and "\t" not in lines[i - 1] else ""
            raw_chars = lines[i + 1].split("\t")
            slugs = [to_slug(_dedup_gamewith_name(c)) for c in raw_chars]
            slugs = [s for s in slugs if s]
            j = i + 2
            desc_parts = []
            while j < len(lines) and not lines[j].startswith("Other Team Comps") and lines[j] != "Team\tDetail":
                if lines[j] != "Details":
                    desc_parts.append(lines[j].lstrip("- ").strip())
                j += 1
            _add(title, slugs, " ".join(desc_parts))
            i = j
            continue

        # 2) Tabelas 2x2 de "Other Team Comps": "Team\tDetail"
        #    Row 1: "Char1\tChar2\t- bullet..."
        #    Bullets: "- ..."
        #    Row 2: "Char3\tChar4"
        if lines[i] == "Team\tDetail" and i + 1 < len(lines):
            title = lines[i - 1] if i > 0 and "\t" not in lines[i - 1] else ""
            j = i + 1
            parts = lines[j].split("\t")
            slugs: list[str] = []
            desc_parts: list[str] = []
            if len(parts) >= 2:
                slugs.extend(to_slug(_dedup_gamewith_name(c)) for c in parts[:2])
                if len(parts) >= 3:
                    desc_parts.append(parts[2].lstrip("- ").strip())
            j += 1
            while j < len(lines) and lines[j].startswith("-"):
                desc_parts.append(lines[j].lstrip("- ").strip())
                j += 1
            if j < len(lines) and lines[j].count("\t") == 1:
                slugs.extend(to_slug(_dedup_gamewith_name(c)) for c in lines[j].split("\t"))
                j += 1
            slugs = [s for s in slugs if s]
            _add(title, slugs, " ".join(desc_parts))
            i = j
            continue

        i += 1

    return teams


def parse_guide(text: str, char_slug: str) -> dict:
    body = _slice_after_article_start(text)
    weapons = parse_weapons(body)
    four, two = parse_artifacts(body)
    stats = parse_stats(body)
    talent_priority = parse_talent_priority(body)
    er_requirement = parse_er_requirement(body)
    teams = parse_teams(body)
    tier_ratings = parse_tier_ratings(body)

    source_url = "https://gamewith.net/genshin-impact/"
    references = [{
        "url": source_url,
        "title": f"GameWith {char_slug.replace('-', ' ').title()} Build Guide",
    }]

    return {
        "source": "GameWith",
        "source_slug": "gamewith",
        "source_url": source_url,
        "character_slug": char_slug,
        "tier_ratings": tier_ratings,
        "build": {
            "name": "GameWith Build",
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
        "notable_teammates": [],
        "teams": teams,
    }
