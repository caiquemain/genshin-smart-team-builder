from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from .base import Base


class Guide(Base):
    __tablename__ = "guides"

    id = Column(Integer, primary_key=True)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    content = Column(JSONB, nullable=False)
    author_name = Column(String(100))
    is_public = Column(Boolean, nullable=False, default=True)
    team_id = Column(Integer, ForeignKey("teams.id", ondelete="SET NULL"), nullable=True)

    team = relationship("Team")
