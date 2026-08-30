-- =============================================================================
-- Migration: Trash / Recently Deleted
-- Created: 2026-08-29
-- Purpose: Soft-delete for Items, Notes and Documents.
--          Adds a nullable `deleted_at` timestamp. Rows with a value are "in the
--          trash": hidden from normal lists, restorable (set back to NULL), and
--          only freed on permanent purge. RLS already scopes every table per
--          user, so no policy changes are needed.
--
--          Storage note: purging a DOCUMENT removes its row here AND its object
--          in the private `vault-documents` bucket (handled in app code, storage
--          first so an orphaned file is never left behind).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Items
-- ---------------------------------------------------------------------------
alter table public.items add column if not exists deleted_at timestamptz;

create index if not exists idx_items_deleted_at
  on public.items (user_id, deleted_at)
  where deleted_at is not null;

-- ---------------------------------------------------------------------------
-- Notes
-- ---------------------------------------------------------------------------
alter table public.notes add column if not exists deleted_at timestamptz;

create index if not exists idx_notes_deleted_at
  on public.notes (user_id, deleted_at)
  where deleted_at is not null;

-- ---------------------------------------------------------------------------
-- Documents
-- ---------------------------------------------------------------------------
alter table public.documents add column if not exists deleted_at timestamptz;

create index if not exists idx_documents_deleted_at
  on public.documents (user_id, deleted_at)
  where deleted_at is not null;

-- Reload PostgREST schema cache so the new columns are immediately visible.
notify pgrst, 'reload schema';