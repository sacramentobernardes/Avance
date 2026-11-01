// Cronômetro e relógio do modo apresentação.

import { settings } from "./settings.js";
import { $ } from "./state.js";

// ---------------------------------------------------------------- Cronômetro
export const timer = { acc: 0, since: null };
export const elapsed = () => timer.acc + (timer.since ? performance.now() - timer.since : 0);
export const timerStart = () => { timer.since ??= performance.now(); };
export const timerPause = () => { if (timer.since) { timer.acc += performance.now() - timer.since; timer.since = null; } };
export const timerReset = () => { timer.acc = 0; if (timer.since) timer.since = performance.now(); };

export function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

export function renderTime() {
  const ms = elapsed();
  const target = settings.targetMin * 60000;
  const ratio = target ? ms / target : 0;
  const hud = $("hud-time");
  $("timer-elapsed").textContent = formatTime(ms);
  $("timer-target").textContent = target ? `/ ${formatTime(target)}` : "";
  $("timer-bar").style.width = `${Math.min(ratio, 1) * 100}%`;
  hud.classList.toggle("has-target", target > 0);
  hud.classList.toggle("warn", target > 0 && ratio >= 0.8 && ratio < 1);
  hud.classList.toggle("over", target > 0 && ratio >= 1);
  $("clock").textContent = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
