import { describe, expect, it, vi, type Mock } from 'vitest'
import {
  deliverDueReminder,
  runDeliveryBatch,
  type DeliveryDeps,
  type ReminderRowForDelivery,
} from '../../supabase/functions/send-reminders/delivery'
import type { NoteRecord } from '../../supabase/functions/send-reminders/schedule'

const ZONE = 'Asia/Kolkata'
const NOW = new Date('2026-09-15T04:00:00.000Z') // 09:30 IST

const SUBSCRIPTION = {
  id: 'sub_1',
  endpoint: 'https://push.example.com/wpush/abc',
  p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9AcUbVlJx6',
  auth: 'tBHItJI5svbpez7KI4CCXg',
}

function makeReminder(overrides: Partial<ReminderRowForDelivery> = {}): ReminderRowForDelivery {
  return {
    id: 'r1',
    user_id: 'u1',
    note_id: 'n1',
    checklist_item_id: 'c1',
    recurrence: 'daily',
    local_time: '09:00',
    timezone: ZONE,
    next_fire_at: null,
    notes: {
      title: 'Trip Prep',
      deleted_at: null,
      checklist: [{ id: 'c1', text: 'Pack bag', done: false }],
    },
    ...overrides,
  }
}

type Deps = {
  deps: DeliveryDeps
  disableInvalid: Mock<DeliveryDeps['disableInvalid']>
  claim: Mock<DeliveryDeps['claim']>
  fetchCompletion: Mock<DeliveryDeps['fetchCompletion']>
  fetchSubscriptions: Mock<DeliveryDeps['fetchSubscriptions']>
  revokeSubscription: Mock<DeliveryDeps['revokeSubscription']>
  sendPush: Mock<DeliveryDeps['sendPush']>
}

function makeDeps(overrides: Partial<DeliveryDeps> = {}): Deps {
  const defaultDisableInvalid = vi.fn<DeliveryDeps['disableInvalid']>(async () => null)
  const defaultClaim = vi.fn<DeliveryDeps['claim']>(async () => ({ claimed: true, error: null }))
  const defaultFetchCompletion = vi.fn<DeliveryDeps['fetchCompletion']>(async () => ({ found: false, error: null }))
  const defaultFetchSubscriptions = vi.fn<DeliveryDeps['fetchSubscriptions']>(async () => ({ rows: [SUBSCRIPTION], error: null }))
  const defaultRevokeSubscription = vi.fn<DeliveryDeps['revokeSubscription']>(async () => null)
  const defaultSendPush = vi.fn<DeliveryDeps['sendPush']>(async () => ({ sent: true }))

  const disableInvalid = (overrides.disableInvalid as Mock<DeliveryDeps['disableInvalid']> | undefined) ?? defaultDisableInvalid
  const claim = (overrides.claim as Mock<DeliveryDeps['claim']> | undefined) ?? defaultClaim
  const fetchCompletion = (overrides.fetchCompletion as Mock<DeliveryDeps['fetchCompletion']> | undefined) ?? defaultFetchCompletion
  const fetchSubscriptions = (overrides.fetchSubscriptions as Mock<DeliveryDeps['fetchSubscriptions']> | undefined) ?? defaultFetchSubscriptions
  const revokeSubscription = (overrides.revokeSubscription as Mock<DeliveryDeps['revokeSubscription']> | undefined) ?? defaultRevokeSubscription
  const sendPush = (overrides.sendPush as Mock<DeliveryDeps['sendPush']> | undefined) ?? defaultSendPush

  const deps: DeliveryDeps = {
    now: NOW,
    now_iso: NOW.toISOString(),
    disableInvalid,
    claim,
    fetchCompletion,
    fetchSubscriptions,
    revokeSubscription,
    sendPush,
  }

  return { deps, disableInvalid, claim, fetchCompletion, fetchSubscriptions, revokeSubscription, sendPush }
}

describe('runDeliveryBatch: per-reminder isolation', () => {
  it('a malformed note/checklist does not abort later reminders', async () => {
    const malformed = makeReminder({
      id: 'bad',
      notes: {
        title: 'Broken note',
        deleted_at: null,
        checklist: {} as unknown as NoteRecord['checklist'],
      },
    })
    const good = makeReminder({ id: 'good' })
    const { deps, claim, sendPush } = makeDeps()

    const summary = await runDeliveryBatch([malformed, good], deps)

    expect(summary.disabledInvalid).toBe(1)
    expect(summary.invalidReasons['malformed-note']).toBe(1)
    expect(claim).toHaveBeenCalledTimes(1)
    expect(claim).toHaveBeenCalledWith(expect.objectContaining({ id: 'good' }))
    expect(sendPush).toHaveBeenCalledTimes(1)
    expect(summary.sent).toBe(1)
    expect(summary.processingErrors).toHaveLength(0)
  })

  it('an unexpected throw while processing one reminder does not stop the next', async () => {
    const boom = makeReminder({ id: 'boom', user_id: 'uA' })
    const ok = makeReminder({ id: 'ok', user_id: 'uB' })
    const { deps } = makeDeps({
      fetchSubscriptions: vi.fn(async (userId: string) => {
        if (userId === 'uA') throw new Error('boom')
        return { rows: [SUBSCRIPTION], error: null }
      }),
    })

    const summary = await runDeliveryBatch([boom, ok], deps)

    expect(summary.processingErrors).toHaveLength(1)
    expect(summary.processingErrors[0].reminderId).toBe('boom')
    expect(summary.sent).toBe(1)
  })
})

describe('runDeliveryBatch: validate before claim', () => {
  it('a reminder with an invalid timezone is never claimed', async () => {
    const bad = makeReminder({ timezone: 'Mars/Olympus' })
    const { deps, claim, sendPush, disableInvalid } = makeDeps()

    const summary = await runDeliveryBatch([bad], deps)

    expect(claim).not.toHaveBeenCalled()
    expect(disableInvalid).toHaveBeenCalledWith('r1', 'invalid-timezone')
    expect(summary.invalidReasons['invalid-timezone']).toBe(1)
    expect(summary.claimFailures).toBe(0)
    expect(summary.sent).toBe(0)
    expect(sendPush).not.toHaveBeenCalled()
  })

  it('an unparseable next_fire_at and a bad local_time are also caught before the claim', async () => {
    const { deps, claim } = makeDeps()

    const summary = await runDeliveryBatch(
      [makeReminder({ id: 'a', next_fire_at: 'not-a-date' }), makeReminder({ id: 'b', local_time: 'noon' })],
      deps,
    )

    expect(summary.invalidReasons['invalid-next-fire-at']).toBe(1)
    expect(summary.invalidReasons['invalid-local-time']).toBe(1)
    expect(claim).not.toHaveBeenCalled()
  })
})

describe('runDeliveryBatch: claim semantics stay idempotent', () => {
  it('passes is_once=true for once reminders and is_once=false for daily', async () => {
    const a = makeDeps()
    await deliverDueReminder(makeReminder({ recurrence: 'once' }), a.deps)
    expect(a.claim).toHaveBeenCalledWith(expect.objectContaining({ is_once: true, next_fire_at: null }))

    const b = makeDeps()
    await deliverDueReminder(makeReminder({ recurrence: 'daily' }), b.deps)
    expect(b.claim).toHaveBeenCalledWith(expect.objectContaining({ is_once: false }))
  })

  it('a claim error is never treated as claimed and the next cron tick can retry', async () => {
    const { deps, claim, sendPush } = makeDeps({
      claim: vi.fn(async () => ({ claimed: false, error: 'db timeout' })),
    })

    const summary = await runDeliveryBatch([makeReminder()], deps)

    expect(summary.claimFailures).toBe(1)
    expect(sendPush).not.toHaveBeenCalled()
    expect(summary.sent).toBe(0)
    expect(claim).toHaveBeenCalledTimes(1)

    const healthy = makeDeps()
    const retry = await runDeliveryBatch([makeReminder()], healthy.deps)
    expect(retry.sent).toBe(1)
  })

  it('an occurrence already claimed by a concurrent run is skipped silently', async () => {
    const { deps, claim, sendPush } = makeDeps({
      claim: vi.fn(async () => ({ claimed: false, error: null })),
    })

    const summary = await runDeliveryBatch([makeReminder()], deps)

    expect(claim).toHaveBeenCalledTimes(1)
    expect(sendPush).not.toHaveBeenCalled()
    expect(summary.sent).toBe(0)
    expect(summary.claimFailures).toBe(0)
  })
})

describe('runDeliveryBatch: fail-safe completion (M5)', () => {
  it('a completion query error never produces a push', async () => {
    const { deps, claim, sendPush, revokeSubscription } = makeDeps({
      fetchCompletion: vi.fn(async () => ({ found: false, error: 'db unreachable' })),
    })

    const summary = await runDeliveryBatch([makeReminder()], deps)

    expect(summary.completionQueryErrors).toBe(1)
    expect(summary.sent).toBe(0)
    expect(summary.pushFailures).toBe(0)
    expect(sendPush).not.toHaveBeenCalled()
    expect(revokeSubscription).not.toHaveBeenCalled()
    // The occurrence was claimed (schedule advanced) but no notification is sent.
    expect(claim).toHaveBeenCalledTimes(1)
  })

  it('explicit post-claim policy: a completion lookup error consumes the occurrence - no push and no re-open', async () => {
    const { deps, claim, sendPush, fetchSubscriptions, disableInvalid, revokeSubscription } = makeDeps({
      fetchCompletion: vi.fn(async () => ({ found: false, error: 'db unreachable' })),
    })

    const summary = await runDeliveryBatch([makeReminder()], deps)

    // The occurrence was atomically claimed exactly once.
    expect(claim).toHaveBeenCalledTimes(1)
    // The DB state is unknown, so the push is never sent.
    expect(sendPush).not.toHaveBeenCalled()
    // The delivery layer does NOT artificially re-open the occurrence: it performs
    // no further writes (no un-claim update, no disable, no revoke) and does not
    // proceed to the later, now-unreachable stages (subscription fetch / push).
    expect(disableInvalid).not.toHaveBeenCalled()
    expect(fetchSubscriptions).not.toHaveBeenCalled()
    expect(revokeSubscription).not.toHaveBeenCalled()
    // Everything stays claimed: a later cron tick must NOT re-send this occurrence.
    expect(summary.completionQueryErrors).toBe(1)
    expect(summary.sent).toBe(0)
    expect(summary.processingErrors).toHaveLength(0)
  })

  it('an existing completion suppresses the push while the occurrence is still claimed', async () => {
    const { deps, claim, sendPush } = makeDeps({
      fetchCompletion: vi.fn(async () => ({ found: true, error: null })),
    })

    const summary = await runDeliveryBatch([makeReminder()], deps)

    expect(summary.skippedCompleted).toBe(1)
    expect(sendPush).not.toHaveBeenCalled()
    expect(claim).toHaveBeenCalledTimes(1)
  })

  it('no completion row still permits the push', async () => {
    const { deps, sendPush } = makeDeps({
      fetchCompletion: vi.fn(async () => ({ found: false, error: null })),
    })

    const summary = await runDeliveryBatch([makeReminder()], deps)

    expect(summary.completionQueryErrors).toBe(0)
    expect(summary.skippedCompleted).toBe(0)
    expect(summary.sent).toBe(1)
    expect(sendPush).toHaveBeenCalledTimes(1)
    const sentPayload = sendPush.mock.calls[0][0].payload as { title: string; body: string }
    expect(sentPayload.title).toBe('Pack bag')
    expect(sentPayload.body).toContain('Trip Prep')
  })
})

describe('runDeliveryBatch: explicit DB error handling (M6)', () => {
  it('a subscription query failure is logged and the rest of the batch continues', async () => {
    const first = makeReminder({ id: 'r1', user_id: 'uA' })
    const second = makeReminder({ id: 'r2', user_id: 'uB' })
    const { deps, sendPush } = makeDeps({
      fetchSubscriptions: vi.fn(async (userId: string) =>
        userId === 'uA' ? { rows: [], error: 'relation does not exist' } : { rows: [SUBSCRIPTION], error: null }),
    })

    const summary = await runDeliveryBatch([first, second], deps)

    expect(summary.subscriptionQueryErrors).toBe(1)
    expect(summary.processingErrors).toHaveLength(0)
    expect(sendPush).toHaveBeenCalledTimes(1)
    expect(summary.sent).toBe(1)
  })

  it('a failed disable of an invalid reminder is logged and the batch continues', async () => {
    const bad = makeReminder({ id: 'bad', timezone: 'Bad/Zone' })
    const good = makeReminder({ id: 'good' })
    const { deps, claim, sendPush, disableInvalid } = makeDeps({
      disableInvalid: vi.fn(async () => 'connection reset'),
    })

    const summary = await runDeliveryBatch([bad, good], deps)

    expect(summary.disableFailures).toBe(1)
    expect(disableInvalid).toHaveBeenCalledWith('bad', 'invalid-timezone')
    expect(summary.processingErrors).toHaveLength(0)
    expect(claim).toHaveBeenCalledTimes(1)
    expect(claim).toHaveBeenCalledWith(expect.objectContaining({ id: 'good' }))
    expect(sendPush).toHaveBeenCalledTimes(1)
    expect(summary.sent).toBe(1)
  })
})

describe('runDeliveryBatch: push + subscription revoke behavior', () => {
  it('counts attempted/sent/failed pushes and revokes 404/410 subscriptions', async () => {
    const { deps, revokeSubscription } = makeDeps({
      fetchSubscriptions: async () => ({
        rows: [SUBSCRIPTION, { ...SUBSCRIPTION, id: 'sub_2' }, { ...SUBSCRIPTION, id: 'sub_3' }],
        error: null,
      }),
      sendPush: vi.fn<DeliveryDeps['sendPush']>(async ({ subscription }) => {
        if (subscription.id === 'sub_1') return { sent: true }
        if (subscription.id === 'sub_2') return { sent: false, statusCode: 410, name: 'PushError', message: 'gone' }
        return { sent: false, statusCode: 500, name: 'PushError', message: 'boom' }
      }),
    })

    const summary = await runDeliveryBatch([makeReminder()], deps)

    expect(summary.subscriptionsAttempted).toBe(3)
    expect(summary.sent).toBe(1)
    expect(summary.pushFailures).toBe(2)
    expect(revokeSubscription).toHaveBeenCalledWith('sub_2', 410)
    expect(summary.subscriptionsRevoked).toBe(1)
    expect(summary.revokeFailures).toBe(0)
  })

  it('a failed revoke is counted without crashing the batch', async () => {
    const { deps, sendPush } = makeDeps({
      sendPush: vi.fn(async () => ({ sent: false, statusCode: 404, name: 'PushError', message: 'not found' })),
      revokeSubscription: vi.fn(async () => 'db error'),
    })

    const summary = await runDeliveryBatch([makeReminder()], deps)

    expect(summary.pushFailures).toBe(1)
    expect(summary.subscriptionsRevoked).toBe(0)
    expect(summary.revokeFailures).toBe(1)
    expect(sendPush).toHaveBeenCalledTimes(1)
  })

  it('a user with no active subscriptions is skipped without a push', async () => {
    const { deps, sendPush } = makeDeps({
      fetchSubscriptions: async () => ({ rows: [], error: null }),
    })

    const summary = await runDeliveryBatch([makeReminder()], deps)

    expect(summary.sent).toBe(0)
    expect(summary.subscriptionQueryErrors).toBe(0)
    expect(sendPush).not.toHaveBeenCalled()
  })
})