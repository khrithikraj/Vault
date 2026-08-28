-- =============================================================================
-- Migration: Sharing feature (read-only preview links)
-- Created: 2026-08-28
-- Purpose: Let the vault owner create non-guessable, read-only snapshot links for
--          individual items. The snapshot is frozen at share time, so later edits
--          never change what a recipient sees, and only the display surface is
--          copied — never the owner's full private rows or documents.
--
-- Security model:
--   - Each row is gated by a cryptographically random `token` (128-bit, URL-safe),
--     generated client-side. There is no enumerable numeric id exposed.
--   - Anonymous visitors retrieve a snapshot ONLY through the `get_shared_item(token)`
--     security-definer RPC, keyed by the exact token in the shared link. The table
--     itself allows NO general anonymous SELECT — the shared_items table is not
--     enumerable via the PostgREST API.
--   - Write access (create/delete) is owner-only; RLS is enforced server-side by
--     auth.uid().
--   - The owner's own tables (items/categories/documents) are untouched and stay
--     locked to the owner — sharing never grants access to the rest of the vault.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

create table if not exists public.shared_items (
  id             uuid        primary key default gen_random_uuid(),
  -- Non-guessable access key. Uniqueness + high entropy prevent enumeration.
  token          text        not null unique check (char_length(token) >= 32),
  owner_id       uuid        not null references auth.users(id) on delete cascade,
  -- Snapshot of the displayed item (frozen at share time).
  title          text        not null check (char_length(trim(title)) > 0),
  category_name  text        not null default 'Vault',
  category_icon  text        not null default '✨',
  category_color text        not null default '#dc5000',
  image_url      text,
  source_url     text,
  notes          text,
  -- [{ label, value:{kind:'text'|'url'|'currency', value}, required }]
  fields         jsonb       not null default '[]'::jsonb,
  created_at     timestamptz not null default timezone('utc', now())
);

create index if not exists idx_shared_items_token on public.shared_items (token);
create index if not exists idx_shared_items_owner_id on public.shared_items (owner_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.shared_items enable row level security;

-- NOTE: There is deliberately NO anonymous/public SELECT policy. Anonymous / public
-- direct table reads are disabled so the whole table can't be enumerated. Snapshot
-- retrieval goes exclusively through the get_shared_item(token) RPC below, which is
-- keyed by the share token (and omits owner_id).

-- Owner-only SELECT: lets createSharedItem's INSERT ... RETURNING (.select('token'))
-- see the row it just created, and lets owners read their own share records. Anonymous
-- and non-owner roles cannot SELECT the table directly — the public preview goes only
-- through get_shared_item(token).
drop policy if exists "shared_items_select_own" on public.shared_items;
create policy "shared_items_select_own"
  on public.shared_items for select
  using (auth.uid() = owner_id);

-- Drop the previous wide-open select policy if it exists from the earlier draft.
drop policy if exists "shared_items_select_any" on public.shared_items;

-- Insert: only the authenticated owner (derived server-side via auth.uid()).
drop policy if exists "shared_items_insert_own" on public.shared_items;
create policy "shared_items_insert_own"
  on public.shared_items for insert
  with check (auth.uid() = owner_id);

-- Delete: owner may revoke a share link.
drop policy if exists "shared_items_delete_own" on public.shared_items;
create policy "shared_items_delete_own"
  on public.shared_items for delete
  using (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- get_shared_item(token) — security-definer RPC for anonymous preview access.
--
-- Runs as the table owner (bypassing RLS), so it can read any row, but it NEVER
-- returns a general set: it is strictly keyed by the exact token supplied in the
-- share URL and returns at most one row. It omits owner_id so we don't leak who owns
-- the snapshot. Callers (including unauth'd visitors) must know a valid token; with
-- 128 bits of entropy, guessing is infeasible. This keeps the anonymous /s/:token
-- experience working while not exposing the shared_items table for direct SELECT.
-- ---------------------------------------------------------------------------

create or replace function public.get_shared_item(p_token text)
returns table (
  id             uuid,
  token          text,
  title          text,
  category_name  text,
  category_icon  text,
  category_color text,
  image_url      text,
  source_url     text,
  notes          text,
  fields         jsonb,
  created_at     timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select id, token, title, category_name, category_icon, category_color,
         image_url, source_url, notes, fields, created_at
  from public.shared_items
  where token = p_token
  limit 1;
$$;

-- Grant execution to the anonymous role (so /s/:token works for logged-out visitors)
-- and to authenticated users. Revoke from the blanket `public` grant first so the
-- function is only callable by these explicit roles.
revoke all on function public.get_shared_item(text) from public;
grant execute on function public.get_shared_item(text) to anon, authenticated;

-- The owner still manages their own share records through the normal table API
-- (Row-level insert/delete policies above). No RLS changes are made to the private
-- vault tables (categories/items/notes/documents) — they remain owner-only.

-- Reload PostgREST schema cache so the new table & function are immediately visible.
notify pgrst, 'reload schema';
