/**
 * Small, dependency-free helpers: .env loader, env parsers, sleep, proxy mask.
 */
import fs from "node:fs";

/** Tiny inline .env parser (no dotenv dependency). Does not override existing env. */
export function loadDotenv(path = ".env") {
  if (!fs.existsSync(path)) return;
  try {
    const raw = fs.readFileSync(path, "utf-8");
    for (const line of raw.split(/\r?\n/)) {
      const s = line.trim();
      if (!s || s.startsWith("#") || !s.includes("=")) continue;
      const idx = s.indexOf("=");
      const k = s.slice(0, idx).trim();
      let v = s.slice(idx + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (k && !(k in process.env)) process.env[k] = v;
    }
  } catch {
    /* ignore malformed .env */
  }
}

/** Read a comma-separated env var; fall back to `def` if empty. */
export function csvEnv(name, def) {
  const raw = (process.env[name] || "").trim();
  if (!raw) return [...def];
  const items = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return items.length ? items : [...def];
}

/** Read a pipe-separated env var; fall back to `def` if empty. */
export function pipeEnv(name, def) {
  const raw = (process.env[name] || "").trim();
  if (!raw) return [...def];
  const items = raw.split("|").map((s) => s.trim()).filter(Boolean);
  return items.length ? items : [...def];
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Random float in [min, max). */
export const randFloat = (min, max) => Math.random() * (max - min) + min;

/** Pick a random element from a non-empty array. */
export const choice = (arr) => arr[Math.floor(Math.random() * arr.length)];

/** In-place Fisher–Yates shuffle. */
export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Hide credentials in a proxy URL for logging: http://user:***@host:port */
export function maskProxy(p) {
  return p.replace(/(:\/\/[^:]+:)[^@]+(@)/, "$1***$2");
}

/**
 * Recursively pull the first non-null value for any of `keys` from a nested
 * object. Mirrors the Python `_extract` helper so we tolerate varying API
 * response shapes.
 */
export function extract(data, keys, def = undefined) {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    for (const k of keys) {
      if (k in data && data[k] !== null && data[k] !== undefined) return data[k];
    }
    for (const v of Object.values(data)) {
      const found = extract(v, keys, undefined);
      if (found !== undefined) return found;
    }
  } else if (Array.isArray(data)) {
    for (const v of data) {
      const found = extract(v, keys, undefined);
      if (found !== undefined) return found;
    }
  }
  return def;
}
