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
