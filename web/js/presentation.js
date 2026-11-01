// Modo apresentação: tela cheia, troca de slides, transições e atalhos de teclado.

import { openCameraAlert } from "./camera.js";
import { goStep } from "./screens.js";
import { setSetting, settings } from "./settings.js";
import { $, state } from "./state.js";
import { renderTime, timerPause, timerReset, timerStart } from "./timer.js";

// ---------------------------------------------------------------- Apresentação
export async function startPresentation({ fresh = false } = {}) {
  if (!state.deck) return;
  // Os slides passam pelos gestos: sem câmera ligada, a apresentação não começa.
  if (state.camera !== "on") return openCameraAlert();
  if (fresh || !state.resumable) {
    state.index = state.startIndex;
    timerReset();
  }
  state.resumable = true;
  state.presenting = true;
  $("home").hidden = true;
  $("topbar").hidden = true;
  $("present").hidden = false;
  $("counter-total").textContent = state.deck.count;

  timerStart();
  renderTime();
  clearInterval(state.clockTimer);
  state.clockTimer = setInterval(renderTime, 250);

  try { await document.documentElement.requestFullscreen({ navigationUI: "hide" }); } catch {}
  await show(state.index, 0, true);
}

export function exitPresentation() {
  if (!state.presenting) return;
  state.presenting = false;
  timerPause();
  clearInterval(state.clockTimer);
  $("present").hidden = true;
  $("topbar").hidden = false;
  $("home").hidden = false;
  $("stage").replaceChildren();
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  goStep(3);
}

export async function show(i, dir = 0, instant = false) {
  const deck = state.deck;
  if (!deck) return;
  i = Math.max(0, Math.min(deck.count - 1, i));
  const stage = $("stage");
  const current = stage.querySelector(".slide.current");
  if (i === state.index && current && !instant) return;

  state.index = i;
  updateCounter();
  const token = ++state.showToken;
  const el = await deck.element(i, stage.clientWidth, stage.clientHeight);
  if (token !== state.showToken || !state.presenting) return;

  const enter = instant ? "instant" : dir > 0 ? "from-right" : dir < 0 ? "from-left" : "fade-in";
  el.classList.add("slide", "current", enter);
  stage.appendChild(el);
  el.getBoundingClientRect(); // força o layout para a transição partir do estado inicial
  requestAnimationFrame(() => el.classList.remove("from-right", "from-left", "fade-in"));

  for (const old of stage.querySelectorAll(".slide.current")) {
    if (old === el) continue;
    old.classList.remove("current");
    if (instant) { old.remove(); continue; }
    old.classList.add(dir > 0 ? "to-left" : dir < 0 ? "to-right" : "fade-out");
    setTimeout(() => old.remove(), 320);
  }
  setTimeout(() => el.classList.remove("instant"), 50);

  // Pré-renderiza os vizinhos para que a próxima troca seja imediata.
  for (const n of [i + 1, i - 1, i + 2]) {
    if (n >= 0 && n < deck.count) deck.render(n, stage.clientWidth, stage.clientHeight);
  }
}

export function go(step) {
  if (!state.presenting || !state.deck) return;
  const target = state.index + step;
  if (target < 0 || target >= state.deck.count) return;
  show(target, step);
}

export function updateCounter() {
  const { index, deck } = state;
  $("counter-current").textContent = index + 1;
  $("progress-bar").style.width = `${((index + 1) / deck.count) * 100}%`;
  const counter = document.querySelector(".hud-counter");
  counter.classList.add("bump");
  clearTimeout(updateCounter.timer);
  updateCounter.timer = setTimeout(() => counter.classList.remove("bump"), 1400);
}

export function flash(id) {
  const el = $(id);
  el.classList.add("show");
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove("show")));
}

export function toggleSetting(key, inputId) {
  setSetting(key, !settings[key]);
  $(inputId).checked = settings[key];
}

export function bindPresentationControls() {
  $("start-btn").addEventListener("click", () => startPresentation());
  $("restart-btn").addEventListener("click", () => startPresentation({ fresh: true }));
  $("exit-btn").addEventListener("click", (e) => { e.stopPropagation(); exitPresentation(); });

  document.addEventListener("keydown", (e) => {
    if (!state.presenting) {
      const typing = /INPUT|TEXTAREA|BUTTON/.test(document.activeElement?.tagName);
      if (e.key === "Enter" && !typing && !$("home").hidden && state.step === 3 && state.deck) startPresentation();
      return;
    }
    const k = e.key;
    if (["ArrowRight", "ArrowDown", "PageDown", " ", "Enter", "n", "N"].includes(k)) go(1);
    else if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace", "p", "P"].includes(k)) go(-1);
    else if (k === "Home") show(0, -1);
    else if (k === "End") show(state.deck.count - 1, 1);
    else if (k === "Escape") exitPresentation();
    else if (k === "c" || k === "C") toggleSetting("showPip", "opt-pip");
    else if (k === "t" || k === "T") toggleSetting("showTimer", "opt-timer");
    else if (k === "r" || k === "R") {
      timerReset();
      renderTime();
      const hud = $("hud-time");
      hud.classList.remove("reset");
      void hud.offsetWidth;
      hud.classList.add("reset");
    }
    else if (k === "f" || k === "F") document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
    else return;
    e.preventDefault();
  });

  const present = $("present");
  present.addEventListener("click", () => go(1));
  present.addEventListener("contextmenu", (e) => { e.preventDefault(); go(-1); });

  // Mostra os controles só quando o mouse se mexe.
  let idle;
  present.addEventListener("mousemove", () => {
    present.classList.add("pointer");
    clearTimeout(idle);
    idle = setTimeout(() => present.classList.remove("pointer"), 1800);
  });

  // Sair da tela cheia (Esc do navegador) também encerra a apresentação.
  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement && state.presenting) exitPresentation();
  });

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => state.presenting && show(state.index, 0, true), 150);
  });
}
