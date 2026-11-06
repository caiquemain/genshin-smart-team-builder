import json
import urllib.request
import os
import time
from PIL import Image
from io import BytesIO

API = "http://localhost:8000"
OUT_DIR = "frontend/public/icons"
os.makedirs(OUT_DIR, exist_ok=True)

print("Buscando lista de personagens...", flush=True)
with urllib.request.urlopen(f"{API}/characters?limit=200", timeout=15) as r:
    chars = json.loads(r.read())['items']

print(f"Total: {len(chars)} personagens", flush=True)

all_icons = set()

for i, c in enumerate(chars):
    slug = c['slug']
    try:
        with urllib.request.urlopen(f"{API}/characters/{slug}?lang=pt", timeout=10) as r:
            detail = json.loads(r.read())
        
        for cons in detail.get('constellations', []):
            if cons.get('icon'): all_icons.add(cons['icon'])
        
        for passive in detail.get('passives', []):
            if passive.get('icon'): all_icons.add(passive['icon'])
        
        if (i + 1) % 20 == 0:
            print(f"  Processados {i + 1}/{len(chars)}...", flush=True)
        time.sleep(0.05)
    except Exception as e:
        print(f"Erro em {slug}: {e}", flush=True)

print(f"\nTotal de ícones únicos: {len(all_icons)}", flush=True)

def download(icon_name):
    filepath = os.path.join(OUT_DIR, f"{icon_name}.webp")
    if os.path.exists(filepath): return "skip"
    
    url = f"https://gi.yatta.moe/assets/UI/{icon_name}.png"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as resp:
            img = Image.open(BytesIO(resp.read()))
            img.save(filepath, "WEBP", quality=85)
        return "ok"
    except Exception:
        return f"fail: {icon_name}"

from concurrent.futures import ThreadPoolExecutor

print("Baixando em paralelo (5 threads)...", flush=True)
sucessos, falhas, pulados = 0, 0, 0
def run(icon):
    global sucessos, falhas, pulados
    res = download(icon)
    if res == "ok":
        sucessos += 1
        if sucessos % 100 == 0: print(f"  {sucessos} baixados...", flush=True)
    elif res == "skip":
        pulados += 1
    else:
        falhas += 1
        print(f"  {res}", flush=True)

with ThreadPoolExecutor(max_workers=5) as ex:
    list(ex.map(run, all_icons))

print(f"\n✅ Concluído! {sucessos} baixados, {pulados} já existiam, {falhas} falharam.", flush=True)
