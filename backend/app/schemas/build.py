"""Schema de build por personagem dentro de um time."""
from pydantic import BaseModel, ConfigDict, Field


class WeaponSlot(BaseModel):
    weapon_slug: str | None = None
    weapon_refinement: int | None = Field(default=None, ge=1, le=5)
    notes: str | None = None


class ArtifactSlot(BaseModel):
    artifact_set_slug: str | None = None
    notes: str | None = None


class ArtifactPair(BaseModel):
    """Par de 2pc+2pc."""
    set1_slug: str | None = None
    set2_slug: str | None = None
    notes: str | None = None


class CharacterBuild(BaseModel):
    model_config = ConfigDict(extra='ignore')

    weapons: list[WeaponSlot] = Field(default_factory=list)
    artifacts_4pc: list[ArtifactSlot] = Field(default_factory=list)
    artifacts_2pc: list[ArtifactPair] = Field(default_factory=list)
    sands_stat: str | None = None
    goblet_stat: str | None = None
    circlet_stat: str | None = None
    substat_priority: list[str] = Field(default_factory=list)
    er_requirement: str | None = None
    talent_priority: str | None = None
    notes: str | None = None


class TeamBuildsUpdate(BaseModel):
    builds: dict[int, CharacterBuild] = Field(default_factory=dict)
