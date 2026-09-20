import { Lock, User } from 'lucide-react'
import { AnimatedNumber } from '../AnimatedNumber'

type ArchiveIdentityProps = {
  savedCount: number
  doneCount: number
  onOpenAccount: () => void
  preview?: boolean
}

/**
 * V2 — Archive identity header.
 *
 * Two-column hierarchy: each column owns its primary label plus subordinate
 * metadata tucked underneath it.
 *
 *   RAJ'S VAULT                        ACCOUNT
 *   Private catalogue                  22 SAVED | 1 DONE
 *
 * The brand + lock read as one identity; the tallies are quiet metadata under
 * the Account entry point, never above the brand. Reads as an expensive
 * archival colophon — not a marketing hero banner.
 */
export function ArchiveIdentity({
  savedCount,
  doneCount,
  onOpenAccount,
  preview = false,
}: ArchiveIdentityProps) {
  return (
    <header className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3 sm:gap-3.5">
        <div
          aria-hidden="true"
          className="relative flex h-10 w-10 shrink-0 items-center justify-center"
        >
          {/* Outer ring */}
          <span className="absolute inset-0 rounded-full border border-ink/12" />
          {/* Inner fill */}
          <span className="absolute inset-1.5 rounded-full bg-accent/8" />
          <Lock size={15} className="relative text-accent" strokeWidth={2} />
        </div>

        <div className="min-w-0">
          <h1 className="min-w-0 font-display text-[1.3rem] font-semibold uppercase leading-[0.9] tracking-[0.08em] text-ink sm:text-[1.6rem]" aria-label="Raj's Vault">
            <span>Raj&apos;s</span>
            <span className="block tracking-[0.22em] text-ink-soft/60">Vault</span>
          </h1>
          <p className="vault-meta mt-1.5 text-[9px] tracking-[0.18em] text-ink-soft/60 sm:mt-2">
            Private catalogue
          </p>
        </div>
      </div>

      <div className="flex min-w-0 shrink-0 flex-col items-end gap-1.5">
        <button
          type="button"
          onClick={onOpenAccount}
          className="flex items-center gap-1.5 rounded py-1.5 pl-2 pr-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-soft transition-colors hover:text-ink"
          aria-label={preview ? 'Preview mode account panel' : 'Account settings'}
          data-tour="account"
        >
          <User size={12} aria-hidden="true" />
          {preview ? 'Preview' : 'Account'}
        </button>

        {/* Subordinate tallies — noticeably smaller/dimmer than the Account label */}
        <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.12em] text-ink-soft/55 sm:text-[10px]">
          <AnimatedNumber
            value={savedCount}
            className="font-display text-[10px] font-semibold tabular-nums text-ink sm:text-[11px]"
          />
          <span>saved</span>
          <span className="h-3 w-px bg-ink/10" aria-hidden="true" />
          <AnimatedNumber
            value={doneCount}
            className="font-display text-[10px] font-semibold tabular-nums text-ink sm:text-[11px]"
          />
          <span>done</span>
        </div>
      </div>
    </header>
  )
}
