from sqlalchemy import Column, Integer, String, Float, ForeignKey, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from .base import Base, weapon_type_enum, stat_type_enum, language_enum


class Weapon(Base):
    __tablename__ = "weapons"

    id = Column(Integer, primary_key=True)
    ambr_id = Column(Integer, unique=True, index=True, nullable=True)
    name = Column(String(100), nullable=False, unique=True)
    slug = Column(String(100), nullable=False, unique=True, index=True)
    description = Column(Text)
    rarity = Column(Integer, nullable=False)
    icon = Column(String(150), index=True)
    weapon_type = Column(weapon_type_enum, nullable=False)
    base_atk = Column(Integer, nullable=False)  # level 1
    max_base_atk = Column(Integer)  # level 90
    secondary_stat = Column(stat_type_enum)
    secondary_stat_value = Column(Float)  # Lv.1
    max_secondary_stat_value = Column(Float)  # Lv.90
    passive_name = Column(String(150))
    passive_description = Column(Text)
    passive_levels = Column(JSONB)

    translations = relationship(
        "WeaponTranslation",
        back_populates="weapon",
        cascade="all, delete-orphan",
    )
    ascension_phases = relationship(
        "WeaponAscensionPhase",
        back_populates="weapon",
        cascade="all, delete-orphan",
        order_by="WeaponAscensionPhase.phase",
    )
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


class WeaponTranslation(Base):
    __tablename__ = "weapon_translations"
    __table_args__ = (
        UniqueConstraint("weapon_id", "language", name="uq_weapon_lang"),
    )

    id = Column(Integer, primary_key=True)
    weapon_id = Column(
        Integer, ForeignKey("weapons.id", ondelete="CASCADE"), nullable=False
    )
    language = Column(language_enum, nullable=False, index=True)
    name = Column(String(150), nullable=False, index=True)
    description = Column(Text)
    passive_name = Column(String(200))
    passive_description = Column(Text)

    weapon = relationship("Weapon", back_populates="translations")


class WeaponAscensionPhase(Base):
    __tablename__ = "weapon_ascension_phases"
    __table_args__ = (
        UniqueConstraint("weapon_id", "phase", name="uq_weapon_asc_phase"),
    )

    id = Column(Integer, primary_key=True)
    weapon_id = Column(
        Integer, ForeignKey("weapons.id", ondelete="CASCADE"), nullable=False
    )
    phase = Column(Integer, nullable=False)
    unlock_max_level = Column(Integer, nullable=False)
    mora = Column(Integer, nullable=False, default=0)

    weapon = relationship("Weapon", back_populates="ascension_phases")
