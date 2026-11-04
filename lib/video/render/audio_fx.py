"""
Procedural sound design for reels (no external assets, no copyright issues).

  * SFX: pop, whoosh, boom (meme bass hit), rimshot (ba-dum-tss), ding
  * BGM: light Indian-flavoured loop — tanpura-style drone (Sa + Pa), dholak-style
    dha/na groove, shaker, Karplus-Strong plucks on a pentatonic (Bhupali-like) scale
  * Mixing: BGM auto-ducks under the voice; returns one mono 24 kHz track

If assets/music has files (or BGM_DIR), a random real track is used instead of the
generated one (still ducked).
"""

from __future__ import annotations

import math
import random
import subprocess
import wave

import numpy as np

SR = 24000


def _env(n, attack=0.005, decay=0.2):
    t = np.arange(n) / SR
    a = np.clip(t / max(attack, 1e-4), 0, 1)
    return a * np.exp(-t / max(decay, 1e-4))


def _onepole_lp(x, alpha):
    """alpha may be scalar or array (per-sample cutoff)."""
    y = np.zeros_like(x)
    acc = 0.0
    al = np.broadcast_to(alpha, x.shape)
    for i in range(len(x)):
        acc += al[i] * (x[i] - acc)
        y[i] = acc
    return y


def sfx_pop():
    n = int(0.09 * SR)
    t = np.arange(n) / SR
    f = 900 * np.exp(-t * 30) + 260
    return 0.55 * np.sin(2 * np.pi * np.cumsum(f) / SR) * _env(n, 0.002, 0.03)


def sfx_whoosh(dur=0.38):
    n = int(dur * SR)
    noise = np.random.uniform(-1, 1, n)
    sweep = np.linspace(0.02, 0.35, n) ** 1.2
    y = _onepole_lp(noise, sweep)
    env = np.sin(np.linspace(0, np.pi, n)) ** 2
    return 0.5 * y * env / (np.max(np.abs(y)) + 1e-6)


def sfx_boom():
    n = int(1.0 * SR)
    t = np.arange(n) / SR
    f = 95 * np.exp(-t * 3.2) + 38
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * _env(n, 0.003, 0.42)
    click = np.random.uniform(-1, 1, n) * _env(n, 0.0005, 0.012)
    return 0.95 * np.tanh(2.6 * body) + 0.25 * click


def _tom(freq, dur=0.22):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = freq * (1 + 0.6 * np.exp(-t * 25))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * _env(n, 0.001, 0.11)


def sfx_rimshot():
    out = np.zeros(int(1.4 * SR))

    def put(sig, at):
        i = int(at * SR)
        out[i:i + len(sig)] += sig[: len(out) - i]

    put(0.7 * _tom(210), 0.0)
    put(0.75 * _tom(150), 0.17)
    n = int(1.0 * SR)
    noise = np.random.uniform(-1, 1, n)
    hp = noise - _onepole_lp(noise, 0.35)
    put(0.45 * hp * _env(n, 0.001, 0.35), 0.40)
    put(0.6 * _tom(95, 0.3), 0.40)
    return out


def sfx_ding():
    n = int(1.1 * SR)
    t = np.arange(n) / SR
    y = np.sin(2 * np.pi * 1318 * t) + 0.5 * np.sin(2 * np.pi * 2636 * t) + 0.25 * np.sin(2 * np.pi * 3954 * t)
    return 0.32 * y * _env(n, 0.002, 0.35)


SFX = {"pop": sfx_pop, "whoosh": sfx_whoosh, "boom": sfx_boom, "rimshot": sfx_rimshot, "ding": sfx_ding}


# --------------------------------------------------------------------------- #
# Generated background music
# --------------------------------------------------------------------------- #

def _pluck(freq, dur, bright=0.5):
    n = int(dur * SR)
    period = max(2, int(SR / freq))
    buf = np.random.uniform(-1, 1, period)
    out = np.zeros(n)
    damp = 0.996 - 0.004 * (1 - bright)
    for i in range(n):
        j = i % period
        out[i] = buf[j]
        buf[j] = damp * 0.5 * (buf[j] + buf[(j + 1) % period])
    return out * _env(n, 0.002, dur * 0.6)


def _dha(dur=0.35):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 110 * np.exp(-t * 9) + 62
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * _env(n, 0.002, 0.16)


def _na(dur=0.18):
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = np.sin(2 * np.pi * 470 * t) + 0.4 * np.sin(2 * np.pi * 940 * t)
    y += 0.25 * np.random.uniform(-1, 1, n) * np.exp(-t * 90)
    return y * _env(n, 0.001, 0.05)


def _shaker(dur=0.06):
    n = int(dur * SR)
    noise = np.random.uniform(-1, 1, n)
    return (noise - _onepole_lp(noise, 0.5)) * _env(n, 0.003, 0.018)


def generate_bgm(total: float, mood: str = "comedy", seed: int = 1) -> np.ndarray:
    rng = random.Random(seed)
    np.random.seed(seed % (2 ** 31))
    bpm = {"comedy": 112, "guide": 96, "voiceover": 84}.get(mood, 100)
    beat = 60.0 / bpm
    n = int(total * SR) + SR
    out = np.zeros(n)
    t = np.arange(n) / SR

    root = rng.choice([138.6, 146.8, 155.6, 164.8])  # C#3..E3 as "Sa"
    # tanpura-like drone: Pa (fifth below octave) + Sa + Sa', slow swell, slight detune
    drone = np.zeros(n)
    for ratio, amp in ((0.75, 0.5), (1.0, 0.7), (2.0, 0.35)):
        f = root * ratio
        for h, ha in ((1, 1.0), (2, 0.45), (3, 0.25), (4, 0.12)):
            drone += amp * ha * np.sin(2 * np.pi * f * h * t * (1 + 0.0007 * h) + rng.random() * 6)
    swell = 0.6 + 0.4 * np.sin(2 * np.pi * t / (beat * 8))
    out += 0.05 * drone * swell

    def put(sig, at, gain):
        i = int(at * SR)
        if i >= n:
            return
        out[i:i + len(sig)] += gain * sig[: n - i]

    # dholak-ish keherwa groove (8 eighths): Dha Ge Na Ti | Na Ka Dhi Na
    pattern = ["D", "", "N", "n", "N", "", "D", "N"] if mood != "voiceover" else ["D", "", "", "", "N", "", "", ""]
    eighth = beat / 2
    dha, na, sh = _dha(), _na(), _shaker()
    steps = int(total / eighth) + 2
    for s in range(steps):
        at = s * eighth + (0.012 if s % 2 else 0.0)  # tiny swing
        p = pattern[s % 8]
        if p == "D":
            put(dha, at, 0.55)
        elif p == "N":
            put(na, at, 0.22)
        elif p == "n":
            put(na, at, 0.12)
        if mood != "voiceover":
            put(sh, at, 0.07)
            put(sh, at + eighth / 2, 0.04)

    # plucked melody on pentatonic Sa Re Ga Pa Dha (Bhupali-like)
    scale = [1.0, 9 / 8, 5 / 4, 3 / 2, 5 / 3, 2.0, 9 / 4]
    idx = 2
    for b in range(int(total / beat) + 1):
        if rng.random() < (0.55 if mood == "comedy" else 0.35):
            idx = max(0, min(len(scale) - 1, idx + rng.choice([-2, -1, 1, 1, 2])))
            f = root * 2 * scale[idx]
            put(_pluck(f, beat * 1.6, 0.7 if mood == "comedy" else 0.4), b * beat, 0.16)
    out = out[: int(total * SR)]
    # gentle fade in/out
    fi = min(len(out), int(1.0 * SR))
    out[:fi] *= np.linspace(0, 1, fi)
    fo = min(len(out), int(1.5 * SR))
    out[-fo:] *= np.linspace(1, 0, fo)
    return out / (np.max(np.abs(out)) + 1e-6)


def load_audio_file(path: str, ffmpeg: str, total: float) -> np.ndarray | None:
    try:
        raw = subprocess.run([ffmpeg, "-loglevel", "error", "-stream_loop", "-1", "-i", path, "-t", f"{total:.2f}",
                              "-ac", "1", "-ar", str(SR), "-f", "s16le", "-"], capture_output=True, check=True).stdout
        y = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
        return y / (np.max(np.abs(y)) + 1e-6)
    except Exception:
        return None


def read_wav(path: str) -> np.ndarray:
    with wave.open(path, "rb") as w:
        data = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0
        sr = w.getframerate()
    if sr != SR:
        idx = (np.arange(int(len(data) * SR / sr)) * sr / SR).astype(int)
        data = data[np.clip(idx, 0, len(data) - 1)]
    return data


def write_wav(path: str, y: np.ndarray):
    y = np.clip(y, -1, 1)
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((y * 32767).astype(np.int16).tobytes())


def build_mix(voice_path: str, out_path: str, total: float, events, mood: str, seed: int,
              bgm_file: str | None = None, ffmpeg: str = "ffmpeg", bgm_level: float = 0.13, sfx_level: float = 0.55):
    """events: [(time_sec, sfx_name, gain)]"""
    n = int(total * SR)
    voice = np.zeros(n)
    if voice_path:
        v = read_wav(voice_path)[:n]
        voice[: len(v)] = v
    # voice activity -> ducking gain
    win = int(0.05 * SR)
    act = np.sqrt(np.convolve(voice ** 2, np.ones(win) / win, mode="same"))
    act = act / (np.percentile(act, 95) + 1e-6)
    act = np.clip(act, 0, 1)
    smooth = np.convolve(act, np.ones(int(0.25 * SR)) / int(0.25 * SR), mode="same")
    duck = 1 - 0.62 * np.clip(smooth * 1.5, 0, 1)

    bgm = None
    if bgm_file:
        bgm = load_audio_file(bgm_file, ffmpeg, total)
    if bgm is None and mood != "none":
        bgm = generate_bgm(total, mood, seed)
    mix = voice.copy()
    if bgm is not None:
        b = np.zeros(n)
        b[: min(n, len(bgm))] = bgm[:n]
        mix += bgm_level * b * duck

    for at, name, gain in events:
        fn = SFX.get(name)
        if fn is None:
            continue
        sig = fn() * gain * sfx_level
        i = int(max(0.0, at) * SR)
        if i >= n:
            continue
        mix[i:i + len(sig)] += sig[: n - i]
    peak = np.max(np.abs(mix)) + 1e-6
    if peak > 0.98:
        mix = mix * (0.98 / peak)
    write_wav(out_path, mix)
    return out_path
