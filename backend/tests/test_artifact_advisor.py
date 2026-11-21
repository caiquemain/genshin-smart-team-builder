"""Unit tests for the Artifact Domain & Strongbox Advisor."""
from app.services.artifact_advisor import (
    ArtifactSetLite,
    CharArtifactBuildLite,
    compute_artifact_recommendations,
)
from app.services.pull_advisor import CharacterLite, TierSummaryLite


def _char(slug: str, name: str, element: str = "hydro", rarity: int = 5) -> CharacterLite:
    return CharacterLite(
        slug=slug,
        name=name,
        icon=f"UI_AvatarIcon_{slug}",
        rarity=rarity,
        element=element,
        weapon_type="sword",
    )


def _art(slug: str, name: str, source: str | None = None, rarity_max: int = 5) -> ArtifactSetLite:
    return ArtifactSetLite(
        slug=slug,
        name=name,
        icon=f"UI_RelicIcon_{slug}",
        rarity_max=rarity_max,
        source=source,
    )


def _tier(label: str, avg: float) -> TierSummaryLite:
    return TierSummaryLite(consensus_tier=label, avg_score=avg, site_count=3)


def test_dual_set_domain_outranks_single_set_and_recommends_farm_domain():
    chars = [
        _char("neuvillette", "Neuvillette", "hydro"),
        _char("furina", "Furina", "hydro"),
        _char("kazuha", "Kaedehara Kazuha", "anemo"),
    ]
    arts = [
        _art("marechaussee-hunter", "Caçador das Sombras"),
        _art("golden-troupe", "Trupe Dourada"),
        _art("viridescent-venerer", "Sombra Verde"),
        _art("maiden-beloved", "Donzela Amada"),
    ]
    builds = {
        "neuvillette": CharArtifactBuildLite(artifacts_4pc=("marechaussee-hunter",)),
        "furina": CharArtifactBuildLite(artifacts_4pc=("golden-troupe",)),
        "kazuha": CharArtifactBuildLite(artifacts_4pc=("viridescent-venerer",)),
    }
    tiers = {
        "neuvillette": _tier("S+", 1.0),
        "furina": _tier("S+", 1.0),
        "kazuha": _tier("S", 0.9),
    }

    res = compute_artifact_recommendations(
        characters=chars,
        artifact_sets=arts,
        char_builds=builds,
        general_tiers=tiers,
        abyss_tiers=tiers,
        stygian_tiers=tiers,
        owned_slugs=["neuvillette", "furina", "kazuha"],
    )

    assert res["summary"]["evaluated_characters"] == 3
    assert res["summary"]["domains_matched"] == 2

    top = res["domains"][0]
    assert top["domain_id"] == "denouement-of-sin"
    assert top["strategy"] == "farm_domain"
    assert top["usable_sets_count"] == 2
    assert top["efficiency_pct"] >= 90

    vv_dom = next(d for d in res["domains"] if d["domain_id"] == "valley-of-remembrance")
    assert vv_dom["strategy"] == "strongbox"
    assert vv_dom["usable_sets_count"] == 1
    assert vv_dom["efficiency_pct"] == 50

    # VV deve aparecer no topo do Strongbox por evitar desperdiçar 50% da resina
    assert len(res["strongbox_targets"]) >= 1
    assert res["strongbox_targets"][0]["slug"] == "viridescent-venerer"
    assert res["summary"]["best_domain_name"] == "Desfecho do Pecado"
    assert res["summary"]["best_strongbox_name"] == "Sombra Verde"


def test_boss_only_sets_are_marked_situational_and_lower_priority():
    chars = [_char("ganyu", "Ganyu", "cryo")]
    arts = [
        _art("wanderers-troupe", "Trupe Itinerante"),
        _art("gladiators-finale", "Último Juramento do Gladiador"),
    ]
    builds = {
        "ganyu": CharArtifactBuildLite(artifacts_4pc=("wanderers-troupe",)),
    }
    tiers = {"ganyu": _tier("A", 0.78)}

    res = compute_artifact_recommendations(
        characters=chars,
        artifact_sets=arts,
        char_builds=builds,
        general_tiers=tiers,
        abyss_tiers={},
        stygian_tiers={},
        owned_slugs=["ganyu"],
    )

    assert len(res["domains"]) == 1
    dom = res["domains"][0]
    assert dom["is_boss_only"] is True
    assert dom["strategy"] == "situational"
    assert dom["strategy_label"] == "Chefes / Strongbox"
    assert dom["efficiency_pct"] == 35


def test_new_version_set_grouped_dynamically_by_source_recommends_farm_domain():
    chars = [_char("traveler-cryo", "Viajante (Cryo)", "cryo")]
    arts = [
        _art("stellar-frost-oath", "Juramento Gélido Estelar", source="Santuário de Snezhnaya"),
        _art("lunar-aurora-veil", "Véu da Aurora Lunar", source="Santuário de Snezhnaya"),
    ]
    builds = {
        "traveler-cryo": CharArtifactBuildLite(artifacts_4pc=("stellar-frost-oath",)),
    }
    tiers = {"traveler-cryo": _tier("S+", 0.98)}

    res = compute_artifact_recommendations(
        characters=chars,
        artifact_sets=arts,
        char_builds=builds,
        general_tiers=tiers,
        abyss_tiers={},
        stygian_tiers=tiers,
        owned_slugs=["traveler-cryo"],
    )

    assert len(res["domains"]) == 1
    dom = res["domains"][0]
    assert dom["domain_name"] == "Santuário de Snezhnaya"
    assert dom["strategy"] == "farm_domain"
    assert len(dom["sets"]) == 2
    assert all(not s["in_strongbox"] for s in dom["sets"])
    # Fora do Strongbox -> não aparece como alvo de Strongbox
    assert res["strongbox_targets"] == []


def test_planner_focus_restricts_to_planner_slugs():
    chars = [
        _char("neuvillette", "Neuvillette", "hydro"),
        _char("raiden", "Raiden Shogun", "electro"),
    ]
    arts = [
        _art("marechaussee-hunter", "Caçador das Sombras"),
        _art("golden-troupe", "Trupe Dourada"),
        _art("emblem-of-severed-fate", "Selo da Insulação"),
        _art("shimenawas-reminiscence", "Reminiscência Nostálgica"),
    ]
    builds = {
        "neuvillette": CharArtifactBuildLite(artifacts_4pc=("marechaussee-hunter",)),
        "raiden": CharArtifactBuildLite(artifacts_4pc=("emblem-of-severed-fate",)),
    }
    tiers = {
        "neuvillette": _tier("S+", 1.0),
        "raiden": _tier("S", 0.9),
    }

    res = compute_artifact_recommendations(
        characters=chars,
        artifact_sets=arts,
        char_builds=builds,
        general_tiers=tiers,
        abyss_tiers={},
        stygian_tiers={},
        owned_slugs=["neuvillette", "raiden"],
        planner_slugs=["raiden"],
        focus="planner",
    )

    assert res["summary"]["evaluated_characters"] == 1
    assert res["summary"]["planner_characters_matched"] == 1
    assert [d["domain_id"] for d in res["domains"]] == ["momiji-dyed-court"]

    # Foco planner sem ninguém no planejador deve retornar vazio em vez da conta inteira
    empty_res = compute_artifact_recommendations(
        characters=chars,
        artifact_sets=arts,
        char_builds=builds,
        general_tiers=tiers,
        abyss_tiers={},
        stygian_tiers={},
        owned_slugs=["neuvillette", "raiden"],
        planner_slugs=[],
        focus="planner",
    )
    assert empty_res["summary"]["evaluated_characters"] == 0
    assert empty_res["domains"] == []
