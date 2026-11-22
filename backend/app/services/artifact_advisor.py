"""Motor de otimização de Domínios de Artefatos & Strongbox ("Artefatos & Domínios").

Cruza os personagens possuídos (e/ou em foco no Planejador) com os sets
recomendados nas builds (4pc BiS, 4pc alternativo e 2pc+2pc) para responder:
  1. Em qual Domínio de Artefatos gastar resina agora (onde AMBOS os sets
     servem à conta, maximizando eficiência por resina)?
  2. Quais sets antigos vale mais buscar no Strongbox (Oferenda Mística)
     em vez de farmar um domínio onde só 1 dos 2 sets interessa?
"""
from dataclasses import dataclass
import re
from typing import Any, Optional

from sqlalchemy.orm import Session

from ..models import ArtifactSet, ArtifactSetTranslation, Character, Language
from .i18n import resolve_character
from .presets import pick_best_presets_batch
from .pull_advisor import CharacterLite, TierSummaryLite, _fetch_category_tiers
from .upgrade_advisor import _effective_mode_score


@dataclass(frozen=True)
class ArtifactSetLite:
    slug: str
    name: str
    icon: Optional[str]
    rarity_max: int
    source: Optional[str]


@dataclass(frozen=True)
class CharArtifactBuildLite:
    artifacts_4pc: tuple[str, ...] = ()
    artifacts_2pc: tuple[tuple[str, str], ...] = ()


@dataclass(frozen=True)
class DomainCatalogEntry:
    domain_id: str
    name_pt: str
    region: str
    set_slugs: tuple[str, ...]
    in_strongbox: bool = True
    is_boss_only: bool = False


# Catálogo curado dos domínios de artefatos 5★ (1.0 -> 5.x) com nomes em PT, região e status de Strongbox.
# Sets novos (6.x / 7.x) que não estejam listados aqui são agrupados automaticamente pelo campo `source` do banco
# com `in_strongbox=False` (priorizando farm direto no domínio).
ARTIFACT_DOMAIN_CATALOG: tuple[DomainCatalogEntry, ...] = (
    # Bosses / Mundo
    DomainCatalogEntry("boss-drops", "Chefes do Mundo / Semanais", "Geral", ("gladiators-finale", "wanderers-troupe"), True, True),
    # Mondstadt
    DomainCatalogEntry("valley-of-remembrance", "Vale da Lembrança", "Mondstadt", ("viridescent-venerer", "maiden-beloved"), True),
    DomainCatalogEntry("midsummer-courtyard", "Jardim do Verão", "Mondstadt", ("thundering-fury", "thundersoother"), True),
    DomainCatalogEntry("peak-of-vindagnyr", "Pico de Vindagnyr", "Mondstadt", ("blizzard-strayer", "heart-of-depth"), True),
    # Liyue
    DomainCatalogEntry("hidden-palace-zhou", "Palácio Oculto da Fórmula Zhou", "Liyue", ("crimson-witch-of-flames", "lavawalker"), True),
    DomainCatalogEntry("clear-pool", "Lago de Luhua e Caverna da Montanha", "Liyue", ("noblesse-oblige", "bloodstained-chivalry"), True),
    DomainCatalogEntry("domain-of-guyun", "Domínio de Guyun", "Liyue", ("archaic-petra", "retracing-bolide"), True),
    DomainCatalogEntry("ridge-watch", "Guarda da Montanha", "Liyue", ("tenacity-of-the-millelith", "pale-flame"), True),
    DomainCatalogEntry("lost-valley", "Vale Perdido (Despenhadeiro)", "Liyue", ("vermillion-hereafter", "echoes-of-an-offering"), True),
    # Inazuma
    DomainCatalogEntry("momiji-dyed-court", "Jardim Outonal (Momiji)", "Inazuma", ("emblem-of-severed-fate", "shimenawas-reminiscence"), True),
    DomainCatalogEntry("slumbering-court", "Corte da Hibernação", "Inazuma", ("husk-of-opulent-dreams", "ocean-hued-clam"), True),
    # Sumeru
    DomainCatalogEntry("spire-of-solitary-enlightenment", "Pináculo da Iluminação Solitária", "Sumeru", ("deepwood-memories", "gilded-dreams"), True),
    DomainCatalogEntry("city-of-gold", "Cidade do Ouro", "Sumeru", ("desert-pavilion-chronicle", "flower-of-paradise-lost"), True),
    DomainCatalogEntry("molten-iron-fortress", "Fortaleza de Ferro Derretido", "Sumeru", ("nymphs-dream", "vourukashas-glow"), True),
    # Fontaine
    DomainCatalogEntry("denouement-of-sin", "Desfecho do Pecado", "Fontaine", ("marechaussee-hunter", "golden-troupe"), True),
    DomainCatalogEntry("waterfall-wen", "Cachoeira da Cidade Submersa", "Fontaine", ("song-of-days-past", "nighttime-whispers-in-the-echoing-woods"), True),
    DomainCatalogEntry("faded-theater", "Teatro Desbotado", "Fontaine", ("fragment-of-harmonic-whimsy", "unfinished-reverie"), True),
    # Natlan
    DomainCatalogEntry("sanctum-of-rainbow-spirits", "Santuário dos Espíritos Arco-Íris", "Natlan", ("scroll-of-the-hero-of-cinder-city", "obsidian-codex"), True),
    DomainCatalogEntry("derelict-masonry-dock", "Cais de Alvenaria Abandonado", "Natlan", ("long-nights-oath", "finale-of-the-deep-galleries"), False),
)

_SET_TO_CATALOG: dict[str, DomainCatalogEntry] = {}
for _dom in ARTIFACT_DOMAIN_CATALOG:
    for _slug in _dom.set_slugs:
        _SET_TO_CATALOG[_slug] = _dom


def _slugify_domain(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", (name or "unknown").lower()).strip("-") or "domain"


SUPPORT_NON_CRIT_SETS = {
    "viridescent-venerer",
    "deepwood-memories",
    "noblesse-oblige",
    "tenacity-of-the-millelith",
    "scroll-of-the-hero-of-cinder-city",
    "ocean-hued-clam",
    "song-of-days-past",
    "maiden-beloved",
    "archaic-petra",
    "flower-of-paradise-lost",
}


def _evaluate_equipped_artifact_status(
    equipped: Optional[dict[str, Any]],
    build: CharArtifactBuildLite,
) -> tuple[Optional[str], float, Optional[float], Optional[str]]:
    """Retorna (status, weight_mult, crit_value, note) com base nos artefatos reais do GOOD."""
    if not equipped:
        return None, 1.0, None, None

    pieces = int(equipped.get("pieces_count") or 0)
    avg_lv = float(equipped.get("avg_level") or 0.0)
    cv = round(float(equipped.get("crit_value") or 0.0), 1)
    active_4pc = equipped.get("active_4pc_slug") or None
    active_2pc = set(equipped.get("active_2pc_slugs") or [])

    if pieces == 0:
        return "needs_farm", 1.25, 0.0, "Sem artefatos"

    rec_4pc = list(build.artifacts_4pc[:3])
    bis_set = rec_4pc[0] if rec_4pc else None
    is_support_set = bool(
        (active_4pc and active_4pc in SUPPORT_NON_CRIT_SETS)
        or (bis_set and bis_set in SUPPORT_NON_CRIT_SETS)
    )
    cv_built_threshold = 90.0 if is_support_set else 155.0

    # Verifica se está usando um set 4pc recomendado
    if active_4pc and active_4pc in rec_4pc:
        is_bis = active_4pc == bis_set
        if pieces >= 5 and avg_lv >= 18.0 and (is_support_set or cv >= cv_built_threshold):
            note = f"4pc {'BiS' if is_bis else 'OK'} · {round(cv)} CV"
            return "built", (0.20 if is_bis else 0.35), cv, note
        note = f"4pc · {round(cv)} CV" if avg_lv >= 16.0 else f"4pc (+{round(avg_lv)})"
        return "partial", 0.70, cv, note

    # Verifica 2pc+2pc recomendado quando não tem 4pc BiS
    if build.artifacts_2pc and len(active_2pc) >= 2:
        matched_2pc = any(
            (s1 in active_2pc and (not s2 or s2 in active_2pc))
            for s1, s2 in build.artifacts_2pc
            if s1
        )
        if matched_2pc and pieces >= 5 and avg_lv >= 18.0 and cv >= cv_built_threshold:
            return "built", 0.35, cv, f"2+2pc · {round(cv)} CV"
        if matched_2pc:
            return "partial", 0.75, cv, f"2+2pc · {round(cv)} CV"

    # Sem set recomendado -> alta prioridade para farmar!
    if pieces < 5:
        return "needs_farm", 1.25, cv, f"{pieces}/5 peças"
    if active_4pc:
        return "needs_farm", 1.18, cv, f"Outro set · {round(cv)} CV"
    return "needs_farm", 1.22, cv, f"Sem set · {round(cv)} CV"


def compute_artifact_recommendations(
    characters: list[CharacterLite],
    artifact_sets: list[ArtifactSetLite],
    char_builds: dict[str, CharArtifactBuildLite],
    general_tiers: dict[str, TierSummaryLite],
    abyss_tiers: dict[str, TierSummaryLite],
    stygian_tiers: dict[str, TierSummaryLite],
    owned_slugs: list[str],
    planner_slugs: list[str] = (),
    equipped_artifacts: Optional[list[dict[str, Any]]] = None,
    focus: str = "all",
    limit: int = 20,
) -> dict[str, Any]:
    """Calcula eficiência de resina por Domínio de Artefatos e prioridades de Strongbox."""
    chars_by_slug = {c.slug: c for c in characters}
    sets_by_slug = {a.slug: a for a in artifact_sets if a.rarity_max >= 5}

    owned_set = {s for s in owned_slugs if s in chars_by_slug}
    planner_set = {s for s in planner_slugs if s in chars_by_slug}
    equipped_by_slug: dict[str, dict[str, Any]] = {}
    for ea in (equipped_artifacts or []):
        slug = ea.get("slug")
        if slug:
            equipped_by_slug[slug] = ea

    # Seleciona pool de personagens avaliados conforme o foco escolhido
    if focus == "planner":
        eval_slugs = sorted(planner_set)
    elif focus == "top_meta":
        eval_slugs = [
            s for s in sorted(owned_set)
            if (
                (general_tiers.get(s) and general_tiers[s].consensus_tier in ("S+", "S", "A"))
                or (stygian_tiers.get(s) and stygian_tiers[s].consensus_tier in ("S+", "S"))
                or (abyss_tiers.get(s) and abyss_tiers[s].consensus_tier in ("S+", "S"))
            )
        ]
        if not eval_slugs:
            eval_slugs = sorted(owned_set)
    else:
        eval_slugs = sorted(owned_set | planner_set)

    # Acumula demanda ponderada por set de artefato
    # set_slug -> { "score": float, "bis_count": int, "users": dict[char_slug, dict] }
    set_demand: dict[str, dict[str, Any]] = {}

    def _add_vote(
        set_slug: str,
        char: CharacterLite,
        weight: float,
        is_bis: bool,
        usage_label: str,
        tier_label: Optional[str],
        in_planner: bool,
        artifact_status: Optional[str],
        crit_value: Optional[float],
        equipped_note: Optional[str],
    ) -> None:
        if set_slug not in sets_by_slug:
            return
        bucket = set_demand.setdefault(
            set_slug,
            {"score": 0.0, "bis_count": 0, "users": {}},
        )
        prev_u = bucket["users"].get(char.slug)
        if prev_u:
            # Mantém o maior peso/prioridade para o mesmo personagem neste set
            if weight > prev_u["_weight"]:
                bucket["score"] += weight - prev_u["_weight"]
                if is_bis and not prev_u["is_bis"]:
                    bucket["bis_count"] += 1
                prev_u["_weight"] = weight
                prev_u["is_bis"] = prev_u["is_bis"] or is_bis
                prev_u["usage_label"] = usage_label
            return

        bucket["score"] += weight
        if is_bis:
            bucket["bis_count"] += 1
        bucket["users"][char.slug] = {
            "slug": char.slug,
            "name": char.name,
            "icon": char.icon,
            "element": char.element,
            "rarity": char.rarity,
            "tier": tier_label,
            "is_bis": is_bis,
            "is_in_planner": in_planner,
            "usage_label": usage_label,
            "artifact_status": artifact_status,
            "crit_value": crit_value,
            "equipped_note": equipped_note,
            "_weight": weight,
        }

    evaluated_count = 0
    planner_matched = 0
    audited_count = 0
    already_built_count = 0

    for c_slug in eval_slugs:
        build = char_builds.get(c_slug)
        if not build or (not build.artifacts_4pc and not build.artifacts_2pc):
            continue
        evaluated_count += 1
        in_planner = c_slug in planner_set
        if in_planner:
            planner_matched += 1

        eq = equipped_by_slug.get(c_slug)
        art_status, eq_mult, eq_cv, eq_note = _evaluate_equipped_artifact_status(eq, build)
        if art_status is not None:
            audited_count += 1
            if art_status == "built":
                already_built_count += 1

        char = chars_by_slug[c_slug]
        gen = general_tiers.get(c_slug)
        meta_val = (gen.avg_score * 100.0) if gen else 50.0
        eg_vals = [
            v for v in (
                _effective_mode_score(abyss_tiers.get(c_slug)),
                _effective_mode_score(stygian_tiers.get(c_slug)),
            )
            if v is not None
        ]
        eg_val = max(eg_vals) if eg_vals else meta_val
        strength = max(meta_val, eg_val) / 100.0

        # Peso base do personagem (S+ ≈ 1.0, A ≈ 0.85, C ≈ 0.70) + bônus se está no Planejador
        # Multiplicado pelo estado real dos artefatos do GOOD (built = 0.20x, needs_farm = 1.22x)
        char_weight = (0.55 + 0.45 * strength)
        if in_planner and focus == "all":
            char_weight += 0.25
        char_weight *= eq_mult

        tier_label = gen.consensus_tier if gen else None

        # 4pc ranqueado (BiS = 1.0, 2ª opção = 0.55, 3ª opção = 0.30)
        slot_weights = (1.0, 0.55, 0.30)
        for idx, art_slug in enumerate(build.artifacts_4pc[:3]):
            w = char_weight * slot_weights[idx]
            label = "4pc BiS" if idx == 0 else "4pc Alt"
            _add_vote(art_slug, char, w, idx == 0, label, tier_label, in_planner, art_status, eq_cv, eq_note)

        # 2pc+2pc (opção flexível)
        for s1, s2 in build.artifacts_2pc[:3]:
            for s in (s1, s2):
                if s:
                    _add_vote(s, char, char_weight * 0.32, False, "2pc+2pc", tier_label, in_planner, art_status, eq_cv, eq_note)

    # Agrupa todos os sets 5★ relevantes em Domínios (curados + dinâmicos por `source`)
    domains_map: dict[str, dict[str, Any]] = {}

    # 1) Primeiro inclui domínios curados que tenham ao menos 1 set com demanda
    for dom in ARTIFACT_DOMAIN_CATALOG:
        present_slugs = [s for s in dom.set_slugs if s in sets_by_slug]
        if not present_slugs:
            continue
        if not any(s in set_demand for s in present_slugs):
            continue
        domains_map[dom.domain_id] = {
            "domain_id": dom.domain_id,
            "domain_name": dom.name_pt,
            "region": dom.region,
            "is_boss_only": dom.is_boss_only,
            "in_strongbox": dom.in_strongbox,
            "set_slugs": list(present_slugs),
        }

    # 2) Sets 5★ com demanda que não estão no catálogo curado (ex.: sets 6.x / 7.x!)
    # Agrupa dinamicamente por `source` (nome do domínio no DB)
    source_to_all_sets: dict[str, list[str]] = {}
    for s_slug, art in sets_by_slug.items():
        if s_slug in _SET_TO_CATALOG:
            continue
        src = (art.source or "").strip()
        if src:
            source_to_all_sets.setdefault(src, []).append(s_slug)

    for s_slug in set_demand.keys():
        if s_slug in _SET_TO_CATALOG:
            continue
        art = sets_by_slug[s_slug]
        src = (art.source or "").strip()
        if src:
            dom_id = f"src-{_slugify_domain(src)}"
            if dom_id not in domains_map:
                pair_slugs = sorted(source_to_all_sets.get(src, [s_slug]))
                domains_map[dom_id] = {
                    "domain_id": dom_id,
                    "domain_name": src,
                    "region": "Novo Meta",
                    "is_boss_only": "boss" in src.lower() or "chefe" in src.lower(),
                    "in_strongbox": False,
                    "set_slugs": pair_slugs,
                }
        else:
            dom_id = f"set-{s_slug}"
            if dom_id not in domains_map:
                domains_map[dom_id] = {
                    "domain_id": dom_id,
                    "domain_name": art.name,
                    "region": "Domínio",
                    "is_boss_only": False,
                    "in_strongbox": False,
                    "set_slugs": [s_slug],
                }

    # Avalia e pontua cada domínio
    domain_recs: list[dict[str, Any]] = []
    strongbox_candidates: list[dict[str, Any]] = []

    raw_domain_scores: list[tuple[dict[str, Any], float]] = []

    for dom in domains_map.values():
        set_entries: list[dict[str, Any]] = []
        unique_chars: set[str] = set()
        bis_chars: set[str] = set()
        usable_sets = 0
        total_demand = 0.0

        for s_slug in dom["set_slugs"]:
            art = sets_by_slug[s_slug]
            dem = set_demand.get(s_slug)
            users_raw = list(dem["users"].values()) if dem else []
            users_raw.sort(key=lambda u: (1 if u["is_bis"] else 0, u["_weight"]), reverse=True)
            users_clean = [{k: v for k, v in u.items() if k != "_weight"} for u in users_raw]

            s_score = round(dem["score"], 2) if dem else 0.0
            s_bis = dem["bis_count"] if dem else 0
            if users_clean:
                usable_sets += 1
                total_demand += s_score
                for u in users_clean:
                    unique_chars.add(u["slug"])
                    if u["is_bis"]:
                        bis_chars.add(u["slug"])

            set_entries.append({
                "slug": art.slug,
                "name": art.name,
                "icon": art.icon,
                "in_strongbox": dom["in_strongbox"],
                "demand_score": s_score,
                "bis_count": s_bis,
                "total_users": len(users_clean),
                "users": users_clean,
            })

        set_entries.sort(key=lambda x: (x["demand_score"], x["bis_count"]), reverse=True)

        total_sets_in_domain = max(1, len(dom["set_slugs"]))
        # Eficiência de resina:
        # - Se 2/2 sets servem à conta -> 80–100% (proporcional ao equilíbrio entre os 2 sets)
        # - Se 1/2 sets serve à conta -> 45–55% (metade dos drops vira reciclagem pro Strongbox)
        if dom["is_boss_only"]:
            efficiency_pct = 35
        elif total_sets_in_domain >= 2 and usable_sets >= 2:
            s1_d = set_entries[0]["demand_score"]
            s2_d = set_entries[1]["demand_score"]
            balance = min(s1_d, s2_d) / max(s1_d, s2_d, 0.01)
            efficiency_pct = int(round(76 + 24 * balance))
        elif total_sets_in_domain == 1 and usable_sets == 1:
            efficiency_pct = 85
        else:
            efficiency_pct = 50

        # Estratégia recomendada
        if dom["is_boss_only"]:
            strategy = "situational"
            strategy_label = "Chefes / Strongbox"
        elif usable_sets >= 2 or not dom["in_strongbox"]:
            strategy = "farm_domain"
            strategy_label = "Farmar Domínio"
        elif dom["in_strongbox"] and usable_sets == 1:
            strategy = "strongbox"
            strategy_label = "Usar Strongbox"
        else:
            strategy = "situational"
            strategy_label = "Situacional"

        # Pontuação bruta para ordenação:
        # Domínios onde AMBOS os sets servem (ou sets novos fora do Strongbox) ganham multiplicador forte!
        dual_mult = 1.30 if (usable_sets >= 2 and not dom["is_boss_only"]) else 1.0
        non_strongbox_mult = 1.18 if (not dom["in_strongbox"] and not dom["is_boss_only"]) else 1.0
        boss_penalty = 0.55 if dom["is_boss_only"] else 1.0

        raw_score = (
            total_demand * 14.0 + len(bis_chars) * 8.0
        ) * dual_mult * non_strongbox_mult * boss_penalty

        # Razões explicáveis
        reasons: list[str] = []
        if dom["is_boss_only"]:
            reasons.append("Dropa de chefes semanais/normais — não gaste resina em domínio, use peças extras no Strongbox")
        elif usable_sets >= 2:
            reasons.append(
                f"Alta eficiência ({efficiency_pct}%): ambos os sets servem para {len(unique_chars)} personagem(ns) da sua conta"
            )
        elif not dom["in_strongbox"]:
            reasons.append("Set recente fora do Strongbox — só pode ser obtido farmando este domínio")
        else:
            unused = next((s["name"] for s in set_entries if s["total_users"] == 0), None)
            reasons.append(
                f"Apenas 1 dos 2 sets serve à sua conta"
                + (f" ({unused} ficaria sobrando)" if unused else "")
                + " — prefira farmar um domínio duplo e reciclar no Strongbox"
            )

        if bis_chars:
            reasons.append(f"Set BiS (principal) para {len(bis_chars)} personagem(ns) avaliado(s)")

        rec_obj = {
            "domain_id": dom["domain_id"],
            "domain_name": dom["domain_name"],
            "region": dom["region"],
            "is_boss_only": dom["is_boss_only"],
            "score": 0.0,
            "efficiency_pct": efficiency_pct,
            "strategy": strategy,
            "strategy_label": strategy_label,
            "usable_sets_count": usable_sets,
            "unique_characters_count": len(unique_chars),
            "bis_characters_count": len(bis_chars),
            "sets": set_entries,
            "reasons": reasons,
        }
        raw_domain_scores.append((rec_obj, raw_score))

        # Popula candidatos ao Strongbox (sets disponíveis no Strongbox com demanda real)
        if dom["in_strongbox"]:
            for se in set_entries:
                if se["total_users"] <= 0:
                    continue
                # Sets de domínios ineficientes (1/2) ou boss-only têm prioridade máxima no Strongbox!
                sb_mult = 1.35 if (usable_sets == 1 or dom["is_boss_only"]) else 0.90
                sb_score = round((se["demand_score"] * 18.0 + se["bis_count"] * 10.0) * sb_mult, 1)
                why = (
                    f"Evita desperdiçar 50% da resina em {dom['domain_name']} (só este set serve à sua conta)"
                    if (usable_sets == 1 and not dom["is_boss_only"])
                    else (
                        "Peças extras de chefes — ótimo alvo secundário no Strongbox"
                        if dom["is_boss_only"]
                        else f"Disponível no Strongbox — acelera {se['total_users']} personagem(ns) enquanto você farma outro domínio"
                    )
                )
                strongbox_candidates.append({
                    "slug": se["slug"],
                    "name": se["name"],
                    "icon": se["icon"],
                    "domain_name": dom["domain_name"],
                    "score": min(100.0, sb_score),
                    "bis_count": se["bis_count"],
                    "total_users": se["total_users"],
                    "why": why,
                    "users": se["users"][:8],
                })

    # Normaliza scores de domínio para 0–100 de forma intuitiva
    max_raw = max((r for _, r in raw_domain_scores), default=1.0) or 1.0
    for rec_obj, raw_score in raw_domain_scores:
        # Combina escala absoluta + relativa para não inflar conta com 1 personagem só
        rel = (raw_score / max_raw) * 100.0
        abs_cap = min(100.0, raw_score * 1.15)
        rec_obj["score"] = round(min(100.0, 0.55 * rel + 0.45 * abs_cap), 1)
        domain_recs.append(rec_obj)

    # Ordena: Farmar Domínio > Strongbox > Situacional quando empata, mas sempre priorizando score
    domain_recs.sort(
        key=lambda d: (
            d["score"],
            1 if d["strategy"] == "farm_domain" else 0,
            d["bis_characters_count"],
            d["unique_characters_count"],
        ),
        reverse=True,
    )

    strongbox_candidates.sort(
        key=lambda s: (s["score"], s["bis_count"], s["total_users"]),
        reverse=True,
    )

    best_farm_domain = next(
        (d["domain_name"] for d in domain_recs if d["strategy"] == "farm_domain"),
        domain_recs[0]["domain_name"] if domain_recs else None,
    )
    best_strongbox = strongbox_candidates[0]["name"] if strongbox_candidates else None

    return {
        "focus": focus,
        "summary": {
            "evaluated_characters": evaluated_count,
            "domains_matched": len(domain_recs),
            "best_domain_name": best_farm_domain,
            "best_strongbox_name": best_strongbox,
            "planner_characters_matched": planner_matched,
            "audited_characters": audited_count,
            "already_built_characters": already_built_count,
        },
        "domains": domain_recs[:limit],
        "strongbox_targets": strongbox_candidates[:8],
    }


def build_artifact_advisor_response(
    db: Session,
    lang: Language,
    owned_slugs: list[str],
    planner_slugs: list[str] = (),
    equipped_artifacts: Optional[list[dict[str, Any]]] = None,
    focus: str = "all",
    limit: int = 20,
) -> dict[str, Any]:
    """Carrega personagens, sets de artefatos, presets de build e tierlists do DB."""
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

    art_trans_by_id: dict[int, str] = {}
    if lang != Language.EN:
        for at in db.query(ArtifactSetTranslation).filter(ArtifactSetTranslation.language == lang).all():
            art_trans_by_id[at.artifact_set_id] = at.name

    artifact_sets: list[ArtifactSetLite] = []
    for a in db.query(ArtifactSet).all():
        artifact_sets.append(
            ArtifactSetLite(
                slug=a.slug,
                name=art_trans_by_id.get(a.id) or a.name,
                icon=a.icon,
                rarity_max=a.rarity_max,
                source=a.source,
            )
        )

    presets_by_id = pick_best_presets_batch(db, list(id_to_slug.keys()))
    char_builds: dict[str, CharArtifactBuildLite] = {}
    for cid, preset in presets_by_id.items():
        slug = id_to_slug.get(cid)
        if not slug or not isinstance(preset.build_data, dict):
            continue
        bd = preset.build_data
        four_pc = tuple(
            a["artifact_set_slug"]
            for a in (bd.get("artifacts_4pc") or [])
            if isinstance(a, dict) and a.get("artifact_set_slug")
        )
        two_pc = tuple(
            (p.get("set1_slug") or "", p.get("set2_slug") or "")
            for p in (bd.get("artifacts_2pc") or [])
            if isinstance(p, dict) and (p.get("set1_slug") or p.get("set2_slug"))
        )
        if four_pc or two_pc:
            char_builds[slug] = CharArtifactBuildLite(
                artifacts_4pc=four_pc,
                artifacts_2pc=two_pc,
            )

    general_tiers = _fetch_category_tiers(db, "general")
    abyss_tiers = _fetch_category_tiers(db, "abyss")
    stygian_tiers = _fetch_category_tiers(db, "stygian")

    return compute_artifact_recommendations(
        characters=characters,
        artifact_sets=artifact_sets,
        char_builds=char_builds,
        general_tiers=general_tiers,
        abyss_tiers=abyss_tiers,
        stygian_tiers=stygian_tiers,
        owned_slugs=owned_slugs,
        planner_slugs=planner_slugs,
        equipped_artifacts=equipped_artifacts,
        focus=focus,
        limit=limit,
    )
