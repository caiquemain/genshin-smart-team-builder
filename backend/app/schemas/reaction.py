from typing import Any
from pydantic import BaseModel, ConfigDict


class ReactionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    slug: str
    name: str
    elements: Any
    effect: str | None = None
    multiplier: float | None = None


class ReactionListResponse(BaseModel):
    items: list[ReactionRead]
