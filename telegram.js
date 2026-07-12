/**
 * Allox Auto Bot — Telegram Reporter (optional)
 * =============================================
 * Sends a daily cycle report to a Telegram chat. Active only when
 * TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are set; otherwise send() is a no-op.
 *
 * Only the Bot API backend is supported (simple, no flood-wait risk). The bot
 * must be added to the target chat and have received /start.
 *
 * Run `node telegram.js` directly to preview + test a sample report.
 */
import { loadDotenv } from "./lib/utils.js";

loadDotenv();

const REASON_HINTS = {
  "invalid private key length":
    "Check the key format in accounts.txt — must be 64 hex chars (0x prefix optional).",
  "private key contains non-hex": "Remove non-hex characters from the private key.",
  "invalid private key":
    "Key rejected by ethers. Regenerate the wallet and replace the key in accounts.txt.",
  "non-json nonce response":
    "Server returned an HTML/error page. Check your connection/proxy, or wait a few minutes.",
  "no nonce in response":
    "API schema changed. Update the endpoint or field in lib/api.js (requestNonce).",
  "failed to fetch nonce":
    "Check internet / proxy. The Allox server may also be down — try again later.",
  "non-json login response": "Login API returned non-JSON. Check proxy / API endpoint.",
  "no token in response":
    "API schema changed. Update login() to parse the correct token field.",
  "failed to login":
    "Login rejected by server. Check the signature format or the login message text in lib/wallet.js.",
  "failed to sign login":
    "ethers failed to sign. Make sure the library is up to date: npm install ethers@latest.",
  "proxy error": "Proxy dead/blocked. Swap it in proxy.txt or run without a proxy.",
  "ssl error": "HTTPS proxy issue. Try another proxy or disable proxies.",
  "request failed": "Persistent connection/timeout. Check internet, proxy, or Allox server status.",
  "unhandled exception": "Unexpected bug. See the full console log and file a GitHub issue.",
};

function pad(s, n) {
  return s + " ".repeat(Math.max(n - s.length, 0));
}

function uniqueReasons(failures) {
  const seenKeys = [];
  const out = [];
  for (const [, reason] of failures) {
    const key = (reason || "").split(":")[0].trim().toLowerCase().slice(0, 40);
    if (key && !seenKeys.includes(key)) {
      seenKeys.push(key);
      out.push(reason);
    }
  }
  return out;
}

function reasonSolution(reason) {
  if (!reason) return "Check the full console log.";
  const low = reason.toLowerCase();
  for (const [key, hint] of Object.entries(REASON_HINTS)) {
    if (low.includes(key)) return `<i>${reason.slice(0, 60)}</i> → ${hint}`;
  }
  return `<i>${reason.slice(0, 60)}</i> → Check the console log for full details.`;
}

/**
 * Build the report text.
 * stats = { cycle, cycleStartedAt, cycleFinishedAt, totalAccounts,
 *           successCount, failures: [ [walletShort, reason], ... ] }
 */
export function formatReport(stats) {
  const cycle = stats.cycle ?? "?";
  const started = stats.cycleStartedAt ?? "?";
  const ended = stats.cycleFinishedAt ?? "?";
  const total = stats.totalAccounts ?? 0;
  const success = stats.successCount ?? 0;
  const fail = Math.max(total - success, 0);

  const lines = [];
  lines.push(`📊 <b>Allox Auto Bot — Cycle #${cycle} Report</b>`);
  lines.push(`🕐 ${started} → ${ended}`);
  lines.push("");
  lines.push("<pre>");
  lines.push("─".repeat(43));
  lines.push("| Accounts OK    | " + pad(String(success), 25) + " |");
  lines.push("| Accounts failed| " + pad(String(fail), 25) + " |");
  lines.push("─".repeat(43));
  lines.push("</pre>");

  const failures = stats.failures || [];
  if (failures.length) {
    lines.push("");
    lines.push("⚠️ <b>Failure Details</b>");
    for (const [wallet, reason] of failures) {
      lines.push(`  • <code>${wallet}</code> — ${(reason || "unknown").slice(0, 80)}`);
    }
    lines.push("");
    lines.push("🛠 <b>Common Fixes</b>");
    for (const r of uniqueReasons(failures)) {
      lines.push(`  • ${reasonSolution(r)}`);
    }
  } else {
    lines.push("");
    lines.push("✅ All accounts succeeded this cycle.");
  }
  return lines.join("\n");
}

function chunkText(text, size = 4000) {
  const out = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out.length ? out : [text];
}

async function sendBotApi(text, botToken, chatId) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const parseMode = (process.env.TELEGRAM_PARSE_MODE || "HTML").trim();
  for (const chunk of chunkText(text)) {
    let sent = false;
    for (let attempt = 1; attempt <= 3 && !sent; attempt++) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: chunk,
            parse_mode: parseMode || undefined,
            disable_web_page_preview: true,
          }),
        });
        if (res.status === 200) {
          sent = true;
          break;
        }
        if (res.status === 429) {
          const body = await res.json().catch(() => ({}));
          const wait = (body?.parameters?.retry_after || 5) * 1000;
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        // 400 with parse error → retry once as plain text
        if (res.status === 400 && parseMode) {
          const res2 = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: chunk,
              disable_web_page_preview: true,
            }),
          });
          if (res2.status === 200) {
            sent = true;
            break;
          }
        }
        const t = await res.text();
        console.log(`[TG] HTTP ${res.status}: ${t.slice(0, 120)}`);
        return false;
      } catch (e) {
        console.log(`[TG] send error: ${e.message}`);
        if (attempt < 3) await new Promise((r) => setTimeout(r, 2 ** attempt * 1000));
        else return false;
      }
    }
    if (!sent) return false;
  }
  return true;
}

/** Send the report. Returns true on success, false on failure/skip. */
export async function send(stats) {
  const chatId = (process.env.TELEGRAM_CHAT_ID || "").trim();
  const botToken = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
  if (!chatId || !botToken) return false;
  return sendBotApi(formatReport(stats), botToken, chatId);
}

/** True when Telegram reporting is configured. */
export function isConfigured() {
  return Boolean(
    (process.env.TELEGRAM_CHAT_ID || "").trim() &&
      (process.env.TELEGRAM_BOT_TOKEN || "").trim()
  );
}

// ── Manual CLI test: `node telegram.js` ────────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}`) {
  const sample = {
    cycle: 1,
    cycleStartedAt: "2026-07-12 19:00:00 WIB",
    cycleFinishedAt: "2026-07-12 19:42:00 WIB",
    totalAccounts: 3,
    successCount: 1,
    failures: [
      ["0xFCAd...377c", "Invalid private key length: 8 hex chars (expected 64)"],
      ["0x9B12...aa91", "No nonce in response: {'error': 'rate_limited'}"],
    ],
  };
  console.log(formatReport(sample));
  console.log("\n--- sending ---");
  send(sample).then((ok) => console.log("send ok:", ok));
}
