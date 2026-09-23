/**
 * Phase 2 — category/field definition contract.
 *
 * This module is the provider-independent source of truth for how a category's
 * field schema is shaped, validated, keyed, versioned and turned into an AI
 * catalog descriptor. It has NO dependencies on any vision provider (Gemini,
 * OpenAI, Cloudflare, OCR, embeddings, etc.) — those consumers use the catalog
 * descriptors / helper functions exposed here.
 *
 * Contract principles:
 *  - A field's `key` is its immutable storage identity. It is derived from the
 *    initial label ONCE and frozen forever; renaming the label never rewrites it.
 *  - Field deletion is ALWAYS soft (`deleted_at`). Existing item values stored
 *    under a soft-deleted key remain readable and are revealed again on restore.
 *  - Keys are unique per category INCLUDING soft-deleted keys, so reactivating a
 *    field always goes through restore, never through silently reusing a key.
 *  - Every valid category has exactly one active title field (`is_title`) that is
 *    also `required`.
 *  - User-created fields always have `visual_evidence_ok === false`; that flag is
 *    never exposed as an editor control.
 *  - Field type is a closed enum; the legacy `currency` type is normalized to
 *    `number` on read so pre-contract persisted rows stay valid (data-safe).
 *
 * Limits are imported from `src/lib/vision/constants.ts` (single source of truth).
 */

import { MAX_CATEGORIES_PER_USER, MAX_FIELDS_PER_CATEGORY, MAX_LABEL_LENGTH } from '../vision/constants'
import type { ValidationReason } from '../vision/types'
import type { Category, FieldDefinition, FieldType } from '../../types/app'

export const FIELD_TYPES: readonly FieldType[] = [
  'text',
  'textarea',
  'number',
  'date',
  'url',
  'boolean',
  'select',
] as const

/** Pre-contract field types that existed in older schemas; normalized to a closed-enum type on read. */
export const LEGACY_FIELD_TYPES = ['currency'] as const

export const TITLE_FIELD_KEY = 'title'
export const NOTES_FIELD_KEY = 'notes'

export const INITIAL_CATEGORY_SCHEMA_VERSION = 1

export const FIELD_KEY_PATTERN = /^[a-z][a-z0-9_]{0,39}$/
export const MAX_FIELD_KEY_LENGTH = 40

export const MALFORMED_CATEGORY_REASON: Extract<ValidationReason, 'malformed_category'> = 'malformed_category'

/** Normalized, provider-independent view of a single ACTIVE field in the AI catalog. */
export interface CategoryCatalogField {
  key: string
  label: string
  type: FieldType
  required: boolean
  is_title: boolean
  /** Present only for `select` fields. */
  options?: string[]
  visual_evidence_ok: boolean
}

/** Provider-independent, downstream-safe description of one category for AI classification/extraction. */
export interface AiCategoryDescriptor {
  category_id: string
  name: string
  description: string
  is_default: boolean
  category_schema_version: number
  fields: CategoryCatalogField[]
}

export interface CatalogWarning {
  category_id: string
  reason: 'malformed_category'
  message: string
}

export interface CatalogBuildResult {
  catalog: AiCategoryDescriptor[]
  warnings: CatalogWarning[]
}

// ---------------------------------------------------------------------------
// Field keys
// ---------------------------------------------------------------------------

/**
 * Phase 2 re-exports the shared vision constants as a single public surface so
 * downstream modules import limits from one place without touching the vision modules.
 */
export { MAX_CATEGORIES_PER_USER, MAX_FIELDS_PER_CATEGORY, MAX_LABEL_LENGTH } from '../vision/constants'

/** True when the value is a valid storage key matching `^[a-z][a-z0-9_]{0,39}$`. */
export function isValidFieldKey(key: unknown): key is string {
  return typeof key === 'string' && FIELD_KEY_PATTERN.test(key)
}

/**
 * Convert a human label into a valid, deterministic field key.
 *
 * - lowercases and slugs punctuation/spaces into snake_case
 * - handles labels that start with a digit (prepends `field_`)
 * - respects the 40-character maximum
 * - never silently reuses an existing key (checked against ALL existing keys,
 *   including soft-deleted ones): collisions get a deterministic `_<n>` suffix,
 *   starting at `_2` to match the repository's existing collision convention.
 */
export function slugifyToKey(label: string, existingKeys: readonly string[] = []): string {
  const base = slugBase(label)
  return base ? uniqueKey(base, existingKeys) : uniqueKey('field', existingKeys)
}

function slugBase(label: string): string {
  const slug = String(label ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
  if (slug.length === 0) {
    return ''
  }
  const prefixed = /^[0-9]/.test(slug) ? `field_${slug}` : slug
  if (prefixed.length > MAX_FIELD_KEY_LENGTH) {
    return prefixed.slice(0, MAX_FIELD_KEY_LENGTH).replace(/_+$/g, '')
  }
  return prefixed
}

function uniqueKey(base: string, existingKeys: readonly string[]): string {
  const used = new Set(existingKeys)
  if (!used.has(base)) {
    return base
  }
  let suffix = 2
  while (true) {
    const suffixText = String(suffix)
    const prefix = base.slice(0, Math.max(0, MAX_FIELD_KEY_LENGTH - suffixText.length - 1))
    const candidate = `${prefix}_${suffixText}`
    if (!used.has(candidate)) {
      return candidate
    }
    suffix += 1
  }
}

// ---------------------------------------------------------------------------
// Field types
// ---------------------------------------------------------------------------

export function isFieldType(type: unknown): type is FieldType {
  return typeof type === 'string' && (FIELD_TYPES as readonly string[]).includes(type)
}

export function isLegacyFieldType(type: unknown): boolean {
  return typeof type === 'string' && (LEGACY_FIELD_TYPES as readonly string[]).includes(type)
}

/** Maps an unknown persisted type to the closed-enum type, normalizing legacy `currency` → `number`. */
export function normalizeFieldType(type: unknown): FieldType | null {
  if (isFieldType(type)) {
    return type
  }
  if (type === 'currency') {
    return 'number'
  }
  return null
}

// ---------------------------------------------------------------------------
// Field contract validation (create / edit time — user-facing)
// ---------------------------------------------------------------------------

function selectOptionsError(options: unknown): string | null {
  if (!Array.isArray(options)) {
    return 'A select field needs at least one option.'
  }
  if (options.length === 0) {
    return 'A select field needs at least one option.'
  }
  if (options.some((option) => typeof option !== 'string' || option.trim().length === 0)) {
    return 'Select options must be non-empty text values.'
  }
  return null
}

function validateSelectOptions(options: unknown): boolean {
  return selectOptionsError(options) === null
}

/**
 * Validates a single field definition. Returns a list of human-readable problems
 * (empty means valid). `visual_evidence_ok === true` is always rejected — users
 * cannot enable visual evidence on their own fields.
 */
export function validateFieldDefinition(field: FieldDefinition): string[] {
  const errors: string[] = []
  if (!isValidFieldKey(field.key)) {
    errors.push(`Field key "${field.key}" is invalid (must be lowercase a-z, digits and underscores, 40 chars max).`)
  }
  if (typeof field.label !== 'string' || field.label.trim().length === 0) {
    errors.push(`Field "${field.key}" needs a label.`)
  } else if (field.label.trim().length > MAX_LABEL_LENGTH) {
    errors.push(`Field "${field.key}" label is too long (max ${MAX_LABEL_LENGTH} characters).`)
  }
  if (!isFieldType(field.type)) {
    errors.push(`Field "${field.key}" has an invalid type "${String(field.type)}".`)
  }
  if (field.type === 'select') {
    const optionsProblem = selectOptionsError(field.options)
    if (optionsProblem) {
      errors.push(`Field "${field.key}": ${optionsProblem}`)
    }
  }
  if (field.visual_evidence_ok === true) {
    errors.push(`Field "${field.key}": visual_evidence_ok is not enabled for user-created fields.`)
  }
  if (field.is_title === true && field.required !== true) {
    errors.push(`Field "${field.key}" is the title field and must be required.`)
  }
  return errors
}

// ---------------------------------------------------------------------------
// Category contract validation (create / edit time)
// ---------------------------------------------------------------------------

export interface CategoryDefinitionInput {
  name: string
  description: string
  fields: FieldDefinition[]
}

export interface CategoryValidationOptions {
  /** Current number of categories the user owns; used to enforce the per-user create limit. */
  categoryCount?: number
}

/**
 * Validates a category definition the user is about to create/save. Returns a list
 * of human-readable problems (empty means valid). Enforcement points: description,
 * field count limits, key uniqueness (including soft-deleted keys), the single
 * required title field, closed field types, valid select options, label length,
 * and the per-user category limit.
 */
export function validateCategoryDefinition(
  input: CategoryDefinitionInput,
  options: CategoryValidationOptions = {},
): string[] {
  const errors: string[] = []
  const description = typeof input.description === 'string' ? input.description.trim() : ''
  if (!description) {
    errors.push('Add a one-line description for the category.')
  } else if (/[\r\n]/.test(description)) {
    errors.push('The category description must be a single line.')
  }

  const fields = Array.isArray(input.fields) ? input.fields : []
  const active = activeFields(fields)

  if (active.length === 0) {
    errors.push('A category needs at least one field.')
  }
  if (active.length > MAX_FIELDS_PER_CATEGORY) {
    errors.push(`A category can have at most ${MAX_FIELDS_PER_CATEGORY} fields.`)
  }

  const seenKeys = new Set<string>()
  const titleFields: FieldDefinition[] = []
  for (const field of fields) {
    const key = field.key
    if (seenKeys.has(key)) {
      errors.push(`Duplicate field key "${key}" — keys must be unique, including soft-deleted fields.`)
    }
    seenKeys.add(key)

    if (isFieldSoftDeleted(field)) {
      // Deleted fields keep only their immutable key in the uniqueness set; the rest
      // of the contract applies to active fields.
      continue
    }
    errors.push(...validateFieldDefinition(field))
    if (isTitleField(field)) {
      titleFields.push(field)
    }
  }

  if (titleFields.length === 0) {
    errors.push('A category needs exactly one title field.')
  } else if (titleFields.length > 1) {
    errors.push('A category can have only one title field.')
  }

  if (typeof options.categoryCount === 'number' && options.categoryCount >= MAX_CATEGORIES_PER_USER) {
    errors.push(`You can create at most ${MAX_CATEGORIES_PER_USER} categories.`)
  }

  return errors
}

// ---------------------------------------------------------------------------
// Field lifecycle helpers (used by the editor and persistence layer)
// ---------------------------------------------------------------------------

export function isFieldSoftDeleted(field: FieldDefinition): boolean {
  return field.deleted_at != null
}

export function activeFields(fields: readonly FieldDefinition[]): FieldDefinition[] {
  return fields.filter((field) => !isFieldSoftDeleted(field))
}

/** True for the category's title field: explicit `is_title`, or legacy `key === 'title'`. */
export function isTitleField(field: FieldDefinition): boolean {
  return field.is_title === true || field.key === TITLE_FIELD_KEY
}

/**
 * Creates a new user field definition. The key is generated from the initial label
 * and frozen forever; `visual_evidence_ok` is always false; `is_title` is only set
 * for the reserved title field.
 */
export function makeFieldDefinition(input: {
  label: string
  existingKeys: readonly string[]
  asTitle?: boolean
}): FieldDefinition {
  const isTitle = input.asTitle === true
  return {
    key: isTitle ? TITLE_FIELD_KEY : slugifyToKey(input.label, input.existingKeys),
    label: input.label,
    type: 'text',
    required: isTitle,
    ...(isTitle ? { is_title: true } : {}),
    visual_evidence_ok: false,
    created_at: new Date().toISOString(),
  }
}

/** Renames a field's human label WITHOUT touching its immutable storage key. */
export function renameFieldLabel(field: FieldDefinition, label: string): FieldDefinition {
  return { ...field, label: label.trim() }
}

/** Soft-deletes a field by stamping `deleted_at`; item values under its key are preserved. */
export function softDeleteField(field: FieldDefinition): FieldDefinition {
  return { ...field, deleted_at: new Date().toISOString() }
}

/** Restores a soft-deleted field, making its previously stored item values readable again. */
export function restoreField(field: FieldDefinition): FieldDefinition {
  const { deleted_at: _removed, ...rest } = field
  void _removed
  return { ...rest, deleted_at: null, is_title: isTitleField(rest) }
}

/** Normalizes a field for persistence: defaults/stamps contract properties. */
export function normalizeFieldForSave(field: FieldDefinition): FieldDefinition {
  const isTitle = isTitleField(field)
  return {
    ...field,
    label: field.label.trim() || 'Untitled field',
    required: isTitle ? true : field.required === true,
    is_title: isTitle,
    visual_evidence_ok: field.visual_evidence_ok === true,
    deleted_at: field.deleted_at ?? null,
    created_at: field.created_at ?? new Date().toISOString(),
  }
}

/** Normalizes a whole schema for persistence (fn(A) preserving order/keys). */
export function normalizeSchemaForSave(fields: readonly FieldDefinition[]): FieldDefinition[] {
  return fields.map(normalizeFieldForSave)
}

// ---------------------------------------------------------------------------
// Schema versioning
// ---------------------------------------------------------------------------

export function normalizeCategorySchemaVersion(value: unknown): number {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : INITIAL_CATEGORY_SCHEMA_VERSION
}

/** Every category edit must bump the schema version by one. */
export function nextCategorySchemaVersion(value: unknown): number {
  return normalizeCategorySchemaVersion(value) + 1
}

// ---------------------------------------------------------------------------
// AI catalog (provider-independent)
// ---------------------------------------------------------------------------

function coerceBoolean(value: unknown): boolean {
  return value === true || value === 'true'
}

function isDeletedMarker(value: unknown): boolean {
  return value != null && value !== false
}

function categoryNameOf(category: Category): string {
  return typeof category.name === 'string' ? category.name.trim() : ''
}

/**
 * Builds the provider-independent AI descriptor for one category, or `null` when the
 * persisted row is malformed. Malformed rows are never thrown on — callers use
 * `sanitizeCatalog` to collect warnings. A missing category description falls back
 * to the category name so pre-backfill rows stay consumable.
 */
export function toAiCategoryDescriptor(category: Category): AiCategoryDescriptor | null {
  if (!category || typeof category !== 'object') {
    return null
  }
  const name = categoryNameOf(category)
  if (!name) {
    return null
  }
  if (!Array.isArray(category.field_schema)) {
    return null
  }

  const fields: CategoryCatalogField[] = []
  let titleCount = 0
  let titleRequired = false

  for (const raw of category.field_schema) {
    if (!raw || typeof raw !== 'object') {
      return null
    }
    const field = raw as Record<string, unknown>
    const key = field.key
    if (!isValidFieldKey(key)) {
      return null
    }
    const type = normalizeFieldType(field.type)
    if (!type) {
      return null
    }
    const label = typeof field.label === 'string' ? field.label.trim() : ''
    if (!label || label.length > MAX_LABEL_LENGTH) {
      return null
    }
    if (type === 'select' && !validateSelectOptions(field.options)) {
      return null
    }

    const required = coerceBoolean(field.required)
    const deleted = isDeletedMarker(field.deleted_at)
    const isTitle = field.is_title === true || (key === TITLE_FIELD_KEY && required)

    if (isTitle && !deleted) {
      titleCount += 1
      if (required) {
        titleRequired = true
      }
    }
    if (deleted) {
      continue
    }

    fields.push({
      key,
      label,
      type,
      required,
      is_title: isTitle,
      ...(type === 'select' ? { options: (field.options as string[]).map((option) => option.trim()) } : {}),
      visual_evidence_ok: field.visual_evidence_ok === true,
    })
  }

  if (fields.length === 0) {
    return null
  }
  if (titleCount !== 1 || !titleRequired) {
    return null
  }

  const description =
    typeof category.description === 'string' && category.description.trim()
      ? category.description.trim()
      : name

  return {
    category_id: String(category.id ?? ''),
    name,
    description,
    is_default: category.is_default === true,
    category_schema_version: normalizeCategorySchemaVersion(category.category_schema_version),
    fields,
  }
}

/**
 * Active categories/fields only, excluding soft-deleted fields and malformed
 * categories without ever crashing. `sanitizeCatalog` wraps warnings around it.
 */
export function buildCategoryCatalog(categories: readonly Category[]): AiCategoryDescriptor[] {
  return sanitizeCatalog(categories).catalog
}

/**
 * Resilient read path for persisted category rows. Malformed categories are skipped
 * (never thrown) and reported with the Phase 1 `malformed_category` reason while
 * valid categories in the same input continue to produce descriptors.
 */
export function sanitizeCatalog(categories: readonly Category[]): CatalogBuildResult {
  const catalog: AiCategoryDescriptor[] = []
  const warnings: CatalogWarning[] = []
  const source = Array.isArray(categories) ? categories : []
  for (const entry of source) {
    const categoryId = String(entry?.id ?? '')
    const categoryName =
      entry && typeof entry === 'object' && typeof (entry as Category).name === 'string'
        ? (entry as Category).name
        : ''
    try {
      const descriptor = toAiCategoryDescriptor(entry)
      if (descriptor) {
        catalog.push(descriptor)
      } else {
        warnings.push({
          category_id: categoryId,
          reason: MALFORMED_CATEGORY_REASON,
          message: `Category "${categoryName}" has an invalid field schema and was skipped.`,
        })
      }
    } catch {
      warnings.push({
        category_id: categoryId,
        reason: MALFORMED_CATEGORY_REASON,
        message: `Category "${categoryName}" could not be parsed and was skipped.`,
      })
    }
  }
  return { catalog, warnings }
}

/** Active, allowed field keys for a category (soft-deleted fields are never returned). */
export function allowedFieldKeys(catalog: readonly AiCategoryDescriptor[], categoryId: string): string[] {
  const category = catalog.find((entry) => entry.category_id === categoryId)
  return category ? category.fields.map((field) => field.key) : []
}

/** Returns the active matching field definition, or undefined when absent/soft-deleted. */
export function getFieldDefinition(
  catalog: readonly AiCategoryDescriptor[],
  categoryId: string,
  key: string,
): CategoryCatalogField | undefined {
  const category = catalog.find((entry) => entry.category_id === categoryId)
  return category?.fields.find((field) => field.key === key)
}

/** Returns the active title field key for a valid category (or null). */
export function titleFieldKey(catalog: readonly AiCategoryDescriptor[], categoryId: string): string | null {
  const category = catalog.find((entry) => entry.category_id === categoryId)
  if (!category) {
    return null
  }
  return category.fields.find((field) => field.is_title)?.key ?? null
}