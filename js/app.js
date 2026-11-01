// Orquestra a tela inicial (em etapas), o modo apresentação, o cronômetro e o controle por gestos.

const $ = (id) => document.getElementById(id);
// A chave mantém o nome antigo do app para não perder os ajustes já salvos.
const SETTINGS_KEY = "gestos.settings.v1";
const CHECKS = ["cam", "left", "trigger", "next", "prev"];

const state = {
  step: 1,
  deck: null,
  index: 0,
  startIndex: 0,
  resumable: false, // já apresentou este arquivo: dá para continuar de onde parou
  gestureBase: 0, // slide antes do último comando por gesto
  presenting: false,
  showToken: 0,
  stripToken: 0,
  gestures: null,
  gesturesFailed: false,
  camera: "off", // "off" | "starting" | "on" | "error"
  cameraError: "",
  drawHands: null,
  checks: new Set(),
};

// ---------------------------------------------------------------- Ajustes

const settings = {
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

function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {}
}

// Sensibilidade 1..10 -> distância mínima do swipe (palmos): 2.0 .. 0.65
// e velocidade mínima (palmos por segundo): 7.1 .. 3.5
const swipeDistance = (s) => 2.0 - (s - 1) * 0.15;
const minSpeed = (s) => 7.1 - (s - 1) * 0.4;

function applySettings() {
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

function setSetting(key, value) {
  settings[key] = value;
  saveSettings();
  applySettings();
}

function bindSettings() {
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

function renderTargetOptions() {
  let preset = false;
  for (const b of $("target-options").querySelectorAll("button")) {
    const on = Number(b.dataset.min) === settings.targetMin;
    b.classList.toggle("on", on);
    preset ||= on;
  }
  const custom = $("target-custom");
  if (document.activeElement !== custom) custom.value = preset ? "" : settings.targetMin;
}

// ---------------------------------------------------------------- Telas: boas-vindas e etapas

function showView(view) {
  const steps = view === "steps";
  $("welcome").hidden = steps;
  $("home").hidden = !steps;
  $("stepper").hidden = !steps;
  $("topbar").classList.toggle("in-steps", steps);
  if (!steps) renderRecent();
  window.scrollTo({ top: 0 });
}

function bindWelcome() {
  $("brand").addEventListener("click", () => showView("welcome"));
  $("begin-btn").addEventListener("click", () => goStep(1));
  window.addEventListener("scroll", () => $("topbar").classList.toggle("scrolled", window.scrollY > 8), { passive: true });
}

// ---------------------------------------------------------------- Recentes

let recentApi = null;
const loadRecentApi = () => (recentApi ??= import("./recent.js"));

function timeAgo(ts) {
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

async function renderRecent() {
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

async function removeRecentItem(id) {
  const { removeRecent } = await loadRecentApi();
  await removeRecent(id);
  renderRecent();
}

async function openRecent(item) {
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

// ---------------------------------------------------------------- Etapas

const canGo = (n) => n !== 3 || !!state.deck;
const isDone = (n) => (n === 1 ? !!state.deck : n === 2 ? state.checks.size === CHECKS.length : false);

function goStep(n) {
  if (!canGo(n)) return;
  if ($("home").hidden) showView("steps");
  state.step = n;
  for (const s of document.querySelectorAll(".step")) s.hidden = Number(s.dataset.step) !== n;
  updateStepper();
  if (n === 3) renderSummary();
  window.scrollTo({ top: 0 });
}

function updateStepper() {
  for (const tab of document.querySelectorAll(".step-tab")) {
    const n = Number(tab.dataset.step);
    tab.classList.toggle("current", n === state.step);
    tab.classList.toggle("done", n !== state.step && isDone(n));
    tab.disabled = !canGo(n);
  }
  $("to-step-2").disabled = !state.deck;
  $("to-step-3").disabled = !state.deck;
}

function bindSteps() {
  for (const tab of document.querySelectorAll(".step-tab")) {
    tab.addEventListener("click", () => goStep(Number(tab.dataset.step)));
  }
  for (const b of document.querySelectorAll("[data-goto]")) {
    b.addEventListener("click", () => goStep(Number(b.dataset.goto)));
  }
  $("to-step-2").addEventListener("click", () => goStep(2));
}

// ---------------------------------------------------------------- Arquivo

const IMAGE_RE = /\.(png|jpe?g|webp|gif|bmp|avif)$/i;

function describeFormat(files) {
  const exts = [...new Set(files.map((f) => f.name.split(".").pop().toUpperCase()))];
  if (files.every((f) => IMAGE_RE.test(f.name))) return `Imagens (${exts.join(", ")})`;
  return exts[0] === "PDF" ? "PDF" : exts[0].startsWith("PPT") ? "PowerPoint" : exts[0];
}

function formatBytes(n) {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

function describeAspect(w, h) {
  const r = w / h;
  const known = [[16 / 9, "16:9"], [16 / 10, "16:10"], [4 / 3, "4:3"], [Math.SQRT2, "A4 paisagem"], [1 / Math.SQRT2, "A4 retrato"], [1, "1:1"]];
  const hit = known.find(([k]) => Math.abs(k - r) < 0.02);
  return hit ? hit[1] : `${r.toFixed(2).replace(".", ",")}:1`;
}

const sizeOf = (el) => [el.naturalWidth || el.width, el.naturalHeight || el.height];

// Devolve true se o arquivo abriu. `format` sobrepõe o formato detectado (recentes de PPTX são PDFs).
async function handleFiles(fileList, format) {
  const files = [...(fileList ?? [])];
  if (!files.length) return false;
  const status = $("load-status");
  $("pptx-help").hidden = true;
  status.className = "status-line busy";
  status.textContent = "Carregando…";

  try {
    await modeReady; // garante que já se sabe se é a versão web ou a de computador
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
async function renderFilmstrip(deck) {
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

function setStartIndex(i) {
  state.startIndex = i;
  state.resumable = false;
  markStart();
}

function markStart() {
  [...$("filmstrip").children].forEach((b, i) => {
    b.classList.toggle("start", i === state.startIndex);
    b.querySelector(".tag")?.remove();
    if (i === state.startIndex) b.querySelector(".stamp").insertAdjacentHTML("beforeend", `<span class="tag">início</span>`);
  });
}

function bindFileInput() {
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

// ---------------------------------------------------------------- Etapa 3: resumo

async function renderSummary() {
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

// ---------------------------------------------------------------- Cronômetro

const timer = { acc: 0, since: null };
const elapsed = () => timer.acc + (timer.since ? performance.now() - timer.since : 0);
const timerStart = () => { timer.since ??= performance.now(); };
const timerPause = () => { if (timer.since) { timer.acc += performance.now() - timer.since; timer.since = null; } };
const timerReset = () => { timer.acc = 0; if (timer.since) timer.since = performance.now(); };

function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

function renderTime() {
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

// ---------------------------------------------------------------- Apresentação

async function startPresentation({ fresh = false } = {}) {
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

function exitPresentation() {
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

async function show(i, dir = 0, instant = false) {
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

function go(step) {
  if (!state.presenting || !state.deck) return;
  const target = state.index + step;
  if (target < 0 || target >= state.deck.count) return;
  show(target, step);
}

function updateCounter() {
  const { index, deck } = state;
  $("counter-current").textContent = index + 1;
  $("progress-bar").style.width = `${((index + 1) / deck.count) * 100}%`;
  const counter = document.querySelector(".hud-counter");
  counter.classList.add("bump");
  clearTimeout(updateCounter.timer);
  updateCounter.timer = setTimeout(() => counter.classList.remove("bump"), 1400);
}

function flash(id) {
  const el = $(id);
  el.classList.add("show");
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove("show")));
}

function toggleSetting(key, inputId) {
  setSetting(key, !settings[key]);
  $(inputId).checked = settings[key];
}

function bindPresentationControls() {
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

// ---------------------------------------------------------------- Calibração

function check(key) {
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

// ---------------------------------------------------------------- Gestos

function setCamChip(kind, text) {
  $("cam-chip").className = `cam-chip ${kind}`;
  $("cam-chip-text").textContent = text;
}

function setTriggerUI(active) {
  $("present").classList.toggle("armed", active);
  $("camera").classList.toggle("active", active);
  $("hud-status-text").textContent = active ? "Gatilho ativo" : "Gestos em espera";
  if (state.camera === "on") setCamChip(active ? "armed" : "ready", active ? "gatilho ligado" : "câmera ligada");
  if (active) check("trigger");
}

function onFrame(frame) {
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

function onSwipe(dir, { corrects = false } = {}) {
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
const pct = (r) => `${Math.round(r * 100)}%`;
const DIAGNOSTICS = {
  curto: (i) => `Movimento curto (${pct(i.distance)} da distância necessária). Faça um gesto mais longo ou aumente a sensibilidade.`,
  lento: (i) => `Movimento lento (${pct(i.speed)} da velocidade necessária). Faça um gesto mais rápido ou aumente a sensibilidade.`,
  vertical: () => "Movimento muito na vertical. Passe a mão na horizontal.",
  retorno: () => "Ignorado: parecia a mão voltando depois do gesto anterior.",
  gatilho: () => "A mão direita se mexeu, mas o gatilho não está ativo. Levante a mão esquerda aberta, com a palma para a câmera.",
};

function onDebug(info) {
  if (!state.presenting) showDiagnostic(DIAGNOSTICS[info.reason](info), "warn");
}

function showDiagnostic(text, kind) {
  const el = $("gesture-debug");
  el.textContent = text;
  el.className = `diagnostic ${kind}`;
}

// ---------------------------------------------------------------- Câmera: ligar e desligar

// Reflete o estado da câmera no interruptor da barra, na calibração e no resumo.
function setCameraStatus(status, error = "") {
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

function renderCameraSummary() {
  const el = $("summary-camera");
  el.textContent = { off: "Desligada", starting: "Ligando…", on: "Ligada", error: "Com problema" }[state.camera];
  el.className = state.camera === "on" ? "ok" : "warn";
}

async function startCamera() {
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

function cameraFailed(message) {
  state.gestures?.stop();
  state.gestures = null;
  setCameraStatus("error", message);
}

function stopCamera() {
  state.gestures?.stop();
  state.gestures = null;
  $("cam-video").srcObject = null;
  $("pip-video").srcObject = null;
  setCameraStatus("off");
}

function setCameraOn(on) {
  settings.cameraOn = on;
  saveSettings();
  on ? startCamera() : stopCamera();
}

// Alerta mostrado ao tentar apresentar sem a câmera ligada.
function openCameraAlert() {
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

function bindCameraControls() {
  $("cam-toggle").addEventListener("click", () => setCameraOn(!(state.camera === "on" || state.camera === "starting")));
  $("cam-retry").addEventListener("click", () => setCameraOn(true));
  $("cam-alert-cancel").addEventListener("click", () => $("cam-alert").close());
  $("cam-alert-ok").addEventListener("click", () => {
    if (state.camera !== "starting") setCameraOn(true);
    $("cam-alert").close();
  });
}

// ---------------------------------------------------------------- Versão web x computador

// Rodando pelo Iniciar.bat, o servidor local responde /health e converte .pptx com o
// PowerPoint ("desktop"). Publicado como site, não há servidor ("web", o padrão do HTML).
let modeReady = Promise.resolve();
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
modeReady = detectMode();
updateStepper();
showView("welcome");
bindCameraControls();
if (settings.cameraOn) startCamera();
else setCameraStatus("off");
