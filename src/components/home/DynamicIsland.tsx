import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { AlertCircle, CheckCircle2, Copy, Info, RotateCcw, Trash2, Upload } from 'lucide-react'
import { reducedMotion } from '../../design/motion'

type IslandKind = 'saved' | 'copied' | 'restored' | 'uploaded' | 'deleted' | 'info' | 'error' | string

const LABELS: Record<string, string> = {
  saved: 'Saved',
  copied: 'Copied',
  restored: 'Restored',
  uploaded: 'Complete',
  deleted: 'Removed',
}

/**
 * Transient status surface — a Cult "Dynamic Island" style pill that appears,
 * communicates its message, then collapses itself. This is the only transient feedback
 * layer on Home; it never blocks input and auto-dismisses after a beat.
 */
export function DynamicIsland({
  note,
  token,
  kind,
  autoDismissMs = 2600,
  onDismiss,
}: {
  note: string | null
  token?: number
  kind?: IslandKind
  autoDismissMs?: number
  onDismiss?: () => void
}) {
  const [visible, setVisible] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!note) {
      setVisible(false)
      return
    }
    setVisible(true)
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      setVisible(false)
      onDismiss?.()
    }, autoDismissMs)
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [note, token, autoDismissMs, onDismiss])

  if (!note) return null

  let resolvedKind = kind
  if (!resolvedKind) {
    const lower = note.toLowerCase()
    if (lower.includes('copied')) resolvedKind = 'copied'
    else if (lower.includes('restor')) resolvedKind = 'restored'
    else if (lower.includes('upload') || lower.includes('complete')) resolvedKind = 'uploaded'
    else if (lower.includes('delet') || lower.includes('remov') || lower.includes('purge')) resolvedKind = 'deleted'
    else if (lower.includes('error') || lower.includes('fail') || lower.includes('invalid')) resolvedKind = 'error'
    else if (lower.includes('save') || lower.includes('add') || lower.includes('success')) resolvedKind = 'saved'
    else resolvedKind = 'info'
  }

  let Icon: ReactNode = <CheckCircle2 size={14} />
  let badgeBg = 'bg-accent text-ink'
  if (resolvedKind === 'copied') {
    Icon = <Copy size={13} />
    badgeBg = 'bg-accent text-ink'
  } else if (resolvedKind === 'restored') {
    Icon = <RotateCcw size={13} />
    badgeBg = 'bg-accent text-ink'
  } else if (resolvedKind === 'uploaded') {
    Icon = <Upload size={13} />
    badgeBg = 'bg-accent text-ink'
  } else if (resolvedKind === 'deleted') {
    Icon = <Trash2 size={13} />
    badgeBg = 'bg-red-500/20 text-red-400'
  } else if (resolvedKind === 'error') {
    Icon = <AlertCircle size={13} />
    badgeBg = 'bg-red-500/20 text-red-400'
  } else if (resolvedKind === 'info') {
    Icon = <Info size={13} />
    badgeBg = 'bg-ink/15 text-ink'
  }

  const label = LABELS[resolvedKind] ?? note

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <AnimatePresence>
        {visible ? (
          <motion.div
            key={token ?? note}
            role="status"
            aria-live="polite"
            className="island flex max-w-md items-center gap-2.5 rounded-full px-4 py-2"
            initial={{ opacity: 0, y: -20, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.95 }}
            transition={reducedMotion({ duration: 0.24, ease: 'easeOut' })}
          >
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${badgeBg}`}
              aria-hidden="true"
            >
              {Icon}
            </span>
            <span className="font-display text-xs font-medium tracking-wide text-ink truncate">
              {label}
            </span>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
