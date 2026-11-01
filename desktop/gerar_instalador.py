"""Gera o instalador do Avance para Windows: dist/Avance-Setup.exe.

Etapas:
1. PyInstaller empacota o app.py (janela própria via WebView2) em dist/Avance/.
2. Inno Setup transforma essa pasta no instalador, com atalhos e desinstalação.

Pré-requisitos (uma vez):
  python -m pip install pyinstaller pywebview
  Inno Setup 6:  winget install JRSoftware.InnoSetup

Uso:  python desktop/gerar_instalador.py
"""

import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent  # desktop/
REPO = HERE.parent
WEB = REPO / "web"
BUILD = REPO / "build"
DIST = REPO / "dist"

# O que o servidor interno entrega à janela (de web/), mais o conversor de .pptx (de desktop/).
DATA = [WEB / "index.html", WEB / "favicon.ico", WEB / "favicon.svg", WEB / "apple-touch-icon.png",
        WEB / "css", WEB / "js", HERE / "converter-pptx.ps1"]

ISCC_PATHS = [
    Path(os.environ.get("LOCALAPPDATA", "")) / "Programs" / "Inno Setup 6" / "ISCC.exe",
    Path(os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)")) / "Inno Setup 6" / "ISCC.exe",
    Path(os.environ.get("ProgramFiles", r"C:\Program Files")) / "Inno Setup 6" / "ISCC.exe",
]


def app_version():
    return re.search(r'^APP_VERSION = "([^"]+)"', (HERE / "app.py").read_text(encoding="utf-8"), re.M).group(1)


def build_app():
    try:
        import PyInstaller  # noqa: F401
        import webview  # noqa: F401
    except ImportError:
        sys.exit("Faltam dependências. Rode: python -m pip install pyinstaller pywebview")

    args = [
        sys.executable, "-m", "PyInstaller",
        "--onedir", "--windowed", "--noconfirm", "--clean",
        "--name", "Avance",
        "--icon", str(WEB / "favicon.ico"),
        "--distpath", str(DIST),
        "--workpath", str(BUILD / "work"),
        "--specpath", str(BUILD),
    ]
    for src in DATA:
        args += ["--add-data", f"{src};{src.name if src.is_dir() else '.'}"]
    args.append(str(HERE / "app.py"))
    subprocess.run(args, check=True)


def build_installer(version):
    iscc = next((p for p in ISCC_PATHS if p.exists()), None)
    if not iscc:
        sys.exit("Inno Setup 6 não encontrado. Instale com: winget install JRSoftware.InnoSetup")
    subprocess.run([str(iscc), "/Q", f"/DAppVersion={version}", str(HERE / "instalador.iss")], check=True)


def main():
    version = app_version()
    build_app()
    build_installer(version)
    shutil.rmtree(BUILD, ignore_errors=True)  # arquivos intermediários do PyInstaller

    setup = DIST / "Avance-Setup.exe"
    print(f"\nPronto: {setup} (versão {version}, {setup.stat().st_size / 1024 / 1024:.1f} MB)")


if __name__ == "__main__":
    main()
