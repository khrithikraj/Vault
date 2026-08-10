import { useRef } from 'react'
import type { ReactNode } from 'react'
import { motion, useMotionValue, useSpring } from 'motion/react'

type MagneticProps = {
  children: ReactNode
  className?: string
  /** How strongly the element is pulled toward the cursor (0–1). Default 0.3. */
  strength?: number
}

/** Magnetic wrapper — the element leans toward the cursor with spring physics and settles back
 * on leave. Same feel as the capture FAB's magnet, generalized for buttons and artifacts. */
export function Magnetic({ children, className = '', strength = 0.3 }: MagneticProps) {
  const ref = useRef<HTMLDivElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const springX = useSpring(x, { stiffness: 200, damping: 14 })
  const springY = useSpring(y, { stiffness: 200, damping: 14 })

  const handleMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const bounds = ref.current?.getBoundingClientRect()
    if (!bounds) return
    x.set((event.clientX - (bounds.left + bounds.width / 2)) * strength)
    y.set((event.clientY - (bounds.top + bounds.height / 2)) * strength)
  }

  const reset = () => {
    x.set(0)
    y.set(0)
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={reset}
      style={{ x: springX, y: springY }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
