"""
Procedural 2D human characters (polished "explainer animation" style), Pillow only.

v2 realism upgrades
  * soft volumetric shading on face, hair, neck, clothes and limbs
  * egg-shaped head with tapered jaw, nose with bridge/nostrils, ears with detail
  * almond eyes with lids, crease, lashes, iris ring + highlights; tapered arched brows
  * real lips (cupid's bow) and VISEMES (A/E/O/U/M/F/C/X) for letter-accurate lip-sync
  * articulated hands with fingers: open / relaxed / point / fist / thumbs_up
  * tapered arms with proper sleeves & cuffs
  * beat-driven gestures (hands move on stressed words instead of looping sine waves)
  * Indian touches: earrings, bindi, stubble / moustache, kurta

Layer caching keeps it fast:
  torso (per lift) + arm sprites (per quantised hand target) + head (static base & front
  cached per character; only expressive features are redrawn per state).
"""

from __future__ import annotations

import math
from functools import lru_cache
from PIL import Image, ImageDraw, ImageChops, ImageFilter

BASE_W, BASE_H = 1000, 1400
SS = 2

HEAD_CX, HEAD_CY = 500, 565
HEAD_RX, HEAD_RY = 182, 224
SHOULDER_L, SHOULDER_R = (292, 960), (708, 960)
UPPER_ARM, FOREARM = 230, 215
TORSO_TOP = 900

HEAD_BOX = (230, 140, 770, 900)  # unit-space region of the head layer


# --------------------------------------------------------------------------- #
# Colour utilities
# --------------------------------------------------------------------------- #

def hex_rgb(h: str):
    h = h.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def mix(a, b, t: float):
    return tuple(int(x + (y - x) * t) for x, y in zip(a, b))


def shade(rgb, f: float):
    if f <= 1:
        return tuple(max(0, int(c * f)) for c in rgb)
    return tuple(min(255, int(c + (255 - c) * (f - 1))) for c in rgb)


def bez(p0, p1, p2, n=14):
    out = []
    for i in range(n + 1):
        t = i / n
        a, b, c = (1 - t) ** 2, 2 * (1 - t) * t, t * t
        out.append((a * p0[0] + b * p1[0] + c * p2[0], a * p0[1] + b * p1[1] + c * p2[1]))
    return out


# --------------------------------------------------------------------------- #
# Painter
# --------------------------------------------------------------------------- #

class Painter:
    def __init__(self, img: Image.Image, k: float, ox: float = 0, oy: float = 0):
        self.img = img
        self.d = ImageDraw.Draw(img)
        self.k, self.ox, self.oy = k, ox, oy

    def p(self, x, y):
        return ((x - self.ox) * self.k, (y - self.oy) * self.k)

    def w(self, v):
        return max(1, int(round(v * self.k)))

    def ellipse(self, cx, cy, rx, ry, fill=None, outline=None, width=0):
        x0, y0 = self.p(cx - rx, cy - ry)
        x1, y1 = self.p(cx + rx, cy + ry)
        if x1 <= x0 or y1 <= y0:
            return
        self.d.ellipse([x0, y0, x1, y1], fill=fill, outline=outline, width=self.w(width) if width else 0)

    def chord(self, cx, cy, rx, ry, start, end, fill=None, outline=None, width=0):
        x0, y0 = self.p(cx - rx, cy - ry)
        x1, y1 = self.p(cx + rx, cy + ry)
        if x1 <= x0 or y1 <= y0:
            return
        self.d.chord([x0, y0, x1, y1], start, end, fill=fill, outline=outline, width=self.w(width) if width else 0)

    def arc(self, cx, cy, rx, ry, start, end, fill, width):
        x0, y0 = self.p(cx - rx, cy - ry)
        x1, y1 = self.p(cx + rx, cy + ry)
        if x1 <= x0 or y1 <= y0:
            return
        self.d.arc([x0, y0, x1, y1], start, end, fill=fill, width=self.w(width))

    def poly(self, pts, fill=None, outline=None, width=0):
        if len(pts) < 3:
            return
        self.d.polygon([self.p(x, y) for x, y in pts], fill=fill, outline=outline,
                       width=self.w(width) if width else 1)

    def line(self, pts, fill, width):
        self.d.line([self.p(x, y) for x, y in pts], fill=fill, width=self.w(width), joint="curve")

    def rrect(self, x0, y0, x1, y1, r, fill=None, outline=None, width=0):
        self.d.rounded_rectangle([*self.p(x0, y0), *self.p(x1, y1)], radius=int(r * self.k),
                                 fill=fill, outline=outline, width=self.w(width) if width else 0)

    def limb(self, a, b, ra, rb, fill):
        """Tapered limb segment (two circles + tangent quad)."""
        dx, dy = b[0] - a[0], b[1] - a[1]
        L = math.hypot(dx, dy) or 1.0
        nx, ny = -dy / L, dx / L
        self.poly([(a[0] + nx * ra, a[1] + ny * ra), (b[0] + nx * rb, b[1] + ny * rb),
                   (b[0] - nx * rb, b[1] - ny * rb), (a[0] - nx * ra, a[1] - ny * ra)], fill=fill)
        self.ellipse(a[0], a[1], ra, ra, fill=fill)
        self.ellipse(b[0], b[1], rb, rb, fill=fill)


def soft_shade(img: Image.Image, mask: Image.Image, color, dx, dy, blur, alpha):
    """Tint the rim of `mask` on the side opposite to the (dx,dy) shift — fake volume."""
    # work at 1/4 resolution: blur cost drops ~16x, result is soft anyway
    q = 4
    small = mask.resize((max(1, mask.width // q), max(1, mask.height // q)), Image.BILINEAR)
    shifted = ImageChops.offset(small, int(dx / q), int(dy / q))
    rim = ImageChops.subtract(small, shifted).filter(ImageFilter.GaussianBlur(max(1, blur / q)))
    rim = rim.resize(mask.size, Image.BILINEAR)
    rim = ImageChops.multiply(rim, mask).point(lambda v: int(v * alpha))
    img.paste(Image.new("RGBA", img.size, tuple(color) + (255,)), (0, 0), rim)


def glow_spot(img, mask, P: Painter, cx, cy, rx, ry, color, blur, alpha):
    q = 4
    spot = Image.new("L", (max(1, img.width // q), max(1, img.height // q)), 0)
    Painter(spot, P.k / q, P.ox, P.oy).ellipse(cx, cy, rx, ry, fill=255)
    spot = spot.filter(ImageFilter.GaussianBlur(max(1, blur / q))).resize(img.size, Image.BILINEAR)
    spot = ImageChops.multiply(spot, mask).point(lambda v: int(v * alpha))
    img.paste(Image.new("RGBA", img.size, tuple(color) + (255,)), (0, 0), spot)


# --------------------------------------------------------------------------- #
# Spec
# --------------------------------------------------------------------------- #

class CharacterSpec:
    def __init__(self, d: dict):
        self.id = d.get("id", "char")
        self.gender = d.get("gender", "m")
        self.skin = hex_rgb(d.get("skin", "#C68642"))
        self.hair = hex_rgb(d.get("hair", "#1B1B1B"))
        self.hair_style = d.get("hairStyle", "short")
        self.shirt = hex_rgb(d.get("shirt", "#2563EB"))
        self.shirt_style = d.get("shirtStyle", "tshirt")
        self.accessory = d.get("accessory", "none")
        self.iris = hex_rgb(d.get("iris", "#3B2314"))
        self.lip = hex_rgb(d.get("lip", "#9A4A44" if self.gender == "m" else "#B4475A"))
        self.earrings = bool(d.get("earrings", self.gender == "f"))
        fh = d.get("facialHair")
        if not fh:
            fh = "beard" if self.accessory == "beard" else ("stubble" if self.gender == "m" else "none")
        self.facial_hair = fh


def head_outline(c: CharacterSpec, n=80):
    taper = 0.24 if c.gender == "f" else 0.15
    pts = []
    for i in range(n):
        t = 2 * math.pi * i / n
        s = math.sin(t)
        lower = max(0.0, s)
        x = HEAD_CX + HEAD_RX * math.cos(t) * (1 - taper * lower ** 1.6)
        y = HEAD_CY + HEAD_RY * s * (1 + 0.05 * lower)
        pts.append((x, y))
    return pts


# --------------------------------------------------------------------------- #
# Hair
# --------------------------------------------------------------------------- #

def _back_hair(P: Painter, c: CharacterSpec, col):
    st = c.hair_style
    if st in ("long", "ponytail"):
        P.ellipse(HEAD_CX, HEAD_CY - 30, HEAD_RX + 28, HEAD_RY + 6, fill=col)
        if st == "long":
            for side in (-1, 1):
                xa = HEAD_CX + side * (HEAD_RX + 30)
                xb = HEAD_CX + side * (HEAD_RX - 80)
                P.rrect(min(xa, xb), HEAD_CY - 60, max(xa, xb), HEAD_CY + 300, 70, fill=col)
        else:
            P.ellipse(HEAD_CX + HEAD_RX + 10, HEAD_CY - 40, 60, 120, fill=col)
    elif st == "curly":
        for i in range(12):
            a = math.pi + i * math.pi / 11
            P.ellipse(HEAD_CX + (HEAD_RX + 14) * math.cos(a), HEAD_CY - 20 + (HEAD_RY + 6) * math.sin(a), 64, 64, fill=col)
    elif st == "bald":
        return
    else:
        P.ellipse(HEAD_CX, HEAD_CY - 42, HEAD_RX + 12, HEAD_RY - 6, fill=col)
    if st == "bun":
        P.ellipse(HEAD_CX, HEAD_CY - HEAD_RY - 48, 82, 72, fill=col)


def _hair_cap(P: Painter, col, rx_extra=12, dip=110, temple_y=-40):
    """Top-of-head hair mass with a natural curved hairline (forehead visible)."""
    cy, rx, ry = HEAD_CY - 46, HEAD_RX + rx_extra, HEAD_RY - 26
    outer = [(HEAD_CX + rx * math.cos(math.radians(a)), cy + ry * math.sin(math.radians(a))) for a in range(180, 361, 6)]
    hairline = bez((HEAD_CX + HEAD_RX + 2, HEAD_CY + temple_y), (HEAD_CX, HEAD_CY - dip - 60),
                   (HEAD_CX - HEAD_RX - 2, HEAD_CY + temple_y), 16)
    P.poly(outer + hairline, fill=col)


def _front_hair(P: Painter, c: CharacterSpec, col):
    st = c.hair_style
    top = HEAD_CY - HEAD_RY
    if st == "spiky":
        P.chord(HEAD_CX, HEAD_CY - 52, HEAD_RX + 10, HEAD_RY - 40, 180, 360, fill=col)
        spikes = []
        for i in range(8):
            x0 = HEAD_CX - HEAD_RX + i * (2 * HEAD_RX) / 8
            x1 = x0 + (2 * HEAD_RX) / 8
            spikes += [(x0, top + 70), ((x0 + x1) / 2 + 12, top - 40 - (i % 3) * 16), (x1, top + 70)]
        P.poly([(HEAD_CX - HEAD_RX, top + 90)] + spikes + [(HEAD_CX + HEAD_RX, top + 90)], fill=col)
        P.poly([(HEAD_CX - HEAD_RX + 6, HEAD_CY - 70), (HEAD_CX - 40, top + 82), (HEAD_CX + 60, top + 96),
                (HEAD_CX + HEAD_RX - 6, HEAD_CY - 72), (HEAD_CX + HEAD_RX, HEAD_CY - 122),
                (HEAD_CX - HEAD_RX, HEAD_CY - 122)], fill=col)
    elif st in ("long", "ponytail", "bun"):
        _hair_cap(P, col, 16, 120, -30)
        left = bez((HEAD_CX - 10, top + 18), (HEAD_CX - 120, top + 40), (HEAD_CX - HEAD_RX - 8, HEAD_CY + 10))
        right = bez((HEAD_CX - 10, top + 18), (HEAD_CX + 110, top + 50), (HEAD_CX + HEAD_RX + 8, HEAD_CY - 10))
        P.poly([(HEAD_CX - HEAD_RX - 14, HEAD_CY - 120)] + left +
               [(HEAD_CX - HEAD_RX + 26, HEAD_CY + 20), (HEAD_CX - 100, HEAD_CY - 120)], fill=col)
        P.poly([(HEAD_CX + HEAD_RX + 14, HEAD_CY - 120)] + right +
               [(HEAD_CX + HEAD_RX - 26, HEAD_CY + 10), (HEAD_CX + 90, HEAD_CY - 125)], fill=col)
        if st == "long":
            for side in (-1, 1):
                P.poly([(HEAD_CX + side * (HEAD_RX + 14), HEAD_CY - 60), (HEAD_CX + side * (HEAD_RX - 12), HEAD_CY - 50),
                        (HEAD_CX + side * (HEAD_RX - 4), HEAD_CY + 140), (HEAD_CX + side * (HEAD_RX + 20), HEAD_CY + 170)],
                       fill=col)
    elif st == "curly":
        for i in range(9):
            x = HEAD_CX - HEAD_RX + 22 + i * (2 * HEAD_RX - 44) / 8
            P.ellipse(x, top + 46 + (12 if i % 2 else 0), 52, 48, fill=col)
    elif st == "bald":
        return
    else:  # short with side part
        _hair_cap(P, col, 12, 96, -50)
        sweep = bez((HEAD_CX - 60, top + 22), (HEAD_CX + 60, top + 30), (HEAD_CX + HEAD_RX + 6, HEAD_CY - 72))
        P.poly([(HEAD_CX - HEAD_RX - 6, HEAD_CY - 52), (HEAD_CX - HEAD_RX + 30, top + 60)] + sweep +
               [(HEAD_CX + HEAD_RX - 30, HEAD_CY - 112), (HEAD_CX + 10, HEAD_CY - 138),
                (HEAD_CX - 90, HEAD_CY - 128), (HEAD_CX - HEAD_RX + 22, HEAD_CY - 56)], fill=col)
        for side in (-1, 1):  # sideburns
            P.rrect(HEAD_CX + side * (HEAD_RX - 6) - 14, HEAD_CY - 90, HEAD_CX + side * (HEAD_RX - 6) + 14,
                    HEAD_CY + 10, 10, fill=col)


def _hair_layer(c, k, which, size):
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    mask = Image.new("L", size, 0)
    P = Painter(img, k, HEAD_BOX[0], HEAD_BOX[1])
    M = Painter(mask, k, HEAD_BOX[0], HEAD_BOX[1])
    fn = _back_hair if which == "back" else _front_hair
    fn(P, c, c.hair)
    fn(M, c, 255)
    if mask.getbbox() is None:
        return img
    soft_shade(img, mask, shade(c.hair, 0.55), -10 * k, -14 * k, 14 * k, 0.8)
    soft_shade(img, mask, shade(c.hair, 1.9), 8 * k, 14 * k, 10 * k, 0.45)
    if which == "front" and c.hair_style not in ("curly", "bald", "spiky"):
        P.arc(HEAD_CX + 20, HEAD_CY - 112, 120, 70, 210, 300, fill=shade(c.hair, 1.6), width=6)
        P.arc(HEAD_CX - 30, HEAD_CY - 100, 90, 60, 215, 285, fill=shade(c.hair, 1.35), width=4)
        strand = shade(c.hair, 0.6)
        for i in range(5):
            P.arc(HEAD_CX - 120 + i * 55, HEAD_CY - 150, 70, 60, 235, 285, fill=strand, width=2)
    img.putalpha(ImageChops.multiply(img.getchannel("A"), mask))
    return img


# --------------------------------------------------------------------------- #
# Static head layers (per character) — face with shading, ears, nose, hair
# --------------------------------------------------------------------------- #

@lru_cache(maxsize=64)
def _head_static(c_items, px_h):
    c = CharacterSpec(dict(c_items))
    k = px_h / BASE_H * SS
    size = (int((HEAD_BOX[2] - HEAD_BOX[0]) * k), int((HEAD_BOX[3] - HEAD_BOX[1]) * k))
    back = Image.new("RGBA", size, (0, 0, 0, 0))
    P = Painter(back, k, HEAD_BOX[0], HEAD_BOX[1])
    skin = c.skin
    sk_d, sk_dd, sk_l = shade(skin, 0.82), shade(skin, 0.68), shade(skin, 1.18)

    back.alpha_composite(_hair_layer(c, k, "back", size))

    for side in (-1, 1):  # ears
        ex = HEAD_CX + side * (HEAD_RX - 10)
        P.ellipse(ex, HEAD_CY + 34, 36, 52, fill=sk_d)
        P.ellipse(ex + side * 3, HEAD_CY + 34, 26, 40, fill=skin)
        P.ellipse(ex + side * 6, HEAD_CY + 34, 12, 24, fill=sk_dd)
        P.ellipse(ex + side * 3, HEAD_CY + 38, 10, 18, fill=skin)
        if c.earrings:
            P.ellipse(ex + side * 4, HEAD_CY + 96, 9, 9, fill=(212, 160, 23))
            P.chord(ex + side * 4, HEAD_CY + 112, 16, 18, 0, 180, fill=(234, 179, 8))

    face_mask = Image.new("L", size, 0)
    outline = head_outline(c)
    Painter(face_mask, k, HEAD_BOX[0], HEAD_BOX[1]).poly(outline, fill=255)
    P.poly(outline, fill=skin)
    soft_shade(back, face_mask, sk_d, -18 * k, -10 * k, 26 * k, 0.75)
    glow_spot(back, face_mask, P, HEAD_CX - 50, HEAD_CY - 100, 110, 70, sk_l, 30 * k, 0.55)
    for side in (-1, 1):
        glow_spot(back, face_mask, P, HEAD_CX + side * 95, HEAD_CY + 60, 46, 26, sk_l, 16 * k, 0.35)
    glow_spot(back, face_mask, P, HEAD_CX, HEAD_CY + 220, 120, 40, sk_dd, 24 * k, 0.45)

    if c.facial_hair in ("stubble", "beard", "moustache"):
        fh = mix(skin, c.hair, 0.5 if c.facial_hair == "stubble" else 0.85)
        lay = Image.new("RGBA", size, (0, 0, 0, 0))
        L = Painter(lay, k, HEAD_BOX[0], HEAD_BOX[1])
        if c.facial_hair in ("stubble", "beard"):
            jaw = sorted([p for p in outline if p[1] > HEAD_CY + 40], key=lambda p: p[0])
            depth = 60 if c.facial_hair == "beard" else 44
            inner = [(x, y - depth * (1 - abs(x - HEAD_CX) / HEAD_RX) - 18) for x, y in jaw]
            L.poly(jaw + inner[::-1], fill=fh)
        L.poly([(HEAD_CX - 70, HEAD_CY + 122), (HEAD_CX - 20, HEAD_CY + 106), (HEAD_CX + 20, HEAD_CY + 106),
                (HEAD_CX + 70, HEAD_CY + 122), (HEAD_CX + 40, HEAD_CY + 128), (HEAD_CX - 40, HEAD_CY + 128)], fill=fh)
        lay = lay.filter(ImageFilter.GaussianBlur(2.5 * k))
        a = lay.getchannel("A").point(lambda v: int(v * (0.5 if c.facial_hair == "stubble" else 0.95)))
        lay.putalpha(ImageChops.multiply(a, face_mask))
        back.alpha_composite(lay)

    # nose: bridge shadow, tip, nostrils, wings
    P.line(bez((HEAD_CX + 14, HEAD_CY - 10), (HEAD_CX + 22, HEAD_CY + 40), (HEAD_CX + 18, HEAD_CY + 70)), fill=shade(skin, 0.9), width=4)
    P.ellipse(HEAD_CX + 2, HEAD_CY + 76, 24, 17, fill=shade(skin, 1.06))
    for side in (-1, 1):
        P.ellipse(HEAD_CX + side * 13, HEAD_CY + 87, 7, 4.5, fill=shade(skin, 0.45))
        P.line(bez((HEAD_CX + side * 22, HEAD_CY + 66), (HEAD_CX + side * 36, HEAD_CY + 80),
                   (HEAD_CX + side * 22, HEAD_CY + 92)), fill=sk_dd, width=4)
    if c.accessory == "bindi":
        P.ellipse(HEAD_CX, HEAD_CY - 44, 9, 9, fill=(200, 25, 50))

    front = _hair_layer(c, k, "front", size)
    F = Painter(front, k, HEAD_BOX[0], HEAD_BOX[1])
    if c.accessory == "glasses":
        frame = (28, 28, 34)
        for side in (-1, 1):
            F.rrect(HEAD_CX + side * 66 - 54, HEAD_CY - 22, HEAD_CX + side * 66 + 54, HEAD_CY + 50, 22,
                    outline=frame, width=7)
            F.line([(HEAD_CX + side * 66 - 40, HEAD_CY - 12), (HEAD_CX + side * 66 - 16, HEAD_CY - 14)],
                   fill=(255, 255, 255, 140), width=4)
            F.line([(HEAD_CX + side * 120, HEAD_CY - 4), (HEAD_CX + side * (HEAD_RX - 8), HEAD_CY + 4)],
                   fill=frame, width=6)
        F.line([(HEAD_CX - 12, HEAD_CY + 4), (HEAD_CX + 12, HEAD_CY + 4)], fill=frame, width=6)
    elif c.accessory == "cap":
        capc = shade(c.shirt, 0.85)
        F.chord(HEAD_CX, HEAD_CY - 62, HEAD_RX + 18, HEAD_RY - 38, 180, 360, fill=capc)
        F.chord(HEAD_CX + 70, HEAD_CY - 64, HEAD_RX + 30, 34, 0, 180, fill=shade(capc, 0.8))
        F.arc(HEAD_CX, HEAD_CY - 62, HEAD_RX + 18, HEAD_RY - 38, 200, 340, fill=shade(capc, 1.3), width=5)
    return back, front


# --------------------------------------------------------------------------- #
# Expressive features
# --------------------------------------------------------------------------- #

BROWS = {
    "neutral": ((0, 0), (0, 0)), "happy": ((-8, -4), (-8, -4)), "laughing": ((-10, -2), (-10, -2)),
    "shocked": ((-26, -18), (-26, -18)), "sarcastic": ((3, 3), (-20, -26)), "sad": ((-18, 10), (-18, 10)),
    "angry": ((16, -8), (16, -8)), "confident": ((4, -6), (4, -6)), "thinking": ((-2, 0), (-16, -10)),
}

EYE_OPEN = {  # (upper, lower) openness
    "neutral": (1.0, 1.0), "happy": (0.85, 0.55), "laughing": (0.0, 0.0), "shocked": (1.35, 1.15),
    "sarcastic": (0.55, 0.9), "sad": (0.8, 1.0), "angry": (0.65, 0.9), "confident": (0.8, 0.8), "thinking": (0.9, 1.0),
}

SMILE = {"neutral": 0.15, "happy": 0.8, "laughing": 1.0, "shocked": -0.1, "sarcastic": 0.35, "sad": -0.7,
         "angry": -0.5, "confident": 0.55, "thinking": -0.05}


def _eyes(P: Painter, c: CharacterSpec, emotion, blink, look, k):
    up_f, lo_f = EYE_OPEN.get(emotion, (1, 1))
    ey = HEAD_CY + 12
    lid_col = (38, 24, 20)
    crease = shade(c.skin, 0.84)
    for side in (-1, 1):
        cx = HEAD_CX + side * 66
        x_in, x_out = cx - side * 34, cx + side * 36
        if emotion == "laughing" or blink > 0.8:
            curve = -14 if emotion == "laughing" else 6
            P.line(bez((x_in, ey + 2), (cx, ey + curve), (x_out, ey - 2)), fill=lid_col, width=7)
            if c.gender == "f":
                P.line([(x_out, ey - 2), (x_out + side * 12, ey - 10)], fill=lid_col, width=4)
            continue
        open_ = max(0.08, 1 - blink)
        h_up = 26 * up_f * open_
        h_lo = 14 * lo_f * open_
        x_out_y = ey + 6 if emotion == "sad" else ey - 4
        upper = bez((x_in, ey), (cx, ey - 2 * h_up), (x_out, x_out_y))
        lower = bez((x_out, x_out_y), (cx, ey + 2 * h_lo), (x_in, ey))
        shape = upper + lower
        bx0, by0 = cx - 46, ey - 64
        m_size = (int(92 * k), int(120 * k))
        em = Image.new("L", m_size, 0)
        Painter(em, k, bx0, by0).poly(shape, fill=255)
        eye = Image.new("RGBA", m_size, (0, 0, 0, 0))
        E = Painter(eye, k, bx0, by0)
        E.poly(shape, fill=(250, 246, 240))
        gx = cx + look * 10
        gy = ey + (-6 if emotion == "thinking" else 2)
        E.ellipse(gx, gy, 18, 18, fill=shade(c.iris, 0.6))
        E.ellipse(gx, gy, 15, 15, fill=c.iris)
        E.ellipse(gx, gy + 5, 10, 7, fill=shade(c.iris, 1.45))
        E.ellipse(gx, gy, 8, 8, fill=(10, 8, 8))
        E.ellipse(gx - 6, gy - 7, 5, 5, fill=(255, 255, 255))
        E.ellipse(gx + 6, gy + 5, 2.5, 2.5, fill=(255, 255, 255))
        E.line(upper, fill=(150, 120, 110), width=9)
        eye.putalpha(ImageChops.multiply(eye.getchannel("A"), em))
        P.img.alpha_composite(eye, (int((bx0 - P.ox) * k), int((by0 - P.oy) * k)))
        P.line(upper, fill=lid_col, width=7 if c.gender == "f" else 6)
        P.line([(x_out, x_out_y), (x_out + side * (12 if c.gender == "f" else 6), x_out_y - 6)], fill=lid_col, width=5)
        if c.gender == "f":
            for i in (0.62, 0.78, 0.92):
                px, py = upper[int(i * (len(upper) - 1))]
                P.line([(px, py), (px + side * 8, py - 9)], fill=lid_col, width=3)
        P.line(lower[3:-3], fill=shade(c.skin, 0.86), width=2)
        P.line(bez((x_in + side * 4, ey - h_up - 10), (cx, ey - 2 * h_up - 14), (x_out - side * 4, x_out_y - h_up - 4)),
               fill=crease, width=2)
        if emotion in ("happy", "confident"):
            P.arc(cx, ey + 28, 30, 10, 200, 340, fill=shade(c.skin, 0.88), width=2)


def _brows(P: Painter, c: CharacterSpec, emotion, lift):
    (li, lo), (ri, ro) = BROWS.get(emotion, BROWS["neutral"])
    by = HEAD_CY - 52 - lift
    col = shade(c.hair, 0.95)
    thick_in = 15 if c.gender == "m" else 11
    for side, (inner, outer) in ((-1, (li, lo)), (1, (ri, ro))):
        p0 = (HEAD_CX + side * 26, by + inner)
        p2 = (HEAD_CX + side * 120, by + outer + 8)
        p1 = (HEAD_CX + side * 84, by + min(inner, outer) - 16)
        top = bez(p0, p1, p2, 12)
        bottom = [(x, y + thick_in * (1 - i / 12) + 4 * (i / 12)) for i, (x, y) in enumerate(top)]
        P.poly(top + bottom[::-1], fill=col)


VISEMES = {  # half-width, height at open=1, roundness, teeth
    "A": (50, 50, 0.0, True), "E": (58, 30, 0.0, True), "O": (34, 44, 1.0, False),
    "U": (24, 26, 1.0, False), "F": (48, 14, 0.0, True), "C": (46, 20, 0.0, True),
    "X": (44, 24, 0.2, True), "M": (44, 0, 0.0, False),
}


def _mouth(P: Painter, c: CharacterSpec, emotion, viseme, open_, k):
    mx, my = HEAD_CX, HEAD_CY + 142
    s = SMILE.get(emotion, 0.1)
    lip_u, lip_l = shade(c.lip, 0.85), shade(c.lip, 1.12)
    dark = (60, 16, 20)
    if emotion == "laughing":
        viseme, open_ = "A", max(open_, 0.7)
    if emotion == "shocked" and open_ < 0.25:
        viseme, open_ = "O", 0.45
    hw, hh, rnd, teeth = VISEMES.get(viseme, VISEMES["X"])
    hw = hw + 10 * max(0, s) * (1 - rnd)
    h = hh * open_
    corner_dy = -12 * s

    if h < 4 or viseme == "M":
        w = 50 + 10 * max(0, s)
        lc, rc = (mx - w, my + corner_dy), (mx + w, my + corner_dy)
        mid_dy = 4 * s
        P.poly([lc, (mx - 18, my - 9), (mx, my - 5), (mx + 18, my - 9), rc,
                (mx + 20, my + mid_dy), (mx - 20, my + mid_dy)], fill=lip_u)
        P.poly(bez(lc, (mx, my + 26 + 6 * s), rc) + [(mx + 20, my + mid_dy), (mx - 20, my + mid_dy)], fill=lip_l)
        P.line(bez(lc, (mx, my + 4 + 10 * s), rc), fill=shade(c.lip, 0.55), width=4)
        P.ellipse(mx - 8, my + 12, 12, 4, fill=shade(c.lip, 1.35))
        if s > 0.4:
            for side in (-1, 1):
                P.arc(mx + side * (w + 10), my + corner_dy - 4, 10, 16, 300 if side > 0 else 120,
                      60 if side > 0 else 240, fill=shade(c.skin, 0.86), width=2)
        return

    lc, rc = (mx - hw, my + corner_dy), (mx + hw, my + corner_dy)
    top_c = (mx, my - 6 - h * 0.35 * (1 + rnd))
    bot_c = (mx, my + h * (1.25 + 0.4 * max(0, s)))
    upper = bez(lc, top_c, rc, 16)
    lower = bez(rc, bot_c, lc, 16)
    shape = upper + lower
    bx0, by0 = mx - 80, my - 60
    sz = (int(160 * k), int(150 * k))
    m = Image.new("L", sz, 0)
    Painter(m, k, bx0, by0).poly(shape, fill=255)
    lay = Image.new("RGBA", sz, (0, 0, 0, 0))
    L = Painter(lay, k, bx0, by0)
    L.poly(shape, fill=dark)
    if h > 16:
        L.ellipse(mx, bot_c[1] - 4, hw * 0.7, h * 0.45, fill=(200, 92, 104))
    if teeth:
        th = min(15, h * 0.42)
        L.rrect(mx - hw * 0.8, top_c[1] - 10, mx + hw * 0.8, top_c[1] + th + 6, 6, fill=(250, 250, 246))
        if viseme in ("E", "F"):
            L.rrect(mx - hw * 0.6, bot_c[1] - 12, mx + hw * 0.6, bot_c[1] + 4, 5, fill=(236, 236, 230))
    lay.putalpha(ImageChops.multiply(lay.getchannel("A"), m))
    P.img.alpha_composite(lay, (int((bx0 - P.ox) * k), int((by0 - P.oy) * k)))
    P.line(upper, fill=lip_u, width=8)
    if viseme == "F":
        P.line(bez((lc[0] + 6, lc[1] + 4), (mx, my + 6), (rc[0] - 6, rc[1] + 4)), fill=lip_l, width=12)
    else:
        P.line(lower, fill=lip_l, width=11)
    P.ellipse(mx, bot_c[1] + 6, 12, 3.5, fill=shade(c.lip, 1.35))
    if s > 0.4:
        for side in (-1, 1):
            P.arc(mx + side * (hw + 12), my + corner_dy, 10, 20, 300 if side > 0 else 120,
                  60 if side > 0 else 240, fill=shade(c.skin, 0.86), width=2)


@lru_cache(maxsize=1500)
def _head_state(c_items, emotion, viseme, mouth_q, blink_q, look_q, brow_q, px_h):
    c = CharacterSpec(dict(c_items))
    back, front = _head_static(c_items, px_h)
    k = px_h / BASE_H * SS
    img = back.copy()
    P = Painter(img, k, HEAD_BOX[0], HEAD_BOX[1])
    if emotion in ("happy", "laughing", "confident"):
        for side in (-1, 1):  # flushed cheeks (drawn as blended colour, cheap)
            P.ellipse(HEAD_CX + side * 112, HEAD_CY + 92, 30, 15, fill=mix(c.skin, (226, 104, 104), 0.28))
    _brows(P, c, emotion, brow_q * 7)
    _eyes(P, c, emotion, blink_q / 2.0, look_q / 2.0, k)
    _mouth(P, c, emotion, viseme, mouth_q / 5.0, k)
    img.alpha_composite(front)
    img = img.reduce(SS)
    kf = px_h / BASE_H
    return img, HEAD_BOX[0] * kf, HEAD_BOX[1] * kf


@lru_cache(maxsize=2500)
def _head_rotated(c_items, emotion, viseme, mouth_q, blink_q, look_q, brow_q, px_h, ang_q):
    img, hx, hy = _head_state(c_items, emotion, viseme, mouth_q, blink_q, look_q, brow_q, px_h)
    if ang_q:
        kf = px_h / BASE_H
        img = img.rotate(ang_q, resample=Image.BILINEAR, center=(500 * kf - hx, 840 * kf - hy))
    return img, hx, hy


# --------------------------------------------------------------------------- #
# Torso
# --------------------------------------------------------------------------- #

@lru_cache(maxsize=64)
def _torso(c_items, lift_q, px_h):
    c = CharacterSpec(dict(c_items))
    lift = lift_q * 4
    k = px_h / BASE_H * SS
    size = (int(BASE_W * k), int(BASE_H * k))
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    P = Painter(img, k)
    sh, skin = c.shirt, c.skin

    neck_mask = Image.new("L", size, 0)
    Painter(neck_mask, k).rrect(436, 700, 564, 960, 40, fill=255)
    P.rrect(436, 700, 564, 960, 40, fill=shade(skin, 0.92))
    soft_shade(img, neck_mask, shade(skin, 0.7), 0, 40 * k, 30 * k, 0.9)
    soft_shade(img, neck_mask, shade(skin, 0.78), -14 * k, 0, 14 * k, 0.6)
    if c.shirt_style == "hoodie":
        P.ellipse(500, 935 - lift, 215, 92, fill=shade(sh, 0.78))

    y0 = TORSO_TOP - lift
    body = (bez((436, y0 - 4), (300, y0 - 6), (210, y0 + 40), 8) +
            bez((210, y0 + 40), (150, y0 + 80), (140, y0 + 220), 8) +
            [(130, 1420), (870, 1420)] +
            bez((860, y0 + 220), (850, y0 + 80), (790, y0 + 40), 8) +
            bez((790, y0 + 40), (700, y0 - 6), (564, y0 - 4), 8))
    m = Image.new("L", size, 0)
    Painter(m, k).poly(body, fill=255)
    P.poly(body, fill=sh)
    soft_shade(img, m, shade(sh, 0.68), -26 * k, -10 * k, 40 * k, 0.8)
    glow_spot(img, m, P, 360, y0 + 110, 150, 90, shade(sh, 1.25), 40 * k, 0.5)
    fold = shade(sh, 0.82)
    P.line(bez((360, y0 + 260), (390, y0 + 360), (370, 1400)), fill=fold, width=5)
    P.line(bez((650, y0 + 240), (620, y0 + 360), (640, 1400)), fill=fold, width=5)

    neck_skin = shade(skin, 0.86)
    if c.shirt_style == "tshirt":
        P.chord(500, y0 + 4, 74, 48, 0, 180, fill=neck_skin)
        P.arc(500, y0 + 4, 80, 54, 0, 180, fill=shade(sh, 0.75), width=9)
    elif c.shirt_style == "shirt":
        P.poly([(500, y0 + 150), (440, y0 - 2), (560, y0 - 2)], fill=neck_skin)
        P.poly([(500, y0 + 60), (420, y0 - 8), (448, y0 + 92)], fill=(246, 246, 246))
        P.poly([(500, y0 + 60), (580, y0 - 8), (552, y0 + 92)], fill=(246, 246, 246))
        P.line([(500, y0 + 150), (500, 1400)], fill=shade(sh, 0.75), width=4)
        for i in range(4):
            P.ellipse(512, y0 + 190 + i * 80, 7, 7, fill=shade(sh, 0.6))
        P.rrect(560, y0 + 180, 660, y0 + 290, 8, outline=shade(sh, 0.75), width=4)
    elif c.shirt_style == "blazer":
        P.poly([(500, y0 + 230), (444, y0 - 2), (556, y0 - 2)], fill=(246, 246, 246))
        P.poly([(500, y0 + 40), (486, y0 + 80), (500, y0 + 250), (514, y0 + 80)], fill=(176, 38, 52))
        lap = shade(sh, 0.82)
        P.poly([(500, y0 + 230), (432, y0 + 4), (390, y0 + 110), (470, 1420)], fill=lap)
        P.poly([(500, y0 + 230), (568, y0 + 4), (610, y0 + 110), (530, 1420)], fill=lap)
        P.line([(432, y0 + 4), (500, y0 + 230), (568, y0 + 4)], fill=shade(sh, 0.6), width=4)
    elif c.shirt_style == "hoodie":
        P.chord(500, y0 + 4, 74, 46, 0, 180, fill=neck_skin)
        for x0, x1 in ((470, 460), (530, 540)):
            P.line([(x0, y0 + 40), (x1, y0 + 190)], fill=(242, 242, 242), width=8)
            P.ellipse(x1, y0 + 196, 7, 9, fill=(220, 220, 220))
        P.rrect(370, y0 + 330, 630, 1420, 50, outline=shade(sh, 0.72), width=6)
    elif c.shirt_style == "kurta":
        P.chord(500, y0 + 4, 70, 44, 0, 180, fill=neck_skin)
        P.rrect(470, y0 + 20, 530, y0 + 250, 10, fill=shade(sh, 0.88))
        for i in range(4):
            P.ellipse(500, y0 + 60 + i * 52, 7, 7, fill=(230, 196, 80))
        P.arc(500, y0 + 4, 80, 54, 0, 180, fill=(230, 196, 80), width=5)
    if c.accessory == "headphones":
        P.arc(500, y0 + 30, 150, 70, 0, 180, fill=(34, 34, 40), width=22)
        for side in (-1, 1):
            P.ellipse(500 + side * 140, y0 + 30, 40, 46, fill=(44, 44, 52))
    if c.accessory == "lanyard":
        P.line([(445, y0), (500, y0 + 250), (555, y0)], fill=(37, 99, 235), width=10)
        P.rrect(460, y0 + 250, 540, y0 + 360, 10, fill=(255, 255, 255))
        P.rrect(472, y0 + 270, 528, y0 + 300, 4, fill=(37, 99, 235))
    return img.reduce(SS)


# --------------------------------------------------------------------------- #
# Arms & hands
# --------------------------------------------------------------------------- #

def solve_arm(shoulder, target, right: bool):
    sx, sy = shoulder
    tx, ty = target
    dx, dy = tx - sx, ty - sy
    d = max(30.0, min(math.hypot(dx, dy), UPPER_ARM + FOREARM - 2))
    a = math.atan2(dy, dx)
    cos_alpha = (UPPER_ARM ** 2 + d ** 2 - FOREARM ** 2) / (2 * UPPER_ARM * d)
    alpha = math.acos(max(-1.0, min(1.0, cos_alpha)))
    cands = []
    for sgn in (1, -1):
        ex = sx + UPPER_ARM * math.cos(a + sgn * alpha)
        ey = sy + UPPER_ARM * math.sin(a + sgn * alpha)
        outward = (ex - 500) if right else (500 - ex)
        cands.append((ey + 0.6 * outward, (ex, ey)))
    elbow = max(cands)[1]
    return elbow, (sx + d * math.cos(a), sy + d * math.sin(a))


def _finger(P, base, ang, length, curl, r, col, out):
    """Finger as 1-2 tapered segments. curl 0 = straight, 1 = folded."""
    l1 = length * (1 - 0.5 * curl)
    j = (base[0] + math.cos(ang) * l1, base[1] + math.sin(ang) * l1)
    P.limb(base, j, r + 2, r + 1.5, out)
    P.limb(base, j, r, r - 0.5, col)
    if curl > 0.05:
        a2 = ang + curl * 2.0
        l2 = length * 0.45
        tip = (j[0] + math.cos(a2) * l2, j[1] + math.sin(a2) * l2)
        P.limb(j, tip, r + 1.5, r + 1, out)
        P.limb(j, tip, r - 0.5, r - 1.5, col)
    else:
        nx, ny = j[0] - math.cos(ang) * 7, j[1] - math.sin(ang) * 7
        P.ellipse(nx, ny, r * 0.5, r * 0.4, fill=shade(col, 1.15))  # nail highlight


def draw_hand(P: Painter, wrist, ang, pose: str, mirror: int, skin):
    out = shade(skin, 0.62)
    col = skin
    ca, sa = math.cos(ang), math.sin(ang)

    def loc(x, y):
        y *= mirror
        return (wrist[0] + x * ca - y * sa, wrist[1] + x * sa + y * ca)

    def lang(a):
        return ang + a * mirror

    P.poly([loc(-8, -34), loc(60, -38), loc(71, -10), loc(68, 28), loc(52, 38), loc(0, 34)], fill=out)
    P.poly([loc(-4, -30), loc(56, -34), loc(66, -10), loc(64, 24), loc(50, 34), loc(4, 30)], fill=col)
    bases = [loc(60, -24), loc(66, -8), loc(64, 9), loc(56, 24)]
    lengths = [52, 58, 54, 42]
    spreads = [-0.22, -0.07, 0.08, 0.22]
    curls = {"open": [0, 0, 0, 0], "relaxed": [0.35, 0.4, 0.45, 0.5], "point": [0, 1, 1, 1],
             "fist": [1, 1, 1, 1], "thumbs_up": [1, 1, 1, 1]}.get(pose, [0.35, 0.4, 0.45, 0.5])
    spread_f = 1.0 if pose == "open" else 0.4
    for i in range(4):
        _finger(P, bases[i], lang(spreads[i] * spread_f), lengths[i], curls[i], 10.5 - i * 0.6, col, out)
    if pose == "thumbs_up":
        _finger(P, loc(30, -30), lang(-1.5), 48, 0, 12, col, out)
    elif pose in ("fist", "point"):
        _finger(P, loc(20, -28), lang(-0.25), 40, 0.3, 11.5, col, out)
    else:
        _finger(P, loc(16, -30), lang(-0.95 if pose == "open" else -0.7), 42, 0.15, 11.5, col, out)
    P.line([loc(18, -8), loc(44, 4)], fill=shade(skin, 0.85), width=3)


@lru_cache(maxsize=5000)
def _arm_sprite(c_items, right, sx, sy, tx, ty, pose, px_h):
    c = CharacterSpec(dict(c_items))
    shoulder = (sx, sy)
    elbow, wrist = solve_arm(shoulder, (tx, ty), right)
    pad = 120
    xs = [shoulder[0], elbow[0], wrist[0]]
    ys = [shoulder[1], elbow[1], wrist[1]]
    bx0, by0 = min(xs) - pad, min(ys) - pad
    bx1, by1 = max(xs) + pad, max(ys) + pad
    k = px_h / BASE_H * SS
    img = Image.new("RGBA", (max(2, int((bx1 - bx0) * k)), max(2, int((by1 - by0) * k))), (0, 0, 0, 0))
    P = Painter(img, k, bx0, by0)
    sh = c.shirt
    sh_d, sh_l, out = shade(sh, 0.86), shade(sh, 1.12), shade(sh, 0.66)
    sk, sk_d, sk_l = c.skin, shade(c.skin, 0.82), shade(c.skin, 1.12)
    long_sleeve = c.shirt_style in ("shirt", "blazer", "hoodie", "kurta")

    def seg(a, b, ra, rb, base, dark, light, outline):
        P.limb(a, b, ra + 3, rb + 3, outline)
        P.limb(a, b, ra, rb, dark)
        off = (-ra * 0.16, -ra * 0.1)
        P.limb((a[0] + off[0], a[1] + off[1]), (b[0] + off[0], b[1] + off[1]), ra * 0.8, rb * 0.8, base)
        P.limb((a[0] + off[0] * 2.2, a[1] + off[1] * 2.2), (b[0] + off[0] * 2.2, b[1] + off[1] * 2.2),
               ra * 0.3, rb * 0.3, mix(base, light, 0.45))

    if long_sleeve:
        seg(shoulder, elbow, 48, 40, sh, sh_d, sh_l, out)
        seg(elbow, wrist, 40, 32, sh, sh_d, sh_l, out)
        dxw, dyw = wrist[0] - elbow[0], wrist[1] - elbow[1]
        L = math.hypot(dxw, dyw) or 1
        cuff = (wrist[0] - dxw / L * 14, wrist[1] - dyw / L * 14)
        P.limb(cuff, wrist, 34, 33, shade(sh, 0.7))
        if c.shirt_style in ("shirt", "kurta"):
            P.limb(cuff, wrist, 30, 29, (246, 246, 246) if c.shirt_style == "shirt" else shade(sh, 0.9))
    else:
        mid = (shoulder[0] + (elbow[0] - shoulder[0]) * 0.55, shoulder[1] + (elbow[1] - shoulder[1]) * 0.55)
        seg(mid, elbow, 32, 30, sk, sk_d, sk_l, shade(sk, 0.62))
        seg(elbow, wrist, 30, 24, sk, sk_d, sk_l, shade(sk, 0.62))
        seg(shoulder, mid, 50, 46, sh, sh_d, sh_l, out)
        P.ellipse(mid[0], mid[1], 44, 44, fill=shade(sh, 0.88))
    ang = math.atan2(wrist[1] - elbow[1], wrist[0] - elbow[0])
    draw_hand(P, wrist, ang, pose, 1 if right else -1, sk)
    kf = px_h / BASE_H
    return img.reduce(SS), bx0 * kf, by0 * kf


# --------------------------------------------------------------------------- #
# Gestures (beat-driven)
# --------------------------------------------------------------------------- #

def gesture_targets(gesture: str, phase: float, beat: float):
    """Returns (left_xy, right_xy, left_pose, right_pose, shoulder_lift, shake)."""
    sw = math.sin(phase * 1.9)
    sw2 = math.sin(phase * 1.3 + 1)
    idle_l, idle_r = (240, 1520), (760, 1520)
    b = beat
    if gesture == "explain":
        return idle_l, (640 + 22 * sw, 1070 - 55 * b + 10 * sw2), "relaxed", ("open" if b > 0.4 else "relaxed"), 0, 0
    if gesture == "both_explain":
        return (360 - 22 * sw, 1070 - 50 * b), (640 + 22 * sw, 1070 - 50 * b), "open", "open", 0, 0
    if gesture == "count":
        return idle_l, (710, 810 - 30 * b + 6 * sw), "relaxed", "point", 0, 0
    if gesture == "point_up":
        return idle_l, (780, 610 - 18 * b), "relaxed", "point", 0, 0
    if gesture == "point_side":
        return idle_l, (980 + 18 * b, 880), "relaxed", "point", 0, 0
    if gesture == "point_viewer":
        return idle_l, (600, 980 - 30 * b), "relaxed", "point", 0, 0
    if gesture == "shrug":
        lift = 20 + 6 * sw2 + 8 * b
        return (130, 960 - 10 * sw2), (870, 960 - 10 * sw2), "open", "open", lift, 0
    if gesture == "facepalm":
        return idle_l, (525, 540 + 6 * sw), "relaxed", "open", 10, 0
    if gesture == "laugh":
        j = math.sin(phase * 18)
        return (430, 1190 + 14 * j), (570, 1190 + 14 * j), "fist", "fist", 8, 6 * math.sin(phase * 22)
    if gesture == "cross":
        return (660, 1110), (340, 1100), "fist", "fist", 4, 0
    if gesture == "think":
        return idle_l, (556, 812 + 4 * sw2), "relaxed", "fist", 0, 0
    if gesture == "wave":
        return idle_l, (840 + 45 * math.sin(phase * 8), 590), "relaxed", "open", 0, 0
    if gesture == "celebrate":
        return (180, 480 + 25 * sw), (820, 480 - 25 * sw), "fist", "fist", 12, 3 * math.sin(phase * 12)
    if gesture == "thumbs_up":
        return idle_l, (700, 930 - 20 * b), "relaxed", "thumbs_up", 0, 0
    if gesture == "hands_on_hips":
        return (190, 1240), (810, 1240), "fist", "fist", 0, 0
    return idle_l, idle_r, "relaxed", "relaxed", 0, 0


def _pose(gesture, prev_gesture, blend, phase, beat):
    lh, rh, lp, rp, lift, shake = gesture_targets(gesture, phase, beat)
    if blend < 1.0 and prev_gesture != gesture:
        bb = blend * blend * (3 - 2 * blend)
        plh, prh, plp, prp, plift, _ = gesture_targets(prev_gesture, phase, beat)
        lh = (plh[0] + (lh[0] - plh[0]) * bb, plh[1] + (lh[1] - plh[1]) * bb)
        rh = (prh[0] + (rh[0] - prh[0]) * bb, prh[1] + (rh[1] - prh[1]) * bb)
        lift = plift + (lift - plift) * bb
        if bb < 0.5:
            lp, rp = plp, prp
    return lh, rh, lp, rp, lift, shake


def _put(canvas: Image.Image, img: Image.Image, x: float, y: float):
    x, y = int(x), int(y)
    if x >= 0 and y >= 0 and x + img.width <= canvas.width and y + img.height <= canvas.height:
        canvas.alpha_composite(img, (x, y))
    else:
        canvas.paste(img, (x, y), img)


# --------------------------------------------------------------------------- #
# Public API
# --------------------------------------------------------------------------- #

def render_character(c_dict: dict, *, mouth=0.0, viseme="X", blink=0.0, emotion="neutral", gesture="idle",
                     phase=0.0, beat=0.0, brow=0.0, tilt=0.0, look=0.0, px_h=1300, prev_gesture="idle",
                     blend=1.0, nod=0.0) -> Image.Image:
    """Compose a character frame (RGBA, size ~ BASE_W x BASE_H scaled to px_h)."""
    items = tuple(sorted((k, v) for k, v in c_dict.items() if isinstance(v, (str, int, float, bool))))
    px_h = int(px_h)
    kf = px_h / BASE_H
    blend = max(0.0, min(1.0, blend))
    lh, rh, lp, rp, lift, shake = _pose(gesture, prev_gesture, blend, phase, beat)
    lift_q = int(round(lift / 8)) * 2
    lift = lift_q * 4

    canvas = _torso(items, lift_q, px_h).copy()
    face_gesture = gesture in ("facepalm", "think") and blend >= 0.5
    q = 8
    sl = (SHOULDER_L[0], SHOULDER_L[1] - lift)
    sr = (SHOULDER_R[0], SHOULDER_R[1] - lift)
    arm_l = _arm_sprite(items, False, sl[0], sl[1], int(lh[0] // q * q), int(lh[1] // q * q), lp, px_h)
    arm_r = _arm_sprite(items, True, sr[0], sr[1], int(rh[0] // q * q), int(rh[1] // q * q), rp, px_h)

    if not face_gesture:
        _put(canvas, *arm_l)
        _put(canvas, *arm_r)

    mouth_q = int(round(max(0.0, min(1.0, mouth)) * 5))
    blink_q = 2 if blink > 0.8 else (1 if blink > 0.35 else 0)
    look_q = int(round(max(-1, min(1, look)) * 2))
    brow_q = 1 if brow > 0.5 else 0
    ang_q = round((tilt + shake * 0.4) / 1.5) * 1.5
    head, hx, hy = _head_rotated(items, emotion, viseme if mouth_q else "M", mouth_q, blink_q, look_q, brow_q,
                                 px_h, ang_q)
    _put(canvas, head, hx + shake * kf, hy + nod * kf)

    if face_gesture:
        _put(canvas, *arm_l)
        _put(canvas, *arm_r)
    return canvas
