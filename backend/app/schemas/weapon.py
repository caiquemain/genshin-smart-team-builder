from pydantic import BaseModel, ConfigDict
from ..models import WeaponType, StatType
from .ascension import AscensionMaterialOut, AscensionPhaseOut


class WeaponSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    slug: str
    name: str
    icon: str | None = None
    rarity: int
    weapon_type: WeaponType
    base_atk: int
    max_base_atk: int | None = None
    secondary_stat: StatType | None = None
    secondary_stat_value: float | None = None
    max_secondary_stat_value: float | None = None
    passive_name: str | None = None
    passive_description_r5: str | None = None


class WeaponDetail(WeaponSummary):
    description: str | None = None
    passive_name: str | None = None
    passive_description: str | None = None
    passive_levels: dict[str, str] | None = None


class WeaponListResponse(BaseModel):
    language: str
    pagination: dict
    items: list[WeaponSummary]


class WeaponAscensionResponse(BaseModel):
    slug: str
    from_level: int
    to_level: int
    phases_included: list[int]
    total_mora: int
    materials: list[AscensionMaterialOut]
    phases: list[AscensionPhaseOut]
