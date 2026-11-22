"""Camada de captura de tela e controle de input nativa para Linux (X11 + GNOME/KDE Wayland + wlroots)."""
from io import BytesIO
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import time
from typing import Optional

from PIL import Image

from .geometry import Rect, WindowGeometry


class ScanAbortedError(RuntimeError):
    """Disparado quando o usuário aciona o failsafe (mouse no canto 0,0 ou Ctrl+C)."""


def _detect_desktop() -> str:
    return (os.environ.get("XDG_CURRENT_DESKTOP") or os.environ.get("DESKTOP_SESSION") or "").lower()


def _ydotool_socket_available() -> bool:
    """Verifica se existe socket do ydotoold ativo (ydotool 1.0+)."""
    env_sock = os.environ.get("YDOTOOL_SOCKET")
    candidates = [
        env_sock,
        f"/run/user/{os.getuid()}/.ydotool_socket",
        "/tmp/.ydotool_socket",
    ]
    for path in candidates:
        if path and os.path.exists(path):
            return True
    return False


def _system_python_supports_portal() -> Optional[str]:
    """Retorna o caminho do Python com PyGObject + GStreamer + pipewiresrc, ou None."""
    for py in ("/usr/bin/python3", shutil.which("python3")):
        if not py:
            continue
        res = subprocess.run(
            [
                py,
                "-c",
                "import gi; gi.require_version('Gst','1.0'); from gi.repository import Gio, Gst; "
                "Gst.init(None); assert Gst.ElementFactory.find('pipewiresrc') is not None",
            ],
            capture_output=True,
            check=False,
        )
        if res.returncode == 0:
            return py
    return None


class PortalCaptureClient:
    """Cliente do helper `portal_capture.py` (xdg-desktop-portal + PipeWire + GStreamer)."""

    def __init__(self, python_bin: str) -> None:
        self.python_bin = python_bin
        self.proc: Optional[subprocess.Popen] = None
        self.frame_width: int = 0
        self.frame_height: int = 0

    def start(self) -> None:
        if self.proc is not None:
            return
        script = Path(__file__).with_name("portal_capture.py")
        self.proc = subprocess.Popen(
            [self.python_bin, str(script)],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=None,  # mostra instruções do diálogo [Portal] direto no terminal
        )
        assert self.proc.stdout is not None
        ready_line = self.proc.stdout.readline().decode("ascii", errors="ignore").strip()
        if not ready_line.startswith("READY "):
            self.close()
            raise RuntimeError(
                "Falha ao iniciar captura via xdg-desktop-portal (cancelado ou PipeWire indisponível)."
            )
        _, w_s, h_s = ready_line.split()
        self.frame_width = int(w_s)
        self.frame_height = int(h_s)

    def grab_full_frame(self) -> Image.Image:
        if self.proc is None:
            self.start()
        assert self.proc is not None and self.proc.stdin is not None and self.proc.stdout is not None
        self.proc.stdin.write(b"GRAB\n")
        self.proc.stdin.flush()
        header = self.proc.stdout.readline().decode("ascii", errors="ignore").strip()
        if not header.startswith("FRAME "):
            raise RuntimeError(f"Resposta inesperada do portal_capture: {header!r}")
        _, w_s, h_s, n_s = header.split()
        w, h, nbytes = int(w_s), int(h_s), int(n_s)
        buf = bytearray()
        while len(buf) < nbytes:
            chunk = self.proc.stdout.read(nbytes - len(buf))
            if not chunk:
                raise RuntimeError("Conexão com portal_capture encerrada inesperadamente.")
            buf.extend(chunk)
        self.frame_width = w
        self.frame_height = h
        return Image.frombytes("RGB", (w, h), bytes(buf))

    def close(self) -> None:
        if self.proc is not None:
            try:
                if self.proc.stdin:
                    self.proc.stdin.write(b"QUIT\n")
                    self.proc.stdin.flush()
            except Exception:
                pass
            try:
                self.proc.wait(timeout=2.0)
            except Exception:
                self.proc.kill()
            self.proc = None


class LinuxScreenBackend:
    """Abstração de captura de tela e mouse/teclado para X11, GNOME/KDE Wayland (Portal/XWayland) e wlroots."""

    def __init__(
        self,
        display_server: Optional[str] = None,
        failsafe: bool = True,
        capture_backend: str = "auto",
        input_backend: str = "auto",
    ) -> None:
        session = (display_server or os.environ.get("XDG_SESSION_TYPE", "x11")).lower()
        self.is_wayland = session == "wayland"
        self.desktop = _detect_desktop()
        self.failsafe = failsafe
        self._mss = None
        self._portal: Optional[PortalCaptureClient] = None
        self._portal_python: Optional[str] = None
        self._active_window: Optional[WindowGeometry] = None
        self._ydotool_v1: Optional[bool] = None

        self.capture_backend = self._resolve_capture_backend(capture_backend)
        self.input_backend = self._resolve_input_backend(input_backend)

    def _resolve_capture_backend(self, requested: str) -> str:
        is_gnome_or_kde = "gnome" in self.desktop or "kde" in self.desktop or "plasma" in self.desktop
        if requested == "portal":
            self._portal_python = _system_python_supports_portal()
            if not self._portal_python:
                raise RuntimeError(
                    "Captura `portal` requer PyGObject + GStreamer PipeWire. Instale com:\n"
                    "  sudo apt install -y python3-gi gir1.2-gstreamer-1.0 gstreamer1.0-pipewire"
                )
            return "portal"
        if requested != "auto":
            return requested

        if self.is_wayland:
            if is_gnome_or_kde:
                py = _system_python_supports_portal()
                if py:
                    self._portal_python = py
                    return "portal"
                print(
                    "[AVISO] GNOME/KDE Wayland bloqueia captura X11 (`mss`). Para captura nativa sem flash, instale:\n"
                    "        sudo apt install -y python3-gi gir1.2-gstreamer-1.0 gstreamer1.0-pipewire"
                )
            elif shutil.which("grim"):
                return "grim"
        return "mss"

    def _resolve_input_backend(self, requested: str) -> str:
        if requested != "auto":
            return requested
        if not self.is_wayland:
            return "xdotool"
        if shutil.which("ydotool") and (_ydotool_socket_available() or os.access("/dev/uinput", os.W_OK)):
            return "ydotool"
        if shutil.which("xdotool"):
            return "xdotool"
        if shutil.which("ydotool"):
            return "ydotool"
        return "xdotool"

    def _is_ydotool_v1(self) -> bool:
        if self._ydotool_v1 is None:
            res = subprocess.run(
                ["ydotool", "mousemove", "--help"],
                capture_output=True,
                text=True,
                check=False,
            )
            out = (res.stdout + res.stderr).lower()
            self._ydotool_v1 = "--absolute" in out or "--wheel" in out
        return self._ydotool_v1

    def set_window(self, win: WindowGeometry) -> None:
        """Registra a janela ativa para mapear recortes corretamente em streams de janela única (Portal)."""
        self._active_window = win

    def prepare_capture(self) -> None:
        """Inicializa o stream PipeWire/Portal antes da contagem regressiva (se aplicável)."""
        if self.capture_backend == "portal" and self._portal is None:
            assert self._portal_python is not None
            self._portal = PortalCaptureClient(self._portal_python)
            self._portal.start()

    def _get_mss(self):
        if self._mss is None:
            import mss

            self._mss = mss.mss()
        return self._mss

    def close(self) -> None:
        if self._portal is not None:
            self._portal.close()
            self._portal = None
        if self._mss is not None:
            self._mss.close()
            self._mss = None

    # --- Detecção da janela do Genshin Impact ---

    def find_genshin_window(self) -> Optional[WindowGeometry]:
        """Tenta localizar automaticamente a janela do Genshin Impact (Hyprland, Sway ou X11/XWayland)."""
        if self.is_wayland:
            if shutil.which("hyprctl"):
                geom = self._find_window_hyprland()
                if geom:
                    return geom
            if shutil.which("swaymsg"):
                geom = self._find_window_sway()
                if geom:
                    return geom

        if shutil.which("xdotool"):
            geom = self._find_window_xdotool()
            if geom:
                return geom

        return None

    def _find_window_xdotool(self) -> Optional[WindowGeometry]:
        for pattern in ("Genshin Impact", "GenshinImpact", "genshinimpact", "Genshin"):
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
                kv = dict(re.findall(r"(\w+)=(-?\d+)", g.stdout))
                w = int(kv.get("WIDTH", 0))
                h = int(kv.get("HEIGHT", 0))
                if w >= 640 and h >= 360:
                    try:
                        cmd = (
                            ["xdotool", "windowactivate", wid]
                            if self.is_wayland
                            else ["xdotool", "windowactivate", "--sync", wid]
                        )
                        subprocess.run(cmd, check=False, timeout=1.5)
                    except subprocess.TimeoutExpired:
                        pass
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

    def _grab_via_portal(self, rect: Rect) -> Image.Image:
        self.prepare_capture()
        assert self._portal is not None
        frame = self._portal.grab_full_frame()
        fw, fh = frame.size

        # Se o usuário escolheu a janela do Genshin ou o monitor único do jogo no diálogo do portal,
        # o frame já tem origem (0, 0) da janela em vez das coordenadas globais (ex.: x=1920).
        if self._active_window is not None and fw <= self._active_window.width + 16 and fh <= self._active_window.height + 64:
            rx = max(0, rect.x - self._active_window.x)
            ry = max(0, rect.y - self._active_window.y)
            # Se o frame da janela estiver escalado diferente de win.width/height, redimensiona para bater
            if fw != self._active_window.width or fh != self._active_window.height:
                frame = frame.resize((self._active_window.width, self._active_window.height), Image.Resampling.BILINEAR)
            return frame.crop((rx, ry, rx + rect.width, ry + rect.height))

        return frame.crop((rect.x, rect.y, rect.right, rect.bottom))

    def _grab_via_gnome_screenshot(self, rect: Rect) -> Image.Image:
        if not shutil.which("gnome-screenshot"):
            raise RuntimeError(
                "Backend `gnome-screenshot` não encontrado. Instale com: sudo apt install gnome-screenshot"
            )
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
            tmp_path = Path(tmp.name)
        try:
            subprocess.run(["gnome-screenshot", "-f", str(tmp_path)], check=True)
            full = Image.open(tmp_path).convert("RGB")
            return full.crop((rect.x, rect.y, rect.right, rect.bottom))
        finally:
            tmp_path.unlink(missing_ok=True)

    def grab_rect(self, rect: Rect) -> Image.Image:
        if self.capture_backend == "portal":
            return self._grab_via_portal(rect)

        if self.capture_backend == "grim":
            if not shutil.which("grim"):
                raise RuntimeError("Backend `grim` não encontrado. Instale com: sudo apt install grim")
            geo = f"{rect.x},{rect.y} {rect.width}x{rect.height}"
            res = subprocess.run(["grim", "-g", geo, "-"], capture_output=True, check=True)
            return Image.open(BytesIO(res.stdout)).convert("RGB")

        if self.capture_backend == "gnome-screenshot":
            return self._grab_via_gnome_screenshot(rect)

        sct = self._get_mss()
        shot = sct.grab(rect.as_mss_monitor())
        return Image.frombytes("RGB", shot.size, shot.bgra, "raw", "BGRX")

    def grab_window(self, win: WindowGeometry) -> Image.Image:
        return self.grab_rect(Rect(win.x, win.y, win.width, win.height))

    # --- Failsafe & Controle de Mouse/Teclado ---

    def check_failsafe(self) -> None:
        if not self.failsafe or not shutil.which("xdotool"):
            return
        res = subprocess.run(
            ["xdotool", "getmouselocation", "--shell"],
            capture_output=True,
            text=True,
            check=False,
        )
        kv = dict(re.findall(r"(\w+)=(-?\d+)", res.stdout))
        mx = int(kv.get("X", 999))
        my = int(kv.get("Y", 999))
        if 0 <= mx <= 4 and 0 <= my <= 4:
            raise ScanAbortedError("Failsafe acionado (mouse movido para o canto superior esquerdo 0,0).")

    def move_and_click(self, x: int, y: int, delay: float = 0.12) -> None:
        """Move o cursor e segura o clique por 55ms (essencial para Wine/Proton/Heroic registrar o clique!)."""
        self.check_failsafe()
        if self.input_backend == "ydotool":
            if not shutil.which("ydotool"):
                raise RuntimeError("Backend `ydotool` selecionado, mas `ydotool` não está instalado.")
            if self._is_ydotool_v1():
                subprocess.run(["ydotool", "mousemove", "--absolute", "-x", str(x), "-y", str(y)], check=False)
                time.sleep(0.035)
                subprocess.run(["ydotool", "click", "0x40"], check=False)  # Left down
                time.sleep(0.055)
                subprocess.run(["ydotool", "click", "0x80"], check=False)  # Left up
            else:
                subprocess.run(["ydotool", "mousemove", "-a", str(x), str(y)], check=False)
                time.sleep(0.035)
                subprocess.run(["ydotool", "click", "1"], check=False)
        else:
            if not shutil.which("xdotool"):
                raise RuntimeError("Requer `xdotool` instalado (`sudo apt install xdotool`).")
            cmd = (
                ["xdotool", "mousemove", str(x), str(y)]
                if self.is_wayland
                else ["xdotool", "mousemove", "--sync", str(x), str(y)]
            )
            subprocess.run(cmd, check=False)
            time.sleep(0.035)
            subprocess.run(["xdotool", "mousedown", "1"], check=False)
            time.sleep(0.055)
            subprocess.run(["xdotool", "mouseup", "1"], check=False)
        if delay > 0:
            time.sleep(delay)

    def scroll_down(self, clicks: int = 10, delay_per_click: float = 0.014) -> None:
        self.check_failsafe()
        direction = -1 if clicks > 0 else 1
        if self.input_backend == "ydotool":
            if not shutil.which("ydotool"):
                raise RuntimeError("Backend `ydotool` selecionado, mas `ydotool` não está instalado.")
            for _ in range(abs(clicks)):
                if self._is_ydotool_v1():
                    subprocess.run(["ydotool", "mousemove", "-w", "--", "0", str(direction)], check=False)
                else:
                    subprocess.run(["ydotool", "mousemove", "--wheel", "0", str(direction)], check=False)
                time.sleep(delay_per_click)
        else:
            # Em X11/XWayland, botão 5 = scroll para baixo, botão 4 = scroll para cima
            btn = "5" if clicks > 0 else "4"
            for _ in range(abs(clicks)):
                subprocess.run(["xdotool", "click", btn], check=False)
                time.sleep(delay_per_click)

    def press_key(self, key: str, delay: float = 0.15) -> None:
        self.check_failsafe()
        if self.input_backend == "ydotool" and shutil.which("wtype"):
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
