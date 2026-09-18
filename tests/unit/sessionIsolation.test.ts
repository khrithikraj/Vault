import { describe, expect, it } from 'vitest'
import {
  advanceSessionGeneration,
  createSessionGeneration,
  emptyDocumentState,
  emptyVaultState,
  isCurrentSessionGeneration,
  isSessionStateVisible,
  type PrivateDocumentState,
  type PrivateVaultState,
  type SessionGeneration,
} from '../../src/lib/sessionGeneration'
import type {
  Category,
  ChecklistReminder,
  DailyChecklistCompletion,
  Note,
  VaultItem,
  VaultDocument,
} from '../../src/types/app'

/**
 * A faithful stand-in for the hook control flow so the session-boundary isolation
 * logic is exercised exactly the way useVault()/useDocuments() run it:
 *
 *  - applyVaultSession() mirrors useVault's applySession funnel: advance the
 *    generation, clear ALL private state on an actual boundary, start loadVault()
 *    ONLY for a real session boundary with a non-null user (so init + the duplicate
 *    INITIAL_SESSION restore produce a single load, never two).
 *  - The Vault load controller captured the generation it started under. Its
 *    complete()/fail() write data/message/loading state ONLY while that generation is
 *    still current, which is exactly what a stale request must never do: mutate the
 *    current session's loading/message/data state.
 *  - The Documents load controller is identity-based, mirroring useDocuments.load():
 *    it may write only while the stored state's owner is still the session user the
 *    load was started for. A boundary reset that claims the SAME user (the cold
 *    signed-in initialization ordering) therefore does NOT invalidate the load, while a
 *    previous user's load goes stale the instant the owner changes.
 *  - resetDocuments() mirrors useDocuments.reset(), clearing documents/loading/message
 *    synchronously at a session boundary.
 *  - visibleDocs() mirrors useDocuments' render-time gate: the stored arrays are exposed
 *    only while the active session user matches the owner they were loaded for.
 */

type SessionLike = { user?: { id: string } } | null

type LoadController<T> = {
  complete: (rows: T) => void
  fail: (msg: string) => void
}

// ---------------------------------------------------------------------------
// Vault harness
// ---------------------------------------------------------------------------

type VaultHarness = {
  guard: SessionGeneration
  state: PrivateVaultState | null
  loading: boolean
  message: string
  loadsStarted: number
  pendingLoad: LoadController<PrivateVaultState> | null
}

function makeVaultHarness(): VaultHarness {
  return { guard: createSessionGeneration(), state: null, loading: false, message: '', loadsStarted: 0, pendingLoad: null }
}

function makeVaultLoadController(h: VaultHarness): LoadController<PrivateVaultState> {
  const startedGeneration = h.guard.generation
  const current = () => isCurrentSessionGeneration(h.guard, startedGeneration)
  return {
    complete(rows) {
      if (!current()) return
      h.state = rows
      h.loading = false
    },
    fail(msg) {
      if (!current()) return
      h.message = msg
      h.loading = false
    },
  }
}

function applyVaultSession(h: VaultHarness, sess: SessionLike): void {
  const nextUserId = sess?.user?.id ?? null
  const { next, changed } = advanceSessionGeneration(h.guard, nextUserId)
  h.guard = next
  if (changed) {
    h.state = emptyVaultState()
    // Transient reset belongs to the boundary (mirrors useVault's applySession):
    // the previous session's load is stale and can no longer clear these itself.
    h.loading = false
    h.message = ''
  }
  if (changed && nextUserId) {
    h.loadsStarted += 1
    h.loading = true
    h.message = ''
    h.pendingLoad = makeVaultLoadController(h)
  }
}

// ---------------------------------------------------------------------------
// Documents harness
// ---------------------------------------------------------------------------

type DocHarness = {
  guard: SessionGeneration
  state: PrivateDocumentState | null
  loading: boolean
  message: string
  loadsStarted: number
  pendingLoad: LoadController<PrivateDocumentState> | null
}

function makeDocHarness(): DocHarness {
  return { guard: createSessionGeneration(), state: null, loading: false, message: '', loadsStarted: 0, pendingLoad: null }
}

function makeDocLoadController(h: DocHarness, sessionUserId: string | null): LoadController<PrivateDocumentState> {
  // Identity-based staleness (mirrors useDocuments.load()): a load belongs to the session
  // user it was started for, and only that user's owner can accept its writes.
  const stale = () => h.guard.owner !== sessionUserId
  return {
    complete(rows) {
      if (stale()) return
      h.state = rows
      h.loading = false
    },
    fail(msg) {
      if (stale()) return
      h.message = msg
      h.loading = false
    },
  }
}

/** Mirrors useDocuments.reset(userId). */
function resetDocuments(h: DocHarness, userId: string | null): void {
  const { next, changed } = advanceSessionGeneration(h.guard, userId)
  h.guard = next
  if (!changed) {
    return
  }
  h.state = emptyDocumentState()
  h.loading = false
  h.message = ''
}

/** Mirrors useDocuments.load(), which is called with the currently active session user. */
function startDocumentLoad(h: DocHarness, sessionUserId: string | null): void {
  h.loadsStarted += 1
  h.loading = true
  h.message = ''
  h.pendingLoad = makeDocLoadController(h, sessionUserId)
}

/**
 * Mirrors the render-time gate in useDocuments(): what the UI receives is the stored
 * arrays only while the active session user matches the owner they belong to, and
 * empty document state on every other render (including the very first render after a
 * user change, before reset() has run).
 */
function visibleDocs(h: DocHarness, sessionUserId: string | null): PrivateDocumentState {
  return isSessionStateVisible(h.guard.owner, sessionUserId)
    ? (h.state ?? emptyDocumentState())
    : emptyDocumentState()
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function vaultRows(owner: string): PrivateVaultState {
  return {
    categories: [{ id: `cat-${owner}`, user_id: owner, name: `${owner}'s vault` } as Category],
    items: [{ id: `item-${owner}`, user_id: owner, title: `${owner} item`, category_id: `cat-${owner}` } as VaultItem],
    notes: [{ id: `note-${owner}`, user_id: owner, title: `${owner} note` } as Note],
    trashedItems: [{ id: `trash-${owner}`, user_id: owner, title: `${owner} trashed`, category_id: `cat-${owner}`, deleted_at: '2026-09-17T00:00:00.000Z' } as VaultItem],
    trashedNotes: [{ id: `trash-note-${owner}`, user_id: owner, title: `${owner} trashed note`, deleted_at: '2026-09-17T00:00:00.000Z' } as Note],
    reminders: [{ id: `rem-${owner}`, user_id: owner, note_id: `note-${owner}` } as ChecklistReminder],
    dailyCompletions: [{ reminder_id: `rem-${owner}`, local_date: '2026-09-17', completed_at: '2026-09-17T00:00:00.000Z' } as DailyChecklistCompletion],
    selectedCategoryId: `cat-${owner}`,
  }
}

function documentRows(owner: string): PrivateDocumentState {
  return {
    documents: [{ id: `doc-${owner}`, user_id: owner, name: `${owner}.pdf` } as VaultDocument],
    trashedDocuments: [{ id: `doc-trash-${owner}`, user_id: owner, name: `${owner}-old.pdf`, deleted_at: '2026-09-17T00:00:00.000Z' } as VaultDocument],
  }
}

// ---------------------------------------------------------------------------
// Generation mechanics
// ---------------------------------------------------------------------------

describe('session generation mechanics', () => {
  it('starts at generation 0 owned by nobody', () => {
    const guard = createSessionGeneration()
    expect(guard.generation).toBe(0)
    expect(guard.owner).toBeNull()
  })

  it('keeps the same generation when the owner does not change', () => {
    let guard = createSessionGeneration()
    ;({ next: guard } = advanceSessionGeneration(guard, 'user-a'))
    const outcome = advanceSessionGeneration(guard, 'user-a')
    expect(outcome.next.generation).toBe(1)
    expect(outcome.changed).toBe(false)
    expect(isCurrentSessionGeneration(outcome.next, 1)).toBe(true)
  })

  it('increments the generation on every owner change', () => {
    let guard = createSessionGeneration()
    ;({ next: guard } = advanceSessionGeneration(guard, 'user-a'))
    ;({ next: guard } = advanceSessionGeneration(guard, null))
    ;({ next: guard } = advanceSessionGeneration(guard, 'user-b'))
    expect(guard.generation).toBe(3)
    expect(guard.owner).toBe('user-b')
  })

  it('marks earlier work as stale once the owner changes', () => {
    let guard = createSessionGeneration()
    const before = guard.generation // 0
    ;({ next: guard } = advanceSessionGeneration(guard, 'user-a'))
    expect(isCurrentSessionGeneration(guard, before)).toBe(false)
    expect(isCurrentSessionGeneration(guard, guard.generation)).toBe(true)
  })

  it('exposes stored state only to the exact owner that is currently signed in', () => {
    // Signed out from the start: nothing is visible.
    expect(isSessionStateVisible(createSessionGeneration().owner, null)).toBe(false)

    let guard = createSessionGeneration()
    ;({ next: guard } = advanceSessionGeneration(guard, 'user-a'))

    // A sees A's data; B and the signed-out user must not — even before reset() runs.
    expect(isSessionStateVisible(guard.owner, 'user-a')).toBe(true)
    expect(isSessionStateVisible(guard.owner, 'user-b')).toBe(false)
    expect(isSessionStateVisible(guard.owner, null)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Issue 1: a stale request must never touch the current session's
// loading / message / data state
// ---------------------------------------------------------------------------

describe('stale requests cannot mutate current-session state', () => {
  it('a stale response cannot clear the current load\x27s loading state or write data', () => {
    const h = makeVaultHarness()

    // User A signs in; their load is still in flight (loading = true).
    applyVaultSession(h, { user: { id: 'user-a' } })
    const loadA = h.pendingLoad!
    expect(h.loading).toBe(true)
    expect(h.state).toEqual(emptyVaultState())

    // Sign out, then user B signs in — B's load starts and must stay "loading".
    applyVaultSession(h, null)
    applyVaultSession(h, { user: { id: 'user-b' } })
    const loadB = h.pendingLoad!
    expect(h.loading).toBe(true)

    // A's response arrives late: it must not populate state, must not clear B's
    // loading flag, and must not write a message.
    loadA.complete(vaultRows('user-a'))
    loadA.fail('stale error from A')
    expect(h.state).toEqual(emptyVaultState())
    expect(h.loading).toBe(true)
    expect(h.message).toBe('')

    // B's own (current) load still completes normally.
    loadB.complete(vaultRows('user-b'))
    expect(h.state?.items[0]?.title).toBe('user-b item')
    expect(h.loading).toBe(false)
  })

  it('a stale request arriving after the current load finished changes nothing', () => {
    const h = makeVaultHarness()

    applyVaultSession(h, { user: { id: 'user-a' } })
    const loadA = h.pendingLoad!

    applyVaultSession(h, null)
    applyVaultSession(h, { user: { id: 'user-b' } })
    const loadB = h.pendingLoad!
    loadB.complete(vaultRows('user-b'))
    expect(h.loading).toBe(false)

    // Even after B is fully loaded, A's late response must be a no-op.
    loadA.complete(vaultRows('user-a'))
    loadA.fail('stale error from A')
    expect(h.state?.items[0]?.title).toBe('user-b item')
    expect(h.loading).toBe(false)
    expect(h.message).toBe('')
  })
})

// ---------------------------------------------------------------------------
// Issue 1: Vault transient state (loadingData/message) resets at a session
// boundary, and a stale request cannot bring it back afterward
// ---------------------------------------------------------------------------

describe('Vault transient state resets at a session boundary', () => {
  it('signing out while A\'s load is in flight leaves loading=false immediately', () => {
    const h = makeVaultHarness()

    applyVaultSession(h, { user: { id: 'user-a' } })
    const loadA = h.pendingLoad!
    expect(h.loading).toBe(true)

    // Bounday A -> signed out: the boundary itself must reset the transient state.
    applyVaultSession(h, null)
    expect(h.loading).toBe(false)
    expect(h.message).toBe('')

    // A's stale request resolves afterward: it must not restore loading/message.
    loadA.complete(vaultRows('user-a'))
    loadA.fail('stale error from A')
    expect(h.loading).toBe(false)
    expect(h.message).toBe('')
    expect(h.state).toEqual(emptyVaultState())
  })

  it('a stale A load cannot restore loading=true under B even while B is loading', () => {
    const h = makeVaultHarness()

    applyVaultSession(h, { user: { id: 'user-a' } })
    const loadA = h.pendingLoad!

    // A -> B: the boundary resets before B's own load starts (which legitimately sets
    // loading=true again).
    applyVaultSession(h, { user: { id: 'user-b' } })
    const loadB = h.pendingLoad!
    expect(h.loadsStarted).toBe(2)
    expect(h.loading).toBe(true)

    // A's late response must not write under B or disturb B's loading/message.
    loadA.complete(vaultRows('user-a'))
    loadA.fail('stale error from A')
    expect(h.loading).toBe(true)
    expect(h.message).toBe('')
    expect(h.state).toEqual(emptyVaultState())

    // B's own load still completes normally and clears loading.
    loadB.complete(vaultRows('user-b'))
    expect(h.loading).toBe(false)
    expect(h.state?.items[0]?.title).toBe('user-b item')

    // Even after B finished, A's tail cannot flip loading back on.
    loadA.fail('stale error from A')
    expect(h.loading).toBe(false)
    expect(h.message).toBe('')
  })
})

// ---------------------------------------------------------------------------
// Issue 2: applySession is the single load funnel — no duplicate startup loads
// ---------------------------------------------------------------------------

describe('applySession is the single startup load funnel', () => {
  it('cold signed-in start loads exactly once (getSession + INITIAL_SESSION)', () => {
    const h = makeVaultHarness()

    // init() calls applySession(getSession()) with an existing session.
    applyVaultSession(h, { user: { id: 'user-a' } })
    expect(h.loadsStarted).toBe(1)

    // Supabase also emits INITIAL_SESSION for the same restored session — the
    // duplicate must NOT trigger a second loadVault().
    applyVaultSession(h, { user: { id: 'user-a' } })
    expect(h.loadsStarted).toBe(1)
    expect(h.guard.generation).toBe(1)
  })

  it('signed-out start loads zero, then SIGNED_IN loads exactly once', () => {
    const h = makeVaultHarness()

    // init() calls applySession(getSession()) with no session.
    applyVaultSession(h, null)
    expect(h.loadsStarted).toBe(0)
    expect(h.guard.generation).toBe(0)

    // A real auth callback (SIGNED_IN) loads exactly once.
    applyVaultSession(h, { user: { id: 'user-a' } })
    expect(h.loadsStarted).toBe(1)
  })

  it('passes each auth callback to applySession once and never reloads for same-user events', () => {
    const h = makeVaultHarness()

    applyVaultSession(h, null) // init: signed out
    applyVaultSession(h, { user: { id: 'user-a' } }) // SIGNED_IN
    const loadA = h.pendingLoad!
    loadA.complete(vaultRows('user-a'))
    expect(h.loadsStarted).toBe(1)

    // TOKEN_REFRESHED / same-user events must not clear, bump the generation, or reload.
    applyVaultSession(h, { user: { id: 'user-a' } })
    expect(h.loadsStarted).toBe(1)
    expect(h.guard.generation).toBe(1)
    expect(h.state?.items[0]?.title).toBe('user-a item')
  })
})

// ---------------------------------------------------------------------------
// Issue 4 / legacy scenarios: sign-out clears everything; B loads only its own data
// ---------------------------------------------------------------------------

describe('sign-out / sign-in lifecycle', () => {
  it('sign-out clears every Vault array and selection immediately', () => {
    const h = makeVaultHarness()

    applyVaultSession(h, { user: { id: 'user-a' } })
    h.pendingLoad!.complete(vaultRows('user-a'))
    expect(h.state?.categories).toHaveLength(1)
    expect(h.state?.items).toHaveLength(1)
    expect(h.state?.trashedItems).toHaveLength(1)
    expect(h.state?.notes).toHaveLength(1)
    expect(h.state?.trashedNotes).toHaveLength(1)
    expect(h.state?.reminders).toHaveLength(1)
    expect(h.state?.dailyCompletions).toHaveLength(1)
    expect(h.state?.selectedCategoryId).toBe('cat-user-a')

    applyVaultSession(h, null)

    expect(h.state).toEqual(emptyVaultState())
    expect(h.state?.categories).toHaveLength(0)
    expect(h.state?.items).toHaveLength(0)
    expect(h.state?.trashedItems).toHaveLength(0)
    expect(h.state?.notes).toHaveLength(0)
    expect(h.state?.trashedNotes).toHaveLength(0)
    expect(h.state?.reminders).toHaveLength(0)
    expect(h.state?.dailyCompletions).toHaveLength(0)
    expect(h.state?.selectedCategoryId).toBeNull()
  })

  it('A -> sign out -> B clears everything and loads only B data', () => {
    const h = makeVaultHarness()

    applyVaultSession(h, { user: { id: 'user-a' } })
    h.pendingLoad!.complete(vaultRows('user-a'))
    expect(h.state?.items[0]?.title).toBe('user-a item')

    applyVaultSession(h, null)
    expect(h.state).toEqual(emptyVaultState())

    applyVaultSession(h, { user: { id: 'user-b' } })
    h.pendingLoad!.complete(vaultRows('user-b'))

    expect(h.state?.items[0]?.title).toBe('user-b item')
    expect(h.state?.notes[0]?.title).toBe('user-b note')
    expect(h.state?.categories[0]?.id).toBe('cat-user-b')
    expect(h.state?.selectedCategoryId).toBe('cat-user-b')
    // No trace of A remains anywhere.
    expect(h.state?.items.some((i) => i.id === 'item-user-a')).toBe(false)
    expect(h.state?.notes.some((n) => n.id === 'note-user-a')).toBe(false)
    expect(h.state?.dailyCompletions.some((c) => c.reminder_id === 'rem-user-a')).toBe(false)
  })

  it('a normal initial signed-in load still populates the current session', () => {
    const h = makeVaultHarness()

    applyVaultSession(h, { user: { id: 'user-a' } })
    h.pendingLoad!.complete(vaultRows('user-a'))

    expect(h.state?.items).toHaveLength(1)
    expect(h.state?.notes).toHaveLength(1)
    expect(h.state?.categories).toHaveLength(1)
    expect(h.state?.trashedItems).toHaveLength(1)
    expect(h.state?.trashedNotes).toHaveLength(1)
    expect(h.state?.reminders).toHaveLength(1)
    expect(h.state?.dailyCompletions).toHaveLength(1)
    expect(h.state?.selectedCategoryId).toBe('cat-user-a')
  })

  it('a stale Vault response cannot overwrite data belonging to the next user', () => {
    const h = makeVaultHarness()

    applyVaultSession(h, { user: { id: 'user-a' } })
    const loadA = h.pendingLoad!

    applyVaultSession(h, null)
    applyVaultSession(h, { user: { id: 'user-b' } })
    const loadB = h.pendingLoad!
    loadB.complete(vaultRows('user-b'))

    // A's late response must be ignored — B's data stays.
    loadA.complete(vaultRows('user-a'))

    expect(h.state?.items[0]?.title).toBe('user-b item')
    expect(h.state?.notes[0]?.title).toBe('user-b note')
    expect(h.state?.categories[0]?.id).toBe('cat-user-b')
    expect(h.state?.selectedCategoryId).toBe('cat-user-b')
  })
})

// ---------------------------------------------------------------------------
// Issue 3: useDocuments reset + stale-load lifecycle
// ---------------------------------------------------------------------------

describe('document session lifecycle', () => {
  it('reset synchronously clears documents at a session boundary', () => {
    const h = makeDocHarness()

    resetDocuments(h, 'user-a')
    startDocumentLoad(h, 'user-a')
    h.pendingLoad!.complete(documentRows('user-a'))
    expect(h.state?.documents).toHaveLength(1)
    expect(h.state?.trashedDocuments).toHaveLength(1)

    // New owner signs in — the boundary alone must already have cleared everything.
    resetDocuments(h, 'user-b')
    expect(h.state).toEqual(emptyDocumentState())
    expect(h.state?.documents).toHaveLength(0)
    expect(h.state?.trashedDocuments).toHaveLength(0)
  })

  it('a stale document load is ignored and the current load stays functional', () => {
    const h = makeDocHarness()

    resetDocuments(h, 'user-a')
    startDocumentLoad(h, 'user-a')
    const loadA = h.pendingLoad!

    // Session boundary: reset bumps the generation and clears loading synchronously.
    resetDocuments(h, null)
    resetDocuments(h, 'user-b')
    expect(h.loading).toBe(false)

    // B opens Documents → a fresh, current load.
    startDocumentLoad(h, 'user-b')
    const loadB = h.pendingLoad!
    expect(h.loading).toBe(true)

    // A's late response must not populate B's documents or clear B's loading.
    loadA.complete(documentRows('user-a'))
    loadA.fail('stale document error')
    expect(h.state).toEqual(emptyDocumentState())
    expect(h.loading).toBe(true)
    expect(h.message).toBe('')

    loadB.complete(documentRows('user-b'))
    expect(h.state?.documents[0]?.name).toBe('user-b.pdf')
    expect(h.loading).toBe(false)
  })

  it('a stale document response cannot overwrite the new owner\x27s documents', () => {
    const h = makeDocHarness()

    resetDocuments(h, 'user-a')
    startDocumentLoad(h, 'user-a')
    const loadA = h.pendingLoad!

    resetDocuments(h, null)
    resetDocuments(h, 'user-b')
    startDocumentLoad(h, 'user-b')
    const loadB = h.pendingLoad!
    loadB.complete(documentRows('user-b'))

    loadA.complete(documentRows('user-a'))

    expect(h.state?.documents[0]?.name).toBe('user-b.pdf')
    expect(h.state?.documents).toHaveLength(1)
    expect(h.state?.trashedDocuments[0]?.name).toBe('user-b-old.pdf')
  })

  it('a cold signed-in load survives the boundary initialization for the same user', () => {
    const h = makeDocHarness()

    // Cold signed-in: the session resolves to user A but the boundary has not been
    // established yet (the owner is still null). The document-load effect fires first
    // and captures the session user the load is fetching for: user A.
    startDocumentLoad(h, 'user-a')
    const loadA = h.pendingLoad!
    expect(h.loading).toBe(true)

    // The session-boundary reset then claims user A. If this invalidation, the in-flight
    // A load would be dropped while docsLoadedRef is already true — Documents would
    // never populate. Staleness is identity-based, so claiming the SAME user must leave
    // the load current.
    resetDocuments(h, 'user-a')

    loadA.complete(documentRows('user-a'))
    expect(h.loading).toBe(false)
    expect(visibleDocs(h, 'user-a').documents[0]?.name).toBe('user-a.pdf')
    expect(visibleDocs(h, 'user-a').trashedDocuments[0]?.name).toBe('user-a-old.pdf')
  })
})

// ---------------------------------------------------------------------------
// Issue 2: document visibility is session-bound — a previous owner's arrays must
// never be returned (so they can never render) once the active user changes
// ---------------------------------------------------------------------------

describe('document render-time visibility is session-bound', () => {
  it('returns A\'s documents empty on the very first render under B, before reset() runs', () => {
    const h = makeDocHarness()

    resetDocuments(h, 'user-a')
    startDocumentLoad(h, 'user-a')
    h.pendingLoad!.complete(documentRows('user-a'))
    expect(visibleDocs(h, 'user-a').documents).toHaveLength(1)
    expect(visibleDocs(h, 'user-a').trashedDocuments).toHaveLength(1)

    // Session state has updated to B but the reset() effect has NOT run yet — this is
    // the render between the session state update and the effect. The stored arrays
    // still belong to A, so what the UI receives must already be empty.
    const firstRenderUnderB = visibleDocs(h, 'user-b')
    expect(firstRenderUnderB.documents).toHaveLength(0)
    expect(firstRenderUnderB.trashedDocuments).toHaveLength(0)

    // Same guarantee when the session becomes signed-out.
    const firstRenderSignedOut = visibleDocs(h, null)
    expect(firstRenderSignedOut.documents).toHaveLength(0)
    expect(firstRenderSignedOut.trashedDocuments).toHaveLength(0)
  })

  it('an in-flight A load stays stale after the boundary and B\'s current load still works', () => {
    const h = makeDocHarness()

    resetDocuments(h, 'user-a')
    startDocumentLoad(h, 'user-a')
    const loadA = h.pendingLoad!

    // Session flips to B: reset() advances the owner and clears the arrays.
    resetDocuments(h, 'user-b')
    expect(h.loading).toBe(false)

    // A's late response is dropped (stale) — it must not populate B's visible state.
    loadA.complete(documentRows('user-a'))
    loadA.fail('stale document error')
    expect(visibleDocs(h, 'user-b').documents).toHaveLength(0)
    expect(visibleDocs(h, 'user-b').trashedDocuments).toHaveLength(0)
    expect(h.loading).toBe(false)

    // B's own load works and populates B's visible state.
    startDocumentLoad(h, 'user-b')
    const loadB = h.pendingLoad!
    loadB.complete(documentRows('user-b'))
    expect(h.loading).toBe(false)
    expect(visibleDocs(h, 'user-b').documents[0]?.name).toBe('user-b.pdf')
    expect(visibleDocs(h, 'user-b').trashedDocuments[0]?.name).toBe('user-b-old.pdf')
  })
})