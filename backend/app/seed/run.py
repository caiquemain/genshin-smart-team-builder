"""Seed offline: apenas reações e materiais base.

Personagens vêm do Project Amber via ``app.seed.import_from_ambr``.
"""
from ..database import SessionLocal, engine
from ..models import (
    Base,
    ElementalReaction,
    Material,
    MaterialCategory,
)


REACTIONS = [
    # === Amplifying ===
    dict(name="Vaporize", slug="vaporize", elements=["pyro", "hydro"],
         effect="Amplifica dano (Pyro sobre Hydro 1.5x, Hydro sobre Pyro 2.0x)",
         multiplier=1.5, icon="UI_Reaction_Vaporize"),
    dict(name="Melt", slug="melt", elements=["pyro", "cryo"],
         effect="Amplifica dano (Pyro sobre Cryo 2.0x, Cryo sobre Pyro 1.5x)",
         multiplier=2.0, icon="UI_Reaction_Melt"),

    # === Transformative ===
    dict(name="Overloaded", slug="overloaded", elements=["pyro", "electro"],
         effect="Dano AoE de Pyro com knockback",
         icon="UI_Reaction_Overloaded"),
    dict(name="Electro-Charged", slug="electro_charged", elements=["hydro", "electro"],
         effect="Dano contínuo em vários alvos simultaneamente",
         icon="UI_Reaction_ElectroCharged"),
    dict(name="Frozen", slug="frozen", elements=["cryo", "hydro"],
         effect="Imobiliza o alvo (Shatter ao receber Claymore/Geo)",
         icon="UI_Reaction_Frozen"),
    dict(name="Superconduct", slug="superconduct", elements=["cryo", "electro"],
         effect="Reduz DEF física do alvo em 40%",
         icon="UI_Reaction_Superconduct"),
    dict(name="Swirl", slug="swirl", elements=["anemo", "qualquer"],
         effect="Espalha elemento adjacente em outros alvos",
         icon="UI_Reaction_Swirl"),
    dict(name="Crystallize", slug="crystallize", elements=["geo", "qualquer"],
         effect="Cria fragmento que gera escudo",
         icon="UI_Reaction_Crystallize"),
    dict(name="Burning", slug="burning", elements=["pyro", "dendro"],
         effect="Dano contínuo de Pyro",
         icon="UI_Reaction_Burning"),
    dict(name="Shatter", slug="shatter", elements=["frozen", "claymore"],
         effect="Dano físico adicional ao quebrar Frozen",
         icon="UI_Reaction_Shatter"),

    # === Dendro Reactions ===
    dict(name="Bloom", slug="bloom", elements=["dendro", "hydro"],
         effect="Cria núcleo Dendro explosivo",
         icon="UI_Reaction_Bloom"),
    dict(name="Hyperbloom", slug="hyperbloom", elements=["dendro", "hydro", "electro"],
         effect="Núcleo Dendro vira projétil teleguiado (dano Dendro)",
         icon="UI_Reaction_Hyperbloom"),
    dict(name="Burgeon", slug="burgeon", elements=["dendro", "hydro", "pyro"],
         effect="Núcleo Dendro explode em AoE (dano Dendro)",
         icon="UI_Reaction_Burgeon"),
    dict(name="Quicken", slug="quicken", elements=["dendro", "electro"],
         effect="Ativa Aggravate/Spread",
         icon="UI_Reaction_Quicken"),
    dict(name="Aggravate", slug="aggravate", elements=["electro", "dendro"],
         effect="Aumenta dano Electro (Quicken)",
         icon="UI_Reaction_Aggravate"),
    dict(name="Spread", slug="spread", elements=["dendro", "electro"],
         effect="Aumenta dano Dendro (Quicken)",
         icon="UI_Reaction_Spread"),

    # === Lunar Reactions (Nod-Krai / 6.x+) ===
    dict(name="Lunar-Bloom", slug="lunar_bloom", elements=["dendro", "hydro"],
         effect="Bloom potencializado por personagens Moonsign",
         icon="UI_Reaction_LunarBloom"),
    dict(name="Lunar-Charged", slug="lunar_charged", elements=["hydro", "electro"],
         effect="Electro-Charged potencializado por personagens Moonsign",
         icon="UI_Reaction_LunarCharged"),
    dict(name="Lunar-Crystallize", slug="lunar_crystallize", elements=["geo", "qualquer"],
         effect="Crystallize potencializado por personagens Moonsign",
         icon="UI_Reaction_LunarCrystallize"),

    # === Stellar Reactions ===
    dict(name="Stellar-Conduct", slug="stellar_conduct", elements=["cryo", "electro"],
         effect="Superconduct potencializado por personagens Stellar",
         icon="UI_Reaction_StellarConduct"),
    dict(name="Stellar-Swirl", slug="stellar_swirl", elements=["anemo", "qualquer"],
         effect="Swirl potencializado por personagens Stellar",
         icon="UI_Reaction_StellarSwirl"),
]


def seed() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # Idempotente: insere reações que faltam
        inserted_reactions = 0
        for data in REACTIONS:
            exists = (
                db.query(ElementalReaction)
                .filter(ElementalReaction.slug == data["slug"])
                .first()
            )
            if not exists:
                db.add(ElementalReaction(**data))
                inserted_reactions += 1

        # Idempotente: insere Mora só se não existir
        mora_exists = db.query(Material).filter(Material.slug == "mora").first()
        if not mora_exists:
            db.add(Material(
                name="Mora", slug="mora",
                category=MaterialCategory.MORA, rarity=1,
                description="Moeda universal usada em melhorias.",
            ))

        db.commit()
        print(f"[seed] Inserted {inserted_reactions} reactions + Mora (if missing).")
    finally:
        db.close()



if __name__ == "__main__":
    seed()
