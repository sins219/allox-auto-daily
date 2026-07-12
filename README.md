# Allox Auto Bot 🤖 (JavaScript / Node.js edition)

> Auto-login with a Web3 wallet signature, auto-chat to an AI endpoint, and
> farm points from [Allox](https://allox.ai) — with an optional Telegram
> report every 24 hours.

![Node](https://img.shields.io/badge/Node.js-18%2B-green?logo=node.js)
![License](https://img.shields.io/badge/License-MIT-green)
![Status](https://img.shields.io/badge/Status-Educational-orange)
![Platform](https://img.shields.io/badge/Platform-Linux%20%7C%20macOS%20%7C%20Windows-lightgrey)

This is a full JavaScript port of the original Python bot. It is a faithful,
feature-complete rewrite — same behavior, same config, plain-English logs, and
**almost zero dependencies** (only `ethers`; everything else uses Node's
built-in `fetch`, `readline`, and `fs`).

---

## ⚡ Quick start (TL;DR)

```bash
git clone https://github.com/sins219/allox-auto-daily.git
cd allox-auto-daily
npm install
cp accounts.txt.example accounts.txt
nano accounts.txt            # paste your private keys, one per line
node bot.js
```

The bot asks about proxy mode on first run, then loops forever. Press
`Ctrl+C` to stop.

**On Windows / no git / multi-user setup?** Jump to
[🚀 Full usage guide](#-full-usage-guide).

---

## ✨ Features

- 🔐 **Web3 signature login** — no password; signs a server nonce with
  `ethers` (EIP-191 personal_sign)
- 💬 **Auto-chat** — up to **20 messages per account per 24h cycle**
- 📰 **Multi-source crypto prompts** — 4 RSS feeds (Cointelegraph, Coindesk,
  Decrypt, Bitcoin.com), shuffled every cycle, wrapped in natural language so
  they read like real user questions
- 🌐 **Proxy support** — HTTP/HTTPS with auth, opt-in per run (via `undici`,
  which ships with Node 18+)
- 📊 **Live point tracking** — colored terminal logs with `Asia/Jakarta`
  (WIB) timestamps
- 🔁 **Auto-cycle** — all accounts done → sleep 24h → repeat
- 📩 **Telegram report** *(optional)* — daily cycle summary sent to your chat

---

## 📁 Project structure

```
allox-auto-js/
├── bot.js                  ← entry point
├── config.js               ← endpoints, feeds, prompts, timing
├── telegram.js             ← Telegram reporter (optional)
├── lib/
│   ├── http.js             ← fetch + retries + proxy
│   ├── wallet.js           ← key → address, message signing
│   ├── api.js              ← nonce / login / chat
│   ├── rss.js              ← multi-feed prompt sourcing
│   ├── logger.js           ← colored WIB logging + banner
│   └── utils.js            ← .env loader, env parsers, helpers
├── install.sh              ← optional install helper
├── package.json
├── .env.example            ← copy to .env
├── accounts.txt.example    ← copy to accounts.txt
├── proxy.txt.example       ← copy to proxy.txt
├── .gitignore
└── README.md
```

> ⚠️ **NEVER commit** `accounts.txt`, `proxy.txt`, `.env`, or any `*.session`
> file. They are all excluded by `.gitignore`.

---

## 🚀 Full usage guide

### 1. Requirements

- **Node.js 18 or newer** (built-in `fetch` and `undici` are required)
  - Check: `node --version`
  - Download from [nodejs.org](https://nodejs.org/) if missing
- **Git** (or download the repo as a ZIP from GitHub → Code → Download ZIP)
- A list of **Ethereum private keys** (one per wallet you want to farm)

### 2. Get the code

**With git (recommended):**

```bash
git clone https://github.com/YOUR_USERNAME/allox-auto-js.git
cd allox-auto-js
```

**Or download the ZIP:**

1. Open the repo page on GitHub
2. Click the green **Code** button → **Download ZIP**
3. Extract it anywhere
4. Open a terminal/cmd in that folder

### 3. Install dependencies

```bash
npm install
```

Or use the helper script (Linux/macOS):

```bash
bash install.sh
```

### 4. Configure accounts

```bash
cp accounts.txt.example accounts.txt
nano accounts.txt
```

One private key per line:

```
# Format: 0x + 64 hex chars (the 0x prefix is optional)
0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789ab
```

> ⚠️ **IMPORTANT**: Never share `accounts.txt`. A private key = full control
> of that wallet.

### 5. (Optional) Configure proxies

```bash
cp proxy.txt.example proxy.txt
nano proxy.txt
```

One proxy per line:

```
http://user:password@127.0.0.1:8080
https://1.2.3.4:443
http://10.0.0.1:3128            # no-auth proxies are fine too
```

### 6. Run the bot

```bash
node bot.js
```

On the first run you pick a proxy mode:

```
[19:00:00] [INFO] Select run mode:
  1. Run with proxy
  2. Run without proxy
Choice [1/2]: _
```

Type `1` or `2` and press Enter. Your choice is saved to
`.allox_state.json`, so you won't be asked again.

Normal output looks like:

```
[19:42:08] [SUCCESS] Loaded 2 account(s) from accounts.txt
[19:42:08] [SUCCESS] RSS: 30 titles from https://cointelegraph.com/rss
[19:42:08] [INFO] ── Account 1/2 ──
[19:42:08] [INFO] Wallet: 0xFCAd0B19bB29D4674531d6f115237E16AfCE377c
[19:42:10] [SUCCESS] Logged in: 0xFCAd...377c
[19:42:13] [SUCCESS] Chat 1/20 Sent | +10 Pts | Total: 10 | Limit: 19
...
[20:00:00] [INFO] Cycle #1: 2/2 accounts OK, 0 failed.
[20:00:00] [INFO] Cycle complete. Sleeping 24h — next run at 2026-07-13 20:00:00 WIB
```

Press `Ctrl+C` anytime to stop.

### 7. Re-run / auto-restart

The bot runs forever (24h cycles). Options:

- **Run manually**: `node bot.js`
- **Run in background (Linux)**: `nohup node bot.js > bot.log 2>&1 &`
- **Auto-start on reboot**: use `systemd` or `pm2` (see [Deployment](#-deployment))

---

## 📩 Telegram reports (optional)

Reporting is **off by default**. To enable it:

1. Open Telegram, chat [@BotFather](https://t.me/BotFather), send `/newbot`
2. Follow the steps, copy the **token** it gives you
3. Open a chat with your new bot and send `/start` (**required!**)
4. Get your **chat_id** from [@userinfobot](https://t.me/userinfobot)
5. Create `.env`:

   ```bash
   cp .env.example .env
   nano .env
   ```

   Fill in:

   ```env
   TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
   TELEGRAM_CHAT_ID=123456789
   ```

6. Restart the bot: `node bot.js`

Test your Telegram config without running a full cycle:

```bash
node telegram.js
```

### Report format

Every 24 hours you get a message like:

```
📊 Allox Auto Bot — Cycle #1 Report
🕐 2026-07-12 19:00:00 WIB → 2026-07-12 19:42:00 WIB

───────────────────────────────────────────
| Accounts OK    | 1                         |
| Accounts failed| 2                         |
───────────────────────────────────────────

⚠️ Failure Details
  • 0xFCAd...377c — Invalid private key length: 8 hex chars (expected 64)
  • 0x9B12...aa91 — Failed to fetch nonce (network / proxy / API error)

🛠 Common Fixes
  • Invalid private key length: ... → Check the key format in accounts.txt ...
  • Failed to fetch nonce ... → Check internet / proxy, or try again later.
```

> **Multi-user tip**: If you run the bot for several people, each person
> should create their **own** Telegram bot + `.env`. One bot token = one
> report channel. Don't share a single token across users, or all reports
> merge into one chat.

---

## ⚙️ Configuration reference

Everything is read from environment variables (or `.env`).

| Variable               | Default                     | Description                          |
|------------------------|-----------------------------|--------------------------------------|
| `ALLOX_API_BASE`       | `https://api.allox.ai/v1`   | API root (override for testnet)      |
| `RSS_FEEDS`            | *(see below)*               | RSS feed list, comma-separated       |
| `PROMPT_TEMPLATES`     | *(see below)*               | Prompt templates, `\|`-separated     |
| `TELEGRAM_BOT_TOKEN`   | *(empty)*                   | Bot API token                        |
| `TELEGRAM_CHAT_ID`     | *(empty)*                   | Target chat / user / channel         |
| `TELEGRAM_PARSE_MODE`  | `HTML`                      | `HTML`, `Markdown`, or empty         |

> ⚠️ The default `ALLOX_API_BASE` is a placeholder. Set the real Allox API
> root via `.env` (`ALLOX_API_BASE=...`) or adjust `config.js`. If the
> endpoint paths differ (nonce / verify / chat), edit `config.js` accordingly.

### RSS feeds

Defaults:

```
https://cointelegraph.com/rss
https://www.coindesk.com/arc/outboundfeeds/rss/
https://decrypt.co/feed
https://news.bitcoin.com/feed/
```

Each cycle, feeds are tried in **random order** — if one is down or
rate-limited, the next takes over. Duplicate titles across feeds are deduped.

To use your own feeds, set `RSS_FEEDS` in `.env`:

```env
RSS_FEEDS=https://cointelegraph.com/rss,https://decrypt.co/feed,https://my-feed.example.com/rss
```

### Prompt templates

Raw headlines are wrapped in a random natural-language template so they read
like user questions instead of copy-pasted news. Defaults:

```
Can you explain this crypto news: {title}?
What are your thoughts on this event: {title}?
Summarize the impact of this headline: {title}
Is this bullish or bearish for the market: {title}?
Provide a brief analysis on this news: {title}
```

To customize, set `PROMPT_TEMPLATES` in `.env` (use `|` as the separator,
`{title}` as the placeholder):

```env
PROMPT_TEMPLATES=Explain this headline: {title}|Your take on: {title}?|Summarize: {title}
```

---

## 🛠 Deployment

### Option 1 — `screen` / `tmux` (easiest)

```bash
apt install -y screen        # Ubuntu/Debian
brew install screen          # macOS

screen -S allox
cd ~/allox-auto-js
node bot.js
# Detach: Ctrl+A then D  |  List: screen -ls  |  Reattach: screen -r allox
```

### Option 2 — `nohup` (background, log to file)

```bash
cd ~/allox-auto-js
nohup node bot.js > bot.log 2>&1 &
tail -f bot.log              # view logs
pkill -f "node bot.js"      # stop
```

### Option 3 — `pm2` (production, auto-restart on reboot)

```bash
npm install -g pm2
cd ~/allox-auto-js
pm2 start bot.js --name allox-bot
pm2 logs allox-bot          # view logs
pm2 save && pm2 startup     # auto-start on reboot (follow the printed command)
```

### Option 4 — `systemd`

Create `/etc/systemd/system/allox-bot.service`:

```ini
[Unit]
Description=Allox Auto Bot (JS)
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/allox-auto-js
ExecStart=/usr/bin/node /root/allox-auto-js/bot.js
Restart=always
RestartSec=10
StandardOutput=append:/var/log/allox-bot.log
StandardError=append:/var/log/allox-bot.log

[Install]
WantedBy=multi-user.target
```

Enable it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable allox-bot
sudo systemctl start allox-bot
sudo systemctl status allox-bot
sudo journalctl -u allox-bot -f
```

> Adjust `User`, `WorkingDirectory`, and the `node` path (`which node`) to
> match your setup.

---

## 🛠 Troubleshooting

| Problem                                   | Fix                                                                    |
|-------------------------------------------|-----------------------------------------------------------------------|
| `No nonce in response`                    | API schema changed. Edit `requestNonce()` in `lib/api.js`.            |
| `No token in response`                    | API schema changed. Edit `login()` in `lib/api.js`.                   |
| `Non-JSON nonce response: <!DOCTYPE html>`| Wrong `ALLOX_API_BASE`. Set the real API root in `.env`.             |
| `Proxy error` / `SSL error`               | Proxy is dead. Swap it in `proxy.txt` or run without a proxy.         |
| `Request failed after 3 attempts`         | Network/timeout. Check internet, try another proxy.                   |
| `Invalid key length`                      | Key in `accounts.txt` is wrong. Must be 64 hex chars (0x optional).  |
| `Signing failed`                          | `npm install ethers@latest`                                          |
| `Proxy requested but 'undici' is unavailable` | You're on Node < 18, or undici is missing. Upgrade Node, or `npm install undici`. |
| `All RSS feeds failed`                    | All feeds down. Bot falls back to static prompts and keeps running.   |
| Telegram: report not arriving             | Check `.env`. Make sure you sent `/start` to your bot.               |
| Telegram: `HTTP 400 parse error`          | Set `TELEGRAM_PARSE_MODE=` (empty) to fall back to plain text.        |
| Bot runs but earns 0 points               | Likely server rate-limit. Wait for the next 24h cycle, or check keys. |

---

## 🔒 Security

- **Private keys are extremely sensitive.** Anyone with your key controls the
  wallet. Never share `accounts.txt`, never commit it, never upload it.
- `.gitignore` already excludes `accounts.txt`, `proxy.txt`, `.env`, and
  `*.session`. Still double-check with `git status` before every commit —
  those files must never appear.
- Run only on machines you trust. Don't paste keys on shared/cloud VMs you
  don't control.
- **If you distribute this bot to others**: each person makes their own
  `accounts.txt` and `.env`; never share private-key files; one Telegram bot
  per person.
- This project is **educational**. Use at your own risk and respect the
  target platform's Terms of Service.

---

## 📜 License

MIT — see [LICENSE](LICENSE).
