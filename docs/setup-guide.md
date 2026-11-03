# 📖 Social Engine Setup & Operations Guide

Complete step-by-step operations guide for deploying and running the **DinoMate Social Engine** on **Vercel** with **MongoDB Atlas**, **Zernio**, and **cron-job.org**.

---

## 1. Step 0: Accounts & API Keys Checklist

### A. Zernio (Publisher Gateway)
1. Sign up on [Zernio](https://zernio.com) and create an **API Key** in Settings → API Keys.
2. Note your default Profile ID (the engine auto-discovers this if not set).
3. Connect your initial platforms via the dashboard UI or API:
   - **Telegram**: Connect your channel using the verification code provided by `@LateScheduleBot`.
   - **Instagram**: Professional account connected to a Facebook Page.
   - **YouTube**: Connect your YouTube channel.
   - **Twitter / X**: Authenticate via OAuth.
4. Set in `.env`:
   ```bash
   ZERNIO_API_KEY=sk_...
   ZERNIO_PROFILE_ID=6a9a5d626af294f23b71166b
   ```

### B. MongoDB Atlas Database
1. Create a free cluster on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Create a database user with Read/Write permissions.
3. Whitelist Network Access (`0.0.0.0/0` for Vercel serverless functions).
4. Set in `.env`:
   ```bash
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/social_engine?retryWrites=true&w=majority
   ```

### C. Free AI Providers (Multi-Model Resilience)
The engine supports multiple free-tier LLM providers with automatic fallback:
- **IteraCompute**: Register on `platform.iteracompute.com` and generate an API key. Uses `qwen/qwen3.8-27b` (`is_free: true`, 262k context).
- **OpenRouter**: Register on `openrouter.ai` and generate an API key. Uses free models (`dots-studio/dots-3-note-preview:free`, `nvidia/nemotron-3.5-lightning:free`, etc.).
- **Google AI Studio**: Generate a Gemini API key for `gemini-2.0-flash`.
- **Groq**: Optional backup for `llama-3.3-70b-versatile`.

Set in `.env`:
```bash
GEMINI_API_KEY=...
OPENROUTER_API_KEY=sk-or-v1-...
ITERACOMPUTE_API_KEY=sk-...
ITERACOMPUTE_MODEL=qwen/qwen3.8-27b
GROQ_API_KEY=...
```

### D. DinoMate Public Job Source
- Endpoint: `https://dinomate.app/api/public/jobs`
- Auth: `x-api-key: publickey` (free, no secret required)
- Pre-configured in `.env`:
  ```bash
  DINOMATE_API_KEY=publickey
  ```

---

## 2. Local Development & Verification

### A. Install Packages
```bash
pnpm install
```

### B. Launch Dev Server
```bash
pnpm dev
```
Navigate to **`http://localhost:3000`**:
1. Enter your `ADMIN_PASSWORD` (configured in `.env`).
2. Test connecting social accounts via Zernio.
3. Click **"Image Run"** to test a live 5-slide carousel post.
4. Click **"Video Run"** to test a live 9:16 vertical video reel explainer.

---

## 3. Production Deployment (Vercel)

### A. Deploy to Vercel
1. Import the repository in your Vercel Dashboard.
2. Under **Project Settings → Environment Variables**, copy and paste all values from your local `.env`.
3. Set Framework Preset to **Next.js**.
4. Click **Deploy**.

### B. Configure Zernio Webhooks
In your **Zernio Dashboard → Settings → Webhooks**:
- Set **Webhook URL** to:
  ```
  https://your-domain.vercel.app/api/webhooks/zernio
  ```
- Events: Select `post.published`, `post.failed`, and `post.analytics`.
- This ensures your dashboard automatically displays live post links, likes, comments, and reach!

---

## 4. Setting Up Outside Cron Triggers

Set up tasks on [cron-job.org](https://cron-job.org) to operate with **zero human intervention**:

### Task 1: Daily Job Carousel
- **URL**: `https://your-domain.vercel.app/api/run?type=image&slot=morning&secret=YOUR_CRON_SECRET`
- **Method**: `POST`
- **Schedule**: Every day at 9:00 AM (e.g. `0 9 * * *`)

### Task 2: Video Reel Explainer
- **URL**: `https://your-domain.vercel.app/api/run?type=video&slot=weekly&secret=YOUR_CRON_SECRET`
- **Method**: `POST`
- **Schedule**: Every 2 or 3 days at 2:00 PM (e.g. `0 14 */2 * *`)

---

## 5. Pipeline Stages & Safeguards

```
[Cron Trigger]
      │
      ▼
┌──────────────┐
│   COLLECT    │ ── Pulls jobs from DinoMate (ENTRY filter) + Lever + Greenhouse
└──────────────┘
      │
      ▼
┌──────────────┐
│    DEDUPE    │ ── SHA-256 (company+title+location), filters >48h old, senior roles
└──────────────┘
      │
      ▼
┌──────────────┐
│     RANK     │ ── AI evaluates and ranks top 5 fresher jobs (0-100 score)
└──────────────┘
      │
      ▼
┌──────────────┐
│    WRITE     │ ── AI crafts viral caption with CTA ("Comment JOBS")
└──────────────┘
      │
      ▼
┌──────────────┐
│    RENDER    │ ── Edge runtime builds 1080x1350 carousel or 1080x1920 reel cards
└──────────────┘
      │
      ▼
┌──────────────┐
│   PUBLISH    │ ── Dispatches to Zernio API across all connected platforms
└──────────────┘
      │
      ▼
┌──────────────┐
│    AUDIT     │ ── Logs run timeline, jobs ledger, and LLM costs to MongoDB
└──────────────┘
```

### Safety Features:
- **Idempotency Guard**: Same slot executed on the same day is rejected safely to prevent duplicate postings.
- **Immediate Response**: Cron callers receive an instant `200 OK` JSON response within 200ms; work continues asynchronously.
- **Engine Kill Switch**: Setting `ENGINE_KILL_SWITCH=true` in `.env` immediately pauses all cron executions during maintenance.
