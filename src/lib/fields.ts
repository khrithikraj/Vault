import { defaultCategorySeeds } from './defaults'
import {
  normalizeCategorySchemaVersion,
  normalizeFieldType,
  normalizeSchemaForSave,
} from './vault/categorySchema'
import type { Category, FieldDefinition, FieldType } from '../types/app'
 
export const FIELD_TYPE_OPTIONS: Array<{ value: FieldType; label: string }> = [
  { value: 'text', label: 'Short text' },
  { value: 'textarea', label: 'Long text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'url', label: 'Link' },
  { value: 'boolean', label: 'Yes / No' },
  { value: 'select', label: 'Dropdown' },
]
 
/** Fallback schema for brand-new custom categories. */
export const fallbackFieldSchema: FieldDefinition[] = [
  { key: 'title', label: 'Name', type: 'text', required: true },
  { key: 'notes', label: 'Notes', type: 'textarea', required: false },
]
 
/**
 * Guarantees a usable, contract-shaped field_schema even if the DB row's column is
 * missing/null/empty (e.g. before the field_schema migration has been run) so the UI
 * never crashes on `category.field_schema.find(...)`. Falls back to the known default
 * schema by name, then to the generic title+notes schema. Also normalizes every field
 * to the closed enum (legacy `currency` → `number`) and fills contract defaults so
 * pre-migration rows behave correctly without any schema-cache reload.
 */
export function normalizeCategory(category: Category): Category {
  const source =
    category.field_schema && category.field_schema.length > 0
      ? category.field_schema
      : defaultCategorySeeds.find((entry) => entry.name === category.name)?.field_schema ?? fallbackFieldSchema
  return {
    ...category,
    description:
      typeof category.description === 'string' && category.description.trim()
        ? category.description.trim()
        : category.name,
    category_schema_version: normalizeCategorySchemaVersion(category.category_schema_version),
    field_schema: normalizeSchemaForSave(
      source.map((field) => ({ ...field, type: normalizeFieldType(field.type) ?? field.type })),
    ),
  }
}
 
/** Supabase/PostgREST errors are plain objects, not real `Error` instances — this
 * unwraps a usable message from either shape instead of silently falling back. */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  return 'Something went wrong.'
}
 
/** Surfaces a hint to re-run the SQL migration when Supabase complains about a missing column. */
export function describeSupabaseError(error: { message: string }) {
  if (/schema cache/i.test(error.message)) {
    return `${error.message} — Your database is missing a recent column and PostgREST hasn't refreshed yet. In Supabase: run the latest supabase/schema.sql in the SQL editor (it now ends with "notify pgrst, 'reload schema';"), or open Project Settings → API and click "Reload schema", then refresh this page.`
  }
  if (/column/i.test(error.message)) {
    return `${error.message} — Please re-run the latest supabase/schema.sql in your Supabase SQL editor, then refresh this page.`
  }
  return error.message
}
 
export function makeFieldKey(label: string, existing: FieldDefinition[]) {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'field'
 
  let key = base
  let suffix = 1
  while (existing.some((field) => field.key === key)) {
    suffix += 1
    key = `${base}_${suffix}`
  }
  return key
}
 
 