import { AnimatedNumber } from '../AnimatedNumber'

type VaultStatusCapsuleProps = {
  savedCount: number
  doneCount: number
}

/**
 * Fixed Vault status capsule (phone only).
 *
 * A small, persistent status object parked directly under the Vault identity —
 * a dark pill with a hairline rim and a whisper of depth. It borrows the
 * "floating island" gesture already established by `DynamicIsland`, but is
 * deliberately its own thing: quieter, always present, and carrying the
 * catalogue's saved/done tallies rather than a transient message.
 *
 * It is rendered inside the `.vault-chrome` header wrapper (see
 * `AuthenticatedPublication`), which is ordinary document flow, so the capsule
 * sits directly under the identity it belongs to and scrolls away with the
 * header and the catalogue as one. Purely presentational — no button semantics,
 * because the tallies are a read-out, not an action.
 */
export function VaultStatusCapsule({ savedCount, doneCount }: VaultStatusCapsuleProps) {
  return (
    // The capsule is centered within `.vault-page`, which already has symmetrical
    // horizontal margins (`margin-inline: auto`). Using `w-full flex justify-center`
    // keeps it visually centered without 100vw negative margins that cause horizontal overflow.
    //
    // `mt-4` is half the search's own margin, so the air above the pill and the
    // air below it measure the same and the row still clears the identity rather
    // than crowding it.
    <div className="mt-4 flex w-full justify-center sm:hidden">
      <p
        className="vault-capsule inline-flex max-w-full items-center gap-2 rounded-full px-3.5 py-1"
        aria-label={`${savedCount} saved, ${doneCount} done`}
      >
        <span className="flex shrink-0 items-baseline gap-1">
          <AnimatedNumber
            value={savedCount}
            className="vault-data text-ink"
          />
          <span className="vault-label text-ink-label">saved</span>
        </span>

        <span className="h-2.5 w-px shrink-0 bg-ink/12" aria-hidden="true" />

        <span className="flex shrink-0 items-baseline gap-1">
          <AnimatedNumber
            value={doneCount}
            className="vault-data text-ink"
          />
          <span className="vault-label text-ink-label">done</span>
        </span>
      </p>
    </div>
  )
}
