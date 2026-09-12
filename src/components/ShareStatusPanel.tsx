import { Check, Link as LinkIcon } from 'lucide-react'
import { VaultButton } from './ui/VaultButton'

type ShareStatusPanelProps = {
  state: 'idle' | 'sharing' | 'done' | 'error'
  url: string
  error: string
  onCopy: () => void
}

export function ShareStatusPanel({ state, url, error, onCopy }: ShareStatusPanelProps) {
  if (!url && state !== 'error') return null

  return (
    <div className="mt-3 border border-ink/15 bg-ink/5 px-3 py-2.5" role="status" aria-live="polite">
      {state === 'error' ? (
        <div className="text-xs text-red-400">
          <p>Couldn't create a share link right now.</p>
          {error ? <p className="mt-1 break-words opacity-90">{error}</p> : null}
        </div>
      ) : state === 'done' ? (
        <div className="flex items-center gap-2 text-xs font-medium text-ink">
          <Check size={13} className="shrink-0 text-accent" aria-hidden="true" />
          Share link copied to clipboard
        </div>
      ) : (
        <div className="flex min-w-0 items-center gap-2">
          <LinkIcon size={13} className="shrink-0 text-accent" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-xs text-ink-soft">{url}</span>
          <VaultButton type="button" variant="chip" size="sm" onClick={onCopy}>
            Copy link
          </VaultButton>
        </div>
      )}
    </div>
  )
}