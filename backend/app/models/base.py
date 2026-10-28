import enum
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class Element(str, enum.Enum):
    PYRO = "pyro"
    HYDRO = "hydro"
    ELECTRO = "electro"
    CRYO = "cryo"
    ANEMO = "anemo"
    GEO = "geo"
    DENDRO = "dendro"


class WeaponType(str, enum.Enum):
    SWORD = "sword"
    CLAYMORE = "claymore"
    POLEARM = "polearm"
    BOW = "bow"
    CATALYST = "catalyst"


class ArtifactSlot(str, enum.Enum):
    FLOWER = "flower"
    PLUME = "plume"
    SANDS = "sands"
    GOBLET = "goblet"
    CIRCLET = "circlet"


class StatType(str, enum.Enum):
    HP = "hp"
    ATK = "atk"
    DEF = "def"
    HP_PCT = "hp_pct"
    ATK_PCT = "atk_pct"
    DEF_PCT = "def_pct"
    EM = "em"
    ER = "er"
    CRIT_RATE = "crit_rate"
    CRIT_DMG = "crit_dmg"
    HEALING_BONUS = "healing_bonus"
    PHYSICAL_DMG = "physical_dmg"
    PYRO_DMG = "pyro_dmg"
    HYDRO_DMG = "hydro_dmg"
    ELECTRO_DMG = "electro_dmg"
    CRYO_DMG = "cryo_dmg"
    ANEMO_DMG = "anemo_dmg"
    GEO_DMG = "geo_dmg"
    DENDRO_DMG = "dendro_dmg"


class MaterialCategory(str, enum.Enum):
    CHARACTER_EXP = "character_exp"
    WEAPON_EXP = "weapon_exp"
    MORA = "mora"
    ASCENSION_GEM = "ascension_gem"
    BOSS_MATERIAL = "boss_material"
    LOCAL_SPECIALTY = "local_specialty"
    COMMON_DROP = "common_drop"
    TALENT_BOOK = "talent_book"
    WEEKLY_BOSS = "weekly_boss"
    CROWN = "crown"
    WEAPON_ASCENSION = "weapon_ascension"


class TalentType(str, enum.Enum):
    NORMAL_ATTACK = "normal_attack"
    ELEMENTAL_SKILL = "elemental_skill"
    ELEMENTAL_BURST = "elemental_burst"


class Region(str, enum.Enum):
    MONDSTADT = "mondstadt"
    LIYUE = "liyue"
    INAZUMA = "inazuma"
    SUMERU = "sumeru"
    FONTAINE = "fontaine"
    NATLAN = "natlan"
    SNEZHNAYA = "snezhnaya"
    OTHER = "other"


element_enum = SAEnum(Element, native_enum=False, create_constraint=False, length=50)
weapon_type_enum = SAEnum(WeaponType, native_enum=False, create_constraint=False, length=50)
artifact_slot_enum = SAEnum(ArtifactSlot, native_enum=False, create_constraint=False, length=50)
stat_type_enum = SAEnum(StatType, native_enum=False, create_constraint=False, length=50)
material_category_enum = SAEnum(MaterialCategory, native_enum=False, create_constraint=False, length=50)
talent_type_enum = SAEnum(TalentType, native_enum=False, create_constraint=False, length=50)
region_enum = SAEnum(Region, native_enum=False, create_constraint=False, length=50)
