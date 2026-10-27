# TurboNex Telegram Community Moderation Bot

A production-grade, secure, serverless Telegram moderation bot and channel post scheduler designed to run on the **Cloudflare Workers Free Plan** using webhooks, Cloudflare D1 (serverless SQLite), and Cloudflare Cron Triggers.

---

## ⚡ Why Cloudflare Workers & Webhooks (vs. Python Long-Polling)?

The original Python bot used long polling (`run_polling()`), which requires an always-running server process or VM (e.g. VPS or Render background worker).

Cloudflare Workers is a serverless, event-driven edge execution environment:
- **No Idle Server Costs**: Workers only execute when an incoming HTTP request arrives or when a Cron Trigger fires.
- **Webhook Architecture**: Telegram delivers updates directly via HTTPS POST requests to your worker's `/webhook` endpoint with sub-5ms latency worldwide.
- **Cloudflare D1 Storage**: Serverless SQLite at the edge stores dynamic moderation settings, anti-spam sliding-window logs, and scheduled posts.
- **100% Free Plan Compatible**: Easily fits within Cloudflare's free limits (100,000 requests/day, 5,000,000 D1 reads/day, and Cron Triggers).

---

## 🛡️ Core Features & Production Security

1. **Automated Link & Phishing Protection (Text + Captions)**:
   - Inspects both `message.text` and `message.caption` (media attachments).
   - Deletes standard URLs (`http://`, `https://`).
   - Deletes bare domain mentions (`turbonex-airdrop.xyz/claim`).
   - Deletes Telegram invite links (`t.me/+...`, `telegram.me/joinchat/...`).
   - Deletes obfuscated domains (`turbonex [dot] com`, `scam (dot) xyz`, `bonus dot io`).
   - Moderates both new and edited messages.
   - Authorized admins and official channels automatically bypass filters.

2. **Phone Number Shield (Text + Captions)**:
   - Detects international numbers with country codes (`+1`, `+44`, `+91`, `+971`, etc.).
   - Detects formatted national numbers `(555) 123-4567` and `555-123-4567`.
   - Detects spaced numbers often used by scammers (`9 8 7 6 5 4 3 2 1 0`).
   - Ignores benign numbers like dates (`2026-10-27`), order numbers (`#1234`), and currency prices (`$49.99`).

3. **Persistent Anti-Spam & Burst Limiting**:
   - Rate limiting backed by Cloudflare D1 to block rapid message flooding (e.g. > 5 messages in 8 seconds).
   - Duplicate message detector (identifies and deletes repeated messages within 30 seconds).
   - Configurable action: silent deletion, warning message, or temporary 15m/1h member mute.

4. **Dynamic Welcome Greeting**:
   - Greets newly joined members automatically.
   - Customizable template supporting `{mention}`, `{username}`, `{group_name}`, `{rules_link}`.

5. **Channel Post Scheduler (D1 + Cron Triggers with Atomic Concurrency Lock)**:
   - Queue announcement posts to your linked Telegram channel.
   - Stored in Cloudflare D1 and dispatched automatically by Cloudflare Workers Cron Triggers (`* * * * *`).
   - **Atomic Concurrency Lease**: Uses atomic SQL status transitions (`'pending'` &rarr; `'publishing'`) so overlapping Cron executions or concurrent admin publishes cannot duplicate broadcasts.

6. **Zero Hardcoded Admin IDs & Separated Auth Credentials**:
   - `DEFAULT_CONFIG.adminIds` is empty. Only explicitly configured numeric IDs in `ADMIN_IDS` grant administrator privileges.
   - **Strict Admin API Authentication**: Every administrative REST endpoint (`/api/settings`, `/api/scheduled-posts`, `/api/webhook/*`, `/api/moderation-logs`) strictly requires a valid `ADMIN_API_KEY`.
   - `TELEGRAM_SECRET_TOKEN` is NEVER accepted as an administrative credential. It is used exclusively to validate inbound Telegram webhooks via the `X-Telegram-Bot-Api-Secret-Token` header.
   - Bot token, admin keys, and phone numbers are redacted in all logs and user interfaces.

---

## 📋 Step-by-Step Deployment Guide (Cloudflare Workers Free)

### Step 1: Telegram Bot Creation & Privacy Configuration

1. Open Telegram and search for [@BotFather](https://t.me/BotFather).
2. Send `/newbot`, enter a display name (e.g. `TurboNex Moderation Bot`) and a username ending in `bot` (e.g. `TurboNexModBot`).
3. Copy your **HTTP API Token** (e.g. `7182938472:AAElskdfj-XYZ12345`). Save this securely.
4. **CRITICAL STEP - Disable Privacy Mode**:
   - In @BotFather, send `/setprivacy`.
   - Select your bot.
   - Choose **Disable**.
   - *Why?* By default, Telegram hides regular member messages from bots. Disabling privacy mode allows the bot to inspect and delete prohibited links, phone numbers, and spam!
5. **Group & Channel Admin Promotion**:
   - Add your bot to your **Community Group**. Promote it to **Admin** with:
     - ✅ **Delete messages**
     - ✅ **Ban / Restrict users**
   - Add your bot to your **Linked Channel**. Promote it to **Admin** with:
     - ✅ **Post messages**
6. **Obtain Telegram IDs**:
   - Message [@userinfobot](https://t.me/userinfobot) to get your numeric Admin ID (e.g. `987654321`).
   - Forward a message from your group/channel to [@userinfobot] or [@RawDataBot] to get the group/channel ID (e.g. `-1001234567890` or `@turbonex_official`).

---

### Step 2: Cloudflare Workers & D1 Database Setup

1. **Clone the repository and install dependencies**:
   ```bash
   git clone <your-repo-url>
   cd turbonex-telegram-moderation-bot
   npm install
   ```

2. **Authenticate Wrangler with Cloudflare**:
   ```bash
   npx wrangler login
   ```

3. **Create the Cloudflare D1 Database**:
   ```bash
   npx wrangler d1 create turbonex-db
   ```
   Wrangler will output:
   ```toml
   [[d1_databases]]
   binding = "DB"
   database_name = "turbonex-db"
   database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
   ```

4. **Update `wrangler.toml`**:
   Open `wrangler.toml` and replace `REPLACE_WITH_YOUR_D1_DATABASE_ID` with your actual `database_id`:
   ```toml
   [[d1_databases]]
   binding = "DB"
   database_name = "turbonex-db"
   database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
   ```

5. **Run the Database Migrations**:
   Execute the migration SQL file on your remote D1 database:
   ```bash
   npx wrangler d1 execute turbonex-db --remote --file=migrations/0001_init.sql
   ```

---

### Step 3: Configure Cloudflare Encrypted Secrets

Never commit secrets to git! Configure them securely in Cloudflare using Wrangler:

```bash
# 1. Telegram Bot Token from BotFather
npx wrangler secret put TELEGRAM_BOT_TOKEN

# 2. Secret Token for Webhook Validation (generate a random 32-character string, e.g. using openssl rand -hex 16)
npx wrangler secret put TELEGRAM_SECRET_TOKEN

# 3. Dedicated Admin API Key for securing the dashboard & REST endpoints
npx wrangler secret put ADMIN_API_KEY

# 4. Comma-separated Telegram User IDs for authorized administrators
npx wrangler secret put ADMIN_IDS

# 5. Target Linked Channel ID (e.g. @turbonex_official or -1001987654321)
npx wrangler secret put LINKED_CHANNEL_ID

# 6. Optional: Target Group ID (e.g. -1001234567890)
npx wrangler secret put COMMUNITY_GROUP_ID
```

---

### Step 4: Build SPA & Deploy the Cloudflare Worker

`wrangler.toml` includes Cloudflare Workers Static Assets binding (`[assets]`), allowing your Worker to serve both the React SPA dashboard and the API endpoints from the exact same URL:

```bash
# Step A: Compile the React dashboard into ./dist
npm run build

# Step B: Deploy Worker + Static Assets to Cloudflare
npx wrangler deploy
```

Wrangler will output your live URL:
`https://turbonex-moderation-bot.<your-subdomain>.workers.dev`

---

### Step 5: Register the Telegram Webhook Securely

Tell Telegram to deliver updates to your Cloudflare Worker URL, including your secret token:

#### Option A: Using the React Dashboard (Easiest)
1. Open your live Worker URL (or run locally via `npm run dev`).
2. Go to **Admin Settings** and enter your `ADMIN_API_KEY` to authenticate.
3. Open the **Webhook Gateway** tab.
4. Confirm your Worker URL (`https://turbonex-moderation-bot.<your-subdomain>.workers.dev/webhook`).
5. Click **Register Webhook with Telegram**.

#### Option B: Using cURL
```bash
curl -F "url=https://turbonex-moderation-bot.<your-subdomain>.workers.dev/webhook" \
     -F "secret_token=YOUR_TELEGRAM_SECRET_TOKEN" \
     https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook
```

To verify webhook status:
```bash
curl https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo
```

---

## 🧪 Testing Guide

We strictly distinguish between **automated unit tests** and **live Telegram integration tests**:

### 1. Automated Unit Tests (26 Passing Tests)
Run the automated test suites locally:
```bash
npm test
```
*(runs `tsx --test src/lib/worker.test.ts src/lib/moderation.test.ts`)*

**Verified Logic:**
- ✅ Admin Authorization: `DEFAULT_CONFIG.adminIds` is empty, zero hardcoded IDs.
- ✅ Admin API Security: Accepts valid `ADMIN_API_KEY` in `Authorization: Bearer` and `X-Admin-Api-Key`.
- ✅ Admin API Security: STRICTLY REJECTS `TELEGRAM_SECRET_TOKEN` as an administrative credential.
- ✅ Admin API Security: Fails closed when `ADMIN_API_KEY` is unset or empty.
- ✅ Admin API Security: Rejects missing or invalid credentials.
- ✅ Text & Caption Moderation: Catches prohibited URLs in media captions (photos, videos, files).
- ✅ Text & Caption Moderation: Catches phone numbers in media captions.
- ✅ Webhook Secret Token validation (`X-Telegram-Bot-Api-Secret-Token`).
- ✅ Constant-time string matching (timing attack defense).
- ✅ Rejection of unauthorized or forged webhook payloads.
- ✅ Detection of standard URLs, bare domains, and Telegram invite links.
- ✅ Detection of obfuscated dot domains (`[dot]`, `(dot)`).
- ✅ Detection of international, formatted, and spaced phone numbers without false positives.
- ✅ Scheduler Concurrency Lock: Atomic lease transitions status from `'pending'` to `'publishing'`, blocking duplicate broadcasts.
- ✅ Sliding-window anti-spam burst and duplicate detection.
- ✅ Token and phone number masking for zero-leak audit logs.
- ✅ Dynamic welcome message templating.

### 2. Live Telegram Integration Testing
Once deployed:
1. Send a prohibited link (e.g. `https://scam-site.xyz` or `t.me/+TestInvite`) from a regular non-admin account into your group &rarr; the bot deletes it and logs the event.
2. Send a photo with a caption containing a phone number &rarr; the message is deleted.
3. Have a test account join the group &rarr; the bot sends the configured welcome greeting.
4. From an authorized Admin account, send `/settings` &rarr; the bot responds with current toggles.
5. Send `/schedule 120 Test announcement` &rarr; the post queues in Cloudflare D1 and publishes to your linked channel 2 minutes later via Cloudflare Cron Triggers.

---

## ⏰ Cloudflare Free Plan Limitations & Notes

- **Cron Resolution**: On the Free plan, Cloudflare Cron Triggers run once every minute (`* * * * *`). Scheduled posts dispatch within ~60 seconds of their due time.
- **Worker CPU Time**: Free workers have 10ms-50ms CPU execution limits per request. Typical webhook processing takes under 4ms.
- **Telegram Webhook HTTPS Requirement**: Telegram strictly requires webhooks to use HTTPS with valid certificates. Cloudflare Workers provides free automatic TLS certificates for all `*.workers.dev` domains.

---

## 🔧 Troubleshooting Checklist

| Issue | Likely Cause | Solution |
| :--- | :--- | :--- |
| **Bot ignores group messages** | Group Privacy Mode is ON | Message @BotFather, send `/setprivacy`, choose bot, click **Disable**. |
| **Bot fails to delete messages** | Missing Admin Rights | Ensure bot is Group Administrator with "Delete Messages" permission. |
| **Webhook returns 401 Unauthorized** | Secret token mismatch | Verify `TELEGRAM_SECRET_TOKEN` in Cloudflare matches the secret passed to `setWebhook`. |
| **Admin API returns 401 Unauthorized** | Missing or incorrect `ADMIN_API_KEY` | Enter your `ADMIN_API_KEY` in the Admin Settings tab. |
| **Channel posts fail with 400** | Bot not in channel | Ensure bot is Channel Administrator with "Post Messages" permission. |
| **D1 query errors in logs** | Migrations not executed | Run `npx wrangler d1 execute turbonex-db --remote --file=migrations/0001_init.sql`. |

---

## 📦 Ready for GitHub

This project contains **zero hardcoded tokens, secrets, or private IDs**. It is fully prepared to be committed and pushed to GitHub. All sensitive credentials are configured exclusively through Cloudflare encrypted secrets or runtime environment variables.
