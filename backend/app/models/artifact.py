from sqlalchemy import Column, Integer, String, Text, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from .base import Base, language_enum


class ArtifactSet(Base):
    __tablename__ = "artifact_sets"

    id = Column(Integer, primary_key=True)
    ambr_id = Column(Integer, unique=True, index=True, nullable=True)
    slug = Column(String(150), nullable=False, unique=True, index=True)
    name = Column(String(150), nullable=False, unique=True)  # EN canônico
    rarity_max = Column(Integer, nullable=False)
    level_list = Column(JSONB)  # [4, 5] — raridades disponíveis
    icon = Column(String(150), index=True)
    two_piece_bonus = Column(Text)
    four_piece_bonus = Column(Text)
    pieces = Column(JSONB)  # detalhe das 5 peças
    source = Column(Text)  # onde farmar (domínio)

    translations = relationship(
        "ArtifactSetTranslation",
        back_populates="artifact_set",
        cascade="all, delete-orphan",
    )


class ArtifactSetTranslation(Base):
    __tablename__ = "artifact_set_translations"
    __table_args__ = (
        UniqueConstraint("artifact_set_id", "language", name="uq_artset_lang"),
    )

    id = Column(Integer, primary_key=True)
    artifact_set_id = Column(
        Integer, ForeignKey("artifact_sets.id", ondelete="CASCADE"), nullable=False
    )
    language = Column(language_enum, nullable=False, index=True)
    name = Column(String(150), nullable=False, index=True)
    two_piece_bonus = Column(Text)
    four_piece_bonus = Column(Text)

    artifact_set = relationship("ArtifactSet", back_populates="translations")
