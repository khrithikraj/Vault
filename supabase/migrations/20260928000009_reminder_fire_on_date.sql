-- Migration: Add fire_on_date column to reminders for exact-date 'once' recurrence
--
-- Semantics:
--   recurrence = once     -> fire_on_date holds the selected calendar date
--   recurrence = daily    -> fire_on_date is NULL
--   recurrence = weekdays -> fire_on_date is NULL
--   recurrence = weekly   -> fire_on_date is NULL (day_of_week carries the weekday)
--
-- next_fire_at is untouched: it remains the computed UTC scheduling instant used
-- by the existing delivery system. fire_on_date records the user's intended
-- calendar date and is what the send-reminders Edge Function reads to resolve the
-- exact one-time occurrence. It is intentionally nullable and unconstrained, like
-- day_of_week, so a remote schema that has not applied this migration yet can
-- never fail a reminder write.
alter table public.reminders
  add column if not exists fire_on_date date;

notify pgrst, 'reload schema';
