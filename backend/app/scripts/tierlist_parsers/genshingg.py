"""Parser para a tierlist do Genshin.gg (genshin.gg/tier-list/).

Formato esperado do .txt (Ctrl+A -> Ctrl+C da página):
  - Linha de versão: `Version 7.2`
  - Cabeçalho de cada tier em linha isolada: `S`, `A`, `B`, `C`, `D`
  - Cada personagem vem em um bloco de 3 linhas:
      1. `<Nome>C[0-6]?<Elemento>`  (ex.: `FurinaC0Hydro`, `RaidenCElectro`)
      2. `<Nome>`                   (ex.: `Furina`, `Traveler (Cryo)`)
      3. `<Role>`                   (`Main DPS`, `DPS`, `Sub DPS`, `Support`)
"""
import re
from typing import Optional

from .common import dedupe_best_tier, normalize_character_slug

GENSHINGG_SCALE = ["S", "A", "B", "C", "D"]

_VERSION_RE = re.compile(r"Version\s+(\d+\.\d+)", re.IGNORECASE)
_CARD_HEADER_RE = re.compile(
    r"^.+?C[0-6]?(?:Anemo|Cryo|Dendro|Electro|Geo|Hydro|Pyro)$"
)

_ROLE_MAP: dict[str, str] = {
    "main dps": "main_dps",
    "dps": "main_dps",
    "sub dps": "sub_dps",
    "sub-dps": "sub_dps",
    "support": "support",
}


def detect_version(text: str, default: str = "unknown") -> str:
    m = _VERSION_RE.search(text)
    return m.group(1) if m else default


def parse_genshingg(text: str, version_hint: Optional[str] = None) -> dict:
    """Converte o .txt da tierlist do Genshin.gg em estrutura canônica."""
    version = detect_version(text, default=version_hint or "unknown")
    lines = [ln.strip() for ln in text.splitlines()]

    raw_entries: list[dict] = []
    current_tier: Optional[str] = None
    i = 0
    n = len(lines)

    while i < n:
        line = lines[i]
        if not line:
            i += 1
            continue

        # Fim da listagem (rodapé do site)
        if current_tier is not None and (
            line.lower() == "brand"
            or line.lower().startswith("genshin.gg is not affiliated")
        ):
            break

        # Cabeçalho de tier (S, A, B, C, D) — só ativa se a próxima linha não-vazia
        # for um card de personagem (`<Nome>C0<Elemento>`) ou já estivermos na tabela
        if line in GENSHINGG_SCALE:
            # Verifica lookahead para não confundir letra solta no topo da página
            j = i + 1
            while j < n and not lines[j]:
                j += 1
            if j < n and _CARD_HEADER_RE.match(lines[j]):
                current_tier = line
                i += 1
                continue

        if current_tier is not None and _CARD_HEADER_RE.match(line):
            # Padrão de 3 linhas: [header, name, role]
            if i + 2 < n:
                name_line = lines[i + 1]
                role_line = lines[i + 2].lower()
                role = _ROLE_MAP.get(role_line)
                if role is not None and name_line:
                    slug = normalize_character_slug(name_line)
                    if slug:
                        raw_entries.append({
                            "character_slug": slug,
                            "role": role,
                            "tier_label": current_tier,
                        })
                    i += 3
                    continue

        i += 1

    if not raw_entries:
        raise ValueError("Nenhuma entrada de personagem encontrada no .txt do Genshin.gg.")

    return {
        "site_slug": "genshin-gg",
        "version": version,
        "scale": GENSHINGG_SCALE,
        "entries": dedupe_best_tier(raw_entries, GENSHINGG_SCALE),
        "raw_entries": raw_entries,
    }
