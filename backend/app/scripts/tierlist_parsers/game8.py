"""Parser para a tierlist da Game8 (game8.co/games/Genshin-Impact/archives/297499).

Formato esperado do .txt (Ctrl+A -> Ctrl+C da página):
  - Cabeçalho da tabela: `Main DPS\tSub-DPS\tSupport`
  - Cada tier inicia em `<TIER> Tier` (`SS Tier`, `S Tier`, `A+ Tier`, `A Tier`, `B Tier`, `C Tier`, `D Tier`)
  - Dentro de cada tier, as 3 linhas contêm tokens contíguos no formato:
      `Genshin - <Nome> (DPS|Sub-DPS|Support) Rank`
  - Personagens podem aparecer em múltiplas colunas; o parser preserva `raw_entries`
    e entrega `entries` deduplicado pelo melhor tier (1 voto justo no consenso).
"""
import re
from typing import Optional

from .common import dedupe_best_tier, normalize_character_slug

GAME8_SCALE = ["SS", "S", "A+", "A", "B", "C", "D"]

_VERSION_RE = re.compile(r"(?:Version\s+|-\s+)(\d+\.\d+)(?:\s+Tier List)?", re.IGNORECASE)
_TIER_HEADER_RE = re.compile(r"^(SS|S|A\+|A|B|C|D)\s+Tier\b", re.IGNORECASE)
_TOKEN_RE = re.compile(
    r"Genshin\s*-\s*(.+?)\s+(Main\s*DPS|Sub-DPS|Sub\s*DPS|DPS|Support)\s+Rank",
    re.IGNORECASE,
)

_ROLE_MAP = {
    "dps": "main_dps",
    "main dps": "main_dps",
    "sub-dps": "sub_dps",
    "sub dps": "sub_dps",
    "support": "support",
}


def detect_version(text: str, default: str = "unknown") -> str:
    m = _VERSION_RE.search(text)
    return m.group(1) if m else default


def _is_table_header(line: str) -> bool:
    parts = [p.strip().lower() for p in line.split("\t") if p.strip()]
    return parts in (
        ["main dps", "sub-dps", "support"],
        ["main dps", "sub dps", "support"],
    )


def parse_game8(text: str, version_hint: Optional[str] = None) -> dict:
    """Converte o .txt da tierlist da Game8 em estrutura canônica."""
    version = detect_version(text, default=version_hint or "unknown")
    lines = text.splitlines()

    start_idx = None
    for i, line in enumerate(lines):
        if _is_table_header(line):
            start_idx = i + 1
            break

    if start_idx is None:
        raise ValueError("Cabeçalho da tabela 'Main DPS\\tSub-DPS\\tSupport' não encontrado no .txt da Game8.")

    raw_entries: list[dict] = []
    current_tier: Optional[str] = None

    for line in lines[start_idx:]:
        stripped = line.strip()
        if not stripped:
            continue

        m_tier = _TIER_HEADER_RE.match(stripped)
        if m_tier:
            tier_upper = m_tier.group(1).upper()
            if tier_upper in GAME8_SCALE:
                current_tier = tier_upper
                continue

        if current_tier is None:
            continue

        matches = _TOKEN_RE.findall(stripped)
        if matches:
            for raw_name, raw_role in matches:
                slug = normalize_character_slug(raw_name)
                role = _ROLE_MAP.get(re.sub(r"\s+", " ", raw_role.strip().lower()), "general")
                if slug:
                    raw_entries.append({
                        "character_slug": slug,
                        "role": role,
                        "tier_label": current_tier,
                    })
        else:
            # Saiu da tabela principal (ex.: "Tier list has been updated..." ou texto explicativo)
            break

    if not raw_entries:
        raise ValueError("Nenhuma entrada de personagem encontrada no .txt da Game8.")

    return {
        "site_slug": "game8",
        "version": version,
        "scale": GAME8_SCALE,
        "entries": dedupe_best_tier(raw_entries, GAME8_SCALE),
        "raw_entries": raw_entries,
    }
