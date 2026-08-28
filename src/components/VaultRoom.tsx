import { useEffect } from 'react'
import { motion, useMotionValue, useScroll, useSpring, useTransform } from 'motion/react'
import type { CSSProperties } from 'react'
import type { Category } from '../types/app'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'

/* ------------------------------------------------------------------ */
/* The signature backdrop: an architect's isometric vault room. Faint  */
/* blueprint line-art — two walls meeting at a corner, shelf edges, a  */
/* vault door, and a receding floor grid — that drifts and parallaxes  */
/* with scroll and leans a hair toward the cursor. The door is alive:  */
/* its combination dial slowly turns and a warm light breathes behind  */
/* it in the active category's color. The shelves hold things — books, */
/* a globe, a small safe — faint line-art under a huge editorial       */
/* watermark and an edge vignette. Purely decorative (aria-hidden),    */
/* reduced-motion safe.                                                */
/* ------------------------------------------------------------------ */

/** Isometric constants — 30° axes, as in a technical isometric drawing. */
const I = Math.sqrt(3) / 2
const J = 0.5

const VIEW_W = 1600
const VIEW_H = 960
const CX = 800
const CY = 520
const WALL_H = 300
const DEPTH = 560
const GRID_MAX = 640

/** Project a world-space point (x, y, z) to the SVG viewBox. Walls run along +x
 * (projects right of the corner) and +y (projects left); +z is up. */
function iso(x: number, y: number, z: number): [number, number] {
  return [CX + (x - y) * I, CY + (x + y) * J - z]
}

const r1 = (n: number) => Math.round(n * 10) / 10
const seg = (a: [number, number], b: [number, number]) =>
  `M ${r1(a[0])} ${r1(a[1])} L ${r1(b[0])} ${r1(b[1])}`

/** Build the room's line-art once, at module scope (deterministic — no per-frame math). */
const ROOM = (() => {
  // Receding floor grid — two families of iso lines. Parallel in world means parallel
  // on screen under isometric projection, which is exactly what reads as "blueprint"
  // rather than "photograph".
  const floorGrid: string[] = []
  for (let c = 70; c < DEPTH; c += 70) {
    floorGrid.push(seg(iso(0, c, 0), iso(GRID_MAX, c, 0)))
    floorGrid.push(seg(iso(c, 0, 0), iso(c, GRID_MAX, 0)))
  }

  const cornerTop = iso(0, 0, WALL_H)
  const cornerBase = iso(0, 0, 0)
  const wallRT = iso(DEPTH, 0, WALL_H)
  const wallRB = iso(DEPTH, 0, 0)
  const wallLT = iso(0, DEPTH, WALL_H)
  const wallLB = iso(0, DEPTH, 0)

  // Shelf edges on the +x wall.
  const shelves = [70, 160, 250].map((z) => seg(iso(0, 0, z), iso(DEPTH, 0, z)))

  // Vault door on the +y wall: a circle in the wall plane projects to an isometric
  // ellipse whose conjugate radii are r·(−0.866, 0.5) and r·(0, −1) — i.e. rx=√1.5·r,
  // ry=√0.5·r, rotated 120° in screen space.
  const door = iso(0, DEPTH * 0.5, WALL_H * 0.5)
  const doorEllipse = (radius: number) => ({
    cx: r1(door[0]),
    cy: r1(door[1]),
    rx: r1(radius * Math.sqrt(1.5)),
    ry: r1(radius * Math.sqrt(0.5)),
    rotate: `rotate(120 ${r1(door[0])} ${r1(door[1])})`,
  })

  return {
    floorGrid,
    cornerTop,
    cornerBase,
    wallRT,
    wallRB,
    wallLT,
    wallLB,
    shelves,
    doorOuter: doorEllipse(104),
    doorHub: doorEllipse(40),
    doorCenter: door,
  }
})()

/** The door's combination dial — a ring of tick marks around the hub that turns slowly.
 * Index marks (every 6th) carry the room's accent so the dial echoes the active category. */
const DIAL_TICKS = (() => {
  const ticks: { x1: number; y1: number; x2: number; y2: number; index: boolean }[] = []
  const n = 24
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2
    const index = k % 6 === 0
    const rIn = index ? 18 : 19
    const rOut = index ? 27 : 23
    ticks.push({
      x1: r1(ROOM.doorCenter[0] + Math.cos(a) * rIn),
      y1: r1(ROOM.doorCenter[1] + Math.sin(a) * rIn),
      x2: r1(ROOM.doorCenter[0] + Math.cos(a) * rOut),
      y2: r1(ROOM.doorCenter[1] + Math.sin(a) * rOut),
      index,
    })
  }
  return ticks
})()

/** Line-art objects resting on the shelf edges (elevation style, drawn once at module
 * scope). World-positioned on the +x wall; each is its own small `<g>` translated to its
 * base point. Static geometry — stays visible under reduced motion. */
const ARTIFACT = {
  books: iso(150, 0, 70),
  globe: iso(280, 0, 160),
  safe: iso(120, 0, 250),
}

type VaultRoomProps = {
  /** Tints the room's accent lines (corner spine, vault door) with the active category. */
  activeCategory?: Category | null
}

export function VaultRoom({ activeCategory }: VaultRoomProps) {
  const reducedMotion = usePrefersReducedMotion()
  const { scrollY } = useScroll()
  // The room sinks and recedes as you scroll, opposite to the glow swelling above it.
  const roomY = useTransform(scrollY, [0, 1400], [0, 130])
  const roomScale = useTransform(scrollY, [0, 1400], [1, 0.985])
  const accent = activeCategory?.color ?? 'var(--color-accent)'

  // Cursor parallax — the room leans a hair toward the pointer. Window-level listener
  // so the pointer-events-none backdrop still receives it. Disabled under reduced motion.
  const pointerX = useMotionValue(0)
  const pointerY = useMotionValue(0)
  const parallaxX = useSpring(pointerX, { stiffness: 60, damping: 20 })
  const parallaxY = useSpring(pointerY, { stiffness: 60, damping: 20 })

  useEffect(() => {
    if (reducedMotion) {
      return
    }
    const onMove = (event: MouseEvent) => {
      pointerX.set((event.clientX / window.innerWidth - 0.5) * 24)
      pointerY.set((event.clientY / window.innerHeight - 0.5) * 24)
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => window.removeEventListener('mousemove', onMove)
  }, [reducedMotion, pointerX, pointerY])

  return (
    <div aria-hidden="true" className="vault-room">
      {/* Warm darkroom light-leak bleeding from the top corner. */}
      <div className="vault-leak" />

      {/* The isometric vault — cursor parallax under the scroll drift. */}
      <motion.div
        className="absolute inset-0"
        style={reducedMotion ? undefined : { x: parallaxX, y: parallaxY }}
      >
        <motion.div
          className="vault-room-scene"
          style={reducedMotion ? undefined : { y: roomY, scale: roomScale }}
        >
          <motion.div
            className="absolute inset-0"
            animate={reducedMotion ? undefined : { y: [0, -16, 0] }}
            transition={{ duration: 70, repeat: Infinity, ease: 'easeInOut' }}
          >
            <svg
              className="absolute inset-0 h-full w-full"
              viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
              preserveAspectRatio="xMidYMid slice"
              style={{ '--vault-accent': accent } as CSSProperties}
            >
              <defs>
                <radialGradient id="raj-door-glow">
                  <stop offset="0%" style={{ stopColor: 'var(--vault-accent)', stopOpacity: 0.35 }} />
                  <stop offset="100%" style={{ stopColor: 'var(--vault-accent)', stopOpacity: 0 }} />
                </radialGradient>
              </defs>

              {/* Breathing light pooled behind the door, in the active category's color. */}
              <motion.ellipse
                className="vault-door-glow"
                cx={ROOM.doorOuter.cx}
                cy={ROOM.doorOuter.cy}
                rx={168}
                ry={94}
                transform={ROOM.doorOuter.rotate}
                fill="url(#raj-door-glow)"
                style={reducedMotion ? { opacity: 0.7 } : undefined}
                animate={reducedMotion ? undefined : { opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
              />

              <g className="vault-room-lines">
                {ROOM.floorGrid.map((d, i) => (
                  <path key={`grid-${i}`} d={d} className="vault-grid" />
                ))}

                {/* Wall tops and floor seams */}
                <path d={seg(ROOM.cornerTop, ROOM.wallRT)} />
                <path d={seg(ROOM.cornerBase, ROOM.wallRB)} />
                <path d={seg(ROOM.cornerTop, ROOM.wallLT)} />
                <path d={seg(ROOM.cornerBase, ROOM.wallLB)} />

                {/* Corner spine — the room's accent line */}
                <path d={seg(ROOM.cornerTop, ROOM.cornerBase)} className="vault-accent" />

                {/* Shelf edges */}
                {ROOM.shelves.map((d, i) => (
                  <path key={`shelf-${i}`} d={d} />
                ))}

                {/* Vault door + hub */}
                <ellipse
                  className="vault-accent"
                  cx={ROOM.doorOuter.cx}
                  cy={ROOM.doorOuter.cy}
                  rx={ROOM.doorOuter.rx}
                  ry={ROOM.doorOuter.ry}
                  transform={ROOM.doorOuter.rotate}
                />
                <ellipse
                  className="vault-accent"
                  cx={ROOM.doorHub.cx}
                  cy={ROOM.doorHub.cy}
                  rx={ROOM.doorHub.rx}
                  ry={ROOM.doorHub.ry}
                  transform={ROOM.doorHub.rotate}
                />

                {/* The turning combination dial */}
                <motion.g
                  className="vault-dial"
                  animate={reducedMotion ? undefined : { rotate: 360 }}
                  transition={{ duration: 140, repeat: Infinity, ease: 'linear' }}
                  style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                >
                  {DIAL_TICKS.map((t) => (
                    <line
                      key={`${t.x1}-${t.y1}`}
                      x1={t.x1}
                      y1={t.y1}
                      x2={t.x2}
                      y2={t.y2}
                      className={t.index ? 'vault-dial-index' : undefined}
                    />
                  ))}
                </motion.g>

                {/* Shelf artifacts — a stack of books, a globe, a small safe */}
                <g
                  className="vault-shelf-item"
                  transform={`translate(${r1(ARTIFACT.books[0])} ${r1(ARTIFACT.books[1])})`}
                >
                  <rect x={-16} y={-46} width={32} height={13} />
                  <rect x={-13} y={-34} width={36} height={12} />
                  <rect x={-10} y={-23} width={40} height={10} />
                </g>
                <g
                  className="vault-shelf-item"
                  transform={`translate(${r1(ARTIFACT.globe[0])} ${r1(ARTIFACT.globe[1])})`}
                >
                  <ellipse cx={0} cy={-27} rx={16} ry={16} />
                  <ellipse cx={0} cy={-27} rx={7} ry={16} />
                  <path d="M 0 -11 L 0 0" />
                  <path d="M -9 0 L 9 0" />
                </g>
                <g
                  className="vault-shelf-item"
                  transform={`translate(${r1(ARTIFACT.safe[0])} ${r1(ARTIFACT.safe[1])})`}
                >
                  <rect x={-15} y={-26} width={30} height={26} rx={2} />
                  <circle cx={0} cy={-13} r={6} />
                  <path d="M 5 -13 L 8 -13" />
                  <rect x={9} y={-20} width={3} height={8} rx={1} />
                </g>
              </g>
            </svg>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Editorial watermark — fills the void with the brand, magazine style. */}
      <motion.div
        className="vault-wordmark-wrap"
        animate={reducedMotion ? undefined : { x: [0, -48, 0] }}
        transition={{ duration: 140, repeat: Infinity, ease: 'easeInOut' }}
      >
        <span className="vault-wordmark">RAJ&apos;s — Vault</span>
      </motion.div>

      {/* Edge vignette — deepens the void at the margins. */}
      <div className="vault-vignette" />
    </div>
  )
}
