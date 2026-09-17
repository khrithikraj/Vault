-- Migration: Add day_of_week column to reminders table for Weekly recurrence
alter table public.reminders
  add column if not exists day_of_week text
  check (day_of_week in ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday') or day_of_week is null);

notify pgrst, 'reload schema';
