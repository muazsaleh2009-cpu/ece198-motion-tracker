// Persistence in IndexedDB (a plan plus many sessions with angle traces can exceed the ~5 MB
// localStorage limit). If IndexedDB is unavailable (private window, blocked site data) the app
// keeps working from memory and tells the user their data will not survive a reload.

const DB_NAME = 'therapypal';
const STORE = 'kv';
const memory = {};
let dbPromise = null;

function openDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      try {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        req.onblocked = () => reject(new Error('blocked'));
      } catch (e) {
        reject(e);
      }
    });
  }
  return dbPromise;
}

const tx = (db, mode, fn) =>
  new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(out && 'result' in out ? out.result : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });

/** Load everything. Returns { plan, sessions, notes, persistent }. */
export async function loadState() {
  try {
    const db = await openDB();
    const plan = await tx(db, 'readonly', (s) => s.get('plan'));
    const sessions = await tx(db, 'readonly', (s) => s.get('sessions'));
    const notes = await tx(db, 'readonly', (s) => s.get('notes'));
    return { plan: plan ?? null, sessions: sessions ?? [], notes: notes ?? [], persistent: true };
  } catch {
    return { plan: null, sessions: [], notes: [], persistent: false };
  }
}

export async function saveKey(key, value) {
  memory[key] = value;
  try {
    const db = await openDB();
    await tx(db, 'readwrite', (s) => (value == null ? s.delete(key) : s.put(value, key)));
    return true;
  } catch {
    return false;
  }
}

export async function clearAll() {
  await Promise.all([saveKey('plan', null), saveKey('sessions', []), saveKey('notes', [])]);
}
