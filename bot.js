#!/usr/bin/env node
/**
 * Allox Auto Bot (JavaScript / Node.js edition)
 * =============================================
 * Auto-login via Web3 wallet signature, auto-chat to an AI endpoint, and farm
 * points. After every 24h cycle it sends an optional Telegram report.
 *
 * Project layout
 * --------------
 *   allox-auto-js/
 *   ├── bot.js              ← this file (entry point)
 *   ├── config.js           ← endpoints, feeds, prompts, timing
 *   ├── telegram.js         ← optional Telegram reporter
 *   ├── lib/                ← http, wallet, api, rss, logger, utils
 *   ├── accounts.txt        ← one private key per line (you create this)
 *   ├── proxy.txt           ← one proxy per line (optional)
 *   └── .env                ← Telegram config (optional)
 *
 * Run
 * ---
 *   npm install
 *   node bot.js
 */
import fs from "node:fs";
import readline from "node:readline";

import { config } from "./config.js";
import {
  banner,
  logInfo,
  logSuccess,
  logWarn,
  logError,
  logColor,
  fmtWIB,
} from "./lib/logger.js";
import { loadDotenv, maskProxy, sleep, randFloat, choice, shuffle, extract } from "./lib/utils.js";
import { buildSession } from "./lib/http.js";
import { privateKeyToAddress, signLoginMessage } from "./lib/wallet.js";
import { requestNonce, login, sendChat } from "./lib/api.js";
import { fetchRssPrompts } from "./lib/rss.js";
import * as telegram from "./telegram.js";

loadDotenv();

// ── File I/O ────────────────────────────────────────────────────────────────
function loadLines(path) {
  if (!fs.existsSync(path)) return [];
  return fs
    .readFileSync(path, "utf-8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
}

function loadAccounts() {
  const keys = loadLines(config.ACCOUNTS_FILE);
  if (!keys.length) {
    logError(`${config.ACCOUNTS_FILE} not found or empty.`);
    logError("Create it with one Ethereum private key per line.");
    process.exit(1);
  }
  logSuccess(`Loaded ${keys.length} account(s) from ${config.ACCOUNTS_FILE}`);
  return keys;
}

function loadProxies() {
  const proxies = loadLines(config.PROXY_FILE);
  if (proxies.length) logSuccess(`Loaded ${proxies.length} proxy from ${config.PROXY_FILE}`);
  return proxies;
}

// ── First-run menu (proxy on/off, persisted to state file) ──────────────────
function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) =>
    rl.question(question, (ans) => {
      rl.close();
      resolve(ans);
    })
  );
}

async function firstRunMenu() {
  if (fs.existsSync(config.STATE_FILE)) {
    try {
      const state = JSON.parse(fs.readFileSync(config.STATE_FILE, "utf-8"));
      if (state.use_proxy === true) {
        logInfo("Mode (saved): WITH PROXY");
        return true;
      }
      if (state.use_proxy === false) {
        logInfo("Mode (saved): WITHOUT PROXY");
        return false;
      }
    } catch {
      /* fall through to prompt */
    }
  }

  logInfo("Select run mode:");
  logColor("  1. Run with proxy", "cyan");
  logColor("  2. Run without proxy", "cyan");
  let use;
  for (;;) {
    const choiceStr = (await ask("\x1b[33mChoice [1/2]: \x1b[0m")).trim();
    if (choiceStr === "1") { use = true; break; }
    if (choiceStr === "2") { use = false; break; }
    logWarn("Invalid choice. Try again.");
  }
  try {
    fs.writeFileSync(config.STATE_FILE, JSON.stringify({ use_proxy: use }));
  } catch {
    /* non-fatal */
  }
  logSuccess("Mode saved.");
  return use;
}

// ── Per-account worker ──────────────────────────────────────────────────────
/** Returns { ok, points, reason }. */
async function runAccount(pk, idx, total, prompts, useProxy, proxies) {
  logInfo(`── Account ${idx}/${total} ──`);

  const address = privateKeyToAddress(pk);
  if (!address) return { ok: false, points: 0, reason: "Invalid private key length or format" };
  logInfo(`Wallet: ${address}`);

  let proxy = null;
  if (useProxy && proxies.length) proxy = choice(proxies);
  const session = buildSession(proxy);
  if (proxy) logInfo(`Proxy: ${maskProxy(proxy)}`);

  const nonce = await requestNonce(session, address);
  if (!nonce) return { ok: false, points: 0, reason: "Failed to fetch nonce (network / proxy / API error)" };

  const sig = await signLoginMessage(pk, nonce);
  if (!sig) return { ok: false, points: 0, reason: "Failed to sign login message (ethers error)" };

  const token = await login(session, address, sig);
  if (!token) return { ok: false, points: 0, reason: "Failed to login (no token in response / auth rejected)" };

  const short = `${address.slice(0, 6)}...${address.slice(-4)}`;
  logSuccess(`Logged in: ${short}`);

  let totalPoints = 0;
  let earlyStop = false;
  for (let i = 1; i <= config.MAX_CHATS; i++) {
    const prompt = choice(prompts);
    const resp = await sendChat(session, token, prompt);
    if (!resp) {
      logWarn(`Chat ${i}/${config.MAX_CHATS} failed, continuing`);
      await sleep(2000);
      continue;
    }
    if (resp.limit_reached || extract(resp, ["error_code"]) === "rate_limited") {
      logWarn(`Daily limit reached — stopping account at ${i - 1}/${config.MAX_CHATS}`);
      earlyStop = true;
      break;
    }
    const pts = extract(resp, ["points_earned", "points", "earned"], 10);
    totalPoints = extract(resp, ["total_points", "total", "balance"], totalPoints + pts);
    const remaining = config.MAX_CHATS - i;
    logSuccess(
      `Chat ${i}/${config.MAX_CHATS} Sent | +${pts} Pts | Total: ${totalPoints} | Limit: ${remaining}`
    );
    await sleep(randFloat(2000, 5000));
  }

  logInfo(
    `Account ${short} done. Final total: ${totalPoints} pts` +
      (earlyStop ? " (early stop: daily limit)" : "")
  );
  return { ok: true, points: totalPoints, reason: "" };
}

// ── Cycle orchestrator ──────────────────────────────────────────────────────
async function sleepWithCountdown(ms) {
  const nextRun = new Date(Date.now() + ms);
  logInfo(`Cycle complete. Sleeping 24h — next run at ${fmtWIB(nextRun)}`);
  let slept = 0;
  while (slept < ms) {
    const chunk = Math.min(3600 * 1000, ms - slept);
    await sleep(chunk);
    slept += chunk;
    const remaining = ms - slept;
    if (remaining > 0) {
      const h = Math.floor(remaining / 3600000);
      const m = Math.floor((remaining % 3600000) / 60000);
      logInfo(`Sleeping… ${h}h ${m}m remaining`);
    }
  }
}

async function sendCycleReport(stats) {
  // Always print the report locally so the user has a copy in the logs.
  console.log();
  console.log(telegram.formatReport(stats));
  console.log();

  if (!telegram.isConfigured()) {
    logInfo("Telegram not configured — report printed to console only.");
    return;
  }
  logInfo("Sending Telegram report…");
  const ok = await telegram.send(stats);
  if (ok) logSuccess("Telegram report sent.");
  else logWarn("Telegram report failed (see warnings above).");
}

async function runCycle(cycle, accounts, useProxy, proxies) {
  const startedAt = fmtWIB();
  const prompts = await fetchRssPrompts(200);
  shuffle(prompts);
  while (prompts.length < config.MAX_CHATS) prompts.push(...config.FALLBACK_PROMPTS);
  logInfo(`Loaded ${prompts.length} prompts for this cycle`);

  let successCount = 0;
  const failures = [];

  for (let i = 0; i < accounts.length; i++) {
    const pk = accounts[i];
    let result;
    try {
      result = await runAccount(pk, i + 1, accounts.length, prompts, useProxy, proxies);
    } catch (e) {
      result = { ok: false, points: 0, reason: `Unhandled exception: ${e.message}` };
      logError(`Account ${i + 1} crashed: ${e.message}`);
    }

    if (result.ok) {
      successCount++;
    } else {
      // Never expose the private key — derive the address, or redact the key.
      const addr = privateKeyToAddress(pk);
      let short;
      if (addr && addr.startsWith("0x") && addr.length >= 8) {
        short = `${addr.slice(0, 6)}...${addr.slice(-4)}`;
      } else {
        const k = pk.trim();
        short = k.length >= 10 ? `${k.slice(0, 4)}...${k.slice(-4)}` : "<invalid-key>";
      }
      failures.push([short, result.reason]);
    }
    await sleep(randFloat(2000, 4000));
  }

  const finishedAt = fmtWIB();
  const stats = {
    cycle,
    cycleStartedAt: startedAt,
    cycleFinishedAt: finishedAt,
    totalAccounts: accounts.length,
    successCount,
    failures,
  };
  logInfo(`Cycle #${cycle}: ${successCount}/${accounts.length} accounts OK, ${failures.length} failed.`);
  return stats;
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  banner();

  const accounts = loadAccounts();
  const proxies = loadProxies();
  let useProxy = await firstRunMenu();
  if (useProxy && !proxies.length) {
    logWarn("Proxy file is empty — falling back to no proxy");
    useProxy = false;
  }

  if (telegram.isConfigured()) {
    logSuccess("Telegram reporting: ENABLED (report at end of each cycle)");
  } else {
    logInfo("Telegram reporting: DISABLED (set TELEGRAM_* in .env to enable)");
  }

  let cycle = 1;
  for (;;) {
    logInfo(`══════ CYCLE #${cycle} ══════`);
    const stats = await runCycle(cycle, accounts, useProxy, proxies);
    await sendCycleReport(stats);
    await sleepWithCountdown(config.CYCLE_SLEEP_MS);
    cycle++;
  }
}

// Graceful Ctrl+C
process.on("SIGINT", () => {
  console.log();
  logWarn("Stopped by user. Bye!");
  process.exit(0);
});

main().catch((e) => {
  logError(`Fatal: ${e.stack || e.message}`);
  process.exit(1);
});
