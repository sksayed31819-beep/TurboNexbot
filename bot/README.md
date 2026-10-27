# TurboNex Telegram Community Moderation Bot (Legacy Python Reference)

> ⚠️ **Cloudflare Workers Migration Notice**:
> Cloudflare Workers cannot run Python long-polling processes. The production bot has been rewritten as a native TypeScript Cloudflare Worker located in `src/worker/` using webhook architecture and Cloudflare D1.
> For the Cloudflare Workers Free deployment guide, please see the root `/README.md` and `wrangler.toml`.
> This `bot/` folder is preserved as a standalone Python reference for VPS or Render background workers.

---

## 🚀 Key Features

1. **Automated URL & Phishing Link Deletion**:
   - Detects standard URLs (`http://`, `https://`, `ftp://`).
   - Detects bare domain mentions (`domain.xyz/claim`, `turbonex-airdrop.top`).
   - Detects Telegram invite links (`t.me/+...`, `telegram.me/joinchat/...`).
   - Detects obfuscated dot domains (`turbonex [dot] xyz`, `claim (dot) com`, `bonus dot io`).
   - Regular members have messages deleted instantly; authorized admins bypass filters.

2. **Phone Number Shield**:
   - Detects international numbers with country codes (`+1`, `+44`, `+91`, `+971`, etc.).
   - Detects formatted national numbers `(555) 123-4567` and `555-123-4567`.
   - Detects spaced scam phone numbers (`9 8 7 6 5 4 3 2 1 0`).
   - Differentiates phone numbers from timestamps, release years (e.g. `2026-10-27`), order numbers, and currency prices.

3. **Anti-Spam & Burst Limiter**:
   - Sliding window rate limiting (blocks burst flooding like > 5 messages in 8 seconds).
   - Duplicate message detection (deletes repeated copies within 30 seconds).
   - Configurable penalty: `delete_only`, `delete_and_warn` (ephemeral 8s warning), or temporary `mute_15m` / `mute_1h`.

4. **Dynamic Welcome Message**:
   - Greets newly joined members automatically.
   - Customizable template with `{mention}`, `{username}`, `{group_name}`, `{rules_link}`.

5. **Channel Post Scheduler**:
   - Queue announcement posts to your linked channel with markdown formatting.
   - Background worker checks and automatically dispatches posts at the scheduled time.

6. **Enterprise Security & Zero Leaks**:
   - Token loaded strictly from environment secrets.
   - Secrets are masked (`7182***2345`) in logs and UI.
   - User phone numbers are masked (`+1 (555) ***-**78`) in moderation audit logs.

---

## 🛠️ Step 1: Telegram Bot Creation & Permissions

1. Open Telegram and search for [@BotFather](https://t.me/BotFather).
2. Send `/newbot`, choose a display name (e.g., `TurboNex Moderation Bot`) and a username ending in `bot` (e.g., `TurboNexModBot`).
3. BotFather will provide your **HTTP API Token** (e.g., `7182938472:AAElskdfj-XYZ12345`). Save this securely.
4. **Group Setup**:
   - Add your bot to the **TurboNex Community Group**.
   - Promote the bot to **Administrator**.
   - Enable the following admin privileges:
     - ✅ **Delete Messages** (Required for moderation)
     - ✅ **Ban / Restrict Users** (Required for anti-spam mute)
     - ✅ **Invite Users via Link**
5. **Channel Setup (For Scheduled Posts)**:
   - Add your bot as an **Administrator** in your linked channel (e.g., `@turbonex_official`).
   - Enable **Post Messages** privilege.
6. **Obtain Your Admin Telegram ID**:
   - Message [@userinfobot](https://t.me/userinfobot) or [@RawDataBot](https://t.me/RawDataBot) to get your numeric ID (e.g., `987654321`).

---

## 🌐 Step 2: Free Hosting Deployment (Render.com)

Render offers a free tier that is ideal for hosting background worker bots.

### Method A: Deploy via GitHub + Render (Recommended)
1. Push this `bot/` folder (or repository) to your GitHub account (make repository Private for privacy).
2. Go to [Render.com](https://render.com) and create a free account.
3. In the Render Dashboard, click **New +** -> **Background Worker** (or **Web Service**).
4. Connect your GitHub repository.
5. Configure the service:
   - **Name**: `turbonex-moderation-bot`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r bot/requirements.txt`
   - **Start Command**: `python -u bot/bot.py`
   - **Plan**: `Free`
6. Click **Advanced** -> **Add Environment Variable**:
   - `TELEGRAM_BOT_TOKEN`: Paste your token from BotFather.
   - `ADMIN_IDS`: Your Telegram numeric ID (e.g. `987654321`).
   - `CHANNEL_ID`: Your channel handle (e.g. `@turbonex_official`).
   - `DELETE_URLS`: `true`
   - `DELETE_PHONE_NUMBERS`: `true`
   - `ANTI_SPAM_ENABLED`: `true`
7. Click **Create Background Worker**.
8. Render will build and deploy the bot. View the live logs to confirm:
   `TurboNex Telegram Bot started successfully in polling mode.`

---

## 💻 Alternative Free Hosting: Koyeb / Railway / Fly.io

### Koyeb (Free Tier)
1. Sign up at [Koyeb.com](https://www.koyeb.com/).
2. Create App -> GitHub.
3. Select Dockerfile or Python buildpack.
4. Enter `TELEGRAM_BOT_TOKEN` and `ADMIN_IDS` in the **Environment variables** section.
5. Deploy.

### Linux VPS / Self-Hosted (systemd)
Create `/etc/systemd/system/turbonex-bot.service`:
```ini
[Unit]
Description=TurboNex Telegram Moderation Bot
After=network.target

[Service]
Type=simple
User=turbonex
WorkingDirectory=/home/turbonex/bot
EnvironmentFile=/home/turbonex/bot/.env
ExecStart=/usr/bin/python3 -u bot/bot.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```
Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now turbonex-bot
sudo journalctl -u turbonex-bot -f
```

---

## 🧪 Step 3: Running Tests

The codebase includes automated unit tests covering all edge cases.

To run the unit test suite locally:
```bash
python3 -m unittest bot/test_moderation.py
```

Expected output:
```
....................
Ran 20 tests in 0.003s

OK
```

All 20 tests verify:
- Detection of standard URLs, bare domains, and obfuscated domains.
- Detection of international, formatted, and spaced phone numbers.
- Prevention of false positives on dates, release tags, order IDs, and prices.
- Spam burst limiting and duplicate detection.
- Secret masking and phone redaction in logs.
- Admin command authorization and link bypass.
