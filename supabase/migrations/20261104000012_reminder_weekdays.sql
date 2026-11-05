-- Migration: Support selecting multiple weekdays for weekly reminders.
-- `day_of_week` remains the compatibility fallback for existing rows.
alter table public.reminders
  add column if not exists weekdays text[];

alter table public.reminders
  drop constraint if exists reminders_weekdays_check;

alter table public.reminders
  add constraint reminders_weekdays_check
  check (
    weekdays is null
    or (
      cardinality(weekdays) > 0
      and weekdays <@ array['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']::text[]
    )
  );

notify pgrst, 'reload schema';
