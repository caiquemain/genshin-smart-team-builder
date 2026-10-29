from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from .base import Base


class Team(Base):
    __tablename__ = "teams"

    id = Column(Integer, primary_key=True)
    name = Column(String(150), nullable=False)
    description = Column(Text)
    author_name = Column(String(100))
    is_public = Column(Boolean, nullable=False, default=True)

    members = relationship(
        "TeamCharacter",
        back_populates="team",
        cascade="all, delete-orphan",
        order_by="TeamCharacter.position",
    )


class TeamCharacter(Base):
    __tablename__ = "team_characters"
    __table_args__ = (UniqueConstraint("team_id", "position", name="uq_team_position"),)

    id = Column(Integer, primary_key=True)
    team_id = Column(
        Integer, ForeignKey("teams.id", ondelete="CASCADE"), nullable=False
    )
    character_id = Column(
        Integer, ForeignKey("characters.id", ondelete="CASCADE"), nullable=False
    )
    position = Column(Integer, nullable=False)
    build_data = Column(JSONB)

    team = relationship("Team", back_populates="members")
    character = relationship("Character", back_populates="team_links")
