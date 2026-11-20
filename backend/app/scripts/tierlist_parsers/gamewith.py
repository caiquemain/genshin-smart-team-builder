"""Parser para a tierlist da GameWith (gamewith.net/genshin-impact/article/show/21671).

Formato esperado do .txt (Ctrl+A -> Ctrl+C de uma ou mais abas — ex.: On-Field + Off-Field,
ou todas as 5 abas On-Field / Off-Field / DPS / Support / Sustain coladas no mesmo .txt):
  - Versão: `Best Characters Tier List (7.2 Update)`
  - Um ou mais blocos iniciados por `Best Character Tier List Summary Table`
  - Tiers em linha isolada: `TierSS`, `TierS`, `TierA`, `TierB`, `TierC`, `TierD`
    (seguidos de `Tier1`..`Tier6`)
  - Cada personagem vem em um par de 2 linhas:
      1. `<Nome>C[0-6]?`  (ex.: `VarkaC0`, `MityaC`, `Cryo T.C3`)
      2. `<Nome>`         (ex.: `Varka`, `Mitya`, `Cryo T.`)
  - O parser varre todos os blocos presentes no arquivo e deduplica cada personagem
    pelo melhor tier obtido entre as abas.
"""
import re
from typing import Optional

from .common import dedupe_best_tier, normalize_character_slug

GAMEWITH_SCALE = ["SS", "S", "A", "B", "C", "D"]

_VERSION_RE = re.compile(r"Tier List\s*\((\d+\.\d+)\s*Update\)", re.IGNORECASE)
_TIER_LINE_RE = re.compile(r"^Tier(SS|S|A|B|C|D)$")
_TIER_NUM_RE = re.compile(r"^Tier[1-6]$")
_CONST_SUFFIX_RE = re.compile(r"^(.+?)C[0-6]?$")


def detect_version(text: str, default: str = "unknown") -> str:
    m = _VERSION_RE.search(text)
    return m.group(1) if m else default


def parse_gamewith(text: str, version_hint: Optional[str] = None) -> dict:
    """Converte o .txt da tierlist da GameWith (1 ou mais abas coladas) em estrutura canônica."""
    version = detect_version(text, default=version_hint or "unknown")
    lines = [ln.strip() for ln in text.splitlines()]

    raw_entries: list[dict] = []
    in_table = False
    current_tier: Optional[str] = None
    i = 0
    n = len(lines)

    while i < n:
        line = lines[i]
        if not line:
            i += 1
            continue

        if line == "Best Character Tier List Summary Table":
            in_table = True
            current_tier = None
            i += 1
            continue

        if not in_table:
            i += 1
            continue

        if line.startswith("Role Explanation & Tier Basis") or line == "Character Top Tier Rankings With Evaluations":
            in_table = False
            current_tier = None
            i += 1
            continue

        m_tier = _TIER_LINE_RE.match(line)
        if m_tier:
            current_tier = m_tier.group(1)
            i += 1
            continue

        if _TIER_NUM_RE.match(line):
            i += 1
            continue

        if current_tier is None:
            i += 1
            continue

        # Par de linhas: `<Nome>C[0-6]?` seguido de `<Nome>`
        if i + 1 < n:
            next_line = lines[i + 1]
            m_const = _CONST_SUFFIX_RE.match(line)
            if (
                m_const
                and next_line
                and m_const.group(1).strip().lower() == next_line.strip().lower()
            ):
                slug = normalize_character_slug(next_line)
                if slug:
                    raw_entries.append({
                        "character_slug": slug,
                        "role": "",
                        "tier_label": current_tier,
                    })
                i += 2
                continue

        i += 1

    if not raw_entries:
        raise ValueError("Nenhuma entrada de personagem encontrada no .txt da GameWith.")

    return {
        "site_slug": "gamewith",
        "version": version,
        "scale": GAMEWITH_SCALE,
        "entries": dedupe_best_tier(raw_entries, GAMEWITH_SCALE),
        "raw_entries": raw_entries,
    }
