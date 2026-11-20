"""Utilitários compartilhados pelos parsers de tierlist."""
import csv
import io
import re
from typing import Iterable

ROLE_PRIORITY = {
    "main_dps": 0,
    "sub_dps": 1,
    "support": 2,
    "general": 3,
}

# Aliases comuns encontrados em tierlists externas -> slug canônico do banco
CHARACTER_SLUG_ALIASES: dict[str, str] = {
    "kazuha": "kaedehara-kazuha",
    "ayaka": "kamisato-ayaka",
    "ayato": "kamisato-ayato",
    "kokomi": "sangonomiya-kokomi",
    "raiden": "raiden-shogun",
    "shogun": "raiden-shogun",
    "itto": "arataki-itto",
    "sara": "kujou-sara",
    "shinobu": "kuki-shinobu",
    "heizou": "shikanoin-heizou",
    "mizuki": "yumemizuki-mizuki",
    "childe": "tartaglia",
    "hutao": "hu-tao",
    "yunjin": "yun-jin",
    "lanyan": "lan-yan",
    "yae": "yae-miko",
    "ambor": "amber",
}

_TRAVELER_PREFIX_RE = re.compile(
    r"^(anemo|geo|electro|dendro|hydro|pyro|cryo)\s+traveler$",
    re.IGNORECASE,
)
_TRAVELER_PAREN_RE = re.compile(
    r"^traveler\s*\((anemo|geo|electro|dendro|hydro|pyro|cryo)\)$",
    re.IGNORECASE,
)


def normalize_character_slug(raw_name: str) -> str:
    """Converte nome de personagem de tierlists para o slug canônico do DB."""
    name = raw_name.strip()
    if not name:
        return ""

    m = _TRAVELER_PREFIX_RE.match(name) or _TRAVELER_PAREN_RE.match(name)
    if m:
        return f"traveler-{m.group(1).lower()}"

    slug = name.lower()
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)
    slug = re.sub(r"\s+", "-", slug.strip())
    slug = re.sub(r"-+", "-", slug)
    return CHARACTER_SLUG_ALIASES.get(slug, slug)


def dedupe_best_tier(
    entries: Iterable[dict],
    scale: list[str],
) -> list[dict]:
    """Deduplica entradas por personagem mantendo o melhor tier (1 voto por site).

    Desempate determinístico por papel: main_dps > sub_dps > support > general.
    """
    rank = {label: idx for idx, label in enumerate(scale)}
    best: dict[str, dict] = {}
    for entry in entries:
        slug = entry["character_slug"]
        tier = entry["tier_label"]
        role = entry.get("role") or ""
        if tier not in rank:
            continue
        cand_key = (rank[tier], ROLE_PRIORITY.get(role or "general", 99))
        prev = best.get(slug)
        if prev is None:
            best[slug] = {"character_slug": slug, "role": role, "tier_label": tier}
        else:
            prev_key = (rank[prev["tier_label"]], ROLE_PRIORITY.get(prev["role"] or "general", 99))
            if cand_key < prev_key:
                best[slug] = {"character_slug": slug, "role": role, "tier_label": tier}
    return list(best.values())


def parse_canonical_csv(text: str, site_slug: str, version: str, scale: list[str]) -> dict:
    """Lê um CSV canônico (`character_slug,role,tier_label`) de `data/sources/tierlists/<site>/`."""
    reader = csv.DictReader(io.StringIO(text))
    raw_entries: list[dict] = []
    for row in reader:
        slug = normalize_character_slug(row.get("character_slug") or "")
        tier = (row.get("tier_label") or "").strip()
        role = (row.get("role") or "").strip().replace("-", "_") or ""
        if slug and tier:
            raw_entries.append({
                "character_slug": slug,
                "role": role,
                "tier_label": tier,
            })
    return {
        "site_slug": site_slug,
        "version": version,
        "scale": scale,
        "entries": dedupe_best_tier(raw_entries, scale),
        "raw_entries": raw_entries,
    }
