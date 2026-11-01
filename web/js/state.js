// Estado compartilhado do app: elementos da página, ajustes salvos e o estado atual.
export const $ = (id) => document.getElementById(id);
// A chave mantém o nome antigo do app para não perder os ajustes já salvos.
export const SETTINGS_KEY = "gestos.settings.v1";
export const CHECKS = ["cam", "left", "trigger", "next", "prev"];

export const state = {
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

// Versão em uso: "web" (site) ou "desktop" (aplicativo/servidor local). main.js preenche.
export const mode = { ready: Promise.resolve() };
