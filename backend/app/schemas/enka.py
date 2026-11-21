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
