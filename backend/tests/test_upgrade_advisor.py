"""Testes unitários do Upgrade Advisor ("Quem upar até Lv.90 & Talentos?")."""
from app.services.pull_advisor import CharacterLite, TemplateLite, TierSummaryLite
from app.services.upgrade_advisor import (
    BuildHintLite,
    CharProgressLite,
    classify_level_target,
    compute_upgrade_recommendations,
    parse_talent_targets,
)


def _sample_chars() -> list[CharacterLite]:
    return [
        CharacterLite("furina", "Furina", None, 5, "hydro", "sword"),
        CharacterLite("neuvillette", "Neuvillette", None, 5, "hydro", "catalyst"),
        CharacterLite("kaedehara-kazuha", "Kazuha", None, 5, "anemo", "sword"),
        CharacterLite("xilonen", "Xilonen", None, 5, "geo", "sword"),
        CharacterLite("bennett", "Bennett", None, 4, "pyro", "sword"),
        CharacterLite("arlecchino", "Arlecchino", None, 5, "pyro", "polearm"),
        CharacterLite("amber", "Amber", None, 4, "pyro", "bow"),
    ]


def _sample_templates() -> list[TemplateLite]:
    return [
        TemplateLite(1, "Neuvillette Hypercarry", "hypercarry", ("neuvillette", "furina", "kaedehara-kazuha", "xilonen"), "kqm", 4),
        TemplateLite(2, "Arlecchino Vape", "vaporize", ("arlecchino", "furina", "bennett", "xilonen"), "kqm", 3),
    ]


def _sample_tiers() -> dict[str, TierSummaryLite]:
    return {
        "furina": TierSummaryLite("S+", 0.98, 7, "sub_dps"),
        "neuvillette": TierSummaryLite("S+", 0.97, 7, "main_dps"),
        "kaedehara-kazuha": TierSummaryLite("S", 0.90, 7, "support"),
        "xilonen": TierSummaryLite("S+", 0.96, 7, "support"),
        "bennett": TierSummaryLite("S+", 0.95, 7, "support"),
        "arlecchino": TierSummaryLite("S+", 0.94, 7, "main_dps"),
        "amber": TierSummaryLite("D", 0.15, 5, "sub_dps"),
    }


def test_classify_level_target_rules():
    rec, label, needs_90, _ = classify_level_target("furina", "hydro")
    assert rec == 90 and needs_90 is True and label == "Lv. 90"

    rec, _, needs_90, _ = classify_level_target("xilonen", "geo")
    assert rec == 90 and needs_90 is True

    rec, _, needs_90, _ = classify_level_target("bennett", "pyro")
    assert rec == 90 and needs_90 is True

    rec, _, needs_90, _ = classify_level_target("kaedehara-kazuha", "anemo")
    assert rec == 90 and needs_90 is True

    # ATK scaler puro -> 80/90 (A6)
    rec, label, needs_90, _ = classify_level_target("arlecchino", "pyro")
    assert rec == 80 and needs_90 is False and "80/90" in label


def test_parse_talent_targets_from_guide_string():
    targets = parse_talent_targets(
        talent_priority_text="Skill = Burst > Normal (optional)",
        role="sub_dps",
        tier="S+",
        caps=["off_field_dps", "buffer"],
        current_na=1,
        current_es=6,
        current_eb=9,
    )
    by_key = {t["key"]: t for t in targets}
    assert by_key["es"]["recommended"] == 9
    assert by_key["es"]["needs_upgrade"] is True
    assert by_key["eb"]["recommended"] == 9
    assert by_key["eb"]["needs_upgrade"] is False
    assert by_key["na"]["recommended"] == 1
    assert by_key["na"]["needs_upgrade"] is False


def test_upgrade_advisor_prioritizes_unbuilt_meta_and_hides_already_built():
    chars = _sample_chars()
    templates = _sample_templates()
    tiers = _sample_tiers()
    hints = {
        "furina": BuildHintLite("Skill > Burst", ("hp_pct",), ("hp_pct",), ("crit_rate",)),
        "neuvillette": BuildHintLite("Normal Attack > Burst > Skill", ("hp_pct",), ("hydro_dmg",), ("crit_dmg",)),
        "xilonen": BuildHintLite("Skill > Burst", ("def_pct",), ("def_pct",), ("healing_bonus",)),
        "arlecchino": BuildHintLite("Normal Attack > Skill > Burst", ("atk_pct",), ("pyro_dmg",), ("crit_rate",)),
    }

    progress = [
        # Neuvillette já totalmente pronto (Lv.90, 9/8/9)
        CharProgressLite("neuvillette", level=90, cons=0, na=9, es=8, eb=9),
        # Furina Lv.70 com talentos 1/5/6 -> prioridade máxima!
        CharProgressLite("furina", level=70, cons=0, na=1, es=5, eb=6),
        # Xilonen Lv.60 com talentos 1/4/2 -> prioridade altíssima!
        CharProgressLite("xilonen", level=60, cons=0, na=1, es=4, eb=2),
        # Arlecchino Lv.80 com NA 8 -> falta só 1 nível de talento
        CharProgressLite("arlecchino", level=80, cons=0, na=8, es=8, eb=6),
        # Amber Lv.20 -> meta muito baixo
        CharProgressLite("amber", level=20, cons=2, na=1, es=1, eb=1),
    ]

    res = compute_upgrade_recommendations(
        characters=chars,
        templates=templates,
        general_tiers=tiers,
        abyss_tiers={},
        stygian_tiers={},
        build_hints=hints,
        owned_slugs=["neuvillette", "furina", "kaedehara-kazuha", "xilonen", "bennett", "arlecchino", "amber"],
        progress_list=progress,
        goal="overall",
        stage_filter="needs_work",
    )

    slugs = [r["slug"] for r in res["recommendations"]]
    # Neuvillette já buildado não aparece em needs_work
    assert "neuvillette" not in slugs
    assert res["summary"]["built_count"] == 1
    # Furina e Xilonen aparecem acima da Amber
    assert slugs.index("furina") < slugs.index("amber")
    assert slugs.index("xilonen") < slugs.index("amber")

    # Filtro "built" retorna apenas Neuvillette
    res_built = compute_upgrade_recommendations(
        characters=chars,
        templates=templates,
        general_tiers=tiers,
        abyss_tiers={},
        stygian_tiers={},
        build_hints=hints,
        owned_slugs=["neuvillette", "furina", "xilonen"],
        progress_list=progress,
        stage_filter="built",
    )
    assert [r["slug"] for r in res_built["recommendations"]] == ["neuvillette"]
    assert res_built["recommendations"][0]["verdict"] == "already_built"


def test_upgrade_advisor_works_without_good_progress_data():
    """Mesmo sem GOOD JSON importado, funciona usando apenas owned_slugs."""
    res = compute_upgrade_recommendations(
        characters=_sample_chars(),
        templates=_sample_templates(),
        general_tiers=_sample_tiers(),
        abyss_tiers={},
        stygian_tiers={},
        build_hints={},
        owned_slugs=["furina", "bennett", "amber"],
        progress_list=[],
        stage_filter="needs_work",
    )
    assert res["summary"]["owned_count"] == 3
    assert res["summary"]["with_progress_count"] == 0
    assert len(res["recommendations"]) == 3
    assert res["recommendations"][0]["slug"] in ("furina", "bennett")
    assert res["recommendations"][-1]["slug"] == "amber"


def test_stellar_reaction_chars_require_level_90_and_outrank_low_tier_high_template_chars():
    """Viajante Cryo (Geral S, Stygian S+, Lv.90 com talentos 1/1/4) e Alyosha
    (Geral S, Abismo A, Stygian S+, Lv.20) devem ficar bem acima de personagens
    B/C antigos mesmo quando estes têm dezenas de templates cadastrados.
    """
    rec_tc, label_tc, needs_90_tc, tag_tc = classify_level_target("traveler-cryo", "cryo")
    assert rec_tc == 90 and needs_90_tc is True and label_tc == "Lv. 90"
    assert "Estelares" in tag_tc

    rec_al, _, needs_90_al, _ = classify_level_target("alyosha", "electro")
    assert rec_al == 90 and needs_90_al is True

    chars = [
        CharacterLite("traveler-cryo", "Viajante (Cryo)", None, 5, "cryo", "sword"),
        CharacterLite("alyosha", "Alyosha", None, 4, "electro", "polearm"),
        CharacterLite("escoffier", "Escoffier", None, 5, "cryo", "polearm"),
        CharacterLite("sucrose", "Sucrose", None, 4, "anemo", "catalyst"),
        CharacterLite("beidou", "Beidou", None, 4, "electro", "claymore"),
        CharacterLite("lan-yan", "Lan Yan", None, 4, "anemo", "catalyst"),
        CharacterLite("fischl", "Fischl", None, 4, "electro", "bow"),
        CharacterLite("xingqiu", "Xingqiu", None, 4, "hydro", "sword"),
    ]

    # Viajante Cryo e Alyosha têm poucos templates novos (meta Estelar),
    # enquanto Beidou e Lan Yan aparecem em muitos templates antigos.
    templates = [
        TemplateLite(1, "Escoffier Stellar", "stellar_conduct", ("escoffier", "traveler-cryo", "alyosha", "sucrose"), "kqm", 2),
        TemplateLite(2, "Cryo Traveler Stellar", "stellar_conduct", ("traveler-cryo", "alyosha", "fischl", "sucrose"), "kqm", 1),
        TemplateLite(3, "Cryo Traveler Freeze", "freeze", ("traveler-cryo", "escoffier", "xingqiu", "sucrose"), "kqm", 1),
    ]
    for i in range(10, 26):
        arch = ["taser", "overload", "aggravate", "hyperbloom", "soup"][i % 5]
        templates.append(
            TemplateLite(i, f"Legacy Team {i}", arch, ("beidou", "lan-yan", "fischl", "xingqiu"), "kqm", 2)
        )

    general_tiers = {
        "traveler-cryo": TierSummaryLite("S", 0.80, 7, "main_dps"),
        "alyosha": TierSummaryLite("S", 0.74, 7, "support"),
        "escoffier": TierSummaryLite("S+", 0.95, 7, "support"),
        "sucrose": TierSummaryLite("A", 0.65, 7, "support"),
        "beidou": TierSummaryLite("C", 0.40, 7, "sub_dps"),
        "lan-yan": TierSummaryLite("B", 0.42, 7, "support"),
        "fischl": TierSummaryLite("S", 0.80, 7, "sub_dps"),
        "xingqiu": TierSummaryLite("S", 0.82, 7, "sub_dps"),
    }
    abyss_tiers = {
        "alyosha": TierSummaryLite("A", 0.55, 1, "support"),
        "beidou": TierSummaryLite("C", 0.18, 1, "sub_dps"),
        "lan-yan": TierSummaryLite("C", 0.0, 1, "support"),
    }
    stygian_tiers = {
        "traveler-cryo": TierSummaryLite("S+", 0.71, 4, "main_dps"),
        "alyosha": TierSummaryLite("S+", 0.59, 4, "support"),
        "beidou": TierSummaryLite("A", 0.18, 4, "sub_dps"),
        "lan-yan": TierSummaryLite("C", 0.0, 4, "support"),
    }

    progress = [
        CharProgressLite("traveler-cryo", level=90, cons=5, na=1, es=1, eb=4),
        CharProgressLite("alyosha", level=20, cons=0, na=1, es=1, eb=1),
        CharProgressLite("beidou", level=70, cons=6, na=1, es=1, eb=1),
        CharProgressLite("lan-yan", level=70, cons=2, na=1, es=1, eb=1),
        CharProgressLite("escoffier", level=90, cons=0, na=9, es=9, eb=9),
        CharProgressLite("sucrose", level=90, cons=6, na=1, es=9, eb=9),
        CharProgressLite("fischl", level=90, cons=6, na=1, es=9, eb=9),
        CharProgressLite("xingqiu", level=90, cons=6, na=1, es=9, eb=9),
    ]

    res = compute_upgrade_recommendations(
        characters=chars,
        templates=templates,
        general_tiers=general_tiers,
        abyss_tiers=abyss_tiers,
        stygian_tiers=stygian_tiers,
        build_hints={},
        owned_slugs=[c.slug for c in chars],
        progress_list=progress,
        goal="overall",
        stage_filter="needs_work",
    )

    by_slug = {r["slug"]: r for r in res["recommendations"]}
    order = [r["slug"] for r in res["recommendations"]]

    # Viajante Cryo e Alyosha devem ficar no topo (Upar Agora) e bem acima de Lan Yan e Beidou
    assert order.index("traveler-cryo") < order.index("lan-yan")
    assert order.index("traveler-cryo") < order.index("beidou")
    assert order.index("alyosha") < order.index("lan-yan")
    assert order.index("alyosha") < order.index("beidou")
    assert by_slug["traveler-cryo"]["score"] >= 72
    assert by_slug["traveler-cryo"]["verdict"] == "priority_now"
    assert by_slug["traveler-cryo"]["breakdown"]["upgrade_gain"] >= 70
    assert by_slug["traveler-cryo"]["breakdown"]["endgame_seasonal"] >= 85

