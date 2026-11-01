# Avance

Controle seus slides em tela cheia com gestos das mãos, pela webcam.
Os gestos são reconhecidos pelo MediaPipe Hand Landmarker, que roda no próprio navegador.

## Como usar

1. Dê dois cliques em **`Iniciar.bat`**. O servidor local sobe e o navegador abre em `http://127.0.0.1:8765`.
2. Permita o acesso à câmera.
3. Na tela inicial, clique em **Abrir apresentação** ou reabra um arquivo da lista de **Recentes**.
   Os recentes ficam guardados só neste navegador, e um .pptx não precisa ser convertido de novo.
4. Siga as 3 etapas:
   - **Slides:** arraste um **.pdf**, um **.pptx** ou várias **imagens** (ordenadas pelo nome). Clique numa miniatura para escolher o slide inicial.
   - **Calibração:** faça os gestos até completar o teste rápido. O painel explica por que um movimento não foi aceito.
   - **Apresentar:** escolha uma meta de duração (opcional) e inicie. Ao sair com `Esc`, dá para continuar do mesmo slide e do mesmo tempo.

O cronômetro fica âmbar a partir de 80% da meta e vermelho quando ela é ultrapassada.

| Gesto | Ação |
|---|---|
| Mão **esquerda** aberta, palma para a câmera, 5 dedos estendidos | Ativa o gatilho (borda verde) |
| Mão **direita** da direita para a esquerda (com o gatilho ativo) | Avança o slide |
| Mão **direita** da esquerda para a direita (com o gatilho ativo) | Volta o slide |

Teclado e mouse: `→` `PageDown` `Espaço` ou clique avançam. `←` `PageUp` ou clique direito voltam.
`Home` e `End` vão para o primeiro e o último slide. `T` mostra ou oculta o cronômetro e `R` zera.
`C` mostra a câmera. `F` liga e desliga a tela cheia. `Esc` sai.
Os passadores de slides (clickers) USB funcionam normalmente.

## Arquivos

- `index.html`, `css/`, `js/`: a aplicação web
  - `js/gestures.js`: detecção do gatilho e dos swipes (limiares, pausa entre comandos, bloqueio do movimento de retorno da mão)
  - `js/slides.js`: renderização de PDF (pdf.js) e de imagens, na resolução da tela
  - `js/app.js`: interface, modo apresentação e transições
  - `js/recent.js`: arquivos recentes (IndexedDB do navegador)
- `server.py`: servidor local; também converte .pptx em PDF
- `converter-pptx.ps1`: conversão .pptx → PDF pelo PowerPoint instalado (também funciona sozinho)
- `publicar.py`: monta a versão web na pasta `site/` (ver abaixo)
- `gerar_exe.py`: gera o `dist/Avance.exe` (ver abaixo)
- `download.html`: página do site para baixar o Avance para Windows

## Requisitos

- Python 3 e um navegador baseado em Chromium (Chrome ou Edge)
- Microsoft PowerPoint, apenas para abrir arquivos .pptx
- Internet no primeiro carregamento, para baixar o MediaPipe, o pdf.js e o modelo de mãos

## Publicar na web

O mesmo app funciona como site. Ele percebe sozinho onde está rodando:

| | Versão para computador (Iniciar.bat) | Versão web (site) |
|---|---|---|
| PDF e imagens | ✅ | ✅ |
| PowerPoint (.pptx) | ✅ convertido pelo PowerPoint instalado | Mostra como salvar em PDF e oferece baixar o Avance.exe |
| Gestos, cronômetro, recentes | ✅ | ✅ |

Na versão web, a tela inicial também mostra as seções "Versão para computador", "Dúvidas
frequentes" e "Privacidade". Em telas pequenas, um aviso explica que o app foi feito para computador.

### Gerar o Avance.exe (versão para Windows)

O `.exe` reúne o servidor local e as páginas num arquivo só: quem baixa não precisa de Python.
Precisa do PyInstaller, instalado uma vez:

```
python -m pip install pyinstaller
python gerar_exe.py
```

O resultado fica em `dist/Avance.exe` (cerca de 8 MB). O Windows mostra o aviso do SmartScreen
na primeira execução porque o arquivo não tem assinatura digital; a página de download explica
como seguir ("Mais informações" → "Executar assim mesmo").

O `.exe` é distribuído pelo **GitHub Releases**, não fica dentro do código. O botão da página
de download aponta para `…/releases/latest/download/Avance.exe`, que sempre leva à versão mais nova.
Para publicar uma versão nova (troque o número):

```
gh release create v1.1.0 dist/Avance.exe --title "Avance 1.1.0" --notes "O que mudou"
```

### Site na Vercel (via GitHub)

O site é publicado a partir deste repositório: https://github.com/sacramentobernardes/Avance

- A Vercel serve os arquivos da raiz do jeito que estão, sem etapa de build.
- O `.vercelignore` deixa de fora o que é só da versão para computador (`server.py`, `Iniciar.bat`…).
- Cada `git push` na branch `main` atualiza o site sozinho em cerca de 1 minuto.

Configuração (uma vez): em vercel.com → **Add New… → Project** → importe o repositório
`Avance` → em **Framework Preset** deixe **Other**, sem comando de build e com a pasta raiz
(`./`) → **Deploy**.

### Outras hospedagens (Netlify, Cloudflare Pages)

`python publicar.py` monta a pasta `site/` só com os arquivos do site; envie essa pasta
pela área de upload do serviço.
