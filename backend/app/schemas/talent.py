from pydantic import BaseModel
from .ascension import AscensionMaterialOut


class TalentPath(BaseModel):
    from_level: int
    target_level: int
    levels_included: list[int]
    total_mora: int
    materials: list[AscensionMaterialOut]


class TalentCostResponse(BaseModel):
    slug: str
    talents: dict[str, TalentPath]  # chaves: normal_attack, elemental_skill, elemental_burst
    grand_total_mora: int
    grand_total_materials: list[AscensionMaterialOut]
