"""Cross-platform font + colour-emoji rendering. Drop .ttf files into assets/fonts/ to override."""

import os
import re
from functools import lru_cache
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))

CANDIDATES = {
    "heavy": [
        os.path.join(ROOT, "assets", "fonts", "heavy.ttf"),
        "C:/Windows/Fonts/seguibl.ttf",
        "C:/Windows/Fonts/impact.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/System/Library/Fonts/Supplemental/Arial Black.ttf",
    ],
    "bold": [
        os.path.join(ROOT, "assets", "fonts", "bold.ttf"),
        "C:/Windows/Fonts/segoeuib.ttf",
        "C:/Windows/Fonts/arialbd.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    ],
}

EMOJI_FONTS = [
    os.path.join(ROOT, "assets", "fonts", "emoji.ttf"),
    "C:/Windows/Fonts/seguiemj.ttf",
    "/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf",
    "/usr/share/fonts/noto/NotoColorEmoji.ttf",
    "/System/Library/Fonts/Apple Color Emoji.ttc",
]

EMOJI_RE = re.compile(
    "([\U0001F300-\U0001FAFF\U00002600-\U000027BF\U0001F1E6-\U0001F1FF\u2B50\u2B55\u203C\u2049\u2705\u274C\u2764]\uFE0F?)"
)


@lru_cache(maxsize=64)
def load_font(size: int, kind: str = "bold"):
    for path in CANDIDATES.get(kind, CANDIDATES["bold"]):
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return ImageFont.load_default(size)


@lru_cache(maxsize=1)
def _emoji_font():
    for p in EMOJI_FONTS:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, 109)
            except Exception:
                continue
    return None


@lru_cache(maxsize=256)
def emoji_image(ch: str, size: int):
    """RGBA image of a colour emoji scaled to `size` px tall (None if unavailable)."""
    f = _emoji_font()
    if f is None:
        return None
    ch = ch.replace("\uFE0F", "")
    img = Image.new("RGBA", (160, 160), (0, 0, 0, 0))
    try:
        ImageDraw.Draw(img).text((10, 10), ch, font=f, embedded_color=True)
    except Exception:
        return None
    bb = img.getbbox()
    if not bb:
        return None
    img = img.crop(bb)
    s = size / max(1, img.height)
    return img.resize((max(1, int(img.width * s)), max(1, int(img.height * s))), Image.LANCZOS)


def split_emoji(text: str):
    """[(is_emoji, chunk), ...]"""
    out = []
    for part in EMOJI_RE.split(text):
        if not part:
            continue
        out.append((bool(EMOJI_RE.fullmatch(part)), part))
    return out


def measure(draw, text, font, size):
    w = 0.0
    for is_e, chunk in split_emoji(text):
        if is_e:
            w += size * 1.05
        else:
            w += draw.textlength(chunk, font=font)
    return w


def draw_rich(img, xy, text, font, size, fill, stroke=0, stroke_fill=(0, 0, 0)):
    """Draw text that may contain colour emoji. Returns end x."""
    d = ImageDraw.Draw(img)
    x, y = xy
    for is_e, chunk in split_emoji(text):
        if is_e:
            em = emoji_image(chunk, int(size * 0.95))
            if em is not None:
                img.alpha_composite(em, (int(x + size * 0.05), int(y + size * 0.12))) if img.mode == "RGBA" \
                    else img.paste(em, (int(x + size * 0.05), int(y + size * 0.12)), em)
            x += size * 1.05
        else:
            d.text((x, y), chunk, font=font, fill=fill, stroke_width=stroke, stroke_fill=stroke_fill)
            x += d.textlength(chunk, font=font)
    return x
