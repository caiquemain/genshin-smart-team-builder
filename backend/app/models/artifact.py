from sqlalchemy import Column, Integer, String, Text
from .base import Base


class ArtifactSet(Base):
    __tablename__ = "artifact_sets"

    id = Column(Integer, primary_key=True)
    name = Column(String(150), nullable=False, unique=True)
    slug = Column(String(150), nullable=False, unique=True, index=True)
    rarity_max = Column(Integer, nullable=False)
    two_piece_bonus = Column(Text)
    four_piece_bonus = Column(Text)
