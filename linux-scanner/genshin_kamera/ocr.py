"""Pré-processamento de imagem e wrapper Tesseract OCR (EN / PT)."""
from typing import Optional

import numpy as np
from PIL import Image, ImageEnhance, ImageOps


def crop_dark_badge(img: Image.Image, dark_thresh: int = 120) -> Image.Image:
    """Recorta apenas o interior da pílula escura (ex.: badge '+20' do artefato).

    Evita que a borda bege clara do card vire uma moldura preta grossa após `invert=True`,
    o que faria o Tesseract ignorar o texto interno.
    """
    gray = img.convert("L")
    arr = np.asarray(gray)
    ys, xs = np.where(arr < dark_thresh)
    if xs.size < 20 or ys.size < 20:
        return gray
    x0 = int(xs.min())
    x1 = int(xs.max()) + 1
    y0 = int(ys.min())
    y1 = int(ys.max()) + 1
    # Remove 1px de borda anti-aliased se houver espaço suficiente
    if (x1 - x0) > 10 and (y1 - y0) > 8:
        x0 += 1
        x1 -= 1
        y0 += 1
        y1 -= 1
    return gray.crop((x0, y0, x1, y1))


def preprocess_for_ocr(
    img: Image.Image,
    invert: bool = False,
    scale: int = 2,
    contrast: float = 1.6,
    threshold: Optional[int] = None,
    badge: bool = False,
    pad: int = 12,
) -> Image.Image:
    """Prepara recortes da UI do Genshin para máxima precisão do Tesseract."""
    if badge:
        gray = crop_dark_badge(img)
        scale = max(scale, 3)
        invert = True
        if threshold is None:
            threshold = 140
    else:
        gray = img.convert("L")

    if scale > 1:
        gray = gray.resize((gray.width * scale, gray.height * scale), Image.Resampling.BICUBIC)
    if invert:
        gray = ImageOps.invert(gray)
    gray = ImageOps.autocontrast(gray, cutoff=1)
    if contrast != 1.0:
        gray = ImageEnhance.Contrast(gray).enhance(contrast)
    if threshold is not None:
        arr = np.array(gray)
        arr = np.where(arr > threshold, 255, 0).astype(np.uint8)
        gray = Image.fromarray(arr)
    if pad > 0:
        gray = ImageOps.expand(gray, border=pad, fill=255)
    return gray


def average_rgb(img: Image.Image) -> tuple[int, int, int]:
    arr = np.asarray(img.convert("RGB"), dtype=np.float32)
    mean = arr.mean(axis=(0, 1))
    return (int(round(mean[0])), int(round(mean[1])), int(round(mean[2])))


def read_text(
    img: Image.Image,
    lang: str = "eng",
    psm: int = 6,
    invert: bool = False,
    whitelist: Optional[str] = None,
    badge: bool = False,
) -> str:
    """Executa Tesseract OCR em um recorte pré-processado."""
    import pytesseract

    prep = preprocess_for_ocr(img, invert=invert, badge=badge)
    psm_candidates = (psm, 8, 6) if badge else (psm,)
    for p in psm_candidates:
        cfg = f"--oem 3 --psm {p}"
        if whitelist:
            cfg += f" -c tessedit_char_whitelist={whitelist}"
        text = pytesseract.image_to_string(prep, lang=lang, config=cfg).strip()
        if text:
            return text
    return ""
