import type { Transition, Variants } from 'motion/react'

/**
 * ======================================================================
 * RAJ'S VAULT — MOTION SYSTEM (V2 FOUNDATION)
 * ----------------------------------------------------------------------
 * The single shared motion vocabulary. Every transition, variant, and
 * spring the app uses should come from here (or respect the tokens in
 * tokens.css) instead of being repeated with ad-hoc values inline.
 *
 * The easing and duration primitives mirror --ease-* / --duration-* in
 * tokens.css. Springs are backed by --spring-* so physics stay consistent.
 *
 * Each preset also respects `prefers-reduced-motion` (see `reducedMotion`
 * below). JS-driven motion should prefer `motion(..., { reducedMotion })`
 * or branch on OUTSIDE_REDUCED_MOTION if a component needs synchronous
 * knowledge of the preference.
 * ======================================================================
 */

/** Resolves to `always` when the user prefers reduced motion, so Motion
 *  runs the transition instantly instead of animating. */
export function reducedMotion<T extends Transition | undefined>(
  transition: T,
): T | { duration: 0 } {
  if (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return { duration: 0 } as never
  }
  return transition
}

const EASE = {
  outExpo: [0.22, 1, 0.36, 1] as const,
  smooth: [0.4, 0, 0.2, 1] as const,
}

export const motionTokens = {
  /** Micro interaction — hovers, chips, small color/opacity states. */
  micro: { duration: 150, ease: EASE.smooth } as Transition,

  /** Standard transition — the default for most UI state changes. */
  standard: { duration: 250, ease: EASE.smooth } as Transition,

  /** Card interaction — spring lift/tilt on hover. */
  card: {
    type: 'spring',
    stiffness: 300,
    damping: 26,
  } as const as Transition,

  /** Panel/dialog entrance — the "slab unfolds" spring. */
  overlay: {
    type: 'spring',
    stiffness: 340,
    damping: 30,
  } as const as Transition,

  /** Sheet (bottom) entrance — heavier mass, eases up from the edge. */
  sheet: {
    type: 'spring',
    stiffness: 320,
    damping: 32,
  } as const as Transition,

  /** Shared-layout nav pill slide (dock active pill, auth tabs). */
  nav: {
    type: 'spring',
    stiffness: 380,
    damping: 30,
  } as const as Transition,
}

export const motionEase = {
  outExpo: EASE.outExpo,
  smooth: EASE.smooth,
}

/** Overlay variants — a consistent enter/exit for modal/dialog/sheet layers.
 *  Accepts a custom offset to tune origin (e.g. sheets slide up, dialogs pop). */
export function overlayVariants(options?: {
  y?: number
  scale?: number
  dir?: 'down' | 'up'
}): Variants {
  const { y = 16, scale = 0.96, dir = 'down' } = options ?? {}
  const travel = dir === 'up' ? y : -y
  return {
    hidden: { opacity: 0, y: travel, scale },
    visible: { opacity: 1, y: 0, scale: 1, transition: motionTokens.overlay },
    exit: {
      opacity: 0,
      y: travel,
      scale,
      transition: { duration: 160, ease: EASE.smooth },
    },
  }
}
