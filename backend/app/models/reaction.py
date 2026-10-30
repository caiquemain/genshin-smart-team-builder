from sqlalchemy import Column, Integer, String, Text, Float
from sqlalchemy.dialects.postgresql import JSONB
from .base import Base


class ElementalReaction(Base):
    __tablename__ = "elemental_reactions"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False, unique=True)
    slug = Column(String(100), nullable=False, unique=True, index=True)
    elements = Column(JSONB, nullable=False)
    effect = Column(Text)
    multiplier = Column(Float)
    icon = Column(String(150))  # ex: UI_Reaction_Vaporize
