# Remotion Video Notes

## Repository
- **Upstream**: [remotion-dev/remotion](https://github.com/remotion-dev/remotion)
- **Role**: Programmatic video creation in React for YouTube Shorts and Instagram Reels.

## Architecture & Implementation
1. **Pipeline Position**:
   - Executes during the `RENDER` stage (Step 8 roadmap).
   - Template Structure:
     - 0-3s: Viral Hook (Big text, audio stinger, high-contrast title).
     - 3-18s: Value delivery (Top 3-4 fresher openings, badges, eligibility).
     - 18-25s: Strong Call-To-Action (Comment "JOBS", link in bio/Telegram).

2. **Audio & Subtitles**:
   - Voiceover: `edge-tts` (Microsoft natural TTS voices) or `Kokoro` fast offline TTS.
   - Subtitles: Auto-aligned word-by-word captions synced with audio timestamps.

3. **Fallback Chain**:
   - If Remotion rendering fails or times out:
     1. Fallback to simpler static-card video template.
     2. Fallback to carousel image posting only (never crash the entire run).
