-- Migration: Support Standalone Reminders
-- 1. Make note_id nullable so reminders can exist without being attached to a note
-- 2. Add nullable title text for standalone reminder titles

alter table public.reminders
  alter column note_id drop not null;

alter table public.reminders
  add column if not exists title text;

notify pgrst, 'reload schema';
