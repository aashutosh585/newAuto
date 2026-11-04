"""
DinoMate Reel Renderer v2 — animated characters, Indian-reel editing style.

Modes
  guide      one presenter talks to camera (mentor / explainer)
  skit       2-3 characters act out a comedy dialogue
  voiceover  no characters: narrator voice over b-roll / animated background

v2 adds: letter-accurate visemes, word-beat head nods / brow raises / hand beats,
jump-cut close-ups with punch-in zoom, punchline shake, emoji reactions & emoji captions,
procedural SFX (rimshot, boom, whoosh, pop, ding) + ducked Indian-flavoured BGM.

Usage: python render_reel.py <render_spec.json>
"""

from __future__ import annotations

import os
import re
import sys
import json
import math
import time
import wave
import random
import subprocess

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from characters import render_character, hex_rgb, BASE_H, HEAD_CY  # noqa: E402
from scenes import build_set, PAD, W, H  # noqa: E402
from fonts import load_font, emoji_image, measure, draw_rich, split_emoji  # noqa: E402
import audio_fx  # noqa: E402

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass


def log(msg):
    sys.stderr.write(f"[Renderer] {msg}\n")
    sys.stderr.flush()


def ease_out_back(x):
    x = max(0.0, min(1.0, x))
    c1, c3 = 1.70158, 2.70158
    return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2


def ease_out(x):
    x = max(0.0, min(1.0, x))
    return 1 - (1 - x) ** 3


# --------------------------------------------------------------------------- #
# Audio analysis
# --------------------------------------------------------------------------- #

def audio_envelope(path, fps, total_frames):
    try:
        with wave.open(path, "rb") as w:
            sr = w.getframerate()
            data = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32)
    except Exception as e:
        log(f"envelope unavailable: {e}")
        return np.zeros(total_frames, dtype=np.float32)
    hop = sr / fps
    env = np.zeros(total_frames, dtype=np.float32)
    win = int(hop * 1.4)
    for i in range(total_frames):
        c = int(i * hop)
        seg = data[max(0, c - win // 2): c + win // 2]
        if seg.size:
            env[i] = math.sqrt(float(np.mean(seg * seg)))
    return env


def mouth_track(env, lines, fps):
    out = np.zeros_like(env)
    for ln in lines:
        a, b = int(ln["start"] * fps), int(ln["end"] * fps) + 1
        seg = env[a:b]
        if seg.size == 0:
            continue
        ref = float(np.percentile(seg, 90)) or 1.0
        out[a:b] = np.clip((seg / ref) ** 0.8, 0, 1)
    sm = np.zeros_like(out)
    v = 0.0
    for i, x in enumerate(out):
        v = v + (x - v) * (0.8 if x > v else 0.5)
        sm[i] = v
    return sm


# --------------------------------------------------------------------------- #
# Speech-derived animation signals
# --------------------------------------------------------------------------- #

def _clean(w):
    return re.sub(r"[^a-z]", "", w.lower())


def viseme_at(words, t):
    """Pick mouth shape from the letter being spoken right now."""
    for w in words:
        if w["start"] <= t <= w["end"]:
            letters = _clean(w["word"])
            if not letters:
                return "C"
            prog = (t - w["start"]) / max(0.01, w["end"] - w["start"])
            i = min(len(letters) - 1, int(prog * len(letters)))
            pair = letters[i:i + 2]
            if pair in ("aa", "ai", "ah"):
                return "A"
            if pair in ("ee", "ii"):
                return "E"
            if pair in ("oo", "ou", "uu"):
                return "U"
            ch = letters[i]
            if ch == "a":
                return "A"
            if ch in "eiy":
                return "E"
            if ch == "o":
                return "O"
            if ch in "uw":
                return "U"
            if ch in "mbp":
                return "M"
            if ch in "fv":
                return "F"
            return "C"
    return "X"


def stressed_onsets(words):
    out = []
    for i, w in enumerate(words):
        cw = _clean(w["word"])
        if i == 0 or len(cw) >= 5 or w["word"].endswith(("!", "?")) or any(ch.isdigit() for ch in w["word"]) \
                or (w["word"].isupper() and len(cw) > 1):
            out.append(w["start"])
    return out


def beat_at(onsets, t):
    b = 0.0
    for on in onsets:
        x = t - on
        if x < 0:
            break
        v = x / 0.07 if x < 0.07 else math.exp(-(x - 0.07) / 0.22)
        b = max(b, v)
    return min(1.0, b)


# --------------------------------------------------------------------------- #
# Text helpers
# --------------------------------------------------------------------------- #

def wrap(draw, text, font, size, max_w):
    words, lines, cur = text.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if measure(draw, t, font, size) <= max_w or not cur:
            cur = t
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def text_card(text, font_size, max_w, fg, bg, accent=None, radius=28, pad=(40, 26), tilt=0.0):
    font = load_font(font_size, "heavy")
    tmp = ImageDraw.Draw(Image.new("RGB", (10, 10)))
    lines = wrap(tmp, text, font, font_size, max_w - 2 * pad[0])[:4]
    lh = int(font_size * 1.2)
    tw = max(measure(tmp, l, font, font_size) for l in lines) if lines else 0
    cw, ch = int(tw + 2 * pad[0]), int(lh * len(lines) + 2 * pad[1])
    img = Image.new("RGBA", (cw + 20, ch + 20), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([14, 14, cw + 14, ch + 14], radius, fill=(0, 0, 0, 110))
    d.rounded_rectangle([4, 4, cw + 4, ch + 4], radius, fill=bg)
    if accent:
        d.rounded_rectangle([4, 4, 22, ch + 4], 8, fill=accent)
    for i, l in enumerate(lines):
        lw = measure(d, l, font, font_size)
        draw_rich(img, (4 + (cw - lw) / 2, 4 + pad[1] + i * lh), l, font, font_size, fg)
    if tilt:
        img = img.rotate(tilt, resample=Image.BICUBIC, expand=True)
    return img


def chunk_words(words, max_words=3, max_chars=18):
    chunks, cur = [], []
    for i, w in enumerate(words):
        if cur and (len(cur) >= max_words or len(" ".join(x["word"] for x in cur + [w])) > max_chars):
            chunks.append(cur)
            cur = []
        cur.append(dict(w, idx=i))
        if w["word"].endswith((".", "?", "!", ",")) and len(cur) >= 2:
            chunks.append(cur)
            cur = []
    if cur:
        chunks.append(cur)
    return chunks


_caption_cache = {}


def caption_image(chunk, active_idx, size, highlight, max_w, emoji=None):
    key = (tuple(w["word"] for w in chunk), active_idx, size, highlight, emoji)
    if key in _caption_cache:
        return _caption_cache[key]
    font = load_font(size, "heavy")
    tmp = ImageDraw.Draw(Image.new("RGB", (10, 10)))
    words = [w["word"].upper() for w in chunk]
    space = tmp.textlength(" ", font=font)
    widths = [tmp.textlength(w, font=font) for w in words]
    items = list(range(len(words)))
    if emoji:
        items.append(-1)
        widths.append(size * 1.1)
    lines, cur, cw = [], [], 0
    for i in items:
        wd = widths[i] if i >= 0 else widths[-1]
        if cur and cw + space + wd > max_w:
            lines.append(cur)
            cur, cw = [], 0
        cw += (space if cur else 0) + wd
        cur.append(i)
    if cur:
        lines.append(cur)
    lh = int(size * 1.15)
    stroke = max(6, size // 9)
    img_w = int(max_w + 2 * stroke + 40)
    img = Image.new("RGBA", (img_w, lh * len(lines) + 2 * stroke + 30), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for li, idxs in enumerate(lines):
        total = sum(widths[i] if i >= 0 else widths[-1] for i in idxs) + space * (len(idxs) - 1)
        x = (img_w - total) / 2
        y = stroke + 10 + li * lh
        for i in idxs:
            if i == -1:
                em = emoji_image(emoji, int(size * 1.0))
                if em is not None:
                    img.alpha_composite(em, (int(x), int(y + size * 0.05)))
                x += widths[-1] + space
                continue
            col = highlight if chunk[i]["idx"] == active_idx else (255, 255, 255)
            d.text((x + 5, y + 7), words[i], font=font, fill=(0, 0, 0, 150))
            d.text((x, y), words[i], font=font, fill=col, stroke_width=stroke, stroke_fill=(0, 0, 0))
            x += widths[i] + space
    if len(_caption_cache) > 500:
        _caption_cache.clear()
    _caption_cache[key] = img
    return img


def sfx_text_image(text, color):
    font = load_font(110, "heavy")
    tmp = ImageDraw.Draw(Image.new("RGB", (10, 10)))
    tw = tmp.textlength(text, font=font)
    w, h = int(tw + 160), 300
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx, cy = w / 2, h / 2
    pts = []
    for i in range(24):
        r = (w / 2 - 10) if i % 2 == 0 else (w / 2 - 50)
        ry = (h / 2 - 10) if i % 2 == 0 else (h / 2 - 50)
        a = i * math.pi / 12
        pts.append((cx + r * math.cos(a), cy + ry * math.sin(a)))
    d.polygon(pts, fill=color, outline=(0, 0, 0))
    d.text((cx - tw / 2, cy - 68), text, font=font, fill=(255, 255, 255), stroke_width=8, stroke_fill=(0, 0, 0))
    return img.rotate(random.uniform(-10, 10), resample=Image.BICUBIC, expand=True)


SFX_TEXT = {
    "haha": ("HAHAHA", (250, 204, 21)), "bruh": ("BRUH", (239, 68, 68)), "boom": ("BOOM!", (249, 115, 22)),
    "ding": ("DING!", (34, 197, 94)), "record_scratch": ("WAIT...", (168, 85, 247)), "wow": ("WOW", (56, 189, 248)),
    "oof": ("OOF", (244, 63, 94)), "facts": ("FACTS", (16, 185, 129)),
}
SFX_AUDIO = {"haha": "rimshot", "bruh": "boom", "boom": "boom", "ding": "ding", "record_scratch": "whoosh",
             "wow": "ding", "oof": "boom", "facts": "ding"}
REACTION_EMOJI = {"laughing": "😂", "shocked": "😳", "sad": "😢", "angry": "😤", "sarcastic": "🙄",
                  "thinking": "🤔", "happy": "😄", "confident": "😎"}


# --------------------------------------------------------------------------- #
# B-roll
# --------------------------------------------------------------------------- #

class BRoll:
    def __init__(self, paths):
        import cv2
        self.cv2 = cv2
        self.paths = [p for p in (paths or []) if os.path.exists(p)]
        self.caps = {}

    def frame(self, idx):
        if not self.paths:
            return None
        p = self.paths[idx % len(self.paths)]
        cap = self.caps.get(p)
        if cap is None:
            cap = self.cv2.VideoCapture(p)
            self.caps[p] = cap
        ok, fr = cap.read()
        if not ok:
            cap.set(self.cv2.CAP_PROP_POS_FRAMES, 0)
            ok, fr = cap.read()
            if not ok:
                return None
        h, w = fr.shape[:2]
        scale = max(W / w, H / h)
        fr = self.cv2.resize(fr, (int(w * scale) + 1, int(h * scale) + 1), interpolation=self.cv2.INTER_AREA)
        y0, x0 = (fr.shape[0] - H) // 2, (fr.shape[1] - W) // 2
        fr = self.cv2.cvtColor(fr[y0:y0 + H, x0:x0 + W], self.cv2.COLOR_BGR2RGB)
        return Image.fromarray((fr * 0.62).astype(np.uint8))


# --------------------------------------------------------------------------- #
# Shot planning (Indian reel editing: jump cuts + punch-ins)
# --------------------------------------------------------------------------- #

def plan_shots(lines, mode, n_chars):
    shots = []
    for i, ln in enumerate(lines):
        emo = ln.get("emotion", "neutral")
        if mode == "skit" and n_chars > 1:
            if i == 0:
                z = 1.0
            elif ln.get("punchline"):
                z = 1.34
            elif emo in ("shocked", "angry"):
                z = 1.4
            else:
                z = 1.24 if i % 2 == 1 else 1.0
        elif mode in ("guide", "skit"):
            z = 1.28 if ln.get("punchline") else (1.16 if i % 2 == 1 else 1.0)
        else:
            z = 1.0
        shake = bool(ln.get("punchline")) or emo in ("shocked", "angry")
        shots.append({"z": z, "shake": shake})
    return shots


# --------------------------------------------------------------------------- #
# Main render
# --------------------------------------------------------------------------- #

DEFAULT_TALK_GESTURES = ["explain", "both_explain", "count", "point_viewer", "explain", "shrug", "thumbs_up"]
REACTION_GESTURE = {"laughing": "laugh", "shocked": "shrug", "sad": "facepalm", "angry": "hands_on_hips",
                    "sarcastic": "cross", "thinking": "think", "happy": "idle", "confident": "cross"}


def render(spec):
    t0 = time.time()
    fps = int(spec.get("fps", 30))
    seed = int(spec.get("seed", 7))
    random.seed(seed)
    mode = spec.get("mode", "guide")
    lines = spec.get("lines", [])
    cast = {c["id"]: c for c in spec.get("cast", [])}
    total = float(spec.get("totalDuration") or (lines[-1]["end"] + 1.0 if lines else 5.0))
    n_frames = int(math.ceil(total * fps))
    brand = spec.get("brand", "dinomate.app")
    out_path = os.path.abspath(spec["output"])
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    ffmpeg = spec.get("ffmpeg") or "ffmpeg"

    set_name = spec.get("setting") or ("abstract" if mode == "voiceover" else "studio")
    bg_full, accent = build_set(set_name, seed, brand)
    accent = hex_rgb(spec["accent"]) if spec.get("accent") else accent
    highlight = hex_rgb(spec.get("captionHighlight", "#FACC15"))
    broll = BRoll(spec.get("broll")) if mode == "voiceover" else None

    env = audio_envelope(spec.get("audioPath", ""), fps, n_frames)
    mouth = mouth_track(env, lines, fps)
    onsets = [stressed_onsets(ln.get("words", [])) for ln in lines]

    def line_at(t):
        for i, ln in enumerate(lines):
            if ln["start"] - 0.05 <= t <= ln["end"]:
                return i, ln
        prev = -1
        for i, ln in enumerate(lines):
            if ln["start"] <= t:
                prev = i
        return prev, None

    speakers = [c for c in spec.get("cast", []) if any(l.get("speaker") == c["id"] for l in lines)]
    if mode == "guide":
        speakers = speakers[:1] or list(cast.values())[:1]
    elif mode == "voiceover":
        speakers = []
    n = len(speakers)
    if mode == "skit":
        px_h = {1: 1500, 2: 1240, 3: 1040}.get(n, 1040)
        xs = {1: [540], 2: [300, 780], 3: [200, 540, 880]}.get(n, [200, 540, 880])
        y_off = 70
    else:
        px_h, xs, y_off = 1500, [540], 20
    slot = {c["id"]: i for i, c in enumerate(speakers)}
    shots = plan_shots(lines, mode, n)

    # blink schedules (with occasional double blinks)
    blinks = {}
    for c in speakers:
        times, t = [], random.uniform(0.5, 2.0)
        while t < total:
            times.append(t)
            if random.random() < 0.2:
                times.append(t + 0.28)
            t += random.uniform(2.0, 4.8)
        blinks[c["id"]] = times

    def blink_amt(cid, t):
        for bt in blinks.get(cid, []):
            if bt <= t <= bt + 0.15:
                x = (t - bt) / 0.15
                return 1 - abs(2 * x - 1)
        return 0.0

    saccade = {c["id"]: [(random.uniform(0, total), random.uniform(-0.4, 0.4)) for _ in range(int(total / 1.4) + 1)]
               for c in speakers}

    def look_jitter(cid, t):
        v = 0.0
        for at, val in sorted(saccade.get(cid, [])):
            if at <= t:
                v = val
        return v

    # ---------- overlays ----------
    title = spec.get("title", "")
    title_img = text_card(title, 62 if len(title) < 50 else 54, 960, (255, 255, 255), (15, 23, 42, 235),
                          accent=accent + (255,)) if title else None
    point_cache = {}
    cta_text = spec.get("cta", f"Link in bio  >  {brand}")
    cta_img = text_card(cta_text, 52, 900, (15, 23, 42), highlight + (255,), radius=50)
    wm_font = load_font(34, "bold")

    # ---------- sound design events ----------
    events = []
    for i, ln in enumerate(lines):
        if ln.get("onScreen"):
            events.append((ln["start"], "pop", 0.7))
        if i > 0 and shots[i]["z"] != shots[i - 1]["z"]:
            events.append((ln["start"] - 0.12, "whoosh", 0.45))
        tag = ln.get("sfx")
        if tag in SFX_AUDIO:
            when = ln["end"] + 0.03 if SFX_AUDIO[tag] == "rimshot" else ln["start"]
            events.append((when, SFX_AUDIO[tag], 0.9))
        elif ln.get("punchline"):
            events.append((ln["end"] + 0.03, "rimshot" if mode == "skit" else "boom", 0.85))
        if mode == "skit" and ln.get("listenerReaction") in REACTION_EMOJI:
            events.append((ln["start"] + 0.4, "pop", 0.5))
    if lines:
        events.append((lines[-1]["start"], "ding", 0.6))
    mood = {"skit": "comedy", "guide": "guide", "voiceover": "voiceover"}.get(mode, "guide")
    if spec.get("music") == "none":
        mood = "none"
    mix_path = os.path.join(os.path.dirname(out_path), f".mix_{os.getpid()}_{seed}.wav")
    has_audio = bool(spec.get("audioPath") and os.path.exists(spec["audioPath"]))
    try:
        audio_fx.build_mix(spec.get("audioPath") if has_audio else "", mix_path, total, events, mood, seed,
                           bgm_file=spec.get("bgmPath"), ffmpeg=ffmpeg,
                           bgm_level=float(spec.get("bgmVolume", 0.13)))
        audio_in = mix_path
    except Exception as e:
        log(f"sound design failed ({e}); using raw voice")
        audio_in = spec.get("audioPath") if has_audio else None

    cmd = [ffmpeg, "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
           "-r", str(fps), "-i", "-"]
    if audio_in:
        cmd += ["-i", audio_in, "-af", "loudnorm=I=-14:TP=-1.5", "-map", "0:v", "-map", "1:a"]
    cmd += ["-c:v", "libx264", "-preset", spec.get("preset", "veryfast"), "-crf", "20", "-pix_fmt", "yuv420p",
            "-movflags", "+faststart"]
    if audio_in:
        cmd += ["-c:a", "aac", "-b:a", "192k", "-ar", "44100"]
    cmd += ["-t", f"{total:.3f}", out_path]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=subprocess.PIPE)

    gest_state = {c["id"]: {"g": "idle", "prev": "idle", "since": 0.0} for c in speakers}
    sfx_cache = {}
    bg_cache = {}

    try:
        for f in range(n_frames):
            t = f / fps
            li, ln = line_at(t)
            active = ln["speaker"] if ln else None
            ctx = lines[li] if li >= 0 else None
            shot = shots[li] if li >= 0 else {"z": 1.0, "shake": False}

            # ---------- camera ----------
            z = shot["z"]  # hard jump cuts (desi reel editing) — also keeps character caches small
            focus_slot = slot.get(active if active else (ctx or {}).get("speaker"), 0)
            fx = xs[focus_slot] if xs and n else 540
            head_y1 = (H - px_h + y_off) + HEAD_CY * px_h / BASE_H
            fy = head_y1 if n else 960
            shx = shy = 0
            if ctx and shot["shake"] and 0 <= t - ctx["start"] <= 0.35:
                amp = 14 * (1 - (t - ctx["start"]) / 0.35)
                shx, shy = random.uniform(-amp, amp), random.uniform(-amp, amp)
            drift_x = math.sin(t * 0.35) * 18
            drift_y = math.cos(t * 0.27) * 14

            # ---------- background ----------
            frame = broll.frame(max(0, li)) if broll else None
            if frame is None:
                cx0 = PAD + drift_x + fx - fx / z + shx / z
                cy0 = PAD + drift_y + fy - fy / z + shy / z
                if z == 1.0:
                    frame = bg_full.crop((int(cx0), int(cy0), int(cx0) + W, int(cy0) + H))
                else:
                    key = (z, int(cx0) // 3, int(cy0) // 3)
                    frame = bg_cache.get(key)
                    if frame is None:
                        frame = bg_full.resize((W, H), Image.BILINEAR, box=(cx0, cy0, cx0 + W / z, cy0 + H / z))
                        if len(bg_cache) > 60:
                            bg_cache.clear()
                        bg_cache[key] = frame
                    frame = frame.copy()

            # ---------- characters ----------
            order = sorted(speakers, key=lambda c: 1 if c["id"] == active else 0)  # speaker drawn last (in front)
            for c in order:
                cid = c["id"]
                i = slot[cid]
                speaking = active == cid
                st = gest_state[cid]
                beat = beat_at(onsets[li], t) if (speaking and li >= 0) else 0.0
                if speaking:
                    emo = ln.get("emotion", "neutral")
                    g = ln.get("gesture") or DEFAULT_TALK_GESTURES[li % len(DEFAULT_TALK_GESTURES)]
                    m = float(mouth[f])
                    vis = viseme_at(ln.get("words", []), t)
                    look = 0.0
                    if mode == "skit" and n > 1 and int(t * 0.8) % 3:
                        look = 1.0 if xs[i] < 540 else -1.0
                    look += look_jitter(cid, t) * 0.5
                    tilt = 2.5 * math.sin(t * 1.4 + i) + 2.0 * beat
                    nod = 10 * beat
                    brow = beat
                else:
                    react = (ctx or {}).get("listenerReaction") or "neutral"
                    emo = react
                    g = REACTION_GESTURE.get(react, "idle")
                    m = 0.55 if react == "laughing" else 0.0
                    vis = "A" if react == "laughing" else "M"
                    look = (1.0 if (active in slot and xs[slot[active]] > xs[i]) else -1.0) if active in slot else 0.0
                    look += look_jitter(cid, t) * 0.3
                    sp_beat = beat_at(onsets[li], t) if (li >= 0 and active in slot) else 0.0
                    tilt = 2.0 * math.sin(t * 0.9 + i * 2)
                    nod = 4 * sp_beat if react in ("neutral", "thinking", "happy", "confident") else 0
                    brow = 0
                    beat = 0
                if st["g"] != g:
                    st["prev"], st["g"], st["since"] = st["g"], g, t
                blend = (t - st["since"]) / 0.32
                scale = 1.0 if (speaking or mode != "skit") else 0.95
                ph = int(px_h * scale * z)
                char = render_character(c, mouth=m, viseme=vis, blink=blink_amt(cid, t), emotion=emo, gesture=g,
                                        phase=t - st["since"], beat=beat, brow=brow, tilt=tilt, look=look, px_h=ph,
                                        prev_gesture=st["prev"], blend=blend, nod=nod)
                bob = (5 * m if speaking else 0) + 3 * math.sin(t * 2.1 + i)
                sway = 5 * math.sin(t * 0.7 + i * 1.7)
                x1 = xs[i] + sway + drift_x * 0.4 - (px_h * scale * 1000 / 1400) / 2
                y1 = H - px_h * scale + y_off + bob + (1 - scale) * 400
                X = fx + (x1 - fx) * z + shx
                Y = fy + (y1 - fy) * z + shy
                frame.paste(char, (int(X), int(Y)), char)

                # reaction emoji above listener
                if not speaking and mode == "skit" and ctx and ctx.get("listenerReaction") in REACTION_EMOJI:
                    dt = t - ctx["start"] - 0.4
                    if 0 <= dt <= ctx["end"] - ctx["start"] + 0.3:
                        em = emoji_image(REACTION_EMOJI[ctx["listenerReaction"]], 120)
                        if em is not None:
                            k = ease_out_back(min(1.0, dt / 0.25))
                            if k > 0.05:
                                e2 = em.resize((max(1, int(em.width * k)), max(1, int(em.height * k))), Image.BILINEAR)
                                hx = fx + (xs[i] + 150 - fx) * z
                                hy = fy + (y1 + 120 * px_h / 1400 - fy) * z - 10 * math.sin(t * 6)
                                frame.paste(e2, (int(hx - e2.width / 2), int(hy - e2.height / 2)), e2)

            # guide: line emoji pops beside presenter on punchlines
            if mode == "guide" and ln and ln.get("emoji") and (ln.get("punchline") or ln.get("emotion") in ("laughing", "shocked")):
                dt = t - ln["start"]
                if 0 <= dt <= 1.4:
                    em = emoji_image(ln["emoji"], 150)
                    if em is not None:
                        k = ease_out_back(min(1.0, dt / 0.25))
                        e2 = em.resize((max(1, int(em.width * k)), max(1, int(em.height * k))), Image.BILINEAR)
                        frame.paste(e2, (int(820 - e2.width / 2), int(820 - e2.height / 2 - 8 * math.sin(t * 6))), e2)

            draw = ImageDraw.Draw(frame)

            # ---------- title ----------
            if title_img is not None:
                a = ease_out_back(min(1.0, t / 0.45))
                ty = int(-title_img.height + (130 + title_img.height) * a)
                frame.paste(title_img, ((W - title_img.width) // 2, ty), title_img)

            # ---------- sticker card ----------
            on_line = None
            for j in range(li, -1, -1):
                if j < len(lines) and lines[j].get("onScreen"):
                    on_line = (j, lines[j])
                    break
            if on_line:
                j, ol = on_line
                if t <= ol["end"] + 2.5 or j == li:
                    if j not in point_cache:
                        style = j % 3
                        bgc = [highlight + (255,), (255, 255, 255, 255), accent + (255,)][style]
                        fgc = (15, 23, 42) if style < 2 else (255, 255, 255)
                        point_cache[j] = text_card(ol["onScreen"], 64 if mode != "voiceover" else 76, 920, fgc,
                                                   bgc, radius=24, tilt=[-2.5, 2.0, -1.5][style])
                    pc = point_cache[j]
                    k = ease_out_back(min(1.0, (t - ol["start"]) / 0.3))
                    if k > 0.02:
                        pw, ph_ = max(1, int(pc.width * k)), max(1, int(pc.height * k))
                        img = pc.resize((pw, ph_), Image.BILINEAR) if k != 1 else pc
                        py = 400 if mode != "voiceover" else 420
                        if title_img is not None:
                            py = max(py, 130 + title_img.height + 30)
                        frame.paste(img, ((W - pw) // 2, py + (pc.height - ph_) // 2), img)

            # ---------- karaoke captions ----------
            if ln and ln.get("words"):
                chunks = chunk_words(ln["words"], 3 if mode != "voiceover" else 4)
                cur_chunk, active_idx = chunks[0], -1
                for ch_ in chunks:
                    if t >= ch_[0]["start"] - 0.05:
                        cur_chunk = ch_
                for wi, w in enumerate(ln["words"]):
                    if w["start"] <= t:
                        active_idx = wi
                size = 96 if mode == "voiceover" else 84
                emo_ch = ln.get("emoji") if cur_chunk is chunks[-1] else None
                cap = caption_image(cur_chunk, active_idx, size, highlight, 940, emo_ch)
                k = ease_out_back(min(1.0, (t - cur_chunk[0]["start"] + 0.05) / 0.16))
                if k < 0.999:
                    cap = cap.resize((max(1, int(cap.width * (0.85 + 0.15 * k))),
                                      max(1, int(cap.height * (0.85 + 0.15 * k)))), Image.BILINEAR)
                cy = {"guide": 1520, "skit": 760, "voiceover": 1000}.get(mode, 1500)
                frame.paste(cap, ((W - cap.width) // 2, cy - cap.height // 2), cap)
                if mode == "skit" and active in cast:
                    name = cast[active].get("name", "")
                    if name:
                        nf = load_font(40, "heavy")
                        nw = draw.textlength(name, font=nf)
                        col = hex_rgb(cast[active].get("shirt", "#2563EB"))
                        px0 = (W - nw) / 2 - 24
                        py0 = cy - cap.height // 2 - 60
                        draw.rounded_rectangle([px0, py0, px0 + nw + 48, py0 + 58], 29, fill=col,
                                               outline=(255, 255, 255), width=4)
                        draw.text((px0 + 24, py0 + 6), name, font=nf, fill=(255, 255, 255))

            # ---------- SFX text burst ----------
            if ctx and ctx.get("sfx") in SFX_TEXT:
                st0 = ctx["end"] - 0.2 if ctx.get("sfx") in ("haha", "oof", "bruh") else ctx["start"]
                dt = t - st0
                if 0 <= dt <= 1.0:
                    if li not in sfx_cache:
                        txt, col = SFX_TEXT[ctx["sfx"]]
                        sfx_cache[li] = sfx_text_image(txt, col)
                    s_img = sfx_cache[li]
                    k = ease_out_back(min(1.0, dt / 0.2)) * (1 if dt < 0.8 else max(0, (1.0 - dt) / 0.2))
                    if k > 0.05:
                        img = s_img.resize((max(1, int(s_img.width * k * 0.8)), max(1, int(s_img.height * k * 0.8))),
                                           Image.BILINEAR)
                        sx = 540 if not (mode == "skit" and ctx.get("speaker") in slot) else xs[slot[ctx["speaker"]]]
                        frame.paste(img, (int(sx - img.width / 2), 1000 - img.height // 2), img)

            # ---------- CTA ----------
            last = lines[-1] if lines else None
            if last and t >= last["start"]:
                k = ease_out_back(min(1.0, (t - last["start"]) / 0.35))
                pulse = 1 + 0.04 * math.sin(t * 8)
                cw_, ch_ = max(1, int(cta_img.width * k * pulse)), max(1, int(cta_img.height * k * pulse))
                img = cta_img.resize((cw_, ch_), Image.BILINEAR)
                frame.paste(img, ((W - cw_) // 2, 1760 - ch_ // 2), img)

            draw.text((W - 40 - draw.textlength(f"@{brand}", font=wm_font), 56), f"@{brand}", font=wm_font,
                      fill=(255, 255, 255), stroke_width=3, stroke_fill=(0, 0, 0))
            draw.rectangle([0, H - 12, int(W * (t / total)), H], fill=accent)

            proc.stdin.write(frame.tobytes())
    finally:
        try:
            proc.stdin.close()
        except Exception:
            pass
        err = proc.stderr.read().decode("utf-8", "ignore")
        code = proc.wait()
        try:
            if os.path.exists(mix_path):
                os.remove(mix_path)
        except Exception:
            pass
    if code != 0:
        raise RuntimeError(f"ffmpeg failed ({code}): {err[-800:]}")
    log(f"rendered {n_frames} frames in {time.time() - t0:.1f}s")
    return {"output": out_path, "durationSec": round(total, 2), "frames": n_frames, "fps": fps,
            "width": W, "height": H, "hasAudio": bool(audio_in)}


def main():
    if len(sys.argv) < 2:
        print("Usage: python render_reel.py <render_spec.json>")
        sys.exit(1)
    with open(sys.argv[1], "r", encoding="utf-8") as f:
        spec = json.load(f)
    print(json.dumps(render(spec)), flush=True)


if __name__ == "__main__":
    main()
