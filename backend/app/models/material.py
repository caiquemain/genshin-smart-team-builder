from sqlalchemy import Column, Integer, String, Text
from .base import Base, material_category_enum


class Material(Base):
    __tablename__ = "materials"

    id = Column(Integer, primary_key=True)
    name = Column(String(150), nullable=False)
    slug = Column(String(150), nullable=False, unique=True, index=True)
    category = Column(material_category_enum, nullable=False)
    rarity = Column(Integer)
    source = Column(String(200))
    description = Column(Text)
