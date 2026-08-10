type ProgressiveBlurProps = {
  side?: 'top' | 'bottom'
  height?: number
  className?: string
}

const LAYER_COUNT = 6

/** Stacked, increasingly-blurred + masked layers that fade content out softly as it slides
 * beneath the header/dock, instead of an abrupt hard edge — real depth-of-field, not a gradient PNG. */
export function ProgressiveBlur({ side = 'top', height = 96, className = '' }: ProgressiveBlurProps) {
  const layers = Array.from({ length: LAYER_COUNT })

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-x-0 z-20 ${side === 'top' ? 'top-0' : 'bottom-0'} ${className}`}
      style={{ height }}
    >
      {layers.map((_, index) => {
        const blur = Math.pow(2, index + 1)
        const start = (index / LAYER_COUNT) * 100
        const end = ((index + 1) / LAYER_COUNT) * 100
        const gradientDirection = side === 'top' ? 'to bottom' : 'to top'
        const mask = `linear-gradient(${gradientDirection}, black ${start}%, black ${end}%, transparent ${end}%)`
        return (
          <div
            key={index}
            className="absolute inset-0"
            style={{
              backdropFilter: `blur(${blur}px)`,
              WebkitBackdropFilter: `blur(${blur}px)`,
              maskImage: mask,
              WebkitMaskImage: mask,
            }}
          />
        )
      })}
    </div>
  )
}
