import { useRef } from 'react'
import type { ReactNode } from 'react'
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
} from 'motion/react'
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

/** 3D tilt + cursor-following spotlight, the signature "tactile" card used everywhere. The card
 * leans toward the pointer (slightly deeper than before), lifts a touch, and casts a soft
 * grounding shadow only while raised — so the darkroom surfaces stay flat at rest, per the
 * "depth from the surface stack" rule, and gain physical depth only when you reach for them. */
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

  const rotateX = useSpring(0, { stiffness: 260, damping: 18 })
  const rotateY = useSpring(0, { stiffness: 260, damping: 18 })
  const scale = useSpring(1, { stiffness: 320, damping: 22 })
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

    rotateY.set((px - 0.5) * 16)
    rotateX.set((0.5 - py) * 16)
    spotlightX.set(px * 100)
    spotlightY.set(py * 100)
  }

  const handleMouseEnter = () => {
    scale.set(1.02)
    shadowOpacity.set(0.85)
  }

  const handleMouseLeave = () => {
    rotateX.set(0)
    rotateY.set(0)
    scale.set(1)
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
      style={{ rotateX, rotateY, scale, boxShadow: shadow, transformPerspective: 700 }}
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
