"""Generate the full PWA icon set from app_logo.png.

Outputs (all written to public/):
  - icons/icon-192.png           192x192   PWA icon, "any"
  - icons/icon-512.png           512x512   PWA icon, "any"
  - icons/icon-maskable-512.png  512x512   PWA icon, "maskable" (padded to safe area)
  - apple-touch-icon.png         180x180   iOS home-screen icon (also used as og:image)
  - icons/icon-1024.png          1024x1024 hero / store listing

The maskable variant centers the original mark on a 512x512 canvas with ~20% safe
padding on every side (Google's recommended safe area for adaptive icons). We
use a near-black warm background (#0a0a0a) to match the existing design tokens.
"""
from PIL import Image
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "app_logo.png"
PUBLIC = ROOT / "public"
ICONS = PUBLIC / "icons"

WARM_BG = (10, 9, 4)  # #0a0904 — matches manifest theme_color family


def fit_square(src: Image.Image, size: int) -> Image.Image:
    """Resize src to fill `size x size` without cropping (full source visible)."""
    return src.resize((size, size), Image.LANCZOS)


def maskable(src: Image.Image, size: int, safe_ratio: float = 0.6) -> Image.Image:
    """Place src on a square background, scaled to fit inside the safe area.

    Google/Mozilla recommendation: keep all important content inside the inner
    60% of the canvas so circular/squircle/rounded-square masks don't crop it.
    """
    bg = Image.new("RGB", (size, size), WARM_BG)
    inner = int(size * safe_ratio)
    mark = src.resize((inner, inner), Image.LANCZOS)
    offset = (size - inner) // 2
    bg.paste(mark, (offset, offset))
    return bg


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f"missing source: {SRC}")

    src = Image.open(SRC).convert("RGB")
    print(f"source: {src.size} mode={src.mode}")

    targets = [
        (192, ICONS / "icon-192.png", "any"),
        (512, ICONS / "icon-512.png", "any"),
        (1024, ICONS / "icon-1024.png", "any"),
    ]
    for size, out, _kind in targets:
        out.parent.mkdir(parents=True, exist_ok=True)
        fit_square(src, size).save(out, format="PNG", optimize=True)
        print(f"  wrote {out.relative_to(ROOT)} ({size}x{size})")

    # Maskable — padded to safe area
    mask_path = ICONS / "icon-maskable-512.png"
    maskable(src, 512).save(mask_path, format="PNG", optimize=True)
    print(f"  wrote {mask_path.relative_to(ROOT)} (512x512 maskable)")

    # Apple touch icon
    apple = fit_square(src, 180)
    apple.save(PUBLIC / "apple-touch-icon.png", format="PNG", optimize=True)
    print(f"  wrote {Path('public/apple-touch-icon.png').as_posix()} (180x180)")

    print("done.")


if __name__ == "__main__":
    main()
