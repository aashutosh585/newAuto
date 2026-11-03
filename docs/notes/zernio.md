# Zernio Evaluation & Step 1 Test Notes

## Overview
- **Service**: Zernio API (Hosted Social Media Publishing Gateway)
- **Primary Role in Social Engine**: Offload OAuth handshakes, platform-specific token refreshes, direct API rate limits, scheduling, post state webhooks, and future comment-to-DM flows.
- **Integration Layer**: `ZernioPublisher` implementing the abstract `Publisher` interface in `@social-engine/core`.

---

## Step 1 Test Verification Matrix

### 1. Carousel on Instagram via API
- **Capability**: Zernio supports multi-item image carousels (3-10 images) on Instagram via `POST /v1/posts` with `mediaUrls: string[]`.
- **Requirements**: Instagram account connected must be a **Professional (Creator or Business) Account** linked to a Facebook Page.
- **Aspect Ratio**: 4:5 vertical (1080x1350px) is recommended and fully supported.

### 2. Video for Instagram Reels & YouTube Shorts
- **Capability**:
  - Instagram Reels: MP4 (H.264 + AAC), 9:16 vertical (1080x1920px), up to 90 seconds.
  - YouTube Shorts: MP4, 9:16 vertical, under 60 seconds with `#Shorts` in title/description.
- **Rendering**: Generated via Remotion worker, served as public media URL, and dispatched to Zernio.

### 3. Media Ingestion Method & Limits
- **Method**: Publicly reachable media URL (e.g. `https://yourdomain.com/media/run_xyz.jpeg`) or pre-signed S3/R2 direct uploads.
- **Image Size Limit**: 8 MB per JPEG/PNG.
- **Video Size Limit**: 100 MB per MP4 video.

### 4. Rate Limits & Error Envelope
- **Rate Limit**: Typically 60 requests per minute per API key.
- **Error Format**:
  ```json
  {
    "success": false,
    "error": {
      "code": "DUPLICATE_CONTENT",
      "message": "Duplicate post detected within 24 hours.",
      "details": {}
    }
  }
  ```

### 5. The 409 Rule & Idempotency
- **Rule**: Zernio rejects identical text content posted to the same account within 24 hours with an HTTP `409 Conflict`.
- **Engine Implementation**:
  - `JobWriter` produces tailored captions with dynamic date stamps and micro-variations.
  - All retries pass `x-request-id: run-<id>-<channel>-<timestamp>` header to prevent accidental double-execution while allowing explicit retries.

### 6. Webhooks & Verification
- **Events**: `post.published`, `post.failed`, `metrics.updated`.
- **Security**: Validates `x-zernio-signature` header via HMAC-SHA256 with `ZERNIO_WEBHOOK_SECRET`.
- **Endpoint in Engine**: `POST /api/webhooks/zernio`.

---

## Fallback Contingency
If Zernio encounters severe downtime or pricing shifts:
- Simply toggle `PUBLISHER_TYPE=direct` or `PUBLISHER_TYPE=postmill` in `.env`.
- The engine uses `PublisherFactory` to switch instantly with zero code rewrites.

