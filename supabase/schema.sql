create extension if not exists pgcrypto;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#dbe9ff',
  icon text not null default '✨',
  is_default boolean not null default false,
  field_schema jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, name)
);

-- Backfill sensible default field schemas for pre-existing default categories
-- (only fills rows that still have the empty '[]' placeholder, so it never clobbers
-- fields you've already customized from the app).
update public.categories set field_schema =
  '[{"key":"title","label":"Place name","type":"text","required":true},
    {"key":"dish","label":"Dish to try","type":"text","required":true},
    {"key":"address","label":"Address","type":"text","required":false},
    {"key":"price","label":"Price","type":"currency","required":false},
    {"key":"notes","label":"Notes","type":"textarea","required":false}]'::jsonb
where name = 'Food Spots' and field_schema = '[]'::jsonb;

update public.categories set field_schema =
  '[{"key":"title","label":"Item name","type":"text","required":true},
    {"key":"link","label":"Where to buy / link","type":"url","required":false},
    {"key":"price","label":"Price","type":"currency","required":false},
    {"key":"notes","label":"Notes","type":"textarea","required":false}]'::jsonb
where name = 'Things To Buy' and field_schema = '[]'::jsonb;

update public.categories set field_schema =
  '[{"key":"title","label":"Item name","type":"text","required":true},
    {"key":"brand","label":"Brand","type":"text","required":false},
    {"key":"price","label":"Price","type":"currency","required":false},
    {"key":"link","label":"Link","type":"url","required":false},
    {"key":"notes","label":"Notes","type":"textarea","required":false}]'::jsonb
where name = 'Shopping Wishlist' and field_schema = '[]'::jsonb;

update public.categories set field_schema =
  '[{"key":"title","label":"Title","type":"text","required":true},
    {"key":"genre","label":"Genre","type":"text","required":false},
    {"key":"platform","label":"Platform","type":"text","required":false},
    {"key":"notes","label":"Notes","type":"textarea","required":false}]'::jsonb
where name = 'Movies & Series' and field_schema = '[]'::jsonb;

update public.categories set field_schema =
  '[{"key":"title","label":"Name","type":"text","required":true},
    {"key":"location","label":"Location","type":"text","required":false},
    {"key":"best_time","label":"Best time to visit","type":"text","required":false},
    {"key":"notes","label":"Notes","type":"textarea","required":false}]'::jsonb
where name = 'Temples' and field_schema = '[]'::jsonb;

update public.categories set field_schema =
  '[{"key":"title","label":"Title","type":"text","required":true},
    {"key":"link","label":"Source / link","type":"url","required":false},
    {"key":"topic","label":"Topic","type":"text","required":false},
    {"key":"notes","label":"Notes","type":"textarea","required":false}]'::jsonb
where name = 'Education Reels' and field_schema = '[]'::jsonb;

update public.categories set field_schema =
  '[{"key":"title","label":"Name","type":"text","required":true},
    {"key":"location","label":"Location","type":"text","required":false},
    {"key":"best_season","label":"Best season","type":"text","required":false},
    {"key":"notes","label":"Notes","type":"textarea","required":false}]'::jsonb
where name = 'Places To Visit' and field_schema = '[]'::jsonb;

-- Any custom categories you made before this change get a basic name+notes schema:
update public.categories set field_schema =
  '[{"key":"title","label":"Name","type":"text","required":true},
    {"key":"notes","label":"Notes","type":"textarea","required":false}]'::jsonb
where is_default = false and field_schema = '[]'::jsonb;

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  title text not null,
  notes text,
  image_url text,
  source_url text,
  tags text[] not null default '{}',
  status text not null default 'saved' check (status in ('saved', 'done')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  -- Soft-delete: set to a timestamp to move the item into Recently Deleted.
  deleted_at timestamptz
);

create index if not exists idx_categories_user_id on public.categories(user_id);
create index if not exists idx_items_user_id on public.items(user_id);
create index if not exists idx_items_category_id on public.items(category_id);

-- Freeform scratchpad notes, separate from the category/item vault.
-- checklist entries look like {"id": "...", "text": "...", "done": false}.
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  body text not null default '',
  checklist jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  -- Soft-delete: set to a timestamp to move the note into Recently Deleted.
  deleted_at timestamptz
);

create index if not exists idx_notes_user_id on public.notes(user_id);

create index if not exists idx_items_deleted_at
  on public.items (user_id, deleted_at)
  where deleted_at is not null;
create index if not exists idx_notes_deleted_at
  on public.notes (user_id, deleted_at)
  where deleted_at is not null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_items_updated_at on public.items;
create trigger trg_items_updated_at
before update on public.items
for each row
execute function public.set_updated_at();

drop trigger if exists trg_notes_updated_at on public.notes;
create trigger trg_notes_updated_at
before update on public.notes
for each row
execute function public.set_updated_at();

alter table public.categories enable row level security;
alter table public.items enable row level security;
alter table public.notes enable row level security;

drop policy if exists "categories_select_own" on public.categories;
create policy "categories_select_own"
on public.categories for select
using (auth.uid() = user_id);

drop policy if exists "categories_insert_own" on public.categories;
create policy "categories_insert_own"
on public.categories for insert
with check (auth.uid() = user_id);

drop policy if exists "categories_update_own" on public.categories;
create policy "categories_update_own"
on public.categories for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "categories_delete_own" on public.categories;
create policy "categories_delete_own"
on public.categories for delete
using (auth.uid() = user_id);

drop policy if exists "items_select_own" on public.items;
create policy "items_select_own"
on public.items for select
using (auth.uid() = user_id);

drop policy if exists "items_insert_own" on public.items;
create policy "items_insert_own"
on public.items for insert
with check (auth.uid() = user_id);

drop policy if exists "items_update_own" on public.items;
create policy "items_update_own"
on public.items for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "items_delete_own" on public.items;
create policy "items_delete_own"
on public.items for delete
using (auth.uid() = user_id);

drop policy if exists "notes_select_own" on public.notes;
create policy "notes_select_own"
on public.notes for select
using (auth.uid() = user_id);

drop policy if exists "notes_insert_own" on public.notes;
create policy "notes_insert_own"
on public.notes for insert
with check (auth.uid() = user_id);

drop policy if exists "notes_update_own" on public.notes;
create policy "notes_update_own"
on public.notes for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "notes_delete_own" on public.notes;
create policy "notes_delete_own"
on public.notes for delete
using (auth.uid() = user_id);

-- Storage bucket for item photos. Public so <img> tags can load images directly via their
-- public URL without needing signed URLs; write access is still locked down per-user below.
-- file_size_limit/allowed_mime_types enforce server-side what the app's UI already checks
-- client-side, so a direct API call can't upload oversized or non-image files.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vault', 'vault', true, 8388608, array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/heic', 'image/heif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Uploaded objects are keyed as "<user_id>/<filename>" — storage.foldername(name) splits the
-- object path on '/' and [1] is the first segment, i.e. the uploader's own user id.
drop policy if exists "vault_images_select_own" on storage.objects;
create policy "vault_images_select_own"
on storage.objects for select
using (bucket_id = 'vault' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "vault_images_insert_own" on storage.objects;
create policy "vault_images_insert_own"
on storage.objects for insert
with check (bucket_id = 'vault' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "vault_images_delete_own" on storage.objects;
create policy "vault_images_delete_own"
on storage.objects for delete
using (bucket_id = 'vault' and auth.uid()::text = (storage.foldername(name))[1]);

-- PostgREST caches the table schema in memory. Without this, newly added columns
-- (like field_schema) can 404 with "Could not find the column ... in the schema cache"
-- until the API server restarts on its own. This forces an immediate reload.
notify pgrst, 'reload schema';

-- =============================================================================
-- Sharing feature (read-only preview links) — see migrations/ for the full context.
-- Non-guessable, snapshot-based share links for individual items.
-- Anonymous readers retrieve a snapshot ONLY via get_shared_item(token) (keyed by
-- the share token); the table has NO general public SELECT. Write is owner-only.
-- =============================================================================

create table if not exists public.shared_items (
  id             uuid        primary key default gen_random_uuid(),
  token          text        not null unique check (char_length(token) >= 32),
  owner_id       uuid        not null references auth.users(id) on delete cascade,
  -- Snapshot discriminator: 'item' (category/item vault) or 'note' (scratchpad note).
  kind           text        not null default 'item' check (kind in ('item', 'note')),
  title          text        not null check (char_length(trim(title)) > 0),
  category_name  text        not null default 'Vault',
  category_icon  text        not null default '✨',
  category_color text        not null default '#dc5000',
  image_url      text,
  source_url     text,
  -- For item snapshots this is the item's notes; for note snapshots this is the
  -- note's body/content.
  notes          text,
  -- For note snapshots only: [{ id, text, done }] checklist entries.
  checklist      jsonb       not null default '[]'::jsonb,
  fields         jsonb       not null default '[]'::jsonb,
  created_at     timestamptz not null default timezone('utc', now())
);

create index if not exists idx_shared_items_token on public.shared_items (token);
create index if not exists idx_shared_items_owner_id on public.shared_items (owner_id);

alter table public.shared_items enable row level security;

-- Deliberately NO anonymous/public SELECT policy: the shared_items table is not
-- publicly enumerable. Snapshot retrieval is via get_shared_item(token) below.
drop policy if exists "shared_items_select_any" on public.shared_items;

-- Owner-only SELECT: supports createSharedItem's INSERT ... RETURNING (.select('token'))
-- and lets owners read their own records. Anonymous and non-owners cannot SELECT directly.
drop policy if exists "shared_items_select_own" on public.shared_items;
create policy "shared_items_select_own"
  on public.shared_items for select
  using (auth.uid() = owner_id);

drop policy if exists "shared_items_insert_own" on public.shared_items;
create policy "shared_items_insert_own"
  on public.shared_items for insert
  with check (auth.uid() = owner_id);

drop policy if exists "shared_items_delete_own" on public.shared_items;
create policy "shared_items_delete_own"
  on public.shared_items for delete
  using (auth.uid() = owner_id);

-- get_shared_item(token) — security-definer RPC for anonymous preview access.
-- Keyed by the exact share token (returns at most one row) and never exposes owner_id.
-- DROP-then-CREATE (not CREATE OR REPLACE): the return type changed to add kind/checklist,
-- which Postgres only allows by dropping the existing function first.
drop function if exists public.get_shared_item(text);

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

revoke all on function public.get_shared_item(text) from public;
grant execute on function public.get_shared_item(text) to anon, authenticated;

notify pgrst, 'reload schema';
