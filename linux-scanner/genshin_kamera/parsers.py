"""Parsers puros (EN e PT) do OCR para o formato GOOD v2 (compatível com rogerioth/Inventory_Kamera)."""
from datetime import datetime
import json
from pathlib import Path
import re
from typing import Any, Optional

from . import __version__
from .catalog import GameCatalog, norm_text, to_good_key

# --- Slots de Artefato (EN + PT) ---
SLOT_KEYWORDS: list[tuple[str, str]] = [
    ("flower", "flower"),
    ("flor", "flower"),
    ("plume", "plume"),
    ("pluma", "plume"),
    ("pena", "plume"),
    ("sands", "sands"),
    ("areia", "sands"),
    ("ampulheta", "sands"),
    ("goblet", "goblet"),
    ("calice", "goblet"),
    ("circlet", "circlet"),
    ("tiara", "circlet"),
    ("coroa", "circlet"),
]

# --- Main Stats e Substats (EN + PT) ---
STAT_NAME_MAP: list[tuple[str, str]] = [
    ("pyrodmg", "pyro_dmg_"),
    ("danopyro", "pyro_dmg_"),
    ("hydrodmg", "hydro_dmg_"),
    ("danohydro", "hydro_dmg_"),
    ("cryodmg", "cryo_dmg_"),
    ("danocryo", "cryo_dmg_"),
    ("electrodmg", "electro_dmg_"),
    ("danoelectro", "electro_dmg_"),
    ("anemodmg", "anemo_dmg_"),
    ("danoanemo", "anemo_dmg_"),
    ("geodmg", "geo_dmg_"),
    ("danogeo", "geo_dmg_"),
    ("dendrodmg", "dendro_dmg_"),
    ("danodendro", "dendro_dmg_"),
    ("physicaldmg", "physical_dmg_"),
    ("danofisico", "physical_dmg_"),
    ("healingbonus", "heal_"),
    ("bonusdecura", "heal_"),
    ("critrate", "critRate_"),
    ("taxacrit", "critRate_"),
    ("critdmg", "critDMG_"),
    ("danocrit", "critDMG_"),
    ("energyrecharge", "enerRech_"),
    ("recargadeenergia", "enerRech_"),
    ("elementalmastery", "eleMas"),
    ("proficienciaelemental", "eleMas"),
    ("proficiencia", "eleMas"),
]


def parse_slot_key(ocr_text: str) -> Optional[str]:
    nk = norm_text(ocr_text)
    if not nk:
        return None
    for kw, slot in SLOT_KEYWORDS:
        if kw in nk:
            return slot
    return None


def parse_stat_key(raw_label: str, is_percent: bool, slot_key: Optional[str] = None) -> Optional[str]:
    """Converte o texto de stat (EN/PT) na chave GOOD oficial (`hp`, `hp_`, `critRate_`, etc.)."""
    nk = norm_text(raw_label)
    if not nk:
        return None
    for kw, good_key in STAT_NAME_MAP:
        if kw in nk:
            return good_key

    # HP / ATK / DEF: depende de is_percent (ou do slot quando for main stat de Flor/Pena!)
    if nk in ("hp", "vida") or nk.startswith("hp") or nk.startswith("vida"):
        if slot_key == "flower":
            return "hp"
        return "hp_" if is_percent else "hp"
    if nk in ("atk", "atq", "ataque") or nk.startswith("atk") or nk.startswith("atq"):
        if slot_key == "plume":
            return "atk"
        return "atk_" if is_percent else "atk"
    if nk in ("def", "defesa") or nk.startswith("def"):
        return "def_" if is_percent else "def"
    return None


def parse_main_stat_key(ocr_text: str, slot_key: Optional[str] = None) -> Optional[str]:
    if slot_key == "flower":
        return "hp"
    if slot_key == "plume":
        return "atk"
    # Em Sands/Goblet/Circlet, HP/ATK/DEF são sempre % (nunca flat)
    return parse_stat_key(ocr_text, is_percent=True, slot_key=slot_key)


def parse_artifact_level(ocr_text: str) -> int:
    """Extrai nível de artefato (`+20`, `+0`, `+16`) ou retorna -1 se ilegível."""
    m = re.search(r"\+?\s*(\d{1,2})", ocr_text or "")
    if not m:
        return -1
    lv = int(m.group(1))
    if 0 <= lv <= 20:
        return lv
    return -1


SUBSTAT_LINE_RE = re.compile(
    r"^[•·\-\*\+]?\s*(.+?)\s*[\+:]\s*(\d+(?:[.,]\d+)?)\s*(%?)(.*)$"
)


def parse_artifact_substats(
    ocr_text: str,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Extrai `(substats, unactivated_substats)` de um bloco OCR (EN ou PT).

    Também detecta a 4ª linha `(unactivated)` / `(não ativado)` introduzida no Genshin 6.0+.
    """
    active: list[dict[str, Any]] = []
    unactivated: list[dict[str, Any]] = []
    seen_keys: set[str] = set()

    for raw_line in (ocr_text or "").splitlines():
        line = raw_line.strip()
        if not line or len(line) < 4:
            continue

        # Ignora linhas de descrição do bônus de 2pc/4pc que às vezes entram na borda inferior
        low = norm_text(line)
        if "2piece" in low or "4piece" in low or "conjuntode2" in low or "conjuntode4" in low:
            break

        m = SUBSTAT_LINE_RE.match(line)
        if not m:
            continue

        label, num_str, pct_sign, trailing = m.groups()
        try:
            val = float(num_str.replace(",", "."))
        except ValueError:
            continue

        is_unactivated = (
            "unactivated" in low
            or "naoativado" in low
            or "aserativado" in low
            or "inativo" in low
            or "unactivated" in norm_text(trailing)
        )
        is_pct = pct_sign == "%"
        key = parse_stat_key(label, is_percent=is_pct)
        if not key or key in seen_keys:
            continue

        # Sanity check de valores (protege contra OCR que perde o ponto decimal: ex. "105%" -> 10.5%)
        if key in ("critRate_", "critDMG_", "atk_", "hp_", "def_", "enerRech_") and val > 65.0:
            val = round(val / 10.0, 1)

        seen_keys.add(key)
        entry = {"key": key, "value": round(val, 1) if is_pct else int(round(val))}
        if is_unactivated:
            unactivated.append(entry)
        else:
            active.append(entry)

    return active[:4], unactivated[:1]


def parse_equipped_character(ocr_text: str, catalog: GameCatalog) -> str:
    """Extrai a chave GOOD do personagem em `'Equipped: Furina'` / `'Equipado por: Furina'`.

    Exige o prefixo `Equipped`/`Equipado` e correspondência real no catálogo de personagens
    para nunca confundir linhas da descrição de 4 peças com nomes de personagem.
    """
    text = (ocr_text or "").strip()
    if not text:
        return ""
    m = re.match(r"^(?:equipped|equipado(?:\s+por)?)\s*:?\s*(.+)$", text, flags=re.IGNORECASE)
    if not m:
        return ""
    cleaned = m.group(1).strip()
    if not cleaned:
        return ""
    return catalog.match("characters", cleaned, cutoff=0.70) or ""


def parse_weapon_level_and_ascension(ocr_text: str) -> tuple[int, int]:
    """Parseia `'Lv. 90/90'`, `'Nv. 80/90'` -> `(level, ascension)`."""
    m = re.search(r"(\d{1,2})\s*/\s*(\d{2})", ocr_text or "")
    if not m:
        m2 = re.search(r"(\d{1,2})", ocr_text or "")
        if not m2:
            return 1, 0
        lv = max(1, min(90, int(m2.group(1))))
        return lv, infer_ascension(lv, lv)

    lv = max(1, min(90, int(m.group(1))))
    cap = int(m.group(2))
    return lv, infer_ascension(lv, cap)


def infer_ascension(level: int, cap: int) -> int:
    cap_map = {20: 0, 40: 1, 50: 2, 60: 3, 70: 4, 80: 5, 90: 6}
    if cap in cap_map:
        return cap_map[cap]
    if level > 80:
        return 6
    if level > 70:
        return 5
    if level > 60:
        return 4
    if level > 50:
        return 3
    if level > 40:
        return 2
    if level > 20:
        return 1
    return 0


def parse_refinement(ocr_text: str) -> int:
    m = re.search(r"([1-5])", ocr_text or "")
    return int(m.group(1)) if m else 1


def parse_item_count_header(ocr_text: str) -> int:
    """Extrai o contador de itens no cabeçalho do inventário (ex.: `'342/2100'` -> `342`)."""
    m = re.search(r"(\d{1,4})\s*/\s*\d{3,4}", ocr_text or "")
    if m:
        return int(m.group(1))
    m2 = re.search(r"(\d{1,4})", ocr_text or "")
    return int(m2.group(1)) if m2 else 0


def parse_material_quantity(ocr_text: str) -> int:
    """Extrai quantidade de um material (`'Owned: 1,234'`, `'Possuído: 450'`, `'×82'`)."""
    cleaned = (ocr_text or "").replace(",", "").replace(".", "")
    m = re.search(r"(\d+)", cleaned)
    return int(m.group(1)) if m else 0


def build_good_v2_payload(
    *,
    characters: Optional[list[dict[str, Any]]] = None,
    weapons: Optional[list[dict[str, Any]]] = None,
    artifacts: Optional[list[dict[str, Any]]] = None,
    materials: Optional[dict[str, int]] = None,
) -> dict[str, Any]:
    """Monta o JSON no formato exato `GOOD v2` do `rogerioth/Inventory_Kamera`."""
    payload: dict[str, Any] = {
        "format": "GOOD",
        "version": 2,
        "kamera_version": f"{__version__}-linux",
        "source": "Inventory_Kamera_Linux",
    }
    if characters is not None:
        payload["characters"] = characters
    if weapons is not None:
        payload["weapons"] = weapons
    if artifacts is not None:
        payload["artifacts"] = artifacts
    if materials is not None:
        payload["materials"] = materials
    return payload


def write_good_json(payload: dict[str, Any], output_dir: Path) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y_%m_%d_%H_%M")
    out_path = output_dir / f"genshinData_GOOD_{ts}.json"
    out_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    return out_path
