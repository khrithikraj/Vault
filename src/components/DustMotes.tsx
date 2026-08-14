import { useMemo } from 'react'
import { motion } from 'motion/react'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'

type DustMotesProps = {
  /** Number of motes drifting in the warm dark. Default 16. */
  count?: number
  className?: string
  /** Mote color (defaults to the warm cream specks). */
  color?: string
  /** Soft glow tint cast by each mote (defaults to a dimmed cream). */
  glow?: string
}

/** Ambient dust drifting in the warm dark — tiny specks on slow, independent float paths.
 * The `color`/`glow` props let callers dial in a second tone (e.g. sparse ember motes) while
 * keeping the same float choreography. Purely decorative and reduced-motion-safe (renders
 * nothing when motion is reduced). */
export function DustMotes({
  count = 16,
  className = '',
  color = 'rgba(255,237,215,0.9)',
  glow = 'rgba(255,237,215,0.45)',
}: DustMotesProps) {
  const reducedMotion = usePrefersReducedMotion()
  const motes = useMemo(
    () =>
      Array.from({ length: count }, (_, index) => ({
        id: index,
        left: (index * 53 + 11) % 100,
        top: (index * 37 + 7) % 100,
        size: 1.5 + ((index * 29) % 10) / 6,
        driftX: (index % 2 === 0 ? 1 : -1) * (12 + (index % 3) * 9),
        rise: 40 + (index % 5) * 14,
        delay: (index % 8) * 0.7,
        duration: 9 + (index % 5) * 2.6,
        opacity: 0.22 + (index % 4) * 0.11,
      })),
    [count],
  )

  if (reducedMotion) {
    return null
  }

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 z-0 overflow-hidden ${className}`}
    >
      {motes.map((mote) => (
        <motion.span
          key={mote.id}
          className="absolute rounded-full"
          style={{
            left: `${mote.left}%`,
            top: `${mote.top}%`,
            width: mote.size,
            height: mote.size,
            background: color,
            boxShadow: `0 0 6px ${glow}`,
            opacity: mote.opacity,
          }}
          animate={{
            y: [0, -mote.rise, 0],
            x: [0, mote.driftX, 0],
            opacity: [mote.opacity, mote.opacity * 0.35, mote.opacity],
          }}
          transition={{
            duration: mote.duration,
            delay: mote.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  )
}
