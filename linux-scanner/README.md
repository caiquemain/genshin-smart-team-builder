# Genshin Kamera Linux (`genshin-kamera`)

Scanner nativo de inventário do **Genshin Impact** para **Linux (X11 e Wayland)**, inspirado na calibração testada em campo do [`rogerioth/Inventory_Kamera`](https://github.com/rogerioth/Inventory_Kamera) e totalmente integrado ao **Genshin Smart Team Builder**.

Exporta arquivos `.json` no formato **GOOD v2** (`format: "GOOD"`, `version: 2`, `kamera_version`, `characters`, `weapons`, `artifacts` com suporte a `unactivatedSubstats` da 6.0+ e `materials`), prontos para arrastar em **Meu Roster** ou no **Planejador** do app — ou no Genshin Optimizer.

---

## Recursos

- **X11 e Wayland**: captura via `mss` + `xdotool` (X11) ou `grim` + `ydotool` / `hyprctl` / `swaymsg` (Wayland).
- **EN e PT-BR**: OCR via Tesseract (`eng` e `por+eng`) com fuzzy matching automático contra o catálogo atualizado (`frontend/public/planner-data.json` e API local em `http://localhost:8000/api`).
- **Geometria 16:9 e 16:10**: recortes calibrados pelo `rogerioth/Inventory_Kamera`, incluindo detecção do banner de *Sanctifying Elixir* (que desloca nível/substats para baixo) e leitura da 4ª linha `(unactivated)` / `(não ativado)` introduzida no Genshin 6.0+.
- **Modo `--calibrate`**: gera uma imagem PNG com todas as caixas de recorte desenhadas sobre o jogo para conferir alinhamento antes de escanear.
- **Scans parciais & mesclagem inteligente**: você pode escanear só `--artifacts`, só `--weapons`, só `--materials` ou só `--characters`; o Genshin Smart Team Builder mescla o JSON parcial por cima dos dados GOOD já salvos na conta sem apagar o resto.
- **Failsafe de emergência**: mova o mouse para o canto superior esquerdo `(0, 0)` ou pressione `Ctrl+C` a qualquer momento — o scanner para imediatamente e ainda salva tudo o que já leu.

---

## Pré-requisitos no Linux

### 1. Dependências do sistema

**Ubuntu / Debian / Pop!_OS / Mint:**
```bash
sudo apt update
sudo apt install -y python3-venv tesseract-ocr tesseract-ocr-eng tesseract-ocr-por xdotool
```

**Arch / Manjaro / EndeavourOS / SteamOS:**
```bash
sudo pacman -S tesseract tesseract-data-eng tesseract-data-por xdotool
```

**Fedora:**
```bash
sudo dnf install tesseract tesseract-langpack-eng tesseract-langpack-por xdotool
```

> **Usuários de Wayland (Hyprland, Sway, GNOME/KDE Wayland):** instale também `grim` e `ydotool` (e deixe o serviço `ydotoold` ativo: `sudo systemctl enable --now ydotool` ou `ydotoold &`). Em caso de dúvida ou se o jogo rodar via Wine/Proton/Lutris/AAGL em XWayland, passar `--display x11` ou rodar em modo janela costuma ser mais simples.

### 2. Instalação do scanner

Na pasta `linux-scanner/`:

```bash
cd linux-scanner
./install.sh
```

Isso cria um `.venv` isolado e instala o comando `.venv/bin/genshin-kamera`.

---

## Como usar

### Passo 1 — Prepare a janela do jogo
1. Abra o Genshin Impact em **16:9** (ex.: `1280×720` ou `1920×1080` em modo **Janela** ou **Tela Cheia sem Bordas**; 16:10 também é suportado).
2. Abra a **Mochila (`B`)** na aba **Artefatos**.
3. Recomendado: deixe o brilho/gama padrão do jogo (filtros pesados de HDR/ReShade atrapalham o OCR).

### Passo 2 — Valide a calibração (`--calibrate`)
Execute o comando abaixo e foque a janela do jogo durante a contagem de 3 segundos:

```bash
.venv/bin/genshin-kamera --calibrate
```

Abra `./debug_crops/calibration_overlay.png` e verifique se:
- O **retângulo verde** envolve exatamente o card de detalhes à direita;
- Os **círculos azuis** batem no centro dos ícones da grade `8×5`;
- O **retângulo amarelo** envolve o contador no canto superior direito (`ex.: 342/2100`);
- Os **retângulos rosa** (e os recortes individuais `01_name.png`..`07_locked.png`) batem em nome, slot, main stat, nível, substats e equipado.

> Se a janela do jogo não for detectada automaticamente (comum em alguns compositors Wayland ou monitores múltiplos), passe a geometria manualmente:
> ```bash
> .venv/bin/genshin-kamera --calibrate --geometry 0,0,1920,1080
> ```

### Passo 3 — Escaneie o que quiser

> **Importante:** Abra a aba correspondente dentro do Genshin **antes** de rodar cada comando (e foque a janela do jogo na contagem de 3s).

**Artefatos 5★ (em português):**
```bash
.venv/bin/genshin-kamera --artifacts --lang pt --min-rarity 5
```

**Artefatos 5★ (em inglês — geralmente dá a maior precisão no Tesseract):**
```bash
.venv/bin/genshin-kamera --artifacts --lang en --min-rarity 5
```

**Teste rápido com apenas 10 artefatos:**
```bash
.venv/bin/genshin-kamera --artifacts --lang pt --max-items 10
```

**Armas 4★ e 5★ (abra a aba Armas da mochila antes):**
```bash
.venv/bin/genshin-kamera --weapons --lang pt --min-weapon-rarity 4
```

**Materiais (abra a aba Desenvolvimento de Personagem ou Materiais antes):**
```bash
.venv/bin/genshin-kamera --materials --lang pt
```

**Personagens (abra a tela de Personagens `C` no 1º personagem antes):**
```bash
.venv/bin/genshin-kamera --characters --lang pt
```

### Passo 4 — Importe no Genshin Smart Team Builder

O arquivo é salvo em `./output/genshinData_GOOD_AAAA_MM_DD_HH_MM.json`.

No **Genshin Smart Team Builder**:
- Vá em **Meu Roster** → botão **Importar GOOD (.json)**, **ou**
- Vá em **Planejador** → **Importar GOOD (.json)**.

Como o app faz **mesclagem inteligente** por seção (`characters`, `weapons`, `artifacts`, `materials`), você pode importar um JSON só de artefatos hoje e depois um só de armas ou materiais — ou importar diretamente um JSON gerado pelo [`rogerioth/Inventory_Kamera`](https://github.com/rogerioth/Inventory_Kamera) no Windows — sem perder o que já estava salvo.

---

## Opções da CLI

| Flag | Padrão | Descrição |
|---|---|---|
| `--calibrate` | `false` | Gera `./debug_crops/calibration_overlay.png` e recortes individuais |
| `--artifacts` | `false` | Escaneia a aba Artefatos |
| `--weapons` | `false` | Escaneia a aba Armas |
| `--materials` | `false` | Escaneia a aba atual de Materiais |
| `--characters` | `false` | Escaneia a tela de Personagens |
| `--lang {en,pt}` | `en` | Idioma da interface do Genshin |
| `--min-rarity N` | `5` | Raridade mínima para artefatos |
| `--min-weapon-rarity N` | `4` | Raridade mínima para armas |
| `--min-level N` | `0` | Nível mínimo para artefatos |
| `--max-items N` | ilimitado | Limite máximo de itens (ótimo para testar) |
| `--delay S` | `0.09` | Pausa em segundos entre cliques (aumente para `0.15` se o jogo engasgar) |
| `--countdown S` | `3` | Contagem regressiva em segundos antes de começar |
| `--geometry X,Y,W,H` | auto | Força posição e resolução da janela (ex.: `0,0,1920,1080` ou `1280x720`) |
| `--display {x11,wayland}` | auto | Força o backend de captura/input |
| `--api-url URL` | `http://localhost:8000/api` | API local do app para enriquecer nomes de sets |
| `--out DIR` | `./output` | Pasta onde salvar o arquivo `genshinData_GOOD_*.json` |

---

## Rodando os testes unitários

```bash
cd linux-scanner
.venv/bin/pytest -v
```
