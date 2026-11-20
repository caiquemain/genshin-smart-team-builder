"""Parser para a tierlist da Icy Veins (icy-veins.com/genshin-impact/tier-list).

Formato esperado do .txt (Ctrl+A -> Ctrl+C da página):
  - Cabeçalho da tabela: `Main DPS\tSub DPS\tSupport`
  - Cada tier inicia em uma linha `<TIER>\t` (`S+`, `S`, `A`, `B`, `C`, `D`)
  - Dentro de cada tier, as colunas são separadas por uma linha terminada em `\t`
    (último personagem da coluna Main DPS e último da coluna Sub DPS).
  - Personagens podem aparecer em múltiplas colunas (ex.: Furina S+ Sub DPS e S Support);
    o parser preserva `raw_entries` completo e entrega `entries` deduplicado pelo
    melhor tier de cada personagem (1 voto por site no consenso).
"""
import re
from typing import Optional

from .common import dedupe_best_tier, normalize_character_slug

ICY_VEINS_SCALE = ["S+", "S", "A", "B", "C", "D"]
ROLE_COLUMNS = ["main_dps", "sub_dps", "support"]

_VERSION_RE = re.compile(
    r"(?:Version\s+|Tier List\s*\()(\d+\.\d+)\)?",
    re.IGNORECASE,
)


def detect_version(text: str, default: str = "unknown") -> str:
    m = _VERSION_RE.search(text)
    return m.group(1) if m else default


def _is_table_header(line: str) -> bool:
    parts = [p.strip().lower() for p in line.split("\t") if p.strip()]
    return parts == ["main dps", "sub dps", "support"]


def _is_tier_start(line: str) -> Optional[str]:
    stripped = line.strip()
    if stripped in ICY_VEINS_SCALE and "\t" in line:
        return stripped
    return None


def parse_icy_veins(text: str, version_hint: Optional[str] = None) -> dict:
    """Converte o .txt da tierlist da Icy Veins em estrutura canônica."""
    version = detect_version(text, default=version_hint or "unknown")
    lines = text.splitlines()

    # Localiza a linha "Main DPS\tSub DPS\tSupport"
    start_idx = None
    for i, line in enumerate(lines):
        if _is_table_header(line):
            start_idx = i + 1
            break

    if start_idx is None:
        raise ValueError("Cabeçalho da tabela 'Main DPS\\tSub DPS\\tSupport' não encontrado.")

    raw_entries: list[dict] = []
    current_tier: Optional[str] = None
    col_idx = 0

    for line in lines[start_idx:]:
        tier_label = _is_tier_start(line)
        if tier_label is not None:
            current_tier = tier_label
            col_idx = 0
            continue

        if current_tier is None:
            continue

        # Fim da tabela (parágrafo explicativo ou seção 2)
        stripped = line.strip()
        if not stripped:
            continue
        if (
            len(stripped) > 45
            or stripped.startswith("2.")
            or stripped.lower().startswith("tier lists can be")
        ):
            break

        # Linha pode terminar com \t indicando transição para a próxima coluna
        ends_col = line.endswith("\t")
        # Caso raro: dois nomes na mesma linha separados por \t
        cells = [c.strip() for c in line.split("\t")]
        if ends_col and cells and cells[-1] == "":
            cells = cells[:-1]

        for idx_in_line, cell in enumerate(cells):
            if cell and col_idx < len(ROLE_COLUMNS):
                slug = normalize_character_slug(cell)
                if slug:
                    raw_entries.append({
                        "character_slug": slug,
                        "role": ROLE_COLUMNS[col_idx],
                        "tier_label": current_tier,
                    })
            if idx_in_line < len(cells) - 1:
                col_idx = min(col_idx + 1, len(ROLE_COLUMNS) - 1)

        if ends_col:
            col_idx = min(col_idx + 1, len(ROLE_COLUMNS) - 1)

    deduped = dedupe_best_tier(raw_entries, ICY_VEINS_SCALE)
    return {
        "site_slug": "icy-veins",
        "version": version,
        "scale": ICY_VEINS_SCALE,
        "entries": deduped,
        "raw_entries": raw_entries,
    }
