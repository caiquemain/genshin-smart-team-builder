import json
import urllib.request
import time

FILE_PATH = 'frontend/public/bestiary-data.json'

print("Lendo bestiary-data.json...", flush=True)
with open(FILE_PATH, 'r', encoding='utf-8') as f:
    data = json.load(f)

print(f"Traduzindo {len(data)} monstros...", flush=True)
for mid, monster in data.items():
    url = f"https://gi.yatta.moe/api/v2/pt/monster/{mid}?vh=37F4"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as resp:
            api_data = json.loads(resp.read())
            
            # A API de monstro individual retorna o nome direto em 'data'
            pt_name = api_data.get('data', {}).get('name')
            if pt_name:
                monster['name'] = pt_name
                print(f"[{mid}] → {pt_name}", flush=True)
        time.sleep(0.1)
    except Exception as e:
        print(f"Erro no {mid}: {e}", flush=True)

with open(FILE_PATH, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print("Concluído!", flush=True)
