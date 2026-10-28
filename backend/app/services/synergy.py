"""Análise de sinergia de time.

Detecta papéis (dps/sub/support/healer/shielder), cruza elementos com
ElementalReaction, e retorna score + warnings + sugestões.
"""
from typing import Any

from sqlalchemy.orm import Session

from ..models import Character, Element, ElementalReaction


# === Papéis curados (mais confiáveis que heurística) ===

# Chars que têm heal mesmo se classificados como support/dps
HEALER_CAPABLE = {
    "bennett", "diona", "xingqiu", "noelle", "barbara",
    "sangonomiya-kokomi", "qiqi", "jean", "baizhu", "yaoyao",
    "sayu", "kuki-shinobu", "charlotte", "sigewinne", "xianyun",
    "chevreuse", "mika",
}


KNOWN_ROLES: dict[str, str] = {
    # Healers
    "barbara": "healer", "jean": "healer", "qiqi": "healer",
    "sangonomiya-kokomi": "healer", "baizhu": "healer",
    "diona": "healer", "yaoyao": "healer", "sayu": "healer",
    "kuki-shinobu": "healer", "charlotte": "healer",
    "sigewinne": "healer", "xianyun": "healer",
    "chevreuse": "healer", "mika": "healer",
    # Shielders
    "zhongli": "shielder", "layla": "shielder",
    "kirara": "shielder", "thoma": "shielder",
    "candace": "shielder",
    # DPS on-field
    "diluc": "dps", "hutao": "dps", "klee": "dps",
    "ganyu": "dps", "yoimiya": "dps", "kamisato-ayaka": "dps",
    "tartaglia": "dps", "arataki-itto": "dps",
    "wanderer": "dps", "raiden-shogun": "dps",
    "xiao": "dps", "cyno": "dps", "lyney": "dps",
    "neuvillette": "dps", "navia": "dps",
    "arlecchino": "dps", "clorinde": "dps",
    "mavuika": "dps", "chasca": "dps",
    "alhaitham": "dps", "tighnari": "dps",
    "wriothesley": "dps", "keqing": "dps", "eula": "dps",
    "xinyan": "dps", "yanfei": "dps",
    "razor": "dps", "freminet": "dps",
    "shikanoin-heizou": "dps", "gaming": "dps",
    "sethos": "dps", "kaveh": "dps", "dehya": "dps",
    # Sub-DPS
    "yelan": "sub", "xingqiu": "sub", "fischl": "sub",
    "beidou": "sub", "xiangling": "sub", "yae-miko": "sub",
    "collei": "sub", "amber": "sub", "rosaria": "sub",
    "chongyun": "sub", "kaeya": "sub", "lisa": "sub",
    "aloy": "sub",
    # Supports
    "bennett": "support", "sucrose": "support",
    "kazuha": "support", "kaedehara-kazuha": "support",
    "venti": "support", "mona": "support",
    "furina": "support", "nahida": "support",
    "yunjin": "support", "yun-jin": "support",
    "gorou": "support", "kujou-sara": "support",
    "faruzan": "support", "albedo": "support",
    "nilou": "support", "shenhe": "support",
    "dori": "support",
    # Travelers
    "traveler": "support",
}


def classify_role(char: Character) -> str:
    """Classifica o papel do personagem. Curado > heurística."""
    if char.slug in KNOWN_ROLES:
        return KNOWN_ROLES[char.slug]

    stat = char.ascension_stat.value if char.ascension_stat else None
    wpn = char.weapon_type.value if hasattr(char.weapon_type, "value") else str(char.weapon_type)
    el = char.element.value if hasattr(char.element, "value") else str(char.element)

    # Heurísticas de fallback
    if stat == "healing_bonus":
        return "healer"
    if stat == "hp_pct" and wpn == "catalyst":
        return "healer"  # Kokomi/Barbara-like
    if stat == "def_pct" and char.base_def >= 70:
        return "shielder"
    if el == "geo" and wpn == "claymore":
        return "shielder"
    if stat in ("em", "er"):
        return "support"
    if stat in ("crit_rate", "crit_dmg", "atk_pct"):
        return "dps"
    # Default
    if wpn == "catalyst":
        return "support"
    return "dps"


def analyze_team(db: Session, slugs: list[str]) -> dict[str, Any]:
    """Retorna análise completa do time."""
    chars = db.query(Character).filter(Character.slug.in_(slugs)).all()
    if not chars:
        return {
            "score": 0, "roles": [], "reactions": [],
            "warnings": ["Time vazio"], "suggestions": [], "breakdown": [],
        }

    # Preserva ordem dos slots
    by_slug = {c.slug: c for c in chars}
    ordered = [by_slug[s] for s in slugs if s in by_slug]

    elements = [
        c.element.value if hasattr(c.element, "value") else str(c.element)
        for c in ordered
    ]
    element_set = set(elements)

    # Roles por char
    roles = [
        {
            "slug": c.slug,
            "name": c.name,
            "icon": c.icon,
            "element": c.element.value if hasattr(c.element, "value") else str(c.element),
            "role": classify_role(c),
        }
        for c in ordered
    ]
    role_counts = {r: 0 for r in ("dps", "sub", "support", "healer", "shielder")}
    for r in roles:
        role_counts[r["role"]] = role_counts.get(r["role"], 0) + 1

    # Reações viáveis
    all_reactions = db.query(ElementalReaction).all()
    viable_reactions = []
    for reac in all_reactions:
        reac_elements = reac.elements or []
        if not isinstance(reac_elements, list) or not reac_elements:
            continue
        # Conta quantos elementos da reação estão no time
        if "qualquer" in reac_elements:
            # Swirl/Crystallize: precisa do primeiro elemento apenas
            primary = reac_elements[0]
            if primary in element_set:
                viable_reactions.append(reac)
        else:
            if all(e in element_set for e in reac_elements):
                viable_reactions.append(reac)

    # Score + breakdown
    breakdown: list[dict[str, Any]] = []
    score = 30  # base
    breakdown.append({"factor": "Time montado (base)", "delta": 30})

    if len(ordered) == 4:
        score += 15
        breakdown.append({"factor": "Time completo (4 personagens)", "delta": 15})

    distinct_elements = len(element_set)
    if distinct_elements >= 3:
        score += 10
        breakdown.append({"factor": f"{distinct_elements} elementos diferentes", "delta": 10})

    # Reações relevantes
    strong_reaction_slugs = {"vaporize", "melt", "quicken", "bloom", "freeze", "frozen"}
    has_strong = any(r.slug in strong_reaction_slugs for r in viable_reactions)
    if has_strong:
        score += 20
        breakdown.append({"factor": "Reação amplificadora disponível (Vaporize/Melt/Quicken/Bloom)", "delta": 20})

    if len(viable_reactions) >= 3:
        score += 10
        breakdown.append({"factor": f"{len(viable_reactions)} reações viáveis", "delta": 10})

    # Roles
    has_healer = role_counts.get("healer", 0) > 0 or any(
        r["slug"] in HEALER_CAPABLE for r in roles
    )
    if has_healer:
        score += 15
        breakdown.append({"factor": "Healer presente", "delta": 15})
    if role_counts.get("shielder", 0) > 0:
        score += 10
        breakdown.append({"factor": "Shielder presente", "delta": 10})
    if role_counts.get("support", 0) + role_counts.get("sub", 0) >= 2:
        score += 10
        breakdown.append({"factor": "2+ suportes/sub-DPS", "delta": 10})

    # Penalidades
    dps_count = role_counts.get("dps", 0)
    sub_count = role_counts.get("sub", 0)
    if dps_count == 4:
        score -= 40
        breakdown.append({"factor": "4 DPS competindo por field time", "delta": -40})
    elif dps_count == 3:
        score -= 25
        breakdown.append({"factor": "3 DPS competindo por field time", "delta": -25})
    elif dps_count == 2:
        score -= 5
        breakdown.append({"factor": "2 DPS on-field (aceitável)", "delta": -5})

    # Nenhum sub-DPS com 2+ on-field DPS = todos querem campo, ninguém faz off-field
    if dps_count >= 2 and sub_count == 0:
        score -= 10
        breakdown.append({"factor": "Sem sub-DPS (todos os DPS querem on-field)", "delta": -10})

    # Mono-elemento
    from collections import Counter
    el_counts = Counter(elements)
    if el_counts.most_common(1)[0][1] >= 3:
        score -= 15
        dominant = el_counts.most_common(1)[0][0]
        breakdown.append({"factor": f"3+ chars do mesmo elemento ({dominant})", "delta": -15})

    score = max(0, min(100, score))

    # Warnings
    warnings: list[str] = []
    if not has_healer:
        warnings.append("Sem healer — sobreviver em conteúdo longo será difícil")
    if dps_count == 4:
        warnings.append("4 DPS no time — nenhum suporte para amplificar dano")
    if dps_count >= 3:
        warnings.append(f"{dps_count} DPS competindo por field time — apenas 1 fica em campo por vez")
    if dps_count >= 2 and sub_count == 0:
        warnings.append("Nenhum sub-DPS — todos os DPS querem ficar on-field, perde DPS off-field")
    if el_counts.most_common(1)[0][1] >= 3:
        warnings.append(f"Mono-elemento ({el_counts.most_common(1)[0][0]}) — perde muitas reações")
    if distinct_elements <= 1 and len(ordered) >= 2:
        warnings.append("Um único elemento — só reações com Anemo/Geo funcionam")

    # Sugestões
    suggestions: list[dict[str, Any]] = []

    # Sugestão 1: healer se faltando
    if not has_healer:
        healers = (
            db.query(Character)
            .filter(Character.slug.in_(list(KNOWN_ROLES.keys())))
            .all()
        )
        healer_chars = [c for c in healers if KNOWN_ROLES.get(c.slug) == "healer"]
        # Prefere elementos já no time (resonância + reações)
        healer_chars.sort(key=lambda c: (
            0 if (c.element.value if hasattr(c.element, "value") else str(c.element)) in element_set else 1,
            -(c.rarity or 0),
        ))
        for h in healer_chars[:2]:
            el = h.element.value if hasattr(h.element, "value") else str(h.element)
            suggestions.append({
                "slug": h.slug, "name": h.name, "icon": h.icon, "element": el,
                "reason": f"Adicionar como healer ({el})",
            })

    # Sugestão 2: elemento faltante para uma reação forte
    if "pyro" in element_set and "hydro" not in element_set:
        hydros = (
            db.query(Character)
            .filter(Character.element == Element.HYDRO)
            .order_by(Character.rarity.desc())
            .limit(2).all()
        )
        for h in hydros:
            suggestions.append({
                "slug": h.slug, "name": h.name, "icon": h.icon, "element": "hydro",
                "reason": "Hydro viabiliza Vaporize (Pyro + Hydro)",
            })
    elif "hydro" in element_set and "pyro" not in element_set:
        pyros = (
            db.query(Character)
            .filter(Character.element == Element.PYRO)
            .order_by(Character.rarity.desc())
            .limit(2).all()
        )
        for p in pyros:
            suggestions.append({
                "slug": p.slug, "name": p.name, "icon": p.icon, "element": "pyro",
                "reason": "Pyro viabiliza Vaporize (Pyro + Hydro)",
            })

    # Sugestão extra: sub-DPS se o time tem 2+ DPS e nenhum sub
    if dps_count >= 2 and sub_count == 0:
        sub_pool = (
            db.query(Character)
            .filter(Character.slug.in_(list(KNOWN_ROLES.keys())))
            .all()
        )
        sub_chars = [c for c in sub_pool if KNOWN_ROLES.get(c.slug) == "sub"]
        sub_chars.sort(key=lambda c: -(c.rarity or 0))
        for sb in sub_chars[:2]:
            el = sb.element.value if hasattr(sb.element, "value") else str(sb.element)
            suggestions.append({
                "slug": sb.slug, "name": sb.name, "icon": sb.icon, "element": el,
                "reason": f"Sub-DPS {el} off-field — troca um DPS por dano passivo",
            })

    return {
        "score": score,
        "roles": roles,
        "reactions": [
            {"slug": r.slug, "name": r.name, "effect": r.effect}
            for r in viable_reactions
        ],
        "warnings": warnings,
        "suggestions": suggestions[:4],  # cap
        "breakdown": breakdown,
    }
