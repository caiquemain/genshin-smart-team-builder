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
    dict(name="Vaporize", slug="vaporize", elements=["pyro", "hydro"],
         effect="Amplifica dano (Pyro sobre Hydro 1.5x, Hydro sobre Pyro 2.0x)"),
    dict(name="Melt", slug="melt", elements=["pyro", "cryo"],
         effect="Amplifica dano (Pyro sobre Cryo 2.0x, Cryo sobre Pyro 1.5x)"),
    dict(name="Overloaded", slug="overloaded", elements=["pyro", "electro"],
         effect="Dano AoE de Pyro, aplica knockback"),
    dict(name="Electro-Charged", slug="electro_charged", elements=["hydro", "electro"],
         effect="Dano continuo em varios alvos"),
    dict(name="Frozen", slug="frozen", elements=["cryo", "hydro"],
         effect="Imobiliza o alvo (Shatter ao receber Claymore/Geo)"),
    dict(name="Superconduct", slug="superconduct", elements=["cryo", "electro"],
         effect="Reduz DEF fisica em 40%"),
    dict(name="Swirl", slug="swirl", elements=["anemo", "qualquer"],
         effect="Espalha elemento adjacente"),
    dict(name="Crystallize", slug="crystallize", elements=["geo", "qualquer"],
         effect="Cria fragmento que gera escudo"),
    dict(name="Bloom", slug="bloom", elements=["dendro", "hydro"],
         effect="Cria nucleo Dendro explosivo"),
    dict(name="Quicken", slug="quicken", elements=["dendro", "electro"],
         effect="Ativa Aggravate/Spread"),
]


def seed() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(ElementalReaction).first():
            print("[seed] Database already seeded. Skipping.")
            return

        db.add_all([ElementalReaction(**data) for data in REACTIONS])
        db.add(Material(
            name="Mora", slug="mora",
            category=MaterialCategory.MORA, rarity=1,
            description="Moeda universal usada em melhorias.",
        ))
        db.commit()
        print(f"[seed] Inserted {len(REACTIONS)} reactions + Mora.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
