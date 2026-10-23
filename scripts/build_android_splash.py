"""Generate the Android splash assets for Vault.

Everything is derived from tracked sources so the assets can be rebuilt from a
clean checkout:

  app_logo.png                                  the Vault mark (glyph artwork)
  android/app/src/main/res/values/colors.xml    vault_launch_background (#140C07)

Outputs:
  android/app/src/main/res/drawable-nodpi/splash_logo.png   864x864 transparent
                                                             icon for the native
                                                             splash screen
  android/app/src/main/res/drawable*/splash.png             legacy full-screen
                                                             splash images

The native splash (androidx core-splashscreen) draws `splash_logo.png` into a
288dp slot and masks it to a 192dp circle, so the mark is scaled so that its
bounding *diagonal* is 53% of the 864px canvas. That keeps the mark at ~80% of
the visible mask circle - large enough to read, small enough to never be
cropped - with transparent padding on every side.

The legacy images are the pre-Android-12 fallbacks: a flat launch background
with the mark centred, sized at 18% of the shorter canvas edge.
"""
import re
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "app_logo.png"
RES = ROOT / "android" / "app" / "src" / "main" / "res"
COLORS_XML = RES / "values" / "colors.xml"

# The Vault mark cream, sampled from the tracked source artwork (app_logo.png):
# the median of its solid-body pixels is exactly #EED6B6, and the shipped
# launcher icons sit at #EED5B5 / #EDD5B5. Using the artwork's own colour keeps
# the native splash, the launcher icon and the in-app mark in one family
# instead of washing the mark out to a much lighter tint.
CREAM = (0xEE, 0xD6, 0xB6)  # #EED6B6
LOGO_SIZE = 864
LOGO_DIAGONAL_RATIO = 0.53
LEGACY_HEIGHT_RATIO = 0.18

# Canvas size per legacy drawable folder (matches the Capacitor template).
LEGACY_TARGETS = {
    "drawable": (480, 320),
    "drawable-land-mdpi": (480, 320),
    "drawable-port-mdpi": (320, 480),
    "drawable-land-hdpi": (800, 480),
    "drawable-port-hdpi": (480, 800),
    "drawable-land-xhdpi": (1280, 720),
    "drawable-port-xhdpi": (720, 1280),
    "drawable-land-xxhdpi": (1600, 960),
    "drawable-port-xxhdpi": (960, 1600),
    "drawable-land-xxxhdpi": (1920, 1280),
    "drawable-port-xxxhdpi": (1280, 1920),
}


def launch_background() -> tuple[int, int, int]:
    """Read vault_launch_background from colors.xml so the two never drift."""
    if not COLORS_XML.exists():
        raise SystemExit(f"missing resource: {COLORS_XML}")
    xml = COLORS_XML.read_text(encoding="utf-8")
    match = re.search(
        r'<color\s+name="vault_launch_background"\s*>(#[0-9A-Fa-f]{6})</color>', xml
    )
    if not match:
        raise SystemExit("colors.xml has no vault_launch_background colour")
    value = match.group(1).lstrip("#")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]


def glyph_mask(src: Image.Image) -> Image.Image:
    """Turn the mark artwork into an 8-bit alpha mask.

    app_logo.png is a cream mark on a near-black background, so the brightest
    channel doubles as coverage. The reference level is the median of the
    solid-ink pixels, which makes the solid body fully opaque while the
    antialiased edge keeps its original falloff.
    """
    grey = src.convert("RGB")
    width, height = grey.size
    pixels = grey.load()
    brightness = [max(pixels[x, y]) for y in range(height) for x in range(width)]
    solid = sorted(b for b in brightness if b > 64)
    if not solid:
        raise SystemExit("app_logo.png contains no mark")
    reference = solid[len(solid) // 2] or 1

    mask = Image.new("L", grey.size, 0)
    out = mask.load()
    for y in range(height):
        for x in range(width):
            value = brightness[y * width + x] * 255 // reference
            out[x, y] = 255 if value > 255 else value
    return mask


def crop_to_ink(mask: Image.Image) -> Image.Image:
    """Trim the transparent border, keeping the mark's antialiased edge."""
    box = mask.point(lambda v: 255 if v > 8 else 0).getbbox()
    if box is None:
        raise SystemExit("mark mask is empty")
    return mask.crop(box)


def scale_mark(mark: Image.Image, factor: float) -> Image.Image:
    """Rescale a cropped mark by `factor`, keeping its aspect ratio."""
    return mark.resize(
        (max(1, round(mark.size[0] * factor)), max(1, round(mark.size[1] * factor))),
        Image.LANCZOS,
    )


def centered_offset(size: tuple[int, int], mark: Image.Image) -> tuple[int, int]:
    return ((size[0] - mark.size[0]) // 2, (size[1] - mark.size[1]) // 2)


def cream_channels(size: tuple[int, int]) -> tuple[Image.Image, Image.Image, Image.Image]:
    return tuple(Image.new("L", size, channel) for channel in CREAM)  # type: ignore[return-value]


def build_logo(mask: Image.Image) -> Image.Image:
    """864x864 transparent icon whose mark diagonal is 53% of the canvas.

    Written with *straight* (non-premultiplied) alpha: the colour channels are
    a flat cream everywhere and the mark's coverage lives in the alpha channel,
    which is what PNG decoders on Android expect.
    """
    ink = crop_to_ink(mask)
    diagonal = (ink.size[0] ** 2 + ink.size[1] ** 2) ** 0.5
    mark = scale_mark(ink, LOGO_SIZE * LOGO_DIAGONAL_RATIO / diagonal)

    alpha = Image.new("L", (LOGO_SIZE, LOGO_SIZE), 0)
    alpha.paste(mark, centered_offset((LOGO_SIZE, LOGO_SIZE), mark))
    return Image.merge("RGBA", cream_channels((LOGO_SIZE, LOGO_SIZE)) + (alpha,))


def build_legacy(mask: Image.Image, size: tuple[int, int], background) -> Image.Image:
    """Flat launch background with the mark centred at 18% of the short edge.

    The legacy image is fully opaque, so the mark is composited straight onto
    the launch background and the alpha channel stays at 255.
    """
    ink = crop_to_ink(mask)
    mark = scale_mark(ink, round(min(size) * LEGACY_HEIGHT_RATIO) / ink.size[1])

    canvas = Image.new("RGB", size, background)
    canvas.paste(Image.new("RGB", mark.size, CREAM), centered_offset(size, mark), mark)
    return canvas.convert("RGBA")


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f"missing source: {SRC}")

    background = launch_background()
    src = Image.open(SRC).convert("RGB")
    print(f"source: {SRC.relative_to(ROOT)} {src.size}")
    print(f"launch background: #{background[0]:02X}{background[1]:02X}{background[2]:02X}")
    print(f"mark colour:       #{CREAM[0]:02X}{CREAM[1]:02X}{CREAM[2]:02X}")

    mask = glyph_mask(src)

    logo_path = RES / "drawable-nodpi" / "splash_logo.png"
    logo_path.parent.mkdir(parents=True, exist_ok=True)
    logo = build_logo(mask)
    logo.save(logo_path, format="PNG", optimize=True)
    print(f"  wrote {logo_path.relative_to(ROOT)} ({LOGO_SIZE}x{LOGO_SIZE})")

    for folder, size in LEGACY_TARGETS.items():
        out = RES / folder / "splash.png"
        out.parent.mkdir(parents=True, exist_ok=True)
        build_legacy(mask, size, background).save(out, format="PNG", optimize=True)
        print(f"  wrote {out.relative_to(ROOT)} ({size[0]}x{size[1]})")

    print("done.")


if __name__ == "__main__":
    main()
