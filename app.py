"""Avance como aplicativo de Windows: janela própria, sem navegador e sem console.

Roda o mesmo servidor local do server.py numa thread e mostra o app numa janela do
WebView2 (o motor do Edge que já vem no Windows 10 e 11), via pywebview.
O instalador (gerar_instalador.py) empacota este arquivo como Avance.exe.

Variáveis de ambiente úteis para teste:
  AVANCE_PORTA_APP   porta do servidor interno (padrão 47821)
  AVANCE_DEBUG_PORT  liga a depuração remota do WebView2 nessa porta
"""

import ctypes
import importlib
import os
import sys
import threading
from pathlib import Path

import webview

import server

APP_VERSION = "1.2.0"
# Porta fixa: o WebView2 guarda ajustes e recentes por endereço, então ela não pode mudar
# entre uma abertura e outra. É diferente da 8765 para não brigar com o Iniciar.bat.
PORT = int(os.environ.get("AVANCE_PORTA_APP", 47821))
ORIGIN = f"http://{server.HOST}:{PORT}"
DATA_DIR = Path(os.environ.get("LOCALAPPDATA", Path.home())) / "Avance"


def message(text):
    ctypes.windll.user32.MessageBoxW(None, text, "Avance", 0x10)


def start_server():
    if server.already_running(PORT):
        return  # outra janela do Avance já está com o servidor no ar: reaproveita
    try:
        httpd = server.make_server(PORT)
    except OSError:
        message(f"Não foi possível iniciar o Avance: a porta {PORT} está em uso por outro programa.")
        sys.exit(1)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()


def patch_webview2():
    """Liga dois comportamentos que o pywebview não trata sozinho:
    - libera a câmera só para o próprio Avance, sem pedir permissão a cada abertura;
    - quando a apresentação entra em tela cheia, a janela inteira vai junto.
    """
    importlib.import_module("webview.platforms.winforms")  # carrega o .NET e o WebView2
    from webview.platforms import edgechromium
    from Microsoft.Web.WebView2.Core import CoreWebView2PermissionKind, CoreWebView2PermissionState

    original_ready = edgechromium.EdgeChrome.on_webview_ready

    def on_ready(self, sender, args):
        original_ready(self, sender, args)
        if not args.IsSuccess:
            return
        core = sender.CoreWebView2
        window = self.pywebview_window

        def on_permission(_, e):
            if str(e.Uri).startswith(ORIGIN) and e.PermissionKind == CoreWebView2PermissionKind.Camera:
                e.State = CoreWebView2PermissionState.Allow

        state = {"fullscreen": False}

        def on_fullscreen(_, __):
            wants = bool(core.ContainsFullScreenElement)
            if wants != state["fullscreen"]:
                state["fullscreen"] = wants
                window.toggle_fullscreen()

        core.PermissionRequested += on_permission
        core.ContainsFullScreenElementChanged += on_fullscreen

    edgechromium.EdgeChrome.on_webview_ready = on_ready


def main():
    start_server()

    debug_port = os.environ.get("AVANCE_DEBUG_PORT")
    if debug_port:
        webview.settings["REMOTE_DEBUGGING_PORT"] = int(debug_port)

    webview.create_window(
        "Avance", f"{ORIGIN}/",
        width=1280, height=820, min_size=(900, 600), background_color="#F5F6F7",
    )
    patch_webview2()

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    webview.start(gui="edgechromium", private_mode=False, storage_path=str(DATA_DIR / "WebView2"))


if __name__ == "__main__":
    main()
