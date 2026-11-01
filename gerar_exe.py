"""Gera o Avance.exe: o app inteiro (servidor local + páginas) num único executável.

Quem baixa o .exe não precisa ter Python. O PowerPoint continua sendo necessário só para
abrir arquivos .pptx.

Uso (uma vez):  python -m pip install pyinstaller
Depois:         python gerar_exe.py     → cria dist/Avance.exe
O publicar.py copia o dist/Avance.exe para o site, se ele existir.
"""

import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BUILD = ROOT / "build"
DIST = ROOT / "dist"

# Arquivos que o servidor entrega ao navegador, mais o conversor de .pptx.
DATA = ["index.html", "favicon.ico", "favicon.svg", "apple-touch-icon.png", "converter-pptx.ps1", "css", "js"]


def main():
    try:
        import PyInstaller  # noqa: F401
    except ImportError:
        sys.exit("O PyInstaller não está instalado. Rode: python -m pip install pyinstaller")

    sep = ";" if sys.platform == "win32" else ":"
    args = [
        sys.executable, "-m", "PyInstaller",
        "--onefile", "--noconfirm", "--clean",
        "--name", "Avance",
        "--icon", str(ROOT / "favicon.ico"),
        "--distpath", str(DIST),
        "--workpath", str(BUILD / "work"),
        "--specpath", str(BUILD),
    ]
    for name in DATA:
        src = ROOT / name
        args += ["--add-data", f"{src}{sep}{name if src.is_dir() else '.'}"]
    args.append(str(ROOT / "server.py"))

    subprocess.run(args, check=True)
    shutil.rmtree(BUILD, ignore_errors=True)  # arquivos intermediários do PyInstaller

    exe = DIST / "Avance.exe"
    print(f"\nPronto: {exe} ({exe.stat().st_size / 1024 / 1024:.1f} MB)")


if __name__ == "__main__":
    main()
