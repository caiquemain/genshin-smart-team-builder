"""Modelos de tierlist agregada."""
from sqlalchemy import (
    Column, Integer, String, Float, ForeignKey, DateTime, UniqueConstraint, func,
)
from sqlalchemy.orm import relationship
from .base import Base


class TierlistSite(Base):
    __tablename__ = "tierlist_sites"

    id = Column(Integer, primary_key=True)
    slug = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    url = Column(String(300), nullable=False)
    scale_size = Column(Integer, nullable=False)  # 5, 6, 7
    last_scraped_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    entries = relationship(
        "TierlistEntry",
        back_populates="site",
        cascade="all, delete-orphan",
    )


class TierlistEntry(Base):
    __tablename__ = "tierlist_entries"
    __table_args__ = (
        UniqueConstraint(
            "site_id", "character_slug", "role", "version",
            name="uq_tierlist_entry",
        ),
    )

    id = Column(Integer, primary_key=True)
    site_id = Column(
        Integer, ForeignKey("tierlist_sites.id", ondelete="CASCADE"), nullable=False
    )
    character_slug = Column(String(100), nullable=False, index=True)
    role = Column(String(50), nullable=False, index=True)
    # role values: "main-dps", "sub-dps", "support", "healer", "general"
    tier_label = Column(String(20), nullable=False)  # "SS", "S", "T0.5", etc
    tier_index = Column(Integer, nullable=False)  # 0 = topo, N = fundo
    normalized_value = Column(Float, nullable=False)  # 0.0 - 1.0
    version = Column(String(20), nullable=True)  # "5.8", "7.1"
    source_url = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    site = relationship("TierlistSite", back_populates="entries")
