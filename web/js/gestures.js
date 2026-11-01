// Reconhecimento de gestos com MediaPipe Hand Landmarker (roda no navegador).
//
// Todas as coordenadas são do vídeo cru da câmera (sem espelhamento): x cresce para a
// direita da imagem, que é a ESQUERDA de quem está de frente para a câmera.

import { FilesetResolver, HandLandmarker } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

// Índices dos pontos da mão no MediaPipe
const WRIST = 0, THUMB_IP = 3, THUMB_TIP = 4, INDEX_MCP = 5, MIDDLE_MCP = 9, MIDDLE_TIP = 12, PINKY_MCP = 17;
const FINGERS = [[8, 6], [12, 10], [16, 14], [20, 18]]; // [ponta, articulação PIP]
const PALM_POINTS = [0, 5, 9, 13, 17];

export const DEFAULTS = {
  requireTrigger: true,   // só aceita swipes com o gatilho da mão esquerda ativo
  swapHandedness: true,   // o MediaPipe rotula as mãos supondo imagem espelhada
  invertDirection: false,
  swipeDistance: 1.4,     // distância mínima do swipe, em palmos (tamanho da mão na imagem)
  minSpeed: 5.5,         // velocidade de pico mínima do swipe (palmos por segundo)
  restSpeed: 2.2,         // abaixo dessa velocidade a mão é considerada parada (palmos por segundo)
  velocityWindowMs: 100,  // janela usada para medir a velocidade da mão
  restMs: 110,           // tempo parada que encerra o gesto (é quando o slide troca)
  maxGestureMs: 1600,     // movimento contínuo mais longo que isso é descartado
  returnWindowMs: 1300,   // janela em que um movimento oposto pode ser só o retorno da mão
  correctWindowMs: 900,   // janela em que um movimento oposto corrige um impulso confundido com comando
  triggerHoldMs: 140,     // tempo que o gatilho precisa ser mantido para ativar
  triggerGraceMs: 350,    // tolerância a falhas de detecção antes de desativar
};

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Mão esquerda levantada, palma para a câmera, cinco dedos estendidos.
export function isTriggerPose(lm) {
  const palm = dist(lm[WRIST], lm[MIDDLE_MCP]);
  if (palm < 1e-3) return false;

  const fingersOpen = FINGERS.every(([tip, pip]) => dist(lm[tip], lm[WRIST]) > dist(lm[pip], lm[WRIST]) * 1.12);
  const thumbOpen = dist(lm[THUMB_TIP], lm[INDEX_MCP]) > palm * 0.5 && dist(lm[THUMB_TIP], lm[WRIST]) > dist(lm[THUMB_IP], lm[WRIST]);
  const raised = lm[MIDDLE_TIP].y < lm[WRIST].y - palm * 0.6;

  // Para a mão esquerda com a palma voltada para a câmera, o indicador fica à esquerda do
  // mindinho na imagem crua: o produto vetorial (indicador × mindinho) a partir do pulso é positivo.
  const w = lm[WRIST], i = lm[INDEX_MCP], p = lm[PINKY_MCP];
  const cross = (i.x - w.x) * (p.y - w.y) - (i.y - w.y) * (p.x - w.x);
  const palmForward = cross > 0;

  return fingersOpen && thumbOpen && raised && palmForward;
}

// Comprimento da palma (pulso até a base do dedo médio) em unidades da largura do quadro.
function palmSize(lm, aspect) {
  const a = lm[WRIST], b = lm[MIDDLE_MCP];
  return Math.max(Math.hypot(a.x - b.x, (a.y - b.y) * aspect), 0.01);
}

function palmCenter(lm) {
  let x = 0, y = 0;
  for (const k of PALM_POINTS) { x += lm[k].x; y += lm[k].y; }
  return { x: x / PALM_POINTS.length, y: y / PALM_POINTS.length };
}

export class GestureController {
  constructor(video, { onTrigger, onSwipe, onFrame, onDebug } = {}) {
    this.video = video;
    this.options = { ...DEFAULTS };
    this.onTrigger = onTrigger ?? (() => {});
    this.onSwipe = onSwipe ?? (() => {});
    this.onFrame = onFrame ?? (() => {});
    this.onDebug = onDebug ?? (() => {});

    this.landmarker = null;
    this.running = false;
    this.lastVideoTime = -1;

    this.triggerActive = false;
    this.triggerPoseSince = null;
    this.triggerLastSeen = 0;

    this.prevLeft = null;
    this.track = null;
    this.rightLastSeen = 0;
    this.lastCommand = null;
  }

  setOptions(opts) {
    Object.assign(this.options, opts);
  }

  async start() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 }, facingMode: "user" },
      audio: false,
    });
    this.video.srcObject = stream;
    await this.video.play();

    const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
    const create = (delegate) => HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate },
      runningMode: "VIDEO",
      numHands: 2,
      minHandDetectionConfidence: 0.6,
      minHandPresenceConfidence: 0.6,
      minTrackingConfidence: 0.5,
    });
    try {
      this.landmarker = await create("GPU");
    } catch {
      this.landmarker = await create("CPU");
    }

    this.running = true;
    this._schedule();
  }

  stop() {
    this.running = false;
    this.video.srcObject?.getTracks().forEach((t) => t.stop());
    this.landmarker?.close();
  }

  _schedule() {
    if (!this.running) return;
    if ("requestVideoFrameCallback" in this.video) {
      this.video.requestVideoFrameCallback(() => this._tick());
    } else {
      requestAnimationFrame(() => this._tick());
    }
  }

  _tick() {
    if (!this.running) return;
    const now = performance.now();
    if (this.video.currentTime !== this.lastVideoTime && this.video.readyState >= 2) {
      this.lastVideoTime = this.video.currentTime;
      const result = this.landmarker.detectForVideo(this.video, now);
      this._process(result, now);
    }
    this._schedule();
  }

  _process(result, now) {
    const aspect = this.video.videoHeight / this.video.videoWidth || 0.75;
    const hands = result.landmarks.map((lm, i) => {
      let label = result.handednesses[i]?.[0]?.categoryName ?? "Right";
      if (this.options.swapHandedness) label = label === "Left" ? "Right" : "Left";
      return { lm, side: label === "Left" ? "left" : "right", center: palmCenter(lm), size: palmSize(lm, aspect), pose: isTriggerPose(lm) };
    });

    // Com as duas mãos visíveis, o rótulo do modelo não é confiável. Em ordem de prioridade:
    // 1. quem faz o gatilho é a esquerda (a checagem da palma só vale para a mão esquerda);
    // 2. continuidade: a mão mais próxima de onde a esquerda estava no quadro anterior;
    // 3. posição: a esquerda de quem apresenta aparece à direita da imagem crua (x maior).
    // Assim a identificação não troca quando a mão direita cruza o corpo durante o swipe.
    if (hands.length === 2) {
      const [a, b] = hands;
      let leftIsA;
      if (a.pose !== b.pose) leftIsA = a.pose;
      else if (this.prevLeft) leftIsA = dist(a.center, this.prevLeft) <= dist(b.center, this.prevLeft);
      else leftIsA = a.center.x > b.center.x;
      a.side = leftIsA ? "left" : "right";
      b.side = leftIsA ? "right" : "left";
    }

    const left = hands.find((h) => h.side === "left");
    const right = hands.find((h) => h.side === "right");
    const leftPose = left?.pose ?? false;
    this.prevLeft = left?.center ?? null;

    this._updateTrigger(leftPose, now);
    this._updateSwipe(right, now);

    this.onFrame({ hands, leftPose, triggerActive: this.triggerActive });
  }

  _updateTrigger(poseNow, now) {
    const o = this.options;
    if (poseNow) {
      this.triggerLastSeen = now;
      this.triggerPoseSince ??= now;
    } else if (now - this.triggerLastSeen > o.triggerGraceMs) {
      this.triggerPoseSince = null;
    }

    const active = this.triggerPoseSince !== null && now - this.triggerPoseSince >= o.triggerHoldMs;
    if (active !== this.triggerActive) {
      this.triggerActive = active;
      this.onTrigger(active);
    }
  }

  // O swipe é interpretado quando a mão PARA, olhando a sequência inteira de trechos desde
  // a última posição de repouso (âncora). Assim o impulso de preparação não vira comando:
  //   impulso p/ esquerda + swipe p/ direita passando da âncora -> voltar;
  //   swipe p/ esquerda + retorno até a âncora                  -> avançar (retorno ignorado).
  // Distâncias e velocidades são medidas em "palmos" (tamanho da mão na imagem), então o
  // gesto vale o mesmo com a pessoa perto ou longe da câmera.
  _updateSwipe(right, now) {
    const o = this.options;
    const armed = !o.requireTrigger || this.triggerActive;
    if (!armed) {
      this.track = null;
      this._reportUnarmedMotion(right, now);
      return;
    }

    if (!right || now - this.rightLastSeen > 150) {
      // A mão saiu do quadro no meio do movimento: interpreta o que já foi feito.
      if (this.track?.strokes.length) this._decide(this.track, now, true);
      this.track = null;
      if (!right) return;
    }
    this.rightLastSeen = now;

    const c = right.center;
    if (!this.track) {
      const last = { x: c.x, y: c.y, t: now };
      this.track = { anchor: { x: c.x, y: c.y }, last, samples: [last], unit: right.size, strokes: [], stillSince: now, movingSince: null };
      return;
    }
    const tr = this.track;
    tr.unit += (right.size - tr.unit) * 0.2;

    // Suaviza a posição e mede a velocidade numa janela de ~100 ms, para o tremor da
    // detecção (que pesa mais com a mão pequena, longe da câmera) não virar movimento.
    const prev = tr.last;
    const x = prev.x + (c.x - prev.x) * 0.6, y = prev.y + (c.y - prev.y) * 0.6;
    tr.last = { x, y, t: now };
    tr.samples.push(tr.last);
    while (tr.samples.length > 2 && now - tr.samples[1].t >= o.velocityWindowMs) tr.samples.shift();
    const ref = tr.samples[0];
    const vx = ((x - ref.x) / tr.unit / Math.max(now - ref.t, 1)) * 1000; // palmos por segundo

    if (Math.abs(vx) < o.restSpeed) {
      tr.stillSince ??= now;
      if (now - tr.stillSince >= o.restMs) {
        if (tr.strokes.length) this._decide(tr, now, false);
        tr.anchor = { x, y };
        tr.strokes = [];
        tr.movingSince = null;
      }
      return;
    }
    tr.stillSince = null;
    tr.movingSince ??= now;
    if (now - tr.movingSince > o.maxGestureMs) {
      // Movimento contínuo demais (gesticulando): recomeça a partir daqui.
      tr.anchor = { x, y };
      tr.strokes = [];
      tr.movingSince = now;
    }

    const dir = Math.sign(vx);
    let s = tr.strokes[tr.strokes.length - 1];
    if (!s || s.dir !== dir) {
      // O trecho novo começa no ponto extremo do anterior (ou na âncora, se for o primeiro).
      s = { dir, start: s ? s.end : tr.anchor, end: null, peak: 0 };
      tr.strokes.push(s);
    }
    s.end = { x, y };
    s.peak = Math.max(s.peak, Math.abs(vx));
  }

  _decide(tr, now, lost) {
    const o = this.options;
    const amp = (s) => Math.abs(s.end.x - s.start.x) / tr.unit;

    // Junta trechos consecutivos no mesmo sentido e descarta os tremores.
    const strokes = [];
    for (const s of tr.strokes) {
      if (amp(s) < o.swipeDistance * 0.3) continue;
      const p = strokes[strokes.length - 1];
      if (p && p.dir === s.dir) { p.end = s.end; p.peak = Math.max(p.peak, s.peak); }
      else strokes.push({ ...s });
    }
    if (!strokes.length) return;

    // O último trecho só devolveu a mão ao ponto de partida? Então é retorno e o gesto foi o anterior.
    let cmd = strokes[strokes.length - 1];
    if (strokes.length >= 2) {
      const before = strokes[strokes.length - 2];
      const overshoot = (cmd.end.x - tr.anchor.x) * cmd.dir / tr.unit;
      if (overshoot < amp(cmd) * 0.25 && amp(cmd) < amp(before) * 1.25) cmd = before;
    }

    const a = amp(cmd);
    const nearEdge = cmd.dir > 0 ? cmd.end.x > 0.8 : cmd.end.x < 0.2;
    const minAmp = lost && nearEdge ? o.swipeDistance * 0.55 : o.swipeDistance;
    const info = { distance: a / minAmp, speed: cmd.peak / o.minSpeed };
    if (a < Math.abs(cmd.end.y - cmd.start.y) / tr.unit * 1.5) return this.onDebug({ reason: "vertical", ...info });
    if (a < minAmp) return this.onDebug({ reason: "curto", ...info });
    if (cmd.peak < o.minSpeed) return this.onDebug({ reason: "lento", ...info });

    // Comparação com o comando anterior, quando foi há pouco e no sentido oposto:
    const last = this.lastCommand;
    let corrects = false;
    if (last && cmd.dir === -last.dir && now - last.at < o.returnWindowMs) {
      const pastStart = (cmd.end.x - last.startX) * cmd.dir / tr.unit;
      // - mão voltando para onde estava, mais devagar que o swipe: retorno, ignora;
      if (pastStart < a * 0.35 && cmd.peak < last.peak * 0.8) return this.onDebug({ reason: "retorno", ...info });
      // - passou bem do ponto de partida logo em seguida: o anterior era só impulso, corrige.
      corrects = pastStart >= a * 0.25 && now - last.at < o.correctWindowMs;
    }

    this.lastCommand = { dir: cmd.dir, at: now, startX: cmd.start.x, peak: cmd.peak };
    // dx > 0 na imagem crua = mão indo da direita para a esquerda de quem apresenta = avançar.
    this.onSwipe(o.invertDirection ? -cmd.dir : cmd.dir, { corrects });
  }

  // Avisa (no máximo 1x por segundo) quando a mão direita faz um swipe sem o gatilho ativo.
  _reportUnarmedMotion(right, now) {
    const prev = this.unarmedLast;
    this.unarmedLast = right ? { x: right.center.x, t: now, size: right.size } : null;
    if (!right || !prev || now - (this.unarmedReportedAt ?? 0) < 1000) return;
    const v = (Math.abs(right.center.x - prev.x) / right.size / Math.max(now - prev.t, 1)) * 1000;
    if (v > this.options.minSpeed * 1.5) {
      this.unarmedReportedAt = now;
      this.onDebug({ reason: "gatilho" });
    }
  }
}

// Desenha os pontos das mãos sobre o canvas de pré-visualização.
const CONNECTIONS = HandLandmarker.HAND_CONNECTIONS;

export function drawHands(canvas, video, { hands, leftPose }) {
  const ctx = canvas.getContext("2d");
  const w = (canvas.width = video.videoWidth || 640);
  const h = (canvas.height = video.videoHeight || 480);
  ctx.clearRect(0, 0, w, h);

  for (const { lm, side } of hands) {
    const color = side === "left" ? (leftPose ? "#34c778" : "#f0a92e") : "#5b8def";
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 3;
    for (const { start, end } of CONNECTIONS) {
      ctx.beginPath();
      ctx.moveTo(lm[start].x * w, lm[start].y * h);
      ctx.lineTo(lm[end].x * w, lm[end].y * h);
      ctx.stroke();
    }
    for (const p of lm) {
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
