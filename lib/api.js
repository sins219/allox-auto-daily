/**
 * Allox API client: nonce → sign → verify (login) → chat.
 * Tolerant response parsing via extract() so minor schema changes don't break.
 */
import { config } from "../config.js";
import { safeRequest } from "./http.js";
import { logError } from "./logger.js";
import { extract } from "./utils.js";

/** GET a login nonce for the wallet. Returns the nonce string or null. */
export async function requestNonce(session, address) {
  const r = await safeRequest("GET", config.NONCE_URL, session, {
    params: { wallet: address },
  });
  if (!r) return null;
  if (!r.data) {
    logError(`Non-JSON nonce response: ${(r.text || "").slice(0, 120)}`);
    return null;
  }
  const nonce = extract(r.data, ["nonce"]);
  if (!nonce) logError(`No nonce in response: ${JSON.stringify(r.data).slice(0, 200)}`);
  return nonce || null;
}

/** POST the signed message to verify/login. Returns an auth token or null. */
export async function login(session, address, payload) {
  const body = {
    wallet: address,
    message: payload.message,
    signature: payload.signature,
  };
  const r = await safeRequest("POST", config.LOGIN_URL, session, { json: body });
  if (!r) return null;
  if (!r.data) {
    logError(`Non-JSON login response: ${(r.text || "").slice(0, 120)}`);
    return null;
  }
  const token = extract(r.data, ["token", "access_token", "jwt"]);
  if (!token) logError(`No token in response: ${JSON.stringify(r.data).slice(0, 200)}`);
  return token || null;
}

/** POST a chat prompt. Returns the parsed response object or null. */
export async function sendChat(session, token, prompt) {
  const r = await safeRequest("POST", config.CHAT_URL, session, {
    json: { message: prompt },
    headers: { Authorization: `Bearer ${token}` },
    timeout: 60000,
  });
  if (!r) return null;
  if (!r.data) {
    logError(`Non-JSON chat response: ${(r.text || "").slice(0, 120)}`);
    return null;
  }
  return r.data;
}
