"""
Procedural backdrops ("sets") for reels. Each returns an RGB image slightly larger
than the frame so the renderer can do slow camera drift / parallax.
Palettes are randomised per video seed so the same set never looks identical.
"""

from __future__ import annotations

import math
import random
from PIL import Image, ImageDraw, ImageFilter

from characters import hex_rgb, shade, mix

W, H = 1080, 1920
PAD = 80  # extra pixels on each side for camera drift
SW, SH = W + 2 * PAD, H + 2 * PAD


def _vgrad(top, bottom, w=SW, h=SH):
    img = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(img)
    for y in range(h):
        d.line([(0, y), (w, y)], fill=mix(top, bottom, y / max(1, h - 1)))
    return img


def _glow(img, cx, cy, r, color, strength=0.55):
    layer = Image.new("RGB", img.size, (0, 0, 0))
    ImageDraw.Draw(layer).ellipse([cx - r, cy - r, cx + r, cy + r], fill=color)
    layer = layer.filter(ImageFilter.GaussianBlur(r * 0.45))
    return Image.blend(img, Image.composite(layer, img, layer.convert("L")), strength)


def _font(size):
    from fonts import load_font
    return load_font(size, "heavy")


PALETTES = [
    ("#1E1B4B", "#312E81", "#F59E0B"),
    ("#0F172A", "#1E3A5F", "#38BDF8"),
    ("#3B0764", "#581C87", "#F472B6"),
    ("#052E2B", "#134E4A", "#FACC15"),
    ("#2A0E0E", "#4A1D1D", "#FB923C"),
    ("#111827", "#1F2937", "#22C55E"),
]


def studio(rng: random.Random, brand: str):
    top, bot, acc = [hex_rgb(c) for c in rng.choice(PALETTES)]
    img = _vgrad(shade(top, 1.15), bot)
    d = ImageDraw.Draw(img)
    # wall panels
    for i in range(6):
        x = PAD + i * 190
        d.rectangle([x, 0, x + 6, SH], fill=shade(top, 1.25))
    # shelf left
    sy = 820
    d.rectangle([PAD + 30, sy, PAD + 420, sy + 22], fill=(92, 64, 45))
    x = PAD + 50
    for _ in range(9):
        bw = rng.randint(26, 46)
        bh = rng.randint(110, 170)
        col = rng.choice([(239, 68, 68), (59, 130, 246), (234, 179, 8), (16, 185, 129), (236, 72, 153), (249, 250, 251)])
        d.rectangle([x, sy - bh, x + bw, sy], fill=col, outline=shade(col, 0.6), width=3)
        x += bw + 4
    # plant right
    px, py = PAD + 900, 1250
    for i in range(9):
        ang = -math.pi / 2 + (i - 4) * 0.32
        lx, ly = px + math.cos(ang) * 150, py - 120 + math.sin(ang) * 210
        d.ellipse([lx - 38, ly - 70, lx + 38, ly + 70], fill=(34, 139, 74), outline=(20, 90, 50), width=4)
    d.rounded_rectangle([px - 80, py - 40, px + 80, py + 150], 24, fill=(200, 110, 70), outline=(140, 70, 40), width=5)
    # neon sign
    f = _font(84)
    text = brand.replace("https://", "").split(".")[0].upper()[:12] or "DINOMATE"
    tw = d.textlength(text, font=f)
    tx, ty = PAD + (W - tw) / 2 + 140, 360
    glow = Image.new("RGB", img.size, (0, 0, 0))
    ImageDraw.Draw(glow).text((tx, ty), text, font=f, fill=acc)
    glow = glow.filter(ImageFilter.GaussianBlur(14))
    img = Image.blend(img, Image.composite(glow, img, glow.convert("L")), 0.85)
    ImageDraw.Draw(img).text((tx, ty), text, font=f, fill=shade(acc, 1.5))
    img = _glow(img, SW // 2, 1300, 520, shade(acc, 0.9), 0.35)
    return img, acc


def office(rng: random.Random, brand: str):
    wall = hex_rgb(rng.choice(["#E7E5E4", "#DBEAFE", "#FEF3C7", "#E0E7FF"]))
    acc = hex_rgb(rng.choice(["#2563EB", "#DC2626", "#7C3AED", "#059669"]))
    img = _vgrad(shade(wall, 1.05), shade(wall, 0.85))
    d = ImageDraw.Draw(img)
    # window with skyline
    wx0, wy0, wx1, wy1 = PAD + 520, 260, PAD + 1040, 1100
    sky = _vgrad((125, 180, 235), (250, 205, 160), wx1 - wx0, wy1 - wy0)
    sd = ImageDraw.Draw(sky)
    x = 0
    while x < wx1 - wx0:
        bw = rng.randint(50, 110)
        bh = rng.randint(200, 620)
        col = rng.choice([(71, 85, 105), (100, 116, 139), (51, 65, 85)])
        sd.rectangle([x, (wy1 - wy0) - bh, x + bw, wy1 - wy0], fill=col)
        for yy in range((wy1 - wy0) - bh + 20, wy1 - wy0 - 20, 40):
            for xx in range(x + 10, x + bw - 14, 24):
                if rng.random() < 0.5:
                    sd.rectangle([xx, yy, xx + 10, yy + 16], fill=(253, 230, 138))
        x += bw + 6
    img.paste(sky, (wx0, wy0))
    d.rectangle([wx0, wy0, wx1, wy1], outline=(250, 250, 250), width=20)
    d.line([((wx0 + wx1) // 2, wy0), ((wx0 + wx1) // 2, wy1)], fill=(250, 250, 250), width=14)
    # wall art + clock
    d.rounded_rectangle([PAD + 70, 420, PAD + 400, 700], 12, fill=acc, outline=shade(acc, 0.6), width=8)
    d.text((PAD + 110, 520), "HUSTLE", font=_font(64), fill=(255, 255, 255))
    d.ellipse([PAD + 150, 820, PAD + 320, 990], fill=(255, 255, 255), outline=(40, 40, 40), width=10)
    d.line([(PAD + 235, 905), (PAD + 235, 850)], fill=(30, 30, 30), width=8)
    d.line([(PAD + 235, 905), (PAD + 280, 920)], fill=(30, 30, 30), width=6)
    return img, acc


def canteen(rng: random.Random, brand: str):
    wall = hex_rgb(rng.choice(["#FDE68A", "#FECACA", "#BBF7D0", "#FED7AA"]))
    img = _vgrad(wall, shade(wall, 0.8))
    d = ImageDraw.Draw(img)
    # tiles lower half
    for y in range(1150, SH, 70):
        for x in range(0, SW, 70):
            d.rectangle([x, y, x + 66, y + 66], fill=(245, 245, 240), outline=(210, 210, 200))
    # menu board
    bx0, by0 = PAD + 120, 260
    d.rounded_rectangle([bx0, by0, bx0 + 840, by0 + 520], 18, fill=(30, 41, 59), outline=(120, 72, 40), width=22)
    f = _font(58)
    items = rng.sample([("CHAI", "10"), ("SAMOSA", "15"), ("MAGGI", "40"), ("VADA PAV", "20"),
                        ("COLD COFFEE", "50"), ("POHA", "25"), ("BUN MASKA", "30")], 4)
    d.text((bx0 + 60, by0 + 40), "CANTEEN MENU", font=_font(64), fill=(250, 204, 21))
    for i, (it, pr) in enumerate(items):
        y = by0 + 140 + i * 88
        d.text((bx0 + 60, y), it, font=f, fill=(255, 255, 255))
        d.text((bx0 + 660, y), f"Rs {pr}", font=f, fill=(134, 239, 172))
    # hanging bulbs
    for x in (PAD + 160, PAD + 540, PAD + 920):
        d.line([(x, 0), (x, 180)], fill=(40, 40, 40), width=5)
    img = _glow(img, PAD + 540, 200, 260, (255, 230, 150), 0.35)
    return img, (234, 88, 12)


def hostel(rng: random.Random, brand: str):
    img = _vgrad((30, 27, 75), (67, 56, 202))
    d = ImageDraw.Draw(img)
    # window night
    d.rounded_rectangle([PAD + 600, 260, PAD + 1000, 760], 16, fill=(15, 23, 42), outline=(120, 113, 108), width=18)
    d.ellipse([PAD + 820, 320, PAD + 920, 420], fill=(254, 249, 195))
    for _ in range(25):
        sx, sy = rng.randint(PAD + 620, PAD + 980), rng.randint(280, 740)
        d.ellipse([sx, sy, sx + 4, sy + 4], fill=(255, 255, 255))
    # posters
    for (x, y, c, t) in [(PAD + 80, 300, (239, 68, 68), "CODE"), (PAD + 330, 420, (34, 197, 94), "SLEEP"),
                         (PAD + 100, 700, (59, 130, 246), "REPEAT")]:
        d.rectangle([x, y, x + 220, y + 290], fill=c, outline=(255, 255, 255), width=8)
        d.text((x + 20, y + 110), t, font=_font(48), fill=(255, 255, 255))
    # fairy lights
    for i in range(16):
        x = PAD + 40 + i * 64
        y = 200 + 30 * math.sin(i * 0.9)
        col = [(250, 204, 21), (244, 114, 182), (96, 165, 250), (74, 222, 128)][i % 4]
        d.ellipse([x - 10, y - 10, x + 10, y + 10], fill=col)
    img = _glow(img, SW // 2, 220, 420, (250, 204, 21), 0.18)
    return img, (250, 204, 21)


def interview(rng: random.Random, brand: str):
    wall = hex_rgb(rng.choice(["#CBD5E1", "#D6D3D1", "#C7D2FE"]))
    img = _vgrad(shade(wall, 1.1), shade(wall, 0.75))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 1180, SW, SH], fill=shade(wall, 0.6))
    d.rounded_rectangle([PAD + 300, 280, PAD + 780, 520], 20, fill=(15, 23, 42))
    d.text((PAD + 345, 340), "HR ROUND", font=_font(80), fill=(255, 255, 255))
    d.ellipse([PAD + 850, 300, PAD + 1010, 460], fill=(255, 255, 255), outline=(30, 30, 30), width=10)
    for i in range(7):  # plant
        ang = -math.pi / 2 + (i - 3) * 0.35
        lx, ly = PAD + 140 + math.cos(ang) * 110, 900 + math.sin(ang) * 170
        d.ellipse([lx - 30, ly - 60, lx + 30, ly + 60], fill=(22, 163, 74))
    d.rectangle([PAD + 80, 960, PAD + 200, 1120], fill=(68, 64, 60))
    return img, (220, 38, 38)


def tapri(rng: random.Random, brand: str):
    img = _vgrad((254, 215, 170), (251, 146, 60))
    d = ImageDraw.Draw(img)
    d.ellipse([PAD + 760, 220, PAD + 960, 420], fill=(254, 240, 138))
    # stall
    d.rectangle([PAD + 60, 520, PAD + 1020, 1250], fill=(120, 53, 15))
    for i in range(8):
        col = (220, 38, 38) if i % 2 == 0 else (250, 250, 250)
        d.polygon([(PAD + 40 + i * 125, 440), (PAD + 165 + i * 125, 440), (PAD + 165 + i * 125, 560),
                   (PAD + 40 + i * 125, 560)], fill=col)
    d.rounded_rectangle([PAD + 220, 600, PAD + 860, 760], 16, fill=(250, 204, 21), outline=(120, 53, 15), width=10)
    d.text((PAD + 270, 625), "CHAI TAPRI", font=_font(96), fill=(127, 29, 29))
    # kettle + glasses
    d.ellipse([PAD + 150, 880, PAD + 330, 1060], fill=(148, 163, 184), outline=(71, 85, 105), width=8)
    for i in range(4):
        x = PAD + 640 + i * 80
        d.rectangle([x, 960, x + 50, 1050], fill=(254, 243, 199), outline=(180, 120, 60), width=4)
    return img, (127, 29, 29)


def abstract(rng: random.Random, brand: str):
    top, bot, acc = [hex_rgb(c) for c in rng.choice(PALETTES)]
    img = _vgrad(top, bot)
    for _ in range(5):
        img = _glow(img, rng.randint(0, SW), rng.randint(0, SH), rng.randint(200, 420),
                    shade(acc, rng.uniform(0.6, 1.1)), 0.35)
    d = ImageDraw.Draw(img)
    for y in range(0, SH, 90):  # subtle grid
        d.line([(0, y), (SW, y)], fill=shade(top, 1.18), width=1)
    for x in range(0, SW, 90):
        d.line([(x, 0), (x, SH)], fill=shade(top, 1.18), width=1)
    return img, acc


SETS = {
    "studio": studio,
    "office": office,
    "canteen": canteen,
    "hostel": hostel,
    "interview": interview,
    "tapri": tapri,
    "abstract": abstract,
}


def build_set(name: str, seed: int, brand: str):
    rng = random.Random(seed)
    fn = SETS.get(name, studio)
    img, accent = fn(rng, brand)
    # depth of field: soften the set so characters pop
    img = img.filter(ImageFilter.GaussianBlur(2.2))
    return img.convert("RGB"), accent
