#!/usr/bin/env python3
"""Helper de captura de tela nativa para GNOME / KDE Wayland via xdg-desktop-portal + PipeWire + GStreamer.

Executa com `/usr/bin/python3` (para usar `python3-gi` e `gir1.2-gstreamer-1.0` do sistema) e se
comunica via stdin/stdout com o processo principal do `genshin-kamera`:
  - Ao iniciar: abre 1x o diálogo nativo 'Compartilhar Tela' do GNOME/KDE e imprime `READY <W> <H>`.
  - A cada linha `GRAB` no stdin: drena o frame mais recente do PipeWire e responde:
        FRAME <W> <H> <NBYTES>\n<raw RGB bytes>
  - Ao receber `QUIT` ou EOF: encerra o stream PipeWire e fecha a sessão do portal.
"""
import os
import sys
import threading
import uuid

import gi

gi.require_version("Gio", "2.0")
gi.require_version("GLib", "2.0")
gi.require_version("Gst", "1.0")
from gi.repository import Gio, GLib, Gst  # noqa: E402

PORTAL_BUS = "org.freedesktop.portal.Desktop"
PORTAL_PATH = "/org/freedesktop/portal/desktop"
SCREENCAST_IFACE = "org.freedesktop.portal.ScreenCast"
REQUEST_IFACE = "org.freedesktop.portal.Request"


def _log(msg: str) -> None:
    print(f"[Portal] {msg}", file=sys.stderr, flush=True)


def _portal_call(bus: Gio.DBusConnection, method: str, params_type: str, params_tuple: tuple):
    """Executa um método assíncrono do xdg-desktop-portal e aguarda o sinal Request.Response."""
    loop = GLib.MainLoop()
    result_box: dict = {}

    sender = bus.get_unique_name().lstrip(":").replace(".", "_")
    token = f"gk_{uuid.uuid4().hex[:12]}"
    req_path = f"/org/freedesktop/portal/desktop/request/{sender}/{token}"

    # Injeta handle_token no último dict de opções
    opts = dict(params_tuple[-1])
    opts["handle_token"] = GLib.Variant("s", token)
    full_params = params_tuple[:-1] + (opts,)

    def on_response(_conn, _sender, _obj_path, _iface, _signal, parameters):
        response_code, results = parameters.unpack()
        result_box["code"] = response_code
        result_box["results"] = results
        loop.quit()

    sub_id = bus.signal_subscribe(
        PORTAL_BUS,
        REQUEST_IFACE,
        "Response",
        req_path,
        None,
        Gio.DBusSignalFlags.NO_MATCH_RULE,
        on_response,
    )
    try:
        bus.call_sync(
            PORTAL_BUS,
            PORTAL_PATH,
            SCREENCAST_IFACE,
            method,
            GLib.Variant(params_type, full_params),
            None,
            Gio.DBusCallFlags.NONE,
            -1,
            None,
        )
        loop.run()
    finally:
        bus.signal_unsubscribe(sub_id)

    code = result_box.get("code", 2)
    if code != 0:
        raise RuntimeError(f"Portal ScreenCast.{method} cancelado ou falhou (código={code}).")
    return result_box.get("results", {})


def _extract_rgb_from_sample(sample) -> tuple[int, int, bytes]:
    caps = sample.get_caps().get_structure(0)
    w = int(caps.get_value("width"))
    h = int(caps.get_value("height"))
    buf = sample.get_buffer()
    ok, map_info = buf.map(Gst.MapFlags.READ)
    if not ok:
        raise RuntimeError("Falha ao mapear buffer GStreamer.")
    try:
        raw = bytes(map_info.data)
    finally:
        buf.unmap(map_info)

    row_bytes = w * 3
    if len(raw) == row_bytes * h:
        return w, h, raw
    # GStreamer alinha linhas de vídeo RGB a múltiplos de 4 bytes — remove padding se houver
    stride = len(raw) // h
    if stride >= row_bytes:
        trimmed = bytearray(row_bytes * h)
        for y in range(h):
            src_off = y * stride
            dst_off = y * row_bytes
            trimmed[dst_off : dst_off + row_bytes] = raw[src_off : src_off + row_bytes]
        return w, h, bytes(trimmed)
    return w, h, raw[: row_bytes * h]


def main() -> int:
    Gst.init(None)
    if Gst.ElementFactory.find("pipewiresrc") is None:
        _log("ERRO: plugin GStreamer `pipewiresrc` não encontrado. Instale `gstreamer1.0-pipewire`.")
        return 2

    bus = Gio.bus_get_sync(Gio.BusType.SESSION, None)
    sess_token = f"gks_{uuid.uuid4().hex[:10]}"

    _log("Abrindo diálogo 'Compartilhar Tela' — selecione a janela 'Genshin Impact' (ou o monitor do jogo)...")
    res_create = _portal_call(
        bus,
        "CreateSession",
        "(a{sv})",
        ({"session_handle_token": GLib.Variant("s", sess_token)},),
    )
    session_handle = res_create["session_handle"]

    # types=3 (1=Monitor | 2=Window), cursor_mode=1 (Hidden para o cursor não atrapalhar OCR)
    _portal_call(
        bus,
        "SelectSources",
        "(oa{sv})",
        (
            session_handle,
            {
                "types": GLib.Variant("u", 3),
                "multiple": GLib.Variant("b", False),
                "cursor_mode": GLib.Variant("u", 1),
            },
        ),
    )

    res_start = _portal_call(bus, "Start", "(osa{sv})", (session_handle, "", {}))
    streams = res_start.get("streams") or []
    if not streams:
        _log("ERRO: nenhum stream retornado pelo portal.")
        return 3
    node_id = int(streams[0][0])

    ret_val, out_fd_list = bus.call_with_unix_fd_list_sync(
        PORTAL_BUS,
        PORTAL_PATH,
        SCREENCAST_IFACE,
        "OpenPipeWireRemote",
        GLib.Variant("(oa{sv})", (session_handle, {})),
        GLib.VariantType("(h)"),
        Gio.DBusCallFlags.NONE,
        -1,
        None,
        None,
    )
    fd_idx = int(ret_val.unpack()[0])
    pw_fd = os.dup(out_fd_list.get(fd_idx))

    pipeline_desc = (
        f"pipewiresrc fd={pw_fd} path={node_id} do-timestamp=true ! "
        "videoconvert ! video/x-raw,format=RGB ! "
        "appsink name=sink emit-signals=false max-buffers=1 drop=true sync=false"
    )
    pipeline = Gst.parse_launch(pipeline_desc)
    sink = pipeline.get_by_name("sink")

    # Mantém o frame mais recente em uma thread dedicada (PipeWire só envia frame quando algo muda!)
    frame_lock = threading.Lock()
    frame_event = threading.Event()
    latest_frame: list = []
    stop_flag = threading.Event()

    def reader_loop() -> None:
        while not stop_flag.is_set():
            sample = sink.emit("try-pull-sample", 200 * Gst.MSECOND)
            if sample is not None:
                try:
                    w, h, data = _extract_rgb_from_sample(sample)
                    with frame_lock:
                        latest_frame[:] = [w, h, data]
                    frame_event.set()
                except Exception as exc:
                    _log(f"Erro lendo frame: {exc}")

    pipeline.set_state(Gst.State.PLAYING)
    reader_thread = threading.Thread(target=reader_loop, daemon=True)
    reader_thread.start()

    try:
        if not frame_event.wait(timeout=10.0):
            _log("ERRO: timeout aguardando primeiro frame do PipeWire.")
            return 4

        with frame_lock:
            w0, h0, _ = latest_frame
        _log(f"Stream PipeWire ativo: {w0}x{h0} (zero-flash!)")
        sys.stdout.buffer.write(f"READY {w0} {h0}\n".encode("ascii"))
        sys.stdout.buffer.flush()

        for raw_line in sys.stdin.buffer:
            cmd = raw_line.decode("ascii", errors="ignore").strip().upper()
            if cmd == "QUIT":
                break
            if cmd == "GRAB":
                # Espera brevemente por um frame novo pós-clique, mas nunca trava se a tela estiver parada
                frame_event.clear()
                frame_event.wait(timeout=0.06)
                with frame_lock:
                    w, h, data = latest_frame
                header = f"FRAME {w} {h} {len(data)}\n".encode("ascii")
                sys.stdout.buffer.write(header)
                sys.stdout.buffer.write(data)
                sys.stdout.buffer.flush()
    except KeyboardInterrupt:
        pass
    finally:
        stop_flag.set()
        pipeline.set_state(Gst.State.NULL)
        try:
            os.close(pw_fd)
        except OSError:
            pass
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(0)
