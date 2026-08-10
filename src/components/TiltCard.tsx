import { useRef } from 'react'
import type { ReactNode } from 'react'
import { motion, useMotionTemplate, useMotionValue, useSpring } from 'motion/react'
import { BorderTrail } from './BorderTrail'

type TiltCardProps = {
  children: ReactNode
  className?: string
  glowColor?: string
  layoutId?: string
  active?: boolean
  onClick?: () => void
}

/** 3D tilt + cursor-following spotlight, the signature "tactile" card used everywhere. */
export function TiltCard({
  children,
  className = '',
  glowColor = 'rgba(255,237,215,0.85)',
  layoutId,
  active = false,
  onClick,
}: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null)

  const rotateX = useSpring(0, { stiffness: 220, damping: 20 })
  const rotateY = useSpring(0, { stiffness: 220, damping: 20 })
  const spotlightX = useMotionValue(50)
  const spotlightY = useMotionValue(50)
  const background = useMotionTemplate`radial-gradient(280px circle at ${spotlightX}% ${spotlightY}%, ${glowColor}, transparent 70%)`

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const bounds = ref.current?.getBoundingClientRect()
    if (!bounds) {
      return
    }

    const px = (event.clientX - bounds.left) / bounds.width
    const py = (event.clientY - bounds.top) / bounds.height

    rotateY.set((px - 0.5) * 14)
    rotateX.set((0.5 - py) * 14)
    spotlightX.set(px * 100)
    spotlightY.set(py * 100)
  }

  const handleMouseLeave = () => {
    rotateX.set(0)
    rotateY.set(0)
  }

  return (
    <motion.div
      ref={ref}
      layoutId={layoutId}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      style={{ rotateX, rotateY, transformPerspective: 700 }}
      className={`term-panel term-brackets group relative overflow-hidden rounded ${className}`}
    >
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background }}
      />
      {active ? <BorderTrail color={glowColor} size={70} duration={4} /> : null}
      <div className="relative z-10">{children}</div>
    </motion.div>
  )
}
