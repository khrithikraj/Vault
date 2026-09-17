-- Migration: make checklist_item_id nullable so that NULL = note-level reminder
-- and a real checklist item UUID = item-level reminder.

alter table public.reminders
  alter column checklist_item_id drop not null;

alter table public.reminders
  drop constraint if exists reminders_note_id_checklist_item_id_key;

create unique index if not exists idx_reminders_note_level
  on public.reminders (note_id)
  where checklist_item_id is null;

create unique index if not exists idx_reminders_item_level
  on public.reminders (note_id, checklist_item_id)
  where checklist_item_id is not null;

notify pgrst, 'reload schema';
