"""Templates KQM — Fase 2 (25 times extras).

Cobre Xiao, Wanderer, Alhaitham, Wriothesley, Navia, Ganyu, Itto, Clorinde,
Mualani, Cyno, Tighnari, Diluc, Klee, Chevreuse e variantes extras.

Fontes consultadas: KQM quick guides + cross-check genshintactics/game8.
Todos os source_url apontam pro guia do main character.
"""
from typing import Any


TEAM_TEMPLATES_BATCH2: list[dict[str, Any]] = [
    # ============================================================
    # XIAO
    # ============================================================
    {
        "name": "Xiao Hypercarry (FFXX)",
        "main_character": "xiao",
        "archetype": "hypercarry",
        "description": "Xiao main DPS plunging, Faruzan buffa Anemo, Furina buffa HP/dano, Xianyun heala + buffa plunge.",
        "character_slugs": ["xiao", "faruzan", "furina", "xianyun"],
        "artifact_set_slug": "vermillion-hereafter",
        "weapon_slug": "primordial-jade-winged-spear",
        "notes": "4pc Vermillion Hereafter no Xiao. Faruzan C6 é crucial. Furina com Golden Troupe.",
        "source": "KQM",
        "source_url": "https://keqingmains.com/xiao/",
    },
    {
        "name": "Xiao Hypercarry (Bennett)",
        "main_character": "xiao",
        "archetype": "hypercarry",
        "description": "Variante clássica com Bennett buffando ATK. Zhongli escudo + shred.",
        "character_slugs": ["xiao", "faruzan", "bennett", "zhongli"],
        "artifact_set_slug": "vermillion-hereafter",
        "weapon_slug": "primordial-jade-winged-spear",
        "notes": "Time mais acessível que FFXX. Bennett com Noblesse, Zhongli com Tenacity.",
        "source": "KQM",
        "source_url": "https://keqingmains.com/xiao/",
    },
    # ============================================================
    # WANDERER
    # ============================================================
    {
        "name": "Wanderer Hypercarry",
        "main_character": "wanderer",
        "archetype": "hypercarry",
        "description": "Wanderer main DPS voador, Faruzan buffa Anemo, Bennett buffa ATK, Zhongli protege.",
        "character_slugs": ["wanderer", "faruzan", "bennett", "zhongli"],
        "artifact_set_slug": "desert-pavilion-chronicle",
        "weapon_slug": "tulaytullahs-remembrance",
        "notes": "4pc Desert Pavilion no Wanderer. Faruzan C6 essencial pro buff.",
        "source": "KQM",
        "source_url": "https://keqingmains.com/wanderer/",
    },
    # ============================================================
    # ALHAITHAM
    # ============================================================
    {
        "name": "Alhaitham Spread",
        "main_character": "alhaitham",
        "archetype": "spread",
        "description": "Alhaitham main DPS Dendro, Nahida aplica Dendro + buff EM, Yae/Fischl Electro, Kuki heal.",
        "character_slugs": ["alhaitham", "nahida", "yae-miko", "kuki-shinobu"],
        "artifact_set_slug": "gilded-dreams",
        "weapon_slug": "light-of-foliar-incision",
        "notes": "4pc Gilded Dreams ou 4pc Marechaussee Hunter. Light of Foliar BIS.",
        "source": "KQM",
        "source_url": "https://keqingmains.com/alhaitham/",
    },
    {
        "name": "Alhaitham Quickbloom",
        "main_character": "alhaitham",
        "archetype": "quickbloom",
        "description": "Alhaitham + Nahida + Furina + Kuki. Mistura Quicken, Bloom e Hyperbloom.",
        "character_slugs": ["alhaitham", "nahida", "furina", "kuki-shinobu"],
        "artifact_set_slug": "marechaussee-hunter",
        "weapon_slug": "light-of-foliar-incision",
        "notes": "4pc Marechaussee Hunter (Furina gera HP fluct.). Furina com Golden Troupe.",
        "source": "KQM",
        "source_url": "https://keqingmains.com/alhaitham/",
    },
    # ============================================================
    # TIGHNARI
    # ============================================================
    {
        "name": "Tighnari Spread",
        "main_character": "tighnari",
        "archetype": "spread",
        "description": "Tighnari main DPS Dendro rápido, Nahida buffa EM, Yae Electro, Zhongli escudo.",
        "character_slugs": ["tighnari", "nahida", "yae-miko", "zhongli"],
        "artifact_set_slug": "wanderers-troupe",
        "weapon_slug": "hunters-path",
        "notes": "4pc Wanderer's Troupe (foco em Charged Attack). Slingshot F2P funciona bem.",
        "source": "KQM",
        "source_url": "https://keqingmains.com/tighnari/",
    },
    # ============================================================
    # CYNO
    # ============================================================
    {
        "name": "Cyno Quickbloom",
        "main_character": "cyno",
        "archetype": "quickbloom",
        "description": "Cyno main DPS Electro, Nahida aplica Dendro, Xingqiu Hydro, Baizhu heal + Dendro.",
        "character_slugs": ["cyno", "nahida", "xingqiu", "baizhu"],
        "artifact_set_slug": "gilded-dreams",
        "weapon_slug": "staff-of-the-scarlet-sands",
        "notes": "4pc Gilded Dreams no Cyno. ER ~130% pra rotação. Staff of Scarlet Sands BIS.",
        "source": "KQM",
        "source_url": "https://keqingmains.com/cyno/",
    },
    # ============================================================
    # WRIOTHESLEY
    # ============================================================
    {
        "name": "Wriothesley Freeze",
        "main_character": "wriothesley",
        "archetype": "freeze",
        "description": "Wriothesley main DPS Cryo, Kazuha agrupa, Furina buffa, Charlotte heal + Freeze.",
        "character_slugs": ["wriothesley", "kaedehara-kazuha", "furina", "charlotte"],
        "artifact_set_slug": "marechaussee-hunter",
        "weapon_slug": "cashflow-supervision",
        "notes": "4pc Marechaussee Hunter no Wriothesley. Cashflow Supervision BIS.",
        "source": "KQM",
        "source_url": "https://keqingmains.com/wriothesley/",
    },
    {
        "name": "Wriothesley Burnmelt",
        "main_character": "wriothesley",
        "archetype": "melt",
        "description": "Wriothesley Cryo + Nahida/Bennett/Thoma. Burning permite Melt dos Normal Attacks.",
        "character_slugs": ["wriothesley", "nahida", "bennett", "thoma"],
        "artifact_set_slug": "marechaussee-hunter",
        "weapon_slug": "cashflow-supervision",
        "notes": "Burning de Nahida+Thoma permite Melt. 4pc Marechaussee Hunter.",
        "source": "KQM",
        "source_url": "https://keqingmains.com/wriothesley/",
    },
    # ============================================================
    # NAVIA
    # ============================================================
    {
        "name": "Navia Double Geo",
        "main_character": "navia",
        "archetype": "hypercarry",
        "description": "Navia main DPS Geo, Zhongli escudo + ressonância, Bennett buffa, Xiangling Pyro off-field.",
        "character_slugs": ["navia", "zhongli", "bennett", "xiangling"],
        "artifact_set_slug": "nighttime-whispers-in-the-echoing-woods",
        "weapon_slug": "verdict",
        "notes": "4pc Nighttime Whispers. Verdict BIS. Navia absorve shards pra buff.",
        "source": "KQM",
        "source_url": "https://keqingmains.com/navia/",
    },
    # ============================================================
    # GANYU
    # ============================================================
    {
        "name": "Ganyu Melt",
        "main_character": "ganyu",
        "archetype": "melt",
        "description": "Ganyu main DPS Cryo, Xiangling aplica Pyro, Bennett buffa, Zhongli protege.",
        "character_slugs": ["ganyu", "xiangling", "bennett", "zhongli"],
        "artifact_set_slug": "wanderers-troupe",
        "weapon_slug": "amos-bow",
        "notes": "4pc Wanderer's Troupe. Zhongli é obrigatório pra não interromper Charged Shot.",
        "source": "KQM",
        "source_url": "https://keqingmains.com/ganyu/",
    },
    {
        "name": "Ganyu Freeze Premium",
        "main_character": "ganyu",
        "archetype": "freeze",
        "description": "Ganyu congelamento com Furina, Xilonen ressonância + shred, Shenhe buffa Cryo.",
        "character_slugs": ["ganyu", "furina", "xilonen", "shenhe"],
        "artifact_set_slug": "blizzard-strayer",
        "weapon_slug": "amos-bow",
        "notes": "4pc Blizzard Strayer. Furina + Xilonen + Shenhe = time de altíssimo teto.",
        "source": "KQM",
        "source_url": "https://keqingmains.com/ganyu/",
    },
    # ============================================================
    # ITTO MONO GEO
    # ============================================================
    {
        "name": "Itto Mono Geo",
        "main_character": "arataki-itto",
        "archetype": "hypercarry",
        "description": "Itto main DPS DEF scaling, Gorou buffa DEF/Geo, Albedo dano off-field, Zhongli escudo.",
        "character_slugs": ["arataki-itto", "gorou", "albedo", "zhongli"],
        "artifact_set_slug": "husk-of-opulent-dreams",
        "weapon_slug": "redhorn-stonethresher",
        "notes": "4pc Husk of Opulent Dreams. Gorou C6 ideal. Redhorn BIS no Itto.",
        "source": "KQM",
        "source_url": "https://keqingmains.com/itto/",
    },
    {
        "name": "Itto Triple Geo (Chiori)",
        "main_character": "arataki-itto",
        "archetype": "hypercarry",
        "description": "Variante com Chiori no lugar de Albedo. Mais dano off-field, ressonância Geo.",
        "character_slugs": ["arataki-itto", "gorou", "chiori", "zhongli"],
        "artifact_set_slug": "husk-of-opulent-dreams",
        "weapon_slug": "redhorn-stonethresher",
        "notes": "Chiori em vez de Albedo. Mesma build no Itto. Zhongli pode virar flex (Bennett/Furina).",
        "source": "KQM",
        "source_url": "https://keqingmains.com/itto/",
    },
    # ============================================================
    # CLORINDE
    # ============================================================
    {
        "name": "Clorinde Aggravate",
        "main_character": "clorinde",
        "archetype": "aggravate",
        "description": "Clorinde main DPS Electro, Fischl sub-DPS, Nahida aplica Dendro, Kazuha shred + buff.",
        "character_slugs": ["clorinde", "fischl", "nahida", "kaedehara-kazuha"],
        "artifact_set_slug": "fragment-of-harmonic-whimsy",
        "weapon_slug": "absolution",
        "notes": "4pc Fragment of Harmonic Whimsy ou 4pc Thundering Fury. Absolution BIS.",
        "source": "KQM",
        "source_url": "https://keqingmains.com/clorinde/",
    },
    # ============================================================
    # MUALANI
    # ============================================================
    {
        "name": "Mualani Vaporize",
        "main_character": "mualani",
        "archetype": "vaporize",
        "description": "Mualani main DPS Hydro, Xiangling aplica Pyro, Kazuha shred, Xilonen buff.",
        "character_slugs": ["mualani", "xiangling", "kaedehara-kazuha", "xilonen"],
        "artifact_set_slug": "obsidian-codex",
        "weapon_slug": "surfs-up",
        "notes": "4pc Obsidian Codex no Mualani. Surfs Up BIS. Xilonen com Scroll of Cinder City.",
        "source": "KQM",
        "source_url": "https://keqingmains.com/mualani/",
    },
    # ============================================================
    # DILUC
    # ============================================================
    {
        "name": "Diluc Vape (Dragonstrike)",
        "main_character": "diluc",
        "archetype": "vaporize",
        "description": "Diluc main DPS Pyro, Xingqiu aplica Hydro, Bennett buffa, Kazuha shred + agrupa.",
        "character_slugs": ["diluc", "xingqiu", "bennett", "kaedehara-kazuha"],
        "artifact_set_slug": "crimson-witch-of-flames",
        "weapon_slug": "wolfs-gravestone",
        "notes": "4pc Crimson Witch. Dragonstrike é mecânica avançada. Wolfs Gravestone BIS (F2P: Rainslasher).",
        "source": "KQM",
        "source_url": "https://keqingmains.com/diluc/",
    },
    # ============================================================
    # KLEE
    # ============================================================
    {
        "name": "Klee Mono Pyro",
        "main_character": "klee",
        "archetype": "vaporize",
        "description": "Klee main DPS Pyro, Xiangling aplica Pyro off-field, Bennett buffa, Kazuha shred.",
        "character_slugs": ["klee", "xiangling", "bennett", "kaedehara-kazuha"],
        "artifact_set_slug": "crimson-witch-of-flames",
        "weapon_slug": "lost-prayer-to-the-sacred-winds",
        "notes": "Klee tem mecânica difícil (animation cancel). 4pc Crimson Witch.",
        "source": "KQM",
        "source_url": "https://keqingmains.com/klee/",
    },
    # ============================================================
    # CHEVREUSE OVERLOAD
    # ============================================================
    {
        "name": "Chevreuse Overload (Raiden)",
        "main_character": "chevreuse",
        "archetype": "overload",
        "description": "Chevreuse buffa Overload, Raiden main DPS Electro, Xiangling Pyro, Bennett buffa.",
        "character_slugs": ["chevreuse", "raiden-shogun", "xiangling", "bennett"],
        "artifact_set_slug": "song-of-days-past",
        "weapon_slug": "engulfing-lightning",
        "notes": "4pc Song of Days Past na Chevreuse (buffer). Overload triggera buff.",
        "source": "KQM",
        "source_url": "https://keqingmains.com/chevreuse/",
    },
    # ============================================================
    # MIKA / EULA (PHYSICAL)
    # ============================================================
    {
        "name": "Eula Physical Hypercarry",
        "main_character": "eula",
        "archetype": "hypercarry",
        "description": "Eula main DPS físico, Raiden bateria + Superconduct, Bennett buffa, Zhongli protege.",
        "character_slugs": ["eula", "raiden-shogun", "bennett", "zhongli"],
        "artifact_set_slug": "pale-flame",
        "weapon_slug": "song-of-broken-pines",
        "notes": "4pc Pale Flame. Zhongli com Tenacity. Requer ER alto na Eula (~130%).",
        "source": "KQM",
        "source_url": "https://keqingmains.com/eula/",
    },
    # ============================================================
    # JEAN SUNFIRE
    # ============================================================
    {
        "name": "Jean Sunfire Vape",
        "main_character": "jean",
        "archetype": "vaporize",
        "description": "Jean + Bennett criam 'Sunfire' (Pyro swirl). Kazuha shred, Furina buffa.",
        "character_slugs": ["jean", "bennett", "kaedehara-kazuha", "furina"],
        "artifact_set_slug": "viridescent-venerer",
        "weapon_slug": "favonius-sword",
        "notes": "4pc VV na Jean. Sunfire aura com Bennett. Furina com Golden Troupe.",
        "source": "KQM",
        "source_url": "https://keqingmains.com/jean/",
    },
    # ============================================================
    # NILOU VARIANTE
    # ============================================================
    {
        "name": "Nilou Bloom (F2P)",
        "main_character": "nilou",
        "archetype": "bloom",
        "description": "Versão F2P com Barbara como Hydro healer, Collei aplica Dendro, Yao Yao heal.",
        "character_slugs": ["nilou", "nahida", "barbara", "collei"],
        "artifact_set_slug": "deepwood-memories",
        "weapon_slug": "key-of-khaj-nisut",
        "notes": "Barbara em vez de Kokomi. Collei em vez de Baizhu. Iron Sting na Nilou serve.",
        "source": "KQM",
        "source_url": "https://keqingmains.com/nilou/",
    },
    # ============================================================
    # KINICH (BURNING/BURGEON)
    # ============================================================
    {
        "name": "Kinich Burning",
        "main_character": "kinich",
        "archetype": "burgeon",
        "description": "Kinich main DPS Dendro, aplica Burning com Xiangling, Bennett buffa, Emilie Dendro off-field.",
        "character_slugs": ["kinich", "xiangling", "bennett", "emilie"],
        "artifact_set_slug": "unfinished-reverie",
        "weapon_slug": "fang-of-the-mountain-king",
        "notes": "4pc Unfinished Reverie (Burning boost). Fang of Mountain King BIS.",
        "source": "KQM",
        "source_url": "https://keqingmains.com/kinich/",
    },
]
