import { motion } from 'motion/react'

type BorderTrailProps = {
  color?: string
  size?: number
  duration?: number
}

/** A glowing comet that travels endlessly around a rounded border — layer this inside any
 * `position: relative; overflow: hidden` container to mark it as "active"/"in focus". */
export function BorderTrail({ color = 'rgba(255,255,255,0.95)', size = 60, duration = 4.5 }: BorderTrailProps) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
      <motion.div
        className="absolute top-0 left-0 aspect-square"
        style={{
          width: size,
          background: `radial-gradient(circle closest-side, ${color}, transparent)`,
          offsetPath: `rect(0px auto auto 0px round ${size}px)` as unknown as string,
        }}
        animate={{ offsetDistance: ['0%', '100%'] }}
        transition={{ duration, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  )
}
