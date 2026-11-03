# 🔍 Job Data Sources & DinoMate API

## Overview
Quality job data is the foundation of the Social Engine. The engine aggregates from official APIs, ATS endpoints, and scraper sources.

---

## 1. Primary Source: DinoMate Public API
- **Endpoint**: `https://dinomate.app/api/public/jobs`
- **Authentication**: `x-api-key: publickey` (pre-configured in `.env`)
- **Query Strategy**:
  - Searches 5 key engineering roles: `software engineer`, `frontend developer`, `backend developer`, `intern developer`, `graduate trainee`.
  - Filters strictly by `experienceLevel=ENTRY`.
  - Ingests company, title, location, apply link, skills, tech stack, and salary ranges.

---

## 2. Secondary Sources: Official ATS Job Feeds
- **Greenhouse Boards API**: `https://boards-api.greenhouse.io/v1/boards/{company}/jobs`
  - Canonical, Cloudflare, Discord, GitLab, Stripe.
- **Lever Postings API**: `https://api.lever.co/v0/postings/{company}?mode=json`
  - Palantir, Figma, Netflix.

---

## 3. Supplementary Scraper: JobSpy
- Python-based multi-board job scraper (LinkedIn, Indeed, Glassdoor, ZipRecruiter) without browser overhead.
- Used when additional raw job volume is needed.

---

## 4. Deduplication & Quality Guardrails
- **Dedupe Hash**: `sha256(company + "_" + title + "_" + location)`.
- **48-Hour Freshness**: Openings published older than 48 hours are automatically dropped.
- **Senior Role Exclusion**: Filters out `senior`, `lead`, `staff`, `principal`, `manager`, `architect`, `5+ years`.
- **Apply Link Verification**: Validates apply URL structure and liveness.
- **Audit Ledger**: Every single job (both passed and dropped with reason) is permanently recorded in the MongoDB `JobItem` ledger for review on the dashboard.
