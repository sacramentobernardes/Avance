// Ponto de entrada: detecta a versão (site ou aplicativo) e liga tudo.

import { bindCameraControls, setCameraStatus, startCamera } from "./camera.js";
import { bindFileInput } from "./files.js";
import { bindPresentationControls } from "./presentation.js";
import { bindSteps, bindWelcome, showView, updateStepper } from "./screens.js";
import { bindSettings, settings } from "./settings.js";
import { $, mode } from "./state.js";

// ---------------------------------------------------------------- Versão web x computador
// No aplicativo (ou com desktop/server.py), o servidor local responde /health e converte .pptx com o
// PowerPoint ("desktop"). Publicado como site, não há servidor ("web", o padrão do HTML).
async function detectMode() {
  try {
    const info = await (await fetch("/health", { cache: "no-store" })).json();
    if (info.pptx) document.documentElement.dataset.mode = "desktop";
  } catch {}
}

function bindWebExtras() {
  $("pick-pdf").addEventListener("click", () => $("file-input").click());
  $("see-desktop").addEventListener("click", () => (location.href = "download.html"));

  // Aviso para celular e tablet: aparece até a pessoa dispensar nesta sessão.
  const small = matchMedia("(max-width: 820px), (hover: none) and (pointer: coarse)").matches;
  let dismissed = false;
  try { dismissed = sessionStorage.getItem("avance.small-screen") === "ok"; } catch {}
  $("small-screen").hidden = !small || dismissed;
  $("small-screen-ok").addEventListener("click", () => {
    $("small-screen").hidden = true;
    try { sessionStorage.setItem("avance.small-screen", "ok"); } catch {}
  });
}

// ---------------------------------------------------------------- Início
bindSettings();
bindWelcome();
bindSteps();
bindFileInput();
bindPresentationControls();
bindWebExtras();
mode.ready = detectMode();
updateStepper();
showView("welcome");
bindCameraControls();
if (settings.cameraOn) startCamera();
else setCameraStatus("off");
