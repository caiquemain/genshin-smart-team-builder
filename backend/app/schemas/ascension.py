from pydantic import BaseModel


class AscensionMaterialOut(BaseModel):
    slug: str
    name: str
    icon: str | None = None
    category: str
    rarity: int | None = None
    quantity: int
    description: str | None = None
    source: str | None = None


class AscensionPhaseOut(BaseModel):
    phase: int
    unlock_max_level: int
    mora: int
    materials: list[AscensionMaterialOut]


class AscensionCostResponse(BaseModel):
    slug: str
    from_level: int
    to_level: int
    phases_included: list[int]
    total_mora: int
    materials: list[AscensionMaterialOut]
    phases: list[AscensionPhaseOut]
