from sqlalchemy import Column, Integer, String, Float, ForeignKey, Text
from sqlalchemy.orm import relationship
from .base import (
    Base,
    element_enum,
    weapon_type_enum,
    stat_type_enum,
    region_enum,
    talent_type_enum,
)


class Character(Base):
    __tablename__ = "characters"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False, unique=True)
    slug = Column(String(100), nullable=False, unique=True, index=True)
    title = Column(String(200))
    description = Column(Text)
    rarity = Column(Integer, nullable=False)
    element = Column(element_enum, nullable=False)
    weapon_type = Column(weapon_type_enum, nullable=False)
    region = Column(region_enum)
    birthday = Column(String(10))
    base_hp = Column(Integer, nullable=False)
    base_atk = Column(Integer, nullable=False)
    base_def = Column(Integer, nullable=False)
    max_hp = Column(Integer, nullable=False)
    max_atk = Column(Integer, nullable=False)
    max_def = Column(Integer, nullable=False)
    ascension_stat = Column(stat_type_enum)
    ascension_stat_value = Column(Float)
    constellation_name = Column(String(100))

    ascension_materials = relationship(
        "CharacterAscensionMaterial",
        back_populates="character",
        cascade="all, delete-orphan",
    )
    talent_materials = relationship(
        "CharacterTalentMaterial",
        back_populates="character",
        cascade="all, delete-orphan",
    )
    team_links = relationship("TeamCharacter", back_populates="character")


class CharacterAscensionMaterial(Base):
    __tablename__ = "character_ascension_materials"

    id = Column(Integer, primary_key=True)
    character_id = Column(
        Integer, ForeignKey("characters.id", ondelete="CASCADE"), nullable=False
    )
    material_id = Column(
        Integer, ForeignKey("materials.id", ondelete="CASCADE"), nullable=False
    )
    quantity = Column(Integer, nullable=False)
    phase = Column(Integer, nullable=False)

    character = relationship("Character", back_populates="ascension_materials")
    material = relationship("Material")


class CharacterTalentMaterial(Base):
    __tablename__ = "character_talent_materials"

    id = Column(Integer, primary_key=True)
    character_id = Column(
        Integer, ForeignKey("characters.id", ondelete="CASCADE"), nullable=False
    )
    material_id = Column(
        Integer, ForeignKey("materials.id", ondelete="CASCADE"), nullable=False
    )
    quantity = Column(Integer, nullable=False)
    talent_type = Column(talent_type_enum, nullable=False)
    level = Column(Integer, nullable=False)

    character = relationship("Character", back_populates="talent_materials")
    material = relationship("Material")
