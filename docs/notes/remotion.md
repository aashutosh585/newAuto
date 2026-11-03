# 🎬 Video Reel & Shorts Architecture

## Overview
The video generation system is implemented in [`lib/video-pipeline.ts`](../../lib/video-pipeline.ts) and [`app/api/og/reel/route.tsx`](../../app/api/og/reel/route.tsx), specifically tailored for **YouTube Shorts** and **Instagram Reels** (9:16 vertical, 1080×1920).

Triggered automatically every 2–3 days via external cron (`/api/run?type=video`) or manually via the dashboard.

---

## 📐 Scene Sequence (45-Second Reel Structure)

| Scene | Duration | Visual Card | Content |
| :--- | :---: | :--- | :--- |
| **1. Hook** | 0–5s | `scene=hook` | High-contrast title (*"What Does A [Role] Actually Do?"*), fresher guide badge, stop-scrolling hook. |
| **2. Eligibility** | 5–18s | `scene=eligibility` | Batches (2024–2026), eligible degrees (B.Tech, BCA, MCA, BSc), 0–1 yr experience. |
| **3. Skills Breakdown** | 18–32s | `scene=skills` | Top 4 tech skills tested in interviews, round-by-round breakdown (OA, Tech, HR). |
| **4. Compensation** | 32–40s | `scene=salary` | Entry-level CTC ranges (₹4.5–₹14 LPA), actively hiring companies in India. |
| **5. Call to Action** | 40–45s | `scene=cta` | Comment *"APPLY"* for direct links + follow `@dinomate`. |

---

## 🤖 AI Script Generation
The script and role parameters are automatically generated per run by the multi-model AI gateway:
- Pulls live, active job roles from the **DinoMate API** (`developer fresher` queries).
- Generates structured JSON containing `role`, `batch`, `degrees`, `skills`, `salary`, `companies`, `scriptHook`, `scriptValue`, and a viral platform `caption`.

---

## 🚀 Publishing
- Renders high-resolution 9:16 vertical cards via the Next.js Edge runtime at `/api/og/reel`.
- Dispatched to **Zernio** to publish across connected accounts (Instagram, YouTube, Telegram, Twitter/X).
- Logged to the MongoDB `Asset` and `Post` collections.
