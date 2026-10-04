-- Migration: Add is_favorite column to reminders table
alter table public.reminders
  add column if not exists is_favorite boolean not null default false;
