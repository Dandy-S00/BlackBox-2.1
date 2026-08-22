"""
Generate all required launcher icon assets for the BlackBox Expo app.

Outputs:
  assets/images/icon.png                    — 1024×1024 app icon
  assets/images/splash-icon.png             — 1024×1024 splash icon
  assets/images/favicon.png                 — 64×64 favicon
  assets/images/android-icon-foreground.png — 1024×1024 adaptive foreground
  assets/images/android-icon-background.png — 1024×1024 adaptive background
  assets/images/android-icon-monochrome.png — 1024×1024 adaptive monochrome
"""

import math
import os
from pathlib import Path

from PIL import Image, ImageDraw

ASSETS = Path(__file__).parent.parent / "assets" / "images"
ASSETS.mkdir(parents=True, exist_ok=True)

# ── Palette ──────────────────────────────────────────────────────────────────
BG       = (16,  22,  32)   # #101620  Obsidian
SURFACE  = (26,  36,  49)   # #1A2431  Slate
TEAL     = (42, 212, 196)   # #2AD4C4  Signal Teal
WHITE    = (244, 247, 250)  # #F4F7FA  Cloud


def draw_cube(draw: ImageDraw.ImageDraw, cx: int, cy: int, size: int,
              face_color, edge_color, line_width: int = 4) -> None:
    """Draw a simple isometric cube centred at (cx, cy) with the given half-size."""
    h = size // 2
    q = h // 2  # quarter-size offset for the isometric top face

    # Top face (parallelogram)
    top = [
        (cx,      cy - h),        # top vertex
        (cx + h,  cy - h + q),    # right vertex
        (cx,      cy - h + 2*q),  # bottom vertex
        (cx - h,  cy - h + q),    # left vertex
    ]
    # Right face
    right = [
        (cx + h,  cy - h + q),
        (cx + h,  cy + q),
        (cx,      cy + h),
        (cx,      cy - h + 2*q),
    ]
    # Left face (slightly darker)
    left = [
        (cx - h,  cy - h + q),
        (cx,      cy - h + 2*q),
        (cx,      cy + h),
        (cx - h,  cy + q),
    ]

    # Darken left face
    dark = tuple(max(0, c - 30) for c in face_color)

    draw.polygon(top,   fill=face_color)
    draw.polygon(right, fill=face_color)
    draw.polygon(left,  fill=dark)

    # Edges
    for poly in (top, right, left):
        draw.polygon(poly, outline=edge_color)
    for pts in (top, right, left):
        for i in range(len(pts)):
            draw.line([pts[i], pts[(i + 1) % len(pts)]], fill=edge_color, width=line_width)


def make_icon(size: int = 1024) -> Image.Image:
    img = Image.new("RGBA", (size, size), BG + (255,))
    draw = ImageDraw.Draw(img)

    # Subtle radial gradient overlay
    cx, cy = size // 2, size // 2
    for r in range(min(cx, cy), 0, -1):
        alpha = int(30 * (1 - r / min(cx, cy)))
        draw.ellipse(
            [cx - r, cy - r, cx + r, cy + r],
            fill=SURFACE + (alpha,),
        )

    cube_size = int(size * 0.36)
    draw_cube(draw, cx, cy, cube_size, SURFACE, TEAL, max(2, size // 128))

    # Teal glow ring around cube
    glow_r = int(size * 0.42)
    for thickness in range(6, 0, -1):
        a = int(18 * thickness)
        draw.ellipse(
            [cx - glow_r, cy - glow_r, cx + glow_r, cy + glow_r],
            outline=TEAL + (a,),
            width=thickness,
        )

    return img.convert("RGB")


def make_foreground(size: int = 1024) -> Image.Image:
    """Adaptive icon foreground: cube on transparent background."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    cube_size = int(size * 0.30)
    cx, cy = size // 2, size // 2
    draw_cube(draw, cx, cy, cube_size, SURFACE, TEAL, max(2, size // 128))
    return img


def make_background(size: int = 1024) -> Image.Image:
    img = Image.new("RGB", (size, size), BG)
    return img


def make_monochrome(size: int = 1024) -> Image.Image:
    """Single-colour silhouette for Android monochrome adaptive icon."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    cube_size = int(size * 0.30)
    cx, cy = size // 2, size // 2
    draw_cube(draw, cx, cy, cube_size, WHITE, WHITE, max(2, size // 128))
    return img


def save(img: Image.Image, path: Path, size: tuple[int, int] | None = None) -> None:
    if size:
        img = img.resize(size, Image.LANCZOS)
    img.save(path, "PNG")
    print(f"  wrote {path.relative_to(Path.cwd())}  ({path.stat().st_size:,} bytes)")


if __name__ == "__main__":
    print("Generating BlackBox launcher assets …")
    icon = make_icon(1024)
    save(icon, ASSETS / "icon.png")
    save(icon, ASSETS / "splash-icon.png")
    save(icon.resize((64, 64), Image.LANCZOS), ASSETS / "favicon.png")

    save(make_foreground(1024), ASSETS / "android-icon-foreground.png")
    save(make_background(1024), ASSETS / "android-icon-background.png")
    save(make_monochrome(1024), ASSETS / "android-icon-monochrome.png")
    print("Done.")
