from pydantic import BaseModel, ConfigDict
from .build import CharacterBuild

class BuildPresetCreate(BaseModel):
    character_slug: str
    name: str
    build_data: CharacterBuild

class BuildPresetDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    character_slug: str
    name: str
    build_data: CharacterBuild

    @classmethod
    def from_model(cls, m):
        return cls(
            id=m.id,
            character_slug=m.character.slug,
            name=m.name,
            build_data=CharacterBuild(**m.build_data)
        )
