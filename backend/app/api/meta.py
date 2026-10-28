from fastapi import APIRouter
from ..schemas.common import EnumsResponse
from ..models import Element, WeaponType, Region, Language

router = APIRouter(prefix="/meta", tags=["meta"])


@router.get("/enums", response_model=EnumsResponse)
def get_enums() -> EnumsResponse:
    return EnumsResponse(
        elements=[e.value for e in Element],
        weapon_types=[w.value for w in WeaponType],
        regions=[r.value for r in Region],
        languages=[l.value for l in Language],
    )
