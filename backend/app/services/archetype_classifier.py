"""Classificador automático de arquétipos de times baseado em reações elementais e cores conhecidos.

Evita times marcados como ``unknown`` inferindo o arquétipo principal a partir:
  1. De personagens/cores definidores de mecânica (ex.: Nilou Bloom, Chevreuse Overload,
     personagens Moonsign/Nod-Krai para reações Lunares, National, Hypercarries clássicos);
  2. Das reações elementais reais habilitadas pelos elementos presentes no time;
  3. De composições Mono-Elemento / Hypercarry / Swirl quando não há reação dominante.
"""
from __future__ import annotations

from collections import Counter
from typing import Mapping, Optional

# Personagens Nod-Krai / Moonsign que convertem reações em variantes Lunares
LUNAR_CHARGED_ENABLERS = {"ineffa", "flins", "columbina"}
LUNAR_BLOOM_ENABLERS = {"lauma", "nefer", "columbina"}
LUNAR_CRYSTALLIZE_ENABLERS = {"zibai", "illuga", "columbina"}

# DPS físicos clássicos (Cryo + Electro -> Superconduct)
PHYSICAL_CARRIES = {"eula", "razor", "freminet", "xinyan"}

# Carries focados em dano bruto / Hypercarry (sem depender de reação amplificadora principal)
ANEMO_CARRIES = {"xiao", "wanderer", "shikanoin-heizou", "varka"}
GEO_CARRIES = {"arataki-itto", "noelle", "navia", "chiori", "zibai"}
DENDRO_ONFIELD = {"alhaitham", "tighnari", "nahida", "kinich", "nefer", "kaveh", "lauma"}
ELECTRO_AGGRAVATE_CARRIES = {
    "keqing", "clorinde", "cyno", "yae-miko", "fischl", "sethos", "varesa", "raiden-shogun", "lisa",
}
PYRO_VAPE_MELT_CARRIES = {
    "hu-tao", "arlecchino", "yoimiya", "diluc", "klee", "gaming", "mavuika", "yanfei", "lyney", "durin",
}
HYDRO_CARRIES = {"neuvillette", "mualani", "tartaglia", "kamisato-ayato"}
CRYO_CARRIES = {"kamisato-ayaka", "ganyu", "wriothesley", "skirk"}
SWIRL_DRIVERS = {"sucrose", "kaedehara-kazuha", "yumemizuki-mizuki", "ifa", "shikanoin-heizou"}
BURNING_ENABLERS = {"emilie", "kinich"}


def classify_team_archetype(
    character_slugs: list[str],
    elements_by_slug: Optional[Mapping[str, str]] = None,
    *,
    main_character: Optional[str] = None,
    team_name: Optional[str] = None,
) -> str:
    """Classifica o arquétipo de um time usando cores conhecidos + reações elementais."""
    slugs = [s for s in (character_slugs or []) if s]
    if not slugs:
        return "unknown"

    team = set(slugs)
    main = main_character or slugs[0]
    name_l = (team_name or "").lower()

    el_map = elements_by_slug or {}
    elements = [str(el_map[s]).lower() for s in slugs if s in el_map and el_map[s]]
    el_set = set(elements)
    el_counts = Counter(elements)
    main_el = str(el_map.get(main, "")).lower()

    has_pyro = "pyro" in el_set
    has_hydro = "hydro" in el_set
    has_electro = "electro" in el_set
    has_cryo = "cryo" in el_set
    has_dendro = "dendro" in el_set
    has_anemo = "anemo" in el_set
    has_geo = "geo" in el_set

    # ------------------------------------------------------------------
    # 1. Mecânicas exclusivas / Cores icônicos (alta especificidade)
    # ------------------------------------------------------------------

    # Nilou Bountiful Core Bloom (só Hydro + Dendro)
    if "nilou" in team and has_dendro and has_hydro and not (has_pyro or has_electro or has_cryo):
        return "bloom"

    # Chevreuse Overload (Pyro + Electro estrito)
    if "chevreuse" in team and has_pyro and has_electro:
        return "overload"

    # Reações Lunares (Nod-Krai / Moonsign)
    if (team & LUNAR_BLOOM_ENABLERS) and has_dendro and has_hydro and not has_pyro:
        # Se tem Lauma/Nefer + Hydro (com ou sem Ineffa/Columbina)
        if ("lauma" in team or "nefer" in team) and not has_electro:
            return "lunar_bloom"
        if ("lauma" in team or "nefer" in team) and "columbina" in team:
            return "lunar_bloom"
    if (team & LUNAR_CHARGED_ENABLERS) and has_hydro and has_electro and not has_pyro and not has_dendro:
        return "lunar_charged"
    if (team & LUNAR_CRYSTALLIZE_ENABLERS) and has_geo and has_hydro and not has_pyro and not has_dendro:
        if "zibai" in team or "illuga" in team:
            return "lunar_crystallize"

    # Skirk Freeze (kit estritamente Hydro + Cryo)
    if "skirk" in team and has_hydro and has_cryo:
        return "freeze"

    # National (Xiangling + Bennett + aplicador Hydro)
    if {"xiangling", "bennett"}.issubset(team) and has_hydro and not has_dendro:
        return "national"

    # Chasca Rainbow / Hypercarry
    if "chasca" in team:
        if has_pyro and has_hydro:
            return "vaporize"
        if has_pyro and has_cryo:
            return "melt"
        return "hypercarry"

    # Anemo Hypercarry com Faruzan (Xiao / Wanderer / Heizou / Varka)
    if "faruzan" in team and (team & ANEMO_CARRIES):
        return "hypercarry"

    # Physical Superconduct
    if (team & PHYSICAL_CARRIES) and has_cryo and has_electro:
        return "superconduct"

    # ------------------------------------------------------------------
    # 2. Reações de Dendro (muito distintas pelo trio/dupla de elementos)
    # ------------------------------------------------------------------
    if has_dendro:
        if has_hydro and has_electro:
            # Hyperbloom (Dendro + Hydro + Electro)
            if (team & LUNAR_BLOOM_ENABLERS) and "kuki-shinobu" not in team and "raiden-shogun" not in team:
                return "lunar_bloom"
            return "hyperbloom"

        if has_hydro and has_pyro:
            # Burgeon (Dendro + Hydro + Pyro)
            if (team & BURNING_ENABLERS) and "burgeon" not in name_l and ("furina" in team or "mualani" in team):
                return "burning"
            return "burgeon"

        if has_pyro and has_cryo:
            # Burnmelt (Burning alimentando Reverse Melt)
            return "melt"

        if has_pyro:
            return "burning"

        if has_hydro:
            if team & LUNAR_BLOOM_ENABLERS:
                return "lunar_bloom"
            return "bloom"

        if has_electro:
            # Quicken: decide entre Spread (carry Dendro) e Aggravate (carry Electro)
            if "spread" in name_l:
                return "spread"
            if "aggravate" in name_l:
                return "aggravate"
            if main_el == "dendro" or (main in DENDRO_ONFIELD):
                return "spread"
            if main_el == "electro" or (main in ELECTRO_AGGRAVATE_CARRIES):
                return "aggravate"
            if el_counts["dendro"] > el_counts["electro"]:
                return "spread"
            if el_counts["electro"] > el_counts["dendro"]:
                return "aggravate"
            return "quicken"

    # ------------------------------------------------------------------
    # 3. Reações Amplificadoras (Vaporize / Melt)
    # ------------------------------------------------------------------
    if has_pyro and has_hydro:
        # Se o nome indicar explicitamente melt/freeze ou se Cryo + Pyro dominar sem carry Hydro/Pyro
        if "melt" in name_l and has_cryo:
            return "melt"
        return "vaporize"

    if has_pyro and has_cryo:
        return "melt"

    # ------------------------------------------------------------------
    # 4. Reações Transformativas principais (Freeze / Electro-Charged / Overload / Superconduct)
    # ------------------------------------------------------------------
    if has_cryo and has_hydro:
        # Neuvillette + Furina + Citlali/Escoffier -> Freeze / Hypercarry
        if "freeze" in name_l or (team & CRYO_CARRIES) or "escoffier" in team or el_counts["cryo"] >= 2:
            return "freeze"
        return "freeze"

    if has_hydro and has_electro:
        if team & LUNAR_CHARGED_ENABLERS:
            return "lunar_charged"
        return "electro_charged"

    if has_pyro and has_electro:
        return "overload"

    if has_cryo and has_electro:
        return "superconduct"

    # ------------------------------------------------------------------
    # 5. Times sem reação PHEC dupla: Geo / Mono-Elemento / Hypercarry / Swirl
    # ------------------------------------------------------------------

    # Mono Geo (3+ Geo ou Itto/Noelle + Gorou)
    if el_counts["geo"] >= 3 or ({"gorou"}.issubset(team) and el_counts["geo"] >= 2):
        return "mono_geo"

    # Navia / Geo + elemento cristalizável (Crystallize)
    if has_geo and (has_pyro or has_hydro or has_electro or has_cryo):
        if "navia" in team or "chiori" in team or "crystallize" in name_l:
            return "crystallize"

    # Hypercarries clássicos (ex.: Neuvillette + Furina + Kazuha + Xilonen, Raiden Hypercarry)
    if {"neuvillette", "furina"}.issubset(team):
        return "hypercarry"
    if "raiden-shogun" in team and ("kujou-sara" in team or "bennett" in team) and not has_hydro and not has_dendro:
        return "hypercarry"
    if (team & ANEMO_CARRIES) and has_anemo:
        return "hypercarry"

    # Mono-elemento puro (ou com suportes Anemo/Geo)
    phec_present = [e for e in ("pyro", "hydro", "cryo", "electro") if e in el_set]
    if len(phec_present) == 1:
        sole = phec_present[0]
        if el_counts[sole] >= 2:
            return f"mono_{sole}"
        # 1 PHEC + Anemo/Geo (ex.: Neuvillette solo Hydro + Kazuha + Xilonen + Zhongli)
        if main_el == sole and (team & (PYRO_VAPE_MELT_CARRIES | HYDRO_CARRIES | CRYO_CARRIES | ELECTRO_AGGRAVATE_CARRIES)):
            return "hypercarry"
        if has_anemo and (team & SWIRL_DRIVERS):
            return "swirl"
        return f"mono_{sole}"

    if has_geo and el_counts["geo"] >= 2:
        return "mono_geo"
    if has_anemo and el_counts["anemo"] >= 2:
        return "hypercarry"
    if has_dendro and el_counts["dendro"] >= 2:
        return "hypercarry"

    # ------------------------------------------------------------------
    # 6. Fallback sem elements_by_slug (compatibilidade legada por slug)
    # ------------------------------------------------------------------
    if not elements:
        if {"nahida", "kuki-shinobu"}.issubset(team):
            return "hyperbloom"
        if "nilou" in team:
            return "bloom"
        if "chevreuse" in team:
            return "overload"
        if {"xiangling", "bennett"}.issubset(team):
            return "national"
        if team & {"kamisato-ayaka", "skirk"}:
            return "freeze"
        if team & {"hu-tao", "arlecchino", "yoimiya", "mualani", "diluc", "klee", "gaming"}:
            return "vaporize"
        if team & {"arataki-itto", "navia", "neuvillette", "wanderer", "xiao", "eula"}:
            return "hypercarry"
        return "unknown"

    if has_anemo:
        return "swirl"
    if has_geo:
        return "crystallize"
    return "hypercarry"


def reclassify_team_templates(db, *, only_unknown: bool = True) -> dict[str, int]:
    """Atualiza `TeamTemplate.archetype` no banco usando os elementos reais dos personagens.

    Retorna um resumo com `scanned`, `updated`, `remaining_unknown`.
    """
    from ..models import Character, TeamTemplate

    elements_by_slug: dict[str, str] = {}
    for ch in db.query(Character).all():
        el = ch.element.value if hasattr(ch.element, "value") else str(ch.element)
        elements_by_slug[ch.slug] = el.lower()

    q = db.query(TeamTemplate)
    if only_unknown:
        q = q.filter((TeamTemplate.archetype == "unknown") | (TeamTemplate.archetype.is_(None)) | (TeamTemplate.archetype == ""))
    templates = q.all()

    updated = 0
    for tpl in templates:
        slugs = list(tpl.character_slugs or [])
        new_arch = classify_team_archetype(
            slugs,
            elements_by_slug,
            main_character=tpl.main_character,
            team_name=tpl.name,
        )
        if new_arch and new_arch != tpl.archetype:
            tpl.archetype = new_arch
            updated += 1

    remaining_unknown = (
        db.query(TeamTemplate)
        .filter((TeamTemplate.archetype == "unknown") | (TeamTemplate.archetype.is_(None)) | (TeamTemplate.archetype == ""))
        .count()
    )
    return {
        "scanned": len(templates),
        "updated": updated,
        "remaining_unknown": remaining_unknown,
    }
