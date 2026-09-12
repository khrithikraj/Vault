import { useEffect, useLayoutEffect, useState, type CSSProperties } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Heart, Search, SlidersHorizontal, Sparkles, User, type LucideIcon } from 'lucide-react'
import { layers } from '../design/layers'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'

type TourStep = {
  id: string
  target: string | null
  title: string
  body: string
  icon: LucideIcon
  placement: 'top' | 'bottom' | 'center'
}

// Framer Motion silently overwrites a raw `transform` string in `style` whenever
// `animate`/`initial` also drive scale/x/y/rotate — use its own x/y shorthand instead,
// which requires widening the style type since x/y aren't part of CSSProperties.
type MotionPositionStyle = CSSProperties & { x?: string | number; y?: string | number }

const STEPS: TourStep[] = [
  {
    id: 'welcome',
    target: null,
    title: "Welcome to Raj's Vault",
    body: "A few things are new around here — quick look, skip anytime.",
    icon: Sparkles,
    placement: 'center',
  },
  {
    id: 'search',
    target: 'search',
    title: 'Search everything',
    body: 'Find items, notes, and documents from one command bar — anywhere in the vault.',
    icon: Search,
    placement: 'bottom',
  },
  {
    id: 'sort',
    target: 'sort',
    title: 'Sort your collection',
    body: 'Order by name, date, or size. Your choice is remembered next time.',
    icon: SlidersHorizontal,
    placement: 'bottom',
  },
  {
    id: 'favorites',
    target: 'nav-favorites',
    title: 'Favorites',
    body: 'Tap the heart on anything to pin it here for quick access.',
    icon: Heart,
    placement: 'top',
  },
  {
    id: 'account',
    target: 'account',
    title: 'Your account',
    body: 'Update your name, reset your password, or sign out from here.',
    icon: User,
    placement: 'bottom',
  },
]

type Rect = { top: number; left: number; width: number; height: number }

function measure(selector: string | null): Rect | null {
  if (!selector) {
    return null
  }
  const el = document.querySelector<HTMLElement>(`[data-tour="${selector}"]`)
  if (!el) {
    return null
  }
  const r = el.getBoundingClientRect()
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

type OnboardingTourProps = {
  active: boolean
  onFinish: () => void
}

/**
 * Lightweight, dependency-free 5-step coachmark. Spotlights a real DOM element
 * (found via `data-tour="<id>"`) with a single-box-shadow cutout, and shows a
 * small card with a title/body + Back/Next/Skip. Fully keyboard-operable
 * (Esc = skip, arrows = step) and reduced-motion aware.
 */
export function OnboardingTour({ active, onFinish }: OnboardingTourProps) {
  const reducedMotion = usePrefersReducedMotion()
  const [stepIndex, setStepIndex] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)

  const step = STEPS[stepIndex]

  useEffect(() => {
    if (active) {
      setStepIndex(0)
    }
  }, [active])

  useLayoutEffect(() => {
    if (!active) {
      return
    }
    setRect(measure(step.target))
  }, [active, step])

  useEffect(() => {
    if (!active) {
      return
    }
    const update = () => setRect(measure(step.target))
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [active, step])

  const isLast = stepIndex === STEPS.length - 1

  const handleNext = () => {
    if (isLast) {
      onFinish()
      return
    }
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1))
  }
  const handleBack = () => setStepIndex((i) => Math.max(i - 1, 0))

  useEffect(() => {
    if (!active) {
      return
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onFinish()
      } else if (e.key === 'ArrowRight') {
        handleNext()
      } else if (e.key === 'ArrowLeft') {
        handleBack()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, stepIndex])

  if (!active) {
    return null
  }

  const spotlightStyle: CSSProperties = rect
    ? {
        position: 'fixed',
        top: rect.top - 8,
        left: rect.left - 8,
        width: rect.width + 16,
        height: rect.height + 16,
        borderRadius: 16,
        boxShadow: '0 0 0 9999px rgba(10,8,6,0.78)',
        pointerEvents: 'none',
        // Deliberately below `layers.overlay` (50) — any real dialog open at the same time
        // (e.g. Account panel) must always render on top, never get hidden behind the tour.
        zIndex: layers.tour,
      }
    : {
        position: 'fixed',
        inset: 0,
        background: 'rgba(10,8,6,0.78)',
        pointerEvents: 'none',
        zIndex: layers.tour,
      }

  let tooltipStyle: MotionPositionStyle = { position: 'fixed', zIndex: layers.tourTooltip }
  if (rect && step.placement !== 'center') {
    const clampedLeft = Math.min(
      Math.max(rect.left + rect.width / 2, 168),
      Math.max(window.innerWidth - 168, 168),
    )
    const rawTop = step.placement === 'top' ? rect.top - 12 : rect.top + rect.height + 12
    tooltipStyle = {
      ...tooltipStyle,
      left: clampedLeft,
      top: Math.min(Math.max(rawTop, 12), window.innerHeight - 12),
      // Use motion's x/y shorthand (not a raw `transform` string) — motion.div owns the
      // `transform` CSS property for its animate props (scale) and would silently drop a
      // manually-set transform, pushing the card off its intended anchor entirely.
      x: '-50%',
      y: step.placement === 'top' ? '-100%' : '0%',
    }
  } else {
    tooltipStyle = { ...tooltipStyle, left: '50%', top: '50%', x: '-50%', y: '-50%' }
  }

  const Icon = step.icon

  return (
    <AnimatePresence>
      <motion.div
        key="tour-spotlight"
        style={spotlightStyle}
        initial={reducedMotion ? undefined : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={reducedMotion ? undefined : { opacity: 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.25 }}
        aria-hidden="true"
      />
      <motion.div
        key={`tour-card-${step.id}`}
        style={tooltipStyle}
        role="dialog"
        aria-modal="true"
        aria-label={step.title}
        initial={reducedMotion ? undefined : { opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={reducedMotion ? undefined : { opacity: 0, scale: 0.96 }}
        transition={{ duration: reducedMotion ? 0 : 0.2 }}
        className="vault-surface-overlay w-[min(88vw,320px)] rounded p-4"
      >
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/12 text-accent">
            <Icon size={16} />
          </span>
          <div className="min-w-0">
            <p className="font-display text-sm font-semibold text-ink">{step.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">{step.body}</p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onFinish}
            className="text-[11px] font-medium uppercase tracking-wider text-ink-soft/60 transition-colors hover:text-ink-soft"
          >
            Skip tour
          </button>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1" aria-hidden="true">
              {STEPS.map((s, i) => (
                <span
                  key={s.id}
                  className={`h-1.5 w-1.5 rounded-full transition-colors ${
                    i === stepIndex ? 'bg-accent' : 'bg-ink/15'
                  }`}
                />
              ))}
            </div>
            {stepIndex > 0 ? (
              <button
                type="button"
                onClick={handleBack}
                className="vault-btn-outline rounded px-2.5 py-1 text-xs"
              >
                Back
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleNext}
              className="vault-btn-solid rounded-full px-3.5 py-1.5 text-xs font-semibold"
            >
              {isLast ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
