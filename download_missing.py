import os, json, urllib.request
from PIL import Image
from io import BytesIO

OUT_DIR = "frontend/public/icons"
os.makedirs(OUT_DIR, exist_ok=True)

icons = set()

# 1. Pega os artefatos
print("Buscando artefatos...", flush=True)
try:
    with urllib.request.urlopen("http://localhost:8000/artifacts?limit=100", timeout=10) as r:
        arts = json.loads(r.read())['items']
        for a in arts:
            if a.get('icon'): icons.add(a['icon'])
except Exception as e:
    print("Erro nos artefatos:", e)

# 2. Pega os personagens e talentos
print("Buscando personagens e talentos...", flush=True)
try:
    with urllib.request.urlopen("http://localhost:8000/characters?limit=200", timeout=10) as r:
        chars = json.loads(r.read())['items']
        for c in chars:
            if c.get('icon'): icons.add(c['icon'])
            with urllib.request.urlopen(f"http://localhost:8000/characters/{c['slug']}?lang=pt", timeout=10) as tr:
                detail = json.loads(tr.read())
                for t in detail.get('talents', []):
                    if t.get('icon'): icons.add(t['icon'])
except Exception as e:
    print("Erro nos chars:", e)

# 3. Baixa
print(f"Total de imagens para verificar: {len(icons)}", flush=True)
for icon in icons:
    filepath = os.path.join(OUT_DIR, f"{icon}.webp")
    if os.path.exists(filepath): continue
    
    folder = 'reliquary/' if icon.startswith('UI_RelicIcon') else ''
    url = f"https://gi.yatta.moe/assets/UI/{folder}{icon}.png"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as resp:
            img = Image.open(BytesIO(resp.read()))
            img.save(filepath, "WEBP")
        print(f"Baixado: {icon}", flush=True)
    except Exception as e:
        print(f"Falhou: {icon} - {e}", flush=True)
