// Arquivos recentes, guardados no IndexedDB do navegador (ficam só neste computador).
// Qualquer falha de armazenamento (modo anônimo, cota cheia) é ignorada: a lista apenas fica vazia.

// Nome antigo do app, mantido para não perder os recentes já salvos.
const DB_NAME = "gestos";
const STORE = "recentes";
const MAX_ITEMS = 6;
const MAX_BYTES = 120 * 1024 * 1024;

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run(mode, fn) {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const result = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(result?.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

// Lista sem os arquivos em si, do mais recente para o mais antigo.
export async function listRecent() {
  try {
    const all = (await run("readonly", (s) => s.getAll())) ?? [];
    return all.sort((a, b) => b.openedAt - a.openedAt).map(({ files, ...meta }) => meta);
  } catch {
    return [];
  }
}

export async function getRecentFiles(id) {
  const item = await run("readonly", (s) => s.get(id));
  if (!item) throw new Error("Esse arquivo não está mais nos recentes.");
  touch(item);
  return item.files;
}

export async function saveRecent(deck, format) {
  try {
    const files = deck.sources ?? [];
    const bytes = files.reduce((n, f) => n + f.size, 0);
    if (!files.length || bytes > MAX_BYTES) return;
    const id = `${deck.title}|${bytes}`;
    await run("readwrite", (s) => s.put({ id, title: deck.title, format, count: deck.count, bytes, openedAt: Date.now(), files }));

    // Mantém só os mais recentes.
    const list = await listRecent();
    for (const old of list.slice(MAX_ITEMS)) await run("readwrite", (s) => s.delete(old.id));
  } catch (err) {
    console.warn("Não foi possível salvar nos recentes:", err);
  }
}

export async function removeRecent(id) {
  try { await run("readwrite", (s) => s.delete(id)); } catch {}
}

function touch(item) {
  run("readwrite", (s) => s.put({ ...item, openedAt: Date.now() })).catch(() => {});
}
