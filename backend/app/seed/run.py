"""Seed offline: apenas reações e materiais base.

Personagens vêm do Project Amber via ``app.seed.import_from_ambr``.
"""
from ..database import SessionLocal, engine
from ..models import (
    Base,
    ElementalReaction,
    Material,
    TierlistSite,
    MaterialCategory,
)


TIERLIST_SITES = [
    dict(slug="game8", name="Game8", url="https://game8.co/games/Genshin-Impact/archives/297499", scale_size=5),
    dict(slug="gamewith", name="GameWith", url="https://gamewith.net/genshin-impact/article/show/21671", scale_size=5),
    dict(slug="genshinlab", name="GenshinLab", url="https://genshinlab.com/tier-list/", scale_size=6),
    dict(slug="prydwen", name="Prydwen", url="https://www.prydwen.gg/genshin/tier-list", scale_size=5),
    dict(slug="mobalytics", name="Mobalytics", url="https://mobalytics.gg/genshin-impact/tier-list", scale_size=6),
]


REACTIONS = [
    # === Amplifying ===
    dict(
        name="Vaporize",
        slug="vaporize",
        elements=["pyro", "hydro"],
        effect="Amplifica o golpe gatilho multiplicando o dano final: Pyro sobre Hydro causa 1.5x (Reverse Vape) e Hydro sobre Pyro causa 2.0x (Forward Vape). Escala com Crítico, Bônus Elemental e Proficiência Elemental (EM).",
        multiplier=1.5,
        icon="UI_Reaction_Vaporize",
    ),
    dict(
        name="Melt",
        slug="melt",
        elements=["pyro", "cryo"],
        effect="Amplifica o golpe gatilho multiplicando o dano final: Pyro sobre Cryo causa 2.0x (Forward Melt) e Cryo sobre Pyro causa 1.5x (Reverse Melt). Escala com Crítico, Bônus Elemental e EM.",
        multiplier=2.0,
        icon="UI_Reaction_Melt",
    ),

    # === Transformative ===
    dict(
        name="Overloaded",
        slug="overloaded",
        elements=["pyro", "electro"],
        effect="Causa explosão de dano Pyro em área (AoE) que quebra escudos Geo e derruba inimigos leves. Ignora DEF do alvo e escala com Nível e EM do gatilho; times com Chevreuse transformam a reação em enorme bônus de ATQ e RES Shred.",
        icon="UI_Reaction_Overloaded",
    ),
    dict(
        name="Electro-Charged",
        slug="electro_charged",
        elements=["hydro", "electro"],
        effect="Mantém auras Hydro e Electro coexistindo simultaneamente e aplica pulsos contínuos de dano Electro que saltam entre inimigos molhados próximos, interrompendo ações leves.",
        icon="UI_Reaction_ElectroCharged",
    ),
    dict(
        name="Frozen",
        slug="frozen",
        elements=["cryo", "hydro"],
        effect="Congela inimigos suscetíveis no lugar, oferecendo controle de grupo e ativando o bônus completo de +40% Taxa Crítica do conjunto Herói Invernal (Blizzard Strayer). Não causa dano direto.",
        icon="UI_Reaction_Frozen",
    ),
    dict(
        name="Superconduct",
        slug="superconduct",
        elements=["cryo", "electro"],
        effect="Causa dano Cryo em pequena área e reduz a Resistência Física (RES Física) dos inimigos atingidos em 40% por 12 segundos — essencial para carries de Dano Físico.",
        icon="UI_Reaction_Superconduct",
    ),
    dict(
        name="Swirl",
        slug="swirl",
        elements=["anemo", "qualquer"],
        effect="Espalha Pyro, Hydro, Electro ou Cryo para inimigos próximos causando dano elemental em área (com prioridade Pyro > Hydro > Electro > Cryo). Com 4pc Sombra Verde (VV), reduz a RES do elemento absorvido em 40%.",
        icon="UI_Reaction_Swirl",
    ),
    dict(
        name="Crystallize",
        slug="crystallize",
        elements=["geo", "qualquer"],
        effect="Gera um fragmento elemental (Pyro, Hydro, Electro ou Cryo) que concede escudo ao ser coletado, com 250% de absorção contra o mesmo elemento. Alimenta mecânicas de personagens como Navia e 4pc Petra Arcaica.",
        icon="UI_Reaction_Crystallize",
    ),
    dict(
        name="Burning",
        slug="burning",
        elements=["pyro", "dendro"],
        effect="Aplica dano Pyro contínuo a cada 0.25s enquanto consome a aura Dendro lentamente. Excelente para manter aura Pyro constante em times de Reverse Melt (Burnmelt) e potencializar passivas de Emilie e Kinich.",
        icon="UI_Reaction_Burning",
    ),
    dict(
        name="Shatter",
        slug="shatter",
        elements=["frozen", "claymore"],
        effect="Ao atingir um inimigo congelado com ataque pesado (Espadão, Geo, Plunge ou explosões), quebra o gelo e aplica dano Físico transformativo que escala com Nível e EM do gatilho.",
        icon="UI_Reaction_Shatter",
    ),

    # === Dendro Reactions ===
    dict(
        name="Bloom",
        slug="bloom",
        elements=["dendro", "hydro"],
        effect="Cria Núcleos Dendro no chão (máx. 5 ativos) que explodem após 6s causando dano Dendro em área (e 5% de dano ao próprio jogador). Com Nilou em time puro Hydro+Dendro, viram Núcleos Abundantes instantâneos e amplificados.",
        icon="UI_Reaction_Bloom",
    ),
    dict(
        name="Hyperbloom",
        slug="hyperbloom",
        elements=["dendro", "hydro", "electro"],
        effect="Aplicar Electro sobre um Núcleo Dendro o transforma em projétil teleguiado de altíssimo dano Dendro (multiplicador base 3.0x, ignora DEF). Escala apenas com Nível 90 e EM do personagem Electro gatilho.",
        icon="UI_Reaction_Hyperbloom",
    ),
    dict(
        name="Burgeon",
        slug="burgeon",
        elements=["dendro", "hydro", "pyro"],
        effect="Aplicar Pyro sobre um Núcleo Dendro o detona imediatamente em grande explosão Dendro em área (multiplicador base 3.0x, ignora DEF). Ideal contra grupos de inimigos; escala com Nível 90 e EM do gatilho Pyro.",
        icon="UI_Reaction_Burgeon",
    ),
    dict(
        name="Quicken",
        slug="quicken",
        elements=["dendro", "electro"],
        effect="Não causa dano imediato, mas aplica a aura Catalisada (Quicken) no inimigo por ~6–11s. Enquanto ativa, golpes Electro disparam Aggravate e golpes Dendro disparam Spread sem consumir a aura.",
        icon="UI_Reaction_Quicken",
    ),
    dict(
        name="Aggravate",
        slug="aggravate",
        elements=["electro", "dendro"],
        effect="Aplicar Electro sobre um alvo em Quicken soma dano base adicional (flat DMG, fator 1.15x escalando com Nível e EM) ANTES dos multiplicadores de Dano Electro e Crítico.",
        icon="UI_Reaction_Aggravate",
    ),
    dict(
        name="Spread",
        slug="spread",
        elements=["dendro", "electro"],
        effect="Aplicar Dendro sobre um alvo em Quicken soma dano base adicional (flat DMG, fator 1.25x escalando com Nível e EM) ANTES dos multiplicadores de Dano Dendro e Crítico.",
        icon="UI_Reaction_Spread",
    ),

    # === Lunar Reactions (Nod-Krai / 6.x+) ===
    dict(
        name="Lunar-Bloom",
        slug="lunar_bloom",
        elements=["dendro", "hydro"],
        effect="Variante Lunar de Bloom ativada por personagens Moonsign (como Lauma, Nefer e Columbina). Converte a geração de Núcleos em recursos de Orvalho Verdejante e golpes de Dano Lunar-Bloom capazes de acertar Crítico.",
        icon="UI_Reaction_LunarBloom",
    ),
    dict(
        name="Lunar-Charged",
        slug="lunar_charged",
        elements=["hydro", "electro"],
        effect="Variante Lunar de Electro-Charged ativada por personagens Moonsign (como Ineffa, Flins e Columbina). Invoca nuvens de tempestade que descarregam raios contínuos com escalonamento de EM e capacidade de Crítico.",
        icon="UI_Reaction_LunarCharged",
    ),
    dict(
        name="Lunar-Crystallize",
        slug="lunar_crystallize",
        elements=["geo", "qualquer"],
        effect="Variante Lunar de Crystallize ativada por personagens Moonsign Geo/Hydro (como Zibai, Illuga e Columbina). Transforma fragmentos elementais em ressonâncias Geo ofensivas capazes de Crítico além da proteção de escudo.",
        icon="UI_Reaction_LunarCrystallize",
    ),

    # === Stellar Reactions ===
    dict(
        name="Stellar-Conduct",
        slug="stellar_conduct",
        elements=["cryo", "electro"],
        effect="Versão aprimorada de Superconduct ligada a kits Stellar, amplificando o dano da reação e estendendo o enfraquecimento de resistências em composições Cryo + Electro.",
        icon="UI_Reaction_StellarConduct",
    ),
    dict(
        name="Stellar-Swirl",
        slug="stellar_swirl",
        elements=["anemo", "qualquer"],
        effect="Versão aprimorada de Swirl ligada a kits Stellar, aumentando o alcance e o dano da difusão elemental em múltiplos alvos.",
        icon="UI_Reaction_StellarSwirl",
    ),
]


def seed() -> None:
    from ..services.archetype_classifier import reclassify_team_templates

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # Idempotente: insere reações que faltam e atualiza descrições enriquecidas
        inserted_reactions = 0
        updated_reactions = 0
        for data in REACTIONS:
            exists = (
                db.query(ElementalReaction)
                .filter(ElementalReaction.slug == data["slug"])
                .first()
            )
            if not exists:
                db.add(ElementalReaction(**data))
                inserted_reactions += 1
            elif exists.effect != data["effect"]:
                exists.effect = data["effect"]
                updated_reactions += 1

        # Idempotente: insere Mora só se não existir
        mora_exists = db.query(Material).filter(Material.slug == "mora").first()
        if not mora_exists:
            db.add(Material(
                name="Mora", slug="mora",
                category=MaterialCategory.MORA, rarity=1,
                description="Moeda universal usada em melhorias.",
            ))

        # Seed de sites de tierlist (idempotente)
        inserted_sites = 0
        for site_data in TIERLIST_SITES:
            exists = db.query(TierlistSite).filter(TierlistSite.slug == site_data["slug"]).first()
            if not exists:
                db.add(TierlistSite(**site_data))
                inserted_sites += 1

        # Reclassifica automaticamente templates 'unknown' com base nas reações
        reclass = reclassify_team_templates(db, only_unknown=True)

        db.commit()
        print(
            f"[seed] Reactions: +{inserted_reactions} / ~{updated_reactions} updated · "
            f"Tierlist sites: +{inserted_sites} · "
            f"Unknown teams reclassified: {reclass['updated']} (remaining unknown: {reclass['remaining_unknown']})."
        )
    finally:
        db.close()



if __name__ == "__main__":
    seed()
