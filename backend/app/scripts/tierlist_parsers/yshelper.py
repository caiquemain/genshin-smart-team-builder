"""Parser para páginas HTML salvas do YS Helper (Spiral Abyss / Stygian Onslaught).

Formato esperado (Salvar Página Como -> HTML do navegador):
  - `<title>7.2 Spiral Abyss Usage Statistics</title>` ou
    `<title>7.2 Stygian Onslaught Usage Statistics</title>`
  - Container `<uni-view ... class="rank_list">` contendo blocos `<uni-view ... class="rank">`
  - Cada bloco inicia com `<uni-view ... class="rank_...">S+</uni-view>` (S+, S, A, B, C)
  - Cada personagem é um `<uni-view ... data-ename="Furina" data-use_rate="90.5" data-own_rate="93.9" ...>`
"""
from html import unescape
import re
from typing import Optional

from .common import dedupe_best_tier, normalize_character_slug

YSHELPER_SCALE = ["S+", "S", "A", "B", "C"]

_TITLE_VERSION_RE = re.compile(r"<title[^>]*>[^<]*?(\d+\.\d+)", re.IGNORECASE)
_RANK_LIST_RE = re.compile(
    r'<uni-view\b[^>]*class="rank_list"[^>]*>(.*?)</uni-scroll-view>',
    re.DOTALL | re.IGNORECASE,
)
_RANK_BLOCK_SPLIT_RE = re.compile(r'<uni-view\b[^>]*class="rank"[^>]*>', re.IGNORECASE)
_TIER_LABEL_RE = re.compile(
    r'<uni-view\b[^>]*class="rank_[^"]*"[^>]*>\s*([^<]+?)\s*</uni-view>',
    re.IGNORECASE,
)
_CHAR_TAG_RE = re.compile(r'<uni-view\b[^>]*data-ename="[^"]+"[^>]*>', re.IGNORECASE)
_ATTR_RE = re.compile(r'data-([a-z0-9_]+)="([^"]*)"', re.IGNORECASE)


def detect_version(html: str, default: str = "unknown") -> str:
    m = _TITLE_VERSION_RE.search(html)
    return m.group(1) if m else default


def _parse_float(val: Optional[str]) -> Optional[float]:
    if not val:
        return None
    try:
        return float(val)
    except ValueError:
        return None


def parse_yshelper_html(
    html: str,
    version_hint: Optional[str] = None,
    site_slug: str = "yshelper-abyss",
) -> dict:
    """Extrai tiers e taxas de uso/posse do HTML do YS Helper."""
    version = detect_version(html, default=version_hint or "unknown")

    m_list = _RANK_LIST_RE.search(html)
    scope = m_list.group(1) if m_list else html

    blocks = _RANK_BLOCK_SPLIT_RE.split(scope)[1:]
    if not blocks:
        raise ValueError("Nenhum bloco class=\"rank\" encontrado no HTML do YS Helper.")

    raw_entries: list[dict] = []
    meta_by_slug: dict[str, dict] = {}

    for block in blocks:
        m_tier = _TIER_LABEL_RE.search(block)
        if not m_tier:
            continue
        tier_label = unescape(m_tier.group(1)).strip()
        if tier_label not in YSHELPER_SCALE:
            continue

        for tag in _CHAR_TAG_RE.findall(block):
            attrs = {k.lower(): unescape(v).strip() for k, v in _ATTR_RE.findall(tag)}
            ename = attrs.get("ename") or attrs.get("role") or ""
            slug = normalize_character_slug(ename)
            if not slug:
                continue
            entry = {
                "character_slug": slug,
                "role": "",  # YS Helper não separa por role; importador aplica fallback do genshin-gg
                "tier_label": tier_label,
                "use_rate": _parse_float(attrs.get("use_rate")),
                "own_rate": _parse_float(attrs.get("own_rate")),
            }
            raw_entries.append(entry)
            meta_by_slug.setdefault(
                slug,
                {"use_rate": entry["use_rate"], "own_rate": entry["own_rate"]},
            )

    deduped = dedupe_best_tier(raw_entries, YSHELPER_SCALE)
    for item in deduped:
        meta = meta_by_slug.get(item["character_slug"], {})
        item["use_rate"] = meta.get("use_rate")
        item["own_rate"] = meta.get("own_rate")

    return {
        "site_slug": site_slug,
        "version": version,
        "scale": YSHELPER_SCALE,
        "entries": deduped,
        "raw_entries": raw_entries,
    }


def parse_yshelper_abyss(html: str, version_hint: Optional[str] = None) -> dict:
    return parse_yshelper_html(html, version_hint=version_hint, site_slug="yshelper-abyss")


def parse_yshelper_stygian(html: str, version_hint: Optional[str] = None) -> dict:
    return parse_yshelper_html(html, version_hint=version_hint, site_slug="yshelper-stygian")
