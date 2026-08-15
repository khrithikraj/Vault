import { motion } from 'motion/react'
import type { CSSProperties } from 'react'
import type { Category } from '../types/app'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'

/* ------------------------------------------------------------------ */
/* The background's hero: a massive bank-vault door rising out of the  */
/* bottom-right corner, cropped like it's emerging from the void. A    */
/* static frame + hinges ground it as a door; three radial layers      */
/* (tick ring, spoke wheel, knob handle) counter-rotate at different   */
/* speeds so it reads alive, and an ember core breathes in the active  */
/* category's color. The whole assembly sits in a slight CSS-3D tilt   */
/* and rocks imperceptibly. Purely decorative (aria-hidden),           */
/* reduced-motion safe (static tilt, no rotation, core at rest).       */
/* ------------------------------------------------------------------ */

const C = 500 // SVG center — the disc's axis.

const r1 = (n: number) => Math.round(n * 10) / 10
/** Point at polar (r, deg) in the 1000×1000 viewBox. */
const polar = (r: number, deg: number): [number, number] => {
  const a = (deg * Math.PI) / 180
  return [C + r * Math.cos(a), C + r * Math.sin(a)]
}

/** Radial detail, generated once at module scope (deterministic — no per-frame math). */
const TICKS = (() => {
  const ticks: { x1: number; y1: number; x2: number; y2: number; index: boolean }[] = []
  for (let k = 0; k < 36; k++) {
    const index = k % 6 === 0
    const [a, b] = [polar(index ? 392 : 402, k * 10), polar(index ? 438 : 432, k * 10)]
    ticks.push({ x1: r1(a[0]), y1: r1(a[1]), x2: r1(b[0]), y2: r1(b[1]), index })
  }
  return ticks
})()

const SPOKES = (() => {
  const spokes: { x1: number; y1: number; x2: number; y2: number }[] = []
  // Asymmetric (3 at 120°) so the wheel's rotation visibly reads.
  for (const deg of [0, 120, 240]) {
    const [a, b] = [polar(132, deg), polar(368, deg)]
    spokes.push({ x1: r1(a[0]), y1: r1(a[1]), x2: r1(b[0]), y2: r1(b[1]) })
  }
  return spokes
})()

const KNOBS = (() => {
  const knobs: { cx: number; cy: number }[] = []
  // Offset from the spokes so the handle ring reads as its own layer.
  for (const deg of [45, 135, 225, 315]) {
    const [p] = [polar(88, deg)]
    knobs.push({ cx: r1(p[0]), cy: r1(p[1]) })
  }
  return knobs
})()

/** Hinge plates on the left edge — what makes it a door, not a wheel. */
const HINGE_Y = [170, 500, 830]

type VaultDoorProps = {
  /** 'void' is the vault hero; 'full' (landing/auth) shows a smaller, fainter hint. */
  variant?: 'void' | 'full'
  /** Tints the core + index ticks with the active category. */
  activeCategory?: Category | null
}

export function VaultDoor({ variant = 'void', activeCategory }: VaultDoorProps) {
  const reducedMotion = usePrefersReducedMotion()
  const hero = variant === 'void'
  const accent = activeCategory?.color ?? 'var(--color-accent)'
  const size = hero ? 'min(46vw, 700px)' : 'min(30vw, 420px)'

  return (
    <motion.div
      aria-hidden="true"
      className="vault-door"
      style={{ width: size, height: size, opacity: hero ? 0.32 : 0.16, perspective: 1400 }}
    >
      {/* Static 3D tilt + a slow, almost imperceptible rock. */}
      <motion.div
        className="vault-door-tilt"
        style={{ transformStyle: 'preserve-3d', rotateX: 18, rotateY: -10 }}
        animate={reducedMotion ? undefined : { rotateX: [18, 21, 18], rotateY: [-10, -14, -10] }}
        transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut' }}
      >
        <svg
          className="block h-full w-full"
          viewBox="0 0 1000 1000"
          style={{ '--vault-accent': accent } as CSSProperties}
        >
          <defs>
            <radialGradient id="vault-door-core">
              <stop offset="0%" style={{ stopColor: 'var(--vault-accent)', stopOpacity: 0.5 }} />
              <stop offset="100%" style={{ stopColor: 'var(--vault-accent)', stopOpacity: 0 }} />
            </radialGradient>
          </defs>

          {/* Breathing ember core — backmost, so spokes pass over it. */}
          <motion.circle
            cx={C}
            cy={C}
            r={150}
            fill="url(#vault-door-core)"
            style={reducedMotion ? { opacity: 0.75 } : undefined}
            animate={reducedMotion ? undefined : { opacity: [0.55, 1, 0.55] }}
            transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* Static frame, hinges, rims, hub — grounds the door. */}
          <rect x={52} y={52} width={896} height={896} rx={150} className="vault-door-frame" />
          <rect
            x={120}
            y={120}
            width={760}
            height={760}
            rx={110}
            className="vault-door-frame vault-door-frame-thin"
          />
          {HINGE_Y.map((y) => (
            <g key={y} className="vault-door-hinge">
              <rect x={52} y={y - 45} width={34} height={90} rx={10} />
              <circle cx={88} cy={y} r={7} />
            </g>
          ))}
          <circle cx={C} cy={C} r={440} className="vault-door-rim" />
          <circle cx={C} cy={C} r={400} className="vault-door-rim vault-door-rim-thin" />
          <circle cx={C} cy={C} r={58} className="vault-door-rim vault-door-rim-thin" />

          {/* Tick ring — slow forward. */}
          <motion.g
            className="vault-door-spin"
            animate={reducedMotion ? undefined : { rotate: 360 }}
            transition={{ duration: 120, repeat: Infinity, ease: 'linear' }}
            style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          >
            {TICKS.map((t, i) => (
              <line
                key={i}
                x1={t.x1}
                y1={t.y1}
                x2={t.x2}
                y2={t.y2}
                className={t.index ? 'vault-door-index' : 'vault-door-tick'}
              />
            ))}
          </motion.g>

          {/* Spoke wheel — reverse, a little faster. */}
          <motion.g
            className="vault-door-spin"
            animate={reducedMotion ? undefined : { rotate: -360 }}
            transition={{ duration: 90, repeat: Infinity, ease: 'linear' }}
            style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          >
            {SPOKES.map((s, i) => (
              <line
                key={i}
                x1={s.x1}
                y1={s.y1}
                x2={s.x2}
                y2={s.y2}
                className="vault-door-spoke"
              />
            ))}
            <circle cx={C} cy={C} r={132} className="vault-door-rim vault-door-rim-thin" />
          </motion.g>

          {/* Knob handle ring — opposite, fastest. */}
          <motion.g
            className="vault-door-spin"
            animate={reducedMotion ? undefined : { rotate: 360 }}
            transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
            style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          >
            <circle cx={C} cy={C} r={88} className="vault-door-rim vault-door-rim-thin" />
            {KNOBS.map((k, i) => (
              <circle key={i} cx={k.cx} cy={k.cy} r={17} className="vault-door-knob" />
            ))}
          </motion.g>

          {/* Center bolt — static, on top of everything. */}
          <circle cx={C} cy={C} r={12} className="vault-door-bolt" />
        </svg>
      </motion.div>
    </motion.div>
  )
}
