"""Parser para a tierlist do GenshinLab (genshinlab.com/tier-list/).

Formato esperado do .txt (Ctrl+A -> Ctrl+C da página):
  - Cabeçalho: `All Characters 7.2 Tier List` (ou `Genshin Impact 7.2 Tier List`)
  - Tiers em linha isolada: `SS`, `S`, `A`, `B`, `C`, `D`
  - Cada personagem normal aparece como um par de 2 linhas:
      1. Texto alt da imagem (ex.: `Genshin_Lauma_t`, `Xilonen (60 x 60 )`, `test`)
      2. Nome de exibição (ex.: `Lauma`, `Xilonen`, `Raiden`)
  - Variantes do Traveler aparecem como tripla de 3 linhas:
      1. Alt da imagem (ex.: `Traveler (Geo)`)
      2. `Traveler`
      3. `(Cryo)` / `(Pyro)` / `(Dendro)` / ...
"""
import re
from typing import Optional

from .common import dedupe_best_tier, normalize_character_slug

GENSHINLAB_SCALE = ["SS", "S", "A", "B", "C", "D"]

_VERSION_RE = re.compile(
    r"(?:Genshin Impact|All Characters)\s+(\d+\.\d+)\s+Tier List",
    re.IGNORECASE,
)
_TABLE_START_RE = re.compile(r"All Characters\s+\d+\.\d+\s+Tier List", re.IGNORECASE)
_ELEM_PAREN_RE = re.compile(r"^\((Anemo|Geo|Electro|Dendro|Hydro|Pyro|Cryo)\)$", re.IGNORECASE)


def detect_version(text: str, default: str = "unknown") -> str:
    m = _VERSION_RE.search(text)
    return m.group(1) if m else default


def parse_genshinlab(text: str, version_hint: Optional[str] = None) -> dict:
    """Converte o .txt da tierlist do GenshinLab em estrutura canônica."""
    version = detect_version(text, default=version_hint or "unknown")
    lines = [ln.strip() for ln in text.splitlines()]

    # Localiza o início da lista ("All Characters X.Y Tier List") ou primeiro "SS"
    start_idx = 0
    for i, line in enumerate(lines):
        if _TABLE_START_RE.search(line):
            start_idx = i + 1
            break
    else:
        for i, line in enumerate(lines):
            if line == "SS":
                start_idx = i
                break

    raw_entries: list[dict] = []
    current_tier: Optional[str] = None
    i = start_idx
    n = len(lines)

    while i < n:
        line = lines[i]
        if not line:
            i += 1
            continue

        # Fim da tabela (rodapé do site)
        if current_tier is not None and (
            line.lower() == "genshinlab"
            or line.startswith("©")
            or line.lower().startswith("playwire")
        ):
            break

        if line in GENSHINLAB_SCALE:
            current_tier = line
            i += 1
            continue

        if current_tier is None:
            i += 1
            continue

        # Caso especial: Traveler em 3 linhas [img_alt, "Traveler", "(Element)"]
        if (
            i + 2 < n
            and lines[i + 1].lower() == "traveler"
            and _ELEM_PAREN_RE.match(lines[i + 2])
        ):
            slug = normalize_character_slug(f"Traveler {lines[i + 2]}")
            if slug:
                raw_entries.append({
                    "character_slug": slug,
                    "role": "",
                    "tier_label": current_tier,
                })
            i += 3
            continue

        # Personagem padrão em 2 linhas [img_alt, display_name]
        if i + 1 < n and lines[i + 1] and lines[i + 1] not in GENSHINLAB_SCALE:
            display_name = lines[i + 1]
            slug = normalize_character_slug(display_name)
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
        raise ValueError("Nenhuma entrada de personagem encontrada no .txt do GenshinLab.")

    return {
        "site_slug": "genshinlab",
        "version": version,
        "scale": GENSHINLAB_SCALE,
        "entries": dedupe_best_tier(raw_entries, GENSHINLAB_SCALE),
        "raw_entries": raw_entries,
    }
