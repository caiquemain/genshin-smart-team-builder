"""Catálogo de nomes (EN/PT -> chave GOOD PascalCase) sincronizado com o projeto.

Carrega automaticamente:
1. `frontend/public/planner-data.json` (personagens, armas e materiais atualizados até 7.x!)
2. API local do backend (`http://localhost:8000/api/artifacts`, `/characters`, `/weapons`) se estiver rodando
3. Fallback embutido dos sets de artefatos e peças mais comuns.
"""
from dataclasses import dataclass, field
import difflib
import json
from pathlib import Path
import re
from typing import Optional
from urllib.request import urlopen


def to_good_key(name: str) -> str:
    """Converte um nome em inglês (ou slug) para chave PascalCase padrão GOOD.

    Ex.:
      "Marechaussee Hunter" -> "MarechausseeHunter"
      "Hero's Wit" -> "HerosWit"
      "kaedehara-kazuha" -> "KaedeharaKazuha"
      "Scroll of the Hero of Cinder City" -> "ScrollOfTheHeroOfCinderCity"
    """
    cleaned = name.replace("'", "").replace("’", "").replace('"', "")
    tokens = re.split(r"[^A-Za-z0-9]+", cleaned)
    return "".join(t[:1].upper() + t[1:] for t in tokens if t)


def norm_text(s: str) -> str:
    s = (s or "").lower()
    # Remove acentos comuns PT para melhorar fuzzy matching do OCR
    trans = str.maketrans("áàâãéêíóôõúç", "aaaaeeiooouc")
    s = s.translate(trans)
    return re.sub(r"[^a-z0-9]+", "", s)


# Mapeamento embutido de sets 5★ (EN + PT -> chave GOOD PascalCase)
BUILTIN_ARTIFACT_SETS: dict[str, tuple[str, ...]] = {
    "GladiatorsFinale": ("Gladiator's Finale", "Último Juramento do Gladiador"),
    "WanderersTroupe": ("Wanderer's Troupe", "Trupe Itinerante"),
    "ViridescentVenerer": ("Viridescent Venerer", "Sombra Verde"),
    "MaidenBeloved": ("Maiden Beloved", "Donzela Amada"),
    "ThunderingFury": ("Thundering Fury", "Trovão Furioso"),
    "Thundersoother": ("Thundersoother", "Lançador de Trovões"),
    "BlizzardStrayer": ("Blizzard Strayer", "Herói Invernal"),
    "HeartOfDepth": ("Heart of Depth", "Profundezas do Coração"),
    "CrimsonWitchOfFlames": ("Crimson Witch of Flames", "A Bruxa das Chamas Carmesim"),
    "Lavawalker": ("Lavawalker", "Atravessador do Fogo"),
    "NoblesseOblige": ("Noblesse Oblige", "Antigo Ritual Real"),
    "BloodstainedChivalry": ("Bloodstained Chivalry", "Cavaleiro Manchado de Sangue"),
    "ArchaicPetra": ("Archaic Petra", "Pedra Arcaica"),
    "RetracingBolide": ("Retracing Bolide", "Meteoro Invertido"),
    "TenacityOfTheMillelith": ("Tenacity of the Millelith", "Millelith Firmes"),
    "PaleFlame": ("Pale Flame", "Chama Pálida"),
    "EmblemOfSeveredFate": ("Emblem of Severed Fate", "Selo da Insulação"),
    "ShimenawasReminiscence": ("Shimenawa's Reminiscence", "Reminiscência Nostálgica"),
    "HuskOfOpulentDreams": ("Husk of Opulent Dreams", "Casca de Sonhos Opulentos"),
    "OceanHuedClam": ("Ocean-Hued Clam", "Concha Tingida pelo Mar"),
    "VermillionHereafter": ("Vermillion Hereafter", "Além-vida Cinábrio"),
    "EchoesOfAnOffering": ("Echoes of an Offering", "Eco do Sacrifício"),
    "DeepwoodMemories": ("Deepwood Memories", "Memórias da Floresta"),
    "GildedDreams": ("Gilded Dreams", "Sonhos Dourados"),
    "DesertPavilionChronicle": ("Desert Pavilion Chronicle", "Crônicas do Pavilhão do Deserto"),
    "FlowerOfParadiseLost": ("Flower of Paradise Lost", "Flor do Paraíso Perdido"),
    "NymphsDream": ("Nymph's Dream", "Sonho da Ninfa"),
    "VourukashasGlow": ("Vourukasha's Glow", "Brilho Vourukasha"),
    "MarechausseeHunter": ("Marechaussee Hunter", "Caçador das Sombras"),
    "GoldenTroupe": ("Golden Troupe", "Trupe Dourada"),
    "SongOfDaysPast": ("Song of Days Past", "Canção do Passado"),
    "NighttimeWhispersInTheEchoingWoods": (
        "Nighttime Whispers in the Echoing Woods",
        "Sussurros Noturnos na Floresta Ecoante",
    ),
    "FragmentOfHarmonicWhimsy": ("Fragment of Harmonic Whimsy", "Fragmento da Harmonia Fantástica"),
    "UnfinishedReverie": ("Unfinished Reverie", "Devaneio Inacabado"),
    "ScrollOfTheHeroOfCinderCity": (
        "Scroll of the Hero of Cinder City",
        "Pergaminho do Herói da Cidade das Cinzas",
    ),
    "ObsidianCodex": ("Obsidian Codex", "Códice de Obsidiana"),
    "LongNightsOath": ("Long Night's Oath", "Juramento da Noite Longa"),
    "FinaleOfTheDeepGalleries": ("Finale of the Deep Galleries", "Final das Galerias Profundas"),
}


@dataclass
class GameCatalog:
    """Índice de busca fuzzy (texto OCR EN/PT -> chave GOOD PascalCase)."""

    characters: dict[str, str] = field(default_factory=dict)
    weapons: dict[str, str] = field(default_factory=dict)
    artifact_sets: dict[str, str] = field(default_factory=dict)
    artifact_pieces: dict[str, str] = field(default_factory=dict)  # piece name -> set GOOD key
    materials: dict[str, str] = field(default_factory=dict)

    def _register(self, target: dict[str, str], label: str, good_key: str) -> None:
        nk = norm_text(label)
        if nk:
            target[nk] = good_key

    def register_builtin_defaults(self) -> None:
        for gkey, names in BUILTIN_ARTIFACT_SETS.items():
            self._register(self.artifact_sets, gkey, gkey)
            for n in names:
                self._register(self.artifact_sets, n, gkey)

        for mat_en, mat_pt, gkey in [
            ("Mora", "Mora", "Mora"),
            ("Hero's Wit", "EXP do Herói", "HerosWit"),
            ("Adventurer's Experience", "EXP do Aventureiro", "AdventurersExperience"),
            ("Wanderer's Advice", "Conselho do Andarilho", "WanderersAdvice"),
            ("Crown of Insight", "Coroa da Sabedoria", "CrownOfInsight"),
            ("Dream Solvent", "Solvente dos Sonhos", "DreamSolvent"),
            ("Mystic Enhancement Ore", "Minério de Refinamento Místico", "MysticEnhancementOre"),
            ("Fine Enhancement Ore", "Minério de Refinamento Fino", "FineEnhancementOre"),
        ]:
            self._register(self.materials, mat_en, gkey)
            self._register(self.materials, mat_pt, gkey)

    def load_planner_data_json(self, json_path: Path) -> bool:
        if not json_path.is_file():
            return False
        try:
            data = json.loads(json_path.read_text(encoding="utf-8"))
        except Exception:
            return False

        for slug, c in (data.get("characters") or {}).items():
            names = c.get("name") or {}
            en = names.get("en") or slug
            gkey = to_good_key(en)
            self._register(self.characters, slug, gkey)
            for val in names.values():
                if val:
                    self._register(self.characters, val, gkey)

        for slug, w in (data.get("weapons") or {}).items():
            names = w.get("name") or {}
            en = names.get("en") or slug
            gkey = to_good_key(en)
            self._register(self.weapons, slug, gkey)
            for val in names.values():
                if val:
                    self._register(self.weapons, val, gkey)

        for slug, m in (data.get("materials") or {}).items():
            names = m.get("name") or {}
            en = names.get("en") or slug
            gkey = to_good_key(en)
            self._register(self.materials, slug, gkey)
            for val in names.values():
                if val:
                    self._register(self.materials, val, gkey)

        return True

    def load_from_local_api(self, base_url: str = "http://localhost:8000/api") -> bool:
        """Opcionalmente enriquece o catálogo com sets e peças de artefatos da API local."""
        loaded_any = False
        for lang in ("en", "pt"):
            try:
                with urlopen(f"{base_url}/artifacts?lang={lang}&limit=200", timeout=2.5) as resp:
                    payload = json.loads(resp.read().decode("utf-8"))
                for item in payload.get("items") or []:
                    slug = item.get("slug")
                    name = item.get("name")
                    if not slug:
                        continue
                    gkey = to_good_key(slug)
                    self._register(self.artifact_sets, slug, gkey)
                    if name:
                        self._register(self.artifact_sets, name, gkey)
                loaded_any = True
            except Exception:
                pass
        return loaded_any

    def match(self, category: str, raw_ocr: str, cutoff: float = 0.68) -> Optional[str]:
        table: dict[str, str] = getattr(self, category, {})
        nk = norm_text(raw_ocr)
        if not nk or not table:
            return None
        if nk in table:
            return table[nk]
        # Substring exata (útil quando OCR anexa ruído no começo/fim)
        for k, v in table.items():
            if len(k) >= 5 and (k in nk or nk in k):
                return v
        matches = difflib.get_close_matches(nk, table.keys(), n=1, cutoff=cutoff)
        if matches:
            return table[matches[0]]
        return None


def load_default_catalog(api_url: Optional[str] = "http://localhost:8000/api") -> GameCatalog:
    cat = GameCatalog()
    cat.register_builtin_defaults()

    # Procura `frontend/public/planner-data.json` relativo ao repositório
    here = Path(__file__).resolve()
    candidates = [
        here.parents[2] / "frontend" / "public" / "planner-data.json",
        Path.cwd() / "frontend" / "public" / "planner-data.json",
        Path.cwd().parent / "frontend" / "public" / "planner-data.json",
    ]
    for p in candidates:
        if cat.load_planner_data_json(p):
            break

    if api_url:
        cat.load_from_local_api(api_url)

    return cat
