import { motion, useScroll, useSpring } from 'motion/react'

/** Hairline ember scroll-progress bar pinned to the top edge — the one place an accent line is
 * allowed to run the full width, tracking how far through the vault you've traveled. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.001 })

  return (
    <motion.div
      aria-hidden="true"
      className="fixed inset-x-0 top-0 z-50 h-[2px] origin-left"
      style={{ scaleX, background: 'var(--color-accent)' }}
    />
  )
}
