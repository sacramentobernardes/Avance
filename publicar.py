"""Monta a versão web do Avance na pasta site/, pronta para subir numa hospedagem.

O instalador (Avance-Setup.exe) não vai para o site: ele é publicado no GitHub Releases, e o botão da
página download.html aponta para lá.

Uso:  python publicar.py
Serve para hospedagens em que você envia uma pasta (Netlify, Cloudflare Pages). Na Vercel
com GitHub não é preciso: ela publica direto os arquivos do repositório.
"""

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "site"

# O que o navegador usa.
WEB_FILES = ["index.html", "download.html", "favicon.ico", "favicon.svg", "apple-touch-icon.png"]
WEB_DIRS = ["css", "js"]


def copy_web(dest: Path):
    for name in WEB_FILES:
        shutil.copy2(ROOT / name, dest / name)
    for name in WEB_DIRS:
        shutil.copytree(ROOT / name, dest / name, ignore=shutil.ignore_patterns("__pycache__"))


def main():
    # Limpa o conteúdo em vez de apagar a pasta: funciona mesmo com ela aberta no Explorer.
    OUT.mkdir(exist_ok=True)
    for item in OUT.iterdir():
        shutil.rmtree(item) if item.is_dir() else item.unlink()
    copy_web(OUT)

    files = sorted(p for p in OUT.rglob("*") if p.is_file())
    size = sum(p.stat().st_size for p in files)
    print(f"Site montado em {OUT} ({len(files)} arquivos, {size / 1024:.0f} KB):")
    for p in files:
        print("  ", p.relative_to(OUT).as_posix())


if __name__ == "__main__":
    main()
