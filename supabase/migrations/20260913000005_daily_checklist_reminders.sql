-- Additive daily checklist reminder model. Normal checklist JSON remains unchanged.
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  note_id uuid not null references public.notes(id) on delete cascade,
  checklist_item_id text not null,
  enabled boolean not null default true,
  recurrence text not null default 'daily' check (recurrence = 'daily'),
  local_time time not null,
  timezone text not null default 'UTC',
  next_fire_at timestamptz,
  last_fired_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (note_id, checklist_item_id)
);

create table if not exists public.daily_checklist_completions (
  reminder_id uuid not null references public.reminders(id) on delete cascade,
  local_date date not null,
  completed_at timestamptz not null default timezone('utc', now()),
  primary key (reminder_id, local_date)
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now()),
  revoked_at timestamptz,
  unique (user_id, endpoint)
);

create index if not exists idx_reminders_due on public.reminders (next_fire_at) where enabled = true;
create index if not exists idx_reminders_user_id on public.reminders (user_id);
create index if not exists idx_completions_date on public.daily_checklist_completions (local_date);
create index if not exists idx_push_subscriptions_user_id on public.push_subscriptions (user_id);

alter table public.reminders enable row level security;
alter table public.daily_checklist_completions enable row level security;
alter table public.push_subscriptions enable row level security;

drop policy if exists "reminders_owner_all" on public.reminders;
create policy "reminders_owner_all" on public.reminders for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "completions_owner_all" on public.daily_checklist_completions;
create policy "completions_owner_all" on public.daily_checklist_completions for all
  using (exists (select 1 from public.reminders r where r.id = reminder_id and r.user_id = auth.uid()))
  with check (exists (select 1 from public.reminders r where r.id = reminder_id and r.user_id = auth.uid()));
drop policy if exists "push_subscriptions_owner_all" on public.push_subscriptions;
create policy "push_subscriptions_owner_all" on public.push_subscriptions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Idempotent helper used by the updated_at trigger below (mirrors the definition in
-- supabase/schema.sql so that a standalone migration-only apply never fails).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_reminders_updated_at on public.reminders;
create trigger trg_reminders_updated_at before update on public.reminders for each row execute function public.set_updated_at();

notify pgrst, 'reload schema';