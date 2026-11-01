// Câmera e gestos: ligar/desligar, reconhecimento, diagnóstico e o alerta de câmera desligada.

import { flash, show } from "./presentation.js";
import { check } from "./screens.js";
import { applySettings, saveSettings, settings } from "./settings.js";
import { $, CHECKS, state } from "./state.js";

// ---------------------------------------------------------------- Gestos
export function setCamChip(kind, text) {
  $("cam-chip").className = `cam-chip ${kind}`;
  $("cam-chip-text").textContent = text;
}

export function setTriggerUI(active) {
  $("present").classList.toggle("armed", active);
  $("camera").classList.toggle("active", active);
  $("hud-status-text").textContent = active ? "Gatilho ativo" : "Gestos em espera";
  if (state.camera === "on") setCamChip(active ? "armed" : "ready", active ? "gatilho ligado" : "câmera ligada");
  if (active) check("trigger");
}

export function onFrame(frame) {
  const left = frame.hands.some((h) => h.side === "left");
  const right = frame.hands.some((h) => h.side === "right");
  const armed = frame.triggerActive;
  if (left) check("left");

  $("dot-left").className = `dot ${armed ? "armed" : left ? "seen" : ""}`;
  $("txt-left").textContent = armed ? "gatilho ativo" : frame.leftPose ? "segure…" : left ? "detectada" : "não detectada";
  $("dot-right").className = `dot right ${right ? "seen" : ""}`;
  $("txt-right").textContent = right ? (armed || !settings.requireTrigger ? "pronta" : "detectada") : "não detectada";

  if (!state.presenting) {
    if (state.step === 2 && $("welcome").hidden) {
      state.drawHands($("cam-canvas"), $("cam-video"), frame);
    }
  } else if (settings.showPip) {
    state.drawHands($("pip-canvas"), $("pip-video"), frame);
  }
}

export function onSwipe(dir, { corrects = false } = {}) {
  if (state.presenting) {
    // Numa correção, o comando anterior era só o impulso de preparação: parte do slide
    // em que estava antes dele, em vez do atual.
    if (!corrects) state.gestureBase = state.index;
    const target = Math.max(0, Math.min(state.deck.count - 1, state.gestureBase + dir));
    if (target !== state.index) {
      show(target, Math.sign(target - state.index));
      flash(dir > 0 ? "nav-flash-next" : "nav-flash-prev");
    }
    return;
  }
  const el = $("swipe-flash");
  el.textContent = dir > 0 ? "← Avançar" : "Voltar →";
  el.classList.add("show");
  clearTimeout(onSwipe.timer);
  onSwipe.timer = setTimeout(() => el.classList.remove("show"), 700);
  check(dir > 0 ? "next" : "prev");
  if (state.checks.size < CHECKS.length) showDiagnostic(dir > 0 ? "Reconhecido: avançar." : "Reconhecido: voltar.", "ok");
}

// Explica na calibração por que um movimento não virou comando.
export const pct = (r) => `${Math.round(r * 100)}%`;
export const DIAGNOSTICS = {
  curto: (i) => `Movimento curto (${pct(i.distance)} da distância necessária). Faça um gesto mais longo ou aumente a sensibilidade.`,
  lento: (i) => `Movimento lento (${pct(i.speed)} da velocidade necessária). Faça um gesto mais rápido ou aumente a sensibilidade.`,
  vertical: () => "Movimento muito na vertical. Passe a mão na horizontal.",
  retorno: () => "Ignorado: parecia a mão voltando depois do gesto anterior.",
  gatilho: () => "A mão direita se mexeu, mas o gatilho não está ativo. Levante a mão esquerda aberta, com a palma para a câmera.",
};

export function onDebug(info) {
  if (!state.presenting) showDiagnostic(DIAGNOSTICS[info.reason](info), "warn");
}

export function showDiagnostic(text, kind) {
  const el = $("gesture-debug");
  el.textContent = text;
  el.className = `diagnostic ${kind}`;
}

// ---------------------------------------------------------------- Câmera: ligar e desligar
// Reflete o estado da câmera no interruptor da barra, na calibração e no resumo.
export function setCameraStatus(status, error = "") {
  state.camera = status;
  state.cameraError = error;
  state.gesturesFailed = status === "error";

  const toggle = $("cam-toggle");
  toggle.setAttribute("aria-checked", String(status === "on" || status === "starting"));
  toggle.disabled = status === "starting";
  const chip = {
    off: ["", "câmera desligada"],
    starting: ["", "ligando a câmera"],
    on: ["ready", "câmera ligada"],
    error: ["error", "câmera com problema"],
  }[status];
  setCamChip(...chip);

  // Área da câmera na calibração
  $("cam-placeholder").hidden = status === "on";
  $("cam-message").textContent =
    status === "off" ? "A câmera está desligada." :
    status === "starting" ? "Ligando a câmera e o reconhecimento das mãos…" : error;
  $("cam-retry").hidden = status === "on" || status === "starting";
  $("cam-retry").textContent = status === "error" ? "Tentar novamente" : "Ligar a câmera";
  document.querySelector(".cam-placeholder .spinner").hidden = status !== "starting";

  if (status !== "on") {
    setTriggerUI(false);
    for (const id of ["dot-left", "dot-right"]) $(id).className = `dot${id === "dot-right" ? " right" : ""}`;
    $("txt-left").textContent = $("txt-right").textContent = "câmera desligada";
  }
  renderCameraSummary();
  if ($("cam-alert").open && status === "on") $("cam-alert").close();
}

export function renderCameraSummary() {
  const el = $("summary-camera");
  el.textContent = { off: "Desligada", starting: "Ligando…", on: "Ligada", error: "Com problema" }[state.camera];
  el.className = state.camera === "on" ? "ok" : "warn";
}

export async function startCamera() {
  if (state.camera === "starting" || state.camera === "on") return;
  setCameraStatus("starting");

  try {
    const { GestureController, drawHands } = await import("./gestures.js");
    state.drawHands = drawHands;
    state.gestures?.stop();
    state.gestures = new GestureController($("cam-video"), { onTrigger: setTriggerUI, onSwipe, onFrame, onDebug });
    applySettings();
    await state.gestures.start();
    if (!settings.cameraOn) return stopCamera(); // desligada enquanto ligava

    const stream = $("cam-video").srcObject;
    $("pip-video").srcObject = stream;
    $("pip-video").play().catch(() => {});
    // Câmera desconectada ou tomada por outro programa no meio do uso.
    stream.getVideoTracks()[0]?.addEventListener("ended", () => {
      if (state.camera === "on") cameraFailed("A câmera foi desconectada ou está em uso por outro programa.");
    });
    setCameraStatus("on");
    check("cam");
  } catch (err) {
    console.error(err);
    cameraFailed(
      err?.name === "NotAllowedError" ? "Permissão da câmera negada. Libere o acesso no navegador (ícone ao lado do endereço) e tente de novo." :
      err?.name === "NotFoundError" ? "Nenhuma webcam encontrada. Conecte uma câmera e tente de novo." :
      err?.name === "NotReadableError" ? "A webcam está em uso por outro aplicativo. Feche o outro programa e tente de novo." :
      "Não foi possível ligar o reconhecimento das mãos. Verifique a conexão com a internet e tente de novo."
    );
  }
}

export function cameraFailed(message) {
  state.gestures?.stop();
  state.gestures = null;
  setCameraStatus("error", message);
}

export function stopCamera() {
  state.gestures?.stop();
  state.gestures = null;
  $("cam-video").srcObject = null;
  $("pip-video").srcObject = null;
  setCameraStatus("off");
}

export function setCameraOn(on) {
  settings.cameraOn = on;
  saveSettings();
  on ? startCamera() : stopCamera();
}

// Alerta mostrado ao tentar apresentar sem a câmera ligada.
export function openCameraAlert() {
  const text = {
    off: "A câmera está desligada. O Avance passa os slides pelos gestos da mão, então ela precisa estar ligada para a apresentação começar.",
    starting: "A câmera ainda está ligando. Aguarde alguns segundos e clique em iniciar de novo.",
    error: `A câmera não está funcionando: ${state.cameraError} A apresentação só começa com a câmera ligada.`,
  }[state.camera];
  $("cam-alert-text").textContent = text;
  $("cam-alert-ok").textContent = state.camera === "starting" ? "Entendi" : state.camera === "error" ? "Tentar novamente" : "Ligar a câmera";
  $("cam-alert-cancel").hidden = state.camera === "starting";
  $("cam-alert").showModal();
}

export function bindCameraControls() {
  $("cam-toggle").addEventListener("click", () => setCameraOn(!(state.camera === "on" || state.camera === "starting")));
  $("cam-retry").addEventListener("click", () => setCameraOn(true));
  $("cam-alert-cancel").addEventListener("click", () => $("cam-alert").close());
  $("cam-alert-ok").addEventListener("click", () => {
    if (state.camera !== "starting") setCameraOn(true);
    $("cam-alert").close();
  });
}
