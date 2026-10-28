from pydantic import BaseModel, ConfigDict
from .common import Pagination
from ..models import Element, WeaponType, Region, StatType


class CharacterSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    slug: str
    name: str
    rarity: int
    element: Element
    weapon_type: WeaponType
    region: Region | None = None


class CharacterDetail(CharacterSummary):
    title: str | None = None
    description: str | None = None
    constellation_name: str | None = None
    birthday: str | None = None
    base_hp: int
    base_atk: int
    base_def: int
    max_hp: int
    max_atk: int
    max_def: int
    ascension_stat: StatType | None = None
    ascension_stat_value: float | None = None


class CharacterListResponse(BaseModel):
    language: str
    pagination: Pagination
    items: list[CharacterSummary]
