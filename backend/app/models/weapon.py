from sqlalchemy import Column, Integer, String, Float, ForeignKey, Text
from sqlalchemy.orm import relationship
from .base import Base, weapon_type_enum, stat_type_enum


class Weapon(Base):
    __tablename__ = "weapons"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False, unique=True)
    slug = Column(String(100), nullable=False, unique=True, index=True)
    description = Column(Text)
    rarity = Column(Integer, nullable=False)
    weapon_type = Column(weapon_type_enum, nullable=False)
    base_atk = Column(Integer, nullable=False)
    secondary_stat = Column(stat_type_enum)
    secondary_stat_value = Column(Float)
    passive_name = Column(String(150))
    passive_description = Column(Text)

    ascension_materials = relationship(
        "WeaponAscensionMaterial",
        back_populates="weapon",
        cascade="all, delete-orphan",
    )


class WeaponAscensionMaterial(Base):
    __tablename__ = "weapon_ascension_materials"

    id = Column(Integer, primary_key=True)
    weapon_id = Column(
        Integer, ForeignKey("weapons.id", ondelete="CASCADE"), nullable=False
    )
    material_id = Column(
        Integer, ForeignKey("materials.id", ondelete="CASCADE"), nullable=False
    )
    quantity = Column(Integer, nullable=False)
    phase = Column(Integer, nullable=False)

    weapon = relationship("Weapon", back_populates="ascension_materials")
    material = relationship("Material")
