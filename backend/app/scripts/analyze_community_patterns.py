#!/usr/bin/env python3
"""Análise de Ciência de Dados dos padrões de builds da comunidade (Paimon.plus — 40k+ contas).

Uso:
  python3 backend/app/scripts/analyze_community_patterns.py
  python3 backend/app/scripts/analyze_community_patterns.py --character furina
  python3 backend/app/scripts/analyze_community_patterns.py --clusters 6 --top 15
  python3 backend/app/scripts/analyze_community_patterns.py --export-csv community_patterns.csv
"""
from __future__ import annotations

import argparse
import json
import math
import sys
import urllib.request
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from rich import box
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from scipy.stats import spearmanr
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler

SNAPSHOT_PATH = (
    Path(__file__).resolve().parents[2]
    / "data"
    / "sources"
    / "paimon_plus"
    / "statistics.json"
)
CACHE_PATH = Path.home() / ".cache" / "genshin-smart-team-builder" / "yatta_avatars_pt.json"
YATTA_AVATAR_URL = "https://gi.yatta.moe/api/v2/pt/avatar"

# FightProp IDs usados no JSON do Paimon.plus
FIGHT_PROP_MAP: dict[int, tuple[str, bool]] = {
    2000: ("hp", False),
    2001: ("atk", False),
    2002: ("def", False),
    28: ("em", False),
    20: ("crit_rate", True),
    22: ("crit_dmg", True),
    23: ("er", True),
}

TRAVELER_NAMES: dict[int, str] = {
    10000005: "Viajante (Aether)",
    10000007: "Viajante (Lumine)",
}

ELEMENT_PT: dict[str, str] = {
    "Fire": "Pyro",
    "Water": "Hydro",
    "Wind": "Anemo",
    "Electric": "Electro",
    "Grass": "Dendro",
    "Ice": "Cryo",
    "Rock": "Geo",
}

CLUSTER_FEATURES = [
    "hp_med",
    "atk_med",
    "def_med",
    "em_med",
    "cr_med",
    "cd_med",
    "er_med",
    "elem_dmg_med",
]


def load_avatar_metadata(no_fetch: bool = False) -> dict[int, dict[str, Any]]:
    """Carrega nomes, raridade e elemento dos personagens (cache local + Yatta API)."""
    if CACHE_PATH.exists():
        try:
            raw = json.loads(CACHE_PATH.read_text(encoding="utf-8"))
            return {int(k): v for k, v in raw.items()}
        except Exception:
            pass

    if no_fetch:
        return {}

    try:
        req = urllib.request.Request(
            YATTA_AVATAR_URL,
            headers={"User-Agent": "genshin-smart-team-builder/1.0 (analytics)"},
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
        items = payload.get("data", {}).get("items", {}) or {}
        meta: dict[int, dict[str, Any]] = {}
        for k, v in items.items():
            # Alguns IDs do Viajante vêm como "10000005-anemo"
            base_id_str = str(k).split("-")[0]
            if not base_id_str.isdigit():
                continue
            aid = int(base_id_str)
            if aid in meta:
                continue
            meta[aid] = {
                "name": v.get("name") or f"Avatar {aid}",
                "rarity": int(v.get("rank") or 5),
                "element": ELEMENT_PT.get(str(v.get("element") or ""), str(v.get("element") or "—")),
            }
        CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
        CACHE_PATH.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
        return meta
    except Exception:
        return {}


def normalized_entropy(counts: list[int]) -> float:
    """Entropia de Shannon normalizada em [0, 1] (0 = concentrado em 1 item, 1 = uniforme)."""
    vals = np.array([c for c in counts if c > 0], dtype=float)
    if len(vals) <= 1:
        return 0.0
    probs = vals / vals.sum()
    h = -np.sum(probs * np.log2(probs))
    return float(h / math.log2(len(vals)))


def detect_stopping_points(consts: list[int], total: int) -> list[str]:
    """Detecta picos empíricos de constelação (C1, C2, C6 etc.)."""
    if total <= 0 or len(consts) < 7:
        return []
    pcts = [c / total * 100.0 for c in consts[:7]]
    peaks: list[str] = []
    for lvl in range(1, 6):
        prev_p = pcts[lvl - 1]
        cur_p = pcts[lvl]
        next_p = pcts[lvl + 1]
        if cur_p >= 8.0 and cur_p > next_p * 1.35 and (lvl == 1 or cur_p >= prev_p * 0.65):
            peaks.append(f"C{lvl} ({cur_p:.0f}%)")
    if pcts[6] >= 10.0 and pcts[6] > pcts[5] * 2.0:
        peaks.append(f"C6 ({pcts[6]:.0f}%)")
    return peaks


def build_dataframe(snapshot: dict[str, Any], meta: dict[int, dict[str, Any]]) -> pd.DataFrame:
    total_players = int(snapshot.get("playerInfo", {}).get("count") or 40000)
    rows: list[dict[str, Any]] = []

    for av in snapshot.get("avatarInfoList", []):
        aid = int(av["avatarId"])
        count = int(av.get("count") or 0)
        if count <= 0:
            continue

        info = meta.get(aid, {})
        name = TRAVELER_NAMES.get(aid) or info.get("name") or f"Avatar #{aid}"
        rarity = int(info.get("rarity") or 5)
        element = str(info.get("element") or "—")

        # Stats medianos & médios
        stat_vals: dict[str, tuple[float, float]] = {}
        for s in av.get("stats", []):
            fp = s.get("fightProp")
            val = s.get("value") or {}
            med = float(val.get("median") or 0.0)
            mean = float(val.get("mean") or 0.0)
            if fp in FIGHT_PROP_MAP:
                key, is_pct = FIGHT_PROP_MAP[fp]
                mult = 100.0 if is_pct else 1.0
                stat_vals[key] = (med * mult, mean * mult)
            elif fp is None:
                stat_vals["elem_dmg"] = (med * 100.0, mean * 100.0)

        hp_med, hp_mean = stat_vals.get("hp", (0.0, 0.0))
        atk_med, atk_mean = stat_vals.get("atk", (0.0, 0.0))
        def_med, def_mean = stat_vals.get("def", (0.0, 0.0))
        em_med, em_mean = stat_vals.get("em", (0.0, 0.0))
        cr_med, cr_mean = stat_vals.get("crit_rate", (0.0, 0.0))
        cd_med, cd_mean = stat_vals.get("crit_dmg", (0.0, 0.0))
        er_med, er_mean = stat_vals.get("er", (100.0, 100.0))
        elem_med, elem_mean = stat_vals.get("elem_dmg", (0.0, 0.0))

        # Constelações
        consts = [int(x) for x in (av.get("consts") or [0] * 7)[:7]]
        c_sum = sum(consts) or count
        avg_const = sum(i * c for i, c in enumerate(consts)) / c_sum
        c0_pct = consts[0] / c_sum * 100.0
        c2_pct = consts[2] / c_sum * 100.0 if len(consts) > 2 else 0.0
        c6_pct = consts[6] / c_sum * 100.0 if len(consts) > 6 else 0.0
        peaks = detect_stopping_points(consts, c_sum)

        # Armas e Artefatos (entropia e dominância Top 1)
        weapons = av.get("weapon") or []
        w_counts = [int(w.get("count") or 0) for w in weapons]
        top1_weapon_pct = (w_counts[0] / count * 100.0) if w_counts else 0.0
        weapon_entropy = normalized_entropy(w_counts)

        sets = av.get("reliquarySet") or []
        s_counts = [int(s.get("count") or 0) for s in sets]
        top1_set_pct = (s_counts[0] / count * 100.0) if s_counts else 0.0
        set_entropy = normalized_entropy(s_counts)

        # Talentos (ignora passivas/sprint fixas em nível 1)
        skills = [sk for sk in (av.get("skills") or []) if float(sk.get("mean") or 0) > 1.05]
        if not skills:
            skills = av.get("skills") or []
        crowned_count = sum(1 for sk in skills if int(sk.get("median") or 0) >= 10)
        avg_talent = float(np.mean([float(sk.get("mean") or 1.0) for sk in skills])) if skills else 1.0

        # Divergência Média vs Mediana (indicador de builds bimodais/polarizadas)
        em_gap = abs(em_mean - em_med)
        cd_gap = abs(cd_mean - cd_med)
        polarization_score = (em_gap / 80.0) + (cd_gap / 20.0)

        rows.append(
            {
                "avatar_id": aid,
                "name": name,
                "rarity": rarity,
                "element": element,
                "count": count,
                "popularity_pct": count / total_players * 100.0,
                "hp_med": hp_med,
                "hp_mean": hp_mean,
                "atk_med": atk_med,
                "atk_mean": atk_mean,
                "def_med": def_med,
                "def_mean": def_mean,
                "em_med": em_med,
                "em_mean": em_mean,
                "cr_med": cr_med,
                "cr_mean": cr_mean,
                "cd_med": cd_med,
                "cd_mean": cd_mean,
                "er_med": er_med,
                "er_mean": er_mean,
                "elem_dmg_med": elem_med,
                "elem_dmg_mean": elem_mean,
                "cv_eff": cr_med * 2.0 + cd_med,
                "avg_const": avg_const,
                "c0_pct": c0_pct,
                "c2_pct": c2_pct,
                "c6_pct": c6_pct,
                "stopping_points": ", ".join(peaks) if peaks else "—",
                "top1_weapon_pct": top1_weapon_pct,
                "weapon_entropy": weapon_entropy,
                "top1_set_pct": top1_set_pct,
                "set_entropy": set_entropy,
                "crowned_talents": crowned_count,
                "avg_talent": avg_talent,
                "em_gap": em_gap,
                "cd_gap": cd_gap,
                "polarization_score": polarization_score,
            }
        )

    return pd.DataFrame(rows)


def label_cluster(centroid_z: pd.Series) -> str:
    """Gera um rótulo legível para o cluster com base nos z-scores dominantes."""
    if centroid_z["def_med"] > 1.2:
        return "Escala em DEF (Tank / Geo DPS)"
    if centroid_z["em_med"] > 1.0 and centroid_z["cd_med"] < 0.2:
        return "Full EM / Reação Transformativa"
    if centroid_z["hp_med"] > 0.9 and centroid_z["cd_med"] > 0.2:
        return "Hypercarry / Sub-DPS Escala em HP"
    if centroid_z["hp_med"] > 0.9 and centroid_z["cd_med"] <= 0.2:
        return "Suporte / Healer / Escudo (HP)"
    if centroid_z["er_med"] > 0.7 and centroid_z["cd_med"] < 0.1:
        return "Bateria / Suporte de Recarga (ER)"
    if centroid_z["cd_med"] > 0.5 and centroid_z["cr_med"] > 0.4:
        if centroid_z["em_med"] > 0.2:
            return "DPS Crítico + Reação (ATQ/EM)"
        return "Hypercarry Crítico Clássico (ATQ)"
    return "Sub-DPS / Híbrido Balanceado"


def run_clustering(df: pd.DataFrame, n_clusters: int = 6) -> tuple[pd.DataFrame, pd.DataFrame, np.ndarray, np.ndarray]:
    """Executa StandardScaler + KMeans + PCA sobre os 8 stats medianos."""
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(df[CLUSTER_FEATURES].values)

    km = KMeans(n_clusters=n_clusters, n_init=25, random_state=42)
    labels = km.fit_predict(X_scaled)

    pca = PCA(n_components=2, random_state=42)
    coords = pca.fit_transform(X_scaled)

    df = df.copy()
    df["cluster_id"] = labels
    df["pca_1"] = coords[:, 0]
    df["pca_2"] = coords[:, 1]

    # Rotula cada cluster pelos z-scores médios
    z_df = pd.DataFrame(X_scaled, columns=CLUSTER_FEATURES, index=df.index)
    z_df["cluster_id"] = labels
    centroids_z = z_df.groupby("cluster_id").mean()

    cluster_names: dict[int, str] = {}
    used_names: dict[str, int] = {}
    for cid, z_row in centroids_z.iterrows():
        base_name = label_cluster(z_row)
        cnt = used_names.get(base_name, 0) + 1
        used_names[base_name] = cnt
        cluster_names[int(cid)] = base_name if cnt == 1 else f"{base_name} #{cnt}"

    df["cluster_name"] = df["cluster_id"].map(cluster_names)

    summary = (
        df.groupby(["cluster_id", "cluster_name"], as_index=False)
        .agg(
            chars=("name", "count"),
            hp=("hp_med", "median"),
            atk=("atk_med", "median"),
            def_=("def_med", "median"),
            em=("em_med", "median"),
            cr=("cr_med", "median"),
            cd=("cd_med", "median"),
            er=("er_med", "median"),
            examples=("name", lambda s: ", ".join(df.loc[s.index].nlargest(4, "count")["name"])),
        )
        .sort_values("chars", ascending=False)
    )
    return df, summary, pca.explained_variance_ratio_, X_scaled


def print_character_deep_dive(
    console: Console,
    df: pd.DataFrame,
    X_scaled: np.ndarray,
    query: str,
) -> None:
    q = query.strip().lower()
    matches = df[df["name"].str.lower().str.contains(q, regex=False)]
    if matches.empty:
        console.print(f"[bold red]Nenhum personagem encontrado para:[/bold red] {query}")
        return

    row = matches.sort_values("count", ascending=False).iloc[0]
    idx = int(df.index.get_loc(row.name))
    vec = X_scaled[idx]
    dists = np.linalg.norm(X_scaled - vec, axis=1)
    neighbor_idxs = np.argsort(dists)[1:7]

    console.print(
        Panel(
            f"[bold cyan]{row['name']}[/bold cyan] ({row['rarity']}★ · {row['element']})  |  "
            f"Amostra: [bold]{int(row['count']):,}[/bold] builds ({row['popularity_pct']:.1f}% das vitrines)\n"
            f"Arquétipo detectado (K-Means): [bold magenta]{row['cluster_name']}[/bold magenta]\n"
            f"Constelação média: [bold]C{row['avg_const']:.2f}[/bold] · C6: [bold yellow]{row['c6_pct']:.1f}%[/bold yellow] · "
            f"Picos: [bold]{row['stopping_points']}[/bold]\n"
            f"CV Efetivo (2×CR+CD): [bold green]{row['cv_eff']:.1f}[/bold green] · "
            f"Top 1 Arma: [bold]{row['top1_weapon_pct']:.1f}%[/bold] (entropia {row['weapon_entropy']:.2f}) · "
            f"Top 1 Set: [bold]{row['top1_set_pct']:.1f}%[/bold] (entropia {row['set_entropy']:.2f})",
            title="Raio-X Estatístico do Personagem",
            border_style="cyan",
        )
    )

    # Tabela de stats com Z-score e percentil entre os 126 personagens
    st_table = Table(title="Perfil de Atributos vs. Todos os Personagens", box=box.ROUNDED)
    st_table.add_column("Atributo", style="bold")
    st_table.add_column("Mediana", justify="right", style="cyan")
    st_table.add_column("Média", justify="right", style="dim")
    st_table.add_column("Z-Score", justify="right")
    st_table.add_column("Percentil", justify="right", style="green")

    stat_labels = [
        ("hp_med", "hp_mean", "Vida Máx.", False),
        ("atk_med", "atk_mean", "ATQ", False),
        ("def_med", "def_mean", "DEF", False),
        ("em_med", "em_mean", "Proficiência (EM)", False),
        ("cr_med", "cr_mean", "Taxa Crítica", True),
        ("cd_med", "cd_mean", "Dano Crítico", True),
        ("er_med", "er_mean", "Recarga (ER)", True),
        ("elem_dmg_med", "elem_dmg_mean", "Bônus Elem.", True),
    ]
    for i, (m_col, mean_col, label, is_pct) in enumerate(stat_labels):
        z = float(vec[i])
        pct_rank = float((df[m_col] <= row[m_col]).mean() * 100.0)
        fmt = (lambda v: f"{v:.1f}%") if is_pct else (lambda v: f"{v:,.0f}")
        z_color = "green" if z >= 0.8 else ("red" if z <= -0.8 else "white")
        st_table.add_row(
            label,
            fmt(row[m_col]),
            fmt(row[mean_col]),
            f"[{z_color}]{z:+.2f}σ[/{z_color}]",
            f"Top {max(1.0, 100.0 - pct_rank):.0f}%" if pct_rank >= 50 else f"P{pct_rank:.0f}",
        )
    console.print(st_table)

    # Vizinhos mais parecidos no espaço de stats
    nb_table = Table(title="6 Personagens com Perfil de Build Mais Parecido (Distância Euclidiana)", box=box.SIMPLE_HEAVY)
    nb_table.add_column("Personagem", style="bold")
    nb_table.add_column("Elem.", style="cyan")
    nb_table.add_column("Dist.", justify="right")
    nb_table.add_column("CV Efetivo", justify="right", style="green")
    nb_table.add_column("HP / ATQ / EM / ER", justify="right", style="dim")
    for ni in neighbor_idxs:
        nb = df.iloc[int(ni)]
        nb_table.add_row(
            nb["name"],
            nb["element"],
            f"{dists[int(ni)]:.2f}",
            f"{nb['cv_eff']:.1f}",
            f"{nb['hp_med']:,.0f} / {nb['atk_med']:,.0f} / {nb['em_med']:.0f} / {nb['er_med']:.0f}%",
        )
    console.print(nb_table)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Análise de Ciência de Dados dos padrões de builds da comunidade (Paimon.plus)"
    )
    parser.add_argument("--clusters", type=int, default=6, help="Número de clusters K-Means (padrão: 6)")
    parser.add_argument("--top", type=int, default=12, help="Quantidade de linhas nos rankings (padrão: 12)")
    parser.add_argument("--character", type=str, default=None, help="Raio-X detalhado de um personagem (ex.: furina)")
    parser.add_argument("--export-csv", type=str, default=None, help="Salva o dataset enriquecido em CSV")
    parser.add_argument("--no-fetch", action="store_true", help="Não consultar Yatta API para nomes (usa cache/IDs)")
    args = parser.parse_args()

    console = Console()
    if not SNAPSHOT_PATH.exists():
        console.print(f"[bold red]Snapshot não encontrado:[/bold red] {SNAPSHOT_PATH}")
        return 1

    snapshot = json.loads(SNAPSHOT_PATH.read_text(encoding="utf-8"))
    meta = load_avatar_metadata(no_fetch=args.no_fetch)
    df = build_dataframe(snapshot, meta)
    df, cluster_summary, pca_var, X_scaled = run_clustering(df, n_clusters=args.clusters)

    if args.export_csv:
        out_path = Path(args.export_csv)
        df.to_csv(out_path, index=False)
        console.print(f"[green]CSV exportado com {len(df)} personagens em:[/green] {out_path.resolve()}")

    if args.character:
        print_character_deep_dive(console, df, X_scaled, args.character)
        return 0

    total_players = int(snapshot.get("playerInfo", {}).get("count") or 0)
    total_builds = int(df["count"].sum())
    console.print(
        Panel(
            f"[bold white]Censo Paimon.plus — Análise de Padrões de Builds[/bold white]\n"
            f"Contas analisadas: [bold cyan]{total_players:,}[/bold cyan]  ·  "
            f"Personagens: [bold cyan]{len(df)}[/bold cyan]  ·  "
            f"Builds nas vitrines: [bold cyan]{total_builds:,}[/bold cyan]\n"
            f"PCA (2 componentes) explica [bold green]{pca_var.sum() * 100:.1f}%[/bold green] "
            f"da variância dos 8 atributos ({pca_var[0]*100:.1f}% + {pca_var[1]*100:.1f}%)",
            border_style="bright_blue",
        )
    )

    # 1. Clusters K-Means
    t_clust = Table(title=f"1. Arquétipos Reais da Comunidade (K-Means, k={args.clusters})", box=box.ROUNDED)
    t_clust.add_column("Arquétipo Detectado", style="bold magenta")
    t_clust.add_column("Qtd", justify="right")
    t_clust.add_column("HP", justify="right")
    t_clust.add_column("ATQ", justify="right")
    t_clust.add_column("EM", justify="right")
    t_clust.add_column("CR / CD", justify="right", style="cyan")
    t_clust.add_column("ER", justify="right")
    t_clust.add_column("Exemplos Populares", style="dim")
    for _, r in cluster_summary.iterrows():
        t_clust.add_row(
            str(r["cluster_name"]),
            str(int(r["chars"])),
            f"{r['hp']:,.0f}",
            f"{r['atk']:,.0f}",
            f"{r['em']:.0f}",
            f"{r['cr']:.0f}% / {r['cd']:.0f}%",
            f"{r['er']:.0f}%",
            str(r["examples"]),
        )
    console.print(t_clust)

    # 2. Top Crit Value Efetivo
    t_cv = Table(title=f"2. Top {args.top} Maior Crit Value Efetivo Mediano (2×CR + CD)", box=box.ROUNDED)
    t_cv.add_column("#", justify="right", style="dim")
    t_cv.add_column("Personagem", style="bold")
    t_cv.add_column("Elem.", style="cyan")
    t_cv.add_column("CR Med.", justify="right")
    t_cv.add_column("CD Med.", justify="right")
    t_cv.add_column("CV Efetivo", justify="right", style="bold green")
    t_cv.add_column("Builds", justify="right", style="dim")
    for rank, (_, r) in enumerate(df.nlargest(args.top, "cv_eff").iterrows(), 1):
        t_cv.add_row(
            str(rank),
            str(r["name"]),
            str(r["element"]),
            f"{r['cr_med']:.1f}%",
            f"{r['cd_med']:.1f}%",
            f"{r['cv_eff']:.1f}",
            f"{int(r['count']):,}",
        )
    console.print(t_cv)

    # 3. Índice Whale (% C6) em 5★
    df5 = df[df["rarity"] == 5].copy()
    t_whale = Table(title=f"3. Top {args.top} Personagens 5★ por Índice Whale (% C6) & Stopping Points", box=box.ROUNDED)
    t_whale.add_column("#", justify="right", style="dim")
    t_whale.add_column("Personagem", style="bold")
    t_whale.add_column("% C6", justify="right", style="bold yellow")
    t_whale.add_column("Const. Média", justify="right")
    t_whale.add_column("Picos Detectados", style="cyan")
    t_whale.add_column("Builds", justify="right", style="dim")
    for rank, (_, r) in enumerate(df5.nlargest(args.top, "c6_pct").iterrows(), 1):
        t_whale.add_row(
            str(rank),
            str(r["name"]),
            f"{r['c6_pct']:.1f}%",
            f"C{r['avg_const']:.2f}",
            str(r["stopping_points"]),
            f"{int(r['count']):,}",
        )
    console.print(t_whale)

    # 4. Concentração de Arma e Set (Entropia de Shannon)
    valid = df[df["count"] >= 200]
    t_lock = Table(title="4. Personagens Mais Presos a 1 Arma/Set vs. Mais Flexíveis (Entropia de Shannon)", box=box.ROUNDED)
    t_lock.add_column("Mais Presos a 1 Set", style="bold red")
    t_lock.add_column("Top1 Set", justify="right")
    t_lock.add_column("H(Set)", justify="right", style="dim")
    t_lock.add_column("Mais Presos a 1 Arma", style="bold yellow")
    t_lock.add_column("Top1 Arma", justify="right")
    t_lock.add_column("H(Arma)", justify="right", style="dim")

    locked_sets = valid.nlargest(8, "top1_set_pct").reset_index(drop=True)
    locked_weaps = valid.nlargest(8, "top1_weapon_pct").reset_index(drop=True)
    for i in range(min(8, len(locked_sets), len(locked_weaps))):
        ls = locked_sets.iloc[i]
        lw = locked_weaps.iloc[i]
        t_lock.add_row(
            str(ls["name"]),
            f"{ls['top1_set_pct']:.1f}%",
            f"{ls['set_entropy']:.2f}",
            str(lw["name"]),
            f"{lw['top1_weapon_pct']:.1f}%",
            f"{lw['weapon_entropy']:.2f}",
        )
    console.print(t_lock)

    # 5. Builds Polarizadas (Média vs. Mediana)
    t_pol = Table(title="5. Builds Mais Polarizadas / Bimodais (Maior Desvio Média vs. Mediana)", box=box.ROUNDED)
    t_pol.add_column("Personagem", style="bold")
    t_pol.add_column("EM Mediana → Média", justify="right", style="cyan")
    t_pol.add_column("CD Mediana → Média", justify="right", style="yellow")
    t_pol.add_column("Score", justify="right", style="bold magenta")
    for _, r in valid.nlargest(8, "polarization_score").iterrows():
        t_pol.add_row(
            str(r["name"]),
            f"{r['em_med']:.0f} → {r['em_mean']:.0f}",
            f"{r['cd_med']:.1f}% → {r['cd_mean']:.1f}%",
            f"{r['polarization_score']:.2f}",
        )
    console.print(t_pol)

    # 6. Correlações Estatísticas (Spearman)
    corr_pairs = [
        ("Popularidade (%)", "popularity_pct", "Crit Value Efetivo", "cv_eff", df),
        ("Popularidade (%)", "popularity_pct", "Índice Whale (% C6 em 5★)", "c6_pct", df5),
        ("% C6 (5★)", "c6_pct", "Crit Value Efetivo", "cv_eff", df5),
        ("% C6 (5★)", "c6_pct", "Dominância da Arma #1 (%)", "top1_weapon_pct", df5),
        ("Talentos Coroados", "crowned_talents", "Crit Value Efetivo", "cv_eff", df),
    ]
    t_corr = Table(title="6. Correlações Estatísticas (Spearman ρ)", box=box.ROUNDED)
    t_corr.add_column("Variável A", style="bold")
    t_corr.add_column("Variável B", style="bold")
    t_corr.add_column("Spearman ρ", justify="right")
    t_corr.add_column("p-value", justify="right", style="dim")
    t_corr.add_column("Leitura")
    for la, ca, lb, cb, sub in corr_pairs:
        rho, pval = spearmanr(sub[ca], sub[cb])
        rho_f = float(rho)
        p_f = float(pval)
        sig = "significativa" if p_f < 0.05 else "não significativa"
        strength = "forte" if abs(rho_f) >= 0.5 else ("moderada" if abs(rho_f) >= 0.3 else "fraca")
        direction = "positiva" if rho_f >= 0 else "negativa"
        color = "green" if (p_f < 0.05 and rho_f > 0) else ("red" if (p_f < 0.05 and rho_f < 0) else "dim")
        t_corr.add_row(
            la,
            lb,
            f"[{color}]{rho_f:+.3f}[/{color}]",
            f"{p_f:.2e}",
            f"{strength} {direction} ({sig})",
        )
    console.print(t_corr)

    console.print(
        "\n[dim]Dica: rode com [bold]--character furina[/bold] para o raio-x + vizinhos mais parecidos, "
        "ou [bold]--export-csv stats.csv[/bold] para exportar a tabela completa.[/dim]"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
