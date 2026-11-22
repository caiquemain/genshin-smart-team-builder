# Genshin Kamera Linux (`genshin-kamera`)

Scanner nativo de inventário do **Genshin Impact** para **Linux (GNOME/KDE Wayland, wlroots e X11)**, inspirado na calibração testada em campo do [`rogerioth/Inventory_Kamera`](https://github.com/rogerioth/Inventory_Kamera) e totalmente integrado ao **Genshin Smart Team Builder**.

Exporta arquivos `.json` no formato **GOOD v2** (`format: "GOOD"`, `version: 2`, `kamera_version`, `characters`, `weapons`, `artifacts` com suporte a `unactivatedSubstats` da 6.0+ e `materials`), prontos para importar em **Meu Roster** ou no **Planejador** do app — ou no Genshin Optimizer.

---

## Recursos

- **Captura nativa sem flash no GNOME / KDE Wayland (`portal`):** usa `xdg-desktop-portal` ScreenCast + PipeWire + GStreamer ([`portal_capture.py`](genshin_kamera/portal_capture.py)), abrindo o diálogo nativo *"Compartilhar Tela"* apenas 1 vez por sessão e capturando frames instantâneos em tempo real (sem tela preta do X11).
- **X11 e wlroots também suportados:** captura via `mss` (X11) ou `grim` (Hyprland/Sway) e cliques via `xdotool` (X11 e XWayland — incluindo Wine/Proton/Heroic com clique sustentado de 55ms) ou `ydotool` (v0.1.8 e v1.0+).
- **EN e PT-BR (inclusive 6.x Nod-Krai):** OCR via Tesseract (`eng` e `por+eng`) com recorte automático da pílula escura do nível (`+20`), fuzzy matching contra `frontend/public/planner-data.json` e a API local (`http://localhost:8000/artifacts`), suporte a `Flor da Vida`, `Pluma da Morte`, `Areia do tempo`, `Cálice`, `Tiara` e sets recentes como *Noite da Revelação do Céu*.
- **Geometria 16:9 e 16:10 calibrada:** grade `8×4` (32 ícones inteiros por página, sem clicar na 5ª linha cortada pelo filtro inferior), detecção do banner roxo *Definição de Elixir Santificador*, cadeado vermelho-coral 5.x/6.x e 4ª linha `(unactivated)` / `(A ser ativado)` da versão 6.0+.
- **Modo `--calibrate` + `--test-click`:** salva `calibration_overlay.png` com todas as caixas desenhadas e já executa o OCR ao vivo no terminal antes de mover o mouse.
- **Scans parciais & mesclagem inteligente:** você pode escanear apenas `--artifacts`, `--weapons`, `--materials` ou `--characters`; o Genshin Smart Team Builder mescla cada seção sem apagar o restante salvo na conta.
- **Failsafe de emergência:** mova o mouse para o canto superior esquerdo `(0, 0)` ou pressione `Ctrl+C` a qualquer momento — o scanner para imediatamente e salva tudo o que já leu.

---

## Pré-requisitos no Linux

### 1. Dependências do sistema

**Ubuntu / Debian / Pop!_OS / Mint (recomendado — inclui suporte GNOME Wayland PipeWire):**
```bash
sudo apt update
sudo apt install -y python3-venv tesseract-ocr tesseract-ocr-eng tesseract-ocr-por xdotool \
  python3-gi gir1.2-gstreamer-1.0 gstreamer1.0-pipewire
```

**Arch / Manjaro / EndeavourOS / SteamOS:**
```bash
sudo pacman -S tesseract tesseract-data-eng tesseract-data-por xdotool \
  python-gobject gstreamer gst-plugin-pipewire
```

**Fedora:**
```bash
sudo dnf install tesseract tesseract-langpack-eng tesseract-langpack-por xdotool \
  python3-gobject gstreamer1 gstreamer1-plugin-pipewire
```

> **Usuários de Hyprland / Sway (wlroots):** instale também `grim` e `ydotool` (e deixe `ydotoold` ativo: `sudo systemctl enable --now ydotool`).

### 2. Instalação do scanner

Na pasta `linux-scanner/`:

```bash
cd linux-scanner
./install.sh
```

Isso cria um `.venv` isolado e instala o comando `.venv/bin/genshin-kamera` em modo editável (após futuros `git pull`, não precisa reinstalar).

---

## Como usar

### Passo 1 — Prepare a janela do jogo
1. Abra o Genshin Impact (Heroic, Steam/Proton, Lutris ou AAGL) em **16:9** (`1920×1080` ou `1280×720`, modo Janela ou Tela Cheia sem Bordas; 16:10 também é suportado).
2. Abra a **Mochila (`B`)** na aba **Artefatos**.
3. **Importante:** limpe filtros como *"Não Equipado"* se quiser escanear também os artefatos equipados nos seus personagens!
4. Para escanear **todos os 5★** (inclusive `+0`), ordene por **Qualidade**; para escanear **só artefatos upados** mais rápido, ordene por **Nível** e use `--min-level 16`.

### Passo 2 — Valide captura, recortes e OCR (`--calibrate`)
Execute o comando abaixo. No GNOME/KDE Wayland, aparecerá o diálogo **"Compartilhar Tela"** — selecione a janela **Genshin Impact** (ou o monitor do jogo) e clique em **Compartilhar**, depois foque o jogo na contagem de 3s:

```bash
.venv/bin/genshin-kamera --calibrate --lang pt
```

O terminal imprimirá imediatamente:
- Status da captura (`Captura OK`), contador do topo (`ex.: 2417/2700`), detecção de *Elixir Santificador* e o **JSON do artefato selecionado**;
- O arquivo `./debug_crops/calibration_overlay.png` (retângulo verde no card, 32 círculos azuis no centro da grade `8×4`, retângulo amarelo no contador e recortes rosa internos).

> Se quiser confirmar em 3 segundos se os cliques estão sendo registrados no jogo (Wine/Heroic/Proton), rode:
> ```bash
> .venv/bin/genshin-kamera --test-click --lang pt
> ```

### Passo 3 — Escaneie o que quiser

> **Importante:** rode **um comando de cada vez**, com a aba correspondente já aberta no Genshin.

**Teste rápido com 10 artefatos 5★ em PT-BR:**
```bash
.venv/bin/genshin-kamera --artifacts --lang pt --min-rarity 5 --max-items 10
```

**Artefatos 5★ upados (`+16` ou mais — rápido, ideal para builds equipadas):**
```bash
.venv/bin/genshin-kamera --artifacts --lang pt --min-rarity 5 --min-level 16
```

**Todos os artefatos 5★ (ordene por Qualidade no jogo — ideal para o Auditor de Mochila):**
```bash
.venv/bin/genshin-kamera --artifacts --lang pt --min-rarity 5
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
- Vá em **Meu Roster** → **Importar GOOD (.json)**, **ou**
- Vá em **Planejador** → **Importar GOOD (.json)**.

Como o app faz **mesclagem inteligente por seção** (`characters`, `weapons`, `artifacts`, `materials`), você pode importar artefatos, armas e materiais separadamente — ou importar JSONs gerados pelo [`rogerioth/Inventory_Kamera`](https://github.com/rogerioth/Inventory_Kamera) no Windows — sem apagar o restante da conta.

---

## Opções da CLI

| Flag | Padrão | Descrição |
|---|---|---|
| `--calibrate` | `false` | Gera `./debug_crops/calibration_overlay.png`, recortes individuais e testa OCR ao vivo |
| `--test-click` | `false` | Clica no 2º e 1º artefato da grade e confirma se clique + OCR funcionaram |
| `--artifacts` | `false` | Escaneia a aba Artefatos |
| `--weapons` | `false` | Escaneia a aba Armas |
| `--materials` | `false` | Escaneia a aba atual de Materiais |
| `--characters` | `false` | Escaneia a tela de Personagens |
| `--lang {en,pt}` | `en` | Idioma da interface do Genshin |
| `--min-rarity N` | `5` | Raridade mínima para artefatos |
| `--min-weapon-rarity N` | `4` | Raridade mínima para armas |
| `--min-level N` | `0` | Nível mínimo para artefatos |
| `--max-items N` | ilimitado | Limite máximo de itens (ótimo para testar) |
| `--delay S` | `0.13` | Pausa em segundos entre cliques (aumente para `0.18` se o jogo engasgar) |
| `--countdown S` | `3` | Contagem regressiva em segundos antes de começar |
| `--geometry X,Y,W,H` | auto | Força posição e resolução da janela (ex.: `1920,0,1920,1080` ou `1280x720`) |
| `--display {x11,wayland}` | auto | Força detecção de sessão X11 ou Wayland |
| `--capture {auto,portal,mss,grim,gnome-screenshot}` | `auto` | Backend de captura (`portal` é escolhido automaticamente no GNOME/KDE Wayland) |
| `--input {auto,xdotool,ydotool}` | `auto` | Backend de mouse/scroll (`xdotool` funciona em X11 e XWayland; `ydotool` para Wayland puro) |
| `--api-url URL` | `http://localhost:8000` | API local do app para carregar todos os sets de artefatos (EN + PT) |
| `--out DIR` | `./output` | Pasta onde salvar o arquivo `genshinData_GOOD_*.json` |

---

## Rodando os testes unitários

```bash
cd linux-scanner
.venv/bin/pytest -v
```
