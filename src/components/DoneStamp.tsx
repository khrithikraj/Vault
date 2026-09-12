import { motion } from 'motion/react'
import { Check } from 'lucide-react'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'

type DoneStampProps = {
  className?: string
  /** 'stamp' = large rotated ink-stamp overlay (grid cards). 'pill' = compact inline badge (archive rows). */
  variant?: 'stamp' | 'pill'
}

/**
 * DoneStamp — the "mark as done" flourish.
 *
 * A rubber-stamp slam: starts oversized and off-angle, then thunks down to its
 * resting rotation with a fast overshoot + tiny settle, mimicking a real ink
 * stamp hitting paper. Reduced motion collapses to a plain instant fade so
 * the badge still communicates state.
 */
export function DoneStamp({ className = '', variant = 'stamp' }: DoneStampProps) {
  const reducedMotion = usePrefersReducedMotion()

  if (variant === 'pill') {
    const pillClass = `flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-emerald-400 ${className}`
    if (reducedMotion) {
      return (
        <span className={pillClass}>
          <Check size={9} strokeWidth={3} aria-hidden="true" />
          Done
        </span>
      )
    }
    return (
      <motion.span
        initial={{ opacity: 0, scale: 1.9, rotate: -18 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{
          scale: { type: 'spring', stiffness: 380, damping: 15 },
          rotate: { type: 'spring', stiffness: 380, damping: 16 },
          opacity: { duration: 0.15 },
        }}
        className={pillClass}
      >
        <Check size={9} strokeWidth={3} aria-hidden="true" />
        Done
      </motion.span>
    )
  }

  if (reducedMotion) {
    return (
      <span
        className={`border-accent text-accent rounded-sm border-2 px-2.5 py-1 text-xs font-bold uppercase tracking-[0.25em] opacity-90 ${className}`}
      >
        Done
      </span>
    )
  }

  return (
    <motion.span
      initial={{ opacity: 0, scale: 2.4, rotate: -32 }}
      animate={{ opacity: 0.9, scale: 1, rotate: -12 }}
      transition={{
        duration: 0.42,
        times: [0, 0.6, 1],
        ease: ['easeIn', 'easeOut'],
        scale: { type: 'spring', stiffness: 340, damping: 14 },
        rotate: { type: 'spring', stiffness: 340, damping: 16 },
      }}
      className={`border-accent text-accent rounded-sm border-2 px-2.5 py-1 text-xs font-bold uppercase tracking-[0.25em] ${className}`}
      style={{
        boxShadow: '0 0 0 1px rgba(196,72,0,0.15)',
        textShadow: '0 0 1px rgba(196,72,0,0.4)',
      }}
    >
      Done
    </motion.span>
  )
}

