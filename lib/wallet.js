/**
 * Web3 wallet helpers built on ethers v6.
 *  - private key → checksummed address
 *  - EIP-191 (personal_sign) login-message signing
 */
import { Wallet, computeAddress } from "ethers";
import { logError } from "./logger.js";

/**
 * Derive the Ethereum address from a private key.
 * Returns null (and logs) if the key is malformed.
 */
export function privateKeyToAddress(pk) {
  let key = pk.trim();
  if (!key.startsWith("0x")) key = "0x" + key;
  const hex = key.slice(2);
  if (hex.length !== 64) {
    logError(`Invalid key length: ${hex.length} hex chars (expected 64)`);
    return null;
  }
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    logError("Private key contains non-hex characters");
    return null;
  }
  try {
    return computeAddress(key);
  } catch (e) {
    logError(`Invalid private key: ${e.message}`);
    return null;
  }
}

/**
 * Sign the Allox login message (EIP-191 personal_sign) for a given nonce.
 * Returns { message, signature } or null on failure.
 */
export async function signLoginMessage(pk, nonce) {
  let key = pk.trim();
  if (!key.startsWith("0x")) key = "0x" + key;
  const messageText =
    "Welcome to Allox!\n\n" +
    "Click to sign in. This action will not trigger a transaction.\n\n" +
    `Nonce: ${nonce}`;
  try {
    const wallet = new Wallet(key);
    const signature = await wallet.signMessage(messageText);
    return { message: messageText, signature };
  } catch (e) {
    logError(`Signing failed: ${e.message}`);
    return null;
  }
}
