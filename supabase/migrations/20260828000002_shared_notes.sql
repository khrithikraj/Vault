-- =============================================================================
-- Migration: Note sharing (read-only preview links)
-- Created: 2026-08-28
-- Purpose: Extend the existing shared-items sharing feature to NOTES. Reuses the
--          SAME `shared_items` infrastructure — same table, same token system,
--          same RLS model, same public /s/:token preview — rather than creating a
--          second sharing table.
--
--   - A note snapshot is stored in the same `shared_items` row: title -> `title`,
--     body -> `notes` (text), checklist -> `checklist` (jsonb), and disciminated
--     from an item snapshot by the new `kind` column ('item' | 'note').
--   - The security model is UNCHANGED: no public SELECT on the table; preview goes
--     only through the get_shared_item(token) security-definer RPC (now also
--     returning the note fields for note snapshots); owner_id stays out of the RPC
--     output. The owner's private `notes` table remains RLS-locked to the owner.
--
-- No already-applied migration is modified; this is a NEW additive migration.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Additive schema: discriminate snapshot type + carry the note checklist.
-- ---------------------------------------------------------------------------

alter table public.shared_items
  add column if not exists kind      text  not null default 'item' check (kind in ('item', 'note'));

alter table public.shared_items
  add column if not exists checklist jsonb not null default '[]'::jsonb;

-- ---------------------------------------------------------------------------
-- RLS is unchanged: the same owner-only insert/delete/select policies on
-- shared_items still apply to note snapshots (the new columns don't alter them).
-- Anonymous visitors still read ONLY through the RPC below.
-- ---------------------------------------------------------------------------

-- Replace the security-definer RPC with an updated return set that also carries the
-- note-specific fields (kind + checklist).
--
-- IMPORTANT: Postgres does NOT allow CREATE OR REPLACE FUNCTION to add/remove return
-- columns, so we must DROP and re-CREATE. The 0001 migration's function has the same
-- `(text)` signature but a different RETURNS TABLE, hence the drop-then-create below.
--
-- No CASCADE is used: if anything depended on this function we WANT the migration to
-- fail loudly rather than silently drop those dependents. There are no such dependents
-- (RLS policies do not reference this function), so the plain DROP succeeds.
--
-- Still strictly keyed by the exact token, returns at most one row, never exposes
-- owner_id. Works for unauth'd visitors.
drop function public.get_shared_item(text);

create function public.get_shared_item(p_token text)
returns table (
  id             uuid,
  token          text,
  kind           text,
  title          text,
  category_name  text,
  category_icon  text,
  category_color text,
  image_url      text,
  source_url     text,
  notes          text,
  checklist      jsonb,
  fields         jsonb,
  created_at     timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select id, token, kind, title, category_name, category_icon, category_color,
         image_url, source_url, notes, checklist, fields, created_at
  from public.shared_items
  where token = p_token
  limit 1;
$$;

-- Keep the same execution grants (anon for logged-out preview; authenticated users).
revoke all on function public.get_shared_item(text) from public;
grant execute on function public.get_shared_item(text) to anon, authenticated;

-- Reload PostgREST schema cache so the new columns & function signature are visible.
notify pgrst, 'reload schema';
