-- =============================================================================
-- Migration: Documents feature
-- Created: 2026-08-28
-- Purpose: Secure personal document storage (Aadhaar, PAN, passports, etc.)
--          Uses a separate private bucket `vault-documents` — the existing
--          public `vault` bucket is NOT touched by this migration.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

create table if not exists public.documents (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  -- Application-level enum — no separate lookup table needed for V1.
  category     text        not null
                           check (category in (
                             'Identity', 'Vehicle', 'Finance',
                             'Education', 'Medical', 'Travel', 'Other'
                           )),
  name         text        not null check (char_length(trim(name)) > 0),
  mime_type    text        not null
                           check (mime_type in (
                             'application/pdf',
                             'image/jpeg',
                             'image/png',
                             'image/webp'
                           )),
  -- Stored in bytes; 25 MB upper limit enforced in Storage policy and app.
  file_size    bigint      not null check (file_size > 0 and file_size <= 26214400),
  -- Path inside the vault-documents bucket: <user_id>/<document_id>/<filename>
  -- Never expose this in public URLs — always use signed URLs.
  storage_path text        not null check (char_length(storage_path) > 0),
  created_at   timestamptz not null default timezone('utc', now())
);

-- Efficient per-user listing (most-recent first)
create index if not exists idx_documents_user_id_created_at
  on public.documents (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security — database layer
-- All policies use auth.uid() from the authenticated session; the frontend
-- must NEVER pass user_id in the request body — the DB derives it server-side.
-- ---------------------------------------------------------------------------

alter table public.documents enable row level security;

drop policy if exists "documents_select_own" on public.documents;
create policy "documents_select_own"
  on public.documents for select
  using (auth.uid() = user_id);

drop policy if exists "documents_insert_own" on public.documents;
create policy "documents_insert_own"
  on public.documents for insert
  with check (auth.uid() = user_id);

drop policy if exists "documents_update_own" on public.documents;
create policy "documents_update_own"
  on public.documents for update
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "documents_delete_own" on public.documents;
create policy "documents_delete_own"
  on public.documents for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Storage bucket & policies for `vault-documents` (PRIVATE)
--
-- Idempotent bucket configuration: configures public = false (PRIVATE), 25 MB limit,
-- and allowed MIME types. Safe whether the bucket already exists or not.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vault-documents',
  'vault-documents',
  false,
  26214400,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Object path structure: <user_id>/<document_id>/<sanitized_filename>
-- storage.foldername(name) splits the path on '/' and returns an array;
-- index [1] is the first segment which is always the owner's user_id.
-- This makes ownership verification path-based and manipulation-resistant.
-- ---------------------------------------------------------------------------

-- SELECT (read / download): only the owning user
drop policy if exists "vault_documents_select_own" on storage.objects;
create policy "vault_documents_select_own"
  on storage.objects for select
  using (
    bucket_id = 'vault-documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- INSERT (upload): only into own folder
drop policy if exists "vault_documents_insert_own" on storage.objects;
create policy "vault_documents_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'vault-documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- UPDATE (replace / upsert): only own objects
drop policy if exists "vault_documents_update_own" on storage.objects;
create policy "vault_documents_update_own"
  on storage.objects for update
  using (
    bucket_id = 'vault-documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'vault-documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- DELETE: only own objects
drop policy if exists "vault_documents_delete_own" on storage.objects;
create policy "vault_documents_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'vault-documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Reload PostgREST schema cache so the new table is immediately visible.
notify pgrst, 'reload schema';
