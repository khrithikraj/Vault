/**
 * Free, client-side image compression for files larger than the upload threshold.
 *
 * Uses the browser's Canvas 2D API — no external services or libraries. Resizes the
 * longest edge down to MAX_EDGE pixels and re-encodes, which typically shrinks JPEG/WebP
 * photos dramatically. PNGs (especially screenshots) re-encode to JPEG by default so they
 * actually get smaller — pass `forcePng` to keep true PNG output.
 *
 * NO exact-size guarantees: output depends on the source (photos compress far better than
 * flat graphics). We just aim to get large uploads down under the size threshold when
 * possible. On any failure the caller keeps the ORIGINAL File — we never throw away data.
 */

/** Longest edge we downscale photos to — beyond this, quality gains are invisible. */
const MAX_EDGE = 2048

/** The size threshold (5 MB) above which we suggest optimizing before upload. */
export const OPTIMIZE_THRESHOLD_BYTES = 5 * 1024 * 1024

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read this image.'))
    }
    img.src = url
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not compress this image.'))),
      type,
      quality,
    )
  })
}

/**
 * Compress an image File client-side. Returns a new File whose content type/size reflect
 * the optimized output, or null if the source couldn't be handled (caller keeps original).
 */
export async function compressImage(file: File): Promise<File | null> {
  const isPng = file.type === 'image/png'
  try {
    const img = await loadImage(file)
    const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight))
    const width = Math.max(1, Math.round(img.naturalWidth * scale))
    const height = Math.max(1, Math.round(img.naturalHeight * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(img, 0, 0, width, height)

    // PNG → JPEG only when an alpha-free reduction is safe; otherwise keep PNG quality.
    // Simplest robust choice: PNG → JPEG (photos are the >5 MB problem); transparent PNGs keep PNG.
    let outType = 'image/jpeg'
    if (isPng) {
      const hasAlpha = img.naturalWidth > 0 && ctx.getImageData(0, 0, width, height).data.some((_, i, a) => i % 4 === 3 && a[i] !== 255)
      outType = hasAlpha ? 'image/png' : 'image/jpeg'
    } else if (file.type === 'image/webp') {
      outType = 'image/webp'
    }

    const quality = isPng && outType === 'image/png' ? 0.92 : 0.82
    const blob = await canvasToBlob(canvas, outType, quality)

    if (blob.size >= file.size) {
      // Compression didn't help — keep the original untouched.
      return null
    }

    const ext = outType === 'image/png' ? 'png' : outType === 'image/webp' ? 'webp' : 'jpg'
    const base = file.name.replace(/\.[^/.]+$/, '')
    return new File([blob], `${base}.${ext}`, { type: outType })
  } catch {
    return null
  }
}

/** True when the file is a compressible raster image above the optimization threshold. */
export function shouldOfferOptimize(file: File): boolean {
  return (
    file.size > OPTIMIZE_THRESHOLD_BYTES &&
    (file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/webp')
  )
}
