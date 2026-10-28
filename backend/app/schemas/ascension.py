from pydantic import BaseModel


class AscensionMaterialOut(BaseModel):
    slug: str
    name: str
    icon: str | None = None
    category: str
    rarity: int | None = None
    quantity: int


class AscensionPhaseOut(BaseModel):
    phase: int
    unlock_max_level: int
    materials: list[AscensionMaterialOut]


class AscensionCostResponse(BaseModel):
    slug: str
    from_level: int
    to_level: int
    phases_included: list[int]
    materials: list[AscensionMaterialOut]
    phases: list[AscensionPhaseOut]
