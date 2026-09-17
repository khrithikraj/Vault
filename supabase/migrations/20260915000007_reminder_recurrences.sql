-- Migration: Support reminder recurrence modes ('once', 'daily', 'weekdays', 'weekly')
alter table public.reminders
  drop constraint if exists reminders_recurrence_check;

alter table public.reminders
  add constraint reminders_recurrence_check
  check (recurrence in ('once', 'daily', 'weekdays', 'weekly'));

notify pgrst, 'reload schema';
