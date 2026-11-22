"""Schemas Pydantic para importação de conta via UID (Enka.Network)."""
from typing import Optional
from pydantic import BaseModel


class EnkaWeaponOut(BaseModel):
    slug: Optional[str] = None
    item_id: int
    name: str
    icon: Optional[str] = None
    rarity: int = 4
    level: int = 1
    ascension: int = 0
    refinement: int = 1


class EnkaSubstatOut(BaseModel):
    key: str
    value: float


class EnkaArtifactOut(BaseModel):
    set_slug: str
    slot_key: str
    level: int = 0
    rarity: int = 5
    main_stat_key: str
    substats: list[EnkaSubstatOut] = []


class EnkaCharacterOut(BaseModel):
    slug: str
    avatar_id: int
    name: str
    icon: Optional[str] = None
    rarity: int
    element: str
    level: int
    ascension: int = 0
    cons: int = 0
    na: int = 1
    es: int = 1
    eb: int = 1
    has_detail: bool = True
    weapon: Optional[EnkaWeaponOut] = None
    artifacts: list[EnkaArtifactOut] = []


class EnkaImportResponse(BaseModel):
    uid: str
    nickname: str
    ar: Optional[int] = None
    wl: Optional[int] = None
    signature: Optional[str] = None
    ttl: int = 60
    showcase_hidden: bool = False
    characters: list[EnkaCharacterOut]
    unmapped_avatar_ids: list[int] = []
