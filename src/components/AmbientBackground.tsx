import { AnimatePresence, motion, useScroll, useTransform } from 'motion/react'
import type { Category } from '../types/app'

type AmbientBackgroundProps = {
  /** The currently focused category — swapping it crossfades a faint wash of that
   * category's own color into the backdrop glow. No icons, no drifting shapes. */
  activeCategory?: Category | null
}

/** Darkroom void backdrop: a soft ember-tinted glow that picks up a whisper of the active
 * category's color. The glow drifts and swells with page scroll so the void itself feels
 * alive as you move through it, not just a static wash. */
export function AmbientBackground({ activeCategory }: AmbientBackgroundProps) {
  const seed = activeCategory?.id ?? 'default'
  const glowColor = activeCategory?.color ?? '#dc5000'
  const { scrollY } = useScroll()
  const glowY = useTransform(scrollY, [0, 1200], [0, 220])
  const glowScale = useTransform(scrollY, [0, 1200], [1, 1.35])

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-cloud">
      <AnimatePresence mode="wait">
        <motion.div
          key={seed}
          aria-hidden="true"
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.8 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: 'easeInOut' }}
          style={{
            y: glowY,
            scale: glowScale,
            background: `radial-gradient(ellipse at 50% -10%, ${glowColor}22, transparent 55%)`,
          }}
        />
      </AnimatePresence>
    </div>
  )
}

