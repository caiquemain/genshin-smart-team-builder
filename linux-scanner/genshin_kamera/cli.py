"""CLI do Genshin Kamera Linux — gera arquivos GOOD v2 compatíveis com Genshin Smart Team Builder."""
import argparse
from pathlib import Path
import sys
import time

from .backend_input import LinuxScreenBackend, parse_geometry_arg
from .catalog import load_default_catalog
from .parsers import build_good_v2_payload, write_good_json
from .scanners import (
    save_calibration_overlay,
    scan_artifacts,
    scan_characters,
    scan_materials,
    scan_weapons,
)


def build_arg_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="genshin-kamera",
        description=(
            "Scanner nativo de inventário do Genshin Impact para Linux (X11/Wayland). "
            "Exporta JSON no formato GOOD v2 compatível com rogerioth/Inventory_Kamera e "
            "Genshin Smart Team Builder."
        ),
    )
    p.add_argument("--calibrate", action="store_true", help="Salva imagem com caixas de recorte em ./debug_crops para validar resolução")
    p.add_argument("--artifacts", action="store_true", help="Escaneia a aba de Artefatos (abra o inventário na aba Artefatos)")
    p.add_argument("--weapons", action="store_true", help="Escaneia a aba de Armas (abra o inventário na aba Armas)")
    p.add_argument("--materials", action="store_true", help="Escaneia a aba atual de Materiais / Desenvolvimento")
    p.add_argument("--characters", action="store_true", help="Escaneia a tela de Personagens (abra a tela de Personagens)")
    p.add_argument("--lang", choices=("en", "pt"), default="en", help="Idioma da interface do Genshin (en ou pt; padrão: en)")
    p.add_argument("--min-rarity", type=int, default=5, help="Raridade mínima para artefatos (padrão: 5)")
    p.add_argument("--min-weapon-rarity", type=int, default=4, help="Raridade mínima para armas (padrão: 4)")
    p.add_argument("--min-level", type=int, default=0, help="Nível mínimo para artefatos (padrão: 0)")
    p.add_argument("--max-items", type=int, default=None, help="Limite máximo de itens (útil para testes rápidos)")
    p.add_argument("--delay", type=float, default=0.09, help="Pausa em segundos entre cliques (aumente se o PC estiver lento)")
    p.add_argument("--countdown", type=int, default=3, help="Segundos antes de iniciar o scan para focar o jogo (padrão: 3)")
    p.add_argument("--geometry", type=str, default=None, help="Força geometria manual da janela: 'X,Y,W,H' ou '1280x720'")
    p.add_argument("--display", choices=("x11", "wayland"), default=None, help="Força sessão X11 ou Wayland")
    p.add_argument(
        "--capture",
        choices=("auto", "mss", "grim", "gnome-screenshot"),
        default="auto",
        help="Backend de captura de tela (padrão: auto)",
    )
    p.add_argument(
        "--input",
        choices=("auto", "xdotool", "ydotool"),
        default="auto",
        help="Backend de mouse/scroll (padrão: auto; usa xdotool em XWayland/GNOME se ydotool não estiver ativo)",
    )
    p.add_argument("--api-url", type=str, default="http://localhost:8000/api", help="URL da API local para carregar nomes atualizados")
    p.add_argument("--out", type=Path, default=Path("./output"), help="Pasta de saída do JSON GOOD v2 (padrão: ./output)")
    return p


def main(argv: list[str] | None = None) -> int:
    parser = build_arg_parser()
    args = parser.parse_args(argv)

    if not any([args.calibrate, args.artifacts, args.weapons, args.materials, args.characters]):
        parser.print_help()
        print("\nExemplo rápido:")
        print("  genshin-kamera --calibrate --lang pt")
        print("  genshin-kamera --artifacts --lang pt --min-rarity 5")
        return 0

    backend = LinuxScreenBackend(
        display_server=args.display,
        capture_backend=args.capture,
        input_backend=args.input,
    )
    try:
        if args.geometry:
            win = parse_geometry_arg(args.geometry)
        else:
            win = backend.find_genshin_window()
            if win is None:
                print("[INFO] Janela do Genshin não encontrada automaticamente; usando tela principal.")
                win = backend.primary_screen_geometry()

        print(
            f"[Backend] sessão={'wayland' if backend.is_wayland else 'x11'} "
            f"captura={backend.capture_backend} input={backend.input_backend}"
        )
        print(f"[Janela] x={win.x}, y={win.y}, {win.width}x{win.height} ({'16:9' if win.is_16_9 else '16:10'})")

        if args.countdown > 0:
            print(f"Iniciando em {args.countdown}s... (Mova o mouse p/ o canto superior esquerdo 0,0 ou Ctrl+C para abortar)")
            for i in range(args.countdown, 0, -1):
                print(f"  {i}...")
                time.sleep(1)

        catalog = load_default_catalog(api_url=args.api_url)

        if args.calibrate:
            out_img = save_calibration_overlay(
                backend,
                win,
                Path("./debug_crops"),
                catalog=catalog,
                lang=args.lang,
            )
            print(f"[Calibração] Overlay salvo em: {out_img.resolve()}")
            print("Abra a imagem e confira se o retângulo verde envolve o card da direita e os círculos azuis batem nos ícones.")
            return 0

        print(
            f"[Catálogo] Carregados {len(catalog.characters)} nomes de chars, "
            f"{len(catalog.weapons)} armas, {len(catalog.artifact_sets)} sets, {len(catalog.materials)} materiais."
        )

        artifacts = None
        weapons = None
        materials = None
        characters = None

        if args.artifacts:
            artifacts = scan_artifacts(
                backend,
                win,
                catalog,
                lang=args.lang,
                min_rarity=args.min_rarity,
                min_level=args.min_level,
                max_items=args.max_items,
                click_delay=args.delay,
            )

        if args.weapons:
            weapons = scan_weapons(
                backend,
                win,
                catalog,
                lang=args.lang,
                min_rarity=args.min_weapon_rarity,
                max_items=args.max_items,
                click_delay=args.delay,
            )

        if args.materials:
            materials = scan_materials(
                backend,
                win,
                catalog,
                lang=args.lang,
                click_delay=args.delay,
            )

        if args.characters:
            characters = scan_characters(
                backend,
                win,
                catalog,
                lang=args.lang,
            )

        payload = build_good_v2_payload(
            characters=characters,
            weapons=weapons,
            artifacts=artifacts,
            materials=materials,
        )
        out_file = write_good_json(payload, args.out)
        print(f"\n[SUCESSO] Arquivo GOOD v2 exportado em: {out_file.resolve()}")
        print("Arraste esse arquivo em 'Meu Roster' ou no 'Planejador' do Genshin Smart Team Builder!")
        return 0
    finally:
        backend.close()


if __name__ == "__main__":
    sys.exit(main())
