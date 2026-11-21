"""Motor de recomendação de upgrades ("Quem upar até Lv.90 & Talentos?").

Avalia os personagens que o jogador JÁ POSSUI na conta e indica em quem
investir resina agora (subir nível até 80/90 ou 90 + níveis de talento),
combinando 4 sinais transparentes:
  1. Valor de Meta (Consenso Geral de 7 fontes)
  2. Uso nos Times Prontos (4/4) que o jogador já fecha na conta
  3. Retorno do Upgrade (o quanto o personagem ganha subindo para Lv.90/80
     pela escala de HP/DEF/EM/Reações/ATQ Base + níveis de talento faltantes)
  4. Endgame Sazonal 30d (Abismo Espiral + Stygian Onslaught)
"""
from collections import Counter
from dataclasses import dataclass
import re
from typing import Any, Optional

from sqlalchemy.orm import Session

from ..models import Character, Language, TeamTemplate
from .i18n import resolve_character
from .presets import pick_best_presets_batch
from .pull_advisor import (
    CharacterLite,
    TemplateLite,
    TierSummaryLite,
    _diminishing_weight,
    _fetch_category_tiers,
    get_capabilities,
)

# Pesos por objetivo do jogador (somam 1.0)
UPGRADE_GOAL_WEIGHTS: dict[str, dict[str, float]] = {
    "overall":    {"meta": 0.35, "teams": 0.30, "gain": 0.25, "endgame": 0.10},
    "endgame":    {"meta": 0.20, "teams": 0.20, "gain": 0.20, "endgame": 0.40},
    "teams":      {"meta": 0.20, "teams": 0.50, "gain": 0.20, "endgame": 0.10},
    "quick_wins": {"meta": 0.25, "teams": 0.20, "gain": 0.45, "endgame": 0.10},
}

# Personagens que escalam diretamente com Vida (HP Base cresce muito de 80 -> 90)
HP_SCALERS: set[str] = {
    "furina", "neuvillette", "yelan", "hu-tao", "zhongli", "sangonomiya-kokomi",
    "nilou", "baizhu", "sigewinne", "mualani", "dehya", "layla", "diona",
    "barbara", "yaoyao", "kirara", "candace", "chevreuse", "mika", "dori",
    "dahlia", "vodyanitsa", "columbina", "linnea",
}

# Personagens que escalam com DEF (DEF Base cresce muito de 80 -> 90)
DEF_SCALERS: set[str] = {
    "xilonen", "chiori", "albedo", "arataki-itto", "noelle", "gorou",
    "yun-jin", "kachina", "zibai", "illuga",
}

# Personagens que dependem de Reações Transformativas / Catalyze / EM (Lv.90 dá ~30% mais dano de reação)
TRANSFORMATIVE_OR_EM_SCALERS: set[str] = {
    "kaedehara-kazuha", "sucrose", "venti", "jean", "sayu", "lynette",
    "yumemizuki-mizuki", "lan-yan", "jahoda",
    "nahida", "alhaitham", "tighnari", "baizhu", "yaoyao", "kirara",
    "collei", "kaveh", "emilie", "kinich", "lauma", "nefer",
    "kuki-shinobu", "raiden-shogun", "cyno", "yae-miko", "fischl", "keqing",
    "clorinde", "sethos", "ororon", "flins", "ineffa",
    "thoma", "aino", "nilou", "traveler-dendro",
}

# Buffers de ATQ Base (ATQ Base do nível 90 vira buff direto para o time)
BASE_ATK_BUFFERS: set[str] = {
    "bennett", "kujou-sara", "iansan",
}

# Carries Anemo puros de ATK/CRIT (Lv.90 é bom mas não obrigatório como Swirl EM)
ANEMO_ATK_CARRIES: set[str] = {
    "xiao", "wanderer", "chasca", "shikanoin-heizou", "varka",
}

TALENT_LABELS_PT: dict[str, str] = {
    "na": "ATQ Normal",
    "es": "Skill (E)",
    "eb": "Burst (Q)",
}


@dataclass(frozen=True)
class CharProgressLite:
    slug: str
    level: Optional[int] = None
    cons: Optional[int] = None
    na: Optional[int] = None
    es: Optional[int] = None
    eb: Optional[int] = None

    @property
    def has_data(self) -> bool:
        return (
            self.level is not None
            or self.na is not None
            or self.es is not None
            or self.eb is not None
        )


@dataclass(frozen=True)
class BuildHintLite:
    talent_priority: Optional[str] = None
    sands_stats: tuple[str, ...] = ()
    goblet_stats: tuple[str, ...] = ()
    circlet_stats: tuple[str, ...] = ()


def classify_level_target(
    slug: str,
    element: str,
    build_hint: Optional[BuildHintLite] = None,
) -> tuple[int, str, bool, str]:
    """Retorna (recommended_level, label, needs_level_90, scaling_tag)."""
    sands = {s.lower() for s in (build_hint.sands_stats if build_hint else ())}
    goblets = {s.lower() for s in (build_hint.goblet_stats if build_hint else ())}
    circlets = {s.lower() for s in (build_hint.circlet_stats if build_hint else ())}
    all_main = sands | goblets | circlets

    if slug in BASE_ATK_BUFFERS:
        return 90, "Lv. 90", True, "Buff de ATQ Base (Lv.90 maximiza o buff)"

    if slug in DEF_SCALERS or any("def" in s for s in sands):
        return 90, "Lv. 90", True, "Escala com DEF (alto ganho de 80 → 90)"

    if slug in HP_SCALERS or any("hp" in s for s in sands):
        return 90, "Lv. 90", True, "Escala com Vida/HP (alto ganho de 80 → 90)"

    em_heavy = (
        slug in TRANSFORMATIVE_OR_EM_SCALERS
        or element == "dendro"
        or (element == "anemo" and slug not in ANEMO_ATK_CARRIES)
        or sum(1 for s in all_main if s in ("em", "elemental_mastery", "elemental mastery")) >= 2
    )
    if em_heavy:
        return 90, "Lv. 90", True, "Reações / EM (Lv.90 dá ~30% mais dano de reação)"

    return 80, "Lv. 80/90 (A6)", False, "Escala com ATQ (80/90 A6 já entrega ~95%)"


def _match_talent_tokens(chunk: str) -> list[str]:
    """Identifica quais talentos (na, es, eb) aparecem em um trecho de prioridade."""
    low = chunk.lower()
    # Remove observações entre parênteses como "(optional)" ou "(don't level)"
    if re.search(r"(optional|opcional|skip|ignore|don't|nao upar|não upar)", low):
        return []
    found: list[str] = []
    if re.search(r"\b(burst|elemental burst|eb|q|ult|ultimate|supremo)\b", low):
        found.append("eb")
    if re.search(r"\b(skill|elemental skill|es|e|habilidade)\b", low):
        found.append("es")
    if re.search(r"\b(normal|normal attack|na|aa|auto|ataque normal)\b", low):
        found.append("na")
    return found


def parse_talent_targets(
    talent_priority_text: Optional[str],
    role: str,
    tier: Optional[str],
    caps: list[str],
    current_na: Optional[int],
    current_es: Optional[int],
    current_eb: Optional[int],
) -> list[dict[str, Any]]:
    """Converte a string `talent_priority` do guia em metas concretas por talento."""
    is_top_meta = tier in ("S+", "S")
    is_main_dps = role == "main_dps" or "on_field_dps" in caps

    # priority_map: key -> rank (1 = principal, 2 = secundário, 3 = terciário, 4 = ignorar)
    priority_map: dict[str, int] = {}

    if talent_priority_text and talent_priority_text.strip():
        # Normaliza separadores ">=" ou "≥" ou "->" para ">"
        cleaned = re.sub(r"(>=|≥|→|->|»)", ">", talent_priority_text)
        # Corta comentários longos após ponto-e-vírgula ou quebra de linha
        cleaned = re.split(r"[\n;]", cleaned)[0]
        groups = [g.strip() for g in cleaned.split(">") if g.strip()]

        rank = 1
        for grp in groups:
            # Dentro de um grupo pode haver empates com "=" ou "/" ou ","
            sub_tokens = re.split(r"[=/,]", grp)
            matched_in_group: list[str] = []
            for tok in sub_tokens:
                for key in _match_talent_tokens(tok):
                    if key not in priority_map:
                        matched_in_group.append(key)
            for key in matched_in_group:
                priority_map[key] = rank
            if matched_in_group:
                rank += 1

    # Fallback quando não foi possível extrair do guia
    if not priority_map:
        if is_main_dps:
            priority_map = {"na": 1, "es": 2, "eb": 2}
        elif role == "sub_dps" or "off_field_dps" in caps:
            priority_map = {"es": 1, "eb": 1, "na": 4}
        else:
            priority_map = {"eb": 1, "es": 2, "na": 4}
    else:
        # Talentos não mencionados na prioridade ficam como opcionais (4)
        for k in ("na", "es", "eb"):
            if k not in priority_map:
                priority_map[k] = 4

    # Define nível recomendado (1..9) com base na prioridade e importância do char
    def _rec_level(key: str, prio: int) -> int:
        if prio == 1:
            return 9
        if prio == 2:
            return 9 if (is_top_meta and key != "na") else 8
        if prio == 3:
            if key == "na" and not is_main_dps:
                return 1
            return 6 if is_main_dps else 1
        return 1

    currents = {"na": current_na, "es": current_es, "eb": current_eb}
    out: list[dict[str, Any]] = []
    for key in ("na", "es", "eb"):
        prio = min(priority_map.get(key, 4), 3)
        rec = _rec_level(key, priority_map.get(key, 4))
        cur = currents[key]
        needs = (cur < rec) if (cur is not None and rec > 1) else (cur is None and rec > 1)
        out.append({
            "key": key,
            "label": TALENT_LABELS_PT[key],
            "priority": prio,
            "current": cur,
            "recommended": rec,
            "needs_upgrade": needs,
        })
    return out


def _verdict_for_upgrade(score: float, already_built: bool) -> tuple[str, str]:
    if already_built:
        return "already_built", "Já Pronto"
    if score >= 72:
        return "priority_now", "Upar Agora"
    if score >= 56:
        return "high_impact", "Alto Retorno"
    return "good_upgrade", "Vale Upar"


def compute_upgrade_recommendations(
    characters: list[CharacterLite],
    templates: list[TemplateLite],
    general_tiers: dict[str, TierSummaryLite],
    abyss_tiers: dict[str, TierSummaryLite],
    stygian_tiers: dict[str, TierSummaryLite],
    build_hints: dict[str, BuildHintLite],
    owned_slugs: list[str],
    progress_list: list[CharProgressLite],
    goal: str = "overall",
    stage_filter: str = "needs_work",
    rarity_filter: Optional[int] = None,
    element_filter: Optional[str] = None,
    limit: int = 30,
) -> dict[str, Any]:
    """Calcula prioridades de upgrade (Lv.90 & Talentos) para os personagens possuídos."""
    weights = UPGRADE_GOAL_WEIGHTS.get(goal, UPGRADE_GOAL_WEIGHTS["overall"])
    chars_by_slug = {c.slug: c for c in characters}

    progress_map: dict[str, CharProgressLite] = {
        p.slug: p for p in progress_list if p.slug in chars_by_slug
    }

    owned_set = {s for s in owned_slugs if s in chars_by_slug} | set(progress_map.keys())

    # Pré-calcula qualidade média de cada template
    template_avg_scores: dict[int, float] = {}
    for tpl in templates:
        vals = [general_tiers[s].avg_score for s in tpl.character_slugs if s in general_tiers]
        template_avg_scores[tpl.id] = round(sum(vals) / len(vals), 4) if vals else 0.5

    # Pré-indexa times prontos (4/4) que o jogador já fecha na conta
    ready_templates_by_char: dict[str, list[tuple[float, TemplateLite, float]]] = {}
    for tpl in templates:
        slugs = tpl.character_slugs
        if len(slugs) < 3:
            continue
        if all(s in owned_set for s in slugs):
            team_q = template_avg_scores[tpl.id]
            multi_bonus = 1.0 + 0.15 * min(max(tpl.sources_count - 1, 0), 3)
            weight_val = team_q * multi_bonus
            for s in slugs:
                ready_templates_by_char.setdefault(s, []).append((weight_val, tpl, team_q))

    for lst in ready_templates_by_char.values():
        lst.sort(key=lambda x: (x[0], x[1].sources_count), reverse=True)

    all_evaluated: list[dict[str, Any]] = []
    with_progress_count = 0
    needs_upgrade_count = 0
    needs_90_count = 0
    needs_talents_count = 0
    built_count = 0

    for slug in owned_set:
        char = chars_by_slug[slug]
        prog = progress_map.get(slug)
        has_prog = bool(prog and prog.has_data)
        if has_prog:
            with_progress_count += 1

        gen = general_tiers.get(slug)
        abyss = abyss_tiers.get(slug)
        styg = stygian_tiers.get(slug)
        role = gen.dominant_role if gen else "general"
        caps = get_capabilities(slug)
        hint = build_hints.get(slug)

        # (A) Valor de Meta (0–100)
        if gen:
            conf = min(1.0, 0.75 + 0.05 * gen.site_count)
            meta_score = round(gen.avg_score * 100.0 * conf, 1)
        else:
            meta_score = 35.0

        # (B) Uso em Times Prontos na conta (0–100)
        ready_list = ready_templates_by_char.get(slug, [])
        arch_seen: Counter[str] = Counter()
        raw_team_points = 0.0
        for weight_val, tpl, _ in ready_list:
            idx = arch_seen[tpl.archetype]
            arch_seen[tpl.archetype] += 1
            raw_team_points += weight_val * _diminishing_weight(idx) * 32.0
        team_usage_score = round(min(100.0, raw_team_points), 1)

        # (C) Metas de Nível & Talentos + Ganho de Upgrade (0–100)
        rec_level, rec_level_label, needs_90, scaling_tag = classify_level_target(
            slug, char.element, hint
        )
        cur_level = prog.level if prog else None
        cur_cons = prog.cons if prog else None

        talents = parse_talent_targets(
            talent_priority_text=hint.talent_priority if hint else None,
            role=role,
            tier=gen.consensus_tier if gen else None,
            caps=caps,
            current_na=prog.na if prog else None,
            current_es=prog.es if prog else None,
            current_eb=prog.eb if prog else None,
        )

        if cur_level is not None:
            level_gap = max(0, rec_level - cur_level)
        else:
            level_gap = rec_level  # desconhecido: assume que precisa evoluir

        talent_levels_needed = 0
        for t in talents:
            if t["recommended"] > 1:
                if t["current"] is not None:
                    talent_levels_needed += max(0, t["recommended"] - t["current"])
                else:
                    talent_levels_needed += t["recommended"] - 1

        level_done = (cur_level is not None and cur_level >= rec_level)
        talents_done = (
            has_prog
            and all(
                (t["current"] is not None and t["current"] >= t["recommended"])
                for t in talents
                if t["recommended"] > 1
            )
        )
        already_built = has_prog and level_done and talents_done

        if already_built:
            built_count += 1
            upgrade_gain_score = 0.0
        else:
            needs_upgrade_count += 1
            if needs_90 and not level_done:
                needs_90_count += 1
            if not talents_done:
                needs_talents_count += 1

            # Calcula pontuação de retorno do investimento em resina
            gain_pts = 0.0
            if not level_done:
                if needs_90:
                    gain_pts += 48.0 if (cur_level is None or cur_level < 85) else 28.0
                else:
                    gain_pts += 32.0 if (cur_level is None or cur_level < 80) else 0.0

            if not talents_done:
                # Cada nível faltante em talento principal vale muito
                primary_gap = sum(
                    max(0, t["recommended"] - (t["current"] or 1))
                    for t in talents
                    if t["priority"] == 1 and t["recommended"] > 1
                )
                secondary_gap = sum(
                    max(0, t["recommended"] - (t["current"] or 1))
                    for t in talents
                    if t["priority"] >= 2 and t["recommended"] > 1
                )
                gain_pts += min(52.0, primary_gap * 8.5 + secondary_gap * 4.5)

            # No modo "quick_wins", dá bônus extra a personagens já próximos da meta
            # (ex.: Lv.60–80 ou precisando de poucos níveis de talento — alto retorno por resina)
            if goal == "quick_wins" and has_prog:
                if cur_level is not None and 60 <= cur_level < rec_level:
                    gain_pts += 22.0
                elif cur_level is not None and cur_level < 40:
                    gain_pts -= 18.0
                if 1 <= talent_levels_needed <= 6:
                    gain_pts += 18.0

            upgrade_gain_score = round(max(10.0, min(100.0, gain_pts)), 1)

        # (D) Endgame Sazonal 30d (0–100)
        endgame_vals = []
        if abyss:
            endgame_vals.append(abyss.avg_score * 100.0)
        if styg:
            endgame_vals.append(styg.avg_score * 100.0)
        endgame_score = (
            round(sum(endgame_vals) / len(endgame_vals), 1)
            if endgame_vals
            else round(meta_score * 0.7, 1)
        )

        # Score final
        if already_built:
            final_score = round(
                0.50 * meta_score + 0.35 * team_usage_score + 0.15 * endgame_score,
                1,
            )
        else:
            final_score = round(
                weights["meta"] * meta_score
                + weights["teams"] * team_usage_score
                + weights["gain"] * upgrade_gain_score
                + weights["endgame"] * endgame_score,
                1,
            )

        verdict, verdict_label = _verdict_for_upgrade(final_score, already_built)

        # Razões explicáveis e diretas
        reasons: list[str] = []
        if already_built:
            reasons.append(f"Build de nível e talentos concluída ({rec_level_label})")
        else:
            if not level_done:
                if cur_level is not None:
                    reasons.append(f"Subir Lv. {cur_level} → {rec_level_label} ({scaling_tag})")
                else:
                    reasons.append(f"Meta recomendada: {rec_level_label} ({scaling_tag})")

            pending_talents = [
                t for t in sorted(talents, key=lambda x: x["priority"])
                if t["needs_upgrade"] and t["recommended"] > 1
            ]
            if pending_talents:
                parts = []
                for t in pending_talents[:3]:
                    if t["current"] is not None:
                        parts.append(f"{t['label']} ({t['current']} → {t['recommended']})")
                    else:
                        parts.append(f"{t['label']} (Lv.{t['recommended']})")
                reasons.append(f"Priorizar talentos: {', '.join(parts)}")

        if ready_list:
            top_tpl = ready_list[0][1]
            if len(ready_list) == 1:
                reasons.append(f"Usado em 1 time pronto na conta: {top_tpl.name}")
            else:
                reasons.append(f"Usado em {len(ready_list)} times prontos (ex.: {top_tpl.name})")

        if gen and gen.consensus_tier in ("S+", "S"):
            reasons.append(f"Consenso Geral {gen.consensus_tier} ({gen.site_count} fontes)")

        if (abyss and abyss.consensus_tier in ("S+", "S")) or (styg and styg.consensus_tier in ("S+", "S")):
            parts = []
            if abyss and abyss.consensus_tier:
                parts.append(f"Abismo {abyss.consensus_tier}")
            if styg and styg.consensus_tier:
                parts.append(f"Stygian {styg.consensus_tier}")
            if parts:
                reasons.append(f"Destaque no Endgame 30d ({' · '.join(parts)})")

        all_evaluated.append({
            "slug": slug,
            "name": char.name,
            "icon": char.icon,
            "rarity": char.rarity,
            "element": char.element,
            "weapon_type": char.weapon_type,
            "role": role,
            "score": final_score,
            "verdict": verdict,
            "verdict_label": verdict_label,
            "breakdown": {
                "meta_value": meta_score,
                "team_usage": team_usage_score,
                "upgrade_gain": upgrade_gain_score,
                "endgame_seasonal": endgame_score,
            },
            "general_tier": gen.consensus_tier if gen else None,
            "general_avg": round(gen.avg_score, 3) if gen else None,
            "general_sites": gen.site_count if gen else 0,
            "abyss_tier": abyss.consensus_tier if abyss else None,
            "stygian_tier": styg.consensus_tier if styg else None,
            "has_progress_data": has_prog,
            "current_level": cur_level,
            "cons": cur_cons,
            "recommended_level": rec_level,
            "recommended_level_label": rec_level_label,
            "needs_level_90": needs_90,
            "level_scaling_tag": scaling_tag,
            "level_gap": level_gap if has_prog else 0,
            "talent_priority_text": hint.talent_priority if hint else None,
            "talents": talents,
            "talent_levels_needed": talent_levels_needed if has_prog else sum(max(0, t["recommended"] - 1) for t in talents if t["recommended"] > 1),
            "already_built": already_built,
            "ready_teams_count": len(ready_list),
            "ready_teams": [
                {
                    "id": tpl.id,
                    "name": tpl.name,
                    "archetype": tpl.archetype,
                    "character_slugs": list(tpl.character_slugs),
                    "source": tpl.source,
                    "sources_count": tpl.sources_count,
                    "team_avg_score": team_q,
                }
                for _, tpl, team_q in ready_list[:6]
            ],
            "reasons": reasons[:5],
            # Flags auxiliares internas para filtragem
            "_level_done": level_done,
            "_talents_done": talents_done,
        })

    # Aplica filtros de exibição
    filtered: list[dict[str, Any]] = []
    for item in all_evaluated:
        if rarity_filter is not None and item["rarity"] != rarity_filter:
            continue
        if element_filter and element_filter != "all" and item["element"] != element_filter.lower():
            continue

        if stage_filter == "needs_work" and item["already_built"]:
            continue
        elif stage_filter == "needs_90" and (not item["needs_level_90"] or item["_level_done"]):
            continue
        elif stage_filter == "needs_talents" and item["_talents_done"]:
            continue
        elif stage_filter == "built" and not item["already_built"]:
            continue

        cleaned_item = {k: v for k, v in item.items() if not k.startswith("_")}
        filtered.append(cleaned_item)

    filtered.sort(
        key=lambda x: (
            0 if x["already_built"] else 1,
            x["score"],
            x["ready_teams_count"],
            x["general_avg"] or 0.0,
        ),
        reverse=True,
    )

    return {
        "goal": goal,
        "summary": {
            "owned_count": len(owned_set),
            "with_progress_count": with_progress_count,
            "needs_upgrade_count": needs_upgrade_count,
            "needs_90_count": needs_90_count,
            "needs_talents_count": needs_talents_count,
            "built_count": built_count,
        },
        "recommendations": filtered[:limit],
    }


def build_upgrade_advisor_response(
    db: Session,
    lang: Language,
    owned_slugs: list[str],
    characters_progress: list[dict[str, Any]],
    goal: str = "overall",
    stage_filter: str = "needs_work",
    rarity_filter: Optional[int] = None,
    element_filter: Optional[str] = None,
    limit: int = 30,
) -> dict[str, Any]:
    """Carrega dados do banco e executa o motor de recomendação de upgrades."""
    db_chars = db.query(Character).all()
    characters: list[CharacterLite] = []
    id_to_slug: dict[int, str] = {}
    for c in db_chars:
        resolved = resolve_character(db, c, lang)
        el = c.element.value if hasattr(c.element, "value") else str(c.element)
        wpn = c.weapon_type.value if hasattr(c.weapon_type, "value") else str(c.weapon_type)
        id_to_slug[c.id] = c.slug
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

    # Carrega melhor preset por personagem em lote (1 query)
    presets_by_id = pick_best_presets_batch(db, list(id_to_slug.keys()))
    build_hints: dict[str, BuildHintLite] = {}
    for cid, preset in presets_by_id.items():
        slug = id_to_slug.get(cid)
        if not slug or not isinstance(preset.build_data, dict):
            continue
        bd = preset.build_data
        build_hints[slug] = BuildHintLite(
            talent_priority=bd.get("talent_priority") if isinstance(bd.get("talent_priority"), str) else None,
            sands_stats=tuple(str(x) for x in (bd.get("sands_stat") or []) if x),
            goblet_stats=tuple(str(x) for x in (bd.get("goblet_stat") or []) if x),
            circlet_stats=tuple(str(x) for x in (bd.get("circlet_stat") or []) if x),
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

    progress_list = [
        CharProgressLite(
            slug=p["slug"],
            level=p.get("level"),
            cons=p.get("cons"),
            na=p.get("na"),
            es=p.get("es"),
            eb=p.get("eb"),
        )
        for p in characters_progress
        if p.get("slug")
    ]

    return compute_upgrade_recommendations(
        characters=characters,
        templates=templates,
        general_tiers=general_tiers,
        abyss_tiers=abyss_tiers,
        stygian_tiers=stygian_tiers,
        build_hints=build_hints,
        owned_slugs=owned_slugs,
        progress_list=progress_list,
        goal=goal,
        stage_filter=stage_filter,
        rarity_filter=rarity_filter,
        element_filter=element_filter,
        limit=limit,
    )
