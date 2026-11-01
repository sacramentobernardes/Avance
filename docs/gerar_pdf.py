"""Gera docs/Avance-Documentacao.pdf (guia de uso + documentação técnica).

Uso (uma vez):  python -m pip install reportlab
Depois:         python docs/gerar_pdf.py
O texto está todo neste arquivo; edite aqui e gere de novo quando o app mudar.
"""

import re
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (KeepTogether, PageBreak, Paragraph, Preformatted, SimpleDocTemplate,
                                Spacer, Table, TableStyle)

HERE = Path(__file__).resolve().parent
OUT = HERE / "Avance-Documentacao.pdf"
VERSION = re.search(r'^APP_VERSION = "([^"]+)"', (HERE.parent / "desktop" / "app.py").read_text(encoding="utf-8"), re.M).group(1)

# Fontes do Windows: cobrem acentos e setas (as fontes padrão do PDF não têm "→").
FONTS = Path(r"C:\Windows\Fonts")
pdfmetrics.registerFont(TTFont("Texto", str(FONTS / "segoeui.ttf")))
pdfmetrics.registerFont(TTFont("Texto-Negrito", str(FONTS / "segoeuib.ttf")))
pdfmetrics.registerFont(TTFont("Mono", str(FONTS / "consola.ttf")))
pdfmetrics.registerFontFamily("Texto", normal="Texto", bold="Texto-Negrito", italic="Texto", boldItalic="Texto-Negrito")

INK = colors.HexColor("#15171b")
INK2 = colors.HexColor("#5d6470")
RULE = colors.HexColor("#dfe2e6")
SHEET2 = colors.HexColor("#eef0f2")
LASER = colors.HexColor("#e3342a")

S = {
    "capa": ParagraphStyle("capa", fontName="Texto-Negrito", fontSize=40, leading=44, textColor=INK),
    "sub": ParagraphStyle("sub", fontName="Texto", fontSize=14, leading=20, textColor=INK2),
    "h1": ParagraphStyle("h1", fontName="Texto-Negrito", fontSize=19, leading=24, textColor=INK, spaceBefore=6, spaceAfter=8, keepWithNext=1),
    "h2": ParagraphStyle("h2", fontName="Texto-Negrito", fontSize=12.5, leading=17, textColor=INK, spaceBefore=10, spaceAfter=4, keepWithNext=1),
    "p": ParagraphStyle("p", fontName="Texto", fontSize=10, leading=15, textColor=INK, spaceAfter=6, alignment=TA_LEFT),
    "nota": ParagraphStyle("nota", fontName="Texto", fontSize=9.5, leading=14, textColor=INK2, spaceAfter=6),
    "li": ParagraphStyle("li", fontName="Texto", fontSize=10, leading=15, textColor=INK, leftIndent=14, bulletIndent=2, spaceAfter=2),
    "cel": ParagraphStyle("cel", fontName="Texto", fontSize=9, leading=12.5, textColor=INK),
    "celb": ParagraphStyle("celb", fontName="Texto-Negrito", fontSize=9, leading=12.5, textColor=INK),
    "code": ParagraphStyle("code", fontName="Mono", fontSize=8.6, leading=12, textColor=INK, backColor=SHEET2,
                           borderPadding=(6, 8, 6, 8), spaceBefore=4, spaceAfter=10, leftIndent=8),
    "sumario": ParagraphStyle("sumario", fontName="Texto", fontSize=11, leading=20, textColor=INK),
}


def code(text):
    """Trechos de código/caminhos dentro do texto."""
    return f'<font name="Mono" size="8.8">{text}</font>'


def p(text, style="p"):
    return Paragraph(text, S[style])


def bullets(items):
    return [Paragraph(t, S["li"], bulletText="•") for t in items]


def steps(items):
    return [Paragraph(t, S["li"], bulletText=f"{i}.") for i, t in enumerate(items, 1)]


def table(rows, widths, header=True):
    data = [[Paragraph(c, S["celb" if (header and r == 0) else "cel"]) for c in row] for r, row in enumerate(rows)]
    t = Table(data, colWidths=[w * mm for w in widths], repeatRows=1 if header else 0)
    style = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 0), (-1, -1), 0.5, RULE),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
    ]
    if header:
        style += [("LINEBELOW", (0, 0), (-1, 0), 0.9, INK2)]
    t.setStyle(TableStyle(style))
    return t


def block(text):
    return Preformatted(text.strip("\n"), S["code"])


def secao(numero, titulo):
    return p(f'<font color="#e3342a">{numero}</font>  {titulo}', "h1")


# ------------------------------------------------------------------ conteúdo

def capa():
    return [
        Spacer(1, 70 * mm),
        p('Avance<font color="#e3342a">.</font>', "capa"),
        Spacer(1, 6 * mm),
        p("Documentação: guia de uso e guia técnico", "sub"),
        p(f"Versão {VERSION} · novembro de 2026", "sub"),
        Spacer(1, 70 * mm),
        p("Site: www.avance.dev.br · Código: github.com/sacramentobernardes/Avance", "nota"),
        PageBreak(),
        p("Sumário", "h1"),
        *[p(t, "sumario") for t in [
            "<b>Guia de uso</b>",
            "1  Visão geral", "2  Primeiros passos", "3  Como apresentar", "4  Os gestos",
            "5  A câmera", "6  Durante a apresentação", "7  Solução de problemas", "8  Privacidade",
            "<b>Guia técnico</b>",
            "9  Estrutura do projeto", "10  Como o código está organizado", "11  Como o reconhecimento funciona",
            "12  Desenvolver e testar", "13  Gerar o instalador e publicar", "14  Histórico de versões",
        ]],
        PageBreak(),
    ]


def guia_uso():
    return [
        secao("1", "Visão geral"),
        p("O Avance passa os slides de uma apresentação com gestos da mão, usando a webcam. Você levanta a "
          "mão esquerda (o gatilho) e desliza a direita para avançar ou voltar, sem tocar no teclado nem "
          "precisar de passador."),
        p("Existem duas formas de usar, com as mesmas telas e os mesmos gestos:"),
        table([
            ["", "No navegador (site)", "Aplicativo para Windows"],
            ["Onde", "www.avance.dev.br, no Chrome ou Edge", "Instalado, aberto pelo Menu Iniciar"],
            ["PDF e imagens", "Sim", "Sim"],
            ["PowerPoint (.pptx)", "Salve em PDF antes", "Abre direto, usando o PowerPoint instalado"],
            ["Instalação", "Nenhuma", "Instalador de 12 MB, sem senha de administrador"],
            ["Sistemas", "Qualquer um com Chrome ou Edge", "Windows 10 e 11"],
        ], [38, 62, 70]),
        Spacer(1, 4),

        secao("2", "Primeiros passos"),
        p("No navegador", "h2"),
        *steps([
            "Abra <b>www.avance.dev.br</b> no Chrome ou no Edge, num notebook ou computador com webcam.",
            "Quando o navegador perguntar, permita o uso da câmera.",
            "Clique em <b>Abrir apresentação</b>.",
        ]),
        p("Aplicativo para Windows", "h2"),
        *steps([
            "Na página de download do site, clique em <b>Baixar o instalador</b> (Avance-Setup.exe).",
            "Abra o instalador. Se o Windows mostrar “O Windows protegeu o computador”, clique em "
            "<b>Mais informações</b> e depois em <b>Executar assim mesmo</b>. O aviso aparece porque o "
            "instalador ainda não tem assinatura digital.",
            "Clique em <b>Avançar</b> e em <b>Instalar</b>. Opcional: marque o atalho na Área de Trabalho.",
            "Abra o <b>Avance</b> pelo Menu Iniciar. A câmera é liberada automaticamente.",
        ]),
        p("Para atualizar, instale a versão nova por cima: ajustes e recentes são mantidos. Para remover, use "
          "Configurações → Aplicativos → Avance → Desinstalar.", "nota"),

        secao("3", "Como apresentar"),
        p("O Avance guia a apresentação em três etapas, mostradas no topo da tela."),
        table([
            ["Etapa", "O que fazer"],
            ["1  Slides", "Arraste um PDF, um PowerPoint (no aplicativo) ou várias imagens, que entram na ordem do "
                         "nome do arquivo. A ficha mostra formato, número de slides, proporção e tamanho. Clique "
                         "numa miniatura para começar a partir dela."],
            ["2  Calibração", "Faça os gestos em frente à câmera. O teste rápido marca cinco itens: câmera ligada, "
                             "mão esquerda visível, gatilho, avançar e voltar. O painel explica por que um "
                             "movimento não contou."],
            ["3  Apresentar", "Revise o resumo, escolha uma meta de duração (opcional) e clique em "
                             "<b>Iniciar apresentação</b>. A apresentação abre em tela cheia."],
        ], [32, 138]),
        Spacer(1, 6),
        p("Os arquivos abertos aparecem em <b>Abertos recentemente</b>, na tela inicial, e reabrem com um "
          "clique. Um PowerPoint já convertido não precisa ser convertido de novo."),

        secao("4", "Os gestos"),
        table([
            ["Gesto", "Como fazer", "Efeito"],
            ["Gatilho", "Mão <b>esquerda</b> levantada e aberta, palma para a câmera, cinco dedos estendidos", "Liga o controle (moldura verde)"],
            ["Avançar", "Com o gatilho ligado, mão <b>direita</b> da direita para a esquerda", "Próximo slide"],
            ["Voltar", "Com o gatilho ligado, mão <b>direita</b> da esquerda para a direita", "Slide anterior"],
        ], [26, 98, 46]),
        Spacer(1, 6),
        *bullets([
            "O gatilho é uma trava de segurança: sem ele, você pode gesticular à vontade enquanto fala.",
            "O slide troca quando a mão para, no fim do gesto. Pegar impulso para o lado oposto antes de voltar "
            "não atrapalha: o Avance entende o movimento inteiro.",
            "A distância do gesto é medida pelo tamanho da sua mão na imagem, então vale igual de perto ou de "
            "longe da câmera.",
            "Se os gestos parecerem difíceis ou sensíveis demais, ajuste a <b>sensibilidade</b> em "
            "Calibração → Ajustes dos gestos.",
        ]),

        secao("5", "A câmera"),
        p("O interruptor no canto superior direito liga e desliga a câmera. Desligada, o Avance solta a "
          "câmera de verdade (a luz da webcam apaga), e a escolha é lembrada na próxima abertura."),
        p("<b>A apresentação só começa com a câmera ligada.</b> Se você tentar iniciar com ela desligada, "
          "ainda ligando ou com problema, aparece um aviso explicando o motivo, com o botão para ligá-la."),
        table([
            ["Indicador", "Significado"],
            ["câmera ligada", "Pronta para reconhecer os gestos"],
            ["gatilho ligado", "A mão esquerda está fazendo o gatilho"],
            ["ligando a câmera", "Câmera e reconhecimento das mãos carregando"],
            ["câmera desligada", "Desligada pelo interruptor"],
            ["câmera com problema", "Sem permissão, sem webcam, em uso por outro programa ou desconectada"],
        ], [45, 125]),

        secao("6", "Durante a apresentação"),
        table([
            ["Tecla", "Ação"],
            ["→  Espaço  PageDown  clique", "Próximo slide"],
            ["←  PageUp  clique direito", "Slide anterior"],
            ["Home  /  End", "Primeiro e último slide"],
            ["T", "Mostra ou oculta o cronômetro"],
            ["R", "Zera o cronômetro"],
            ["C", "Mostra ou oculta a câmera num canto"],
            ["F", "Liga e desliga a tela cheia"],
            ["Esc", "Sai da apresentação"],
        ], [60, 110]),
        Spacer(1, 6),
        p("O cronômetro fica âmbar a partir de 80% da meta e vermelho quando ela é ultrapassada. Ao sair com "
          "Esc, a etapa Apresentar oferece continuar do mesmo slide e do mesmo tempo. Passadores de slides USB "
          "funcionam normalmente."),

        secao("7", "Solução de problemas"),
        table([
            ["Situação", "O que fazer"],
            ["A mão não é reconhecida", "Melhore a luz no rosto e nas mãos e mantenha as mãos inteiras dentro da imagem. A calibração mostra o que a câmera está vendo."],
            ["“Movimento curto” ou “lento”", "Faça um gesto mais longo ou mais rápido, ou aumente a sensibilidade."],
            ["Avança quando eu queria voltar", "Faça o gesto de voltar num movimento contínuo, sem parar no meio."],
            ["Permissão da câmera negada", "No navegador, clique no ícone da câmera ao lado do endereço e escolha Permitir."],
            ["Câmera em uso por outro programa", "Feche Teams, Zoom ou outro app que esteja usando a webcam."],
            ["O site não abre .pptx", "No site, salve em PDF (PowerPoint: Arquivo → Exportar → Criar Documento PDF/XPS) ou use o aplicativo."],
            ["Aviso do Windows ao instalar", "Clique em Mais informações → Executar assim mesmo."],
        ], [55, 115]),

        secao("8", "Privacidade"),
        *bullets([
            "<b>Arquivos:</b> abertos no seu computador e não enviados a servidores. No aplicativo, o PowerPoint "
            "é convertido pelo próprio PowerPoint instalado, também localmente.",
            "<b>Câmera:</b> cada quadro é analisado no navegador para encontrar as mãos e descartado em seguida. "
            "Nada é gravado nem enviado.",
            "<b>O que fica salvo:</b> ajustes e a lista de recentes (com cópias dos arquivos), só neste computador.",
            "<b>Terceiros:</b> fontes (Google Fonts), bibliotecas (jsDelivr) e o modelo de mãos (Google) são "
            "baixados ao abrir o app; esses serviços recebem dados técnicos de acesso, como o endereço IP. "
            "Não há cookies, contas nem rastreamento.",
        ]),
        PageBreak(),
    ]


def guia_tecnico():
    return [
        secao("9", "Estrutura do projeto"),
        block("""
Avance/
├── web/                     o app (o mesmo para o site e para o aplicativo)
│   ├── index.html           tela inicial, etapas e modo apresentação
│   ├── download.html        página de download do aplicativo
│   ├── css/style.css        visual
│   ├── js/                  módulos JavaScript (ver seção 10)
│   └── favicon.*            ícones
├── desktop/                 aplicativo para Windows
│   ├── app.py               janela do aplicativo (pywebview + WebView2)
│   ├── server.py            servidor local: entrega web/ e converte .pptx
│   ├── converter-pptx.ps1   conversão .pptx → PDF pelo PowerPoint
│   ├── instalador.iss       roteiro do instalador (Inno Setup)
│   └── gerar_instalador.py  gera dist/Avance-Setup.exe
├── docs/                    esta documentação e o gerador do PDF
├── vercel.json              publica só a pasta web/
└── README.md
"""),
        p("Pastas geradas e fora do Git (.gitignore): " + code("dist/") + " (aplicativo e instalador) e "
          + code("build/") + " (arquivos intermediários do PyInstaller)."),

        secao("10", "Como o código está organizado"),
        p("O front-end é JavaScript puro, em módulos ES, sem etapa de build. " + code("main.js") +
          " é o ponto de entrada; cada módulo cuida de um assunto:"),
        table([
            ["Módulo", "Responsabilidade"],
            [code("main.js"), "Detecta a versão (site ou aplicativo) e liga tudo na abertura"],
            [code("state.js"), "Estado compartilhado, atalho $() para elementos e a versão em uso"],
            [code("settings.js"), "Ajustes salvos (sensibilidade, cronômetro, câmera no canto) e seus controles"],
            [code("screens.js"), "Tela inicial, as três etapas, checklist da calibração e resumo"],
            [code("files.js"), "Abertura de arquivos, ficha do arquivo e miniaturas"],
            [code("slides.js"), "Leitura de PDF (pdf.js) e imagens; conversão de .pptx pelo servidor local"],
            [code("recents.js") + " / " + code("recent-store.js"), "Lista de recentes na tela / armazenamento no IndexedDB"],
            [code("presentation.js"), "Tela cheia, troca de slides, transições e atalhos"],
            [code("timer.js"), "Cronômetro e relógio"],
            [code("camera.js"), "Ligar/desligar a câmera, alerta, indicadores e diagnóstico dos gestos"],
            [code("gestures.js"), "Reconhecimento: MediaPipe, gatilho e detecção do swipe"],
        ], [52, 118]),
        Spacer(1, 6),
        p("A versão é decidida em tempo de execução: se o servidor local responde " + code("/health") +
          ", a página vira modo <b>desktop</b> (abre .pptx); senão, fica em modo <b>web</b> (mostra como salvar "
          "em PDF e oferece o aplicativo). No HTML, " + code("web-only") + " e " + code("desktop-only") +
          " mostram cada parte só na versão certa."),

        secao("11", "Como o reconhecimento funciona"),
        *bullets([
            "O MediaPipe Hand Landmarker encontra até duas mãos por quadro (21 pontos cada), na GPU quando disponível.",
            "<b>Qual mão é qual:</b> quem faz o gatilho é a esquerda; com duas mãos, vale a continuidade entre "
            "quadros e depois a posição na imagem. O rótulo do modelo só decide quando há uma mão.",
            "<b>Gatilho:</b> mão aberta, dedos estendidos, levantada e com a palma para a câmera (sinal do "
            "produto vetorial entre pulso, indicador e mindinho). Precisa ser mantido por 140 ms.",
            "<b>Swipe:</b> a posição da palma é suavizada e a velocidade é medida em janelas de 100 ms, em "
            "palmos por segundo. Ao parar a mão por 110 ms, a sequência de trechos é analisada: um trecho final "
            "que só devolve a mão ao ponto de partida é retorno; o gesto foi o anterior. Assim o impulso de "
            "preparação não vira comando.",
            "A sensibilidade (1 a 10) controla a distância mínima (2,0 a 0,65 palmo) e a velocidade mínima "
            "(7,1 a 3,5 palmos por segundo).",
        ]),

        secao("12", "Desenvolver e testar"),
        p("Rodar no navegador, com conversão de .pptx (precisa de Python 3 e PowerPoint):", "h2"),
        block("python desktop/server.py          # abre http://127.0.0.1:8765"),
        p("Rodar como aplicativo, sem gerar o instalador:", "h2"),
        block("python -m pip install pywebview\npython desktop/app.py"),
        p("Variáveis úteis: " + code("AVANCE_PORTA") + " (porta do server.py), " + code("AVANCE_PORTA_APP") +
          " (porta interna do aplicativo, padrão 47821) e " + code("AVANCE_DEBUG_PORT") +
          " (liga a depuração remota do WebView2)."),

        secao("13", "Gerar o instalador e publicar"),
        p("Pré-requisitos, uma vez:", "h2"),
        block("python -m pip install pyinstaller pywebview\nwinget install JRSoftware.InnoSetup"),
        p("Nova versão do aplicativo:", "h2"),
        *steps([
            "Aumente " + code('APP_VERSION') + " em " + code("desktop/app.py") + ".",
            "Gere o instalador: " + code("python desktop/gerar_instalador.py") + " (cria " + code("dist/Avance-Setup.exe") + ").",
            "Publique no GitHub Releases: " + code('gh release create vX.Y.Z dist/Avance-Setup.exe --title "Avance X.Y.Z"') + ".",
            "Envie o código: " + code("git push") + ". A Vercel atualiza o site em cerca de 1 minuto.",
        ]),
        p("O botão de download aponta para " + code(".../releases/latest/download/Avance-Setup.exe") +
          ", que sempre leva à versão mais nova. Publique o instalador antes do " + code("git push") +
          " para o botão nunca ficar sem arquivo.", "nota"),
        p("Documentação: edite " + code("docs/gerar_pdf.py") + " e rode " + code("python docs/gerar_pdf.py") +
          " (precisa de " + code("pip install reportlab") + ").", "nota"),

        secao("14", "Histórico de versões"),
        table([
            ["Versão", "Novidades"],
            ["1.2.0", "Interruptor para ligar e desligar a câmera; a apresentação só começa com a câmera ligada; código reorganizado em módulos e pastas."],
            ["1.1.0", "Aplicativo instalável: janela própria, atalho no Menu Iniciar e desinstalação pelo Windows."],
            ["1.0.0", "Primeira versão para Windows (Avance.exe com console e navegador)."],
        ], [22, 148]),
    ]


def rodape(canvas, doc):
    if doc.page == 1:
        return
    canvas.saveState()
    canvas.setFont("Texto", 8)
    canvas.setFillColor(INK2)
    canvas.drawString(20 * mm, 12 * mm, f"Avance · Documentação · versão {VERSION}")
    canvas.drawRightString(A4[0] - 20 * mm, 12 * mm, str(doc.page))
    canvas.setStrokeColor(RULE)
    canvas.line(20 * mm, 16 * mm, A4[0] - 20 * mm, 16 * mm)
    canvas.restoreState()


def main():
    doc = SimpleDocTemplate(str(OUT), pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm,
                            topMargin=20 * mm, bottomMargin=24 * mm,
                            title="Avance · Documentação", author="Avance", subject="Guia de uso e guia técnico")
    doc.build(capa() + guia_uso() + guia_tecnico(), onFirstPage=rodape, onLaterPages=rodape)
    print(f"Pronto: {OUT}")


if __name__ == "__main__":
    main()
