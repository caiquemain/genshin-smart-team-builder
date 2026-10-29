from sqlalchemy import Column, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from .base import Base


class TeamTemplate(Base):
    """Time recomendado por theorycrafters (KQM, guias comunitários)."""
    __tablename__ = "team_templates"

    id = Column(Integer, primary_key=True)
    name = Column(String(150), nullable=False, unique=True)
    main_character = Column(String(100), nullable=False, index=True)
    archetype = Column(String(50), nullable=False, index=True)
    description = Column(Text)
    character_slugs = Column(JSONB, nullable=False)
    artifact_set_slug = Column(String(150))
    weapon_slug = Column(String(150))
    notes = Column(Text)
    source = Column(String(100), default="KQM")
    source_url = Column(String(500))
