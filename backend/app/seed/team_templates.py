"""Templates KQM — Fase 1 (15 times cobrindo arquétipos principais).

Cada template referencia um guia do KQM via source_url. Todos os dados
são curados a partir dos guias públicos e cross-verificados com Genshin
Tactics (que referencia o KQM compendium).

Links consultados (Dez/2025):
- keqingmains.com/q/nahida-quickguide/
- keqingmains.com/q/raiden-quickguide/
- keqingmains.com/furina/
- keqingmains.com/kazuha/
- guias de Neuvillette, Hu Tao, Arlecchino (KQM quick guides)
"""
from typing import Any


TEAM_TEMPLATES: list[dict[str, Any]] = [
    # ============================================================
    # HYPERBLOOM
    # ============================================================
    {
        "name": "Hyperbloom Premium (Nahida)",
        "main_character": "nahida",
        "archetype": "hyperbloom",
        "description": "Nahida aplica Dendro off-field, Xingqiu aplica Hydro, Kuki dispara Hyperbloom. Raiden como bateria + trigger alternativo.",
        "character_slugs": ["nahida", "raiden-shogun", "xingqiu", "kuki-shinobu"],
        "artifact_set_slug": "deepwood-memories",
        "weapon_slug": "a-thousand-floating-dreams",
        "notes": "Se não precisar de heal da Kuki, troque por Yelan ou outra Hydro para mais dano.",
        "source": "KQM",
        "source_url": "https://keqingmains.com/q/nahida-quickguide/",
    },
    {
        "name": "Hyperbloom Budget (F2P)",
        "main_character": "nahida",
        "archetype": "hyperbloom",
        "description": "Versão F2P do Hyperbloom com Yaoyao de healer. Core Nahida + Xingqiu + Kuki.",
        "character_slugs": ["nahida", "xingqiu", "kuki-shinobu", "yaoyao"],
        "artifact_set_slug": "deepwood-memories",
        "weapon_slug": "a-thousand-floating-dreams",
        "notes": "Iron Sting na Kuki. Magic Guide na Nahida funciona bem em F2P.",
        "source": "KQM",
        "source_url": "https://keqingmains.com/q/nahida-quickguide/",
    },
    {
        "name": "Double Hydro Hyperbloom",
        "main_character": "nahida",
        "archetype": "hyperbloom",
        "description": "Nahida + Yelan + Kuki + Xingqiu. Single-target forte. Kuki = trigger + heal.",
        "character_slugs": ["nahida", "yelan", "kuki-shinobu", "xingqiu"],
        "artifact_set_slug": "deepwood-memories",
        "weapon_slug": "a-thousand-floating-dreams",
        "notes": "Se não precisar de heal, troque Kuki por Raiden para mais dano.",
        "source": "KQM",
        "source_url": "https://keqingmains.com/q/nahida-quickguide/",
    },
    # ============================================================
    # BLOOM (Nilou)
    # ============================================================
    {
        "name": "Nilou Bloom Premium",
        "main_character": "nilou",
        "archetype": "bloom",
        "description": "Nilou transforma Bloom em Bountiful Cores. Nahida + Kokomi geram núcleos, Baizhu dá sustain.",
        "character_slugs": ["nilou", "nahida", "sangonomiya-kokomi", "baizhu"],
        "artifact_set_slug": "deepwood-memories",
        "weapon_slug": "key-of-khaj-nisut",
        "notes": "Key of Khaj-Nisut na Nilou (HP% para cap de Bountiful Core). 4pc Deepwood na Nahida ou Baizhu.",
        "source": "KQM",
        "source_url": "https://keqingmains.com/nilou/",
    },
    # ============================================================
    # VAPORIZE
    # ============================================================
    {
        "name": "Hu Tao Double Hydro Vape",
        "main_character": "hu-tao",
        "archetype": "vaporize",
        "description": "Hu Tao main DPS, Xingqiu + Yelan aplicam Hydro off-field, Zhongli protege. Vaporize em cada charged attack.",
        "character_slugs": ["hu-tao", "xingqiu", "yelan", "zhongli"],
        "artifact_set_slug": "crimson-witch-of-flames",
        "weapon_slug": "staff-of-homa",
        "notes": "Staff of Homa BIS. Crimson Witch 4pc ou Shimenawa 4pc. Zhongli com Tenacity of the Millelith.",
        "source": "KQM",
        "source_url": "https://keqingmains.com/hu-tao/",
    },
    {
        "name": "Hu Tao Furina Vape",
        "main_character": "hu-tao",
        "archetype": "vaporize",
        "description": "Furina buffa HP e dano, Yelan aplica Hydro, Xianyun heala + buffa. Variante 2025 meta.",
        "character_slugs": ["hu-tao", "furina", "yelan", "xianyun"],
        "artifact_set_slug": "crimson-witch-of-flames",
        "weapon_slug": "staff-of-homa",
        "notes": "Furina com Golden Troupe. Xianyun permite Plunging Attacks que vaporizam sem ICD.",
        "source": "KQM",
        "source_url": "https://keqingmains.com/furina/",
    },
    {
        "name": "Arlecchino Vape",
        "main_character": "arlecchino",
        "archetype": "vaporize",
        "description": "Arlecchino main DPS, Yelan aplica Hydro, Bennett buffa, Kazuha shred VV.",
        "character_slugs": ["arlecchino", "yelan", "bennett", "kaedehara-kazuha"],
        "artifact_set_slug": "gladiators-finale",
        "weapon_slug": "staff-of-homa",
        "notes": "4pc Harmonic Whimsy ou Gladiator's Finale. Staff of Homa BIS. Bennett com Noblesse.",
        "source": "KQM",
        "source_url": "https://keqingmains.com/arlecchino/",
    },
    {
        "name": "Yoimiya Vape",
        "main_character": "yoimiya",
        "archetype": "vaporize",
        "description": "Yoimiya main DPS ranged, Xingqiu aplica Hydro, Bennett buffa ATK, Kazuha shred.",
        "character_slugs": ["yoimiya", "xingqiu", "bennett", "kaedehara-kazuha"],
        "artifact_set_slug": "shimenawas-reminiscence",
        "weapon_slug": "thundering-pulse",
        "notes": "4pc Shimenawa (se ER ok) ou 4pc Crimson Witch. Rust/Thundering Pulse são boas armas.",
        "source": "KQM",
        "source_url": "https://keqingmains.com/yoimiya/",
    },
    # ============================================================
    # NATIONAL / PYRO CORE
    # ============================================================
    {
        "name": "National (Xiangling)",
        "main_character": "xiangling",
        "archetype": "national",
        "description": "Time clássico. Xiangling + Bennett + Xingqiu + Kazuha. Dano Pyro off-field massivo.",
        "character_slugs": ["xiangling", "bennett", "xingqiu", "kaedehara-kazuha"],
        "artifact_set_slug": "emblem-of-severed-fate",
        "weapon_slug": "the-catch",
        "notes": "4pc Emblem na Xiangling e Xingqiu. The Catch R5 é F2P BIS. Bennett com Noblesse.",
        "source": "KQM",
        "source_url": "https://keqingmains.com/xiangling/",
    },
    {
        "name": "Raiden National",
        "main_character": "raiden-shogun",
        "archetype": "national",
        "description": "Variante com Raiden como bateria e burst DPS. Resolve ER da Xiangling e Xingqiu.",
        "character_slugs": ["raiden-shogun", "xiangling", "bennett", "xingqiu"],
        "artifact_set_slug": "emblem-of-severed-fate",
        "weapon_slug": "engulfing-lightning",
        "notes": "4pc Emblem na Raiden, Xiangling, Xingqiu. Engulfing Lightning BIS na Raiden.",
        "source": "KQM",
        "source_url": "https://keqingmains.com/q/raiden-quickguide/",
    },
    {
        "name": "Childe International",
        "main_character": "tartaglia",
        "archetype": "national",
        "description": "Childe + Xiangling + Bennett + Kazuha. Childe aplica Hydro pra Xiangling vaporizar.",
        "character_slugs": ["tartaglia", "xiangling", "bennett", "kaedehara-kazuha"],
        "artifact_set_slug": "heart-of-depth",
        "weapon_slug": "polar-star",
        "notes": "4pc Heart of Depth no Childe. 4pc Emblem na Xiangling. Alto teto de dano, rotação complexa.",
        "source": "KQM",
        "source_url": "https://keqingmains.com/tartaglia/",
    },
    # ============================================================
    # HYPERCARRY
    # ============================================================
    {
        "name": "Raiden Hypercarry",
        "main_character": "raiden-shogun",
        "archetype": "hypercarry",
        "description": "Raiden main DPS, Sara buffa ATK/Electro, Bennett buffa ATK, Kazuha shred.",
        "character_slugs": ["raiden-shogun", "kujou-sara", "bennett", "kaedehara-kazuha"],
        "artifact_set_slug": "emblem-of-severed-fate",
        "weapon_slug": "engulfing-lightning",
        "notes": "Sara C6 ideal para o buff de Electro CRIT DMG. Engulfing Lightning BIS.",
        "source": "KQM",
        "source_url": "https://keqingmains.com/q/raiden-quickguide/",
    },
    {
        "name": "Neuvillette Hypercarry",
        "main_character": "neuvillette",
        "archetype": "hypercarry",
        "description": "Neuvillette main DPS com Furina buffando HP, Kazuha shred, Xilonen ressonância + shred.",
        "character_slugs": ["neuvillette", "furina", "kaedehara-kazuha", "xilonen"],
        "artifact_set_slug": "marechaussee-hunter",
        "weapon_slug": "tome-of-the-eternal-flow",
        "notes": "4pc Marechaussee Hunter no Neuvillette. Furina com Golden Troupe. Xilonen com Scroll of Cinder City.",
        "source": "KQM",
        "source_url": "https://keqingmains.com/q/neuvillette-quickguide/",
    },
    # ============================================================
    # FREEZE
    # ============================================================
    {
        "name": "Ayaka Freeze Premium",
        "main_character": "kamisato-ayaka",
        "archetype": "freeze",
        "description": "Ayaka main DPS congelando, Kazuha agrupa, Kokomi aplica Hydro + heal, Shenhe buffa Cryo.",
        "character_slugs": ["kamisato-ayaka", "kaedehara-kazuha", "sangonomiya-kokomi", "shenhe"],
        "artifact_set_slug": "blizzard-strayer",
        "weapon_slug": "mistsplitter-reforged",
        "notes": "4pc Blizzard Strayer na Ayaka. Shenhe com Noblesse. Kokomi com Tenacity.",
        "source": "KQM",
        "source_url": "https://keqingmains.com/ayaka/",
    },
    # ============================================================
    # AGGRAVATE
    # ============================================================
    {
        "name": "Keqing Aggravate",
        "main_character": "keqing",
        "archetype": "aggravate",
        "description": "Keqing main DPS Electro, Fischl sub-DPS, Nahida aplica Dendro, Kazuha shred + buffa Electro.",
        "character_slugs": ["keqing", "fischl", "nahida", "kaedehara-kazuha"],
        "artifact_set_slug": "thundering-fury",
        "weapon_slug": "mistsplitter-reforged",
        "notes": "4pc Thundering Fury na Keqing. Fischl com Golden Troupe. Kazuha com VV.",
        "source": "KQM",
        "source_url": "https://keqingmains.com/keqing/",
    },
]
