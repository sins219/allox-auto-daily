/**
 * HTTP layer built on Node's global fetch (Node 18+).
 *
 * - Per-request proxy support via undici's ProxyAgent (loaded lazily; only
 *   required when a proxy is actually used, so the base bot has ZERO npm deps
 *   beyond ethers).
 * - Exponential-backoff retries on network errors, timeouts, 429, and 5xx.
 * - 4xx (except 429) fail fast — retrying a bad request is pointless.
 */
import { config } from "../config.js";
import { logWarn, logError } from "./logger.js";
import { sleep } from "./utils.js";

let ProxyAgentCtor = null;
async function getProxyAgent(proxyUrl) {
  if (!proxyUrl) return undefined;
  if (ProxyAgentCtor === null) {
    try {
      ({ ProxyAgent: ProxyAgentCtor } = await import("undici"));
    } catch {
      logError("Proxy requested but 'undici' is unavailable. Node 18+ bundles it; run 'npm install undici' if missing.");
      ProxyAgentCtor = false;
    }
  }
  if (!ProxyAgentCtor) return undefined;
  return new ProxyAgentCtor(proxyUrl);
}

/**
 * A lightweight session object holding default headers + an optional proxy.
 * `request()` merges these into every call.
 */
export function buildSession(proxy = null) {
  return {
    proxy,
    headers: {
      "User-Agent": config.USER_AGENT,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  };
}

/**
 * Perform an HTTP request with retries.
 * Returns the parsed body ({ ok, status, data, text }) or null on hard failure.
 *
 * @param {"GET"|"POST"} method
 * @param {string} url
 * @param {object} session   from buildSession()
 * @param {object} [opts]     { json, params, headers, timeout, maxRetries }
 */
export async function safeRequest(method, url, session, opts = {}) {
  const {
    json,
    params,
    headers = {},
    timeout = 20000,
    maxRetries = 3,
  } = opts;

  let target = url;
  if (params) {
    const qs = new URLSearchParams(params).toString();
    target += (target.includes("?") ? "&" : "?") + qs;
  }

  const dispatcher = await getProxyAgent(session.proxy);
  let lastErr = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(target, {
        method,
        headers: { ...session.headers, ...headers },
        body: json !== undefined ? JSON.stringify(json) : undefined,
        signal: controller.signal,
        dispatcher,
      });
      clearTimeout(timer);

      const rawText = await res.text();
      let data = null;
      try {
        data = rawText ? JSON.parse(rawText) : null;
      } catch {
        data = null; // non-JSON; caller inspects .text
      }

      if (res.ok) return { ok: true, status: res.status, data, text: rawText };

      // 4xx (not 429) → don't retry
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        logWarn(`HTTP ${res.status} (no retry)`);
        return { ok: false, status: res.status, data, text: rawText };
      }
      logWarn(`HTTP ${res.status} (attempt ${attempt}/${maxRetries})`);
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (e) {
      clearTimeout(timer);
      const name = e?.name || "Error";
      if (name === "AbortError") {
        logWarn(`Timeout (attempt ${attempt}/${maxRetries})`);
      } else {
        logWarn(`Network error (attempt ${attempt}/${maxRetries}): ${e.message}`);
      }
      lastErr = e;
    }

    if (attempt < maxRetries) {
      await sleep((2 ** attempt) * 1000 + Math.random() * 1000);
    }
  }

  logError(`Request failed after ${maxRetries} attempts: ${lastErr?.message || lastErr}`);
  return null;
}
