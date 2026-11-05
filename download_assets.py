import os, json, time, urllib.request
from PIL import Image
from io import BytesIO
from concurrent.futures import ThreadPoolExecutor

OUT_DIR = "frontend/public/icons"
os.makedirs(OUT_DIR, exist_ok=True)

with open('frontend/public/planner-data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

icons_to_download = {}
def extract_icons(raw_data, is_char=False):
    iterable = raw_data.values() if isinstance(raw_data, dict) else raw_data
    for item in iterable:
        if not isinstance(item, dict): continue
        if item.get('icon'):
            folder = 'reliquary' if item['icon'].startswith('UI_RelicIcon') else ''
            icons_to_download[item['icon']] = folder
        if is_char:
            for t in item.get('talents', []):
                if t.get('icon'): icons_to_download[t['icon']] = ''

extract_icons(data.get('characters', {}), is_char=True)
extract_icons(data.get('weapons', {}))
extract_icons(data.get('materials', {}))

def download(item):
    icon_name, subfolder = item
    filepath = os.path.join(OUT_DIR, f"{icon_name}.webp")
    if os.path.exists(filepath): return "skip"
    
    folder_path = f"{subfolder}/" if subfolder else ""
    url = f"https://gi.yatta.moe/assets/UI/{folder_path}{icon_name}.png"
    
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=15) as resp:
            img_data = resp.read()
        img = Image.open(BytesIO(img_data))
        img.save(filepath, "WEBP", quality=85)
        time.sleep(0.1)
        return "ok"
    except Exception as e:
        # MOSTRANDO O ERRO REAL
        print(f"[{icon_name}] Falhou: {e}", flush=True)
        return f"erro ({icon_name})"

print("Baixando... (vai mostrar o erro dos 300 que falharam)", flush=True)
with ThreadPoolExecutor(max_workers=5) as executor:
    list(executor.map(download, icons_to_download.items()))
