/**
 * Daily checklist reminder delivery (Web Push).
 *
 * Invoked periodically by the scheduler (see "Scheduling" below). For every due
 * reminder it atomically claims the occurrence (idempotent across concurrent runs)
 * and sends one push to each active subscription of the owning user.
 *
 * Safety guarantees (defense in depth - never rely on client cleanup alone):
 *   - Reminders for a soft-deleted note (notes.deleted_at IS NOT NULL) are skipped
 *     and the reminder row is DISABLED (enabled = false) so it can never fire again.
 *   - Reminders whose checklist_item_id no longer exists in the note's checklist are
 *     skipped and disabled the same way.
 *   - A reminder whose task was ALREADY COMPLETED today (daily_checklist_completions
 *     row for reminder_id + today's local date) is skipped for delivery, but its
 *     schedule still ADVANCES to the next daily occurrence and remains idempotent.
 *   - Hard-deleted notes already cascade-remove their reminders via FK.
 *
 * Scheduling
 * ----------
 * This function is NOT invoked by anything in the app; it needs a scheduled trigger.
 * Using Supabase, create a Cron / pg_cron job that POSTs to the deployed function
 * (deploy with: `supabase functions deploy send-reminders`) every minute:
 *
 *   select cron.schedule(
 *     'vault-send-reminders',
 *     '* * * * *',
 *     $$ select net.http_post(
 *          url := 'https://<project-ref>.functions.supabase.co/send-reminders',
 *          headers := jsonb_build_object(
 *            'Content-Type', 'application/json',
 *            'Authorization', 'Bearer ' || '<service_role_key>'
 *          ),
 *          body := '{}'
 *        ) $$
 *   );
 *
 * Prerequisites: the `pg_cron` and `pg_net` extensions must be enabled
 * (`create extension if not exists pg_cron with schema extensions;` and
 * `create extension if not exists pg_net;`) and the function's own deployment must
 * have `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` present (automatic) plus the
 * VAPID secrets: `VAPID_SUBJECT`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`.
 *
 * Do not store the service_role key or VAPID private key in any migration or repo
 * file - keep them in Supabase secrets / `.env`-backed deployment config only.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push'
import {
  buildNotificationContent,
  formatWebPushSubscription,
  isReminderValid,
  isSubscriptionGone,
  nextFireAtForRecurrence,
  normalizeNote,
  type NoteRecord,
  type PushSubscriptionRecord,
  type ReminderRecurrence,
  type Weekday,
  zonedDateStr,
} from './schedule.ts'

type ReminderRow = {
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

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const vapidSubject = Deno.env.get('VAPID_SUBJECT')
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')

if (!supabaseUrl || !supabaseKey) {
  console.error('[init] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
}
if (!vapidSubject || !vapidPublicKey || !vapidPrivateKey) {
  console.error('[init] Missing VAPID configuration (subject, public key, or private key)')
} else {
  try {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)
    console.log('[init] VAPID details configured successfully')
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error(`[init] Failed to configure VAPID details: ${errorMsg}`)
  }
}

const supabase = createClient(supabaseUrl!, supabaseKey!)

Deno.serve(async () => {
  const now = new Date()
  const nowIso = now.toISOString()
  const { data: reminders, error } = await supabase
    .from('reminders')
    .select('id,user_id,note_id,checklist_item_id,recurrence,day_of_week,local_time,timezone,next_fire_at,notes!inner(title,deleted_at,checklist)')
    .eq('enabled', true)
    .or(`next_fire_at.is.null,next_fire_at.lte.${nowIso}`)
    .limit(100)
  if (error) {
    console.error(`[fetch-reminders-error] ${error.message}`)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  let sent = 0
  let skippedCompleted = 0
  let disabledInvalid = 0
  let subscriptionsAttempted = 0
  let pushFailures = 0
  let subscriptionsRevoked = 0

  for (const reminder of (reminders ?? []) as ReminderRow[]) {
    const note = normalizeNote(reminder.notes)
    const valid = isReminderValid(reminder, note)

    if (!valid) {
      // Backend safety: never fire for trashed notes or removed checklist items.
      // Disable it (guarded on the same due condition as the claim) so it cannot
      // keep firing forever, and it drops out of future due selection.
      await supabase
        .from('reminders')
        .update({ enabled: false, last_fired_at: nowIso })
        .eq('id', reminder.id)
        .eq('enabled', true)
        .or(`next_fire_at.is.null,next_fire_at.lte.${nowIso}`)
      disabledInvalid += 1
      continue
    }

    // Claim atomically so a concurrent cron run can't double-send the same occurrence.
    // For 'once' recurrence nextFireAtForRecurrence returns null — we disable the reminder.
    const claimNextFireAt = nextFireAtForRecurrence(reminder, now)
    const isOnce = (reminder.recurrence ?? 'daily') === 'once'
    const { data: claimed } = await supabase
        .from('reminders')
      .update({
        next_fire_at: claimNextFireAt,
        last_fired_at: nowIso,
        ...(isOnce ? { enabled: false } : {}),
      })
      .eq('id', reminder.id)
      .eq('enabled', true)
      .or(`next_fire_at.is.null,next_fire_at.lte.${nowIso}`)
      .select('id')
    if (!claimed?.length) continue

    // If the task was already completed today, skip delivery but keep the schedule
    // advanced (the claim above already set next_fire_at to the next occurrence).
    const localDate = zonedDateStr(now, reminder.timezone)
    const { data: completion } = await supabase
      .from('daily_checklist_completions')
      .select('reminder_id')
      .eq('reminder_id', reminder.id)
      .eq('local_date', localDate)
      .maybeSingle()
    if (completion) {
      skippedCompleted += 1
      continue
    }

    const { title, body } = buildNotificationContent(reminder, note!)

    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('id,endpoint,p256dh,auth')
      .eq('user_id', reminder.user_id)
      .is('revoked_at', null)

    for (const subscription of (subscriptions ?? []) as PushSubscriptionRecord[]) {
      subscriptionsAttempted += 1
      const pushSubscription = formatWebPushSubscription(subscription)
      try {
        await webpush.sendNotification(
          pushSubscription,
          JSON.stringify({
            title,
            body,
            noteId: reminder.note_id,
            checklistItemId: reminder.checklist_item_id ?? undefined,
          }),
        )
        sent += 1
        console.log(`[push-result] subscriptionId=${subscription.id} status=success`)
      } catch (pushError: unknown) {
        pushFailures += 1
        const err = (pushError && typeof pushError === 'object') ? (pushError as Record<string, unknown>) : {}
        const statusCode = typeof err.statusCode === 'number' ? err.statusCode : null
        const errorName = typeof err.name === 'string' ? err.name : 'Error'
        const errorMessage = typeof err.message === 'string' ? err.message : String(pushError)
        console.error(
          `[push-result] subscriptionId=${subscription.id} status=failure statusCode=${statusCode ?? 'none'} errorName=${errorName} errorMessage=${errorMessage}`,
        )

        if (isSubscriptionGone(statusCode)) {
          await supabase
            .from('push_subscriptions')
            .update({ revoked_at: new Date().toISOString() })
            .eq('id', subscription.id)
          subscriptionsRevoked += 1
          console.log(`[push-revoked] subscriptionId=${subscription.id} statusCode=${statusCode}`)
        }
      }
    }
  }

  const result = {
    processed: reminders?.length ?? 0,
    subscriptionsAttempted,
    sent,
    pushFailures,
    subscriptionsRevoked,
    skippedCompleted,
    disabledInvalid,
  }

  console.log(
    `[send-reminders-summary] subscriptionsAttempted=${subscriptionsAttempted} sent=${sent} failed=${pushFailures} revoked=${subscriptionsRevoked} processed=${result.processed} skippedCompleted=${skippedCompleted} disabledInvalid=${disabledInvalid}`,
  )

  return new Response(
    JSON.stringify(result),
    { headers: { 'content-type': 'application/json' } },
  )
})
