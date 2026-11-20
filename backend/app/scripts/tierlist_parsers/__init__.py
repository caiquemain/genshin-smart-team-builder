"""Registro de fontes de tierlist e mapeamento para a escala master (S+/S/A/B/C/D)."""
from dataclasses import dataclass
from typing import Callable, Optional

from .common import dedupe_best_tier, normalize_character_slug, parse_canonical_csv
from .genshingg import GENSHINGG_SCALE, parse_genshingg
from .genshinlab import GENSHINLAB_SCALE, parse_genshinlab
from .icy_veins import ICY_VEINS_SCALE, parse_icy_veins
from .yshelper import (
    YSHELPER_SCALE,
    parse_yshelper_abyss,
    parse_yshelper_html,
    parse_yshelper_stygian,
    parse_yshelper_teams,
)


@dataclass(frozen=True)
class TierlistSiteConfig:
    slug: str
    name: str
    url: str
    scale: tuple[str, ...]
    master_map: dict[str, str]
    txt_parser: Optional[Callable[[str, Optional[str]], dict]] = None
    html_parser: Optional[Callable[[str, Optional[str]], dict]] = None


TIERLIST_SITES: dict[str, TierlistSiteConfig] = {
    "genshin-gg": TierlistSiteConfig(
        slug="genshin-gg",
        name="Genshin.gg",
        url="https://genshin.gg/tier-list/",
        scale=tuple(GENSHINGG_SCALE),
        master_map={"S": "S+", "A": "A", "B": "B", "C": "C", "D": "D"},
        txt_parser=parse_genshingg,
    ),
    "genshinlab": TierlistSiteConfig(
        slug="genshinlab",
        name="GenshinLab",
        url="https://genshinlab.com/tier-list/",
        scale=tuple(GENSHINLAB_SCALE),
        master_map={"SS": "S+", "S": "S", "A": "A", "B": "B", "C": "C", "D": "D"},
        txt_parser=parse_genshinlab,
    ),
    "game8": TierlistSiteConfig(
        slug="game8",
        name="Game8",
        url="https://game8.co/games/Genshin-Impact/archives/297499",
        scale=("SS", "S", "A+", "A", "B", "C", "D"),
        master_map={"SS": "S+", "S": "S", "A+": "A", "A": "A", "B": "B", "C": "C", "D": "D"},
    ),
    "mobalytics": TierlistSiteConfig(
        slug="mobalytics",
        name="Mobalytics",
        url="https://mobalytics.gg/genshin-impact/tier-list",
        scale=("S", "A+", "A", "B+", "B", "C", "D", "E", "F"),
        master_map={
            "S": "S+", "A+": "S", "A": "S",
            "B+": "A", "B": "A",
            "C": "B", "D": "B",
            "E": "C", "F": "D",
        },
    ),
    "gamewith": TierlistSiteConfig(
        slug="gamewith",
        name="GameWith",
        url="https://gamewith.net/genshin-impact/article/show/21671",
        scale=("SS", "S", "A", "B", "C", "D"),
        master_map={"SS": "S+", "S": "S", "A": "A", "B": "B", "C": "C", "D": "D"},
    ),
    "prydwen": TierlistSiteConfig(
        slug="prydwen",
        name="Prydwen",
        url="https://www.prydwen.gg/genshin/tier-list",
        scale=("T0", "T0.5", "T1", "T1.5", "T2", "T3", "T4", "T5"),
        master_map={
            "T0": "S+", "T0.5": "S",
            "T1": "A", "T1.5": "A",
            "T2": "B", "T3": "C",
            "T4": "D", "T5": "D",
        },
    ),
    "icy-veins": TierlistSiteConfig(
        slug="icy-veins",
        name="Icy Veins",
        url="https://www.icy-veins.com/genshin-impact/tier-list",
        scale=tuple(ICY_VEINS_SCALE),
        master_map={"S+": "S+", "S": "S", "A": "A", "B": "B", "C": "C", "D": "D"},
        txt_parser=parse_icy_veins,
    ),
    "yshelper-abyss": TierlistSiteConfig(
        slug="yshelper-abyss",
        name="YS Abyss",
        url="https://www.yshelper.com/",
        scale=tuple(YSHELPER_SCALE),
        master_map={"S+": "S+", "S": "S", "A": "A", "B": "B", "C": "C"},
        html_parser=parse_yshelper_abyss,
    ),
    "yshelper-stygian": TierlistSiteConfig(
        slug="yshelper-stygian",
        name="YS Stygian",
        url="https://www.yshelper.com/",
        scale=tuple(YSHELPER_SCALE),
        master_map={"S+": "S+", "S": "S", "A": "A", "B": "B", "C": "C"},
        html_parser=parse_yshelper_stygian,
    ),
}


def compute_tier_metrics(cfg: TierlistSiteConfig, tier_label: str) -> tuple[int, float, str]:
    """Retorna (tier_index, normalized_value, tier_master) para um label da escala do site."""
    if tier_label not in cfg.scale:
        raise ValueError(f"Tier '{tier_label}' inválido para {cfg.slug} (escala: {cfg.scale})")
    idx = cfg.scale.index(tier_label)
    denom = max(len(cfg.scale) - 1, 1)
    norm = round(1.0 - (idx / denom), 4)
    master = cfg.master_map[tier_label]
    return idx, norm, master


__all__ = [
    "TIERLIST_SITES",
    "TierlistSiteConfig",
    "compute_tier_metrics",
    "dedupe_best_tier",
    "normalize_character_slug",
    "parse_canonical_csv",
    "parse_genshingg",
    "parse_genshinlab",
    "parse_icy_veins",
    "parse_yshelper_abyss",
    "parse_yshelper_html",
    "parse_yshelper_stygian",
    "parse_yshelper_teams",
]
