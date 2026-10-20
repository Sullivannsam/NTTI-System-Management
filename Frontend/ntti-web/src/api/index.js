import client, { API_BASE_URL } from "./client";
import { RESOURCES, RESOURCE_BY_LS, LOCAL_ONLY_KEYS } from "./resources";

/**
 * The app's whole data layer.
 *
 * Historically every page read and wrote `localStorage` directly, synchronously.
 * A real HTTP API is asynchronous, so instead of rewriting every render path
 * this module keeps one small in-memory cache that:
 *
 *   • is filled once at startup from the REST API (`hydrate()`),
 *   • answers reads synchronously (`getItem`), exactly like localStorage did,
 *   • write-throughs every change to the API (`setItem` / `removeItem`),
 *   • mirrors writes to localStorage so the app still runs when the API is down.
 *
 * `REACT_APP_USE_MOCK=true` keeps everything on localStorage (the old behaviour)
 * so you can keep working while the backend endpoints are being built.
 */
const USE_MOCK = String(process.env.REACT_APP_USE_MOCK || "").toLowerCase() === "true";

const cache = new Map(); // localStorage key -> JSON string
const pending = new Map(); // localStorage key -> timeout id (debounced writes)
const warned = new Set(); // resources already warned about, to avoid console spam
let hydrated = false;
const health = { online: false, attempted: false, loaded: 0, failed: 0, error: null };

const WRITE_DEBOUNCE_MS = 300;

function safeLocalGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* quota / disabled storage — the in-memory cache still works */
  }
}

function safeLocalRemove(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function isManaged(lsKey) {
  return !LOCAL_ONLY_KEYS.has(lsKey) && Object.prototype.hasOwnProperty.call(RESOURCE_BY_LS, lsKey);
}

/* A key is handled entirely on the device when it is a UI pref, an unknown key,
   or when the whole app is running in mock mode. */
function isLocalOnly(lsKey) {
  return !isManaged(lsKey) || USE_MOCK;
}

/* ── synchronous reads ──────────────────────────────────── */

/**
 * Drop-in replacement for localStorage.getItem for managed keys.
 *
 * In API mode a managed key returns ONLY what the backend provided during
 * hydration — never the localStorage copy. So if the backend is down or has no
 * data, the app shows empty states instead of stale local data.
 */
export function getItem(lsKey) {
  if (!lsKey) return null;
  if (isLocalOnly(lsKey)) return safeLocalGet(lsKey);
  return cache.has(lsKey) ? cache.get(lsKey) : null;
}

/* ── write-through ──────────────────────────────────────── */

function enqueue(lsKey, verb) {
  if (USE_MOCK) return;
  const resource = RESOURCE_BY_LS[lsKey];
  if (!resource || resource.readOnly) return;
  clearTimeout(pending.get(lsKey));
  const id = setTimeout(() => {
    pending.delete(lsKey);
    flushOne(lsKey, verb);
  }, WRITE_DEBOUNCE_MS);
  pending.set(lsKey, id);
}

async function flushOne(lsKey, verb) {
  const resource = RESOURCE_BY_LS[lsKey];
  if (!resource || resource.readOnly) return;
  try {
    if (verb === "delete") {
      await client.delete(resource.path);
    } else {
      if (!cache.has(lsKey)) return; // nothing to send
      const raw = cache.get(lsKey);
      let body = raw;
      try {
        body = raw == null ? null : JSON.parse(raw);
      } catch {
        /* send the raw string if it was not valid JSON */
      }
      await client.put(resource.path, body);
    }
    health.online = true;
    warned.delete(resource.name || lsKey);
  } catch (err) {
    health.online = false;
    health.error = err.apiMessage || err.message;
    const key = resource.name || lsKey;
    if (!warned.has(key)) {
      warned.add(key);
      // eslint-disable-next-line no-console
      console.warn(`[api] could not save ${resource.label} to ${API_BASE_URL}${resource.path}: ${health.error}`);
    }
  }
}

/** Drop-in replacement for localStorage.setItem for managed keys. */
export function setItem(lsKey, value) {
  if (!lsKey) return;
  const str = typeof value === "string" ? value : String(value);
  if (isLocalOnly(lsKey)) {
    safeLocalSet(lsKey, str);
    return;
  }
  cache.set(lsKey, str);
  enqueue(lsKey, "put");
}

/** Drop-in replacement for localStorage.removeItem for managed keys. */
export function removeItem(lsKey) {
  if (!lsKey) return;
  if (isLocalOnly(lsKey)) {
    safeLocalRemove(lsKey);
    return;
  }
  cache.delete(lsKey);
  enqueue(lsKey, "delete");
}

/* ── startup hydration ──────────────────────────────────── */

/**
 * Is anything answering at the API root? Any HTTP status counts (a 404 means the
 * server is there, just without a /health route). Only a network-level failure
 * (no response at all) means "not running".
 */
async function serverReachable() {
  try {
    await client.get("/api/health", { timeout: 2500 });
    return true;
  } catch (err) {
    return Boolean(err && err.response);
  }
}

/**
 * Load every managed resource from the API once, before the app renders.
 * A resource whose request fails is left in the cache untouched, so `getItem`
 * falls back to the localStorage value and the app keeps working offline.
 */
export async function hydrate() {
  if (USE_MOCK) {
    health.attempted = true;
    health.online = false;
    health.error = "mock mode";
    hydrated = true;
    return health;
  }
  health.attempted = true;
  if (!(await serverReachable())) {
    health.online = false;
    health.error = "server not reachable";
    hydrated = true;
    // eslint-disable-next-line no-console
    console.warn(
      `[api] nothing is listening at ${API_BASE_URL}. Pages will show empty data until the ` +
        `backend is up (set REACT_APP_USE_MOCK=true to run on local demo data instead).`
    );
    return health;
  }
  const entries = Object.entries(RESOURCES).filter(([, r]) => !r.readOnly);
  const results = await Promise.allSettled(
    entries.map(([, r]) => client.get(r.path, { timeout: 6000 }))
  );
  results.forEach((result, i) => {
    const [, resource] = entries[i];
    if (result.status === "fulfilled") {
      try {
        cache.set(resource.ls, JSON.stringify(result.value.data));
      } catch {
        /* non-serialisable — ignore */
      }
      health.loaded += 1;
    } else {
      health.failed += 1;
    }
  });
  health.online = health.failed === 0;
  health.error = health.failed ? `${health.failed}/${entries.length} endpoint(s) did not respond` : null;
  hydrated = true;
  if (health.failed) {
    // eslint-disable-next-line no-console
    console.warn(
      `[api] ${health.error} at ${API_BASE_URL}. Those resources will stay empty until the endpoints exist.`
    );
  }
  return health;
}

/** Force any debounced writes out immediately. */
export async function flush() {
  const keys = [...pending.keys()];
  keys.forEach((k) => clearTimeout(pending.get(k)));
  pending.clear();
  await Promise.all(keys.map((k) => flushOne(k, "put")));
}

/** Convenience: parsed value of a resource by name. */
export function read(name, fallback = null) {
  const resource = RESOURCES[name];
  if (!resource) return fallback;
  try {
    const raw = getItem(resource.ls);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

/** Convenience: write a resource by name. */
export function write(name, value) {
  const resource = RESOURCES[name];
  if (!resource) return;
  setItem(resource.ls, JSON.stringify(value));
}

export function isHydrated() {
  return hydrated;
}

export { client, RESOURCES, API_BASE_URL, USE_MOCK };
export default { getItem, setItem, removeItem, hydrate, flush, read, write, isHydrated, client, RESOURCES, API_BASE_URL, USE_MOCK };
