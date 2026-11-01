// Carregamento e renderização de slides: PDF (pdf.js), PPTX (convertido pelo servidor local) e imagens.

import * as pdfjs from "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.min.mjs";

pdfjs.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs";

const IMAGE_RE = /\.(png|jpe?g|webp|gif|bmp|avif)$/i;
const CACHE_SIZE = 8;

export async function loadDeck(files, onStatus = () => {}) {
  files = [...files];
  if (!files.length) throw new Error("Nenhum arquivo selecionado.");

  // Cada deck guarda em `sources` os arquivos prontos para reabrir (PPTX vira o PDF convertido).
  const images = files.filter((f) => IMAGE_RE.test(f.name) || f.type.startsWith("image/"));
  if (images.length === files.length) {
    images.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
    return Object.assign(new ImageDeck(images, nameOf(images[0])), { sources: images });
  }

  const file = files[0];
  if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") {
    onStatus("Abrindo PDF…");
    const deck = await PdfDeck.open(await file.arrayBuffer(), nameOf(file));
    return Object.assign(deck, { sources: [file] });
  }
  if (/\.pptx?$/i.test(file.name)) {
    // No site publicado não há PowerPoint para converter: o app mostra como salvar em PDF.
    if (document.documentElement.dataset.mode === "web") {
      throw Object.assign(new Error("Arquivos do PowerPoint precisam ser salvos em PDF antes."), { code: "pptx-web" });
    }
    onStatus("Convertendo PPTX com o PowerPoint… (pode levar alguns segundos)");
    const res = await fetch("/convert", { method: "POST", body: file }).catch(() => null);
    if (!res) throw new Error("Para abrir .pptx, inicie o app pelo Iniciar.bat (o servidor local faz a conversão).");
    if (!res.ok) {
      const info = await res.json().catch(() => ({}));
      throw new Error(info.erro ?? `Falha na conversão (HTTP ${res.status}).`);
    }
    const data = await res.arrayBuffer();
    // Copia antes de abrir: o pdf.js transfere (esvazia) o buffer recebido.
    const pdf = new File([data.slice(0)], `${nameOf(file)}.pdf`, { type: "application/pdf" });
    const deck = await PdfDeck.open(data, nameOf(file));
    return Object.assign(deck, { sources: [pdf] });
  }
  throw new Error("Formato não suportado. Use .pdf, .pptx ou imagens.");
}

const nameOf = (f) => f.name.replace(/\.[^.]+$/, "");

class PdfDeck {
  static async open(data, title) {
    const doc = await pdfjs.getDocument({ data }).promise;
    return new PdfDeck(doc, title);
  }

  constructor(doc, title) {
    this.doc = doc;
    this.title = title;
    this.count = doc.numPages;
    this.cache = new Map(); // índice -> Promise<HTMLCanvasElement>
    this.targetKey = "";
  }

  // Renderiza na resolução real da tela (incluindo DPI) para máxima nitidez.
  render(index, width, height) {
    const dpr = window.devicePixelRatio || 1;
    const key = `${Math.round(width * dpr)}x${Math.round(height * dpr)}`;
    if (key !== this.targetKey) {
      this.cache.clear();
      this.targetKey = key;
    }
    if (!this.cache.has(index)) {
      this.cache.set(index, this._draw(index, width * dpr, height * dpr));
      while (this.cache.size > CACHE_SIZE) this.cache.delete(this.cache.keys().next().value);
    }
    return this.cache.get(index);
  }

  async _draw(index, maxW, maxH) {
    const page = await this.doc.getPage(index + 1);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(maxW / base.width, maxH / base.height);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    return canvas;
  }

  // Devolve uma cópia, pois o mesmo slide pode estar em duas camadas durante a transição.
  async element(index, width, height) {
    const src = await this.render(index, width, height);
    const copy = document.createElement("canvas");
    copy.width = src.width;
    copy.height = src.height;
    copy.getContext("2d").drawImage(src, 0, 0);
    return copy;
  }

  async thumbnail(index, width) {
    const page = await this.doc.getPage(index + 1);
    const base = page.getViewport({ scale: 1 });
    return this._draw(index, width, (width * base.height) / base.width);
  }

  destroy() {
    this.cache.clear();
    this.doc.destroy();
  }
}

class ImageDeck {
  constructor(files, title) {
    this.title = title;
    this.count = files.length;
    this.urls = files.map((f) => URL.createObjectURL(f));
  }

  async element(index) {
    const img = new Image();
    img.src = this.urls[index];
    img.decoding = "async";
    await img.decode().catch(() => {});
    return img;
  }

  render(index) {
    return this.element(index); // pré-carrega no cache do navegador
  }

  async thumbnail(index) {
    return this.element(index);
  }

  destroy() {
    this.urls.forEach((u) => URL.revokeObjectURL(u));
  }
}
