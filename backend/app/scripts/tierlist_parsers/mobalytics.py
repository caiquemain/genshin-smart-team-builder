"""Parser para a tierlist da Mobalytics (mobalytics.gg/genshin-impact/tier-list).

Formato esperado do .txt (Ctrl+A -> Ctrl+C da página):
  - Versão: `which is currently 7.2` (ou `patch 7.2`)
  - Início da lista após `Search...` na primeira linha `S`
  - Tiers em linha isolada: `S`, `A+`, `A`, `B+`, `B`, `C`, `D`, `E`, `F`
  - Um nome canônico de personagem por linha não-vazia
  - Termina em `All Characters:` ou `Placement Commentary`
"""
import re
from typing import Optional

from .common import dedupe_best_tier, normalize_character_slug

MOBALYTICS_SCALE = ["S", "A+", "A", "B+", "B", "C", "D", "E", "F"]

_VERSION_RE = re.compile(r"(?:currently|patch|version)\s+(\d+\.\d+)", re.IGNORECASE)
_STOP_PREFIXES = (
    "all characters:",
    "everything you need",
    "placement commentary",
    "browse character builds",
)


def detect_version(text: str, default: str = "unknown") -> str:
    m = _VERSION_RE.search(text)
    return m.group(1) if m else default


def parse_mobalytics(text: str, version_hint: Optional[str] = None) -> dict:
    """Converte o .txt da tierlist da Mobalytics em estrutura canônica."""
    version = detect_version(text, default=version_hint or "unknown")
    lines = [ln.strip() for ln in text.splitlines()]

    # Localiza o marcador "Search..." (ou "Mobalytics Genshin Impact Tier List") antes do primeiro "S"
    start_idx = 0
    for i, line in enumerate(lines):
        if line.lower() == "search...":
            start_idx = i + 1
            break

    raw_entries: list[dict] = []
    current_tier: Optional[str] = None

    for line in lines[start_idx:]:
        if not line:
            continue
        low = line.lower()
        if current_tier is not None and any(low.startswith(p) for p in _STOP_PREFIXES):
            break

        if line in MOBALYTICS_SCALE:
            current_tier = line
            continue

        if current_tier is None:
            continue

        # Ignora eventuais linhas de UI/frases longas
        if len(line) > 35 or ":" in line:
            continue

        slug = normalize_character_slug(line)
        if slug:
            raw_entries.append({
                "character_slug": slug,
                "role": "",
                "tier_label": current_tier,
            })

    if not raw_entries:
        raise ValueError("Nenhuma entrada de personagem encontrada no .txt da Mobalytics.")

    return {
        "site_slug": "mobalytics",
        "version": version,
        "scale": MOBALYTICS_SCALE,
        "entries": dedupe_best_tier(raw_entries, MOBALYTICS_SCALE),
        "raw_entries": raw_entries,
    }
