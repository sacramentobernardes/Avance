// Ajustes do usuário (sensibilidade, cronômetro, câmera no canto) e seus controles na tela.

import { $, SETTINGS_KEY, state } from "./state.js";
import { renderTime } from "./timer.js";

// ---------------------------------------------------------------- Ajustes
export const settings = {
  sensitivity: 5,
  requireTrigger: true,
  invertDirection: false,
  swapHandedness: true,
  showPip: false,
  showTimer: true,
  showClock: true,
  targetMin: 0,
  cameraOn: true, // a pessoa pode desligar; a escolha vale para a próxima abertura
};

try { Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY)) ?? {}); } catch {}

export function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {}
}

// Sensibilidade 1..10 -> distância mínima do swipe (palmos): 2.0 .. 0.65
// e velocidade mínima (palmos por segundo): 7.1 .. 3.5
export const swipeDistance = (s) => 2.0 - (s - 1) * 0.15;
export const minSpeed = (s) => 7.1 - (s - 1) * 0.4;

export function applySettings() {
  $("sens-out").textContent = settings.sensitivity;
  state.gestures?.setOptions({
    requireTrigger: settings.requireTrigger,
    invertDirection: settings.invertDirection,
    swapHandedness: settings.swapHandedness,
    swipeDistance: swipeDistance(settings.sensitivity),
    minSpeed: minSpeed(settings.sensitivity),
  });
  $("pip").hidden = !settings.showPip;
  $("timer-wrap").hidden = !settings.showTimer;
  $("clock-wrap").hidden = !settings.showClock;
  $("hud-time").hidden = !settings.showTimer && !settings.showClock;
  renderTargetOptions();
  if (state.presenting) renderTime();
}

export function setSetting(key, value) {
  settings[key] = value;
  saveSettings();
  applySettings();
}

export function bindSettings() {
  const bind = (id, key, prop = "checked", parse = (v) => v) => {
    const el = $(id);
    el[prop] = settings[key];
    el.addEventListener("input", () => setSetting(key, parse(el[prop])));
  };
  bind("opt-sensitivity", "sensitivity", "value", Number);
  bind("opt-require", "requireTrigger");
  bind("opt-invert", "invertDirection");
  bind("opt-swap", "swapHandedness");
  bind("opt-pip", "showPip");
  bind("opt-timer", "showTimer");
  bind("opt-clock", "showClock");

  for (const b of $("target-options").querySelectorAll("button")) {
    b.addEventListener("click", () => setSetting("targetMin", Number(b.dataset.min)));
  }
  $("target-custom").addEventListener("input", (e) => {
    const v = Math.round(Number(e.target.value));
    if (v > 0) setSetting("targetMin", Math.min(v, 600));
  });
  applySettings();
}

export function renderTargetOptions() {
  let preset = false;
  for (const b of $("target-options").querySelectorAll("button")) {
    const on = Number(b.dataset.min) === settings.targetMin;
    b.classList.toggle("on", on);
    preset ||= on;
  }
  const custom = $("target-custom");
  if (document.activeElement !== custom) custom.value = preset ? "" : settings.targetMin;
}
