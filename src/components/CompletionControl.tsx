import type { MouseEvent } from 'react'
import { cn } from '../design/cn'
import { DoneStamp } from './DoneStamp'

/**
 * The Vault completion language, in one place.
 *
 *   DONE     = state  -> <DoneStamp/>   (canonical editorial stamp)
 *   MARK DONE = action -> <MarkDoneAction/> (compact, quiet, touch-friendly)
 *
 * Use <CompletionControl/> as the switch for any whole-record completion slot:
 * it renders the compact action while incomplete and the canonical stamp once
 * done. The same onToggle is preserved for both states so mark/restore behaves
 * exactly as before.
 */

type MarkDoneActionProps = {
  /** Accessible name for the action (e.g. "Mark Acme as done"). */
  label: string
  onClick: (event: MouseEvent<HTMLButtonElement>) => void
  className?: string
}

export function MarkDoneAction({ label, onClick, className }: MarkDoneActionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        'inline-flex min-h-9 items-center gap-1.5 rounded-sm border border-ink/15 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-ink-soft transition-colors hover:border-accent/50 hover:text-accent',
        className,
      )}
    >
      Mark done
    </button>
  )
}

type CompletionControlProps = {
  done: boolean
  /** Accessible name for the incomplete "Mark done" action. */
  actionLabel: string
  /** Accessible name for the completed stamp when it restores the record. */
  doneLabel: string
  onToggle: (event: MouseEvent<HTMLButtonElement>) => void
  className?: string
}

export function CompletionControl({
  done,
  actionLabel,
  doneLabel,
  onToggle,
  className,
}: CompletionControlProps) {
  if (done) {
    return <DoneStamp label={doneLabel} onToggle={onToggle} className={className} />
  }
  return <MarkDoneAction label={actionLabel} onClick={onToggle} className={className} />
}