"""Geometria de tela e regiões de recorte calibradas para Genshin Impact (16:9 e 16:10).

As frações abaixo seguem a calibração testada em campo do `rogerioth/Inventory_Kamera`
(incluindo deslocamento do banner de Sanctifying Elixir e a 4ª linha `unactivated` do 6.0+).
"""
from dataclasses import dataclass
from typing import Tuple

RGB = Tuple[int, int, int]


@dataclass(frozen=True)
class Rect:
    x: int
    y: int
    width: int
    height: int

    @property
    def center(self) -> Tuple[int, int]:
        return (self.x + self.width // 2, self.y + self.height // 2)

    @property
    def right(self) -> int:
        return self.x + self.width

    @property
    def bottom(self) -> int:
        return self.y + self.height

    def as_mss_monitor(self) -> dict[str, int]:
        return {
            "left": self.x,
            "top": self.y,
            "width": max(1, self.width),
            "height": max(1, self.height),
        }

    def as_crop_box(self) -> Tuple[int, int, int, int]:
        return (self.x, self.y, self.x + self.width, self.y + self.height)


@dataclass(frozen=True)
class WindowGeometry:
    x: int
    y: int
    width: int
    height: int

    @property
    def aspect_ratio(self) -> float:
        return self.width / max(1, self.height)

    @property
    def is_16_9(self) -> bool:
        """True para 16:9 (~1.77), False para 16:10 (~1.60)."""
        return self.aspect_ratio >= 1.68

    def rel_rect(self, fx: float, fy: float, fw: float, fh: float) -> Rect:
        return Rect(
            x=self.x + int(round(self.width * fx)),
            y=self.y + int(round(self.height * fy)),
            width=max(1, int(round(self.width * fw))),
            height=max(1, int(round(self.height * fh))),
        )

    def rel_point(self, fx: float, fy: float) -> Tuple[int, int]:
        return (
            self.x + int(round(self.width * fx)),
            self.y + int(round(self.height * fy)),
        )


def card_rect(win: WindowGeometry) -> Rect:
    """Retângulo do card de detalhes à direita no inventário (Armas / Artefatos / Materiais)."""
    return win.rel_rect(
        fx=0.6807,
        fy=0.1102 if win.is_16_9 else 0.0989,
        fw=0.2573,
        fh=0.7787 if win.is_16_9 else 0.8022,
    )


def item_count_rect(win: WindowGeometry) -> Rect:
    """Contador de itens no canto superior direito da mochila (ex.: '342/2100')."""
    return win.rel_rect(
        fx=1030.0 / 1280.0,
        fy=20.0 / 720.0,
        fw=175.0 / 1280.0,
        fh=25.0 / 720.0,
    )


def inventory_grid_centers(win: WindowGeometry, cols: int = 8, rows: int = 4) -> list[Tuple[int, int]]:
    """Calcula os centros (x, y) da grade de itens da mochila (8 colunas × 4 linhas completas em 16:9).

    Usa 4 linhas completas (32 itens/página) para evitar clicar na 5ª linha parcialmente coberta
    pelo filtro inferior ('Filtrar / Não Equipado').
    """
    gx = 0.048
    gy = 0.150 if win.is_16_9 else 0.135
    gw = 0.612
    gh = 0.654 if win.is_16_9 else 0.675

    cell_w = gw / cols
    cell_h = gh / rows
    points: list[Tuple[int, int]] = []
    for r in range(rows):
        for c in range(cols):
            fx = gx + (c + 0.5) * cell_w
            fy = gy + (r + 0.5) * cell_h
            points.append(win.rel_point(fx, fy))
    return points


def inventory_tab_point(win: WindowGeometry, tab: str) -> Tuple[int, int]:
    """Coordenada aproximada das abas superiores do Inventário (Armas, Artefatos, Materiais)."""
    # Abas centralizadas no topo (y ≈ 0.045)
    tab_x = {
        "weapons": 0.255,
        "artifacts": 0.315,
        "char_dev": 0.375,
        "food": 0.435,
        "materials": 0.495,
    }
    fx = tab_x.get(tab, 0.315)
    return win.rel_point(fx, 0.046 if win.is_16_9 else 0.042)


# --- Regiões internas do Card de Item (frações relativas às dimensões do Card) ---

def _sub_rect(card_w: int, card_h: int, fx: float, fy: float, fw: float, fh: float) -> Rect:
    return Rect(
        x=int(round(card_w * fx)),
        y=int(round(card_h * fy)),
        width=max(1, int(round(card_w * fw))),
        height=max(1, int(round(card_h * fh))),
    )


def crop_item_name(card_w: int, card_h: int, is_16_9: bool = True) -> Rect:
    return _sub_rect(card_w, card_h, 0.0, 0.0, 1.0, 0.070 if is_16_9 else 0.060)


def crop_artifact_slot(card_w: int, card_h: int, is_16_9: bool = True) -> Rect:
    return _sub_rect(
        card_w,
        card_h,
        0.0405,
        0.0772 if is_16_9 else 0.0663,
        0.4757,
        0.0475 if is_16_9 else 0.0809,
    )


def crop_artifact_main_stat(card_w: int, card_h: int, is_16_9: bool = True) -> Rect:
    return _sub_rect(
        card_w,
        card_h,
        0.0405,
        0.1722 if is_16_9 else 0.1477,
        0.4555,
        0.0416,
    )


def crop_sanctify_banner(card_w: int, card_h: int, is_16_9: bool = True) -> Rect:
    return _sub_rect(
        card_w,
        card_h,
        0.0,
        0.3333 if is_16_9 else 0.2941,
        0.0606,
        0.0526 if is_16_9 else 0.0470,
    )


def crop_artifact_level(
    card_w: int, card_h: int, is_16_9: bool = True, is_sanctified: bool = False
) -> Rect:
    base_y = 0.3634 if is_16_9 else 0.3197
    shift = (0.0520 if is_16_9 else 0.0465) if is_sanctified else 0.0
    return _sub_rect(
        card_w,
        card_h,
        0.0506,
        base_y + shift,
        0.1417,
        0.0416 if is_16_9 else 0.0347,
    )


def crop_artifact_substats(
    card_w: int, card_h: int, is_16_9: bool = True, is_sanctified: bool = False
) -> Rect:
    base_y = 0.412 if is_16_9 else 0.362
    shift = (0.0520 if is_16_9 else 0.0471) if is_sanctified else 0.0
    return _sub_rect(
        card_w,
        card_h,
        0.048,
        base_y + shift,
        0.86,
        0.245 if is_16_9 else 0.165,
    )


def crop_item_locked(
    card_w: int, card_h: int, is_16_9: bool = True, is_sanctified: bool = False
) -> Rect:
    base_y = 0.353 if is_16_9 else 0.309
    shift = (0.0520 if is_16_9 else 0.0471) if is_sanctified else 0.0
    return _sub_rect(
        card_w,
        card_h,
        0.75,
        base_y + shift,
        0.0955,
        0.055 if is_16_9 else 0.0495,
    )


def crop_item_equipped(card_w: int, card_h: int, is_16_9: bool = True) -> Rect:
    fy = 0.938 if is_16_9 else 0.943
    return _sub_rect(card_w, card_h, 0.15, fy, 0.85, 1.0 - fy)


def crop_weapon_level(card_w: int, card_h: int, is_16_9: bool = True) -> Rect:
    return _sub_rect(
        card_w,
        card_h,
        0.060,
        0.367 if is_16_9 else 0.320,
        0.262,
        0.035 if is_16_9 else 0.033,
    )


def crop_weapon_refinement(card_w: int, card_h: int, is_16_9: bool = True) -> Rect:
    return _sub_rect(
        card_w,
        card_h,
        0.058 if is_16_9 else 0.057,
        0.417 if is_16_9 else 0.364,
        0.074 if is_16_9 else 0.075,
        0.038 if is_16_9 else 0.034,
    )


def crop_material_count(card_w: int, card_h: int, is_16_9: bool = True) -> Rect:
    """Região de contagem de material (ex.: 'Possuído: 450' / 'Owned: 450') no card de material."""
    return _sub_rect(
        card_w,
        card_h,
        0.05,
        0.08 if is_16_9 else 0.07,
        0.55,
        0.07,
    )


# --- Regiões da Tela de Personagens ---

def char_name_rect(win: WindowGeometry) -> Rect:
    return win.rel_rect(0.755, 0.115, 0.215, 0.055)


def char_level_rect(win: WindowGeometry) -> Rect:
    return win.rel_rect(0.755, 0.175, 0.185, 0.045)


def char_next_arrow_point(win: WindowGeometry) -> Tuple[int, int]:
    return win.rel_point(0.962, 0.500)


# --- Cores de referência (Genshin UI) ---

RARITY_COLORS: dict[int, RGB] = {
    5: (188, 105, 50),   # Dourado / Laranja 5★
    4: (162, 86, 225),   # Roxo 4★
    3: (81, 128, 203),   # Azul 3★
    2: (42, 144, 114),   # Verde 2★
    1: (114, 119, 139),  # Cinza 1★
}

SANCTIFIED_BANNER_COLOR: RGB = (220, 192, 255)
EQUIPPED_BANNER_COLOR: RGB = (255, 231, 187)
LOCKED_ICON_BG_COLOR: RGB = (70, 80, 100)


def color_distance(a: RGB, b: RGB) -> float:
    return ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2) ** 0.5


def compare_color(a: RGB, b: RGB, tolerance: float = 38.0) -> bool:
    return color_distance(a, b) <= tolerance


def detect_rarity_from_rgb(avg_rgb: RGB) -> int:
    best_rarity = 5
    best_dist = float("inf")
    for rarity, target in RARITY_COLORS.items():
        d = color_distance(avg_rgb, target)
        if d < best_dist:
            best_dist = d
            best_rarity = rarity
    return best_rarity


def is_locked_rgb(avg_rgb: RGB) -> bool:
    """Detecta ícone de cadeado travado (vermelho-coral 5.x/6.x ou fundo escuro antigo)."""
    r, g, b = avg_rgb
    # Cadeado travado atual do Genshin tem fundo avermelhado/coral (R claramente maior que G e B)
    if r >= 145 and (r - b) >= 16 and (r - g) >= 14:
        return True
    return compare_color(avg_rgb, LOCKED_ICON_BG_COLOR, tolerance=45.0)
