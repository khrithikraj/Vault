import type { CSSProperties, ReactNode } from 'react'
import { motion, useMotionTemplate, useTransform, type MotionValue } from 'motion/react'
import { ORBIT_RANGE, ORBIT_RADIUS } from './storyboard'

type IdleDrift = {
  x?: number
  y?: number
  rotate?: number
  duration?: number
}

type EmergingObjectProps = {
  /** Raw overall scroll progress (0-1) — used only to drive the shared pre-retract orbit climax. */
  progress: MotionValue<number>
  /** 0 = tucked flat into the page, 1 = fully emerged and settled at its resting spot. Shared
   * across a layer's whole lifetime (emerge, hold, and retract are all just this value moving
   * 0->1->0). */
  emergeProgress: MotionValue<number>
  /** Resting translateZ once fully emerged — the "how far off the page" depth for parallax. */
  depthZ: number
  /** Resting position, as a percentage of the world box — where the object settles once fully
   * emerged. The object always originates from the page surface itself (50%, 50%) and travels
   * outward to here as `emergeProgress` rises, and travels back as it falls. */
  restX: number
  restY: number
  /** Percentage origin on the page surface the object rises from — defaults to the page center. */
  originX?: number
  originY?: number
  /** Tilt reached once fully emerged; flat (0deg) against the page while still tucked in. */
  restRotateDeg?: number
  /** This object's phase (degrees) around the shared climax orbit, so a layer's objects circle
   * the journal spread evenly instead of overlapping. */
  orbitPhase?: number
  orbitRadius?: number
  /** Small endless idle wobble so a settled object still reads as suspended, not frozen. */
  idleDrift?: IdleDrift
  className?: string
  style?: CSSProperties
  children: ReactNode
}

/** One floating 3D object that rises out of the journal's own page surface, drifts at its own
 * depth while emerged, sweeps into the shared climax orbit just before the ending, and sinks
 * back flat into the page as `emergeProgress` returns to 0 — the shared building block for the
 * photo/category/search card layers. */
export function EmergingObject({
  progress,
  emergeProgress,
  depthZ,
  restX,
  restY,
  originX = 50,
  originY = 50,
  restRotateDeg = 0,
  orbitPhase = 0,
  orbitRadius = ORBIT_RADIUS,
  idleDrift,
  className,
  style,
  children,
}: EmergingObjectProps) {
  // Position: travels from the page surface itself (the origin) out to its resting spot.
  const leftPct = useTransform(emergeProgress, [0, 1], [originX, restX])
  const topPct = useTransform(emergeProgress, [0, 1], [originY, restY])
  const left = useMotionTemplate`${leftPct}%`
  const top = useMotionTemplate`${topPct}%`
  const restRotate = useTransform(emergeProgress, [0, 1], [0, restRotateDeg])
  const rotate = useMotionTemplate`${restRotate}deg`

  // Climax orbit: every emerged object sweeps once around the journal right before retracting.
  const orbitAngleDeg = useTransform(progress, [ORBIT_RANGE[0], ORBIT_RANGE[1]], [orbitPhase, orbitPhase + 340])
  const orbitStrength = useTransform(
    progress,
    [ORBIT_RANGE[0], ORBIT_RANGE[0] + 0.015, ORBIT_RANGE[1] - 0.015, ORBIT_RANGE[1]],
    [0, 1, 1, 0],
  )
  const orbitX = useTransform([orbitAngleDeg, orbitStrength], (latest) => {
    const [angle, strength] = latest as [number, number]
    return Math.cos((angle * Math.PI) / 180) * strength * orbitRadius
  })
  const orbitY = useTransform([orbitAngleDeg, orbitStrength], (latest) => {
    const [angle, strength] = latest as [number, number]
    return Math.sin((angle * Math.PI) / 180) * strength * orbitRadius * 0.6
  })

  const opacity = emergeProgress
  const scale = useTransform(emergeProgress, [0, 1], [0.35, 1])
  const rise = useTransform(emergeProgress, [0, 1], [10, 0])
  const z = useTransform(emergeProgress, [0, 1], [0, depthZ])
  const pointerEvents = useTransform(emergeProgress, (value) => (value > 0.6 ? 'auto' : 'none'))

  return (
    <motion.div
      aria-hidden="true"
      className={className}
      style={{ position: 'absolute', left, top, rotate, transformStyle: 'preserve-3d', ...style }}
    >
      <motion.div style={{ x: orbitX, y: orbitY, transformStyle: 'preserve-3d' }}>
        <motion.div
          style={{ transformStyle: 'preserve-3d' }}
          animate={
            idleDrift
              ? {
                  x: [0, idleDrift.x ?? 0, 0],
                  y: [0, idleDrift.y ?? 0, 0],
                  rotate: [0, idleDrift.rotate ?? 0, 0],
                }
              : undefined
          }
          transition={
            idleDrift ? { duration: idleDrift.duration ?? 8, repeat: Infinity, ease: 'easeInOut' } : undefined
          }
        >
          <motion.div style={{ opacity, scale, y: rise, z, pointerEvents, transformStyle: 'preserve-3d' }}>
            {children}
          </motion.div>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}
