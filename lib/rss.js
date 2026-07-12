/**
 * RSS / Atom prompt sourcing.
 *
 * Pulls headlines from multiple feeds (random order each cycle), dedups them,
 * and wraps each in a natural-language template so the outgoing chat looks like
 * a real user question. No XML library needed — a small regex parser handles
 * both RSS 2.0 <item><title> and Atom <entry><title>.
 */
import { config } from "../config.js";
import { logSuccess, logWarn } from "./logger.js";
import { choice, shuffle } from "./utils.js";

/** Decode the handful of XML/HTML entities that show up in feed titles. */
function decodeEntities(s) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .trim();
}

/** Extract <title> values from raw RSS/Atom XML. Skips the channel/feed title. */
function parseTitles(xml) {
  const titles = [];
  const re = /<title\b[^>]*>([\s\S]*?)<\/title>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const t = decodeEntities(m[1]);
    if (t) titles.push(t);
  }
  // The first <title> is usually the feed/channel name — drop it.
  return titles.slice(1);
}

/** Fetch and parse ONE feed. Returns raw titles, or [] on any failure. */
async function parseSingleFeed(url) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, {
      headers: { "User-Agent": config.USER_AGENT },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      logWarn(`RSS fetch failed for ${url}: HTTP ${res.status}`);
      return [];
    }
    const xml = await res.text();
    return parseTitles(xml);
  } catch (e) {
    logWarn(`RSS fetch failed for ${url}: ${e.name || e.message}`);
    return [];
  }
}

/** Wrap a raw headline in a random natural-language template. */
function wrapAsPrompt(title) {
  const template = choice(config.PROMPT_TEMPLATES);
  let t = title;
  if (t.length > 200) t = t.slice(0, 197) + "...";
  t = t.replace(/[.?!\s\t]+$/, ""); // strip trailing punctuation/space
  return template.replace("{title}", t);
}

/**
 * Pull up to `limit` prompts from all feeds (random order, deduped).
 * Falls back to static prompts if every feed fails.
 */
export async function fetchRssPrompts(limit = 100) {
  const feeds = shuffle([...config.RSS_FEEDS]);
  const seen = new Set();
  const prompts = [];
  let successfulFeeds = 0;

  for (const feedUrl of feeds) {
    if (prompts.length >= limit) break;
    const titles = await parseSingleFeed(feedUrl);
    if (titles.length) {
      successfulFeeds++;
      logSuccess(`RSS: ${titles.length} titles from ${feedUrl}`);
    }
    for (const t of titles) {
      if (prompts.length >= limit) break;
      const key = t.toLowerCase().trim();
      if (seen.has(key)) continue;
      seen.add(key);
      prompts.push(wrapAsPrompt(t));
    }
  }

  if (successfulFeeds === 0) {
    logWarn("All RSS feeds failed — using fallback crypto prompts");
    return config.FALLBACK_PROMPTS.map(wrapAsPrompt);
  }
  if (prompts.length < limit) {
    logWarn(`Only got ${prompts.length} prompts from RSS, padding with fallback`);
    for (const t of config.FALLBACK_PROMPTS) {
      if (prompts.length >= limit) break;
      prompts.push(wrapAsPrompt(t));
    }
  }
  return prompts;
}
