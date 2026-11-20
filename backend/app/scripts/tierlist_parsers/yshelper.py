"""Parser para páginas HTML salvas do YS Helper (Spiral Abyss / Stygian Onslaught).

Formato esperado (Salvar Página Como -> HTML do navegador):
  - `<title>7.2 Spiral Abyss Usage Statistics</title>` ou
    `<title>7.2 Stygian Onslaught Usage Statistics</title>`
  - Container `<uni-view ... class="rank_list">` contendo blocos `<uni-view ... class="rank">`
  - Cada bloco inicia com `<uni-view ... class="rank_...">S+</uni-view>` (S+, S, A, B, C)
  - Cada personagem é um `<uni-view ... data-ename="Furina" data-use_rate="90.5" data-own_rate="93.9" ...>`
  - Aba `Team Comp` (`class="tab_list"`) contém até 100 times reais mais usados com
    avatares (`background-image: url(...)`) correlacionáveis via `data-avatar` do `.rank_list`.
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

_TEAM_COMP_SECTION_RE = re.compile(
    r'>\s*Team Comp\s*<.*?class="tab_list"[^>]*>(.*?)</uni-scroll-view>',
    re.DOTALL | re.IGNORECASE,
)
_TEAM_ITEM_SPLIT_RE = re.compile(r'class="tab_item clickable"[^>]*>', re.IGNORECASE)
_BG_URL_RE = re.compile(r'background-image:\s*url\((?:&quot;|"|\')([^&"\']+)(?:&quot;|"|\')\)')
_RATE_CELL_RE = re.compile(r'class="tab_line tab_14[^"]*"[^>]*>\s*([^<]+?)\s*<', re.IGNORECASE)


def detect_version(html: str, default: str = "unknown") -> str:
    m = _TITLE_VERSION_RE.search(html)
    return m.group(1) if m else default


def _parse_float(val: Optional[str]) -> Optional[float]:
    if not val:
        return None
    try:
        return float(val.strip().rstrip("%"))
    except ValueError:
        return None


def _build_avatar_maps(html: str) -> tuple[dict[str, str], dict[str, str]]:
    """Retorna (avatar_url -> slug, slug -> display_name) a partir dos cards do .rank_list."""
    avatar_to_slug: dict[str, str] = {}
    slug_to_name: dict[str, str] = {}
    for tag in _CHAR_TAG_RE.findall(html):
        attrs = {k.lower(): unescape(v).strip() for k, v in _ATTR_RE.findall(tag)}
        ename = attrs.get("ename") or attrs.get("role") or ""
        slug = normalize_character_slug(ename)
        avatar = attrs.get("avatar") or ""
        if slug:
            slug_to_name.setdefault(slug, ename)
            if avatar:
                avatar_to_slug[avatar] = slug
    return avatar_to_slug, slug_to_name


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


def _infer_sibling_slot_alternatives(all_teams: list[dict], max_per_slot: int = 5) -> None:
    """Infere substitutos por slot comparando times que compartilham 3 de 4 personagens.

    Opera in-place adicionando `slot_alternatives` (chaves '1'..'4') ordenado por
    `use_rate` decrescente do time irmão.
    """
    sets = [set(t["character_slugs"]) for t in all_teams]
    for i, t_a in enumerate(all_teams):
        slugs_a = t_a["character_slugs"]
        set_a = sets[i]
        alts_by_pos: dict[str, list[tuple[float, str]]] = {}

        for j, t_b in enumerate(all_teams):
            if i == j:
                continue
            diff_a = set_a - sets[j]
            diff_b = sets[j] - set_a
            if len(diff_a) == 1 and len(diff_b) == 1:
                replaced_slug = next(iter(diff_a))
                alt_slug = next(iter(diff_b))
                pos = str(slugs_a.index(replaced_slug) + 1)
                alts_by_pos.setdefault(pos, []).append((t_b.get("use_rate") or 0.0, alt_slug))

        slot_alternatives: dict[str, list[str]] = {}
        for pos, candidates in alts_by_pos.items():
            candidates.sort(key=lambda x: x[0], reverse=True)
            seen: set[str] = set()
            ordered: list[str] = []
            for _, alt in candidates:
                if alt not in seen:
                    seen.add(alt)
                    ordered.append(alt)
                if len(ordered) >= max_per_slot:
                    break
            if ordered:
                slot_alternatives[pos] = ordered
        t_a["slot_alternatives"] = slot_alternatives


def parse_yshelper_teams(
    html: str,
    version_hint: Optional[str] = None,
    site_slug: str = "yshelper-abyss",
    min_use_rate: float = 3.0,
) -> dict:
    """Extrai os times reais mais usados da aba `Team Comp` do HTML do YS Helper.

    Infere `slot_alternatives` (irmãos 3/4) usando TODOS os times da página antes
    de filtrar por `min_use_rate`, preservando substitutos reais mesmo de variações
    menos frequentes sem poluir a lista principal de templates.
    """
    version = detect_version(html, default=version_hint or "unknown")
    avatar_to_slug, slug_to_name = _build_avatar_maps(html)

    m_tc = _TEAM_COMP_SECTION_RE.search(html)
    if not m_tc:
        return {
            "site_slug": site_slug,
            "version": version,
            "source_name": _format_source_name(site_slug, version),
            "teams": [],
            "total_parsed": 0,
        }

    is_abyss = "abyss" in site_slug
    mode_label = "Abismo" if is_abyss else "Stygian Onslaught"
    source_name = _format_source_name(site_slug, version)

    items = _TEAM_ITEM_SPLIT_RE.split(m_tc.group(1))[1:]
    all_teams: list[dict] = []
    seen_canonical: set[tuple[str, ...]] = set()

    for rank_idx, item in enumerate(items, start=1):
        urls = [unescape(u) for u in _BG_URL_RE.findall(item)]
        slugs = [avatar_to_slug.get(u) for u in urls[:4]]
        if len(slugs) != 4 or any(s is None for s in slugs):
            continue
        if len(set(slugs)) != 4:
            continue
        canonical = tuple(sorted(slugs))
        if canonical in seen_canonical:
            continue
        seen_canonical.add(canonical)

        rates = [r.strip() for r in _RATE_CELL_RE.findall(item)]
        use_rate = _parse_float(rates[0]) if len(rates) >= 1 else 0.0
        # Abyss tem [Use Rate, Usage Rate, Own Rate, 1st/2nd Half]; Stygian tem [Use Rate, Own Rate]
        own_rate = (
            _parse_float(rates[2]) if (is_abyss and len(rates) >= 3)
            else (_parse_float(rates[1]) if (not is_abyss and len(rates) >= 2) else None)
        )
        names = [slug_to_name.get(s, s.replace("-", " ").title()) for s in slugs]
        raw_line = " — ".join(names)
        desc = f"Meta real {mode_label} {version} — uso {use_rate:.1f}%"
        if own_rate is not None:
            desc += f" (posse {own_rate:.1f}%)"

        all_teams.append({
            "rank": rank_idx,
            "character_slugs": list(slugs),
            "main_character": slugs[0],
            "raw_line": raw_line,
            "description": desc,
            "use_rate": use_rate or 0.0,
            "own_rate": own_rate,
            "slot_alternatives": {},
        })

    _infer_sibling_slot_alternatives(all_teams)

    filtered = [t for t in all_teams if (t.get("use_rate") or 0.0) >= min_use_rate]
    return {
        "site_slug": site_slug,
        "version": version,
        "source_name": source_name,
        "teams": filtered,
        "total_parsed": len(all_teams),
    }


def _format_source_name(site_slug: str, version: str) -> str:
    prefix = "YS Abyss" if "abyss" in site_slug else "YS Stygian"
    return f"{prefix} {version}" if version and version != "unknown" else prefix


def parse_yshelper_abyss(html: str, version_hint: Optional[str] = None) -> dict:
    return parse_yshelper_html(html, version_hint=version_hint, site_slug="yshelper-abyss")


def parse_yshelper_stygian(html: str, version_hint: Optional[str] = None) -> dict:
    return parse_yshelper_html(html, version_hint=version_hint, site_slug="yshelper-stygian")
