import { useRef } from 'react'
import type { ReactNode } from 'react'
import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from 'motion/react'
import { BorderTrail } from './BorderTrail'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'

type TiltCardProps = {
  children: ReactNode
  className?: string
  glowColor?: string
  /** Override the BorderTrail color shown while `active` (defaults to `glowColor`). Lets a card
   * keep its own category-colored spotlight while the "active" marker runs the house ember. */
  trailColor?: string
  layoutId?: string
  active?: boolean
  onClick?: () => void
}

/** The "tactile" card used everywhere. On hover the card gains:
 *   - a cursor-following spotlight,
 *   - a soft grounding shadow,
 *   - a very subtle pointer-driven 3D tilt (±3°) for depth.
 *
 * Motion is transform/opacity only (never affects layout, so neighbors never shift or jump)
 * and everything is gated behind prefers-reduced-motion. The tilt limits are small and polite:
 * the surface reads as having depth, not as a rotating billboard. */
export function TiltCard({
  children,
  className = '',
  glowColor = 'rgba(255,237,215,0.85)',
  trailColor,
  layoutId,
  active = false,
  onClick,
}: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const reducedMotion = usePrefersReducedMotion()

  const shadowOpacity = useMotionValue(0)
  const spotlightX = useMotionValue(50)
  const spotlightY = useMotionValue(50)
  const background = useMotionTemplate`radial-gradient(280px circle at ${spotlightX}% ${spotlightY}%, ${glowColor}, transparent 70%)`
  const shadow = useMotionTemplate`0 18px 40px -16px rgba(16, 9, 4, ${shadowOpacity})`

  // Pointer-driven tilt: normalized -1..1 on each axis, spring-smoothed.
  const rawX = useMotionValue(0)
  const rawY = useMotionValue(0)
  const rotateY = useSpring(useTransform(rawX, [-0.5, 0.5], [2.6, -2.6]), {
    stiffness: 260,
    damping: 22,
  })
  const rotateX = useSpring(useTransform(rawY, [-0.5, 0.5], [-2.2, 2.2]), {
    stiffness: 260,
    damping: 22,
  })

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const bounds = ref.current?.getBoundingClientRect()
    if (!bounds) {
      return
    }
    const px = (event.clientX - bounds.left) / bounds.width
    const py = (event.clientY - bounds.top) / bounds.height
    spotlightX.set(px * 100)
    spotlightY.set(py * 100)
    if (reducedMotion) return
    rawX.set(px - 0.5)
    rawY.set(py - 0.5)
  }

  const handleMouseEnter = () => {
    shadowOpacity.set(0.85)
  }

  const handleMouseLeave = () => {
    shadowOpacity.set(0)
    if (reducedMotion) return
    rawX.set(0)
    rawY.set(0)
  }

  return (
    <motion.div
      ref={ref}
      layoutId={layoutId}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      style={{ boxShadow: shadow, rotateX, rotateY, transformPerspective: 760 }}
      className={`term-panel term-brackets group relative overflow-hidden rounded will-change-transform ${className}`}
    >
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background }}
      />
      {active ? <BorderTrail color={trailColor ?? glowColor} size={70} duration={4} /> : null}
      <div className="relative z-10">{children}</div>
    </motion.div>
  )
}
