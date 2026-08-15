import { useRef, type CSSProperties, type ReactNode } from 'react'
import { motion, useScroll, useSpring, useTransform } from 'motion/react'

type ScrollRevealProps = {
  children: ReactNode
  className?: string
  style?: CSSProperties
}

/** Ties opacity/lift/scale directly to scroll progress through the viewport — instead of a
 * one-shot fade triggered once, the element keeps responding as you scroll it into place,
 * the continuous "things move as you scroll" motion the darkroom reference relies on. */
export function ScrollReveal({ children, className, style }: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 92%', 'start 45%'],
  })
  const progress = useSpring(scrollYProgress, { stiffness: 260, damping: 34, mass: 0.6 })

  const opacity = useTransform(progress, [0, 1], [0, 1])
  const y = useTransform(progress, [0, 1], [40, 0])
  const scale = useTransform(progress, [0, 1], [0.95, 1])

  return (
    <motion.div ref={ref} style={{ opacity, y, scale, ...style }} className={className}>
      {children}
    </motion.div>
  )
}
