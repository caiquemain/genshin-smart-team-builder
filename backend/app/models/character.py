from sqlalchemy import (
    Column, Integer, String, Float, ForeignKey, Text, UniqueConstraint, Date
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from .base import (
    Base,
    element_enum,
    weapon_type_enum,
    stat_type_enum,
    region_enum,
    talent_type_enum,
    language_enum,
)


class Character(Base):
    __tablename__ = "characters"

    id = Column(Integer, primary_key=True)
    # Slug em inglês, ASCII, estável. Nunca traduzir.
    slug = Column(String(100), nullable=False, unique=True, index=True)
    icon = Column(String(150), index=True)
    # Nome canônico em inglês (fallback e âncora das traduções).
    name = Column(String(100), nullable=False, unique=True)
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
    release_date = Column(Date)
    voice_actors = Column(JSONB)

    translations = relationship(
        "CharacterTranslation",
        back_populates="character",
        cascade="all, delete-orphan",
    )
    ascension_phases = relationship(
        "CharacterAscensionPhase",
        back_populates="character",
        cascade="all, delete-orphan",
        order_by="CharacterAscensionPhase.phase",
    )
    talent_phases = relationship(
        "CharacterTalentPhase",
        back_populates="character",
        cascade="all, delete-orphan",
        order_by="CharacterTalentPhase.level",
    )
    ascension_materials = relationship(
        "CharacterAscensionMaterial",
        back_populates="character",
        cascade="all, delete-orphan",
    )
    constellations = relationship(
        "CharacterConstellation",
        back_populates="character",
        cascade="all, delete-orphan",
        order_by="CharacterConstellation.level",
    )
    talents = relationship(
        "CharacterTalent",
        back_populates="character",
        cascade="all, delete-orphan",
    )
    passives = relationship(
        "CharacterPassive",
        back_populates="character",
        cascade="all, delete-orphan",
    )
    talent_materials = relationship(
        "CharacterTalentMaterial",
        back_populates="character",
        cascade="all, delete-orphan",
    )
    team_links = relationship("TeamCharacter", back_populates="character")


class CharacterTranslation(Base):
    __tablename__ = "character_translations"
    __table_args__ = (
        UniqueConstraint("character_id", "language", name="uq_character_lang"),
    )

    id = Column(Integer, primary_key=True)
    character_id = Column(
        Integer, ForeignKey("characters.id", ondelete="CASCADE"), nullable=False
    )
    language = Column(language_enum, nullable=False, index=True)
    name = Column(String(150), nullable=False, index=True)
    title = Column(String(200))
    description = Column(Text)
    constellation_name = Column(String(100))

    character = relationship("Character", back_populates="translations")


class CharacterAscensionPhase(Base):
    __tablename__ = "character_ascension_phases"
    __table_args__ = (
        UniqueConstraint("character_id", "phase", name="uq_char_asc_phase"),
    )

    id = Column(Integer, primary_key=True)
    character_id = Column(
        Integer, ForeignKey("characters.id", ondelete="CASCADE"), nullable=False
    )
    phase = Column(Integer, nullable=False)
    unlock_max_level = Column(Integer, nullable=False)
    mora = Column(Integer, nullable=False, default=0)

    character = relationship("Character", back_populates="ascension_phases")


class CharacterTalentPhase(Base):
    __tablename__ = "character_talent_phases"
    __table_args__ = (
        UniqueConstraint(
            "character_id", "talent_type", "level",
            name="uq_char_talent_phase",
        ),
    )

    id = Column(Integer, primary_key=True)
    character_id = Column(
        Integer, ForeignKey("characters.id", ondelete="CASCADE"), nullable=False
    )
    talent_type = Column(talent_type_enum, nullable=False)
    level = Column(Integer, nullable=False)
    mora = Column(Integer, nullable=False, default=0)

    character = relationship("Character", back_populates="talent_phases")


class CharacterConstellation(Base):
    __tablename__ = "character_constellations"
    __table_args__ = (
        UniqueConstraint("character_id", "level", name="uq_char_const_level"),
    )

    id = Column(Integer, primary_key=True)
    character_id = Column(
        Integer, ForeignKey("characters.id", ondelete="CASCADE"), nullable=False
    )
    level = Column(Integer, nullable=False)  # 1..6
    name = Column(String(150), nullable=False)
    description = Column(Text)
    icon = Column(String(150))

    character = relationship("Character", back_populates="constellations")


class CharacterTalent(Base):
    """Info descritiva de cada talento (nome, ícone, descrição).

    Os custos de ascensão ficam em CharacterTalentPhase / CharacterTalentMaterial.
    """
    __tablename__ = "character_talents"
    __table_args__ = (
        UniqueConstraint("character_id", "talent_type", name="uq_char_talent_type"),
    )

    id = Column(Integer, primary_key=True)
    character_id = Column(
        Integer, ForeignKey("characters.id", ondelete="CASCADE"), nullable=False
    )
    talent_type = Column(talent_type_enum, nullable=False)
    name = Column(String(150), nullable=False)
    description = Column(Text)
    icon = Column(String(150))
    scalings = Column(JSONB)

    character = relationship("Character", back_populates="talents")


class CharacterPassive(Base):
    __tablename__ = "character_passives"
    __table_args__ = (
        UniqueConstraint("character_id", "name", name="uq_char_passive_name"),
    )

    id = Column(Integer, primary_key=True)
    character_id = Column(
        Integer, ForeignKey("characters.id", ondelete="CASCADE"), nullable=False
    )
    name = Column(String(150), nullable=False)
    description = Column(Text)
    icon = Column(String(150))
    kind = Column(String(50), default="passive")  # passive | constellation_upgrade
    linked_constellations = Column(JSONB)

    character = relationship("Character", back_populates="passives")


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
