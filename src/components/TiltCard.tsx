import { useRef } from 'react'
import type { ReactNode } from 'react'
import { motion, useMotionTemplate, useMotionValue } from 'motion/react'
import { BorderTrail } from './BorderTrail'

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

/** The "tactile" card used everywhere. On hover the card gains a cursor-following spotlight
 * and a soft grounding shadow. The card's physical lift is driven by its parent (a simple
 * stable translateY), NOT by per-frame 3D spring transforms — those caused hover flicker and
 * neighboring-card jitter. The surface stays flat at rest and gains depth only when reached for. */
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

  const shadowOpacity = useMotionValue(0)
  const spotlightX = useMotionValue(50)
  const spotlightY = useMotionValue(50)
  const background = useMotionTemplate`radial-gradient(280px circle at ${spotlightX}% ${spotlightY}%, ${glowColor}, transparent 70%)`
  const shadow = useMotionTemplate`0 18px 40px -16px rgba(16, 9, 4, ${shadowOpacity})`

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const bounds = ref.current?.getBoundingClientRect()
    if (!bounds) {
      return
    }
    const px = (event.clientX - bounds.left) / bounds.width
    const py = (event.clientY - bounds.top) / bounds.height
    spotlightX.set(px * 100)
    spotlightY.set(py * 100)
  }

  const handleMouseEnter = () => {
    shadowOpacity.set(0.85)
  }

  const handleMouseLeave = () => {
    shadowOpacity.set(0)
  }

  return (
    <motion.div
      ref={ref}
      layoutId={layoutId}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      style={{ boxShadow: shadow }}
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
