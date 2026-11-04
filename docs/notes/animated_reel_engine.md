# Animated Reel Engine

Replaces the old "5 static OG cards + one voice" reels with animated characters,
multi-voice human-like speech and a novelty-driven idea picker.

## Flow

```
discoverTrends()            lib/trend/trend-discovery.ts   HN, Reddit (random subs, top/day), Google Trends IN, DinoMate jobs
  -> forgeFreshIdea()       lib/trend/idea-forge.ts        LLM proposes 6 specific ideas across rotating pillars + modes,
                                                           each scored vs content memory; weighted pick among top 3
  -> buildCast()            lib/video/cast.ts              random names/looks/outfits/voices per run
  -> directScript()         lib/video/script-director.ts   Hinglish dialogue with acting directions (emotion, gesture,
                                                           listener reaction, punchline, sfx, on-screen sticker)
  -> synthesizeDialogue()   lib/video/tts_worker.py        per-line voice; ElevenLabs > Edge neural > Windows SAPI > silence
                                                           real word timings -> lip-sync + karaoke captions
  -> renderReel()           lib/video/render/render_reel.py  Pillow characters + sets, piped to ffmpeg (x264 + loudnorm)
  -> publish + recordVideoToMemory()
```

## Modes

| Mode | On screen | Best for |
|---|---|---|
| `skit` | 2-3 characters, speaker focus, reactions, punchline zoom + SFX | jokes, relatable situations |
| `guide` | one presenter talking to camera, numbered sticker cards | how-tos, tips |
| `voiceover` | no characters; Pexels b-roll (if key) or animated background, big captions | explainers, news, myths |

Force a mode: `VIDEO_MODE=skit`, or `/api/run?type=video&mode=guide`. Otherwise the engine rotates modes and avoids repeating the last one.

## Local test

```
pip install -r requirements.txt
npm run test:reel -- skit        # or guide | voiceover | (empty = auto)
```
Output goes to `public/videos/test_reel_<mode>.mp4`. Rendering runs at about 3-4x real time on a laptop CPU.

## Upgrades

- `ELEVENLABS_API_KEY` + voice ids: most realistic voices (multilingual v2 handles Hinglish).
- `PEXELS_API_KEY`: real-human stock footage in voiceover reels.
- `assets/music/*.mp3`: background music, auto-ducked under speech.
- `assets/fonts/heavy.ttf` / `bold.ttf`: brand fonts.

## Deployment note

Rendering needs Python, ffmpeg and 1-3 minutes of CPU, so it **cannot run inside a Vercel serverless function**.
Run the video pipeline on a VM, Railway/Render worker, or a GitHub Actions cron (`npm run test:reel`-style script that publishes).

## v2 — realism + Indian reel style

- **Characters** (`lib/video/render/characters.py`): soft volumetric shading, egg-shaped face, almond eyes with lids/lashes,
  real lips with visemes (mouth shape follows the letter being spoken), 5-finger hands (open / point / fist / thumbs-up),
  tapered sleeves, head nods + brow raises + hand beats on stressed words, double blinks, eye saccades,
  earrings / bindi / stubble / moustache.
- **Voice**: Indian voices only. The script writer produces Roman captions, then a second small LLM pass makes a
  Devanagari-Hinglish `spoken` line (English words stay English) that `hi-IN-MadhurNeural` / `hi-IN-SwaraNeural` read
  with a natural desi accent. HR/manager personas may get `en-IN` (Indian-English) voices. `CONTENT_LANGUAGE=english`
  switches everything to en-IN voices.
- **Editing** (`render_reel.py`): hard jump cuts to close-ups, shake on punchlines, emoji reactions above listeners,
  emoji in titles/captions/stickers.
- **Sound** (`audio_fx.py`): rimshot / boom / whoosh / pop / ding SFX + generated Indian-flavoured BGM
  (tanpura drone, dholak groove, pentatonic plucks), auto-ducked under speech. Drop mp3s in `assets/music/` to use real music.
- **Script style**: desi tropes, Hinglish fillers, Indian hook formulas, "Tag that friend" endings.
