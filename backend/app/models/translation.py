from sqlalchemy import Column, DateTime, Index, Integer, String, Text, UniqueConstraint, func
from .base import Base


class TextTranslation(Base):
    """Cache persistente de traduções de notas e descrições vindas de guias externos."""

    __tablename__ = "text_translations"
    __table_args__ = (
        UniqueConstraint("source_hash", "target_lang", name="uq_text_trans_hash_lang"),
        Index("ix_text_translations_lang_hash", "target_lang", "source_hash"),
    )

    id = Column(Integer, primary_key=True)
    source_hash = Column(String(64), nullable=False)
    target_lang = Column(String(10), nullable=False)
    source_text = Column(Text, nullable=False)
    translated_text = Column(Text, nullable=False)
    provider = Column(String(32), nullable=False, default="google")
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
