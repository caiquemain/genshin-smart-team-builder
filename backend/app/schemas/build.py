"""Schema de build por personagem dentro de um time."""
from pydantic import BaseModel, ConfigDict, Field, field_validator


class WeaponSlot(BaseModel):
    weapon_slug: str | None = None
    weapon_refinement: int | None = Field(default=None, ge=1, le=5)
    notes: str | None = None


class ArtifactSlot(BaseModel):
    artifact_set_slug: str | None = None
    notes: str | None = None


class ArtifactPair(BaseModel):
    set1_slug: str | None = None
    set2_slug: str | None = None
    notes: str | None = None


class BuildReference(BaseModel):
    url: str
    title: str | None = None


class Substitute(BaseModel):
    character_slug: str | None = None
    build_label: str | None = None
    notes: str | None = None


class CharacterBuild(BaseModel):
    model_config = ConfigDict(extra='ignore')

    weapons: list[WeaponSlot] = Field(default_factory=list)
    artifacts_4pc: list[ArtifactSlot] = Field(default_factory=list)
    artifacts_2pc: list[ArtifactPair] = Field(default_factory=list)
    
    # Agora são listas para permitir multi-select
    sands_stat: list[str] = Field(default_factory=list)
    goblet_stat: list[str] = Field(default_factory=list)
    circlet_stat: list[str] = Field(default_factory=list)
    
    substat_priority: list[str] = Field(default_factory=list)
    er_requirement: str | None = None
    talent_priority: str | None = None
    notes: str | None = None
    references: list[BuildReference] = Field(default_factory=list)
    substitutes: list[Substitute] = Field(default_factory=list)
    combos: list[str] = Field(default_factory=list)  # NOVA ABA

    # Compatibilidade: se o banco tiver string antiga, converte para lista
    @field_validator('sands_stat', 'goblet_stat', 'circlet_stat', mode='before')
    @classmethod
    def ensure_list(cls, v):
        if isinstance(v, str):
            return [v] if v else []
        return v or []


class TeamBuildsUpdate(BaseModel):
    builds: dict[int, CharacterBuild] = Field(default_factory=dict)
    preset_ids: dict[int, int] = Field(default_factory=dict)
