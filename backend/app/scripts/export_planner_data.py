"""
Exporta dados estáticos do Planner para JSON (consumido pelo frontend offline).
"""
import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.database import SessionLocal
from app.models.character import (
    Character,
    CharacterAscensionMaterial,
    CharacterTalentMaterial,
)
from app.models.weapon import Weapon, WeaponAscensionMaterial
from app.models.material import Material

LANGS = ('en', 'pt', 'es')


def detect_is_weekly(source: str | None) -> bool:
    if not source:
        return False
    return 'challenge reward' in source.lower()


# ─────────────────────────────────────────────────────────────────────────
# MOBS COMUNS E RAROS (3 tiers)
# Chaves = como o Seelie exporta em `inventory[].item`
# ─────────────────────────────────────────────────────────────────────────
COMMON_MOB_FAMILIES = {
    "mask":          ["damaged-mask", "stained-mask", "ominous-mask"],
    "arrowhead":     ["firm-arrowhead", "sharp-arrowhead", "weathered-arrowhead"],
    "scroll":        ["divining-scroll", "sealed-scroll", "forbidden-curse-scroll"],
    "slime":         ["slime-condensate", "slime-secretions", "slime-concentrate"],
    "whistle":       ["sentry-s-wooden-whistle", "warrior-s-metal-whistle",
                      "saurian-crowned-warrior-s-golden-whistle"],
    "nectar":        ["whopperflower-nectar", "shimmering-nectar", "energy-nectar"],
    "f_insignia":    ["recruit-s-insignia", "sergeant-s-insignia", "lieutenant-s-insignia"],
    "th_insignia":   ["treasure-hoarder-insignia", "silver-raven-insignia",
                      "golden-raven-insignia"],
    "handguard":     ["old-handguard", "kageuchi-handguard", "famed-handguard"],
    "prism_damaged": ["damaged-prism", "turbid-prism", "polarizing-prism"],
    "prism_dismal":  ["dismal-prism", "crystal-prism", "radiant-prism"],
    "spores":        ["fungal-spores", "luminescent-pollen", "crystalline-cyst-dust"],
    "spectral_husk": ["spectral-husk", "spectral-heart", "spectral-nucleus"],
    "bone_shard":    ["fragile-bone-shard", "sturdy-bone-shard", "fossilized-bone-shard"],
    "red_satin":     ["faded-red-satin", "trimmed-red-satin", "rich-red-brocade"],
    "gear":          ["meshing-gear", "mechanical-spur-gear", "artificed-dynamic-gear"],
    "transoceanic":  ["transoceanic-pearl", "transoceanic-chunk", "xenochromatic-crystal"],
    "shellshard":    ["cold-cracked-shellshard", "warm-back-shell", "marked-shell"],

    "horn":             ["heavy-horn", "black-bronze-horn", "black-crystal-horn"],
    "ley_line":         ["dead-ley-line-branch", "dead-ley-line-leaves", "ley-line-sprout"],
    "chaos":            ["chaos-device", "chaos-circuit", "chaos-core"],
    "chaos_g":          ["chaos-gear", "chaos-axis", "chaos-oculus"],
    "chaos_s":          ["chaos-storage", "chaos-module", "chaos-bolt"],
    "mist":             ["mist-grass-pollen", "mist-grass", "mist-grass-wick"],
    "sacrificial_knife":["hunter-s-sacrificial-knife", "agent-s-sacrificial-knife",
                         "inspector-s-sacrificial-knife"],
    "claw":             ["concealed-claw", "concealed-talon", "concealed-unguis"],
    "statuette":        ["gloomy-statuette", "dark-statuette", "deathly-statuette"],
    "fungal_nucleus":   ["inactivated-fungal-nucleus", "dormant-fungal-nucleus",
                         "robust-fungal-nucleus"],
    "secret_source":    ["axis-of-the-secret-source", "sheath-of-the-secret-source",
                         "heart-of-the-secret-source"],
    "hilt":             ["ruined-hilt", "splintered-hilt", "still-smoldering-hilt"],
    "fin":              ["feathery-fin", "lunar-fin", "chasmlight-fin"],
    "shell":            ["desiccated-shell", "sturdy-shell", "marked-shell"],
    "bud":              ["refractive-bud", "glowing-remains", "illusory-leafcoil"],
    "life":             ["hollow-root-of-life", "sprout-node-of-life", "coiled-core-of-life"],
    "accreted":         ["accreted-fragment", "accreted-mass", "accreted-growth"],
    "lunar_iron":       ["fractured-lunar-iron", "depleted-lunar-iron", "unblemished-lunar-iron"],
    "flaming_hilt":     ["faded-flaming-hilt", "fractured-flaming-hilt", "jeweled-flaming-hilt"],
    "deep_shadow":      ["fractured-eye-of-the-deep-shadow", "aberrant-core-of-the-deep-shadow",
                         "hooked-beak-of-the-deep-shadow"],
    "mistshroud":       ["mistshroud-manifestation", "mistshroud-plate", "mistshroud-helmet"],
    "frostnight":       ["frostnight-s-glimmer", "frostnight-s-glow", "frostnight-s-glory"],
    "ignited":          ["ignited-stone", "ignited-seed-of-life", "ignited-seeing-eye"],
    "will":             ["shard-of-a-shattered-will", "locus-of-a-clear-will",
                         "sigil-of-a-striding-will"],
    "pocket_watch":     ["old-operative-s-pocket-watch", "operative-s-standard-pocket-watch",
                         "operative-s-constancy"],
    "tainted_water":    ["drop-of-tainted-water", "scoop-of-tainted-water",
                         "newborn-tainted-hydro-phantasm"],
    "chimeric":         ["chimeric-core", "symbiotic-chimeric-nucleus", "prime-chimeric-nexus"],
    "ethereal":         ["ethereal-glimmershard", "ethereal-crystal", "ethereal-crystalscale-stone"],
    "warrant":          ["tattered-warrant", "immaculate-warrant", "frost-etched-warrant"],
    "drive_shaft":      ["broken-drive-shaft", "reinforced-drive-shaft", "precision-drive-shaft"],
    "n_fang":           ["juvenile-fang", "seasoned-fang", "tyrant-s-fang"],
    "flower":           ["a-flower-yet-to-bloom", "treasured-flower", "wanderer-s-blooming-flower"],
    "core":             ["rift-core", "foreign-synapse", "alien-life-core"],
}


# ─────────────────────────────────────────────────────────────────────────
# TALENT BOOKS (24 famílias × 3 tiers)
# ─────────────────────────────────────────────────────────────────────────
TALENT_FAMILIES = {
    "freedom":    ["teachings-of-freedom",    "guide-to-freedom",    "philosophies-of-freedom"],
    "resistance": ["teachings-of-resistance", "guide-to-resistance", "philosophies-of-resistance"],
    "ballad":     ["teachings-of-ballad",     "guide-to-ballad",     "philosophies-of-ballad"],
    "prosperity": ["teachings-of-prosperity", "guide-to-prosperity", "philosophies-of-prosperity"],
    "diligence":  ["teachings-of-diligence",  "guide-to-diligence",  "philosophies-of-diligence"],
    "gold":       ["teachings-of-gold",       "guide-to-gold",       "philosophies-of-gold"],
    "transience": ["teachings-of-transience", "guide-to-transience", "philosophies-of-transience"],
    "elegance":   ["teachings-of-elegance",   "guide-to-elegance",   "philosophies-of-elegance"],
    "light":      ["teachings-of-light",      "guide-to-light",      "philosophies-of-light"],
    "admonition": ["teachings-of-admonition", "guide-to-admonition", "philosophies-of-admonition"],
    "ingenuity":  ["teachings-of-ingenuity",  "guide-to-ingenuity",  "philosophies-of-ingenuity"],
    "praxis":     ["teachings-of-praxis",     "guide-to-praxis",     "philosophies-of-praxis"],
    "equity":     ["teachings-of-equity",     "guide-to-equity",     "philosophies-of-equity"],
    "justice":    ["teachings-of-justice",    "guide-to-justice",    "philosophies-of-justice"],
    "order":      ["teachings-of-order",      "guide-to-order",      "philosophies-of-order"],
    "contention": ["teachings-of-contention", "guide-to-contention", "philosophies-of-contention"],
    "kindling":   ["teachings-of-kindling",   "guide-to-kindling",   "philosophies-of-kindling"],
    "conflict":   ["teachings-of-conflict",   "guide-to-conflict",   "philosophies-of-conflict"],
    "elysium":    ["teachings-of-elysium",    "guide-to-elysium",    "philosophies-of-elysium"],
    "moonlight":  ["teachings-of-moonlight",  "guide-to-moonlight",  "philosophies-of-moonlight"],
    "fortitude":  ["teachings-of-fortitude",  "guide-to-fortitude",  "philosophies-of-fortitude"],
    "glory":      ["teachings-of-glory",      "guide-to-glory",      "philosophies-of-glory"],
    "charity":    ["teachings-of-charity",    "guide-to-charity",    "philosophies-of-charity"],
    "vagrancy":   ["teachings-of-vagrancy",   "guide-to-vagrancy",   "philosophies-of-vagrancy"],
}


# ─────────────────────────────────────────────────────────────────────────
# WAM (Weapon Ascension Materials) — 24 famílias × 4 tiers
# ─────────────────────────────────────────────────────────────────────────
WAM_FAMILIES = {
    "decarabian":          ["tile-of-decarabian-s-tower", "debris-of-decarabian-s-city",
                            "fragment-of-decarabian-s-epic", "scattered-piece-of-decarabian-s-dream"],
    "boreal_wolf":         ["boreal-wolf-s-milk-tooth", "boreal-wolf-s-cracked-tooth",
                            "boreal-wolf-s-broken-fang", "boreal-wolf-s-nostalgia"],
    "dandelion_gladiator": ["fetters-of-the-dandelion-gladiator", "chains-of-the-dandelion-gladiator",
                            "shackles-of-the-dandelion-gladiator", "dream-of-the-dandelion-gladiator"],
    "guyun":               ["luminous-sands-from-guyun", "lustrous-stone-from-guyun",
                            "relic-from-guyun", "divine-body-from-guyun"],
    "mist_veiled_elixer":  ["mist-veiled-lead-elixir", "mist-veiled-mercury-elixir",
                            "mist-veiled-gold-elixir", "mist-veiled-primo-elixir"],
    "aerosiderite":        ["grain-of-aerosiderite", "piece-of-aerosiderite",
                            "bit-of-aerosiderite", "chunk-of-aerosiderite"],
    "sea_branch":          ["coral-branch-of-a-distant-sea", "jeweled-branch-of-a-distant-sea",
                            "jade-branch-of-a-distant-sea", "golden-branch-of-a-distant-sea"],
    "narukami":            ["narukami-s-wisdom", "narukami-s-joy",
                            "narukami-s-affection", "narukami-s-valor"],
    "mask_w":              ["mask-of-the-wicked-lieutenant", "mask-of-the-tiger-s-bite",
                            "mask-of-the-one-horned", "mask-of-the-kijin"],
    "talisman":            ["copper-talisman-of-the-forest-dew", "iron-talisman-of-the-forest-dew",
                            "silver-talisman-of-the-forest-dew", "golden-talisman-of-the-forest-dew"],
    "oasis_gardens":       ["oasis-garden-s-reminiscence", "oasis-garden-s-kindness",
                            "oasis-garden-s-mourning", "oasis-garden-s-truth"],
    "scorching_might":     ["echo-of-scorching-might", "remnant-glow-of-scorching-might",
                            "dream-of-scorching-might", "olden-days-of-scorching-might"],
    "far_north_scions":    ["sundered-glory-of-the-far-north-scions",
                            "unyielding-delusion-of-the-far-north-scions",
                            "oblation-of-the-far-north-scions",
                            "aureate-radiance-of-the-far-north-scions"],
    "delirious":           ["delirious-decadence-of-the-sacred-lord",
                            "delirious-desolation-of-the-sacred-lord",
                            "delirious-demeanor-of-the-sacred-lord",
                            "delirious-divinity-of-the-sacred-lord"],
    "bs_heart":            ["blazing-sacrificial-heart-s-terror",
                            "blazing-sacrificial-heart-s-hesitance",
                            "blazing-sacrificial-heart-s-resolve",
                            "blazing-sacrificial-heart-s-splendor"],
    "frost_emperor":       ["the-frost-emperor-s-revival", "the-frost-emperor-s-ceremony",
                            "the-frost-emperor-s-lament", "the-frost-emperor-s-farewell"],
    "spiritual_nectar":    ["measured-pour-of-the-cellared-spiritual-nectar",
                            "intoxication-of-the-cellared-spiritual-nectar",
                            "exhilaration-of-the-cellared-spiritual-nectar",
                            "revelry-of-the-cellared-spiritual-nectar"],
    "pale_star":           ["rise-of-the-pale-star-army", "muster-of-the-pale-star-army",
                            "clarion-of-the-pale-star-army", "triumph-of-the-pale-star-army"],
    "flint":               ["ember-of-long-night-flint", "afterglow-of-long-night-flint",
                            "blaze-of-long-night-flint", "flare-of-long-night-flint"],
    "artful_device":       ["artful-device-fragment", "artful-device-replica",
                            "artful-device-inheritance", "artful-device-wish"],
    "night_wind":          ["night-wind-s-mystic-consideration",
                            "night-wind-s-mystic-premonition",
                            "night-wind-s-mystic-augury",
                            "night-wind-s-mystic-revelation"],
    "pristine_sea":        ["broken-goblet-of-the-pristine-sea", "wine-goblet-of-the-pristine-sea",
                            "silver-goblet-of-the-pristine-sea", "golden-goblet-of-the-pristine-sea"],
    "dewdrop":             ["dross-of-pure-sacred-dewdrop", "sublimation-of-pure-sacred-dewdrop",
                            "spring-of-pure-sacred-dewdrop", "essence-of-pure-sacred-dewdrop"],
    "ancient_chord":       ["fragment-of-an-ancient-chord", "chapter-of-an-ancient-chord",
                            "movement-of-an-ancient-chord", "echo-of-an-ancient-chord"],
}


# ─────────────────────────────────────────────────────────────────────────
# ALIASES DE CHAVE
# ─────────────────────────────────────────────────────────────────────────
FAMILY_KEY_ALIASES = {
    # Gemas: Seelie usa slug completo, families usa base curta
    "agnidus_agate":     "agnidus",
    "varunada_lazurite": "varunada",
    "vajrada_amethyst":  "vajrada",
    "vayuda_turqoise":   "vayuda-turquoise",
    "shivada_jade":      "shivada",
    "nagadus_emerald":   "nagadus",
    "prithiva_topaz":    "prithiva",
    "brilliant_diamond": "brilliant",

    "fairness":  "equity",
    "prism":     "prism_damaged",
    "d_prism":   "prism_dismal",
    "spectral":  "spectral_husk",
    "bone-shard":"bone_shard",
    "red-satin": "red_satin",
}


# ─────────────────────────────────────────────────────────────────────────
# SINGLE-SLUG ALIASES
# ─────────────────────────────────────────────────────────────────────────
SINGLE_SLUG_ALIASES = {
    "signora_flower": "molten-moment",
    "signora_wings":  "hellfire-butterfly",
    "signora_heart":  "ashen-heart",

    "secret_source_core":            "gold-inscribed-secret-source-core",
    "precision_kuuvahki":            "precision-kuuvahki-stamping-die",
    "airflow_accumulator":           "secret-source-airflow-accumulator",
    "clockwork_component_coppelia":  "artificed-spare-clockwork-component-coppelia",
    "clockwork_component_coppelius": "artificed-spare-clockwork-component-coppelius",
    "golden_melody":                 "fragment-of-a-golden-melody",
    "binding_blessing":              "mark-of-the-binding-blessing",
    "emperors_resolution":           "emperor-s-resolution",
    "flamegranate":                  "overripe-flamegranate",
    "cracked_armor":                 "vagabond-s-cracked-armor",
    "kuuvahki_core":                 "cyclic-military-kuuvahki-core",
    "eroded_scale":                  "eroded-scale-feather",
    "water_that_failed":             "water-that-failed-to-transcend",
    "cornerstone":                   "the-cornerstone-of-stars-and-flames",
    "doctor_madman":                 "madman-s-restraint",
    "doctor_elixir":                 "elixir-of-the-heretic",
    "doctor_mask":                   "mask-of-the-virtuous-doctor",
    "withered_branch":               "twisted-withered-branch",

    "glaze_lilly":       "glaze-lily",
    "sprayfeather":      "sprayfeather-gill",
    "quenepa":           "quenepa-berry",
    "saurian_succulent": "saurian-claw-succulent",
    "chrysanthemum":     "brilliant-chrysanthemum",
    "hornshroom":        "glowing-hornshroom",
    "purpurbloom":       "withering-purpurbloom",
    "first_dewdrop":     "spring-of-the-first-dewdrop",
    "rukkhashava":       "rukkhashava-mushrooms",
    "kalpalata":         "kalpalata-lotus",
    "nilotpala":         "nilotpala-lotus",
    "tenkumo_fruit":     "amakumo-fruit",
    "frostfairy":        "frostfairy-flower",
    "redcrest":          "henna-berry",
}


def _localized(row, field: str, langs=LANGS) -> dict:
    out = {}
    for t in row.translations:
        if t.language in langs:
            out[t.language] = getattr(t, field, None)
    return out


def _localized_with_en_fallback(row, field: str, canonical: str | None) -> dict:
    out = _localized(row, field)
    if 'en' not in out and canonical:
        out['en'] = canonical
    return out


def build_character(c: Character) -> dict:
    mats_by_phase: dict[int, list] = {}
    for m in c.ascension_materials:
        mats_by_phase.setdefault(m.phase, []).append({'slug': m.material.slug, 'qty': m.quantity})

    asc_phases = [
        {'phase': p.phase, 'max_level': p.unlock_max_level, 'mora': p.mora,
         'materials': mats_by_phase.get(p.phase, [])}
        for p in c.ascension_phases
    ]

    mats_by_talent: dict[tuple, list] = {}
    for tm in c.talent_materials:
        mats_by_talent.setdefault((tm.talent_type, tm.level), []).append(
            {'slug': tm.material.slug, 'qty': tm.quantity}
        )

    talent_phases: dict[str, list] = {}
    for tp in c.talent_phases:
        talent_phases.setdefault(tp.talent_type, []).append(
            {'level': tp.level, 'mora': tp.mora,
             'materials': mats_by_talent.get((tp.talent_type, tp.level), [])}
        )
    for k in talent_phases:
        talent_phases[k].sort(key=lambda x: x['level'])

    return {
        'name': _localized_with_en_fallback(c, 'name', c.name),
        'icon': c.icon,
        'element': c.element,
        'weapon_type': c.weapon_type,
        'rarity': c.rarity,
        'region': c.region,
        'ascension_phases': asc_phases,
        'talent_phases': talent_phases,
    }


def build_weapon(w: Weapon) -> dict:
    mats_by_phase: dict[int, list] = {}
    for m in w.ascension_materials:
        mats_by_phase.setdefault(m.phase, []).append({'slug': m.material.slug, 'qty': m.quantity})

    phases = [
        {'phase': p.phase, 'max_level': p.unlock_max_level, 'mora': p.mora,
         'materials': mats_by_phase.get(p.phase, [])}
        for p in w.ascension_phases
    ]
    return {
        'name': _localized_with_en_fallback(w, 'name', w.name),
        'icon': w.icon,
        'weapon_type': w.weapon_type,
        'rarity': w.rarity,
        'ascension_phases': phases,
    }


def build_material(m: Material) -> dict:
    return {
        'name': _localized_with_en_fallback(m, 'name', m.name),
        'icon': m.icon,
        'rarity': m.rarity,
        'category': m.category,
        'is_weekly': detect_is_weekly(m.source),
        'description': _localized_with_en_fallback(m, 'description', m.description),
        'source': _localized_with_en_fallback(m, 'source', m.source),
    }


def calculate_global_max(chars_data: dict, weapons_data: dict) -> dict:
    global_max = {}

    def add_mats(materials):
        for m in materials:
            global_max[m['slug']] = global_max.get(m['slug'], 0) + m['qty']

    for c in chars_data.values():
        for phase in c['ascension_phases']:
            add_mats(phase['materials'])
        for talent_list in c['talent_phases'].values():
            for talent in talent_list:
                add_mats(talent['materials'])

    for w in weapons_data.values():
        for phase in w['ascension_phases']:
            add_mats(phase['materials'])
    return global_max


def build_weekly_families(materials: list[Material]) -> dict[str, list[str]]:
    families: dict[str, list[str]] = {}
    for m in materials:
        if not detect_is_weekly(m.source):
            continue
        key = m.source.replace('Lv. 70+ ', '').replace(' Challenge Reward', '').strip()
        family_slug = (
            key.lower()
            .replace(' ', '-')
            .replace("'", '')
            .replace(',', '')
            .replace('.', '')
        )
        families.setdefault(family_slug, []).append(m.slug)
    for slugs in families.values():
        slugs.sort()
    return families


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--output', '-o', default='frontend/public/planner-data.json')
    args = ap.parse_args()

    db: Session = SessionLocal()
    try:
        chars = db.scalars(select(Character).options(
            selectinload(Character.translations),
            selectinload(Character.ascension_phases),
            selectinload(Character.ascension_materials).selectinload(CharacterAscensionMaterial.material),
            selectinload(Character.talent_phases),
            selectinload(Character.talent_materials).selectinload(CharacterTalentMaterial.material),
        )).all()

        weapons = db.scalars(select(Weapon).options(
            selectinload(Weapon.translations),
            selectinload(Weapon.ascension_phases),
            selectinload(Weapon.ascension_materials).selectinload(WeaponAscensionMaterial.material),
        )).all()

        materials = db.scalars(
            select(Material).options(selectinload(Material.translations))
        ).all()
    finally:
        db.close()

    chars_data = {c.slug: build_character(c) for c in chars}
    weapons_data = {w.slug: build_weapon(w) for w in weapons}
    materials_data = {m.slug: build_material(m) for m in materials}

    gem_families: dict[str, list[str]] = {}
    GEM_SUFFIXES = ('-sliver', '-fragment', '-chunk', '-gemstone')
    for slug, m in materials_data.items():
        if m['category'] != 'ascension_gem':
            continue
        base = next((slug[:-len(s)] for s in GEM_SUFFIXES if slug.endswith(s)), None)
        if not base:
            continue
        gem_families.setdefault(base, []).append(slug)
    for base in gem_families:
        gem_families[base].sort(key=lambda s: materials_data[s]['rarity'] or 0)

    weekly_families = build_weekly_families(materials)

    all_families: dict[str, list[str]] = {
        **gem_families,
        **weekly_families,
        **COMMON_MOB_FAMILIES,
        **TALENT_FAMILIES,
        **WAM_FAMILIES,
    }

    for alias_key, real_key in FAMILY_KEY_ALIASES.items():
        if real_key in all_families:
            all_families[alias_key] = all_families[real_key]

    for seelie_key, slug in SINGLE_SLUG_ALIASES.items():
        all_families.setdefault(seelie_key, [slug])

    global_max = calculate_global_max(chars_data, weapons_data)

    payload = {
        'version': datetime.now(timezone.utc).isoformat(),
        'characters': chars_data,
        'weapons': weapons_data,
        'materials': materials_data,
        'global_max': global_max,
        'families': all_families,
    }

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(',', ':')),
        encoding='utf-8',
    )

    print(f'✓ {len(chars)} chars, {len(weapons)} weapons, {len(materials)} materials')
    print(f'✓ {len(all_families)} famílias no total:')
    print(f'   • {len(gem_families):>2} gemas')
    print(f'   • {len(weekly_families):>2} semanais')
    print(f'   • {len(COMMON_MOB_FAMILIES):>2} mobs/raros')
    print(f'   • {len(TALENT_FAMILIES):>2} talentos')
    print(f'   • {len(WAM_FAMILIES):>2} WAM')
    print(f'   • {len(SINGLE_SLUG_ALIASES):>2} singles')
    print(f'   • {len(FAMILY_KEY_ALIASES):>2} aliases de chave')
    print(f'✓ {out} ({out.stat().st_size / 1024:.1f} KB)')

    return 0


if __name__ == '__main__':
    sys.exit(main())
