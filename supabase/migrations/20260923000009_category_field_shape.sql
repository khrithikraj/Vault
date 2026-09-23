-- Migration: Phase 2 category/field schema contract.
--
-- Adds the category description + schema version columns and rewrites every
-- existing field_schema JSON so persisted rows match the closed contract:
--   * legacy `currency` type          -> `number`
--   * `is_title` derived on the title key
--   * `visual_evidence_ok` defaults to false (never owner-editable)
--   * `created_at` defaults to the category's own created_at when absent
--   * exactly one active required `title` field is guaranteed (prepended when missing)
-- Soft-deleted fields (`deleted_at` set) are preserved untouched.
-- Data-safe: no destructive writes, no data loss.

alter table public.categories
  add column if not exists description text,
  add column if not exists category_schema_version integer not null default 1;

-- Helper: normalizes one category's field_schema array (used only during this
-- migration, dropped at the end).
create or replace function public._vault_phase2_normalize_field_schema(
  field_schema jsonb,
  category_created_at timestamptz
)
returns jsonb
language plpgsql
strict
as $$
declare
  normalized jsonb;
  has_title boolean;
  iso_created text;
begin
  if field_schema is null then
    field_schema := '[]'::jsonb;
  end if;

  iso_created := to_char(category_created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');

  select count(*) > 0 into has_title
  from jsonb_array_elements(field_schema) as f
  where (f->>'key') = 'title'
    and f->>'deleted_at' is null;

  normalized := (
    select jsonb_agg(
      jsonb_build_object(
        'key', f->>'key',
        'label', coalesce(nullif(f->>'label', ''), f->>'key', 'Untitled field'),
        'type', case
          when f->>'type' = 'currency' then 'number'
          else coalesce(f->>'type', 'text')
        end,
        'required', case
          when (f->>'key') = 'title' then true
          else coalesce((f->>'required') = 'true', false)
        end,
        'placeholder', f->'placeholder',
        'is_title', (f->>'key') = 'title',
        'options', case
          when f->>'options' is not null then coalesce(f->'options', '[]'::jsonb)
          else null
        end,
        'visual_evidence_ok', coalesce((f->>'visual_evidence_ok') = 'true', false),
        'created_at', coalesce(f->>'created_at', iso_created),
        'deleted_at', f->'deleted_at'
      )
    )
    from jsonb_array_elements(field_schema) as f
  );

  if not has_title then
    normalized := jsonb_build_array(
      jsonb_build_object(
        'key', 'title',
        'label', 'Name',
        'type', 'text',
        'required', true,
        'is_title', true,
        'visual_evidence_ok', false,
        'created_at', iso_created
      )
    ) || coalesce(normalized, '[]'::jsonb);
  end if;

  return normalized;
end;
$$;

update public.categories
set
  description = coalesce(nullif(btrim(description), ''), name),
  category_schema_version = 1,
  field_schema = public._vault_phase2_normalize_field_schema(field_schema, created_at)
where true;

drop function public._vault_phase2_normalize_field_schema(field_schema jsonb, category_created_at timestamptz);

notify pgrst, 'reload schema';