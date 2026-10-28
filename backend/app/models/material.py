from sqlalchemy import (
    Column, Integer, String, Text, ForeignKey, UniqueConstraint
)
from sqlalchemy.orm import relationship
from .base import Base, material_category_enum, language_enum


class Material(Base):
    __tablename__ = "materials"

    id = Column(Integer, primary_key=True)
    ambr_id = Column(Integer, unique=True, index=True, nullable=True)
    slug = Column(String(150), nullable=False, unique=True, index=True)
    name = Column(String(150), nullable=False)  # canônico (en)
    category = Column(material_category_enum, nullable=False)
    type_raw = Column(String(200))
    rarity = Column(Integer)
    icon = Column(String(150))
    source = Column(String(200))
    description = Column(Text)

    translations = relationship(
        "MaterialTranslation",
        back_populates="material",
        cascade="all, delete-orphan",
    )


class MaterialTranslation(Base):
    __tablename__ = "material_translations"
    __table_args__ = (
        UniqueConstraint("material_id", "language", name="uq_material_lang"),
    )

    id = Column(Integer, primary_key=True)
    material_id = Column(
        Integer, ForeignKey("materials.id", ondelete="CASCADE"), nullable=False
    )
    language = Column(language_enum, nullable=False, index=True)
    name = Column(String(200), nullable=False, index=True)
    description = Column(Text)

    material = relationship("Material", back_populates="translations")
