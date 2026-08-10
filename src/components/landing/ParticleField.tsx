import { useMemo } from 'react'
import { motion, useTransform, type MotionValue } from 'motion/react'

type Particle = {
  id: number
  left: string
  top: string
  size: number
  duration: number
  delay: number
  depth: number
}

function makeParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, id) => ({
    id,
    left: `${Math.round((id * 37 + 13) % 100)}%`,
    top: `${Math.round((id * 53 + 7) % 100)}%`,
    size: 2 + (id % 3),
    duration: 6 + (id % 5),
    delay: (id % 4) * 0.7,
    depth: -160 - (id % 4) * 40,
  }))
}

type ParticleFieldProps = {
  /** Overall scroll progress (0-1) — the whole field drifts slightly with it, background-layer
   * parallax at a much smaller amplitude than the book/floating cards in front of it. */
  progress: MotionValue<number>
}

/** Farthest depth layer: faint drifting dust motes behind the journal, giving the void real
 * depth instead of an empty backdrop. Deliberately restrained — no color, low opacity. */
export function ParticleField({ progress }: ParticleFieldProps) {
  const particles = useMemo(() => makeParticles(18), [])
  const fieldY = useTransform(progress, [0, 1], [-16, 16])

  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
      style={{ y: fieldY, transformStyle: 'preserve-3d' }}
    >
      {particles.map((particle) => (
        <motion.span
          key={particle.id}
          className="bg-cloud/40 absolute rounded-full"
          style={{
            left: particle.left,
            top: particle.top,
            width: particle.size,
            height: particle.size,
            z: particle.depth,
          }}
          animate={{ opacity: [0.05, 0.35, 0.05], y: [0, -18, 0] }}
          transition={{
            duration: particle.duration,
            delay: particle.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </motion.div>
  )
}
