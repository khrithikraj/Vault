/**
 * Per-reminder delivery orchestration for the `send-reminders` Edge Function.
 *
 * Deliberately free of any Deno / Supabase / web-push dependency: Supabase and
 * web-push are injected through `DeliveryDeps`, so the ENTIRE decision flow -
 * preflight validation, atomic claim, completion lookup, content build,
 * subscription fetch, push and revoke handling - can be unit-tested
 * deterministically without a real database. `index.ts` is a thin adapter that
 * binds these deps to the real Supabase admin client and web-push library.
 *
 * Hardening guarantees implemented here (H2 / M5 / M6):
 *   - Preflight validation happens BEFORE the atomic claim, so a bad timezone or
 *     malformed note/checklist can never consume an occurrence.
 *   - One failing reminder never aborts the rest of the batch (`runDeliveryBatch`
 *     isolates each reminder).
 *   - The claim is unchanged: the same atomic, guarded UPDATE keeps concurrent
 *     cron runs from double-sending an occurrence.
 *   - After the claim, the occurrence is treated as reserved. On any DB error the
 *     push is NOT sent (failure is never read as "no completion" / "no
 *     subscriptions"), the claim is left advanced (never unwound - unwinding
 *     could re-open the occurrence to a concurrent run and duplicate delivery),
 *     and a structured outcome is returned for logging. NOTE: because the claim
 *     stays advanced, a POST-CLAIM error (completion query or subscription query)
 *     consumes THIS occurrence - it is not re-opened and not retried by a later
 *     cron tick. Only PRE-claim failures (disable-invalid, claim) leave the
 *     reminder due and thus retryable on the next tick.
 */

import {
  buildNotificationContent,
  isSubscriptionGone,
  nextFireAtForRecurrence,
  preflightReminder,
  type NoteRecord,
  type PushSubscriptionRecord,
  type ReminderPreflightError,
  type ReminderRecurrence,
  type Weekday,
  zonedDateStr,
} from './schedule.ts'

export type ReminderRowForDelivery = {
  id: string
  user_id: string
  note_id: string
  checklist_item_id: string | null
  recurrence: ReminderRecurrence
  day_of_week?: Weekday | null
  local_time: string
  timezone: string
  next_fire_at: string | null
  notes: NoteRecord | NoteRecord[]
}

export type ClaimInput = {
  id: string
  next_fire_at: string | null
  now_iso: string
  is_once: boolean
}

export type PushSendResult =
  | { sent: true }
  | { sent: false; statusCode: number | null; name: string; message: string }

export type DeliveryDeps = {
  now: Date
  now_iso: string
  /** Disables a deterministically-invalid reminder. Returns an error message on
   *  DB failure, null on success (including "no matching row"). */
  disableInvalid: (reminderId: string, reason: ReminderPreflightError) => Promise<string | null>
  /** Atomically claims the occurrence. `claimed: false` (no error) means a
   *  concurrent run already claimed it. */
  claim: (input: ClaimInput) => Promise<{ claimed: boolean; error: string | null }>
  /** Looks up today's completion row. `error` must NEVER be read as "not found".
   *  Called AFTER the claim: on error this occurrence is consumed (no push, no
   *  retry of this occurrence). */
  fetchCompletion: (reminderId: string, localDate: string) => Promise<{ found: boolean; error: string | null }>
  /** Fetches the user's active push subscriptions. `error` must NEVER be read as
   *  "no subscriptions". Called AFTER the claim: on error this occurrence is
   *  consumed (no push, no retry of this occurrence). */
  fetchSubscriptions: (userId: string) => Promise<{ rows: PushSubscriptionRecord[]; error: string | null }>
  /** Revokes a dead subscription. Returns an error message on failure. The push
   *  already failed; if the revoke also fails the subscription stays active and a
   *  later run may encounter it again. Never aborts the batch. */
  revokeSubscription: (subscriptionId: string, statusCode: number | null) => Promise<string | null>
  /** Sends one push. Never throws - every failure is returned as a result. */
  sendPush: (input: {
    subscription: PushSubscriptionRecord
    payload: { title: string; body: string; noteId: string; checklistItemId: string | undefined }
  }) => Promise<PushSendResult>
}

export type ReminderDeliveryOutcome =
  | { kind: 'invalid-disabled'; reason: ReminderPreflightError }
  | { kind: 'disable-error'; reason: ReminderPreflightError; error: string }
  | { kind: 'claim-error'; error: string }
  | { kind: 'not-claimed' }
  | { kind: 'completion-error'; error: string }
  | { kind: 'completed' }
  | { kind: 'subscription-error'; error: string }
  | { kind: 'no-subscriptions' }
  | { kind: 'delivered'; attempts: number; sent: number; failed: number; revoked: number; revokeFailed: number }

export async function deliverDueReminder(
  reminder: ReminderRowForDelivery,
  deps: DeliveryDeps,
): Promise<ReminderDeliveryOutcome> {
  const preflight = preflightReminder(reminder)
  if (!preflight.ok) {
    const error = await deps.disableInvalid(reminder.id, preflight.reason)
    if (error) return { kind: 'disable-error', reason: preflight.reason, error }
    return { kind: 'invalid-disabled', reason: preflight.reason }
  }

  const nextFireAt = nextFireAtForRecurrence(reminder, deps.now)
  const isOnce = (reminder.recurrence ?? 'daily') === 'once'
  const claim = await deps.claim({
    id: reminder.id,
    next_fire_at: nextFireAt,
    now_iso: deps.now_iso,
    is_once: isOnce,
  })
  if (claim.error) return { kind: 'claim-error', error: claim.error }
  if (!claim.claimed) return { kind: 'not-claimed' }

  // The occurrence is claimed (next_fire_at advanced) from here on. Every later
  // failure must fail safe: send NO push when the DB state is unknown, and do NOT
  // unwind the claim (unwinding re-opens the occurrence to a concurrent run and
  // can produce a duplicate delivery). A lookup failure below therefore consumes
  // this occurrence - it is NOT re-opened and NOT retried on a later cron tick -
  // rather than risk a duplicate or unwanted notification.
  const localDate = zonedDateStr(deps.now, reminder.timezone)
  const completion = await deps.fetchCompletion(reminder.id, localDate)
  if (completion.error) return { kind: 'completion-error', error: completion.error }
  if (completion.found) return { kind: 'completed' }

  const { title, body } = buildNotificationContent(reminder, preflight.note)

  const subscriptions = await deps.fetchSubscriptions(reminder.user_id)
  if (subscriptions.error) return { kind: 'subscription-error', error: subscriptions.error }

  const pushTally = { attempts: 0, sent: 0, failed: 0, revoked: 0, revokeFailed: 0 }
  for (const subscription of subscriptions.rows) {
    pushTally.attempts += 1
    const push = await deps.sendPush({
      subscription,
      payload: {
        title,
        body,
        noteId: reminder.note_id,
        checklistItemId: reminder.checklist_item_id ?? undefined,
      },
    })
    if (push.sent) {
      pushTally.sent += 1
      continue
    }
    pushTally.failed += 1
    if (isSubscriptionGone(push.statusCode)) {
      const revokeError = await deps.revokeSubscription(subscription.id, push.statusCode)
      if (revokeError) pushTally.revokeFailed += 1
      else pushTally.revoked += 1
    }
  }
  return { kind: 'delivered', ...pushTally }
}

export type DeliverySummary = {
  processed: number
  subscriptionsAttempted: number
  sent: number
  pushFailures: number
  subscriptionsRevoked: number
  revokeFailures: number
  skippedCompleted: number
  disabledInvalid: number
  disableFailures: number
  claimFailures: number
  completionQueryErrors: number
  subscriptionQueryErrors: number
  invalidReasons: Partial<Record<ReminderPreflightError, number>>
  processingErrors: { reminderId: string; message: string }[]
}

export type ReminderBatchListener = (reminderId: string, outcome: ReminderDeliveryOutcome) => void

/** Processes a batch of due reminders. Each reminder is fully isolated: an
 *  unexpected throw inside one reminder is captured as a `processingError` and
 *  the remaining reminders are still processed. */
export async function runDeliveryBatch(
  reminders: ReminderRowForDelivery[],
  deps: DeliveryDeps,
  onOutcome?: ReminderBatchListener,
): Promise<DeliverySummary> {
  const summary: DeliverySummary = {
    processed: reminders.length,
    subscriptionsAttempted: 0,
    sent: 0,
    pushFailures: 0,
    subscriptionsRevoked: 0,
    revokeFailures: 0,
    skippedCompleted: 0,
    disabledInvalid: 0,
    disableFailures: 0,
    claimFailures: 0,
    completionQueryErrors: 0,
    subscriptionQueryErrors: 0,
    invalidReasons: {},
    processingErrors: [],
  }

  for (const reminder of reminders) {
    try {
      const outcome = await deliverDueReminder(reminder, deps)
      onOutcome?.(reminder.id, outcome)
      tallyOutcome(outcome, summary)
    } catch (error) {
      summary.processingErrors.push({ reminderId: reminder.id, message: errorMessage(error) })
    }
  }

  return summary
}

function tallyOutcome(outcome: ReminderDeliveryOutcome, summary: DeliverySummary): void {
  switch (outcome.kind) {
    case 'invalid-disabled':
      summary.disabledInvalid += 1
      summary.invalidReasons[outcome.reason] = (summary.invalidReasons[outcome.reason] ?? 0) + 1
      return
    case 'disable-error':
      summary.disableFailures += 1
      return
    case 'claim-error':
      summary.claimFailures += 1
      return
    case 'completion-error':
      summary.completionQueryErrors += 1
      return
    case 'completed':
      summary.skippedCompleted += 1
      return
    case 'subscription-error':
      summary.subscriptionQueryErrors += 1
      return
    case 'delivered':
      summary.subscriptionsAttempted += outcome.attempts
      summary.sent += outcome.sent
      summary.pushFailures += outcome.failed
      summary.subscriptionsRevoked += outcome.revoked
      summary.revokeFailures += outcome.revokeFailed
      return
    case 'not-claimed':
    case 'no-subscriptions':
      return
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}