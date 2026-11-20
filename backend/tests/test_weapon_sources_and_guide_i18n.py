from app.models import Language, Weapon
from app.scripts.sync_weapon_sources import (
    infer_fallback_source,
    merge_source_maps,
    parse_paimon_moe_weapon_list,
    parse_wiki_availability_html,
    weapon_name_to_slug,
)
from app.scripts.translate_guides import (
    _protect_tokens,
    _restore_tokens,
    looks_already_in_target_lang,
    post_clean_translation,
    resolve_provider,
)
from app.services.guide_i18n import (
    apply_build_data_localization,
    apply_substitutes_localization,
    text_hash,
    translate_build_label,
    translate_talent_priority,
)


def test_parse_wiki_availability_html_all_sections():
    sample_html = """
    <h2><span class="mw-headline">Wish-Exclusive Weapons</span></h2>
    <h3><span class="mw-headline">Weapon Event-Exclusive</span></h3>
    <table>
      <tr><td>icon</td><td><a href="/wiki/Azurelight">Azurelight</a></td><td>5</td></tr>
    </table>
    <h3><span class="mw-headline">Standard and Weapon Event</span></h3>
    <table>
      <tr><td>icon</td><td><a href="/wiki/Favonius_Sword">Favonius Sword</a></td><td>4</td></tr>
    </table>
    <h2><span class="mw-headline">Flagship Event-Exclusive Weapons</span></h2>
    <table>
      <tr><td>icon</td><td><a href="/wiki/Festering_Desire">Festering Desire</a></td><td>4</td></tr>
    </table>
    <h2><span class="mw-headline">Shop Weapons</span></h2>
    <h3><span class="mw-headline">Fishing Association-Exclusive</span></h3>
    <table>
      <tr><td>icon</td><td><a href="/wiki/%22The_Catch%22">"The Catch"</a></td><td>4</td></tr>
    </table>
    <h3><span class="mw-headline">Paimon's Bargains-Exclusive</span></h3>
    <table>
      <tr><td>icon</td><td><a href="/wiki/Blackcliff_Longsword">Blackcliff Longsword</a></td><td>4</td></tr>
    </table>
    <h2><span class="mw-headline">BP Bounty Weapons</span></h2>
    <table>
      <tr><td>icon</td><td><a href="/wiki/Wolf-Fang">Wolf-Fang</a></td><td>4</td></tr>
    </table>
    <h2><span class="mw-headline">Forging Weapons</span></h2>
    <table>
      <tr><td>icon</td><td><a href="/wiki/Iron_Sting">Iron Sting</a></td><td>4</td></tr>
    </table>
    <h2><span class="mw-headline">Quest Weapons</span></h2>
    <table>
      <tr><td>icon</td><td><a href="/wiki/Kagotsurube_Isshin">Kagotsurube Isshin</a></td><td>4</td></tr>
    </table>
    <h2><span class="mw-headline">Weapons with Limited Sources</span></h2>
    <table>
      <tr><td>icon</td><td><a href="/wiki/Dark_Iron_Sword">Dark Iron Sword</a></td><td>3</td></tr>
    </table>
    """
    parsed = parse_wiki_availability_html(sample_html)
    assert parsed["azurelight"] == "gacha_limited"
    assert parsed["favonius-sword"] == "gacha"
    assert parsed["festering-desire"] == "event"
    assert parsed["the-catch"] == "fishing"
    assert parsed["blackcliff-longsword"] == "starglitter"
    assert parsed["wolf-fang"] == "battle_pass"
    assert parsed["iron-sting"] == "craftable"
    assert parsed["kagotsurube-isshin"] == "quest"
    assert parsed["dark-iron-sword"] == "world"


def test_parse_paimon_moe_and_merge_priority():
    js = """
    export const weaponList = {
      iron_sting: {
        name: 'Iron Sting',
        id: 'iron_sting',
        source: 'forging',
      },
      wolfs_gravestone: {
        name: "Wolf's Gravestone",
        id: 'wolfs_gravestone',
        source: 'wish',
      },
      serpent_spine: {
        name: 'Serpent Spine',
        id: 'serpent_spine',
        source: 'battle pass',
      },
    };
    """
    paimon = parse_paimon_moe_weapon_list(js)
    assert paimon["iron-sting"] == "craftable"
    assert paimon["wolf-s-gravestone"] == "gacha"
    assert paimon["serpent-spine"] == "battle_pass"

    merged = merge_source_maps(
        wiki_map={"wolf-s-gravestone": "gacha_limited"},
        paimon_map=paimon,
    )
    assert merged["wolf-s-gravestone"] == "gacha_limited"
    assert merged["iron-sting"] == "craftable"
    assert weapon_name_to_slug('"The Catch"') == "the-catch"


def test_infer_fallback_source():
    w1 = Weapon(slug="dull-blade", name="Dull Blade", rarity=1, weapon_type="sword", base_atk=23)
    w2 = Weapon(slug="blackcliff-pole", name="Blackcliff Pole", rarity=4, weapon_type="polearm", base_atk=42)
    w3 = Weapon(slug="future-5-star", name="Future 5 Star", rarity=5, weapon_type="sword", base_atk=48)
    assert infer_fallback_source(w1) == "world"
    assert infer_fallback_source(w2) == "starglitter"
    assert infer_fallback_source(w3) == "gacha_limited"


def test_guide_i18n_deterministic_and_cache_lookup():
    assert translate_talent_priority("Normal Attack > Skill > Burst", Language.PT) == (
        "Ataque Normal > Habilidade > Supremo"
    )
    assert translate_talent_priority("NA > Burst > Skill", Language.PT) == (
        "Ataque Normal > Supremo > Habilidade"
    )
    assert translate_talent_priority("Skill > Burst", Language.ES) == "Habilidad > Definitiva"
    assert translate_talent_priority("Skill > Burst", Language.EN) == "Skill > Burst"

    assert translate_build_label("Hydro Appliers", Language.PT) == "Aplicadores Hydro"
    assert translate_build_label("Healer", Language.PT) == "Curandeiro"
    assert translate_build_label("Off-field DPS", Language.PT) == "DPS Fora de Campo"

    note_en = "Best-in-slot signature sword for high CRIT DMG."
    sub_note_en = "Provides strong teamwide healing and Hydro application."
    tmap = {
        text_hash(note_en): "Melhor espada assinatura para alto Dano Crítico.",
        text_hash(sub_note_en): "Fornece forte cura em equipe e aplicação Hydro.",
    }
    bd = {
        "talent_priority": "Skill > Burst",
        "weapons": [{"weapon_slug": "azurelight", "notes": note_en}],
        "artifacts_4pc": [{"artifact_set_slug": "marechaussee-hunter", "notes": "Untranslated note"}],
    }
    loc_bd = apply_build_data_localization(bd, Language.PT, tmap)
    assert loc_bd["talent_priority"] == "Habilidade > Supremo"
    assert loc_bd["weapons"][0]["notes"] == "Melhor espada assinatura para alto Dano Crítico."
    assert loc_bd["artifacts_4pc"][0]["notes"] == "Untranslated note"

    subs = [{"character_slug": "kokomi", "build_label": "Healer", "notes": sub_note_en}]
    loc_subs = apply_substitutes_localization(subs, Language.PT, tmap)
    assert loc_subs[0]["build_label"] == "Curandeiro"
    assert loc_subs[0]["notes"] == "Fornece forte cura em equipe e aplicação Hydro."


def test_translate_guides_helpers_and_glossary(monkeypatch):
    assert looks_already_in_target_lang("Alternativa direta sugerida pelo guia (Healer)", "pt") is True
    assert looks_already_in_target_lang("Meta real Abismo 7.2 — uso 9.0% (posse 29.2%)", "pt") is True
    assert looks_already_in_target_lang("Alternativa Dendro (Suporte)", "pt") is True
    assert looks_already_in_target_lang("Fonte: Event (Game8)", "pt") is True
    assert looks_already_in_target_lang("8. (Helper Sheet)", "pt") is True
    assert looks_already_in_target_lang("Best-in-slot signature sword for Furina.", "pt") is False

    protected, tok_map = _protect_tokens("Great with 4pc Golden Troupe at C2 and R5 for high ER%.")
    assert "4pc" not in protected
    assert "C2" not in protected
    assert "R5" not in protected
    assert _restore_tokens(protected, tok_map) == "Great with 4pc Golden Troupe at C2 and R5 for high ER%."

    cleaned = post_clean_translation("Aumenta o dano da Explosão Elemental e Maestria Elemental fora do campo.", "pt")
    assert "Supremo" in cleaned
    assert "Proficiência Elemental" in cleaned
    assert "fora de campo" in cleaned

    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("DEEPL_API_KEY", raising=False)
    assert resolve_provider("auto") == "google"
    monkeypatch.setenv("DEEPL_API_KEY", "test:fx")
    assert resolve_provider("auto") == "deepl"
    monkeypatch.setenv("GEMINI_API_KEY", "gem-key")
    assert resolve_provider("auto") == "gemini"
