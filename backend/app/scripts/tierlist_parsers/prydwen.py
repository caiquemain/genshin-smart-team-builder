"""Parser para a tierlist do Prydwen (prydwen.gg/genshin/tier-list).

Suporta tanto a tierlist geral (`Overall`) quanto as abas de chefes do
`Stygian Onslaught` (Boss 1 / Boss 2 / Boss 3).

Formato esperado do .txt (Ctrl+A -> Ctrl+C da página):
  - Versão: `Genshin Impact Tier List (7.2)`
  - Subtítulo do modo: `Tier List (Overall)` ou `Tier List (Stygian Onslaught — Wavebinder)`
  - Tiers em linha isolada: `T0`, `T0.5`, `T1`, `T1.5`, `T2`, `T3`, `T4`, `T5`
  - Cada personagem vem numa linha `<Nome><elemento>C<0-6>` (ex.: `MavuikapyroC0`,
    `Traveler CryocryoC6`, `Kaedehara KazuhaanemoC0`)
  - Tags explicativas (`expert (-2)`, `NEW`, `partner (lauma)`, `mechanic`, etc.)
    não terminam em `<elemento>C<0-6>` e são ignoradas automaticamente.
"""
import re
from typing import Optional

from .common import dedupe_best_tier, normalize_character_slug

PRYDWEN_SCALE = ["T0", "T0.5", "T1", "T1.5", "T2", "T3", "T4", "T5"]

_VERSION_RE = re.compile(r"Tier List\s*\((\d+\.\d+)\)", re.IGNORECASE)
_BOSS_RE = re.compile(r"Tier List\s*\(Stygian Onslaught\s*[—–-]\s*([^)]+)\)", re.IGNORECASE)
_CHAR_LINE_RE = re.compile(
    r"^(.+?)(anemo|geo|electro|dendro|hydro|pyro|cryo)C([0-6])$",
    re.IGNORECASE,
)


def detect_version(text: str, default: str = "unknown") -> str:
    m = _VERSION_RE.search(text)
    return m.group(1) if m else default


def detect_boss_name(text: str) -> Optional[str]:
    m = _BOSS_RE.search(text)
    return m.group(1).strip() if m else None


def parse_prydwen(
    text: str,
    version_hint: Optional[str] = None,
    site_slug: str = "prydwen",
    boss_number: Optional[int] = None,
) -> dict:
    """Converte o .txt da tierlist do Prydwen (Overall ou Stygian Boss) em estrutura canônica."""
    version = detect_version(text, default=version_hint or "unknown")
    boss_name = detect_boss_name(text)
    lines = [ln.strip() for ln in text.splitlines()]

    raw_entries: list[dict] = []
    current_tier: Optional[str] = None

    for line in lines:
        if not line:
            continue

        if current_tier is not None and (
            line.lower() == "privacy policy"
            or line.lower().startswith("copyright ©")
        ):
            break

        if line in PRYDWEN_SCALE:
            current_tier = line
            continue

        if current_tier is None:
            continue

        m = _CHAR_LINE_RE.match(line)
        if m:
            raw_name = m.group(1).strip()
            slug = normalize_character_slug(raw_name)
            if slug:
                raw_entries.append({
                    "character_slug": slug,
                    "role": "",
                    "tier_label": current_tier,
                })

    if not raw_entries:
        raise ValueError("Nenhuma entrada de personagem encontrada no .txt do Prydwen.")

    result = {
        "site_slug": site_slug,
        "version": version,
        "scale": PRYDWEN_SCALE,
        "entries": dedupe_best_tier(raw_entries, PRYDWEN_SCALE),
        "raw_entries": raw_entries,
    }
    if boss_name:
        result["boss_name"] = boss_name
        result["site_name"] = f"Boss {boss_number}: {boss_name}" if boss_number else boss_name
    return result


def parse_prydwen_stygian_1(text: str, version_hint: Optional[str] = None) -> dict:
    return parse_prydwen(text, version_hint=version_hint, site_slug="prydwen-stygian-1", boss_number=1)


def parse_prydwen_stygian_2(text: str, version_hint: Optional[str] = None) -> dict:
    return parse_prydwen(text, version_hint=version_hint, site_slug="prydwen-stygian-2", boss_number=2)


def parse_prydwen_stygian_3(text: str, version_hint: Optional[str] = None) -> dict:
    return parse_prydwen(text, version_hint=version_hint, site_slug="prydwen-stygian-3", boss_number=3)
