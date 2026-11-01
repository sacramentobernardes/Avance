// Lista de arquivos abertos recentemente na tela inicial.

import { handleFiles } from "./files.js";
import { goStep } from "./screens.js";
import { $ } from "./state.js";

// ---------------------------------------------------------------- Recentes
export let recentApi = null;
export const loadRecentApi = () => (recentApi ??= import("./recent-store.js"));

export function timeAgo(ts) {
  const min = Math.round((Date.now() - ts) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  if (d === 1) return "ontem";
  if (d < 30) return `há ${d} dias`;
  return new Date(ts).toLocaleDateString("pt-BR");
}

export async function renderRecent() {
  const { listRecent } = await loadRecentApi();
  const items = await listRecent();
  $("recent").hidden = !items.length;
  $("recent-list").replaceChildren(...items.map((item) => {
    const kind = item.format === "PowerPoint" ? "pptx" : item.format.startsWith("Imagens") ? "imagens" : "pdf";
    const row = document.createElement("li");
    row.className = "recent-row";
    row.tabIndex = 0;
    row.innerHTML = `
      <span class="recent-kind">${kind}</span>
      <span class="recent-name"></span>
      <span class="recent-meta">${item.count} slide${item.count === 1 ? "" : "s"}</span>
      <span class="recent-meta when">${timeAgo(item.openedAt)}</span>
      <button class="recent-remove" title="Tirar da lista"><svg><use href="#i-x"/></svg></button>`;
    row.querySelector(".recent-name").textContent = item.title;
    row.addEventListener("click", (e) => {
      if (e.target.closest(".recent-remove")) return removeRecentItem(item.id);
      openRecent(item);
    });
    row.addEventListener("keydown", (e) => e.key === "Enter" && e.target === row && openRecent(item));
    return row;
  }));
}

export async function removeRecentItem(id) {
  const { removeRecent } = await loadRecentApi();
  await removeRecent(id);
  renderRecent();
}

export async function openRecent(item) {
  goStep(1);
  try {
    const { getRecentFiles } = await loadRecentApi();
    const files = await getRecentFiles(item.id);
    if (await handleFiles(files, item.format)) goStep(3);
  } catch (err) {
    $("load-status").className = "status-line error";
    $("load-status").textContent = err.message || "Não foi possível abrir o arquivo recente.";
  }
}
