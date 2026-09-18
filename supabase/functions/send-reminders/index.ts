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
 * H2 / M5 / M6 hardening (per-reminder fault tolerance & fail-safe DB policy):
 *   - Every reminder is processed in isolation. A reminder that throws, or whose
 *     DB calls error, is logged and SKIPPED - it never aborts the rest of the batch.
 *   - The reminder is validated BEFORE its occurrence is claimed: reminder shape,
 *     recurrence, local_time, timezone, referenced checklist item and note/checklist
 *     structure are all checked deterministically first. An invalid timezone can
 *     therefore NEVER consume a claimed occurrence, and malformed data is disabled
 *     (exactly like a trashed note / removed item) after the same guarded update.
 *   - Claim semantics are unchanged and remain idempotent: the same atomic, guarded
 *     UPDATE (`enabled = true` AND due) prevents concurrent cron runs from
 *     double-sending the same occurrence.
 *   - Fail-safe completion (M5): a daily_checklist_completions query ERROR is never
 *     read as "not completed". On error we do NOT send the push, we log, and the
 *     batch continues. The claim stays advanced, so THIS occurrence is consumed
 *     without a notification - it is not re-opened and not retried by a later cron
 *     tick. That is chosen over the only alternatives: sending a push when the
 *     completion state is unknown (an unwanted notification), or unwinding the claim
 *     and re-opening the occurrence to a concurrent run (a duplicate delivery).
 *   - DB errors are never silently swallowed (M6). Each failure's real retry semantics:
 *       disable-invalid error ......... no claim occurred, reminder stays due, next cron tick retries
 *       claim error ................... the claim did not succeed, reminder stays due, next cron tick retries
 *       completion error (post-claim).. no push, claim stays advanced, THIS occurrence is consumed (no retry)
 *       subscription error (post-claim). no push, claim stays advanced, THIS occurrence is consumed (no retry)
 *       subscription revoke error ..... push already failed, subscription stays active,
 *                                     a later run may hit it again, batch continues
 *
 * Scheduling
 * ----------
 * This function is NOT invoked by anything in the app; it needs a scheduled trigger.
 * It is driven by the `vault-send-reminders` pg_cron / pg_net job (created manually)
 * that POSTs to the deployed function (deploy with:
 * `supabase functions deploy send-reminders`) every minute:
 *
 *   select cron.schedule(
 *     'vault-send-reminders',
 *     '* * * * *',
 *     $$ select net.http_post(
 *          url := 'https://<project-ref>.supabase.co/functions/v1/send-reminders',
 *          headers := jsonb_build_object(
 *            'Content-Type', 'application/json',
 *            'apikey', '<secret key named sendreminders>'
 *          ),
 *          body := '{}',
 *          timeout_milliseconds := 1000
 *        ) $$
 *   );
 *
 * Caller authorization (H1 hardening - official service-to-service pattern)
 * -------------------------------------------------------------------------
 * The handler is wrapped in `withSupabase({ auth: 'secret:sendreminders' })`
 * from the official `@supabase/server` SDK. Only the dedicated secret key NAMED
 * `sendreminders` sent on the `apikey` header authenticates (timing-safe
 * comparison). Publishable keys, any other secret key, user JWTs, legacy
 * service_role keys, and requests carrying no credential are all rejected with
 * 401 and the handler never runs. The privileged work uses `ctx.supabaseAdmin`
 * (an admin client built from the matched secret key, bypassing RLS), so the
 * function no longer needs SUPABASE_SERVICE_ROLE_KEY at all.
 *
 * Because the platform JWT gate expects a user JWT and would reject this
 * API-key-only call, the function is deployed with `verify_jwt = false` as set
 * in `supabase/config.toml` (scoped to this function only - every other
 * function keeps the platform default). The cron job above is the intended
 * caller.
 *
 * Deployment order (manual - do not skip):
 *   1. Create a secret key whose NAME is `sendreminders`
 *      (Dashboard -> Settings -> API keys -> Secret keys -> "New key").
 *   2. Update the live `vault-send-reminders` cron job so its `apikey` header
 *      value is that secret key.
 *   3. Invoke the deployed function once with the new key: it must still return
 *      200 while the OLD deployment is live (the apikey-compatible JWT gate on
 *      the old version lets a secret key through).
 *   4. Deploy this hardened function TOGETHER WITH `supabase/config.toml`
 *      (`supabase functions deploy send-reminders`).
 *   5. Confirm the next cron tick returns 200 again.
 *   If the cron still sends a publishable key or a legacy service_role JWT, the
 *   function rejects it (401) and reminders stop firing.
 *
 * Prerequisites: the `pg_cron` and `pg_net` extensions must be enabled
 * (`create extension if not exists pg_cron with schema extensions;` and
 * `create extension if not exists pg_net;`) and the function's own deployment
 * must have `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEYS` / `SUPABASE_SECRET_KEYS`
 * (auto-injected; `SUPABASE_SECRET_KEYS` must contain the `sendreminders`
 * entry) plus the VAPID secrets: `VAPID_SUBJECT`, `VAPID_PUBLIC_KEY`,
 * `VAPID_PRIVATE_KEY`.
 *
 * Do not store any secret key or the VAPID private key in any migration or repo
 * file - keep them in Supabase secrets / Dashboard API keys only.
 */

import webpush from 'npm:web-push'
import { withSupabase } from 'npm:@supabase/server'
import {
  formatWebPushSubscription,
  type PushSubscriptionRecord,
} from './schedule.ts'
import {
  runDeliveryBatch,
  type DeliveryDeps,
  type ReminderRowForDelivery,
} from './delivery.ts'

const vapidSubject = Deno.env.get('VAPID_SUBJECT')
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')

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

Deno.serve(
  withSupabase(
    { auth: 'secret:sendreminders' },
    async (_req: Request, ctx) => {
      const supabase = ctx.supabaseAdmin

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

      const reminderRows = (reminders ?? []) as ReminderRowForDelivery[]

      const deps: DeliveryDeps = {
        now,
        now_iso: nowIso,
        disableInvalid: async (reminderId) => {
          const { error } = await supabase
            .from('reminders')
            .update({ enabled: false, last_fired_at: nowIso })
            .eq('id', reminderId)
            .eq('enabled', true)
            .or(`next_fire_at.is.null,next_fire_at.lte.${nowIso}`)
          return error ? error.message : null
        },
        claim: async ({ id, next_fire_at, now_iso, is_once }) => {
          const { data, error } = await supabase
            .from('reminders')
            .update({
              next_fire_at,
              last_fired_at: now_iso,
              ...(is_once ? { enabled: false } : {}),
            })
            .eq('id', id)
            .eq('enabled', true)
            .or(`next_fire_at.is.null,next_fire_at.lte.${now_iso}`)
            .select('id')
          if (error) return { claimed: false, error: error.message }
          return { claimed: (data?.length ?? 0) > 0, error: null }
        },
        fetchCompletion: async (reminderId, localDate) => {
          const { data, error } = await supabase
            .from('daily_checklist_completions')
            .select('reminder_id')
            .eq('reminder_id', reminderId)
            .eq('local_date', localDate)
            .maybeSingle()
          if (error) return { found: false, error: error.message }
          return { found: data != null, error: null }
        },
        fetchSubscriptions: async (userId) => {
          const { data, error } = await supabase
            .from('push_subscriptions')
            .select('id,endpoint,p256dh,auth')
            .eq('user_id', userId)
            .is('revoked_at', null)
          if (error) return { rows: [], error: error.message }
          return { rows: (data ?? []) as PushSubscriptionRecord[], error: null }
        },
        revokeSubscription: async (subscriptionId, statusCode) => {
          const { error } = await supabase
            .from('push_subscriptions')
            .update({ revoked_at: new Date().toISOString() })
            .eq('id', subscriptionId)
          if (error) {
            console.error(`[push-revoke-error] subscriptionId=${subscriptionId} statusCode=${statusCode ?? 'none'} error=${error.message}`)
            return error.message
          }
          console.log(`[push-revoked] subscriptionId=${subscriptionId} statusCode=${statusCode}`)
          return null
        },
        sendPush: async ({ subscription, payload }) => {
          const pushSubscription = formatWebPushSubscription(subscription)
          try {
            await webpush.sendNotification(pushSubscription, JSON.stringify(payload))
            console.log(`[push-result] subscriptionId=${subscription.id} status=success`)
            return { sent: true }
          } catch (pushError: unknown) {
            const err = (pushError && typeof pushError === 'object') ? (pushError as Record<string, unknown>) : {}
            const statusCode = typeof err.statusCode === 'number' ? err.statusCode : null
            const errorName = typeof err.name === 'string' ? err.name : 'Error'
            const errorMessage = typeof err.message === 'string' ? err.message : String(pushError)
            console.error(
              `[push-result] subscriptionId=${subscription.id} status=failure statusCode=${statusCode ?? 'none'} errorName=${errorName} errorMessage=${errorMessage}`,
            )
            return { sent: false, statusCode, name: errorName, message: errorMessage }
          }
        },
      }

      const summary = await runDeliveryBatch(
        reminderRows,
        deps,
        (reminderId, outcome) => {
          switch (outcome.kind) {
            case 'invalid-disabled':
              console.log(`[disabled-invalid] reminderId=${reminderId} reason=${outcome.reason}`)
              break
            case 'disable-error':
              console.error(`[disable-invalid-error] reminderId=${reminderId} reason=${outcome.reason} error=${outcome.error}`)
              break
            case 'claim-error':
              console.error(`[claim-error] reminderId=${reminderId} error=${outcome.error}`)
              break
            case 'completion-error':
              console.error(`[completion-query-error] reminderId=${reminderId} error=${outcome.error}`)
              break
            case 'subscription-error':
              console.error(`[subscription-query-error] reminderId=${reminderId} error=${outcome.error}`)
              break
          }
        },
      )

      const result = {
        processed: summary.processed,
        subscriptionsAttempted: summary.subscriptionsAttempted,
        sent: summary.sent,
        pushFailures: summary.pushFailures,
        subscriptionsRevoked: summary.subscriptionsRevoked,
        skippedCompleted: summary.skippedCompleted,
        disabledInvalid: summary.disabledInvalid,
        disableFailures: summary.disableFailures,
        claimFailures: summary.claimFailures,
        completionQueryErrors: summary.completionQueryErrors,
        subscriptionQueryErrors: summary.subscriptionQueryErrors,
        revokeFailures: summary.revokeFailures,
        processingErrors: summary.processingErrors.length,
      }

      console.log(
        `[send-reminders-summary] subscriptionsAttempted=${summary.subscriptionsAttempted} sent=${summary.sent} failed=${summary.pushFailures} revoked=${summary.subscriptionsRevoked} processed=${summary.processed} skippedCompleted=${summary.skippedCompleted} disabledInvalid=${summary.disabledInvalid} disableFailures=${summary.disableFailures} claimFailures=${summary.claimFailures} completionErrors=${summary.completionQueryErrors} subscriptionErrors=${summary.subscriptionQueryErrors} revokeFailures=${summary.revokeFailures} processingErrors=${summary.processingErrors.length}`,
      )

      return new Response(
        JSON.stringify(result),
        { headers: { 'content-type': 'application/json' } },
      )
    },
  ),
)