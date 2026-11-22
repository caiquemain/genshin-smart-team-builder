"""Pré-processamento de imagem e wrapper Tesseract OCR (EN / PT)."""
from typing import Optional

import numpy as np
from PIL import Image, ImageEnhance, ImageOps


def preprocess_for_ocr(
    img: Image.Image,
    invert: bool = False,
    scale: int = 2,
    contrast: float = 1.6,
    threshold: Optional[int] = None,
) -> Image.Image:
    """Prepara recortes da UI do Genshin para máxima precisão do Tesseract."""
    gray = img.convert("L")
    if scale > 1:
        gray = gray.resize((gray.width * scale, gray.height * scale), Image.Resampling.BICUBIC)
    if invert:
        gray = ImageOps.invert(gray)
    if contrast != 1.0:
        gray = ImageEnhance.Contrast(gray).enhance(contrast)
    if threshold is not None:
        arr = np.array(gray)
        arr = np.where(arr > threshold, 255, 0).astype(np.uint8)
        gray = Image.fromarray(arr)
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
) -> str:
    """Executa Tesseract OCR em um recorte pré-processado."""
    import pytesseract

    prep = preprocess_for_ocr(img, invert=invert)
    cfg = f"--oem 3 --psm {psm}"
    if whitelist:
        cfg += f" -c tessedit_char_whitelist={whitelist}"
    text = pytesseract.image_to_string(prep, lang=lang, config=cfg)
    return text.strip()
