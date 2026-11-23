#!/usr/bin/env python3
"""
import_kqm.py — Importa JSONs gerados pelo parse_kqm_guide.py para o banco.

Uso:
    python -m app.scripts.import_kqm backend/data/parsed
    python -m app.scripts.import_kqm backend/data/parsed --dry-run
"""
import argparse
import json
from pathlib import Path
import re

from sqlalchemy import func
from app.database import SessionLocal
from app.models import (
    Character, Weapon, ArtifactSet,
    CharacterBuildPreset, TeamTemplate,
    Team, TeamCharacter,
)
# Aliases para corrigir nomes "sujos" do KQM
CHAR_ALIASES = {
    # Travelers (KQM usa "{elemento}-traveler", DB usa "traveler-{elemento}")
    "dendro-traveler": "traveler-dendro",
    "anemo-traveler": "traveler-anemo",
    "geo-traveler": "traveler-geo",
    "electro-traveler": "traveler-electro",
    "hydro-traveler": "traveler-hydro",
    "pyro-traveler": "traveler-pyro",
    "cryo-traveler": "traveler-cryo",
    # Typos do KQM
    "symphonist-of-scent": "symphonist-of-scents",
    "night-of-the-sky-s-unveiling": "night-of-the-skys-unveiling",
    # Originais
    "charlottel": "charlotte",
    "charlottell": "charlotte",
    "hutao": "hu-tao",
    "kaedeharakazuha": "kaedehara-kazuha",
    "kamisatoayaka": "kamisato-ayaka",
    "kamisatoayato": "kamisato-ayato",
    "kujousara": "kujou-sara",
    "kukishinobu": "kuki-shinobu",
    "shinobu": "kuki-shinobu",
    "raidenshogun": "raiden-shogun",
    "sangonomiyakokomi": "sangonomiya-kokomi",
    "shikanoinheizou": "shikanoin-heizou",
    "aratakiitto": "arataki-itto",
    "yaemiko": "yae-miko",
    "yae": "yae-miko",
    "miko": "yae-miko",
    "yunjin": "yun-jin",
    "lanyan": "lan-yan",
    "childe": "tartaglia",
    "kuki": "kuki-shinobu",
    "ambor": "amber",
    "yumemizukimizuki": "yumemizuki-mizuki",
    "kokomi": "sangonomiya-kokomi",
    "kazuha": "kaedehara-kazuha",
    "itto": "arataki-itto",
    "ayaka": "kamisato-ayaka",
    "ayato": "kamisato-ayato",
    "heizou": "shikanoin-heizou",
    "mizuki": "yumemizuki-mizuki",
    "sara": "kujou-sara",
    "shogun": "raiden-shogun",
    "raiden": "raiden-shogun",
}

# Aliases especificos de armas (slug -> slug no DB)
WEAPON_ALIASES = {
    "symphonist-of-scent": "symphonist-of-scents",  # KQM omitiu o 's' final
    "jadefall-splendor": "jadefall-s-splendor",     # KQM sem apostrofo
    "sacrifical-jade": "sacrificial-jade",          # Helper Sheet typo
    "fruit-of-fulfilment": "fruit-of-fulfillment",  # Helper Sheet UK spelling
    "aquilla-favonia": "aquila-favonia",            # Helper Sheet typo
    "lost-prayer-to-sacred-winds": "lost-prayer-to-the-sacred-winds",
    "a-thousand-floating-dream": "a-thousand-floating-dreams",
    "gest-of-the-might-wolf": "gest-of-the-mighty-wolf",
    "tome-of-eternal-flow": "tome-of-the-eternal-flow",
    "fleuve-cendre-ferrymen": "fleuve-cendre-ferryman",
    "wave-break-er-s-fin": "wavebreaker-s-fin",
    "ul-ti-mate-o-ver-lord-s-me-ga-ma-gic-sword": "ultimate-overlord-s-mega-magic-sword",
}

# Aliases especificos de sets (slug -> slug no DB)
ARTIFACT_ALIASES = {
    "night-of-the-sky-s-unveiling": "night-of-the-skys-unveiling",
    "marchaussee-hunter": "marechaussee-hunter",
    "song-of-day-s-past": "song-of-days-past",
    "silken-moon-serenade": "silken-moons-serenade",
}

# Placeholders que aparecem nos times do KQM e NÃO são personagens
SKIP_SLUGS = {
    "flex", "pyro", "hydro", "cryo", "electro", "anemo", "geo", "dendro",
    "any", "none", "flexible", "utility", "healer", "shield", "buffer",
}

# Placeholders do KQM tipo "Core Dendro", "Secondary Hydro"
PLACEHOLDER_PATTERN = re.compile(r'^(?:core|secondary)-')

from app.services.archetype_classifier import classify_team_archetype


def detect_archetype(
    character_slugs: list[str],
    elements_by_slug: dict[str, str] | None = None,
    *,
    main_character: str | None = None,
    team_name: str | None = None,
) -> str:
    return classify_team_archetype(
        character_slugs,
        elements_by_slug,
        main_character=main_character,
        team_name=team_name,
    )


def normalize_slug(slug: str) -> str:
    return CHAR_ALIASES.get(slug, slug)



def _canon_name(s: str) -> str:
    """Normaliza apostrofos tipograficos (U+2018/2019) para ASCII + lowercase."""
    if not s:
        return ""
    return s.replace("\u00ad", "").replace("\u2019", "'").replace("\u2018", "'").lower()


def _name_filter(column, target: str):
    """SQL filter que canonicaliza apostrofos tipograficos na coluna antes de comparar."""
    canon_col = func.lower(
        func.replace(func.replace(column, "\u2019", "'"), "\u2018", "'")
    )
    return canon_col == target


def resolve_weapon(db, slug, name):
    candidates = [slug]
    stripped = re.sub(r'-r[1-5]$', '', slug)
    if stripped != slug:
        candidates.append(stripped)
    for cand in candidates:
        w = db.query(Weapon).filter(Weapon.slug == cand).first()
        if w:
            return w
        aliased = WEAPON_ALIASES.get(cand)
        if aliased:
            w = db.query(Weapon).filter(Weapon.slug == aliased).first()
            if w:
                return w
    if not name:
        return None
    clean_n = re.sub(r'\s+r[1-5]$', '', _canon_name(name)).strip()
    return db.query(Weapon).filter(_name_filter(Weapon.name, clean_n)).first()


def resolve_artifact(db, slug, name):
    a = db.query(ArtifactSet).filter(ArtifactSet.slug == slug).first()
    if a: return a
    aliased = ARTIFACT_ALIASES.get(slug)
    if aliased:
        a = db.query(ArtifactSet).filter(ArtifactSet.slug == aliased).first()
        if a: return a
    if not name: return None
    return db.query(ArtifactSet).filter(_name_filter(ArtifactSet.name, _canon_name(name))).first()


def resolve_character(db, slug):
    canonical = normalize_slug(slug)
    return db.query(Character).filter(Character.slug == canonical).first()


def _extract_refinement(notes: str | None) -> int:
    """Extrai 'R5'/'R1' do notes. Default 1."""
    if not notes:
        return 1
    m = re.search(r'\bR([1-5])\b', notes)
    return int(m.group(1)) if m else 1


def _normalize_build_data(db, raw_bd, warnings):
    """Normaliza build_data do JSON (resolve slugs de armas/sets, extrai refinement)."""
    bd = dict(raw_bd)

    valid_w = []
    for w in bd.get("weapons", []):
        r = resolve_weapon(db, w["weapon_slug"], w.get("weapon_name", ""))
        if r:
            valid_w.append({
                "weapon_slug": r.slug,
                "weapon_refinement": _extract_refinement(w.get("notes")),
                "notes": w.get("notes"),
            })
        else:
            warnings.append(f"[team-custom] Arma não encontrada: {w['weapon_slug']}")
    bd["weapons"] = valid_w

    valid_a = []
    for a in bd.get("artifacts_4pc", []):
        r = resolve_artifact(db, a["artifact_set_slug"], a.get("artifact_set_name", ""))
        if r:
            valid_a.append({"artifact_set_slug": r.slug, "notes": a.get("notes")})
        else:
            warnings.append(f"[team-custom] Set não encontrado: {a['artifact_set_slug']}")
    bd["artifacts_4pc"] = valid_a

    return bd


def _normalize_teammate_notes(notable_teammates: list[dict] | None) -> dict[str, dict[str, str]]:
    notes: dict[str, dict[str, str]] = {}
    for nt in notable_teammates or []:
        slug = normalize_slug(nt.get("character_slug", ""))
        if not slug or slug in SKIP_SLUGS or PLACEHOLDER_PATTERN.match(slug):
            continue
        if slug not in notes:
            notes[slug] = {
                "category": nt.get("category") or "Teammate",
                "notes": nt.get("notes") or "",
            }
    return notes


def _normalize_slot_alternatives(raw_alts: dict | None) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    for k, slugs in (raw_alts or {}).items():
        cleaned = []
        for s in slugs or []:
            ns = normalize_slug(s)
            if ns and ns not in SKIP_SLUGS and not PLACEHOLDER_PATTERN.match(ns) and ns not in cleaned:
                cleaned.append(ns)
        if cleaned:
            out[str(k)] = cleaned
    return out


def _merge_sources(existing: list[dict] | None, source_name: str, source_url: str | None) -> list[dict]:
    merged = [dict(s) for s in (existing or []) if isinstance(s, dict)]
    if not any(s.get("source") == source_name for s in merged):
        merged.append({"source": source_name, "url": source_url})
    return merged


def _merge_slot_substitutes(existing: dict | None, incoming: dict[str, list[dict]]) -> dict[str, list[dict]]:
    merged: dict[str, list[dict]] = {
        str(k): [dict(item) for item in (v or [])]
        for k, v in (existing or {}).items()
    }
    for pos_k, items in incoming.items():
        bucket = merged.setdefault(str(pos_k), [])
        seen = {x.get("character_slug") for x in bucket}
        for item in items:
            slug = item.get("character_slug")
            if slug and slug not in seen:
                bucket.append(item)
                seen.add(slug)
    return merged


def _resolve_valid_team_chars(db, raw_slugs: list[str]) -> list[Character]:
    valid_chars: list[Character] = []
    seen_ids: set[int] = set()
    for slug in raw_slugs or []:
        slug = normalize_slug(slug)
        if slug in SKIP_SLUGS or PLACEHOLDER_PATTERN.match(slug):
            continue
        c = resolve_character(db, slug)
        if c and c.id not in seen_ids:
            seen_ids.add(c.id)
            valid_chars.append(c)
    return valid_chars[:4]


def _pick_best_team_candidate(
    db,
    char: Character,
    teams: list[dict],
) -> tuple[list[Character], dict[str, list[str]], dict[int, list[dict]]]:
    """Escolhe o melhor time canônico para `char` (priorizando 4 membros completos).

    Se o próprio guia não trouxe Example Teams, faz fallback nos TeamTemplates do banco.
    Retorna (valid_chars, slot_alternatives_raw, template_slot_substitutes).
    """
    scored: list[tuple[tuple[int, int, int], list[Character], dict]] = []
    for idx, t in enumerate(teams or []):
        vchars = _resolve_valid_team_chars(db, t.get("character_slugs", []))
        if len(vchars) < 3:
            continue
        slugs = [c.slug for c in vchars]
        is_full = 1 if len(vchars) == 4 else 0
        is_main = 1 if normalize_slug(t.get("main_character", "")) == char.slug else 0
        has_char = 1 if char.slug in slugs else 0
        scored.append(((is_full, is_main, has_char, -idx), vchars, t.get("slot_alternatives") or {}))

    if scored:
        scored.sort(key=lambda x: x[0], reverse=True)
        _, best_chars, best_alts = scored[0]
        return best_chars, best_alts, {}

    # Fallback: procurar melhor TeamTemplate já existente no banco que inclua `char`
    all_tpls = db.query(TeamTemplate).all()
    tpl_candidates: list[tuple[tuple[int, int, int, int], list[Character], dict[int, list[dict]]]] = []
    for tpl in all_tpls:
        slugs = tpl.character_slugs or []
        if char.slug not in slugs:
            continue
        vchars = _resolve_valid_team_chars(db, slugs)
        if len(vchars) < 3:
            continue
        is_full = 1 if len(vchars) == 4 else 0
        is_main = 1 if tpl.main_character == char.slug else 0
        prio = -source_priority(tpl.source)
        subs_count = sum(len(v) for v in (tpl.slot_substitutes or {}).values())
        tpl_subs: dict[int, list[dict]] = {}
        for k, v in (tpl.slot_substitutes or {}).items():
            try:
                tpl_subs[int(k)] = list(v)
            except (TypeError, ValueError):
                pass
        tpl_candidates.append(((is_full, is_main, prio, subs_count), vchars, tpl_subs))

    if tpl_candidates:
        tpl_candidates.sort(key=lambda x: x[0], reverse=True)
        _, best_chars, best_subs = tpl_candidates[0]
        return best_chars, {}, best_subs

    return [], {}, {}


def create_team_from_build(
    db,
    char,
    raw_bd,
    teams,
    source_url,
    warnings,
    source_name: str = "KQM",
    teammate_notes: dict[str, dict[str, str]] | None = None,
):
    """Cria Team customizável a partir do guia. Retorna True se criou."""
    from app.services.presets import has_build_content, pick_best_preset
    from app.services.substitutes import compute_slot_substitutes_for_slugs

    team_name = f"{char.name} — Principal"
    if db.query(Team).filter(Team.name == team_name).first():
        warnings.append(f"[team-custom] Team '{team_name}' já existe (skip)")
        return False

    valid_chars, raw_alts, fallback_subs = _pick_best_team_candidate(db, char, teams)
    if len(valid_chars) < 3:
        warnings.append(f"[team-custom] {char.slug}: sem time completo encontrado")
        return False

    # Remapeia posições se o dono do time não estiver na posição 1
    orig_order = [c.slug for c in valid_chars]
    if char.slug in orig_order and orig_order[0] != char.slug:
        owner_idx = orig_order.index(char.slug)
        valid_chars = [valid_chars[owner_idx]] + [c for i, c in enumerate(valid_chars) if i != owner_idx]
        # Reindexa slot_alternatives e fallback_subs para acompanhar a nova posição
        new_pos_of_old: dict[int, int] = {}
        for new_i, c in enumerate(valid_chars, start=1):
            old_i = orig_order.index(c.slug) + 1
            new_pos_of_old[old_i] = new_i
        remapped_alts: dict[str, list[str]] = {}
        for k, v in raw_alts.items():
            try:
                nk = new_pos_of_old.get(int(k))
                if nk:
                    remapped_alts[str(nk)] = v
            except (TypeError, ValueError):
                pass
        raw_alts = remapped_alts
        fallback_subs = {
            new_pos_of_old[k]: v for k, v in fallback_subs.items() if k in new_pos_of_old
        }

    # Normaliza build_data do main char
    main_bd = _normalize_build_data(db, raw_bd, warnings)
    main_bd["references"] = [{"url": source_url, "title": f"{source_name} {char.name} Guide"}]
    main_bd["substitutes"] = []

    # Calcula substitutos curados por slot a partir de '/' + Notable Teammates
    valid_slugs = [c.slug for c in valid_chars]
    slot_alts = _normalize_slot_alternatives(raw_alts)
    computed_subs = compute_slot_substitutes_for_slugs(
        db,
        valid_slugs,
        main_character=char.slug,
        slot_alternatives=slot_alts,
        teammate_notes=teammate_notes,
        limit=6,
    )

    # Cria Team
    team = Team(
        name=team_name,
        description=f"Build importada de {source_name} — {source_url}",
        is_public=True,
    )
    db.add(team)
    db.flush()

    for i, c in enumerate(valid_chars, start=1):
        if c.id == char.id and has_build_content(main_bd):
            char_bd = main_bd
        else:
            preset = pick_best_preset(db, c.id)
            char_bd = dict(preset.build_data) if preset and has_build_content(preset.build_data) else None

        subs = computed_subs.get(i) or fallback_subs.get(i, [])
        db.add(TeamCharacter(
            team_id=team.id,
            character_id=c.id,
            position=i,
            build_data=char_bd,
            substitutes=subs,
        ))

    return True


def import_build(db, data, warnings):
    slug = data["character_slug"]
    char = resolve_character(db, slug)
    if not char:
        warnings.append(f"[build] Character não encontrado: {slug}")
        return False

    build = data["build"]
    bd = dict(build["build_data"])

    valid_w = []
    for w in bd.get("weapons", []):
        r = resolve_weapon(db, w["weapon_slug"], w.get("weapon_name", ""))
        if r:
            valid_w.append({
                "weapon_slug": r.slug,
                "weapon_refinement": _extract_refinement(w.get("notes")),
                "notes": w.get("notes"),
            })
        else:
            warnings.append(f"[build] Arma não encontrada: {w['weapon_slug']}")
    bd["weapons"] = valid_w

    valid_a = []
    for a in bd.get("artifacts_4pc", []):
        r = resolve_artifact(db, a["artifact_set_slug"], a.get("artifact_set_name", ""))
        if r:
            valid_a.append({"artifact_set_slug": r.slug, "notes": a.get("notes")})
        else:
            warnings.append(f"[build] Set não encontrado: {a['artifact_set_slug']}")
    bd["artifacts_4pc"] = valid_a

    valid_a2 = []
    for p in bd.get("artifacts_2pc", []):
        if "set1_slug" in p and "set2_slug" in p:
            r1 = resolve_artifact(db, p["set1_slug"], p.get("set1_name", ""))
            r2 = resolve_artifact(db, p["set2_slug"], p.get("set2_name", ""))
            if r1 and r2:
                valid_a2.append({"set1_slug": r1.slug, "set2_slug": r2.slug, "notes": p.get("notes")})
            else:
                warnings.append(f"[build] Par 2pc não encontrado: {p.get('set1_slug')} + {p.get('set2_slug')}")
    bd["artifacts_2pc"] = valid_a2

    existing = db.query(CharacterBuildPreset).filter(
        CharacterBuildPreset.character_id == char.id,
        CharacterBuildPreset.name == build["name"],
    ).first()
    if not existing:
        existing = next(
            (
                obj for obj in getattr(db, "new", ())
                if isinstance(obj, CharacterBuildPreset)
                and obj.character_id == char.id
                and obj.name == build["name"]
            ),
            None,
        )
    if existing:
        existing.build_data = bd
    else:
        db.add(CharacterBuildPreset(
            character_id=char.id, name=build["name"], build_data=bd,
        ))
    return True


# Prioridade editorial para metadados de TeamTemplate (menor = maior autoridade).
# Guias editoriais (KQM, Game8, GameWith, Genshin.gg) sempre prevalecem sobre
# templates importados de estatísticas empíricas (YS Helper), preservando ambos em `sources`.
TEMPLATE_SOURCE_PRIORITY: dict[str, int] = {
    "kqm": 0,
    "game8": 1,
    "gamewith": 2,
    "genshin.gg": 3,
    "genshingg": 3,
    "ys abyss": 10,
    "ys stygian": 11,
}


def source_priority(source_name: str | None) -> int:
    norm = (source_name or "").strip().lower()
    if norm in TEMPLATE_SOURCE_PRIORITY:
        return TEMPLATE_SOURCE_PRIORITY[norm]
    for prefix, prio in TEMPLATE_SOURCE_PRIORITY.items():
        if norm.startswith(prefix):
            return prio
    return 5  # Outras fontes editoriais continuam acima do YS Helper


def _load_template_caches(db) -> tuple[dict[tuple[str, ...], TeamTemplate], set[str]]:
    """Carrega templates do banco + objetos pendentes na sessão (autoflush=False)."""
    all_templates = list(db.query(TeamTemplate).all()) + [
        obj for obj in getattr(db, "new", ()) if isinstance(obj, TeamTemplate)
    ]
    by_canonical: dict[tuple[str, ...], TeamTemplate] = {}
    names: set[str] = set()
    for et in all_templates:
        by_canonical[tuple(sorted(et.character_slugs or []))] = et
        if et.name:
            names.add(et.name)
    return by_canonical, names


def import_teams(
    db,
    teams,
    source_url,
    warnings,
    source_name: str = "KQM",
    teammate_notes: dict[str, dict[str, str]] | None = None,
    existing_by_canonical: dict[tuple[str, ...], TeamTemplate] | None = None,
    existing_names: set[str] | None = None,
):
    from app.services.substitutes import compute_slot_substitutes_for_slugs

    imported = 0
    elements_by_slug = {
        c.slug: (c.element.value if hasattr(c.element, "value") else str(c.element)).lower()
        for c in db.query(Character).all()
    }
    if existing_by_canonical is None or existing_names is None:
        loaded_canon, loaded_names = _load_template_caches(db)
        if existing_by_canonical is None:
            existing_by_canonical = loaded_canon
        if existing_names is None:
            existing_names = loaded_names
    incoming_prio = source_priority(source_name)

    for t in teams:
        cleaned = [
            s for s in t["character_slugs"]
            if s not in SKIP_SLUGS and not PLACEHOLDER_PATTERN.match(s)
        ]
        normalized = [normalize_slug(s) for s in cleaned]
        valid = [s for s in normalized if resolve_character(db, s)]
        for s in normalized:
            if s not in valid:
                warnings.append(f"[team] Personagem não encontrado: {s}")
        if len(valid) < 3:
            continue

        slot_alts = _normalize_slot_alternatives(t.get("slot_alternatives"))
        computed = compute_slot_substitutes_for_slugs(
            db,
            valid,
            main_character=valid[0],
            slot_alternatives=slot_alts,
            teammate_notes=teammate_notes,
            limit=6,
        )
        slot_subs_json = {str(pos): items for pos, items in computed.items() if items}

        canonical = tuple(sorted(valid))
        dup = existing_by_canonical.get(canonical)
        if dup:
            # Multi-fonte: mescla fontes e substitutos, respeitando hierarquia editorial > empírica
            existing_prio = source_priority(dup.source)
            dup.sources = _merge_sources(dup.sources, source_name, source_url)
            if incoming_prio < existing_prio:
                # Fonte editorial mais rica sobrescreve nome, descrição, ordem e fonte primária
                dup.source = source_name
                dup.source_url = source_url
                dup.character_slugs = valid
                dup.main_character = valid[0]
                dup.archetype = detect_archetype(
                    valid,
                    elements_by_slug,
                    main_character=valid[0],
                    team_name=t.get("raw_line"),
                )
                if t.get("description"):
                    dup.description = t["description"]
                new_name = (t.get("raw_line") or "")[:150]
                if new_name and new_name != dup.name and new_name not in existing_names:
                    existing_names.discard(dup.name)
                    dup.name = new_name
                    existing_names.add(new_name)
                dup.slot_substitutes = _merge_slot_substitutes(slot_subs_json, dup.slot_substitutes)
            else:
                dup.slot_substitutes = _merge_slot_substitutes(dup.slot_substitutes, slot_subs_json)
                if not dup.description and t.get("description"):
                    dup.description = t["description"]
                if not dup.archetype or dup.archetype == "unknown":
                    dup.archetype = detect_archetype(
                        list(dup.character_slugs or valid),
                        elements_by_slug,
                        main_character=dup.main_character or valid[0],
                        team_name=dup.name,
                    )
            continue

        name = t["raw_line"][:150]
        if name in existing_names:
            continue

        archetype = detect_archetype(
            valid,
            elements_by_slug,
            main_character=valid[0],
            team_name=name,
        )
        tpl = TeamTemplate(
            name=name,
            main_character=valid[0],
            archetype=archetype,
            description=t.get("description"),
            character_slugs=valid,
            source=source_name,
            source_url=source_url,
            sources=[{"source": source_name, "url": source_url}],
            slot_substitutes=slot_subs_json,
        )
        db.add(tpl)
        existing_by_canonical[canonical] = tpl
        existing_names.add(name)
        imported += 1
    return imported


def import_directory(db, input_dir: Path, create_team: bool, warnings: list[str]) -> tuple[int, int, int]:
    """Importa todos os *-build.json e *-teams.json de uma pasta parseada."""
    builds, teams, custom_teams = 0, 0, 0
    notes_by_slug: dict[str, dict[str, dict[str, str]]] = {}
    meta_by_slug: dict[str, tuple[str, str]] = {}

    for f in sorted(input_dir.glob("*-build.json")):
        slug = f.stem.replace("-build", "")
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            source_name = data.get("source") or "KQM"
            source_url = data.get("source_url") or f"https://keqingmains.com/{slug}/"
            meta_by_slug[slug] = (source_name, source_url)
            notes_by_slug[slug] = _normalize_teammate_notes(data.get("notable_teammates"))
            if import_build(db, data, warnings):
                builds += 1
        except Exception as e:
            warnings.append(f"[{f.name}] {e}")

    existing_by_canonical, existing_names = _load_template_caches(db)
    teams_by_slug: dict[str, list[dict]] = {}
    for f in sorted(input_dir.glob("*-teams.json")):
        slug = f.stem.replace("-teams", "")
        source_name, source_url = meta_by_slug.get(slug, ("KQM", f"https://keqingmains.com/{slug}/"))
        try:
            t_list = json.loads(f.read_text(encoding="utf-8"))
            teams_by_slug[slug] = t_list
            teams += import_teams(
                db,
                t_list,
                source_url,
                warnings,
                source_name=source_name,
                teammate_notes=notes_by_slug.get(slug),
                existing_by_canonical=existing_by_canonical,
                existing_names=existing_names,
            )
        except Exception as e:
            warnings.append(f"[{f.name}] {e}")

    if create_team:
        if hasattr(db, "flush"):
            db.flush()
        for f in sorted(input_dir.glob("*-build.json")):
            slug = f.stem.replace("-build", "")
            try:
                data = json.loads(f.read_text(encoding="utf-8"))
                char = resolve_character(db, slug)
                if not char:
                    warnings.append(f"[team-custom] {slug}: character não encontrado")
                    continue
                raw_bd = data["build"]["build_data"]
                source_name, source_url = meta_by_slug.get(slug, ("KQM", f"https://keqingmains.com/{slug}/"))
                if create_team_from_build(
                    db,
                    char,
                    raw_bd,
                    teams_by_slug.get(slug, []),
                    source_url,
                    warnings,
                    source_name=source_name,
                    teammate_notes=notes_by_slug.get(slug),
                ):
                    custom_teams += 1
            except Exception as e:
                warnings.append(f"[{f.name}] team-custom: {e}")

    return builds, teams, custom_teams


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input", type=Path)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--create-team", action="store_true",
                    help="Cria 1 Team customizado por guia (o mais canônico)")
    args = ap.parse_args()

    db = SessionLocal()
    warnings: list[str] = []
    builds, teams, custom_teams = import_directory(db, args.input, args.create_team, warnings)

    if args.dry_run:
        db.rollback()
        print("🔎 DRY RUN — nada foi salvo")
    else:
        db.commit()
        print("✅ Salvo no banco")

    suffix = f" · Teams customizados: {custom_teams}" if args.create_team else ""
    print(f"   Builds: {builds} · Times novos: {teams}{suffix}")
    if warnings:
        print(f"   ⚠️  {len(warnings)} aviso(s):")
        for w in warnings[:15]:
            print(f"     - {w}")
    db.close()


if __name__ == "__main__":
    main()

