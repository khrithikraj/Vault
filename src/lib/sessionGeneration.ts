/**
 * sessionGeneration — tiny, framework-free bookkeeping that isolates async loads
 * across auth session boundaries.
 *
 * Vault and document state is fetched asynchronously from Supabase. Without a guard,
 * a request started for user A can resolve AFTER the app has signed out or moved to
 * user B and overwrite the current user's state (data bleed / stale-load flicker).
 * Every session owner (a user id, or null when signed out) is assigned a monotonic
 * generation. Async work captures the generation it started under and must drop its
 * state writes once that generation is no longer current.
 *
 * The same module exposes the empty private-state shapes used to clear all client-side
 * state on a session boundary, so the exact clear behavior is directly unit-testable.
 */

import type {
  Category,
  ChecklistReminder,
  DailyChecklistCompletion,
  Note,
  VaultItem,
} from '../types/app'
import type { VaultDocument } from '../types/app'

export type SessionGeneration = {
  /** Monotonic counter; incremented every time the owning session changes. */
  readonly generation: number
  /** The session owner the current in-memory state belongs to (null = signed out). */
  readonly owner: string | null
}

export function createSessionGeneration(): SessionGeneration {
  return { generation: 0, owner: null }
}

/**
 * Advance the tracker to `owner`. When the owner changes, the generation increments so
 * previously-started async work becomes stale. Returns the next tracker and whether the
 * owner actually changed (callers use `changed` to clear in-memory state).
 */
export function advanceSessionGeneration(
  current: SessionGeneration,
  owner: string | null,
): { next: SessionGeneration; changed: boolean } {
  if (current.owner === owner) {
    return { next: current, changed: false }
  }
  return { next: { owner, generation: current.generation + 1 }, changed: true }
}

/** True only while work started under `startedGeneration` may still write state. */
export function isCurrentSessionGeneration(
  current: SessionGeneration,
  startedGeneration: number,
): boolean {
  return startedGeneration === current.generation
}

/**
 * Render-time visibility gate: private client state stored for `owner` may only be
 * exposed while `activeUserId` is the same signed-in user. This makes a previous
 * user's data logically empty (not rendered) from the very first render that carries
 * the new session — before any reset effect has had a chance to run.
 */
export function isSessionStateVisible(owner: string | null, activeUserId: string | null): boolean {
  return activeUserId !== null && owner === activeUserId
}

/** All client-side Vault state that must be cleared on a session boundary. */
export type PrivateVaultState = {
  categories: Category[]
  items: VaultItem[]
  notes: Note[]
  trashedItems: VaultItem[]
  trashedNotes: Note[]
  reminders: ChecklistReminder[]
  dailyCompletions: DailyChecklistCompletion[]
  selectedCategoryId: string | null
}

export function emptyVaultState(): PrivateVaultState {
  return {
    categories: [],
    items: [],
    notes: [],
    trashedItems: [],
    trashedNotes: [],
    reminders: [],
    dailyCompletions: [],
    selectedCategoryId: null,
  }
}

/** All client-side Documents state that must be cleared on a session boundary. */
export type PrivateDocumentState = {
  documents: VaultDocument[]
  trashedDocuments: VaultDocument[]
}

export function emptyDocumentState(): PrivateDocumentState {
  return { documents: [], trashedDocuments: [] }
}