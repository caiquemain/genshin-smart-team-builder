"""Análise de sinergia de time baseada em capacidades (Capabilities) e Duplas Específicas."""
from typing import Any
from collections import Counter
from sqlalchemy.orm import Session

from ..models import Character, Element, ElementalReaction


# === DICIONÁRIO DE CAPACIDADES ===
CHARACTER_CAPABILITIES: dict[str, list[str]] = {
    "skirk": ["on_field_dps"],
    "furina": ["off_field_dps", "buffer", "healer_conditional"],
    "escoffier": ["off_field_dps", "healer_active", "res_shred"],
    # Atualização: Vodyanitsa agora é healer ativa
    "vodyanitsa": ["buffer", "res_shred", "healer_active"], 
    "mavuika": ["on_field_dps", "buffer"], "citlali": ["shielder", "res_shred", "buffer"],
    "xilonen": ["healer_active", "res_shred", "buffer"], "chasca": ["on_field_dps"],
    "nefer": ["on_field_dps"], "varessa": ["on_field_dps"], "ifa": ["healer_active", "buffer"],
    "diluc": ["on_field_dps"], "hutao": ["on_field_dps"], "klee": ["on_field_dps"],
    "ganyu": ["on_field_dps"], "yoimiya": ["on_field_dps"], "kamisato-ayaka": ["on_field_dps"],
    "tartaglia": ["on_field_dps"], "arataki-itto": ["on_field_dps"], "wanderer": ["on_field_dps"],
    "raiden-shogun": ["on_field_dps", "buffer"], "xiao": ["on_field_dps"], "cyno": ["on_field_dps"],
    "lyney": ["on_field_dps"], "neuvillette": ["on_field_dps"], "navia": ["on_field_dps"],
    "arlecchino": ["on_field_dps"], "clorinde": ["on_field_dps"], "alhaitham": ["on_field_dps"], 
    "tighnari": ["on_field_dps"], "wriothesley": ["on_field_dps"], "keqing": ["on_field_dps"], 
    "eula": ["on_field_dps"], "xinyan": ["on_field_dps"], "yanfei": ["on_field_dps"], 
    "razor": ["on_field_dps"], "freminet": ["on_field_dps"], "shikanoin-heizou": ["on_field_dps"], 
    "gaming": ["on_field_dps"], "sethos": ["on_field_dps"], "kaveh": ["on_field_dps"], 
    "dehya": ["on_field_dps", "shielder"],
    "yelan": ["off_field_dps", "buffer"], "xingqiu": ["off_field_dps", "healer_conditional"],
    "fischl": ["off_field_dps"], "beidou": ["off_field_dps", "shielder"],
    "xiangling": ["off_field_dps"], "yae-miko": ["off_field_dps"], "collei": ["off_field_dps"], 
    "amber": ["off_field_dps"], "rosaria": ["off_field_dps", "buffer"], "chongyun": ["off_field_dps"], 
    "kaeya": ["off_field_dps"], "lisa": ["off_field_dps"], "aloy": ["off_field_dps"], 
    "nahida": ["off_field_dps", "buffer"],
    "bennett": ["healer_active", "buffer"], "sucrose": ["buffer"], 
    "kazuha": ["buffer", "res_shred"], "kaedehara-kazuha": ["buffer", "res_shred"],
    "venti": ["buffer"], "mona": ["buffer"], "yunjin": ["buffer"], "yun-jin": ["buffer"],
    "gorou": ["buffer"], "kujou-sara": ["buffer"], "faruzan": ["buffer"],
    "albedo": ["off_field_dps"], "nilou": ["buffer"], "shenhe": ["buffer", "res_shred"],
    "dori": ["healer_active"], "traveler": ["buffer"],
    "barbara": ["healer_active"], "jean": ["healer_active"], "qiqi": ["healer_active"],
    "sangonomiya-kokomi": ["healer_active"], "baizhu": ["healer_active", "shielder"],
    "diona": ["healer_active", "shielder"], "yaoyao": ["healer_active"], "sayu": ["healer_active"],
    "kuki-shinobu": ["healer_active"], "charlotte": ["healer_active"], "sigewinne": ["healer_active"],
    "xianyun": ["healer_active"], "chevreuse": ["healer_active"], "mika": ["healer_active"],
    "zhongli": ["shielder", "res_shred"], "layla": ["shielder"], "kirara": ["shielder"],
    "thoma": ["shielder"], "candace": ["shielder", "buffer"],
}

# Healers que ativam bem os stacks da Furina
FURINA_HEALERS = {
    "bennett", "xianyun", "escoffier", "jean", "charlotte", 
    "baizhu", "sangonomiya-kokomi", "sigewinne", "xilonen",
    "vodyanitsa" # Adicionada aqui também
}

# === DICIONÁRIO DE SINERGIAS ESPECÍFICAS ===
SYNERGY_PAIRS = [
    # -- Sinergias Supremas --
    {"chars": {"furina", "escoffier"}, "bonus": 25, "name": "Furina + Escoffier (Cura + Buff Supremo)"},
    {"chars": {"skirk", "escoffier"}, "bonus": 15, "name": "Skirk + Escoffier (Freeze Core)"},
    {"chars": {"skirk", "furina"}, "bonus": 15, "name": "Skirk + Furina (Dano Hydro Off-field)"},
    {"chars": {"furina", "xianyun"}, "bonus": 20, "name": "Furina + Xianyun (Hypercarry Plunge)"},
    {"chars": {"furina", "bennett"}, "bonus": 15, "name": "Furina + Bennett (Cura + Buff ATK)"},
    
    # -- Sinergias Boas (mas não supremas) --
    {"chars": {"xingqiu", "escoffier"}, "bonus": 5, "name": "Xingqiu + Escoffier (Hydro Off-field)"},
    {"chars": {"xingqiu", "skirk"}, "bonus": 5, "name": "Xingqiu + Skirk (Freeze Core básico)"},
    {"chars": {"vodyanitsa", "skirk"}, "bonus": 15, "name": "Vodyanitsa + Skirk (RES Shred + Buff Core)"},
    {"chars": {"shenhe", "kamisato-ayaka"}, "bonus": 20, "name": "Shenhe + Ayaka (Mono Cryo)"},
    {"chars": {"kazuha", "tartaglia"}, "bonus": 15, "name": "Kazuha + Tartaglia (Taser Internacional)"},
]

def classify_role(char: Character) -> str:
    caps = CHARACTER_CAPABILITIES.get(char.slug, [])
    if caps:
        if "on_field_dps" in caps: return "dps"
        if "off_field_dps" in caps: return "sub"
        if "healer_active" in caps: return "healer"
        if "shielder" in caps: return "shielder"
        if "buffer" in caps: return "support"
    
    stat = char.ascension_stat.value if char.ascension_stat else None
    wpn = char.weapon_type.value if hasattr(char.weapon_type, "value") else str(char.weapon_type)
    el = char.element.value if hasattr(char.element, "value") else str(char.element)

    if stat == "healing_bonus": return "healer"
    if stat == "hp_pct" and wpn == "catalyst": return "healer"
    if stat == "def_pct" and char.base_def >= 70: return "shielder"
    if el == "geo" and wpn == "claymore": return "shielder"
    if stat in ("em", "er"): return "support"
    if stat in ("crit_rate", "crit_dmg", "atk_pct"): return "dps"
    if wpn == "catalyst": return "support"
    return "dps"


def analyze_team(db: Session, slugs: list[str]) -> dict[str, Any]:
    chars = db.query(Character).filter(Character.slug.in_(slugs)).all()
    if not chars:
        return {"score": 0, "roles": [], "reactions": [], "warnings": ["Time vazio"], "suggestions": [], "breakdown": []}

    by_slug = {c.slug: c for c in chars}
    ordered = [by_slug[s] for s in slugs if s in by_slug]

    elements = [c.element.value if hasattr(c.element, "value") else str(c.element) for c in ordered]
    element_set = set(elements)
    el_counts = Counter(elements)

    roles = []
    team_caps = set()
    slugs_set = set(slugs)
    
    for c in ordered:
        caps = CHARACTER_CAPABILITIES.get(c.slug, [])
        team_caps.update(caps)
        roles.append({
            "slug": c.slug, "name": c.name, "icon": c.icon,
            "element": c.element.value if hasattr(c.element, "value") else str(c.element),
            "role": classify_role(c),
        })

    all_reactions = db.query(ElementalReaction).all()
    viable_reactions = []
    for reac in all_reactions:
        reac_elements = reac.elements or []
        if not isinstance(reac_elements, list) or not reac_elements: continue
        if "qualquer" in reac_elements:
            if reac_elements[0] in element_set: viable_reactions.append(reac)
        else:
            if all(e in element_set for e in reac_elements): viable_reactions.append(reac)

    # --- CÁLCULO DO SCORE BALANCEADO ---
    breakdown: list[dict[str, Any]] = []
    score = 15
    breakdown.append({"factor": "Time montado (base)", "delta": 15})

    if len(ordered) == 4:
        score += 5
        breakdown.append({"factor": "Time completo (4 personagens)", "delta": 5})

    # Healers
    has_active_healer = "healer_active" in team_caps
    has_cond_healer = "healer_conditional" in team_caps
    
    if has_active_healer:
        score += 10
        breakdown.append({"factor": "Healer ativo presente", "delta": 10})
    elif has_cond_healer:
        score -= 10
        breakdown.append({"factor": "Apenas healer condicional (precisa de cura externa)", "delta": -10})

    # Checagem de Healer Redundante (Barbara, Qiqi, etc sem outras utilidades)
    redundant_healer_penalty = False
    for c in ordered:
        caps = CHARACTER_CAPABILITIES.get(c.slug, [])
        if caps == ["healer_active"] and sum(1 for x in ordered if "healer_active" in CHARACTER_CAPABILITIES.get(x.slug, [])) > 1:
            redundant_healer_penalty = True
            break
            
    if redundant_healer_penalty:
        score -= 15
        breakdown.append({"factor": "Healer redundante (slot desperdiçado)", "delta": -15})

    # Checagem específica da Furina
    if "furina" in slugs_set:
        has_furina_healer = bool(slugs_set.intersection(FURINA_HEALERS))
        if not has_furina_healer:
            score -= 20
            breakdown.append({"factor": "Furina sem healer forte (perde stacks de Fanfare)", "delta": -20})

    # Sinergias Específicas (PESO ALTO)
    for syn in SYNERGY_PAIRS:
        if syn["chars"].issubset(slugs_set):
            score += syn["bonus"]
            breakdown.append({"factor": f"Sinergia: {syn['name']}", "delta": syn["bonus"]})

    # Roles de Dano (Hypercarry check)
    has_on_field = "on_field_dps" in team_caps
    has_off_field = "off_field_dps" in team_caps
    
    if has_on_field and has_off_field:
        score += 5
        breakdown.append({"factor": "DPS On-field + DPS Off-field (Hypercarry)", "delta": 5})
    elif not has_on_field:
        score -= 15
        breakdown.append({"factor": "Sem DPS On-field (falta dano principal)", "delta": -15})

    # Buffers e Debuffers
    if "res_shred" in team_caps:
        score += 5
        breakdown.append({"factor": "Redução de Resistência (RES Shred) presente", "delta": 5})
    if "shielder" in team_caps:
        score += 5
        breakdown.append({"factor": "Shielder presente", "delta": 5})

    # Reações
    strong_reaction_slugs = {"vaporize", "melt", "quicken", "bloom", "freeze", "frozen"}
    viable_slugs = {r.slug for r in viable_reactions}
    if strong_reaction_slugs.intersection(viable_slugs):
        score += 5
        breakdown.append({"factor": "Reação amplificadora disponível", "delta": 5})

    if "freeze" in viable_slugs and "res_shred" in team_caps:
        if "cryo" in element_set and "hydro" in element_set:
            score += 5
            breakdown.append({"factor": "Arquétipo Freeze otimizado", "delta": 5})

    # === PUNIÇÃO POR RESTRIÇÃO DE ELEMENTO (Skirk / Escoffier) ===
    non_cryo_hydro = [el for el in element_set if el not in ("cryo", "hydro")]
    
    if "skirk" in slugs_set and non_cryo_hydro:
        score -= 30
        breakdown.append({"factor": "Skirk exige apenas Cryo/Hydro (perde passiva)", "delta": -30})
        
    if "escoffier" in slugs_set and non_cryo_hydro:
        score -= 25
        breakdown.append({"factor": "Escoffier exige apenas Cryo/Hydro (perde RES Shred)", "delta": -25})

    # Penalidades gerais
    dps_on_field_count = sum(1 for c in ordered if "on_field_dps" in CHARACTER_CAPABILITIES.get(c.slug, []))
    if dps_on_field_count >= 3:
        score -= 25
        breakdown.append({"factor": f"{dps_on_field_count} DPS on-field competindo", "delta": -25})
    elif dps_on_field_count == 2 and not has_off_field:
        score -= 10
        breakdown.append({"factor": "2 DPS on-field sem off-field", "delta": -10})

    if el_counts.most_common(1)[0][1] >= 3:
        score -= 15
        breakdown.append({"factor": f"3+ chars do mesmo elemento ({el_counts.most_common(1)[0][0]})", "delta": -15})

    score = max(0, min(100, score))

    # Warnings
    warnings = []
    if not has_active_healer and not has_cond_healer: warnings.append("Sem healer — sobreviver será difícil")
    if has_cond_healer and not has_active_healer: warnings.append("Healer condicional sem cura externa — passiva inativa")
    if not has_on_field: warnings.append("Nenhum DPS On-field definido")
    if dps_on_field_count >= 3: warnings.append(f"{dps_on_field_count} DPS on-field competindo por tempo de campo")
    if el_counts.most_common(1)[0][1] >= 3: warnings.append(f"Mono-elemento ({el_counts.most_common(1)[0][0]}) — perde reações")

    if "skirk" in slugs_set and non_cryo_hydro:
        warnings.append("Skirk exige time 100% Cryo/Hydro para ativar a passiva de dano massivo.")
    if "escoffier" in slugs_set and non_cryo_hydro:
        warnings.append("Escoffier exige time 100% Cryo/Hydro para maximizar a redução de resistência.")
    if "furina" in slugs_set and not has_furina_healer:
        warnings.append("Furina precisa de um healer de time forte (ex: Escoffier, Bennett, Xianyun) para gerar stacks de Fanfare.")
    if redundant_healer_penalty:
        warnings.append("Você tem 2 healers, mas um deles não traz utilidade extra (buff, debuff, etc). Slot desperdiçado.")

    suggestions = []
    if not has_active_healer and has_cond_healer:
        suggestions.append({"slug": "escoffier", "name": "Escoffier", "element": "cryo", "reason": "Ativa a passiva da Furina e cura"})
    if not has_off_field and has_on_field:
        suggestions.append({"slug": "furina", "name": "Furina", "element": "hydro", "reason": "Dano off-field e buff massivo"})

    return {
        "score": score,
        "roles": roles,
        "reactions": [{"slug": r.slug, "name": r.name, "effect": r.effect} for r in viable_reactions],
        "warnings": warnings,
        "suggestions": suggestions[:4],
        "breakdown": breakdown,
    }
