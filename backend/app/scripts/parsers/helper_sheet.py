"""Parser em lote para os CSVs da Genshin Impact Helper Team Character Builds Sheet.

Cada arquivo `<elemento>.csv` em `backend/data/sources/helper_sheet/` contém ~13–19 personagens
com papéis (o papel principal é marcado com '✩'), armas ranqueadas, artefatos 4pc/2+2pc,
main stats, substats, prioridade de talentos e notas/dicas de rotação.
"""
import csv
import io
import re
from ..parse_kqm_guide import (
    collapse_ws,
    parse_stat_cell,
    strip_parentheses,
    to_slug,
    to_stat_keys,
)


HELPER_SHEET_URL = (
    "https://docs.google.com/spreadsheets/d/"
    "1gNxZ2xab1J6o1TuNVWMeLOZ7TPOqrsf3SshP5DLvKzI"
)

_WEAPON_STAR_RE = re.compile(r'\(([1-5])[✩★\*]\)')
_REFINE_RE = re.compile(r'\[([^\]]+)\]')
_GENERIC_SET_RE = re.compile(r'^(?:\+?\d+%?|\+?\d+\s|any\s)', re.IGNORECASE)


def _normalize_char_slug(raw_name: str, element: str) -> str:
    name = raw_name.strip().lower()
    if name == "traveler" or name.startswith("traveler "):
        return f"traveler-{element.lower()}"
    return to_slug(raw_name)


def _parse_weapons_cell(cell: str) -> list[dict]:
    weapons: list[dict] = []
    seen: set[str] = set()
    conditional = False

    for raw_line in cell.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line.startswith("*"):
            # Notas de rodapé no fim da célula
            break
        if line.lower().startswith("conditional"):
            conditional = True
            continue

        # Remove prefixo de ranking ("1. ", "2. ", "≈ ", "= ")
        rank_m = re.match(r'^(\d+\.|[≈=])\s*(.+)$', line)
        rank_prefix = rank_m.group(1) if rank_m else ("Conditional" if conditional else "")
        body = rank_m.group(2).strip() if rank_m else line

        # Pula linhas sem marcador de raridade quando estamos em texto corrido/nota
        star_m = _WEAPON_STAR_RE.search(body)
        if not star_m and not rank_m:
            continue

        rarity = int(star_m.group(1)) if star_m else 4
        ref_m = _REFINE_RE.search(body)
        ref_note = f" {ref_m.group(1)}" if ref_m else ""

        # Limpa marcadores (5✩), [R5], asteriscos e notas parentéticas
        clean = _WEAPON_STAR_RE.sub("", body)
        clean = _REFINE_RE.sub("", clean)
        clean = clean.replace("*", "").strip()

        # Pode haver alternativas na mesma linha com " / "
        for part in re.split(r'\s+/\s+', clean):
            name = strip_parentheses(part).strip(" ,;:")
            if not name or name.lower().startswith(("any ", "choose ")):
                continue
            slug = to_slug(name)
            if not slug or len(name) < 3 or slug in seen:
                continue
            seen.add(slug)
            note = f"{rank_prefix}{ref_note} (Helper Sheet)".strip()
            weapons.append({
                "weapon_slug": slug,
                "weapon_name": name,
                "rarity": rarity,
                "notes": note,
            })

    return weapons


def _parse_artifacts_cell(cell: str) -> tuple[list[dict], list[dict]]:
    four: list[dict] = []
    two: list[dict] = []
    seen_4: set[str] = set()
    seen_2: set[tuple[str, str]] = set()
    conditional = False

    for raw_line in cell.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line.startswith("*"):
            break
        if line.lower().startswith("conditional"):
            conditional = True
            continue

        rank_m = re.match(r'^(\d+\.|[≈=])\s*(.+)$', line)
        rank_prefix = rank_m.group(1) if rank_m else ("Conditional" if conditional else "")
        body = rank_m.group(2).strip() if rank_m else line
        body = _REFINE_RE.sub("", body).replace("*", "").strip()

        # Caso 4pc explícito: "Emblem of Severed Fate (4)"
        m4 = re.match(r'^(.+?)\s*\(4\)\s*$', body)
        if m4:
            name = strip_parentheses(m4.group(1)).strip()
            if name and not _GENERIC_SET_RE.match(name):
                slug = to_slug(name)
                if slug and slug not in seen_4:
                    seen_4.add(slug)
                    four.append({
                        "artifact_set_slug": slug,
                        "artifact_set_name": name,
                        "notes": f"{rank_prefix} (Helper Sheet)".strip(),
                    })
            continue

        # Caso 2pc+2pc: "Noblesse Oblige (2) / Blizzard Strayer (2) / +18% ATK set (2)"
        if "(2)" in body:
            concrete_sets: list[tuple[str, str]] = []
            for part in re.split(r'\s*(?:/|\+)\s*', body):
                m2 = re.match(r'^(.+?)\s*\(2\)\s*$', part.strip())
                if not m2:
                    continue
                name = strip_parentheses(m2.group(1)).strip()
                if not name or _GENERIC_SET_RE.match(name) or " set" in name.lower():
                    continue
                slug = to_slug(name)
                if slug and all(s != slug for s, _ in concrete_sets):
                    concrete_sets.append((slug, name))
            if len(concrete_sets) >= 2:
                (s1, n1), (s2, n2) = concrete_sets[0], concrete_sets[1]
                pair_key = tuple(sorted((s1, s2)))
                if pair_key not in seen_2:
                    seen_2.add(pair_key)
                    two.append({
                        "set1_slug": s1,
                        "set1_name": n1,
                        "set2_slug": s2,
                        "set2_name": n2,
                        "notes": f"{rank_prefix} 2pc+2pc (Helper Sheet)".strip(),
                    })

    return four, two


def _clean_stat_value(raw: str) -> list[str]:
    s = raw.replace("*", "").strip()
    s = re.sub(r'\bCrit\s+Rate\s*/\s*DMG\b', 'Crit Rate, Crit DMG', s, flags=re.IGNORECASE)
    s = s.replace("/", ",")
    return parse_stat_cell(s)


def _parse_main_stats_cell(cell: str) -> tuple[list[str], list[str], list[str]]:
    sands, goblet, circlet = [], [], []
    for raw_line in cell.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("*"):
            continue
        low = line.lower()
        if low.startswith("sands"):
            val = re.split(r'\s*[-:]\s*', line, maxsplit=1)[1] if re.search(r'[-:]', line) else ""
            sands = _clean_stat_value(val)
        elif low.startswith("goblet"):
            val = re.split(r'\s*[-:]\s*', line, maxsplit=1)[1] if re.search(r'[-:]', line) else ""
            goblet = _clean_stat_value(val)
        elif low.startswith("circlet"):
            val = re.split(r'\s*[-:]\s*', line, maxsplit=1)[1] if re.search(r'[-:]', line) else ""
            circlet = _clean_stat_value(val)
    return sands, goblet, circlet


def _parse_substats_cell(cell: str) -> list[str]:
    substats: list[str] = []
    for raw_line in cell.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("*"):
            if substats:
                break
            continue
        line = re.sub(r'^(?:\d+\.|[≈=])\s*', '', line).replace("*", "").strip()
        line = re.sub(r'\bCrit\s+Rate\s*/\s*DMG\b', 'Crit Rate, Crit DMG', line, flags=re.IGNORECASE)
        line = line.replace("/", ",")
        for p in line.split(","):
            p = strip_parentheses(p.strip())
            for k in to_stat_keys(p):
                if k not in substats:
                    substats.append(k)
    return substats


def _parse_talent_cell(cell: str) -> str | None:
    tokens: list[tuple[str, str]] = []  # (sep_before, talent_name)
    for raw_line in cell.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("*"):
            if tokens:
                break
            continue
        sep = "=" if line.startswith(("≈", "=")) else ">"
        body = re.sub(r'^(?:\d+\.|[≈=])\s*', '', line).replace("*", "").strip()
        # Pode ter "Burst = Skill" na mesma linha
        sub_parts = re.split(r'\s*([=≈>≥])\s*', body)
        for sp in sub_parts:
            sp_clean = sp.strip()
            if sp_clean in ("=", "≈", ">", "≥"):
                sep = "=" if sp_clean in ("=", "≈") else ">"
                continue
            low = sp_clean.lower()
            if "normal" in low:
                tname = "Normal"
            elif "skill" in low:
                tname = "Skill"
            elif "burst" in low:
                tname = "Burst"
            else:
                continue
            if all(t != tname for _, t in tokens):
                tokens.append((sep, tname))
    if not tokens:
        return None
    out = tokens[0][1]
    for sep, tname in tokens[1:]:
        out += f" {sep} {tname}"
    return out


def parse_element_csv(csv_text: str, element: str) -> list[dict]:
    """Parseia um CSV elemental inteiro do Helper Sheet e retorna 1 documento canônico por personagem."""
    rows = list(csv.reader(io.StringIO(csv_text)))
    guides: list[dict] = []

    i = 0
    while i < len(rows):
        row = rows[i]
        if len(row) > 7 and row[2].strip() == "ROLE" and row[3].strip() == "EQUIPMENT":
            # Encontra o nome do personagem nas 1–4 linhas acima na coluna 1
            char_name = ""
            updated_ver = ""
            for back in range(1, 5):
                if i - back >= 0 and len(rows[i - back]) > 1:
                    val = rows[i - back][1].strip()
                    if not val or val in ("4 STAR", "5 STAR", "NOTES"):
                        continue
                    if val.startswith("Last Updated"):
                        updated_ver = val
                    elif not char_name:
                        char_name = val

            # Avança além do subheader ("WEAPON" / "ARTIFACT")
            j = i + 1
            if j < len(rows) and len(rows[j]) > 3 and rows[j][3].strip() == "WEAPON":
                j += 1

            role_rows = []
            extra_notes = ""
            while j < len(rows):
                r = rows[j]
                col1 = r[1].strip() if len(r) > 1 else ""
                col2 = r[2].strip() if len(r) > 2 else ""
                col3 = r[3].strip() if len(r) > 3 else ""

                if col1 == "NOTES":
                    extra_notes = col2
                    j += 1
                    break
                # Novo personagem ou nova seção de raridade
                if col1 and col1 not in ("",):
                    break
                if col2 and col3:
                    role_rows.append(r)
                j += 1

            if char_name and role_rows:
                # Google Sheets mescla verticalmente colunas iguais entre roles (ex.: Beidou);
                # propaga valores não-vazios de cima para baixo nas colunas 4..8.
                normalized_roles: list[list[str]] = []
                last_cols = [""] * 9
                for rr in role_rows:
                    padded = list(rr) + [""] * max(0, 9 - len(rr))
                    for col_idx in range(4, 9):
                        if padded[col_idx].strip():
                            last_cols[col_idx] = padded[col_idx]
                        elif last_cols[col_idx]:
                            padded[col_idx] = last_cols[col_idx]
                    normalized_roles.append(padded)

                # Escolhe a role marcada com '✩' (melhor papel), ou a primeira
                primary = next((r for r in normalized_roles if "✩" in r[2]), normalized_roles[0])
                role_label = collapse_ws(primary[2].replace("✩", ""))
                weapons = _parse_weapons_cell(primary[3])
                four, two = _parse_artifacts_cell(primary[4])
                sands, goblet, circlet = _parse_main_stats_cell(primary[5])
                substats = _parse_substats_cell(primary[6])
                talent_priority = _parse_talent_cell(primary[7])
                ability_tips = collapse_ws(primary[8])[:400] if primary[8].strip() else ""

                note_parts = [f"Role: {role_label}"]
                if updated_ver:
                    note_parts.append(updated_ver)
                if ability_tips:
                    note_parts.append(ability_tips)
                elif extra_notes:
                    note_parts.append(collapse_ws(extra_notes)[:400])

                char_slug = _normalize_char_slug(char_name, element)
                guides.append({
                    "source": "Helper Sheet",
                    "source_slug": "helper_sheet",
                    "source_url": HELPER_SHEET_URL,
                    "character_slug": char_slug,
                    "build": {
                        "name": "Helper Sheet Build",
                        "build_data": {
                            "weapons": weapons[:12],
                            "artifacts_4pc": four[:5],
                            "artifacts_2pc": two[:5],
                            "sands_stat": sands,
                            "goblet_stat": goblet,
                            "circlet_stat": circlet,
                            "substat_priority": substats,
                            "er_requirement": None,
                            "talent_priority": talent_priority,
                            "combos": [],
                            "notes": " | ".join(note_parts)[:600],
                            "references": [{
                                "url": HELPER_SHEET_URL,
                                "title": f"Genshin Impact Helper Team — {char_name.title()} ({element.title()})",
                            }],
                        },
                    },
                    "notable_teammates": [],
                    "teams": [],
                })
            i = j
            continue
        i += 1

    return guides
