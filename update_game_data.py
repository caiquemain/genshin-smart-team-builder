#!/usr/bin/env python3
"""
update_game_data.py — Sync completo pós-versão do Genshin.

Fluxo:
  1. AMBR sync (chars novos)
  2. Inventário DB vs FS (o que falta)
  3. Downloads (só o que falta, 3 scripts)
  4. Re-verificação
  5. Cache bump (?v=N no config.ts)
  6. Rebuild frontend

Uso:
    python3 update_game_data.py              # sync completo
    python3 update_game_data.py --dry-run    # mostra o que faria, não toca nada
    python3 update_game_data.py --check-only # só inventário (exit 0 se OK, 1 se falta algo)
    python3 update_game_data.py --skip-ambr  # pula AMBR (só assets)
    python3 update_game_data.py --no-rebuild # não rebuilda frontend
    python3 update_game_data.py --force      # força mesmo se nada faltando
"""
import argparse
import json
import re
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).parent.resolve()
ICONS_DIR = ROOT / "frontend" / "public" / "icons"
CONFIG_FILE = ROOT / "frontend" / "src" / "config.ts"


def run(cmd, capture=False, check=True):
    return subprocess.run(
        cmd, cwd=ROOT, capture_output=capture, text=True, check=check,
    )


def step(num, name):
    print(f"\n{'=' * 60}")
    print(f"  [{num}] {name}")
    print(f"{'=' * 60}")


def check_pillow():
    try:
        import PIL  # noqa
        return True
    except ImportError:
        return False


DB_SCRIPT = '''
import json
from app.database import SessionLocal
from app.models import (
    Character, CharacterConstellation, CharacterPassive,
    CharacterTalent, Weapon, ArtifactSet, Material,
)
db = SessionLocal()
result = {}
for name, model in [
    ("characters", Character),
    ("constellations", CharacterConstellation),
    ("passives", CharacterPassive),
    ("talents", CharacterTalent),
    ("weapons", Weapon),
    ("artifacts", ArtifactSet),
    ("materials", Material),
]:
    icons = set()
    for row in db.query(model).all():
        if getattr(row, "icon", None):
            icons.add(row.icon)
    result[name] = sorted(icons)
print(json.dumps(result))
'''


def query_db_icons():
    r = run(["docker", "compose", "exec", "-T", "backend", "python", "-c", DB_SCRIPT], capture=True)
    return json.loads(r.stdout)


def find_missing(db_icons):
    return {
        cat: [i for i in icons if not (ICONS_DIR / f"{i}.webp").exists()]
        for cat, icons in db_icons.items()
    }


def count_existing():
    return len(list(ICONS_DIR.glob("*.webp"))) if ICONS_DIR.exists() else 0


def print_inventory(db_icons, missing):
    total_db = sum(len(v) for v in db_icons.values())
    total_missing = sum(len(v) for v in missing.values())
    print(f"   DB:  {total_db} ícones únicos")
    print(f"   FS:  {count_existing()} .webp")
    print(f"   Faltando: {total_missing}")
    if total_missing > 0:
        for cat, icons in missing.items():
            if icons:
                print(f"     {cat}: {len(icons)}")
                for i in icons[:6]:
                    print(f"       - {i}")
                if len(icons) > 6:
                    print(f"       ... +{len(icons) - 6}")
    return total_missing


def ambr_sync():
    run([
        "docker", "compose", "exec", "-T",
        "-e", "AMBR_MAX_CHARACTERS=0",
        "backend", "python", "-m", "app.seed.import_from_ambr",
    ])


def run_download_script(name):
    path = ROOT / name
    if not path.exists():
        print(f"   ⚠️  {name} não existe, pulando")
        return False
    run([sys.executable, str(path)])
    return True


def export_planner_data():
    run(["docker", "compose", "exec", "-T", "backend",
         "python", "-m", "app.scripts.export_planner_data"])


def bump_cache():
    if not CONFIG_FILE.exists():
        return None
    content = CONFIG_FILE.read_text()
    m = re.search(r"\?v=(\d+)", content)
    if not m:
        return None
    old = int(m.group(1))
    new = old + 1
    CONFIG_FILE.write_text(re.sub(r"\?v=\d+", f"?v={new}", content))
    return old, new


def rebuild_frontend():
    run(["docker", "compose", "build", "--no-cache", "frontend"])
    run(["docker", "compose", "up", "-d", "frontend"])


def download_missing_direct(missing, dry_run=False):
    """Rede de segurança: baixa direto do Yatta/Enka qualquer ícone que ainda falte.

    Não depende de download_missing.py, download_assets.py ou planner-data.json.
    Garante que TODO ícone do DB chega no FS eventualmente.
    """
    from io import BytesIO
    import urllib.request
    try:
        from PIL import Image
    except ImportError:
        print("   ❌ Pillow não instalado, pulando")
        return 0, sum(len(v) for v in missing.values())

    ICONS_DIR.mkdir(parents=True, exist_ok=True)
    downloaded = 0
    failed = 0

    for cat, icons in missing.items():
        for icon in icons:
            if dry_run:
                print(f"   [DRY RUN] baixaria {icon} ({cat})")
                continue

            # Monta lista de URLs (Yatta principal, Enka fallback)
            if icon.startswith("UI_RelicIcon"):
                urls = [
                    f"https://gi.yatta.moe/assets/UI/reliquary/{icon}.png",
                    f"https://enka.network/ui/{icon}.png",
                ]
            else:
                urls = [
                    f"https://gi.yatta.moe/assets/UI/{icon}.png",
                    f"https://enka.network/ui/{icon}.png",
                ]

            filepath = ICONS_DIR / f"{icon}.webp"
            success = False

            for url in urls:
                try:
                    req = urllib.request.Request(
                        url, headers={"User-Agent": "Mozilla/5.0"}
                    )
                    with urllib.request.urlopen(req, timeout=15) as resp:
                        img_data = resp.read()
                    img = Image.open(BytesIO(img_data)).convert("RGBA")
                    img.save(filepath, "WEBP", quality=88)
                    print(f"   ✅ {icon} ({cat}, {len(img_data)}B)")
                    downloaded += 1
                    success = True
                    break
                except Exception:
                    continue

            if not success:
                print(f"   ❌ {icon} ({cat}) — todos CDNs falharam")
                failed += 1

    return downloaded, failed


def main():
    ap = argparse.ArgumentParser(description="Sync completo pós-versão Genshin")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--check-only", action="store_true")
    ap.add_argument("--skip-ambr", action="store_true")
    ap.add_argument("--skip-downloads", action="store_true")
    ap.add_argument("--no-rebuild", action="store_true")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    t0 = time.time()
    print(f"\n🎮 Genshin Smart Team Builder — Update")
    print(f"   Modo: {'DRY RUN' if args.dry_run else 'CHECK ONLY' if args.check_only else 'REAL'}")
    print(f"   Root: {ROOT}")

    if not args.check_only and not args.dry_run and not check_pillow():
        print("\n❌ Pillow (PIL) não instalado no host.")
        print("   pip install pillow")
        sys.exit(1)

    # [0] Pre-flight
    step(0, "Pre-flight")
    try:
        run(["docker", "compose", "ps"], capture=True)
        print("   ✅ docker compose OK")
    except subprocess.CalledProcessError:
        print("   ❌ docker compose não funciona")
        sys.exit(1)

    # [1] AMBR
    if args.skip_ambr or args.check_only:
        step(1, "AMBR sync — PULADO")
    else:
        step(1, "AMBR sync")
        if args.dry_run:
            print("   [DRY RUN] rodaria AMBR sync")
        else:
            ambr_sync()

    # [2] Inventário
    step(2, "Inventário DB vs FS")
    db_icons = query_db_icons()
    missing = find_missing(db_icons)
    total_missing = print_inventory(db_icons, missing)

    if args.check_only:
        print(f"\n   Modo --check-only")
        print(f"   Exit: {'0 (tudo OK)' if total_missing == 0 else f'1 ({total_missing} faltando)'}")
        sys.exit(0 if total_missing == 0 else 1)

    if total_missing == 0 and not args.force:
        print(f"\n✅ Nada faltando. Nada a fazer.")
        sys.exit(0)

    # [3] Downloads (scripts existentes — cobrem o "grosso")
    if args.skip_downloads:
        step(3, "Downloads via scripts — PULADO")
    else:
        step(3, "Downloads via scripts")
        if args.dry_run:
            print("   [DRY RUN] rodaria download_missing + talents_passives + assets")
        else:
            run_download_script("download_missing.py")
            run_download_script("download_talents_passives.py")
            export_planner_data()
            run_download_script("download_assets.py")

    # [3.5] Rede de segurança — baixa direto o que ainda faltar
    step("3.5", "Download direto (rede de segurança)")
    # Recalcula missing (scripts podem ter baixado alguns)
    if not args.dry_run:
        db_icons = query_db_icons()
        missing = find_missing(db_icons)
    still_missing_count = sum(len(v) for v in missing.values())

    if still_missing_count == 0 and not args.force:
        print("   ✅ Nada faltando após scripts")
    else:
        print(f"   {still_missing_count} ícone(s) ainda faltando — baixando direto do Yatta/Enka")
        dl_ok, dl_fail = download_missing_direct(missing, dry_run=args.dry_run)
        if not args.dry_run:
            print(f"   ✅ {dl_ok} baixados, ❌ {dl_fail} falharam")

    # [4] Verificação pós
    step(4, "Verificação pós-download")
    db_icons = query_db_icons()
    missing = find_missing(db_icons)
    remaining = print_inventory(db_icons, missing)

    # [5] Bump cache
    step(5, "Cache bump ?v=N")
    if remaining == 0:
        if args.dry_run:
            m = re.search(r"\?v=(\d+)", CONFIG_FILE.read_text())
            cur = m.group(1) if m else "?"
            print(f"   [DRY RUN] ?v={cur} → ?v={int(cur)+1 if cur != '?' else 3}")
        else:
            result = bump_cache()
            if result:
                print(f"   ✅ ?v={result[0]} → ?v={result[1]}")
            else:
                print("   ⚠️  regex não bateu")
    else:
        print(f"   ⏭️  PULADO (ainda faltam {remaining})")

    # [6] Rebuild
    if args.no_rebuild:
        step(6, "Rebuild frontend — PULADO")
    else:
        step(6, "Rebuild frontend")
        if args.dry_run:
            print("   [DRY RUN] rebuildaria frontend")
        else:
            rebuild_frontend()

    # Final
    elapsed = int(time.time() - t0)
    step("✅", "CONCLUÍDO")
    print(f"   Ícones baixados:  {total_missing - remaining}")
    print(f"   Ainda faltando:   {remaining}")
    print(f"   Tempo:            {elapsed}s")
    print(f"   Frontend rebuild: {'não' if args.no_rebuild else ('sim' if not args.dry_run else '[DRY RUN]')}")

    if remaining > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
