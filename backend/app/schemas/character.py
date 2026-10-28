from typing import Any
from datetime import date
from pydantic import BaseModel, ConfigDict
from .common import Pagination
from ..models import Element, WeaponType, Region, StatType, TalentType


class CharacterSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    slug: str
    name: str
    icon: str | None = None
    rarity: int
    element: Element
    weapon_type: WeaponType
    region: Region | None = None


class ConstellationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    level: int
    name: str
    description: str | None = None
    icon: str | None = None


class TalentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    talent_type: TalentType
    name: str
    description: str | None = None
    icon: str | None = None
    scalings: dict[str, list[dict[str, str]]] | None = None


class PassiveOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str
    description: str | None = None
    icon: str | None = None
    kind: str
    linked_constellations: Any = None


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
    release_date: date | None = None
    voice_actors: dict[str, str] | None = None
    constellations: list[ConstellationOut] = []
    talents: list[TalentOut] = []
    passives: list[PassiveOut] = []


class CharacterListResponse(BaseModel):
    language: str
    pagination: Pagination
    items: list[CharacterSummary]
