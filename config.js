/**
 * Configuration — edit API endpoints here if the platform differs.
 * Every value can be overridden via environment variables (or a .env file).
 */
import { csvEnv, pipeEnv } from "./lib/utils.js";

const API_BASE = (process.env.ALLOX_API_BASE || "https://api.allox.ai/v1").replace(/\/+$/, "");

export const config = {
  API_BASE,
  NONCE_URL: `${API_BASE}/auth/nonce`,
  LOGIN_URL: `${API_BASE}/auth/verify`,
  CHAT_URL: `${API_BASE}/chat`,

  // Multiple RSS sources — tried in random order each cycle. If one feed is
  // down, slow, or rate-limited, we move on to the next.
  RSS_FEEDS: csvEnv("RSS_FEEDS", [
    "https://cointelegraph.com/rss",
    "https://www.coindesk.com/arc/outboundfeeds/rss/",
    "https://decrypt.co/feed",
    "https://news.bitcoin.com/feed/",
  ]),

  // Raw headlines get wrapped in one of these natural-language templates so
  // the prompt looks like a user query, not a raw newswire dump.
  PROMPT_TEMPLATES: pipeEnv("PROMPT_TEMPLATES", [
    "Can you explain this crypto news: {title}?",
    "What are your thoughts on this event: {title}?",
    "Summarize the impact of this headline: {title}",
    "Is this bullish or bearish for the market: {title}?",
    "Provide a brief analysis on this news: {title}",
  ]),

  MAX_CHATS: 20,
  CYCLE_SLEEP_MS: 24 * 60 * 60 * 1000, // 24 hours
  TIMEZONE: "Asia/Jakarta", // WIB

  USER_AGENT:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",

  ACCOUNTS_FILE: "accounts.txt",
  PROXY_FILE: "proxy.txt",
  STATE_FILE: ".allox_state.json",

  // Static prompts used when every RSS feed fails, or to pad a short cycle.
  FALLBACK_PROMPTS: [
    "What's driving today's crypto market?",
    "Explain Bitcoin halving in simple terms.",
    "How does Ethereum staking work?",
    "Compare Layer 1 vs Layer 2 scalability.",
    "What are the main risks in DeFi?",
    "How do zero-knowledge proofs improve privacy?",
    "What is tokenomics and why does it matter?",
    "Explain how cross-chain bridges work.",
    "What role do oracles play in DeFi?",
    "How do I evaluate a new crypto project?",
    "What is MEV and how does it affect traders?",
    "Explain the difference between custodial and non-custodial wallets.",
    "How do stablecoins maintain their peg?",
    "What are the security risks of cross-chain bridges?",
    "What is on-chain analytics used for?",
  ],
};
