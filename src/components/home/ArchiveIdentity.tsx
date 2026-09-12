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
 * Compact editorial brandmark. A two-line wordmark ("RAJ'S" / "VAULT")
 * paired with live tallies and a quiet account/profile entry point.
 * Reads as an expensive archival colophon — not a marketing hero banner.
 *
 * The lock icon reinforces the private/secure character of the archive.
 */
export function ArchiveIdentity({
  savedCount,
  doneCount,
  onOpenAccount,
  preview = false,
}: ArchiveIdentityProps) {
  return (
    <header className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3.5">
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
          <p className="vault-meta mb-1 text-[9px] text-[var(--accession-text-muted)]">
            Private catalogue · The Accession
          </p>
          <h1 className="min-w-0" aria-label="Raj's Vault">
          <span
            className="font-display text-[1.35rem] font-semibold uppercase leading-[0.88] tracking-[0.09em] text-ink sm:text-[1.6rem]"
          >
            Raj&apos;s
          </span>
          <span className="block font-display text-[1.35rem] font-semibold uppercase leading-[0.88] tracking-[0.22em] text-ink-soft/60 sm:text-[1.6rem]">
            Vault
          </span>
          </h1>
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-2.5">
        <div className="flex items-baseline gap-4">
          <span className="flex items-baseline gap-1.5">
            <AnimatedNumber
              value={savedCount}
              className="font-display text-base font-semibold tabular-nums text-ink sm:text-lg"
            />
            <span className="vault-meta text-ink-soft/55">saved</span>
          </span>
          <span className="h-4 w-px bg-ink/10 self-center" aria-hidden="true" />
          <span className="flex items-baseline gap-1.5">
            <AnimatedNumber
              value={doneCount}
              className="font-display text-base font-semibold tabular-nums text-ink sm:text-lg"
            />
            <span className="vault-meta text-ink-soft/55">done</span>
          </span>
        </div>

        <button
          type="button"
          onClick={onOpenAccount}
          className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.12em] text-ink-soft/40 transition-colors hover:text-ink-soft"
          aria-label={preview ? 'Preview mode account panel' : 'Account settings'}
          data-tour="account"
        >
          <User size={10} aria-hidden="true" />
          {preview ? 'Preview' : 'Account'}
        </button>
      </div>
    </header>
  )
}
