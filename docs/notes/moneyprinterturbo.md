# MoneyPrinterTurbo (Reference Only) Notes

## Repository
- **Upstream**: [harry0703/MoneyPrinterTurbo](https://github.com/harry0703/MoneyPrinterTurbo)
- **Role**: Reference implementation only for automated short video synthesis (TTS, subtitle alignment, background video selection).

## Lessons Learned & Adopted
1. **TTS Generation**:
   - `edge-tts` provides high quality, free speech synthesis without requiring paid ElevenLabs keys.
2. **Subtitle Stamping**:
   - Word-by-word highlighted captions drive 2x engagement on vertical video platforms (Reels/Shorts).
3. **What We Skip**:
   - We skip its heavy Gradio UI and monolithic codebase.
   - We use modern Remotion React components and BullMQ orchestration instead.
