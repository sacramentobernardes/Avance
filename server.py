"""Servidor local do Avance (apresentações controladas por gestos).

- Serve os arquivos da aplicação em http://127.0.0.1:8765 (a webcam exige localhost ou HTTPS).
- POST /convert recebe um .pptx e devolve o PDF gerado pelo PowerPoint instalado na máquina.

Também é o ponto de entrada do Avance.exe (gerado por gerar_exe.py).
"""

import json
import os
import socket
import subprocess
import sys
import tempfile
import webbrowser
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HOST = "127.0.0.1"
PORT = int(os.environ.get("AVANCE_PORTA", 8765))
# Dentro do Avance.exe, os arquivos do app ficam na pasta temporária do PyInstaller.
ROOT = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))
CONVERTER = ROOT / "converter-pptx.ps1"
MAX_UPLOAD = 300 * 1024 * 1024


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
    }

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        if self.path == "/health":
            return self._json(200, {"ok": True, "pptx": sys.platform == "win32"})
        return super().do_GET()

    def do_POST(self):
        if self.path != "/convert":
            return self._json(404, {"erro": "Rota inexistente."})

        length = int(self.headers.get("Content-Length") or 0)
        if not 0 < length <= MAX_UPLOAD:
            return self._json(413, {"erro": "Arquivo vazio ou grande demais."})

        with tempfile.TemporaryDirectory(prefix="avance-") as tmp:
            entrada = Path(tmp) / "apresentacao.pptx"
            saida = Path(tmp) / "apresentacao.pdf"
            entrada.write_bytes(self.rfile.read(length))

            proc = subprocess.run(
                [
                    "powershell", "-NoProfile", "-ExecutionPolicy", "Bypass",
                    "-File", str(CONVERTER), "-Entrada", str(entrada), "-Saida", str(saida),
                ],
                capture_output=True, text=True, timeout=180,
            )
            if proc.returncode != 0 or not saida.exists():
                detalhe = (proc.stderr or proc.stdout).strip()[-500:]
                return self._json(500, {"erro": "Falha ao converter com o PowerPoint.", "detalhe": detalhe})

            pdf = saida.read_bytes()

        self.send_response(200)
        self.send_header("Content-Type", "application/pdf")
        self.send_header("Content-Length", str(len(pdf)))
        self.end_headers()
        self.wfile.write(pdf)

    def _json(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        if self.command == "POST":
            super().log_message(fmt, *args)


def already_running():
    with socket.socket() as s:
        s.settimeout(0.5)
        return s.connect_ex((HOST, PORT)) == 0


def main():
    url = f"http://{HOST}:{PORT}/"
    if already_running():
        # Outra janela do Avance já está aberta: só mostra o app no navegador.
        print(f"O Avance já está aberto em {url}. Abrindo o navegador…")
        if "--no-browser" not in sys.argv:
            webbrowser.open(url)
        return

    server = ThreadingHTTPServer((HOST, PORT), partial(Handler, directory=str(ROOT)))
    if sys.platform == "win32":
        import ctypes
        ctypes.windll.kernel32.SetConsoleTitleW("Avance")
    print(f"Avance rodando em {url}")
    print("Deixe esta janela aberta enquanto usa o Avance. Para encerrar, feche a janela.")
    if "--no-browser" not in sys.argv:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
