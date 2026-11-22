"""Camada de captura de tela e controle de input nativa para Linux (X11 + Wayland)."""
import json
import os
import re
import shutil
import subprocess
import time
from typing import Optional, Tuple

from PIL import Image

from .geometry import Rect, WindowGeometry


class ScanAbortedError(RuntimeError):
    """Disparado quando o usuário aciona o failsafe (mouse no canto 0,0 ou Ctrl+C)."""


class LinuxScreenBackend:
    """Abstração de captura de tela e mouse/teclado para X11 (mss+xdotool) e Wayland (grim+ydotool)."""

    def __init__(self, display_server: Optional[str] = None, failsafe: bool = True) -> None:
        session = (display_server or os.environ.get("XDG_SESSION_TYPE", "x11")).lower()
        self.is_wayland = session == "wayland"
        self.failsafe = failsafe
        self._mss = None

    def _get_mss(self):
        if self._mss is None:
            import mss

            self._mss = mss.mss()
        return self._mss

    def close(self) -> None:
        if self._mss is not None:
            self._mss.close()
            self._mss = None

    # --- Detecção da janela do Genshin Impact ---

    def find_genshin_window(self) -> Optional[WindowGeometry]:
        """Tenta localizar automaticamente a janela do Genshin Impact (X11, Hyprland ou Sway)."""
        if not self.is_wayland and shutil.which("xdotool"):
            geom = self._find_window_xdotool()
            if geom:
                return geom

        if self.is_wayland:
            if shutil.which("hyprctl"):
                geom = self._find_window_hyprland()
                if geom:
                    return geom
            if shutil.which("swaymsg"):
                geom = self._find_window_sway()
                if geom:
                    return geom

        return None

    def _find_window_xdotool(self) -> Optional[WindowGeometry]:
        for pattern in ("Genshin Impact", "GenshinImpact", "genshinimpact"):
            res = subprocess.run(
                ["xdotool", "search", "--onlyvisible", "--name", pattern],
                capture_output=True,
                text=True,
                check=False,
            )
            win_ids = [line.strip() for line in res.stdout.splitlines() if line.strip()]
            for wid in win_ids:
                g = subprocess.run(
                    ["xdotool", "getwindowgeometry", "--shell", wid],
                    capture_output=True,
                    text=True,
                    check=False,
                )
                kv = dict(re.findall(r"(\w+)=(\d+)", g.stdout))
                w = int(kv.get("WIDTH", 0))
                h = int(kv.get("HEIGHT", 0))
                if w >= 640 and h >= 360:
                    # Foca a janela do jogo
                    subprocess.run(["xdotool", "windowactivate", "--sync", wid], check=False)
                    return WindowGeometry(
                        x=int(kv.get("X", 0)),
                        y=int(kv.get("Y", 0)),
                        width=w,
                        height=h,
                    )
        return None

    def _find_window_hyprland(self) -> Optional[WindowGeometry]:
        res = subprocess.run(["hyprctl", "clients", "-j"], capture_output=True, text=True, check=False)
        if res.returncode != 0:
            return None
        try:
            clients = json.loads(res.stdout)
        except Exception:
            return None
        for c in clients:
            title = f"{c.get('title', '')} {c.get('class', '')}".lower()
            if "genshin" in title:
                at = c.get("at") or [0, 0]
                size = c.get("size") or [0, 0]
                if size[0] >= 640 and size[1] >= 360:
                    return WindowGeometry(int(at[0]), int(at[1]), int(size[0]), int(size[1]))
        return None

    def _find_window_sway(self) -> Optional[WindowGeometry]:
        res = subprocess.run(["swaymsg", "-t", "get_tree"], capture_output=True, text=True, check=False)
        if res.returncode != 0:
            return None
        try:
            tree = json.loads(res.stdout)
        except Exception:
            return None

        def walk(node: dict) -> Optional[WindowGeometry]:
            name = str(node.get("name") or "").lower()
            app_id = str(node.get("app_id") or "").lower()
            if "genshin" in name or "genshin" in app_id:
                r = node.get("rect") or {}
                if r.get("width", 0) >= 640 and r.get("height", 0) >= 360:
                    return WindowGeometry(int(r["x"]), int(r["y"]), int(r["width"]), int(r["height"]))
            for child in (node.get("nodes") or []) + (node.get("floating_nodes") or []):
                found = walk(child)
                if found:
                    return found
            return None

        return walk(tree)

    def primary_screen_geometry(self) -> WindowGeometry:
        sct = self._get_mss()
        mon = sct.monitors[1] if len(sct.monitors) > 1 else sct.monitors[0]
        return WindowGeometry(
            x=int(mon["left"]),
            y=int(mon["top"]),
            width=int(mon["width"]),
            height=int(mon["height"]),
        )

    # --- Captura de tela ---

    def grab_rect(self, rect: Rect) -> Image.Image:
        if self.is_wayland and shutil.which("grim"):
            geo = f"{rect.x},{rect.y} {rect.width}x{rect.height}"
            res = subprocess.run(["grim", "-g", geo, "-"], capture_output=True, check=True)
            from io import BytesIO

            return Image.open(BytesIO(res.stdout)).convert("RGB")

        sct = self._get_mss()
        shot = sct.grab(rect.as_mss_monitor())
        return Image.frombytes("RGB", shot.size, shot.bgra, "raw", "BGRX")

    def grab_window(self, win: WindowGeometry) -> Image.Image:
        return self.grab_rect(Rect(win.x, win.y, win.width, win.height))

    # --- Failsafe & Controle de Mouse/Teclado ---

    def check_failsafe(self) -> None:
        if not self.failsafe or self.is_wayland or not shutil.which("xdotool"):
            return
        res = subprocess.run(
            ["xdotool", "getmouselocation", "--shell"],
            capture_output=True,
            text=True,
            check=False,
        )
        kv = dict(re.findall(r"(\w+)=(\d+)", res.stdout))
        mx = int(kv.get("X", 999))
        my = int(kv.get("Y", 999))
        if mx <= 4 and my <= 4:
            raise ScanAbortedError("Failsafe acionado (mouse movido para o canto superior esquerdo 0,0).")

    def move_and_click(self, x: int, y: int, delay: float = 0.08) -> None:
        self.check_failsafe()
        if self.is_wayland:
            if not shutil.which("ydotool"):
                raise RuntimeError("Wayland requer `ydotool` instalado e daemon `ydotoold` ativo.")
            subprocess.run(["ydotool", "mousemove", "--absolute", "-x", str(x), "-y", str(y)], check=False)
            time.sleep(0.02)
            subprocess.run(["ydotool", "click", "0xC0"], check=False)
        else:
            if not shutil.which("xdotool"):
                raise RuntimeError("X11 requer `xdotool` instalado (`sudo apt install xdotool`).")
            subprocess.run(["xdotool", "mousemove", "--sync", str(x), str(y)], check=False)
            time.sleep(0.02)
            subprocess.run(["xdotool", "click", "1"], check=False)
        if delay > 0:
            time.sleep(delay)

    def scroll_down(self, clicks: int = 10, delay_per_click: float = 0.012) -> None:
        self.check_failsafe()
        if self.is_wayland:
            if not shutil.which("ydotool"):
                raise RuntimeError("Wayland requer `ydotool` instalado.")
            for _ in range(clicks):
                subprocess.run(["ydotool", "mousemove", "--wheel", "-x", "0", "-y", "-1"], check=False)
                time.sleep(delay_per_click)
        else:
            # Em X11, botão 5 = scroll para baixo, botão 4 = scroll para cima
            btn = "5" if clicks > 0 else "4"
            for _ in range(abs(clicks)):
                subprocess.run(["xdotool", "click", btn], check=False)
                time.sleep(delay_per_click)

    def press_key(self, key: str, delay: float = 0.15) -> None:
        self.check_failsafe()
        if self.is_wayland:
            if shutil.which("wtype"):
                subprocess.run(["wtype", key], check=False)
        elif shutil.which("xdotool"):
            subprocess.run(["xdotool", "key", key], check=False)
        if delay > 0:
            time.sleep(delay)


def parse_geometry_arg(spec: str) -> WindowGeometry:
    """Parseia `--geometry X,Y,W,H` ou `WxH`."""
    spec = spec.strip()
    if "x" in spec and "," not in spec:
        w, h = spec.lower().split("x", 1)
        return WindowGeometry(0, 0, int(w), int(h))
    parts = [int(p.strip()) for p in spec.split(",")]
    if len(parts) == 4:
        return WindowGeometry(parts[0], parts[1], parts[2], parts[3])
    raise ValueError(f"Formato de geometria inválido: '{spec}'. Use 'X,Y,W,H' ou '1280x720'.")
