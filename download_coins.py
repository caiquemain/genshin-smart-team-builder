import urllib.request
from PIL import Image
from io import BytesIO
import os

OUT_DIR = "frontend/public/icons"
os.makedirs(OUT_DIR, exist_ok=True)

# Ícones hardcoded no código que não estavam no JSON
icons = [
    "UI_ItemIcon_202",      # Mora
    "UI_ItemIcon_104003",   # Experiência do Herói (Hero's Wit)
    "UI_ItemIcon_104012",   # Minério Místico (Mystic Ore)
    "UI_ItemIcon_104011",   # Minério de Refinamento (Mystic Enhancement Ore)
    "UI_ItemIcon_104002",   # Aventura (Adventurer's Experience)
    "UI_ItemIcon_104001",   # Andarilho (Wanderer's Advice)
]

for icon in icons:
    filepath = os.path.join(OUT_DIR, f"{icon}.webp")
    if os.path.exists(filepath): 
        print(f"Já existe: {icon}")
        continue
    url = f"https://gi.yatta.moe/assets/UI/{icon}.png"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as resp:
            img = Image.open(BytesIO(resp.read()))
            img.save(filepath, "WEBP", quality=85)
        print(f"Baixado: {icon}")
    except Exception as e:
        print(f"Falhou: {icon} - {e}")
