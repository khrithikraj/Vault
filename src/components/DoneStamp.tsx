import type { MouseEvent } from 'react'
import { motion } from 'motion/react'
import { cn } from '../design/cn'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'

type DoneStampProps = {
  className?: string
  /** When a record is only marked done, the stamp is a pure state marker. When a
   *  label + onToggle are provided the stamp stays interactive so the same toggle
   *  can restore the record — preserving the existing mark/restore behavior. */
  label?: string
  onToggle?: (event: MouseEvent<HTMLButtonElement>) => void
}

/**
 * DoneStamp — the one canonical Vault "done" state.
 *
 * The exact editorial treatment from the Notes reference: a copper-bordered,
 * uppercase, wide-tracked ink stamp at a slight -12° rotation, sitting quietly on
 * the content. The rubber-stamp slam (oversized start -> -32° -> settle at -12°)
 * is the existing motion language; reduced motion collapses it to an instant,
 * fully-formed stamp so the state is still unambiguous.
 *
 * This is the ONLY place the whole-record DONE markup lives.
 */
const STAMP_CLASSES =
  'border-accent text-accent rounded-sm border-2 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.25em] opacity-90'

const STAMP_ROTATE = -12

const STAMP_HEIGHTEN = {
  boxShadow: '0 0 0 1px rgba(196,72,0,0.15)',
  textShadow: '0 0 1px rgba(196,72,0,0.4)',
} as const

export function DoneStamp({ className = '', label, onToggle }: DoneStampProps) {
  const reducedMotion = usePrefersReducedMotion()
  const interactive = Boolean(label && onToggle)
  const classNames = cn(
    STAMP_CLASSES,
    interactive ? 'cursor-pointer' : 'pointer-events-none',
    className,
  )

  if (reducedMotion) {
    const style = { ...STAMP_HEIGHTEN, rotate: `${STAMP_ROTATE}deg` }
    return interactive ? (
      <button type="button" onClick={onToggle} aria-label={label} className={classNames} style={style}>
        Done
      </button>
    ) : (
      <span className={classNames} style={style}>
        Done
      </span>
    )
  }

  if (interactive) {
    return (
      <motion.button
        type="button"
        onClick={onToggle}
        aria-label={label}
        className={classNames}
        style={STAMP_HEIGHTEN}
        initial={{ opacity: 0, scale: 2.4, rotate: -32 }}
        animate={{ opacity: 0.9, scale: 1, rotate: STAMP_ROTATE }}
        transition={{
          duration: 0.42,
          times: [0, 0.6, 1],
          ease: ['easeIn', 'easeOut'],
          scale: { type: 'spring', stiffness: 340, damping: 14 },
          rotate: { type: 'spring', stiffness: 340, damping: 16 },
        }}
      >
        Done
      </motion.button>
    )
  }

  return (
    <motion.span
      className={classNames}
      style={STAMP_HEIGHTEN}
      initial={{ opacity: 0, scale: 2.4, rotate: -32 }}
      animate={{ opacity: 0.9, scale: 1, rotate: STAMP_ROTATE }}
      transition={{
        duration: 0.42,
        times: [0, 0.6, 1],
        ease: ['easeIn', 'easeOut'],
        scale: { type: 'spring', stiffness: 340, damping: 14 },
        rotate: { type: 'spring', stiffness: 340, damping: 16 },
      }}
    >
      Done
    </motion.span>
  )
}
