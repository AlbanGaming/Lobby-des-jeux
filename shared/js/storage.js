// Sauvegarde locale robuste : try/catch partout, namespace `gv:<nom>`,
// numéro de version du format et migrations. Si le stockage est indisponible
// (navigation privée, quota plein), on continue en mémoire sans planter.

const PREFIX = 'gv:';
const memory = new Map();

function storage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readRaw(key) {
  try {
    const s = storage();
    const v = s ? s.getItem(key) : null;
    return v ?? (memory.has(key) ? memory.get(key) : null);
  } catch {
    return memory.has(key) ? memory.get(key) : null;
  }
}

export function writeRaw(key, value) {
  memory.set(key, value);
  try {
    storage()?.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeRaw(key) {
  memory.delete(key);
  try {
    storage()?.removeItem(key);
  } catch {
    /* rien à faire */
  }
}

export function readJSON(key, fallback = null) {
  const raw = readRaw(key);
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function listKeys(prefix = PREFIX) {
  const out = new Set();
  try {
    const s = storage();
    if (s) for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k && k.startsWith(prefix)) out.add(k);
    }
  } catch {
    /* ignore */
  }
  for (const k of memory.keys()) if (k.startsWith(prefix)) out.add(k);
  return [...out];
}

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// Complète `data` avec les champs manquants de `defaults` (récursif, objets simples uniquement).
export function withDefaults(data, defaults) {
  if (!isPlainObject(defaults)) return data === undefined ? defaults : data;
  const out = isPlainObject(data) ? { ...data } : {};
  for (const k of Object.keys(defaults)) {
    if (out[k] === undefined) out[k] = structuredClone(defaults[k]);
    else if (isPlainObject(defaults[k]) && isPlainObject(out[k])) out[k] = withDefaults(out[k], defaults[k]);
  }
  return out;
}

/**
 * Crée un magasin versionné.
 *   const store = createStore('volt-rush', { version: 1, defaults: { best: 0 }, migrate })
 *   store.data.best = 12; store.save();
 * `migrate(data, fromVersion)` reçoit les anciennes données (fromVersion = 0 pour un import
 * d'ancienne clé) et renvoie les données au format courant.
 */
export function createStore(name, { version = 1, defaults = {}, migrate } = {}) {
  const key = PREFIX + name;
  let timer = null;

  function load() {
    const parsed = readJSON(key);
    let data;
    if (parsed && typeof parsed === 'object' && 'v' in parsed && 'data' in parsed) {
      data = parsed.data;
      if (parsed.v < version && migrate) {
        try {
          data = migrate(data, parsed.v);
        } catch (err) {
          console.warn(`[gv] migration ${name} v${parsed.v}→v${version} impossible`, err);
          data = {};
        }
      }
    } else {
      data = migrate ? migrate(undefined, -1) : undefined;
    }
    return withDefaults(data, defaults);
  }

  const store = {
    key,
    version,
    data: load(),
    save() {
      clearTimeout(timer);
      timer = null;
      return writeRaw(key, JSON.stringify({ v: version, data: store.data, t: Date.now() }));
    },
    // Regroupe les écritures rapprochées (ex. un jeu idle qui sauve souvent)
    saveSoon(delay = 400) {
      if (timer) return;
      timer = setTimeout(() => store.save(), delay);
    },
    update(fn) {
      fn(store.data);
      store.save();
      return store.data;
    },
    reload() {
      store.data = load();
      return store.data;
    },
    reset() {
      store.data = structuredClone(defaults);
      store.save();
      return store.data;
    },
  };

  // Ne jamais perdre une écriture différée quand on quitte la page
  window.addEventListener('pagehide', () => {
    if (timer) store.save();
  });

  return store;
}
