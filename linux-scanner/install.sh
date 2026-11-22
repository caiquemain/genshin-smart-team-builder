#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "=== Instalador do Genshin Kamera Linux ==="

# 1. Verifica dependências de sistema (tesseract + xdotool / ydotool)
missing=()
command -v tesseract >/dev/null 2>&1 || missing+=("tesseract-ocr tesseract-ocr-eng tesseract-ocr-por")

if [ "${XDG_SESSION_TYPE:-x11}" = "wayland" ]; then
  command -v grim >/dev/null 2>&1 || missing+=("grim")
  command -v ydotool >/dev/null 2>&1 || missing+=("ydotool")
else
  command -v xdotool >/dev/null 2>&1 || missing+=("xdotool")
fi

if [ ${#missing[@]} -gt 0 ]; then
  echo ""
  echo "[AVISO] Dependências de sistema faltando:"
  for m in "${missing[@]}"; do
    echo "  - $m"
  done
  echo ""
  echo "Instale no Ubuntu/Debian com:"
  echo "  sudo apt update && sudo apt install -y tesseract-ocr tesseract-ocr-eng tesseract-ocr-por xdotool"
  echo "(No Arch: sudo pacman -S tesseract tesseract-data-eng tesseract-data-por xdotool)"
  echo "(No Fedora: sudo dnf install tesseract tesseract-langpack-eng tesseract-langpack-por xdotool)"
  echo ""
fi

# 2. Cria virtualenv local e instala o pacote
if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi

.venv/bin/pip install --upgrade pip >/dev/null
.venv/bin/pip install -e ".[dev]"

echo ""
echo "Pronto! Para testar a calibração com o Genshin aberto (janela 16:9):"
echo "  .venv/bin/genshin-kamera --calibrate"
echo ""
echo "Para escanear artefatos 5★ e armas 4★+:"
echo "  .venv/bin/genshin-kamera --artifacts --weapons --lang en"
