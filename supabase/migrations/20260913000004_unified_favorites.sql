-- Additive migration: promote favorites to a first-class field on every vault entity.
alter table public.items
  add column if not exists is_favorite boolean not null default false;

alter table public.notes
  add column if not exists is_favorite boolean not null default false;

alter table public.documents
  add column if not exists is_favorite boolean not null default false;

-- Preserve the existing item favorite behavior without touching unrelated metadata.
update public.items
set is_favorite = true
where is_favorite = false
  and coalesce(metadata ->> '__favorite', '') = 'true';

notify pgrst, 'reload schema';