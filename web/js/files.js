// Abertura de arquivos (PDF, PowerPoint, imagens), ficha do arquivo e miniaturas.

import { loadRecentApi } from "./recents.js";
import { goStep, updateStepper } from "./screens.js";
import { $, mode, state } from "./state.js";
import { timerReset } from "./timer.js";

// ---------------------------------------------------------------- Arquivo
export const IMAGE_RE = /\.(png|jpe?g|webp|gif|bmp|avif)$/i;

export function describeFormat(files) {
  const exts = [...new Set(files.map((f) => f.name.split(".").pop().toUpperCase()))];
  if (files.every((f) => IMAGE_RE.test(f.name))) return `Imagens (${exts.join(", ")})`;
  return exts[0] === "PDF" ? "PDF" : exts[0].startsWith("PPT") ? "PowerPoint" : exts[0];
}

export function formatBytes(n) {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

export function describeAspect(w, h) {
  const r = w / h;
  const known = [[16 / 9, "16:9"], [16 / 10, "16:10"], [4 / 3, "4:3"], [Math.SQRT2, "A4 paisagem"], [1 / Math.SQRT2, "A4 retrato"], [1, "1:1"]];
  const hit = known.find(([k]) => Math.abs(k - r) < 0.02);
  return hit ? hit[1] : `${r.toFixed(2).replace(".", ",")}:1`;
}

export const sizeOf = (el) => [el.naturalWidth || el.width, el.naturalHeight || el.height];

// Devolve true se o arquivo abriu. `format` sobrepõe o formato detectado (recentes de PPTX são PDFs).
export async function handleFiles(fileList, format) {
  const files = [...(fileList ?? [])];
  if (!files.length) return false;
  const status = $("load-status");
  $("pptx-help").hidden = true;
  status.className = "status-line busy";
  status.textContent = "Carregando…";

  try {
    await mode.ready; // garante que já se sabe se é a versão web ou a de computador
    const { loadDeck } = await import("./slides.js");
    const deck = await loadDeck(files, (msg) => (status.textContent = msg));
    state.deck?.destroy();
    state.deck = deck;
    state.index = state.startIndex = 0;
    state.resumable = false;
    timerReset();

    const preview = await deck.thumbnail(0, 960);
    $("deck-preview").replaceChildren(preview);
    $("deck-title").textContent = deck.title;
    format ??= describeFormat(files);
    $("meta-format").textContent = format;
    $("meta-count").textContent = deck.count;
    $("meta-aspect").textContent = describeAspect(...sizeOf(preview));
    $("meta-size").textContent = formatBytes(files.reduce((sum, f) => sum + f.size, 0));
    $("deck").hidden = false;
    $("dropzone").hidden = true;
    status.className = "status-line";
    status.textContent = "";
    updateStepper();
    renderFilmstrip(deck);
    loadRecentApi().then(({ saveRecent }) => saveRecent(deck, format));
    return true;
  } catch (err) {
    if (err.code === "pptx-web") {
      // Versão web com um .pptx: em vez de erro, o guia para salvar em PDF.
      status.className = "status-line";
      status.textContent = "";
      $("pptx-help").hidden = false;
      return false;
    }
    console.error(err);
    status.className = "status-line error";
    status.textContent = err.message || "Não foi possível abrir o arquivo.";
    return false;
  }
}

// Miniaturas de todos os slides, geradas em segundo plano uma a uma.
export async function renderFilmstrip(deck) {
  const token = ++state.stripToken;
  const strip = $("filmstrip");
  strip.replaceChildren(...Array.from({ length: deck.count }, (_, i) => {
    const b = document.createElement("button");
    b.className = "thumb";
    b.title = `Começar pelo slide ${i + 1}`;
    b.innerHTML = `<span class="win"></span><span class="stamp"><span>${String(i + 1).padStart(2, "0")}</span></span>`;
    b.addEventListener("click", () => setStartIndex(i));
    return b;
  }));
  markStart();
  for (let i = 0; i < deck.count; i++) {
    const el = await deck.thumbnail(i, 320).catch(() => null);
    if (token !== state.stripToken) return;
    if (el) strip.children[i].querySelector(".win").append(el);
  }
}

export function setStartIndex(i) {
  state.startIndex = i;
  state.resumable = false;
  markStart();
}

export function markStart() {
  [...$("filmstrip").children].forEach((b, i) => {
    b.classList.toggle("start", i === state.startIndex);
    b.querySelector(".tag")?.remove();
    if (i === state.startIndex) b.querySelector(".stamp").insertAdjacentHTML("beforeend", `<span class="tag">início</span>`);
  });
}

export function bindFileInput() {
  const zone = $("dropzone");
  const input = $("file-input");
  input.addEventListener("change", () => { handleFiles(input.files); input.value = ""; });
  zone.addEventListener("keydown", (e) => (e.key === "Enter" || e.key === " ") && input.click());
  $("change-file").addEventListener("click", () => input.click());

  // Aceita soltar o arquivo em qualquer lugar da tela inicial.
  window.addEventListener("dragover", (e) => {
    e.preventDefault();
    if (!state.presenting) zone.classList.add("over");
  });
  window.addEventListener("dragleave", (e) => e.relatedTarget === null && zone.classList.remove("over"));
  window.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("over");
    if (state.presenting) return;
    goStep(1);
    handleFiles(e.dataTransfer.files);
  });
}
