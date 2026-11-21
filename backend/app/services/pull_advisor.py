"""Motor de recomendação de pulls (Pull Advisor).

Combina 4 sinais transparentes e explicáveis sobre a conta do jogador:
  1. Consenso Geral (7 fontes editoriais — força estrutural e valor de conta)
  2. Desbloqueio de times (templates 3/4 -> 4/4 com retorno decrescente por arquétipo
     e bônus por consenso multi-fonte)
  3. Lacunas da conta (pares de sinergia com personagens já possuídos, falta de
     RES shred / healer forte pra Furina / shielder / cobertura elemental p/ Teatro)
  4. Endgame Sazonal 30d (YS Abyss + YS Stygian + chefes do Prydwen), mantido
     separado do consenso geral para nunca distorcer o valor de longo prazo.
"""
from collections import Counter, defaultdict
from dataclasses import dataclass
from typing import Any, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from ..models import Character, Language, TeamTemplate
from .i18n import resolve_character
from .synergy import CHARACTER_CAPABILITIES, FURINA_HEALERS

# Pesos por objetivo do jogador (somam 1.0)
GOAL_WEIGHTS: dict[str, dict[str, float]] = {
    "meta":         {"general": 0.40, "teams": 0.35, "gaps": 0.15, "endgame": 0.10},
    "unlock_teams": {"general": 0.25, "teams": 0.55, "gaps": 0.15, "endgame": 0.05},
    "endgame":      {"general": 0.20, "teams": 0.30, "gaps": 0.05, "endgame": 0.45},
    "imaginarium":  {"general": 0.35, "teams": 0.20, "gaps": 0.40, "endgame": 0.05},
}

ALL_ELEMENTS = ("pyro", "hydro", "cryo", "electro", "anemo", "geo", "dendro")

# Capacidades extras para personagens recentes (6.x / 7.x) complementando synergy.py
EXTRA_CAPABILITIES: dict[str, list[str]] = {
    "columbina": ["off_field_dps", "buffer"],
    "linnea": ["off_field_dps", "buffer", "res_shred"],
    "lauma": ["off_field_dps", "buffer", "res_shred"],
    "odette": ["off_field_dps", "buffer", "res_shred"],
    "nicole": ["buffer", "shielder"],
    "durin": ["off_field_dps", "res_shred"],
    "ineffa": ["off_field_dps", "shielder", "buffer"],
    "iansan": ["buffer", "healer_active"],
    "alyosha": ["off_field_dps", "buffer"],
    "valeriy": ["shielder", "buffer"],
    "mitya": ["on_field_dps", "off_field_dps"],
    "sandrone": ["on_field_dps"],
    "vesna": ["on_field_dps"],
    "zibai": ["on_field_dps"],
    "flins": ["on_field_dps"],
    "varka": ["on_field_dps"],
    "varesa": ["on_field_dps"],
    "mualani": ["on_field_dps"],
    "kinich": ["on_field_dps"],
    "lohen": ["on_field_dps"],
    "yumemizuki-mizuki": ["on_field_dps", "healer_active"],
    "lan-yan": ["shielder", "res_shred"],
    "illuga": ["buffer"],
    "prune": ["buffer"],
    "aino": ["off_field_dps", "buffer"],
    "ororon": ["off_field_dps", "buffer"],
    "emilie": ["off_field_dps"],
    "chiori": ["off_field_dps"],
    "dahlia": ["shielder", "buffer"],
    "traveler-cryo": ["on_field_dps", "off_field_dps", "buffer"],
}

# Pares de alta sinergia: se o jogador já tem A e não tem B, B ganha bônus direto
HIGH_SYNERGY_PAIRS: list[tuple[str, str, int, str]] = [
    ("skirk", "escoffier", 30, "Par principal da Skirk (RES Shred + Cura Freeze)"),
    ("furina", "escoffier", 25, "Ativa stacks da Furina com cura em área + RES Shred"),
    ("skirk", "furina", 22, "Par principal da Skirk (Buff DMG + Hydro Off-Field)"),
    ("skirk", "vodyanitsa", 22, "Par premium Freeze para Skirk (Cura + RES Shred)"),
    ("furina", "xilonen", 20, "Cura rápida + RES Shred universal para Furina"),
    ("furina", "vodyanitsa", 20, "Cura em área + RES Shred para Furina"),
    ("mavuika", "citlali", 28, "Par principal Melt da Mavuika (Escudo + RES Shred Pyro/Hydro)"),
    ("mavuika", "xilonen", 25, "Recarrega Fighting Spirit + RES Shred da Mavuika"),
    ("neuvillette", "furina", 25, "Par principal do Neuvillette (Buff DMG + Ressonância Hydro)"),
    ("neuvillette", "xilonen", 20, "RES Shred + cura confortável para Neuvillette"),
    ("neuvillette", "kaedehara-kazuha", 18, "RES Shred VV + Buff Hydro para Neuvillette"),
    ("arlecchino", "citlali", 24, "Habilita Melt consistente + escudo para Arlecchino"),
    ("arlecchino", "xilonen", 18, "RES Shred + Buff DMG para Arlecchino"),
    ("nefer", "lauma", 30, "Par principal da Nefer (habilitadora Dendro)"),
    ("flins", "ineffa", 28, "Par principal Lunar-Charged do Flins"),
    ("zibai", "columbina", 26, "Par principal Lunar da Zibai"),
    ("zibai", "linnea", 24, "Suporte/Sub-DPS principal da Zibai"),
    ("mitya", "odette", 28, "Suporte Cryo principal para Stellar-Conduct do Mitya"),
    ("sandrone", "odette", 26, "Par principal Cryo/Stellar da Sandrone"),
    ("vesna", "odette", 22, "Par de alta sinergia com Vesna"),
    ("mitya", "yae-miko", 18, "Sub-DPS Electro forte nos times do Mitya"),
    ("sandrone", "yae-miko", 18, "Par Stellar-Conduct com Sandrone"),
    ("kamisato-ayaka", "escoffier", 24, "Revitaliza Freeze da Ayaka com RES Shred + Cura"),
    ("kamisato-ayaka", "shenhe", 18, "Buff direto de dano Cryo para Ayaka"),
    ("xiao", "xianyun", 25, "Par principal Plunge do Xiao"),
    ("kinich", "emilie", 22, "Par principal Burning do Kinich"),
]

# Personagens que não entram em banners (excluídos do ranking padrão, mas avaliáveis via target_slug)
EXCLUDED_FROM_RANKING = {"aloy"}

CAPABILITY_LABELS_PT = {
    "res_shred": "Redução de RES (Kazuha/Xilonen/Citlali/Escoffier)",
    "furina_healer": "Healer forte para ativar a Furina",
    "healer_active": "Healer ativo",
    "shielder": "Escudo / resistência a interrupção",
}


@dataclass(frozen=True)
class CharacterLite:
    slug: str
    name: str
    icon: Optional[str]
    rarity: int
    element: str
    weapon_type: str


@dataclass(frozen=True)
class TemplateLite:
    id: int
    name: str
    archetype: str
    character_slugs: tuple[str, ...]
    source: Optional[str]
    sources_count: int


@dataclass(frozen=True)
class TierSummaryLite:
    consensus_tier: Optional[str]
    avg_score: float
    site_count: int
    dominant_role: str = "general"


def get_capabilities(slug: str) -> list[str]:
    caps = list(CHARACTER_CAPABILITIES.get(slug, []))
    for c in EXTRA_CAPABILITIES.get(slug, []):
        if c not in caps:
            caps.append(c)
    return caps


def _is_traveler(slug: str) -> bool:
    return slug == "traveler" or slug.startswith("traveler-")


def _verdict_for_score(score: float) -> tuple[str, str]:
    if score >= 76:
        return "must_pull", "Prioridade Máxima"
    if score >= 60:
        return "high_value", "Alto Valor"
    if score >= 44:
        return "good_option", "Boa Opção"
    return "situational", "Situacional / Luxo"


def _diminishing_weight(index_in_archetype: int) -> float:
    return (1.0, 0.5, 0.25, 0.1)[min(index_in_archetype, 3)]


def compute_pull_recommendations(
    characters: list[CharacterLite],
    templates: list[TemplateLite],
    general_tiers: dict[str, TierSummaryLite],
    abyss_tiers: dict[str, TierSummaryLite],
    stygian_tiers: dict[str, TierSummaryLite],
    owned_slugs: list[str],
    goal: str = "meta",
    rarity_filter: Optional[int] = None,
    element_filter: Optional[str] = None,
    target_slug: Optional[str] = None,
    limit: int = 20,
) -> dict[str, Any]:
    """Calcula recomendações de pull de forma pura/testável (sem acoplamento direto ao DB)."""
    weights = GOAL_WEIGHTS.get(goal, GOAL_WEIGHTS["meta"])
    chars_by_slug = {c.slug: c for c in characters}
    owned_set = {s for s in owned_slugs if s in chars_by_slug}

    def _is_strong_main_dps(slug: str) -> bool:
        gen = general_tiers.get(slug)
        caps = get_capabilities(slug)
        is_dps = ("on_field_dps" in caps) or (gen is not None and gen.dominant_role == "main_dps")
        if not is_dps:
            return False
        if gen is None:
            return False
        return gen.consensus_tier in ("S+", "S", "A") or gen.avg_score >= 0.55

    # --- 1. Diagnóstico da Conta (Account Summary) ---
    element_counts: dict[str, int] = {el: 0 for el in ALL_ELEMENTS}
    strong_dps_elements: set[str] = set()
    owned_caps: Counter[str] = Counter()
    has_furina = "furina" in owned_set
    owned_furina_healers = owned_set.intersection(FURINA_HEALERS)

    for slug in owned_set:
        c = chars_by_slug[slug]
        if not _is_traveler(slug) and c.element in element_counts:
            element_counts[c.element] += 1
        if c.element in element_counts and _is_strong_main_dps(slug):
            strong_dps_elements.add(c.element)
        for cap in get_capabilities(slug):
            owned_caps[cap] += 1

    # Elementos sem nenhum Main DPS forte (tier A/S/S+) na conta
    missing_dps_elements = [el for el in ALL_ELEMENTS if el not in strong_dps_elements]

    # Elementos fracos: menos de 3 personagens ou os menores quando a conta já tem >= 10 chars
    min_el_count = min(element_counts.values()) if element_counts else 0
    weak_elements = [
        el for el, cnt in sorted(element_counts.items(), key=lambda x: x[1])
        if cnt <= max(2, min_el_count) and (len(owned_set) == 0 or cnt < 5)
    ][:3]

    missing_caps: list[str] = []
    if owned_caps["res_shred"] < 2:
        missing_caps.append("res_shred")
    if has_furina and not owned_furina_healers:
        missing_caps.append("furina_healer")
    if owned_caps["healer_active"] < 2:
        missing_caps.append("healer_active")
    if owned_caps["shielder"] < 1:
        missing_caps.append("shielder")

    ready_teams_count = 0
    almost_ready_teams_count = 0
    for tpl in templates:
        slugs = tpl.character_slugs
        if not slugs:
            continue
        have = sum(1 for s in slugs if s in owned_set)
        if have == len(slugs):
            ready_teams_count += 1
        elif have == len(slugs) - 1:
            almost_ready_teams_count += 1

    # Pré-calcula qualidade média de cada template (baseada no Consenso Geral)
    template_avg_scores: dict[int, float] = {}
    for tpl in templates:
        vals = [
            general_tiers[s].avg_score
            for s in tpl.character_slugs
            if s in general_tiers
        ]
        template_avg_scores[tpl.id] = round(sum(vals) / len(vals), 4) if vals else 0.5

    # Pré-indexa sinergias por candidato (bidirecional: se tem A, recomenda B; se tem B, recomenda A)
    synergy_for_candidate: dict[str, list[tuple[str, int, str]]] = defaultdict(list)
    for a, b, bonus, desc in HIGH_SYNERGY_PAIRS:
        if a in owned_set and b not in owned_set:
            synergy_for_candidate[b].append((a, bonus, desc))
        if b in owned_set and a not in owned_set:
            synergy_for_candidate[a].append((b, bonus, desc))

    def evaluate_candidate(char: CharacterLite) -> dict[str, Any]:
        slug = char.slug
        already_owned = slug in owned_set
        gen = general_tiers.get(slug)
        abyss = abyss_tiers.get(slug)
        styg = stygian_tiers.get(slug)

        # (A) Consenso Geral (0–100)
        if gen:
            conf = min(1.0, 0.75 + 0.05 * gen.site_count)
            general_score = round(gen.avg_score * 100.0 * conf, 1)
        else:
            general_score = 35.0

        # (B) Desbloqueio de Times (3/4 -> 4/4 e 2/4 -> 3/4)
        # Se já possui o personagem (no simulador), avalia times que ele já fecha na conta
        effective_owned_without = owned_set - {slug}
        unlocked_list: list[tuple[float, TemplateLite, float]] = []
        near_count = 0

        for tpl in templates:
            if slug not in tpl.character_slugs:
                continue
            others = [s for s in tpl.character_slugs if s != slug]
            owned_others = sum(1 for s in others if s in effective_owned_without)
            if owned_others == len(others) and len(others) >= 2:
                team_q = template_avg_scores[tpl.id]
                multi_bonus = 1.0 + 0.15 * min(max(tpl.sources_count - 1, 0), 3)
                weight_val = team_q * multi_bonus
                unlocked_list.append((weight_val, tpl, team_q))
            elif owned_others == len(others) - 1 and len(others) >= 2:
                near_count += 1

        unlocked_list.sort(key=lambda x: (x[0], x[1].sources_count), reverse=True)

        # Retorno decrescente dentro do mesmo arquétipo
        arch_seen: Counter[str] = Counter()
        raw_unlock_points = 0.0
        for weight_val, tpl, _ in unlocked_list:
            idx = arch_seen[tpl.archetype]
            arch_seen[tpl.archetype] += 1
            raw_unlock_points += weight_val * _diminishing_weight(idx) * 34.0

        # Pequeno bônus para times 2/4 -> 3/4 (ajuda contas menores a planejar próximo core)
        raw_unlock_points += min(near_count, 6) * 3.5
        team_unlock_score = round(min(100.0, raw_unlock_points), 1)

        # (C) Lacunas da Conta (0–100)
        gap_points = 0.0
        reasons: list[str] = []
        caps = get_capabilities(slug)

        # Sinergias diretas com personagens que o usuário JÁ possui
        syn_hits = synergy_for_candidate.get(slug, [])
        syn_hits_sorted = sorted(syn_hits, key=lambda x: x[1], reverse=True)
        partners_owned = []
        for idx_s, (partner_slug, bonus, _desc) in enumerate(syn_hits_sorted):
            if partner_slug not in partners_owned:
                partners_owned.append(partner_slug)
            gap_points += bonus * (1.0 if idx_s == 0 else 0.5)

        if partners_owned:
            partner_names = [chars_by_slug[p].name for p in partners_owned[:3] if p in chars_by_slug]
            if partner_names:
                reasons.append(f"Alta sinergia com {', '.join(partner_names)}")

        # Cura específica para Furina
        if has_furina and not owned_furina_healers and slug in FURINA_HEALERS:
            gap_points += 30.0
            reasons.append("Resolve falta de healer forte para ativar a Furina")

        # Lacunas de capacidade (RES shred, healer, shielder)
        if "res_shred" in missing_caps and "res_shred" in caps:
            gap_points += 22.0
            reasons.append("Cobre lacuna crítica: Redução de RES")
        if "healer_active" in missing_caps and "healer_active" in caps:
            gap_points += 18.0
            reasons.append("Reforça cura ativa da conta")
        if "shielder" in missing_caps and "shielder" in caps:
            gap_points += 18.0
            reasons.append("Cobre falta de escudeiro na conta")

        # Cobertura de Main DPS forte por elemento (ex.: conta sem DPS Geo/Electro/etc.)
        if char.element in missing_dps_elements and _is_strong_main_dps(slug):
            dps_el_bonus = 34.0 if goal == "imaginarium" else 26.0
            gap_points += dps_el_bonus
            reasons.append(
                f"Cobre falta de Main DPS forte de {char.element.capitalize()}"
            )

        # Cobertura elemental geral (forte no modo Teatro Imaginário)
        el_cnt = element_counts.get(char.element, 0)
        if char.element in weak_elements:
            el_bonus = 28.0 if goal == "imaginarium" else 14.0
            gap_points += el_bonus
            reasons.append(
                f"Reforça elemento carente ({char.element.capitalize()}: {el_cnt} na conta)"
            )

        account_gap_score = round(min(100.0, gap_points), 1)

        # (D) Endgame Sazonal 30d (0–100) — separado do Consenso Geral!
        endgame_vals = []
        if abyss:
            endgame_vals.append(abyss.avg_score * 100.0)
        if styg:
            endgame_vals.append(styg.avg_score * 100.0)
        endgame_score = round(sum(endgame_vals) / len(endgame_vals), 1) if endgame_vals else round(general_score * 0.7, 1)

        # --- Score Final Ponderado ---
        final_score = round(
            weights["general"] * general_score
            + weights["teams"] * team_unlock_score
            + weights["gaps"] * account_gap_score
            + weights["endgame"] * endgame_score,
            1,
        )
        verdict, verdict_label = _verdict_for_score(final_score)

        # Razões de topo (em ordem de impacto)
        ordered_reasons: list[str] = []
        if unlocked_list:
            top_tpl = unlocked_list[0][1]
            if len(unlocked_list) == 1:
                ordered_reasons.append(f"Fecha 1 time pronto: {top_tpl.name}")
            else:
                ordered_reasons.append(
                    f"Fecha {len(unlocked_list)} times prontos (ex.: {top_tpl.name})"
                )
        elif near_count > 0:
            ordered_reasons.append(f"Deixa {near_count} time(s) em 3/4 (faltando só 1 slot)")

        if gen and gen.consensus_tier in ("S+", "S"):
            ordered_reasons.append(
                f"Consenso Geral {gen.consensus_tier} ({gen.site_count} fontes)"
            )

        ordered_reasons.extend(reasons)

        if (abyss and abyss.consensus_tier in ("S+", "S")) or (styg and styg.consensus_tier in ("S+", "S")):
            parts = []
            if abyss and abyss.consensus_tier:
                parts.append(f"Abismo {abyss.consensus_tier}")
            if styg and styg.consensus_tier:
                parts.append(f"Stygian {styg.consensus_tier}")
            if parts:
                ordered_reasons.append(f"Destaque no Endgame 30d ({' · '.join(parts)})")

        # Deduplica mantendo ordem
        dedup_reasons: list[str] = []
        for r in ordered_reasons:
            if r not in dedup_reasons:
                dedup_reasons.append(r)

        role = gen.dominant_role if gen else "general"
        return {
            "slug": slug,
            "name": char.name,
            "icon": char.icon,
            "rarity": char.rarity,
            "element": char.element,
            "weapon_type": char.weapon_type,
            "role": role,
            "already_owned": already_owned,
            "score": final_score,
            "verdict": verdict,
            "verdict_label": verdict_label,
            "breakdown": {
                "general_meta": general_score,
                "team_unlocks": team_unlock_score,
                "account_gaps": account_gap_score,
                "endgame_seasonal": endgame_score,
            },
            "general_tier": gen.consensus_tier if gen else None,
            "general_avg": round(gen.avg_score, 3) if gen else None,
            "general_sites": gen.site_count if gen else 0,
            "abyss_tier": abyss.consensus_tier if abyss else None,
            "stygian_tier": styg.consensus_tier if styg else None,
            "unlocked_teams_count": len(unlocked_list),
            "near_unlock_teams_count": near_count,
            "unlocked_teams": [
                {
                    "id": tpl.id,
                    "name": tpl.name,
                    "archetype": tpl.archetype,
                    "character_slugs": list(tpl.character_slugs),
                    "source": tpl.source,
                    "sources_count": tpl.sources_count,
                    "team_avg_score": team_q,
                }
                for _, tpl, team_q in unlocked_list[:6]
            ],
            "synergy_partners_owned": partners_owned[:5],
            "reasons": dedup_reasons[:5],
        }

    # --- 2. Avaliação do alvo do Simulador ("Vale a pena pegar X?") ---
    target_eval = None
    if target_slug and target_slug in chars_by_slug:
        target_eval = evaluate_candidate(chars_by_slug[target_slug])

    # --- 3. Ranking de candidatos não possuídos ---
    candidates: list[dict[str, Any]] = []
    for char in characters:
        if char.slug in owned_set or char.slug in EXCLUDED_FROM_RANKING or _is_traveler(char.slug):
            continue
        if rarity_filter is not None and char.rarity != rarity_filter:
            continue
        if element_filter and element_filter != "all" and char.element != element_filter.lower():
            continue
        candidates.append(evaluate_candidate(char))

    candidates.sort(
        key=lambda x: (
            x["score"],
            x["unlocked_teams_count"],
            x["general_avg"] or 0.0,
        ),
        reverse=True,
    )

    return {
        "goal": goal,
        "account_summary": {
            "owned_count": len(owned_set),
            "ready_teams_count": ready_teams_count,
            "almost_ready_teams_count": almost_ready_teams_count,
            "total_templates": len(templates),
            "element_counts": element_counts,
            "weak_elements": weak_elements,
            "missing_dps_elements": missing_dps_elements,
            "missing_capabilities": [CAPABILITY_LABELS_PT.get(m, m) for m in missing_caps],
        },
        "target_evaluation": target_eval,
        "recommendations": candidates[:limit],
    }


def _fetch_category_tiers(db: Session, category: str) -> dict[str, TierSummaryLite]:
    """Busca consenso agregado de uma categoria ('general', 'abyss', 'stygian')."""
    if category == "abyss":
        where_site = "s.slug = 'yshelper-abyss'"
    elif category == "stygian":
        where_site = "(s.slug = 'yshelper-stygian' OR s.slug LIKE 'prydwen-stygian-%')"
    else:
        where_site = "(s.slug NOT LIKE 'yshelper-%' AND s.slug NOT LIKE 'prydwen-stygian-%')"

    rows = db.execute(text(f"""
        WITH per_entry AS (
            SELECT e.character_slug, e.role, e.tier_master, e.normalized_value, e.site_id
            FROM tierlist_entries e
            JOIN tierlist_sites s ON s.id = e.site_id
            WHERE e.tier_master IS NOT NULL AND {where_site}
        ),
        agg AS (
            SELECT
                character_slug,
                COUNT(DISTINCT site_id) AS site_count,
                AVG(normalized_value)::float AS avg_normalized
            FROM per_entry
            GROUP BY character_slug
        ),
        tier_counts AS (
            SELECT character_slug, tier_master, COUNT(*) AS cnt
            FROM per_entry
            GROUP BY character_slug, tier_master
        ),
        consensus_tier AS (
            SELECT DISTINCT ON (character_slug)
                character_slug, tier_master AS consensus_tier
            FROM tier_counts
            ORDER BY character_slug, cnt DESC,
                CASE tier_master WHEN 'S+' THEN 1 WHEN 'S' THEN 2 WHEN 'A' THEN 3
                                 WHEN 'B' THEN 4 WHEN 'C' THEN 5 WHEN 'D' THEN 6 END
        ),
        dominant_role AS (
            SELECT DISTINCT ON (character_slug)
                character_slug, role
            FROM per_entry
            WHERE role IS NOT NULL
            GROUP BY character_slug, role
            ORDER BY character_slug, COUNT(*) DESC,
                CASE role WHEN 'main_dps' THEN 1 WHEN 'sub_dps' THEN 2
                          WHEN 'support' THEN 3 ELSE 4 END
        )
        SELECT a.character_slug, ct.consensus_tier, a.avg_normalized, a.site_count,
               COALESCE(dr.role, 'general') AS dominant_role
        FROM agg a
        LEFT JOIN consensus_tier ct ON ct.character_slug = a.character_slug
        LEFT JOIN dominant_role dr ON dr.character_slug = a.character_slug
    """)).mappings().all()

    return {
        r["character_slug"]: TierSummaryLite(
            consensus_tier=r["consensus_tier"],
            avg_score=float(r["avg_normalized"]),
            site_count=int(r["site_count"]),
            dominant_role=r["dominant_role"] or "general",
        )
        for r in rows
    }


def build_pull_advisor_response(
    db: Session,
    lang: Language,
    owned_slugs: list[str],
    goal: str = "meta",
    rarity_filter: Optional[int] = None,
    element_filter: Optional[str] = None,
    target_slug: Optional[str] = None,
    limit: int = 20,
) -> dict[str, Any]:
    """Carrega personagens, templates e tierlists (Geral + Abismo + Stygian) e roda o motor."""
    db_chars = db.query(Character).all()
    characters: list[CharacterLite] = []
    for c in db_chars:
        resolved = resolve_character(db, c, lang)
        el = c.element.value if hasattr(c.element, "value") else str(c.element)
        wpn = c.weapon_type.value if hasattr(c.weapon_type, "value") else str(c.weapon_type)
        characters.append(
            CharacterLite(
                slug=c.slug,
                name=resolved["name"],
                icon=c.icon,
                rarity=c.rarity,
                element=el,
                weapon_type=wpn,
            )
        )

    db_templates = db.query(TeamTemplate).all()
    templates: list[TemplateLite] = []
    for t in db_templates:
        slugs = tuple(t.character_slugs or [])
        if len(slugs) < 3:
            continue
        sources_list = t.sources if isinstance(t.sources, list) else []
        templates.append(
            TemplateLite(
                id=t.id,
                name=t.name,
                archetype=t.archetype or "unknown",
                character_slugs=slugs,
                source=t.source,
                sources_count=max(len(sources_list), 1 if t.source else 0),
            )
        )

    general_tiers = _fetch_category_tiers(db, "general")
    abyss_tiers = _fetch_category_tiers(db, "abyss")
    stygian_tiers = _fetch_category_tiers(db, "stygian")

    return compute_pull_recommendations(
        characters=characters,
        templates=templates,
        general_tiers=general_tiers,
        abyss_tiers=abyss_tiers,
        stygian_tiers=stygian_tiers,
        owned_slugs=owned_slugs,
        goal=goal,
        rarity_filter=rarity_filter,
        element_filter=element_filter,
        target_slug=target_slug,
        limit=limit,
    )
