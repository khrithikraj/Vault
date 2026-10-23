import fs from "node:fs"
import path from "node:path"
import zlib from "node:zlib"
import { describe, expect, it } from "vitest"

/**
 * Contract for the native Android launch experience.
 *
 * These assertions deliberately inspect the real artefacts rather than
 * grepping for fragments: the XML is parsed into a small DOM, and the splash
 * PNGs are decoded and measured (size, colour, alpha, centring, scale). That
 * way a splash that merely *mentions* the right attributes, or an asset that
 * is stretched / off-centre / cropped, fails the suite.
 */

const root = process.cwd()
const RES = "android/app/src/main/res"
const LOGO = `${RES}/drawable-nodpi/splash_logo.png`

const CREAM: Rgb = [0xee, 0xd6, 0xb6] // #EED6B6 — the mark cream sampled from app_logo.png
const LAUNCH_BG: Rgb = [0x14, 0x0c, 0x07] // #140C07
const LAUNCHER_BG = "#0a0904"

const LOGO_SIZE = 864
const ICON_SLOT_DP = 288
const MASK_DIAMETER_DP = 192
const LOGO_DIAGONAL_RATIO = 0.53
const LEGACY_HEIGHT_RATIO = 0.18

const LEGACY_SPLASH: Record<string, [number, number]> = {
  [`${RES}/drawable/splash.png`]: [480, 320],
  [`${RES}/drawable-land-mdpi/splash.png`]: [480, 320],
  [`${RES}/drawable-port-mdpi/splash.png`]: [320, 480],
  [`${RES}/drawable-land-hdpi/splash.png`]: [800, 480],
  [`${RES}/drawable-port-hdpi/splash.png`]: [480, 800],
  [`${RES}/drawable-land-xhdpi/splash.png`]: [1280, 720],
  [`${RES}/drawable-port-xhdpi/splash.png`]: [720, 1280],
  [`${RES}/drawable-land-xxhdpi/splash.png`]: [1600, 960],
  [`${RES}/drawable-port-xxhdpi/splash.png`]: [960, 1600],
  [`${RES}/drawable-land-xxxhdpi/splash.png`]: [1920, 1280],
  [`${RES}/drawable-port-xxxhdpi/splash.png`]: [1280, 1920],
}

const file = (name: string) => path.join(root, name)
const read = (name: string) => fs.readFileSync(file(name), "utf8")

// ---------------------------------------------------------------------------
// Tiny XML reader (node test env has no DOMParser and we do not add a dep).
// ---------------------------------------------------------------------------

type XmlNode = { name: string; attrs: Record<string, string>; text: string; children: XmlNode[] }

function parseAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  const re = /([A-Za-z0-9_.:-]+)\s*=\s*"([^"]*)"/g
  let match: RegExpExecArray | null
  while ((match = re.exec(raw))) attrs[match[1]] = match[2]
  return attrs
}

function parseXml(source: string): XmlNode {
  const text = source.replace(/<!--[\s\S]*?-->/g, "").replace(/<\?[\s\S]*?\?>/g, "")
  const document: XmlNode = { name: "#document", attrs: {}, text: "", children: [] }
  const stack: XmlNode[] = [document]
  const tag = /<\s*(\/?)\s*([A-Za-z0-9_.:-]+)((?:\s+[A-Za-z0-9_.:-]+\s*=\s*"[^"]*")*)\s*(\/?)>/g
  let lastEnd = 0
  let match: RegExpExecArray | null
  while ((match = tag.exec(text))) {
    const between = text.slice(lastEnd, match.index)
    if (between.trim()) stack[stack.length - 1].text += between
    lastEnd = tag.lastIndex
    const [, closing, name, rawAttrs, selfClosing] = match
    if (closing) {
      const open = stack.pop()
      if (!open || open.name !== name) throw new Error(`unbalanced </${name}>`)
      continue
    }
    const node: XmlNode = { name, attrs: parseAttrs(rawAttrs), text: "", children: [] }
    stack[stack.length - 1].children.push(node)
    if (!selfClosing) stack.push(node)
  }
  if (stack.length !== 1) throw new Error("unbalanced XML document")
  return document
}

function findAll(node: XmlNode, name: string): XmlNode[] {
  const found: XmlNode[] = []
  for (const child of node.children) {
    if (child.name === name) found.push(child)
    found.push(...findAll(child, name))
  }
  return found
}

function styleItems(xml: XmlNode, theme: string): Record<string, string> {
  const style = findAll(xml, "style").find((node) => node.attrs.name === theme)
  if (!style) throw new Error(`missing style ${theme}`)
  return Object.fromEntries(findAll(style, "item").map((item) => [item.attrs.name, item.text.trim()]))
}

function styleParent(xml: XmlNode, theme: string): string | undefined {
  return findAll(xml, "style").find((node) => node.attrs.name === theme)?.attrs.parent
}

// ---------------------------------------------------------------------------
// Bare-bones PNG decoder (8-bit, non-interlaced) so the test can measure the
// pixels it ships. Only the filter/colour modes PIL emits are implemented.
// ---------------------------------------------------------------------------

type Rgb = [number, number, number]
type Decoded = { width: number; height: number; rgba: Uint8Array }

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10]

function paeth(a: number, b: number, c: number) {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  if (pb <= pc) return b
  return c
}

function decodePng(name: string): Decoded {
  const buffer = fs.readFileSync(file(name))
  for (let i = 0; i < PNG_SIGNATURE.length; i += 1) {
    if (buffer[i] !== PNG_SIGNATURE[i]) throw new Error(`${name}: not a PNG`)
  }

  let width = 0
  let height = 0
  let bitDepth = 0
  let colorType = 0
  let interlace = 0
  let palette: Buffer | null = null
  let transparency: Buffer | null = null
  const idat: Buffer[] = []

  for (let offset = 8; offset < buffer.length; ) {
    const length = buffer.readUInt32BE(offset)
    const type = buffer.toString("ascii", offset + 4, offset + 8)
    const body = buffer.subarray(offset + 8, offset + 8 + length)
    if (type === "IHDR") {
      width = body.readUInt32BE(0)
      height = body.readUInt32BE(4)
      bitDepth = body[8]
      colorType = body[9]
      interlace = body[12]
    } else if (type === "PLTE") {
      palette = body
    } else if (type === "tRNS") {
      transparency = body
    } else if (type === "IDAT") {
      idat.push(body)
    } else if (type === "IEND") {
      break
    }
    offset += 12 + length
  }

  if (bitDepth !== 8) throw new Error(`${name}: unsupported bit depth ${bitDepth}`)
  if (interlace !== 0) throw new Error(`${name}: interlaced PNGs are not supported`)

  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType]
  if (!channels) throw new Error(`${name}: unsupported colour type ${colorType}`)

  const raw = zlib.inflateSync(Buffer.concat(idat))
  const stride = width * channels
  const scanlines = Buffer.alloc(height * stride)

  for (let y = 0, cursor = 0; y < height; y += 1) {
    const filter = raw[cursor]
    cursor += 1
    const row = y * stride
    const previous = row - stride
    for (let x = 0; x < stride; x += 1) {
      const value = raw[cursor]
      cursor += 1
      const left = x >= channels ? scanlines[row + x - channels] : 0
      const up = y > 0 ? scanlines[previous + x] : 0
      const upLeft = y > 0 && x >= channels ? scanlines[previous + x - channels] : 0
      const predictor =
        filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? up : filter === 3 ? (left + up) >> 1 : paeth(left, up, upLeft)
      if (filter > 4) throw new Error(`${name}: bad filter ${filter}`)
      scanlines[row + x] = (value + predictor) & 0xff
    }
  }

  const rgba = new Uint8Array(width * height * 4)
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const source = pixel * channels
    const target = pixel * 4
    let red = 0
    let green = 0
    let blue = 0
    let alpha = 255
    if (colorType === 0 || colorType === 4) {
      red = green = blue = scanlines[source]
      if (colorType === 4) alpha = scanlines[source + 1]
    } else if (colorType === 2) {
      red = scanlines[source]
      green = scanlines[source + 1]
      blue = scanlines[source + 2]
    } else if (colorType === 6) {
      red = scanlines[source]
      green = scanlines[source + 1]
      blue = scanlines[source + 2]
      alpha = scanlines[source + 3]
    } else if (colorType === 3 && palette) {
      const index = scanlines[source]
      red = palette[index * 3]
      green = palette[index * 3 + 1]
      blue = palette[index * 3 + 2]
      if (transparency && index < transparency.length) alpha = transparency[index]
    }
    rgba[target] = red
    rgba[target + 1] = green
    rgba[target + 2] = blue
    rgba[target + 3] = alpha
  }

  return { width, height, rgba }
}

function pixel(image: Decoded, x: number, y: number): [number, number, number, number] {
  const offset = (y * image.width + x) * 4
  return [image.rgba[offset], image.rgba[offset + 1], image.rgba[offset + 2], image.rgba[offset + 3]]
}

type Box = { left: number; top: number; right: number; bottom: number; width: number; height: number }

function inkBox(image: Decoded, isInk: (x: number, y: number) => boolean): Box | null {
  let left = image.width
  let top = image.height
  let right = -1
  let bottom = -1
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      if (!isInk(x, y)) continue
      if (x < left) left = x
      if (x > right) right = x
      if (y < top) top = y
      if (y > bottom) bottom = y
    }
  }
  if (right < 0) return null
  return { left, top, right, bottom, width: right - left + 1, height: bottom - top + 1 }
}

const close = (a: number, b: number, tolerance: number) => Math.abs(a - b) <= tolerance

/** Ink of the app_logo.png artwork, used as the "true" aspect ratio. */
function artworkAspect(): number {
  const logo = decodePng("app_logo.png")
  const box = inkBox(logo, (x, y) => Math.max(...pixel(logo, x, y).slice(0, 3)) > 64)
  if (!box) throw new Error("app_logo.png has no ink")
  return box.width / box.height
}

/**
 * The solid-body colour of a cream-on-dark artwork: the per-channel median of
 * every pixel that is brighter than the background. This is the colour the
 * splash mark is supposed to reproduce, so it is the reference the generated
 * assets are checked against.
 */
function artworkCream(name: string): Rgb {
  const image = decodePng(name)
  const channels: number[][] = [[], [], []]
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const [red, green, blue] = pixel(image, x, y)
      if (Math.max(red, green, blue) <= 64) continue
      channels[0].push(red)
      channels[1].push(green)
      channels[2].push(blue)
    }
  }
  if (!channels[0].length) throw new Error(`${name} has no cream`)
  const median = (values: number[]) => values.slice().sort((a, b) => a - b)[values.length >> 1]
  return [median(channels[0]), median(channels[1]), median(channels[2])]
}

// ---------------------------------------------------------------------------

describe("android splash contract", () => {
  describe("launch colour", () => {
    it("declares the brand background in colors.xml", () => {
      const colors = parseXml(read(`${RES}/values/colors.xml`))
      const colour = findAll(colors, "color").find((node) => node.attrs.name === "vault_launch_background")
      expect(colour?.text.trim()).toBe("#140C07")
    })

    it("keeps the Capacitor web view on the same background", () => {
      const config = read("capacitor.config.ts")
      expect(config).toMatch(/appId:\s*'com\.khrithikraj\.vault'/)
      expect(config).toMatch(/appName:\s*"Raj's Vault"/)
      expect(config).toMatch(/backgroundColor:\s*'#140C07'/)
    })
  })

  describe("themes", () => {
    const styles = parseXml(read(`${RES}/values/styles.xml`))

    it("uses Theme.SplashScreen for the launch theme", () => {
      expect(styleParent(styles, "AppTheme.NoActionBarLaunch")).toBe("Theme.SplashScreen")
    })

    it("points the splash at the branded colour and icon", () => {
      const items = styleItems(styles, "AppTheme.NoActionBarLaunch")
      expect(items.windowSplashScreenBackground).toBe("@color/vault_launch_background")
      expect(items.windowSplashScreenAnimatedIcon).toBe("@drawable/splash_logo")
      expect(items.splashScreenIconSize).toBe("288dp")
      expect(items.postSplashScreenTheme).toBe("@style/AppTheme.NoActionBar")
    })

    it("hands off to a post-splash theme with no colour flash", () => {
      const items = styleItems(styles, "AppTheme.NoActionBar")
      expect(items["android:windowBackground"]).toBe("@color/vault_launch_background")
      expect(items["android:statusBarColor"]).toBe("@color/vault_launch_background")
      expect(items["android:navigationBarColor"]).toBe("@color/vault_launch_background")
      expect(items["android:windowLightStatusBar"]).toBe("false")
    })

    it("keeps the launch window itself on the brand colour", () => {
      const items = styleItems(styles, "AppTheme.NoActionBarLaunch")
      expect(items["android:windowBackground"]).toBe("@color/vault_launch_background")
      expect(items["android:statusBarColor"]).toBe("@color/vault_launch_background")
      expect(items["android:navigationBarColor"]).toBe("@color/vault_launch_background")
    })
  })

  describe("manifest wiring", () => {
    const manifest = parseXml(read("android/app/src/main/AndroidManifest.xml"))

    it("launches MainActivity with the splash theme", () => {
      const activity = findAll(manifest, "activity").find((node) => node.attrs["android:name"] === ".MainActivity")
      expect(activity?.attrs["android:theme"]).toBe("@style/AppTheme.NoActionBarLaunch")
      expect(activity?.attrs["android:exported"]).toBe("true")
    })

    it("keeps the application theme separate from the launch theme", () => {
      const application = findAll(manifest, "application")[0]
      expect(application.attrs["android:theme"]).toBe("@style/AppTheme")
    })

    it("still wires the launcher icon and alarm components", () => {
      const application = findAll(manifest, "application")[0]
      expect(application.attrs["android:icon"]).toBe("@mipmap/ic_launcher")
      expect(application.attrs["android:roundIcon"]).toBe("@mipmap/ic_launcher_round")
      const receivers = findAll(application, "receiver").map((node) => node.attrs["android:name"])
      expect(receivers).toContain(".alarm.AlarmReceiver")
      expect(receivers).toContain(".alarm.AlarmDismissReceiver")
    })
  })

  describe("native wiring", () => {
    it("installs the splash before super.onCreate", () => {
      const java = read("android/app/src/main/java/com/khrithikraj/vault/MainActivity.java")
      expect(java).toContain("import androidx.core.splashscreen.SplashScreen;")
      const install = java.indexOf("SplashScreen.installSplashScreen(this)")
      const onCreate = java.indexOf("super.onCreate(")
      expect(install).toBeGreaterThan(-1)
      expect(onCreate).toBeGreaterThan(-1)
      expect(install).toBeLessThan(onCreate)
    })

    it("does not drop the alarm plugin or intent handling", () => {
      const java = read("android/app/src/main/java/com/khrithikraj/vault/MainActivity.java")
      expect(java).toContain("registerPlugin(VaultAlarmPlugin.class)")
      expect(java).toMatch(/getIntent\(\)|onNewIntent/)
    })

    it("depends on core-splashscreen", () => {
      expect(read("android/app/build.gradle")).toMatch(/androidx\.core:core-splashscreen:\$\{?coreSplashScreenVersion\}?/)
      expect(read("android/variables.gradle")).toMatch(/coreSplashScreenVersion\s*=\s*'[\d.]+'/)
    })
  })

  describe("splash icon", () => {
    const logo = decodePng(LOGO)
    const inkBoxOfLogo = inkBox(logo, (x, y) => pixel(logo, x, y)[3] > 8)

    it("is a square 288dp icon slot with transparent padding", () => {
      expect(logo.width).toBe(LOGO_SIZE)
      expect(logo.height).toBe(LOGO_SIZE)
      for (const [x, y] of [
        [0, 0],
        [logo.width - 1, 0],
        [0, logo.height - 1],
        [logo.width - 1, logo.height - 1],
      ]) {
        expect(pixel(logo, x, y)[3]).toBe(0)
      }
      expect(inkBoxOfLogo).not.toBeNull()
    })

    it("draws the mark in the brand cream", () => {
      const colours = new Set<string>()
      for (let y = 0; y < logo.height; y += 1) {
        for (let x = 0; x < logo.width; x += 1) {
          const [red, green, blue, alpha] = pixel(logo, x, y)
          if (alpha > 0) colours.add(`${red},${green},${blue}`)
        }
      }
      expect([...colours]).toEqual([CREAM.join(",")])
    })

    it("uses the same cream as the tracked source artwork", () => {
      // The splash mark is derived from app_logo.png, so it has to be painted
      // in that artwork's own cream. A lighter tint would wash the mark out
      // and make the launch screen disagree with the launcher icon.
      expect(CREAM).toEqual(artworkCream("app_logo.png"))
    })

    it("stays in the same colour family as the launcher icon", () => {
      const launcher = artworkCream(`${RES}/mipmap-xxxhdpi/ic_launcher_foreground.png`)
      launcher.forEach((channel, index) => {
        expect(Math.abs(channel - CREAM[index])).toBeLessThanOrEqual(3)
      })
    })

    it("centres the mark with even padding", () => {
      const box = inkBoxOfLogo as Box
      expect(close(box.left, logo.width - box.right - 1, 2)).toBe(true)
      expect(close(box.top, logo.height - box.bottom - 1, 2)).toBe(true)
      const centreX = box.left + box.width / 2
      const centreY = box.top + box.height / 2
      expect(close(centreX, logo.width / 2, 2)).toBe(true)
      expect(close(centreY, logo.height / 2, 2)).toBe(true)
    })

    it("keeps a sensible transparent margin", () => {
      const box = inkBoxOfLogo as Box
      const margin = 0.04
      expect(box.left).toBeGreaterThanOrEqual(logo.width * margin)
      expect(box.top).toBeGreaterThanOrEqual(logo.height * margin)
      expect(logo.width - box.right - 1).toBeGreaterThanOrEqual(logo.width * margin)
      expect(logo.height - box.bottom - 1).toBeGreaterThanOrEqual(logo.height * margin)
    })

    it("preserves the artwork aspect ratio (not stretched)", () => {
      const box = inkBoxOfLogo as Box
      expect(box.width / box.height).toBeCloseTo(artworkAspect(), 1)
    })

    it("scales the mark to a readable size that the mask cannot crop", () => {
      const box = inkBoxOfLogo as Box
      const diagonal = Math.hypot(box.width, box.height)
      expect(diagonal / logo.width).toBeCloseTo(LOGO_DIAGONAL_RATIO, 1)
      const maskDiameter = LOGO_SIZE * (MASK_DIAMETER_DP / ICON_SLOT_DP)
      expect(diagonal).toBeLessThanOrEqual(maskDiameter)
    })

    it("is a solid mark, not a faint ghost", () => {
      let opaque = 0
      for (let y = 0; y < logo.height; y += 1) {
        for (let x = 0; x < logo.width; x += 1) {
          if (pixel(logo, x, y)[3] === 255) opaque += 1
        }
      }
      expect(opaque).toBeGreaterThan(logo.width * logo.height * 0.02)
    })
  })

  describe("legacy splash images", () => {
    const aspect = artworkAspect()

    for (const [asset, [width, height]] of Object.entries(LEGACY_SPLASH)) {
      it(`${asset.split("/").slice(-2).join("/")} is a branded ${width}x${height} image`, () => {
        expect(fs.existsSync(file(asset))).toBe(true)
        const image = decodePng(asset)
        expect([image.width, image.height]).toEqual([width, height])

        for (const [x, y] of [
          [0, 0],
          [width - 1, 0],
          [0, height - 1],
          [width - 1, height - 1],
        ]) {
          expect(pixel(image, x, y)).toEqual([...LAUNCH_BG, 255])
        }

        const box = inkBox(image, (x, y) => {
          const [red, green, blue] = pixel(image, x, y)
          return Math.abs(red - LAUNCH_BG[0]) + Math.abs(green - LAUNCH_BG[1]) + Math.abs(blue - LAUNCH_BG[2]) > 24
        })
        expect(box).not.toBeNull()
        if (!box) return

        const centreX = box.left + box.width / 2
        const centreY = box.top + box.height / 2
        expect(close(centreX, width / 2, 2)).toBe(true)
        expect(close(centreY, height / 2, 2)).toBe(true)
        expect(box.height / Math.min(width, height)).toBeCloseTo(LEGACY_HEIGHT_RATIO, 1)
        expect(box.width / box.height).toBeCloseTo(aspect, 1)
      })
    }
  })

  describe("launcher icons", () => {
    it("keeps the adaptive launcher icon independent from the splash", () => {
      const adaptive = parseXml(read(`${RES}/mipmap-anydpi-v26/ic_launcher.xml`))
      const background = findAll(adaptive, "background")[0]
      const foreground = findAll(adaptive, "foreground")[0]
      expect(background.attrs["android:drawable"]).toBe("@color/ic_launcher_background")
      expect(foreground.attrs["android:drawable"]).toBe("@mipmap/ic_launcher_foreground")

      const colours = parseXml(read(`${RES}/values/ic_launcher_background.xml`))
      const colour = findAll(colours, "color")[0]
      expect(colour.attrs.name).toBe("ic_launcher_background")
      expect(colour.text.trim()).toBe(LAUNCHER_BG)
      expect(colour.text.trim().toLowerCase()).not.toBe("#140c07")
    })

    it("does not reuse the splash asset as the launcher image", () => {
      const launcher = fs.readFileSync(file(`${RES}/mipmap-xxxhdpi/ic_launcher.png`))
      const splash = fs.readFileSync(file(LOGO))
      expect(launcher.equals(splash)).toBe(false)
    })
  })
})
