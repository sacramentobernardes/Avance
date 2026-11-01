// Telas: boas-vindas, as três etapas, o checklist da calibração e o resumo antes de apresentar.

import { renderCameraSummary, showDiagnostic } from "./camera.js";
import { renderRecent } from "./recents.js";
import { $, CHECKS, state } from "./state.js";
import { elapsed, formatTime } from "./timer.js";

// ---------------------------------------------------------------- Telas: boas-vindas e etapas
export function showView(view) {
  const steps = view === "steps";
  $("welcome").hidden = steps;
  $("home").hidden = !steps;
  $("stepper").hidden = !steps;
  $("topbar").classList.toggle("in-steps", steps);
  if (!steps) renderRecent();
  window.scrollTo({ top: 0 });
}

export function bindWelcome() {
  $("brand").addEventListener("click", () => showView("welcome"));
  $("begin-btn").addEventListener("click", () => goStep(1));
  window.addEventListener("scroll", () => $("topbar").classList.toggle("scrolled", window.scrollY > 8), { passive: true });
}

// ---------------------------------------------------------------- Etapas
export const canGo = (n) => n !== 3 || !!state.deck;
export const isDone = (n) => (n === 1 ? !!state.deck : n === 2 ? state.checks.size === CHECKS.length : false);

export function goStep(n) {
  if (!canGo(n)) return;
  if ($("home").hidden) showView("steps");
  state.step = n;
  for (const s of document.querySelectorAll(".step")) s.hidden = Number(s.dataset.step) !== n;
  updateStepper();
  if (n === 3) renderSummary();
  window.scrollTo({ top: 0 });
}

export function updateStepper() {
  for (const tab of document.querySelectorAll(".step-tab")) {
    const n = Number(tab.dataset.step);
    tab.classList.toggle("current", n === state.step);
    tab.classList.toggle("done", n !== state.step && isDone(n));
    tab.disabled = !canGo(n);
  }
  $("to-step-2").disabled = !state.deck;
  $("to-step-3").disabled = !state.deck;
}

export function bindSteps() {
  for (const tab of document.querySelectorAll(".step-tab")) {
    tab.addEventListener("click", () => goStep(Number(tab.dataset.step)));
  }
  for (const b of document.querySelectorAll("[data-goto]")) {
    b.addEventListener("click", () => goStep(Number(b.dataset.goto)));
  }
  $("to-step-2").addEventListener("click", () => goStep(2));
}

// ---------------------------------------------------------------- Etapa 3: resumo
export async function renderSummary() {
  const deck = state.deck;
  if (!deck) return;
  const resume = state.resumable;
  const slide = (resume ? state.index : state.startIndex) + 1;

  $("summary-title").textContent = deck.title;
  $("summary-slides").textContent = deck.count;
  $("summary-start").textContent = `slide ${slide}`;

  renderCameraSummary();
  const g = $("summary-gestures");
  const calibrated = state.checks.size === CHECKS.length;
  g.textContent = state.gesturesFailed ? "Indisponíveis" : calibrated ? "Calibrados" : "Não testados";
  g.className = state.gesturesFailed || !calibrated ? "warn" : "ok";

  $("ready-title").textContent = resume ? "Continuar a apresentação" : "Tudo pronto";
  $("start-label").textContent = resume ? `Continuar do slide ${slide} · ${formatTime(elapsed())}` : "Iniciar apresentação";
  $("restart-btn").hidden = !resume;
  $("start-btn").disabled = false;

  const thumb = await deck.thumbnail(slide - 1, 640).catch(() => null);
  if (thumb && state.deck === deck) $("summary-thumb").replaceChildren(thumb);
}

// ---------------------------------------------------------------- Calibração
export function check(key) {
  if (state.checks.has(key)) return;
  state.checks.add(key);
  for (const li of $("checklist").children) li.classList.toggle("ok", state.checks.has(li.dataset.check));
  const done = state.checks.size;
  $("check-count").textContent = `${done}/${CHECKS.length}`;
  $("check-count").classList.toggle("done", done === CHECKS.length);
  $("check-bar").style.width = `${(done / CHECKS.length) * 100}%`;
  if (done === CHECKS.length) showDiagnostic("Calibração concluída! Os gestos estão prontos para a apresentação.", "ok");
  updateStepper();
}
