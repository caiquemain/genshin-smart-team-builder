"""Loops de captura e varredura (Artefatos, Armas, Materiais, Personagens + Calibração)."""
from pathlib import Path
import time
from typing import Any, Optional

from PIL import Image, ImageDraw

from .backend_input import LinuxScreenBackend, ScanAbortedError
from .catalog import GameCatalog, norm_text, to_good_key
from .geometry import (
    EQUIPPED_BANNER_COLOR,
    SANCTIFIED_BANNER_COLOR,
    WindowGeometry,
    card_rect,
    char_level_rect,
    char_name_rect,
    char_next_arrow_point,
    compare_color,
    crop_artifact_level,
    crop_artifact_main_stat,
    crop_artifact_slot,
    crop_artifact_substats,
    crop_item_equipped,
    crop_item_locked,
    crop_item_name,
    crop_material_count,
    crop_sanctify_banner,
    crop_weapon_level,
    crop_weapon_refinement,
    detect_rarity_from_rgb,
    inventory_grid_centers,
    is_locked_rgb,
    item_count_rect,
)
from .ocr import average_rgb, read_text
from .parsers import (
    parse_artifact_level,
    parse_artifact_substats,
    parse_equipped_character,
    parse_item_count_header,
    parse_main_stat_key,
    parse_material_quantity,
    parse_refinement,
    parse_slot_key,
    parse_weapon_level_and_ascension,
)


def _tess_lang(lang: str) -> str:
    return "por+eng" if lang == "pt" else "eng"


def save_calibration_overlay(
    backend: LinuxScreenBackend,
    win: WindowGeometry,
    out_dir: Path,
    *,
    catalog: Optional[GameCatalog] = None,
    lang: str = "en",
) -> Path:
    """Captura a janela atual do Genshin, desenha as caixas de recorte e testa o OCR ao vivo."""
    import numpy as np

    out_dir.mkdir(parents=True, exist_ok=True)
    full_img = backend.grab_window(win)
    arr = np.asarray(full_img)
    mean_luma = float(arr.mean()) if arr.size else 0.0
    max_val = int(arr.max()) if arr.size else 0
    if max_val <= 2:
        print(
            "[AVISO] A captura veio TODA PRETA! No Ubuntu GNOME Wayland o `mss` (X11) "
            "pode ser bloqueado pelo compositor."
        )
        print("        Tente: genshin-kamera --calibrate --capture gnome-screenshot")
        print("        (ou instale `sudo apt install gnome-screenshot` / entre na sessão Ubuntu on Xorg).")
    else:
        print(f"[Calibração] Captura OK (brilho médio={mean_luma:.1f}, máx={max_val}).")

    overlay = full_img.copy()
    draw = ImageDraw.Draw(overlay)

    # 1. Card de detalhes à direita (verde)
    c_rect = card_rect(win)
    rel_card = (
        c_rect.x - win.x,
        c_rect.y - win.y,
        c_rect.right - win.x,
        c_rect.bottom - win.y,
    )
    draw.rectangle(rel_card, outline=(74, 222, 128), width=3)

    # 2. Contador de itens no topo direito (amarelo)
    cnt_rect = item_count_rect(win)
    rel_cnt = (cnt_rect.x - win.x, cnt_rect.y - win.y, cnt_rect.right - win.x, cnt_rect.bottom - win.y)
    draw.rectangle(rel_cnt, outline=(251, 191, 36), width=2)

    # 3. Pontos da grade 8×5 (azul claro)
    for px, py in inventory_grid_centers(win):
        rx, ry = px - win.x, py - win.y
        draw.ellipse((rx - 6, ry - 6, rx + 6, ry + 6), outline=(56, 189, 248), width=2)

    # 4. Salva recortes internos do card (com detecção de banner Elixir Santificador)
    card_img = full_img.crop(rel_card)
    cw, ch = card_img.size
    sanctify_img = card_img.crop(crop_sanctify_banner(cw, ch, win.is_16_9).as_crop_box())
    is_sanctified = compare_color(average_rgb(sanctify_img), SANCTIFIED_BANNER_COLOR, tolerance=45.0)
    for name, r in [
        ("01_name", crop_item_name(cw, ch, win.is_16_9)),
        ("02_slot", crop_artifact_slot(cw, ch, win.is_16_9)),
        ("03_main_stat", crop_artifact_main_stat(cw, ch, win.is_16_9)),
        ("04_level", crop_artifact_level(cw, ch, win.is_16_9, is_sanctified)),
        ("05_substats", crop_artifact_substats(cw, ch, win.is_16_9, is_sanctified)),
        ("06_equipped", crop_item_equipped(cw, ch, win.is_16_9)),
        ("07_locked", crop_item_locked(cw, ch, win.is_16_9, is_sanctified)),
    ]:
        card_img.crop(r.as_crop_box()).save(out_dir / f"{name}.png")
        draw.rectangle(
            (rel_card[0] + r.x, rel_card[1] + r.y, rel_card[0] + r.right, rel_card[1] + r.bottom),
            outline=(244, 114, 182),
            width=2,
        )

    out_file = out_dir / "calibration_overlay.png"
    overlay.save(out_file)

    # 5. Teste rápido de OCR se a imagem não veio preta
    if max_val > 2 and catalog is not None:
        tlang = _tess_lang(lang)
        cnt_txt = read_text(full_img.crop(rel_cnt), lang="eng", psm=7, invert=True)
        print(f"[Calibração OCR] Contador topo: {cnt_txt!r} -> {parse_item_count_header(cnt_txt)}")
        print(f"[Calibração OCR] Elixir Santificador detectado: {is_sanctified}")
        parsed = _parse_artifact_card(card_img, win.is_16_9, catalog, tlang)
        if parsed:
            print(f"[Calibração OCR] Artefato lido com sucesso: {parsed}")
        else:
            slot_raw = read_text(card_img.crop(crop_artifact_slot(cw, ch, win.is_16_9).as_crop_box()), lang=tlang, psm=7, invert=True)
            main_raw = read_text(card_img.crop(crop_artifact_main_stat(cw, ch, win.is_16_9).as_crop_box()), lang=tlang, psm=7, invert=True)
            lv_raw = read_text(
                card_img.crop(crop_artifact_level(cw, ch, win.is_16_9, is_sanctified).as_crop_box()),
                lang="eng",
                psm=7,
                badge=True,
                whitelist="+0123456789",
            )
            print(f"[Calibração OCR] Card atual não bateu como artefato (slot={slot_raw!r}, main={main_raw!r}, level={lv_raw!r}).")

    return out_file


def run_click_test(
    backend: LinuxScreenBackend,
    win: WindowGeometry,
    catalog: GameCatalog,
    *,
    lang: str = "en",
    click_delay: float = 0.16,
) -> bool:
    """Clica no 2º e depois no 1º artefato da grade e verifica se o card mudou."""
    tlang = _tess_lang(lang)
    grid = inventory_grid_centers(win, cols=8, rows=4)
    c_rect = card_rect(win)

    before = _parse_artifact_card(backend.grab_rect(c_rect), win.is_16_9, catalog, tlang)
    print(f"[Teste Clique] Antes: {before}")

    x2, y2 = grid[1]
    print(f"[Teste Clique] Clicando no 2º slot ({x2}, {y2})...")
    backend.move_and_click(x2, y2, delay=click_delay)
    after2 = _parse_artifact_card(backend.grab_rect(c_rect), win.is_16_9, catalog, tlang)
    print(f"[Teste Clique] Após clicar no 2º slot: {after2}")

    x1, y1 = grid[0]
    backend.move_and_click(x1, y1, delay=click_delay)

    changed = before != after2 and after2 is not None
    if changed:
        print("[Teste Clique] SUCESSO! O clique mudou o artefato selecionado e o OCR leu ambos.")
    else:
        print(
            "[Teste Clique] AVISO: o card não mudou após clicar. "
            "Se estiver em GNOME Wayland, instale/ative `ydotool` ou use `--input ydotool`."
        )
    return changed


def _parse_artifact_card(
    card: Image.Image,
    is_16_9: bool,
    catalog: GameCatalog,
    tlang: str,
) -> Optional[dict[str, Any]]:
    cw, ch = card.size
    name_img = card.crop(crop_item_name(cw, ch, is_16_9).as_crop_box())
    rarity = detect_rarity_from_rgb(average_rgb(name_img))

    # Detecta banner Sanctifying Elixir (desloca level, substats e lock para baixo)
    sanctify_img = card.crop(crop_sanctify_banner(cw, ch, is_16_9).as_crop_box())
    is_sanctified = compare_color(average_rgb(sanctify_img), SANCTIFIED_BANNER_COLOR, tolerance=45.0)

    slot_img = card.crop(crop_artifact_slot(cw, ch, is_16_9).as_crop_box())
    main_img = card.crop(crop_artifact_main_stat(cw, ch, is_16_9).as_crop_box())
    level_img = card.crop(crop_artifact_level(cw, ch, is_16_9, is_sanctified).as_crop_box())
    subs_img = card.crop(crop_artifact_substats(cw, ch, is_16_9, is_sanctified).as_crop_box())
    lock_img = card.crop(crop_item_locked(cw, ch, is_16_9, is_sanctified).as_crop_box())
    eq_img = card.crop(crop_item_equipped(cw, ch, is_16_9).as_crop_box())

    level = parse_artifact_level(
        read_text(level_img, lang="eng", psm=7, badge=True, whitelist="+0123456789")
    )
    if level < 0:
        return None

    slot_txt = read_text(slot_img, lang=tlang, psm=7, invert=True)
    slot_key = parse_slot_key(slot_txt)
    if not slot_key:
        return None

    main_txt = read_text(main_img, lang=tlang, psm=7, invert=True)
    main_stat_key = parse_main_stat_key(main_txt, slot_key=slot_key)
    if not main_stat_key:
        return None

    subs_full_txt = read_text(subs_img, lang=tlang, psm=6, invert=False)
    substats, unactivated = parse_artifact_substats(subs_full_txt)

    # Nome do set (linha verde logo abaixo dos substats — no Genshin termina com ':')
    set_region = card.crop((int(cw * 0.04), int(ch * 0.56), int(cw * 0.96), int(ch * 0.88)))
    set_ocr = read_text(set_region, lang=tlang, psm=6, invert=False)
    set_key = None
    for line in list(subs_full_txt.splitlines()) + list(set_ocr.splitlines()):
        cleaned_line = line.strip().rstrip(":").strip()
        low = norm_text(cleaned_line)
        if not low or len(low) < 5:
            continue
        if low.startswith(("2piece", "4piece", "conjuntode2", "conjuntode4")):
            continue
        if "+" in cleaned_line and "%" in cleaned_line:
            continue
        m_set = catalog.match("artifact_sets", cleaned_line, cutoff=0.68)
        if m_set:
            set_key = m_set
            break
    if not set_key:
        name_ocr = read_text(name_img, lang=tlang, psm=7, invert=True)
        set_key = catalog.match("artifact_sets", name_ocr, cutoff=0.60) or to_good_key(name_ocr) or "UnknownSet"

    locked = is_locked_rgb(average_rgb(lock_img))

    location = ""
    eq_sample = eq_img.crop((0, 0, min(15, eq_img.width), min(15, eq_img.height)))
    if compare_color(average_rgb(eq_sample), EQUIPPED_BANNER_COLOR, tolerance=48.0):
        eq_txt = read_text(eq_img, lang=tlang, psm=7, invert=False)
        location = parse_equipped_character(eq_txt, catalog)

    art: dict[str, Any] = {
        "setKey": set_key,
        "slotKey": slot_key,
        "level": level,
        "rarity": rarity,
        "mainStatKey": main_stat_key,
        "location": location,
        "lock": locked,
        "substats": substats,
    }
    if unactivated:
        art["unactivatedSubstats"] = unactivated
    return art


def scan_artifacts(
    backend: LinuxScreenBackend,
    win: WindowGeometry,
    catalog: GameCatalog,
    *,
    lang: str = "en",
    min_rarity: int = 5,
    min_level: int = 0,
    max_items: Optional[int] = None,
    click_delay: float = 0.13,
) -> list[dict[str, Any]]:
    """Escaneia a aba de Artefatos (deixe o inventário aberto na aba Artefatos!)."""
    tlang = _tess_lang(lang)
    cnt_img = backend.grab_rect(item_count_rect(win))
    detected_total = parse_item_count_header(read_text(cnt_img, lang="eng", psm=7, invert=True))
    target_total = max_items or (detected_total if detected_total > 0 else 200)
    print(f"[Artefatos] Detectados ~{detected_total or '?'} itens na mochila (limite: {target_total}).")

    results: list[dict[str, Any]] = []
    seen_sigs: set[str] = set()
    grid = inventory_grid_centers(win, cols=8, rows=4)
    c_rect = card_rect(win)
    page = 1
    consecutive_dupes = 0
    empty_pages = 0

    try:
        while len(results) < target_total:
            page_new = 0
            for idx, (gx, gy) in enumerate(grid):
                if len(results) >= target_total:
                    break
                backend.move_and_click(gx, gy, delay=click_delay)
                card = backend.grab_rect(c_rect)
                art = _parse_artifact_card(card, win.is_16_9, catalog, tlang)
                if not art:
                    continue

                if art["rarity"] < min_rarity or (min_level > 0 and art["level"] < min_level):
                    print(f"[Artefatos] Filtro atingido (raridade={art['rarity']}★, nv=+{art['level']}). Encerrando.")
                    return results

                sig = (
                    f"{art['setKey']}|{art['slotKey']}|{art['level']}|{art['mainStatKey']}|"
                    f"{art['location']}|{[(s['key'], s['value']) for s in art['substats']]}"
                )
                if sig in seen_sigs:
                    consecutive_dupes += 1
                    continue
                seen_sigs.add(sig)
                consecutive_dupes = 0
                results.append(art)
                page_new += 1
                print(
                    f"  #{len(results)} {art['setKey']} ({art['slotKey']} +{art['level']} {art['mainStatKey']})"
                    + (f" [{art['location']}]" if art["location"] else "")
                )

            if page_new == 0:
                empty_pages += 1
                if consecutive_dupes >= 12 or empty_pages >= 2:
                    print("[Artefatos] Fim da lista (ou nenhum item novo encontrado). Encerrando.")
                    break
            else:
                empty_pages = 0

            # Rola 1 página de 4 linhas (~39 cliques de scroll)
            mid_x, mid_y = grid[len(grid) // 2]
            backend.move_and_click(mid_x, mid_y, delay=0.04)
            backend.scroll_down(clicks=39)
            time.sleep(0.28)
            page += 1
    except (KeyboardInterrupt, ScanAbortedError) as exc:
        print(f"\n[AVISO] Scan interrompido ({exc}). Mantendo {len(results)} artefatos já lidos.")

    return results


def scan_weapons(
    backend: LinuxScreenBackend,
    win: WindowGeometry,
    catalog: GameCatalog,
    *,
    lang: str = "en",
    min_rarity: int = 4,
    max_items: Optional[int] = None,
    click_delay: float = 0.09,
) -> list[dict[str, Any]]:
    """Escaneia a aba de Armas (deixe o inventário aberto na aba Armas!)."""
    tlang = _tess_lang(lang)
    cnt_img = backend.grab_rect(item_count_rect(win))
    detected_total = parse_item_count_header(read_text(cnt_img, lang="eng", psm=7, invert=True))
    target_total = max_items or (detected_total if detected_total > 0 else 150)
    print(f"[Armas] Detectadas ~{detected_total or '?'} armas (limite: {target_total}).")

    results: list[dict[str, Any]] = []
    seen_sigs: set[str] = set()
    grid = inventory_grid_centers(win, cols=8, rows=4)
    c_rect = card_rect(win)
    page = 1

    try:
        while len(results) < target_total:
            page_new = 0
            for gx, gy in grid:
                if len(results) >= target_total:
                    break
                backend.move_and_click(gx, gy, delay=click_delay)
                card = backend.grab_rect(c_rect)
                cw, ch = card.size

                name_img = card.crop(crop_item_name(cw, ch, win.is_16_9).as_crop_box())
                rarity = detect_rarity_from_rgb(average_rgb(name_img))
                if rarity < min_rarity:
                    print(f"[Armas] Raridade mínima ({min_rarity}★) atingida. Encerrando.")
                    return results

                name_txt = read_text(name_img, lang=tlang, psm=7, invert=True)
                wkey = catalog.match("weapons", name_txt, cutoff=0.66)
                if not wkey:
                    continue

                lv_img = card.crop(crop_weapon_level(cw, ch, win.is_16_9).as_crop_box())
                ref_img = card.crop(crop_weapon_refinement(cw, ch, win.is_16_9).as_crop_box())
                lock_img = card.crop(crop_item_locked(cw, ch, win.is_16_9).as_crop_box())
                eq_img = card.crop(crop_item_equipped(cw, ch, win.is_16_9).as_crop_box())

                lv, asc = parse_weapon_level_and_ascension(read_text(lv_img, lang="eng", psm=7, invert=False))
                ref = parse_refinement(read_text(ref_img, lang="eng", psm=7, invert=True, whitelist="12345"))
                locked = is_locked_rgb(average_rgb(lock_img))

                location = ""
                eq_sample = eq_img.crop((0, 0, min(15, eq_img.width), min(15, eq_img.height)))
                if compare_color(average_rgb(eq_sample), EQUIPPED_BANNER_COLOR, tolerance=48.0):
                    location = parse_equipped_character(read_text(eq_img, lang=tlang, psm=7), catalog)

                sig = f"{wkey}|{lv}|{asc}|{ref}|{location}|{len(results) // 32}"
                if sig in seen_sigs and page > 1:
                    continue
                seen_sigs.add(sig)
                page_new += 1
                results.append({
                    "key": wkey,
                    "level": lv,
                    "ascension": asc,
                    "refinement": ref,
                    "location": location,
                    "lock": locked,
                })
                print(f"  #{len(results)} {wkey} Lv.{lv} R{ref}" + (f" [{location}]" if location else ""))

            if page_new == 0:
                break
            mid_x, mid_y = grid[len(grid) // 2]
            backend.move_and_click(mid_x, mid_y, delay=0.04)
            backend.scroll_down(clicks=39)
            time.sleep(0.28)
            page += 1
    except (KeyboardInterrupt, ScanAbortedError) as exc:
        print(f"\n[AVISO] Scan interrompido ({exc}). Mantendo {len(results)} armas já lidas.")

    return results


def scan_materials(
    backend: LinuxScreenBackend,
    win: WindowGeometry,
    catalog: GameCatalog,
    *,
    lang: str = "en",
    max_pages: int = 12,
    click_delay: float = 0.09,
) -> dict[str, int]:
    """Escaneia a aba atual de Materiais / Desenvolvimento de Personagem."""
    tlang = _tess_lang(lang)
    materials: dict[str, int] = {}
    grid = inventory_grid_centers(win, cols=8, rows=4)
    c_rect = card_rect(win)

    try:
        for page in range(1, max_pages + 1):
            new_on_page = 0
            for gx, gy in grid:
                backend.move_and_click(gx, gy, delay=click_delay)
                card = backend.grab_rect(c_rect)
                cw, ch = card.size

                name_txt = read_text(
                    card.crop(crop_item_name(cw, ch, win.is_16_9).as_crop_box()),
                    lang=tlang,
                    psm=7,
                    invert=True,
                )
                mkey = catalog.match("materials", name_txt, cutoff=0.72)
                if not mkey or mkey in materials:
                    continue

                qty_txt = read_text(
                    card.crop(crop_material_count(cw, ch, win.is_16_9).as_crop_box()),
                    lang="eng",
                    psm=7,
                    invert=False,
                )
                qty = parse_material_quantity(qty_txt)
                if qty > 0:
                    materials[mkey] = qty
                    new_on_page += 1
                    print(f"  [Material] {mkey}: {qty}")

            if new_on_page == 0 and page > 1:
                break
            mid_x, mid_y = grid[len(grid) // 2]
            backend.move_and_click(mid_x, mid_y, delay=0.04)
            backend.scroll_down(clicks=39)
            time.sleep(0.28)
    except (KeyboardInterrupt, ScanAbortedError) as exc:
        print(f"\n[AVISO] Scan interrompido ({exc}). Mantendo {len(materials)} materiais já lidos.")

    return materials


def scan_characters(
    backend: LinuxScreenBackend,
    win: WindowGeometry,
    catalog: GameCatalog,
    *,
    lang: str = "en",
    max_chars: int = 120,
) -> list[dict[str, Any]]:
    """Percorre a tela de Personagens clicando na seta direita até dar a volta completa."""
    tlang = _tess_lang(lang)
    chars: list[dict[str, Any]] = []
    seen: set[str] = set()
    next_x, next_y = char_next_arrow_point(win)

    try:
        for _ in range(max_chars):
            name_txt = read_text(backend.grab_rect(char_name_rect(win)), lang=tlang, psm=7, invert=True)
            lv_txt = read_text(backend.grab_rect(char_level_rect(win)), lang="eng", psm=7, invert=True)
            ckey = catalog.match("characters", name_txt, cutoff=0.68)
            if ckey and ckey in seen:
                print(f"[Personagens] Volta completa detectada em {ckey}. Total: {len(chars)}.")
                break
            if ckey:
                seen.add(ckey)
                lv, asc = parse_weapon_level_and_ascension(lv_txt)
                chars.append({
                    "key": ckey,
                    "level": lv,
                    "ascension": asc,
                    "constellation": 0,
                    "talent": {"auto": 1, "skill": 1, "burst": 1},
                })
                print(f"  #{len(chars)} {ckey} Lv.{lv} (Asc {asc})")

            backend.move_and_click(next_x, next_y, delay=0.28)
    except (KeyboardInterrupt, ScanAbortedError) as exc:
        print(f"\n[AVISO] Scan interrompido ({exc}). Mantendo {len(chars)} personagens já lidos.")

    return chars
