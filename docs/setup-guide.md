# Social Engine Setup & Operations Guide (v3)

## 1. Step 0: Accounts & Keys Checklist

### A. Zernio (Publisher Gateway)
1. Sign up on [Zernio](https://zernio.com) and create an API Key (copy it immediately).
2. Create a default profile.
3. Connect initial platforms:
   - **Telegram**: Connect your channel where the bot is an administrator.
   - **Instagram**: Connect your Instagram Professional account (must be linked to a Facebook Page).
4. Save the account IDs into `.env`:
   - `ZERNIO_API_KEY`
   - `ZERNIO_PROFILE_ID`
   - `ZERNIO_ACCOUNT_TELEGRAM`
   - `ZERNIO_ACCOUNT_INSTAGRAM`

### B. Telegram Private Alerts Bot
1. Open [@BotFather](https://t.me/BotFather) and run `/newbot` to generate a dedicated alert bot.
2. Obtain your personal chat ID (message `@userinfobot` or check `/getUpdates`).
3. Set `ALERT_TELEGRAM_BOT_TOKEN` and `ALERT_CHAT_ID` in `.env`.

### C. LLM Gateway Keys
1. Obtain free-tier API keys for:
   - Google AI Studio (Gemini 2.5 Flash)
   - Groq (Llama 3.1 & 3.3)
   - OpenRouter (free models)
2. Enter them into `.env` (these are routed only through `litellm`):
   - `GEMINI_API_KEY`
   - `GROQ_API_KEY`
   - `OPENROUTER_API_KEY`

---

## 2. Infrastructure Setup (Docker Compose)

### A. Environment Configuration
Copy `.env.example` to `.env` and fill in your keys:
```bash
cp .env.example .env
```

### B. Generate Dashboard Password Hash
Use Node to generate a secure bcrypt hash for your dashboard login:
```bash
node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('YourSuperPassword123', 12));"
```
Place the output into `DASHBOARD_PASSWORD_HASH` in `.env`.

### C. Launch Infrastructure
Start PostgreSQL, Redis, LiteLLM, JobSpy, Web, Worker, and Caddy:
```bash
docker-compose -f infra/docker-compose.yml up -d
```

### D. Run Database Migrations
Initialize PostgreSQL tables:
```bash
pnpm db:push
```

---

## 3. Triggering Runs

### A. Via Cron Trigger (GitHub Actions / cron-job.org)
Send an HTTP POST or GET request with your `CRON_SECRET`:
```bash
curl -X POST "https://yourdomain.com/api/run?slot=morning&secret=YOUR_CRON_SECRET"
```

### B. Via Password-Protected Dashboard
1. Open `https://yourdomain.com/login` in your browser.
2. Enter your password.
3. Navigate to **Settings** or click **+ Trigger Run** in the header.

---

## 4. Pipeline Stages Sequence
1. **`COLLECT`**: Fetches jobs from JobSpy, ATS feeds (Greenhouse/Lever), and DinoMate.
2. **`RANK`**: LiteLLM evaluates role, eligibility, batch, and skills (scores 0-100).
3. **`WRITE`**: LiteLLM crafts unique platform captions with CTAs and hashtags.
4. **`RENDER`**: Playwright renders high-contrast 1080x1350 JPEG slides.
5. **`PUBLISH`**: Dispatches post payload to Zernio API (or direct publishers).
6. **`TRACK`**: Webhooks update post status and performance metrics in the dashboard.
