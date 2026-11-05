import urllib.request
from PIL import Image
from io import BytesIO
import os

OUT_DIR = "frontend/public/icons"
os.makedirs(OUT_DIR, exist_ok=True)

# Lista de ícones de talentos conhecidos
icons = ["Skill_A_01", "Skill_E_SkirkNew_01", "Skill_S_SkirkNew_01"]

for icon in icons:
    filepath = os.path.join(OUT_DIR, f"{icon}.webp")
    if os.path.exists(filepath): continue
    url = f"https://gi.yatta.moe/assets/UI/{icon}.png"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as resp:
            img = Image.open(BytesIO(resp.read()))
            img.save(filepath, "WEBP")
        print(f"Baixado: {icon}")
    except Exception as e:
        print(f"Falhou: {icon} - {e}")
