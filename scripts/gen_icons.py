"""One-off script to generate PWA icon PNGs matching the PropAgent AI brand mark."""
from PIL import Image, ImageDraw

AMBER_START = (251, 192, 45)   # #FBC02D
AMBER_END = (245, 127, 23)     # #F57F17
NAVY = (10, 22, 40)            # #0A1628 (bg-surface, used for the bolt so it reads on light bg too)

def make_icon(size: int, corner_ratio: float = 0.22) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    px = img.load()
    for y in range(size):
        t = y / (size - 1)
        r = int(AMBER_START[0] + (AMBER_END[0] - AMBER_START[0]) * t)
        g = int(AMBER_START[1] + (AMBER_END[1] - AMBER_START[1]) * t)
        b = int(AMBER_START[2] + (AMBER_END[2] - AMBER_START[2]) * t)
        for x in range(size):
            px[x, y] = (r, g, b, 255)

    mask = Image.new("L", (size, size), 0)
    mdraw = ImageDraw.Draw(mask)
    radius = int(size * corner_ratio)
    mdraw.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)

    bg = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    bg.paste(img, (0, 0), mask)

    draw = ImageDraw.Draw(bg)
    s = size
    bolt = [
        (0.58 * s, 0.12 * s), (0.30 * s, 0.56 * s), (0.46 * s, 0.56 * s),
        (0.40 * s, 0.88 * s), (0.72 * s, 0.42 * s), (0.55 * s, 0.42 * s),
    ]
    draw.polygon(bolt, fill=NAVY + (255,))
    return bg

if __name__ == "__main__":
    import os
    out_dir = "/app_scripts_out"
    os.makedirs(out_dir, exist_ok=True)
    for sz in (192, 512):
        make_icon(sz).save(f"{out_dir}/icon-{sz}.png")
    # apple-touch-icon: no transparency, square corners get rounded by iOS itself
    apple = Image.new("RGBA", (180, 180), (0, 0, 0, 0))
    grad = make_icon(180, corner_ratio=0.0)
    apple.paste(grad, (0, 0), grad)
    apple.convert("RGB").save(f"{out_dir}/apple-touch-icon.png")
    print("done")
