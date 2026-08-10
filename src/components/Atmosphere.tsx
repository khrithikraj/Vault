import { AnimatePresence, motion, useScroll, useTransform } from 'motion/react'
import type { Category } from '../types/app'
import { FilmGrain } from './FilmGrain'
import { DustMotes } from './DustMotes'

type AtmosphereProps = {
  /** The currently focused category — its color tints the backdrop glow. */
  activeCategory?: Category | null
  /** 'full' densifies the dust for hero moments (landing/auth); 'void' is the calm vault default. */
  variant?: 'void' | 'full'
  /** Toggle the film-grain overlay (default on). */
  grain?: boolean
  /** Toggle the drifting dust motes (default on). */
  dust?: boolean
}

/** The signature backdrop: a warm, category-aware void glow with a whisper of the active
 * category's color, wrapped with film grain and drifting dust. The glow swells and sinks with
 * scroll so the darkness itself feels alive. Supersedes the old AmbientBackground. */
export function Atmosphere({
  activeCategory,
  variant = 'void',
  grain = true,
  dust = true,
}: AtmosphereProps) {
  const seed = activeCategory?.id ?? 'default'
  const glowColor = activeCategory?.color ?? '#dc5000'
  const { scrollY } = useScroll()
  const glowY = useTransform(scrollY, [0, 1200], [0, 220])
  const glowScale = useTransform(scrollY, [0, 1200], [1, 1.35])

  return (
    <>
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
      {grain ? <FilmGrain /> : null}
      {dust ? <DustMotes count={variant === 'full' ? 26 : 14} /> : null}
    </>
  )
}
