"""
Exporta dados estáticos do Bestiário para JSON (consumido pelo frontend offline).
Fonte: API do Project Amber (Yatta).
"""
import json
import sys
import time
from pathlib import Path
import urllib.request
import urllib.error

API_BASE = "https://gi.yatta.moe/api/v2/en"
VH = "?vh=37F4"

# Caminhos relativos a partir da raiz do projeto (onde o script deve ser rodado)
OUTPUT_PATH = "frontend/public/bestiary-data.json"
PLANNER_DATA_PATH = "frontend/public/planner-data.json"

def fetch_json(url: str):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.loads(response.read().decode('utf-8'))

def load_planner_data():
    p = Path(PLANNER_DATA_PATH)
    if not p.exists():
        print(f"⚠️ {PLANNER_DATA_PATH} não encontrado.")
        print("   Certifique-se de rodar este script a partir da raiz do projeto.")
        return {}
    with open(p, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Cria um mapa: "Damaged Mask" (EN) -> "damaged-mask" (slug)
    name_to_slug = {}
    for slug, mat in data.get('materials', {}).items():
        en_name = mat.get('name', {}).get('en')
        if en_name:
            name_to_slug[en_name.lower()] = slug
    return name_to_slug

def main():
    # Garante que estamos na raiz do projeto
    if not Path("frontend/public").exists():
        print("❌ Pasta 'frontend/public' não encontrada. Rode a partir da raiz do projeto.")
        sys.exit(1)

    name_to_slug = load_planner_data()
    print("✓ Mapeamento de nomes do planner carregado.")

    print("⏳ Baixando lista de monstros...")
    monster_list = fetch_json(f"{API_BASE}/monster{VH}")
    # A API retorna um dicionário: data.items = { "21010101": {...}, ... }
    monsters_dict = monster_list.get('data', {}).get('items', {})
    
    # Filtra apenas monstros de combate (ignora animal, NPC, etc)
    skip_types = {"Animal", "NPC", "Quest", "Other"}
    monsters_to_fetch = [
        m for m in monsters_dict.values()
        if isinstance(m, dict) and m.get('type') not in skip_types
    ]
    print(f"✓ {len(monsters_to_fetch)} monstros encontrados na lista.")

    bestiary = {}
    for i, m in enumerate(monsters_to_fetch):
        mid = str(m['id'])
        mname = m['name']
        print(f"[{i+1}/{len(monsters_to_fetch)}] Buscando {mname} (ID: {mid})...")
        
        try:
            detail_resp = fetch_json(f"{API_BASE}/monster/{mid}{VH}")
            data = detail_resp.get('data', {})
            
            entries = data.get('entries', {})
            reward = None
            
            # Pega o reward da primeira entrada que tiver drops
            for entry_id, entry in entries.items():
                if entry.get('reward'):
                    reward = entry['reward']
                    break
            
            drops = []
            if reward:
                for drop_id, drop_info in reward.items():
                    if drop_id == "202": # Mora
                        continue
                    
                    item_name = drop_info.get('name', '')
                    drop_rate = drop_info.get('count', '0')
                    
                    # Tenta converter "0.42" para 42.0 (porcentagem)
                    try:
                        rate_val = float(drop_rate) * 100
                    except ValueError:
                        rate_val = None # Pode ser um range tipo "0.5-1.0"
                        
                    slug = name_to_slug.get(item_name.lower())
                    
                    drops.append({
                        "name": item_name,
                        "slug": slug,
                        "rarity": drop_info.get('rank', 0),
                        "rate": rate_val,
                        "rate_raw": drop_rate,
                        "icon": drop_info.get('icon', '')
                    })
            
            # Filtra drops órfãos (artefatos, billets, XP, itens não-materiais)
            # Só mantém drops que estão mapeados no planner-data.json
            drops = [d for d in drops if d.get('slug')]

            # Só adiciona monstros que efetivamente dropam algo útil
            if not drops:
                continue

            bestiary[mid] = {
                "id": mid,
                "name": mname,
                "type": m.get('type', ''),
                "icon": data.get('icon', ''),
                "description": data.get('description', ''),
                "drops": drops
            }
        except urllib.error.HTTPError as e:
            print(f"  ❌ Erro HTTP {e.code} ao buscar {mname}. Pulando.")
        except Exception as e:
            print(f"  ❌ Erro inesperado: {e}. Pulando.")
            
        # Pequeno delay para não sobrecarregar a API
        time.sleep(0.2)

    out_path = Path(OUTPUT_PATH)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(bestiary, f, ensure_ascii=False, separators=(',', ':'))

    print(f"\n✓ {len(bestiary)} monstros exportados para {OUTPUT_PATH} ({out_path.stat().st_size / 1024:.1f} KB)")

if __name__ == "__main__":
    main()
