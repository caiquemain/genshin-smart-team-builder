"""Localização de textos vindos de guias externos (KQM, Game8, GameWith, Helper Sheet).

Estratégia em 2 camadas (zero latência externa em runtime):
  1. Traduções determinísticas instantâneas para rótulos curtos padronizados
     (`talent_priority`, `build_label` de substitutos).
  2. Lookup em lote no cache persistente `text_translations` (populado pelo CLI
     `python -m app.scripts.translate_guides --lang pt --provider ...`).
"""
from __future__ import annotations

import hashlib
import re
from typing import Any, Iterable

from sqlalchemy.orm import Session

from ..models import Language, TextTranslation


def normalize_source_text(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip())


def text_hash(text: str) -> str:
    norm = normalize_source_text(text)
    return hashlib.sha256(norm.encode("utf-8")).hexdigest()


# ===== 1. Traduções determinísticas (sem API) =====

_TALENT_TOKENS: dict[str, dict[str, str]] = {
    "pt": {
        "Normal Attack": "Ataque Normal",
        "Normal": "Ataque Normal",
        "NA": "Ataque Normal",
        "Elemental Skill": "Habilidade Elemental",
        "Skill": "Habilidade",
        "Elemental Burst": "Supremo",
        "Burst": "Supremo",
        "Character Level": "Nível do Personagem",
        "Character": "Nível",
        "Level": "Nível",
        "Lv": "Nível",
    },
    "es": {
        "Normal Attack": "Ataque Normal",
        "Normal": "Ataque Normal",
        "NA": "Ataque Normal",
        "Elemental Skill": "Habilidad Elemental",
        "Skill": "Habilidad",
        "Elemental Burst": "Definitiva",
        "Burst": "Definitiva",
        "Character Level": "Nivel del Personaje",
        "Character": "Nivel",
        "Level": "Nivel",
        "Lv": "Nivel",
    },
}

_BUILD_LABEL_MAP: dict[str, dict[str, str]] = {
    "pt": {
        "teammate": "Aliado",
        "notable teammate": "Aliado Notável",
        "healer": "Curandeiro",
        "healers": "Curandeiros",
        "shielder": "Escudo",
        "shielders": "Escudos",
        "shield": "Escudo",
        "buffer": "Buffer",
        "buffers": "Buffers",
        "battery": "Bateria",
        "support": "Suporte",
        "supports": "Suportes",
        "other supports": "Outros Suportes",
        "defensive utility": "Utilidade Defensiva",
        "offensive utility": "Utilidade Ofensiva",
        "defensive options": "Opções Defensivas",
        "sub-dps": "Sub-DPS",
        "off-field dps": "DPS Fora de Campo",
        "on-field dps": "DPS em Campo",
        "main dps": "Main DPS",
        "dps": "DPS",
        "driver": "Driver",
        "flex": "Flex",
        "grouter": "Agrupador",
        "grouper": "Agrupador",
        "crowd control": "Controle de Grupo",
        "hydro applier": "Aplicador Hydro",
        "hydro appliers": "Aplicadores Hydro",
        "pyro applier": "Aplicador Pyro",
        "pyro appliers": "Aplicadores Pyro",
        "cryo applier": "Aplicador Cryo",
        "cryo appliers": "Aplicadores Cryo",
        "electro applier": "Aplicador Electro",
        "electro appliers": "Aplicadores Electro",
        "dendro applier": "Aplicador Dendro",
        "dendro appliers": "Aplicadores Dendro",
        "anemo support": "Suporte Anemo",
        "anemo supports": "Suportes Anemo",
        "geo support": "Suporte Geo",
        "geo supports": "Suportes Geo",
        "hydro support": "Suporte Hydro",
        "pyro support": "Suporte Pyro",
        "cryo support": "Suporte Cryo",
        "electro support": "Suporte Electro",
        "dendro support": "Suporte Dendro",
        "anemo shredder": "Redutor RES Anemo",
        "res shred": "Redução de RES",
    },
    "es": {
        "teammate": "Aliado",
        "notable teammate": "Aliado Destacado",
        "healer": "Sanador",
        "healers": "Sanadores",
        "shielder": "Escudo",
        "shielders": "Escudos",
        "shield": "Escudo",
        "battery": "Batería",
        "support": "Soporte",
        "supports": "Soportes",
        "other supports": "Otros Soportes",
        "defensive utility": "Utilidad Defensiva",
        "offensive utility": "Utilidad Ofensiva",
        "off-field dps": "DPS Fuera de Campo",
        "on-field dps": "DPS en Campo",
        "hydro applier": "Aplicador Hydro",
        "hydro appliers": "Aplicadores Hydro",
        "pyro applier": "Aplicador Pyro",
        "pyro appliers": "Aplicadores Pyro",
        "cryo applier": "Aplicador Cryo",
        "cryo appliers": "Aplicadores Cryo",
        "electro applier": "Aplicador Electro",
        "electro appliers": "Aplicadores Electro",
        "dendro applier": "Aplicador Dendro",
        "dendro appliers": "Aplicadores Dendro",
    },
}


def translate_talent_priority(raw: str | None, lang: Language) -> str | None:
    if not raw or lang == Language.EN:
        return raw
    tokens = _TALENT_TOKENS.get(lang.value)
    if not tokens:
        return raw
    ordered = sorted(tokens.keys(), key=len, reverse=True)
    pattern = re.compile(r"\b(" + "|".join(re.escape(k) for k in ordered) + r")\b")
    return pattern.sub(lambda m: tokens[m.group(1)], raw)


def translate_build_label(raw: str | None, lang: Language) -> str | None:
    if not raw or lang == Language.EN:
        return raw
    mapping = _BUILD_LABEL_MAP.get(lang.value)
    if not mapping:
        return raw
    key = normalize_source_text(raw).lower()
    if key in mapping:
        return mapping[key]
    return raw


# ===== 2. Cache persistente `text_translations` =====

def fetch_translations_map(
    db: Session,
    texts: Iterable[str | None],
    lang: Language,
) -> dict[str, str]:
    """Busca traduções no cache para um conjunto de textos em 1 query SQL.

    Retorna `{source_hash: translated_text}`.
    """
    if lang == Language.EN:
        return {}

    hashes = {
        text_hash(t)
        for t in texts
        if t and normalize_source_text(t)
    }
    if not hashes:
        return {}

    try:
        rows = (
            db.query(TextTranslation.source_hash, TextTranslation.translated_text)
            .filter(
                TextTranslation.target_lang == lang.value,
                TextTranslation.source_hash.in_(list(hashes)),
            )
            .all()
        )
        return {h: tr for h, tr in rows if tr}
    except Exception:
        # Se a tabela ainda não existir (ex.: DB de teste SQLite antigo), degrada graciosamente
        return {}


def _lookup(text: str | None, trans_map: dict[str, str]) -> str | None:
    if not text:
        return text
    h = text_hash(text)
    return trans_map.get(h, text)


def collect_build_data_texts(build_data: dict[str, Any] | None) -> list[str]:
    if not isinstance(build_data, dict):
        return []
    out: list[str] = []
    if build_data.get("notes"):
        out.append(build_data["notes"])
    for key in ("weapons", "artifacts_4pc", "artifacts_2pc"):
        for item in build_data.get(key) or []:
            if isinstance(item, dict) and item.get("notes"):
                out.append(item["notes"])
    return out


def collect_substitutes_texts(subs: list[dict[str, Any]] | None) -> list[str]:
    if not isinstance(subs, list):
        return []
    out: list[str] = []
    for item in subs:
        if isinstance(item, dict):
            if item.get("notes"):
                out.append(item["notes"])
            if item.get("build_label"):
                out.append(item["build_label"])
    return out


def apply_build_data_localization(
    build_data: dict[str, Any] | None,
    lang: Language,
    trans_map: dict[str, str],
) -> dict[str, Any] | None:
    if not isinstance(build_data, dict) or lang == Language.EN:
        return build_data

    bd = dict(build_data)
    if bd.get("talent_priority"):
        bd["talent_priority"] = translate_talent_priority(bd["talent_priority"], lang)
    if bd.get("notes"):
        bd["notes"] = _lookup(bd["notes"], trans_map)

    for key in ("weapons", "artifacts_4pc", "artifacts_2pc"):
        raw_list = bd.get(key)
        if isinstance(raw_list, list):
            new_list = []
            for item in raw_list:
                if isinstance(item, dict) and item.get("notes"):
                    copy_item = dict(item)
                    copy_item["notes"] = _lookup(item["notes"], trans_map)
                    new_list.append(copy_item)
                else:
                    new_list.append(item)
            bd[key] = new_list
    return bd


def apply_substitutes_localization(
    subs: list[dict[str, Any]] | None,
    lang: Language,
    trans_map: dict[str, str],
) -> list[dict[str, Any]]:
    if not isinstance(subs, list):
        return []
    if lang == Language.EN:
        return subs

    out: list[dict[str, Any]] = []
    for item in subs:
        if not isinstance(item, dict):
            continue
        copy_item = dict(item)
        if copy_item.get("build_label"):
            det = translate_build_label(copy_item["build_label"], lang)
            copy_item["build_label"] = trans_map.get(text_hash(copy_item["build_label"]), det)
        if copy_item.get("notes"):
            copy_item["notes"] = _lookup(copy_item["notes"], trans_map)
        out.append(copy_item)
    return out


def localize_build_data_batch(
    db: Session,
    build_datas: list[dict[str, Any] | None],
    lang: Language,
) -> list[dict[str, Any] | None]:
    if lang == Language.EN or not build_datas:
        return build_datas
    texts: list[str] = []
    for bd in build_datas:
        texts.extend(collect_build_data_texts(bd))
    trans_map = fetch_translations_map(db, texts, lang)
    return [apply_build_data_localization(bd, lang, trans_map) for bd in build_datas]


def localize_texts_batch(
    db: Session,
    texts: list[str | None],
    lang: Language,
) -> list[str | None]:
    if lang == Language.EN or not texts:
        return texts
    trans_map = fetch_translations_map(db, texts, lang)
    return [_lookup(t, trans_map) for t in texts]
