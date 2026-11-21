#!/usr/bin/env python3
"""
generate_character_stats.py — Baixa stats base/curvas/promoções do dvaJi/genshin-data
e calcula HP/ATK/DEF/Substat em cada nível de ascensão (1, 20, 40, 50, 60, 70, 80, 90).
Gera frontend/public/character-stats.json.
"""
import json
import urllib.request
import os
from pathlib import Path

RAW = "https://raw.githubusercontent.com/dvaJi/genshin-data/master"
OUT = Path("frontend/public/character-stats.json")

CURVES = None

def fetch_json(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read())

def load_curves():
    global CURVES
    print("Baixando curvas de crescimento...", flush=True)
    CURVES = fetch_json(f"{RAW}/src/shared/curves.json")["avatar"]
    # Mapeia nível -> {curve_type: multiplicador}
    return {entry["level"]: {ci["type"]: ci["value"] for ci in entry["curveInfos"]} for entry in CURVES}

def get_characters():
    print("Listando personagens...", flush=True)
    # Lista os arquivos do diretório
    api_url = "https://api.github.com/repos/dvaJi/genshin-data/contents/src/data/english/characters"
    req = urllib.request.Request(api_url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=20) as r:
        files = json.loads(r.read())
    return [f["name"] for f in files if f["name"].endswith(".json")]

FLAT_PROPS = {"FIGHT_PROP_ELEMENT_MASTERY"}
FLAT_SUBSTAT_NAMES = {"elemental mastery", "em"}


def compute_stats(char_data, curve_map):
    stats = char_data.get("stats", {})
    base = stats.get("base", {})
    curves = stats.get("curves", {})
    promotions = {p["level"]: p for p in stats.get("promotion", [])}
    substat = char_data.get("substat")  # ex: "CRIT DMG", "Elemental Mastery"

    result = {}
    for level in [1, 20, 40, 50, 60, 70, 80, 90]:
        mults = curve_map.get(level, {})
        promo = promotions.get(level, {"hp": 0, "attack": 0, "defense": 0, "specialized": None})

        hp_mult = mults.get(curves.get("hp", ""), 1) if level > 1 else 1
        atk_mult = mults.get(curves.get("attack", ""), 1) if level > 1 else 1
        def_mult = mults.get(curves.get("defense", ""), 1) if level > 1 else 1

        hp = base.get("hp", 0) * hp_mult + promo.get("hp", 0)
        atk = base.get("attack", 0) * atk_mult + promo.get("attack", 0)
        df = base.get("defense", 0) * def_mult + promo.get("defense", 0)

        spec = promo.get("specialized")
        spec_val = spec.get("value", 0) if spec else 0
        prop_type = (spec.get("prop_type") or "") if spec else ""
        is_flat = (
            prop_type in FLAT_PROPS
            or (substat or "").strip().lower() in FLAT_SUBSTAT_NAMES
        )

        if not spec_val:
            formatted_substat = 0
        elif is_flat:
            formatted_substat = round(spec_val)
        else:
            formatted_substat = round(spec_val * 100, 1)

        result[level] = {
            "hp": round(hp),
            "atk": round(atk),
            "def": round(df),
            "substat": formatted_substat,
        }
    return {"substat_name": substat, "levels": result}

def main():
    curve_map = load_curves()
    files = get_characters()
    print(f"Total: {len(files)} personagens", flush=True)

    output = {}
    for i, fname in enumerate(files):
        slug = fname.replace(".json", "").replace("_", "-")
        try:
            char_data = fetch_json(f"{RAW}/src/data/english/characters/{fname}")
            output[slug] = compute_stats(char_data, curve_map)
            if (i + 1) % 20 == 0:
                print(f"  Processados {i + 1}/{len(files)}...", flush=True)
        except Exception as e:
            print(f"  ⚠️ Erro em {fname}: {e}", flush=True)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(output, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\n✅ Salvo em {OUT} ({len(output)} personagens)")

if __name__ == "__main__":
    main()
