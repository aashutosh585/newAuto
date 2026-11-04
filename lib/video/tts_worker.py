"""
DinoMate Dialogue Voice Engine (multi-speaker, human-like TTS)

Synthesises a list of dialogue lines (each with its own speaker voice, rate and
pitch) into ONE master WAV track plus exact per-line and per-word timings.
Timings drive lip-sync, speaker switching and karaoke captions in the renderer.

Provider chain (first that works wins, per line):
  1. ElevenLabs  (if ELEVENLABS_API_KEY set)  - most human, handles Hinglish well
  2. Microsoft Edge neural TTS (edge-tts, free) - real word-boundary timings
  3. Windows System.Speech via PowerShell      - offline, robotic but audible
  4. Silence with estimated timing             - never crashes the pipeline

Usage: python tts_worker.py <spec.json>
Spec:
{
  "lines": [{"id": "l1", "speaker": "aarav", "text": "...", "voice": "en-IN-PrabhatNeural",
             "rate": "+0%", "pitch": "+0Hz", "pauseAfter": 0.25, "elevenVoiceId": "..."}],
  "outputDir": "...", "masterOutput": ".../master.wav", "ffmpeg": "path/to/ffmpeg",
  "offline": false
}
Prints a single JSON line with the result on stdout.
"""

import sys
import os
import json
import wave
import struct
import asyncio
import subprocess
import urllib.request

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    from hinglish_normalizer import to_indian_devanagari_audio
except Exception:  # pragma: no cover
    def to_indian_devanagari_audio(t: str) -> str:
        return t

SAMPLE_RATE = 24000


def log(msg: str) -> None:
    sys.stderr.write(f"[TTSWorker] {msg}\n")
    sys.stderr.flush()


# --------------------------------------------------------------------------- #
# Audio helpers (pure stdlib, no mutagen/pydub needed)
# --------------------------------------------------------------------------- #

def to_wav(ffmpeg: str, src: str, dst: str, tempo: float = 1.0) -> None:
    """Convert any audio file to 24kHz mono 16-bit WAV, trimming edge silence lightly."""
    filters = [
        # trim leading silence so lines butt up naturally
        "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05",
        # trim trailing silence (reverse trick)
        "areverse",
        "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08",
        "areverse",
    ]
    if abs(tempo - 1.0) > 0.01:
        filters.append(f"atempo={tempo:.3f}")
    subprocess.run(
        [ffmpeg, "-y", "-loglevel", "error", "-i", src, "-af", ",".join(filters),
         "-ac", "1", "-ar", str(SAMPLE_RATE), "-sample_fmt", "s16", dst],
        check=True, capture_output=True,
    )


def read_wav_samples(path: str) -> bytes:
    with wave.open(path, "rb") as w:
        if w.getframerate() != SAMPLE_RATE or w.getnchannels() != 1 or w.getsampwidth() != 2:
            raise ValueError("unexpected wav format")
        return w.readframes(w.getnframes())


def silence(seconds: float) -> bytes:
    return b"\x00\x00" * int(max(0.0, seconds) * SAMPLE_RATE)


def estimate_duration(text: str) -> float:
    words = max(1, len(text.split()))
    return round(max(1.2, words / 2.7), 2)  # ~160 wpm conversational


def distribute_words(text: str, start: float, duration: float):
    """Fallback word timing weighted by word length (better than uniform)."""
    words = [w for w in text.split() if w]
    if not words:
        return []
    weights = [max(2, len(w)) + 1 for w in words]
    total = float(sum(weights))
    t = start
    out = []
    for w, wt in zip(words, weights):
        d = duration * wt / total
        out.append({"word": w, "start": round(t, 3), "end": round(t + d, 3)})
        t += d
    return out


def map_boundaries_to_words(text: str, boundaries, start: float, duration: float):
    """
    Map TTS word-boundary timings back onto the ORIGINAL caption words.
    (Spoken text may differ, e.g. Devanagari transliteration, numbers expanded.)
    """
    words = [w for w in text.split() if w]
    if not words:
        return []
    if not boundaries:
        return distribute_words(text, start, duration)
    if len(boundaries) == len(words):
        return [
            {"word": w, "start": round(start + b[0], 3), "end": round(start + b[0] + b[1], 3)}
            for w, b in zip(words, boundaries)
        ]
    # Different counts: proportional index mapping
    out = []
    nb = len(boundaries)
    for i, w in enumerate(words):
        j = min(nb - 1, int(i * nb / len(words)))
        j2 = min(nb - 1, int((i + 1) * nb / len(words)) - 1)
        j2 = max(j, j2)
        s = boundaries[j][0]
        e = boundaries[j2][0] + boundaries[j2][1]
        out.append({"word": w, "start": round(start + s, 3), "end": round(start + e, 3)})
    return out


# --------------------------------------------------------------------------- #
# Providers
# --------------------------------------------------------------------------- #

async def synth_edge(text: str, voice: str, rate: str, pitch: str, mp3_path: str):
    import edge_tts

    spoken = text
    # hi-IN voices: if the script didn't already supply Devanagari-Hinglish, transliterate what we can
    if voice.startswith("hi-IN") and not any("\u0900" <= ch <= "\u097F" for ch in text):
        spoken = to_indian_devanagari_audio(text)

    kwargs = dict(rate=rate or "+0%", pitch=pitch or "+0Hz")
    try:
        comm = edge_tts.Communicate(spoken, voice, boundary="WordBoundary", **kwargs)
    except TypeError:  # older edge-tts without boundary kwarg
        comm = edge_tts.Communicate(spoken, voice, **kwargs)

    audio = bytearray()
    boundaries = []
    async for chunk in comm.stream():
        if chunk["type"] == "audio":
            audio.extend(chunk["data"])
        elif chunk["type"] == "WordBoundary":
            boundaries.append((chunk["offset"] / 1e7, chunk["duration"] / 1e7))
    if not audio:
        raise RuntimeError("edge-tts returned no audio")
    with open(mp3_path, "wb") as f:
        f.write(audio)
    return boundaries


def synth_elevenlabs(text: str, voice_id: str, mp3_path: str) -> None:
    key = os.environ.get("ELEVENLABS_API_KEY")
    if not key or not voice_id:
        raise RuntimeError("ElevenLabs not configured")
    model = os.environ.get("ELEVENLABS_MODEL", "eleven_multilingual_v2")
    body = json.dumps({
        "text": text,
        "model_id": model,
        "voice_settings": {"stability": 0.38, "similarity_boost": 0.8, "style": 0.45, "use_speaker_boost": True},
    }).encode("utf-8")
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}?output_format=mp3_44100_128",
        data=body,
        headers={"xi-api-key": key, "Content-Type": "application/json", "Accept": "audio/mpeg"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=45) as resp:
        data = resp.read()
    if len(data) < 1000:
        raise RuntimeError("ElevenLabs returned empty audio")
    with open(mp3_path, "wb") as f:
        f.write(data)


def synth_sapi(text: str, wav_path: str, female: bool) -> None:
    """Offline Windows speech via PowerShell System.Speech (no pywin32 needed)."""
    if os.name != "nt":
        raise RuntimeError("SAPI only on Windows")
    safe_text = text.replace("'", "''")
    safe_path = wav_path.replace("'", "''")
    gender = "Female" if female else "Male"
    ps = (
        "Add-Type -AssemblyName System.Speech;"
        "$s = New-Object System.Speech.Synthesis.SpeechSynthesizer;"
        f"try {{ $s.SelectVoiceByHints([System.Speech.Synthesis.VoiceGender]::{gender}) }} catch {{}};"
        "$s.Rate = 1;"
        f"$s.SetOutputToWaveFile('{safe_path}');"
        f"$s.Speak('{safe_text}');"
        "$s.Dispose();"
    )
    subprocess.run(["powershell", "-NoProfile", "-NonInteractive", "-Command", ps],
                   check=True, capture_output=True, timeout=60)
    if not os.path.exists(wav_path) or os.path.getsize(wav_path) < 1000:
        raise RuntimeError("SAPI produced no audio")


# --------------------------------------------------------------------------- #
# Main synthesis loop
# --------------------------------------------------------------------------- #

async def synthesize(spec: dict) -> dict:
    lines = spec.get("lines", [])
    out_dir = spec.get("outputDir", "./.temp_audio")
    master = spec.get("masterOutput", os.path.join(out_dir, "master.wav"))
    ffmpeg = spec.get("ffmpeg") or "ffmpeg"
    offline = bool(spec.get("offline")) or os.environ.get("OFFLINE") == "true"
    lead_in = float(spec.get("leadIn", 0.15))
    os.makedirs(out_dir, exist_ok=True)

    pcm = bytearray(silence(lead_in))
    cursor = lead_in
    results = []
    providers_used = set()

    for idx, ln in enumerate(lines):
        text = (ln.get("text") or "").strip()
        if not text:
            continue
        spoken = (ln.get("spokenText") or text).strip()
        voice = ln.get("voice") or "en-IN-PrabhatNeural"
        tempo = float(ln.get("tempo", 1.0))
        mp3 = os.path.join(out_dir, f"line_{idx}.mp3")
        raw_wav = os.path.join(out_dir, f"line_{idx}_raw.wav")
        wav = os.path.join(out_dir, f"line_{idx}.wav")
        boundaries = []
        provider = None

        # 1. ElevenLabs
        if not offline and os.environ.get("ELEVENLABS_API_KEY") and ln.get("elevenVoiceId"):
            try:
                synth_elevenlabs(spoken, ln["elevenVoiceId"], mp3)
                to_wav(ffmpeg, mp3, wav, tempo)
                provider = "elevenlabs"
            except Exception as e:
                log(f"ElevenLabs line {idx} failed: {e}")

        # 2. Edge neural TTS (retry once)
        if provider is None and not offline:
            for attempt in range(2):
                try:
                    boundaries = await asyncio.wait_for(
                        synth_edge(spoken, voice, ln.get("rate"), ln.get("pitch"), mp3), timeout=30
                    )
                    to_wav(ffmpeg, mp3, wav, tempo)
                    provider = "edge"
                    break
                except Exception as e:
                    log(f"edge-tts line {idx} attempt {attempt + 1} failed: {e}")

        # 3. Windows SAPI
        if provider is None:
            try:
                synth_sapi(spoken, raw_wav, female=bool(ln.get("female")))
                to_wav(ffmpeg, raw_wav, wav, tempo)
                provider = "sapi"
            except Exception as e:
                log(f"SAPI line {idx} failed: {e}")

        if provider is not None:
            samples = read_wav_samples(wav)
            duration = len(samples) / 2 / SAMPLE_RATE
            # edge boundaries are relative to untrimmed audio; trimming removes ~lead silence
            if boundaries:
                shift = boundaries[0][0]
                boundaries = [((b[0] - shift) / tempo, b[1] / tempo) for b in boundaries]
        else:
            duration = estimate_duration(text)
            samples = silence(duration)
            provider = "silent"

        providers_used.add(provider)
        start = cursor
        pcm.extend(samples)
        cursor += duration
        words = map_boundaries_to_words(text, boundaries, start, duration)

        pause = float(ln.get("pauseAfter", 0.22))
        pcm.extend(silence(pause))

        results.append({
            "id": ln.get("id", f"l{idx}"),
            "speaker": ln.get("speaker", "narrator"),
            "text": text,
            "start": round(start, 3),
            "end": round(start + duration, 3),
            "words": words,
            "provider": provider,
        })
        cursor += pause

    pcm.extend(silence(float(spec.get("tail", 0.6))))
    with wave.open(master, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SAMPLE_RATE)
        w.writeframes(bytes(pcm))

    total = len(pcm) / 2 / SAMPLE_RATE
    return {
        "masterAudioPath": master,
        "totalDurationSec": round(total, 3),
        "providers": sorted(providers_used),
        "lines": results,
    }


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python tts_worker.py <spec.json>")
        sys.exit(1)
    with open(sys.argv[1], "r", encoding="utf-8") as f:
        spec = json.load(f)
    result = asyncio.run(synthesize(spec))
    print(json.dumps(result, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
