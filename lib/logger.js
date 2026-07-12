/**
 * Colored, WIB-timestamped logging + startup banner.
 * Uses raw ANSI codes so we don't need a colors dependency.
 */
import { config } from "../config.js";

const C = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
};

/** Current time formatted in the configured timezone (WIB). */
export function nowWIB() {
  return new Date();
}

/** "YYYY-MM-DD HH:MM:SS WIB" in the configured timezone. */
export function fmtWIB(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: config.TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const g = (t) => parts.find((p) => p.type === t)?.value || "00";
  return `${g("year")}-${g("month")}-${g("day")} ${g("hour")}:${g("minute")}:${g("second")} WIB`;
}

/** "[HH:MM:SS]" timestamp in the configured timezone. */
function ts() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: config.TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const g = (t) => parts.find((p) => p.type === t)?.value || "00";
  return `[${g("hour")}:${g("minute")}:${g("second")}]`;
}

function log(level, msg, color) {
  console.log(`${color}${ts()} [${level}] ${msg}${C.reset}`);
}

export const logInfo = (m) => log("INFO", m, C.cyan);
export const logSuccess = (m) => log("SUCCESS", m, C.green);
export const logWarn = (m) => log("WARN", m, C.yellow);
export const logError = (m) => log("ERROR", m, C.red);

/** Plain colored line without the [LEVEL] prefix (menu items, etc.). */
export const logColor = (m, color = "cyan") => console.log(`${C[color] || ""}${m}${C.reset}`);

export function banner() {
  console.log(
    C.magenta +
      C.bright +
      `
╔══════════════════════════════════════════════╗
║               ALLOX  AUTO  BOT               ║
║   Web3 Login · Auto-Chat · Point Farming     ║
╚══════════════════════════════════════════════╝
` +
      C.reset
  );
}
