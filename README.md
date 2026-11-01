# Avance

Passe os slides com gestos da mão, pela webcam. Levante a mão esquerda (gatilho) e deslize a direita para avançar ou voltar.

- **No navegador:** [www.avance.dev.br](https://www.avance.dev.br) (PDF e imagens)
- **Aplicativo para Windows:** [baixar o instalador](https://github.com/sacramentobernardes/Avance/releases/latest/download/Avance-Setup.exe) (também abre PowerPoint)
- **Documentação completa:** [docs/Avance-Documentacao.pdf](docs/Avance-Documentacao.pdf)

<details>
<summary><b>Gestos e atalhos</b></summary>

| Gesto | Efeito |
|---|---|
| Mão **esquerda** aberta, palma para a câmera | Liga o gatilho (moldura verde) |
| Mão **direita** da direita para a esquerda | Avança |
| Mão **direita** da esquerda para a direita | Volta |

Teclado: `→` `Espaço` avançam · `←` volta · `Home`/`End` primeiro e último · `T` cronômetro · `R` zera · `C` câmera num canto · `F` tela cheia · `Esc` sai.
A apresentação só começa com a câmera ligada (interruptor no canto superior direito).
</details>

<details>
<summary><b>Estrutura do projeto</b></summary>

```
web/       o app (site e aplicativo usam os mesmos arquivos)
  js/      módulos: main, state, settings, screens, files, slides, recents,
           recent-store, presentation, timer, camera, gestures
desktop/   aplicativo para Windows: app.py (janela), server.py (servidor local
           e conversão de .pptx), converter-pptx.ps1, instalador.iss, gerar_instalador.py
docs/      documentação em PDF e o script que a gera
```
</details>

<details>
<summary><b>Desenvolver</b></summary>

Requer Python 3; para abrir .pptx, o PowerPoint instalado.

```
python desktop/server.py              # no navegador, em http://127.0.0.1:8765
python -m pip install pywebview
python desktop/app.py                 # como aplicativo
```
</details>

<details>
<summary><b>Publicar uma versão nova</b></summary>

Pré-requisitos, uma vez: `python -m pip install pyinstaller pywebview` e `winget install JRSoftware.InnoSetup`.

1. Aumente `APP_VERSION` em `desktop/app.py`.
2. `python desktop/gerar_instalador.py` → cria `dist/Avance-Setup.exe`.
3. `gh release create vX.Y.Z dist/Avance-Setup.exe --title "Avance X.Y.Z"`
4. `git push` → a Vercel publica a pasta `web/` (configurada em `vercel.json`) em cerca de 1 minuto.

Publique o instalador antes do `git push`: o botão de download aponta para a versão mais nova do GitHub Releases.
Para atualizar a documentação: `python -m pip install reportlab` e `python docs/gerar_pdf.py`.
</details>
