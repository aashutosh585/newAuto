# 🚀 DinoMate Social Media Automation Engine

> **Zero Human Effort Social Media Presence for DinoMate**  
> An autonomous, serverless social publishing engine built with **Next.js 14 App Router**, **MongoDB Atlas**, **Multi-Model AI (IteraCompute, OpenRouter, Gemini, Groq)**, and **Zernio** for unified social media distribution across **Instagram, YouTube Shorts, Telegram, and Twitter / X**.

---

## 🌟 Highlights

- **🔒 Single-Input Password Gate**: Website opens with only one secure password input field matching `ADMIN_PASSWORD` from `.env`.
- **🔗 Automatic Account Sync via Zernio**: If accounts aren't connected yet, displays 1-click connect cards (OAuth for Instagram, YouTube, X; bot code for Telegram). Automatically hides once connected.
- **💼 Real Job Ingestion (DinoMate API)**: Pulls verified fresher openings via `https://dinomate.app/api/public/jobs` with `x-api-key: publickey` and `experienceLevel: ENTRY`.
- **📸 1080×1350 Multi-Slide Carousels**: Edge-rendered 5–6 slide carousels (Hook slide, 4 job cards with skills & salary, and DinoMate CTA slide).
- **🎬 1080×1920 Vertical Video Reels**: Automated 9:16 job role explainer reels for YouTube Shorts and Instagram Reels (Hook, Eligibility, Required Skills, Salary & Hiring Companies, Call To Action).
- **🤖 Multi-Model Free AI Gateway**:
  - **IteraCompute**: Free `qwen/qwen3.8-27b` (262k context, 0 cost).
  - **OpenRouter Free Rotation**: `dots-studio/dots-3-note-preview:free`, `nvidia/nemotron-3.5-lightning:free` (1M context), `xingchen-agi/xing4.0-29b-a4b:free`, `google/gemma-4-31b-it:free`.
  - **Gemini 2.0 Flash**: High-speed, primary fallback.
  - **Groq**: Llama 3.3 70B & 8B backup.
- **⚡ Non-Blocking External Cron Endpoints**: Returns `200 OK` instantly so cron services like `cron-job.org` never time out, while running stages asynchronously in the background.
- **📊 Complete Dashboard**: Full real-time audit ledger for Runs, Jobs Ingested vs. Dropped, Published Posts, AI Activity & Token Cost, and System Settings.

---

## 🏗️ Architecture Flow

```
                     EXTERNAL CRON (cron-job.org)
                                  │
                                  ▼
               POST /api/run?type=image (Daily at 9 AM)
               POST /api/run?type=video (Every 2-3 Days)
                                  │
                 ┌────────────────┴────────────────┐
                 │  Returns 200 OK immediately     │
                 │  Fires background async runner  │
                 └────────────────┬────────────────┘
                                  ▼
┌───────────────────────────────────────────────────────────────────┐
│                       AUTOMATION PIPELINE                         │
├───────────────────────────────────────────────────────────────────┤
│ 1. COLLECT : DinoMate API + Greenhouse + Lever                    │
│ 2. DEDUPE  : SHA-256 hash (company+title+location) + 48h check    │
│ 3. RANK    : Multi-AI Gateway ranks top fresher opportunities     │
│ 4. WRITE   : High-converting viral captions & CTAs                │
│ 5. RENDER  : Edge OG renders 1080x1350 carousels or 1080x1920     │
│              vertical video reel scenes                           │
│ 6. PUBLISH : Dispatched via Zernio Unified API                    │
│              (Instagram, YouTube Shorts, Telegram, Twitter / X)   │
│ 7. LOG     : All stages, jobs, and LLM calls stored in MongoDB    │
└───────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                     ZERNIO WEBHOOK RECEIVER
                   (/api/webhooks/zernio)
           Updates post metrics (likes, reach, status)
```

---

## ⚙️ Environment Configuration

Create a `.env` file in the root directory (or copy from `.env.example`):

```bash
# --- Dashboard Password Gate ---
ADMIN_PASSWORD=YourPassword123
SESSION_SECRET=a-very-long-and-secure-random-secret-key-min-32-chars

# --- External Cron Authentication ---
CRON_SECRET=my-external-cron-secret-token-min-32-chars

# --- MongoDB Atlas Database ---
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/social_engine?retryWrites=true&w=majority

# --- Zernio Publisher API ---
ZERNIO_API_KEY=sk_your_zernio_key
ZERNIO_PROFILE_NAME=Social Engine Admin
ZERNIO_PROFILE_ID=your_profile_id_here

# --- AI Providers (Multi-Model Free Chain) ---
GEMINI_API_KEY=your_gemini_key
OPENROUTER_API_KEY=sk-or-v1-your-key
OPENROUTER_SITE_URL=https://dinomate.app
OPENROUTER_SITE_NAME=DinoMate Social Engine

ITERACOMPUTE_API_KEY=sk-your-iteracompute-key
ITERACOMPUTE_MODEL=qwen/qwen3.8-27b

GROQ_API_KEY=your_groq_key

# --- DinoMate Job Data Source ---
DINOMATE_API_KEY=publickey

# --- Optional Alert Bot ---
ALERT_TELEGRAM_BOT_TOKEN=
ALERT_CHAT_ID=

# --- Operational Switches ---
ENGINE_KILL_SWITCH=false
```

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Run Local Development Server
```bash
pnpm dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser:
1. Enter your `ADMIN_PASSWORD`.
2. Connect your social accounts via Zernio (Telegram, Instagram, YouTube, X).
3. Click **"Image Run"** or **"Video Run"** to launch your first automated run!

### 3. Build for Production
```bash
pnpm build
pnpm start
```

---

## ⏰ External Cron Setup (cron-job.org)

To achieve **zero human effort**, configure two automated tasks in [cron-job.org](https://cron-job.org):

### 1. Daily Image Carousel Post (Runs Daily at 9:00 AM)
- **URL**: `https://your-domain.vercel.app/api/run?type=image&slot=morning&secret=YOUR_CRON_SECRET`
- **Method**: `POST`
- **Schedule**: Every day at 09:00 UTC (or your preferred local time)

### 2. Video Reel Explainer (Runs Every 2–3 Days)
- **URL**: `https://your-domain.vercel.app/api/run?type=video&slot=weekly&secret=YOUR_CRON_SECRET`
- **Method**: `POST`
- **Schedule**: Every 3 days at 14:00 UTC

### 3. Combined Run (Runs Both Image & Video)
- **URL**: `https://your-domain.vercel.app/api/run?type=all&slot=daily_all&secret=YOUR_CRON_SECRET`

> **Note:** Both endpoints return a `200 OK` JSON response immediately with the created `runId`, ensuring cron monitors never time out while the background pipeline runs to completion.

---

## 📡 API Endpoints Overview

| Route | Method | Description |
| :--- | :---: | :--- |
| `/api/run` | `GET` / `POST` | External cron trigger (`?type=image`, `?type=video`, `?type=all`). Protected by `CRON_SECRET`. |
| `/api/runs` | `GET` / `POST` | Authenticated dashboard manual trigger and run execution history. |
| `/api/jobs` | `GET` | Audit ledger of all jobs ingested (Passed vs. Dropped with reasons). |
| `/api/og/carousel` | `GET` | Generates 1080×1350 multi-slide carousel cards on Next.js Edge runtime. |
| `/api/og/reel` | `GET` | Generates 1080×1920 vertical reel frames (Hook, Eligibility, Skills, Salary, CTA). |
| `/api/webhooks/zernio` | `POST` | Zernio webhook handler for post publication status & analytics callbacks. |
| `/api/analytics` | `GET` | Aggregated dashboard statistics (runs, posts, LLM token usage, cost). |
| `/api/llm-activity` | `GET` | Detailed audit logs for every AI prompt, response, tokens, and latency. |
| `/api/social/accounts` | `GET` | Lists all connected Zernio accounts. |
| `/api/social/auth-url` | `POST` | Generates OAuth connect URLs or Telegram bot verification codes. |

---

## 🌐 Deploying to Vercel

1. Push your repository to your private GitHub repository.
2. Import the project in **[Vercel](https://vercel.com)**.
3. In **Project Settings → Environment Variables**, add all keys from your `.env`.
4. Deploy!
5. In your **Zernio Dashboard (Settings → Webhooks)**, add:
   ```
   https://your-vercel-domain.vercel.app/api/webhooks/zernio
   ```
6. Set up your cron schedules on **cron-job.org**.

---

## 🛡️ License

Private project for DinoMate social media automation. All rights reserved.

