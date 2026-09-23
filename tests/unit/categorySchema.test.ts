import { describe, expect, it } from 'vitest'
import {
  activeFields,
  allowedFieldKeys,
  buildCategoryCatalog,
  getFieldDefinition,
  INITIAL_CATEGORY_SCHEMA_VERSION,
  isFieldSoftDeleted,
  isValidFieldKey,
  makeFieldDefinition,
  nextCategorySchemaVersion,
  normalizeFieldForSave,
  normalizeFieldType,
  restoreField,
  sanitizeCatalog,
  slugifyToKey,
  softDeleteField,
  titleFieldKey,
  toAiCategoryDescriptor,
  validateCategoryDefinition,
  validateFieldDefinition,
} from '../../src/lib/vault/categorySchema'
import { MAX_CATEGORIES_PER_USER, MAX_FIELDS_PER_CATEGORY, MAX_LABEL_LENGTH } from '../../src/lib/vision/constants'
import type { Category, FieldDefinition, FieldType } from '../../src/types/app'

function makeField(overrides: Partial<FieldDefinition> = {}): FieldDefinition {
  return {
    key: 'field',
    label: 'Field',
    type: 'text',
    required: false,
    visual_evidence_ok: false,
    ...overrides,
  }
}

function makeTitleField(): FieldDefinition {
  return makeField({ key: 'title', label: 'Title', required: true, is_title: true })
}

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: 'cat-1',
    user_id: 'user-1',
    name: 'Food Spots',
    description: 'Places to eat.',
    color: '#ffd9c3',
    icon: '🍜',
    is_default: false,
    category_schema_version: 1,
    field_schema: [makeTitleField()],
    created_at: '2026-09-23T00:00:00.000Z',
    ...overrides,
  }
}

describe('slugifyToKey', () => {
  it('slugs spaces and punctuation into snake_case', () => {
    expect(slugifyToKey('Price Paid')).toBe('price_paid')
    expect(slugifyToKey('Dish to try!')).toBe('dish_to_try')
  })

  it('normalizes diacritics and drops symbols', () => {
    expect(slugifyToKey('Café Menu')).toBe('cafe_menu')
    expect(slugifyToKey('What???')).toBe('what')
  })

  it('prefixes field_ for labels starting with a digit', () => {
    expect(slugifyToKey('2nd visit date')).toBe('field_2nd_visit_date')
  })

  it('falls back to field for empty/blank labels', () => {
    expect(slugifyToKey('')).toBe('field')
    expect(slugifyToKey('   ')).toBe('field')
  })

  it('caps keys at 40 characters', () => {
    const key = slugifyToKey('a'.repeat(80))
    expect(key.length).toBeLessThanOrEqual(40)
  })

  it('never reuses an existing key including soft-deleted ones', () => {
    expect(slugifyToKey('Price', ['price', 'price_2'])).toBe('price_3')
    expect(slugifyToKey('Price', ['price'])).toBe('price_2')
  })
})

describe('isValidFieldKey', () => {
  it('accepts lowercase snake-case keys', () => {
    expect(isValidFieldKey('title')).toBe(true)
    expect(isValidFieldKey('field_2nd_visit_date')).toBe(true)
  })

  it('rejects invalid shapes', () => {
    expect(isValidFieldKey('')).toBe(false)
    expect(isValidFieldKey('Price')).toBe(false)
    expect(isValidFieldKey('123')).toBe(false)
    expect(isValidFieldKey('a'.repeat(41))).toBe(false)
    expect(isValidFieldKey(null)).toBe(false)
  })
})

describe('normalizeFieldType', () => {
  it('passes through the closed enum', () => {
    const types: FieldType[] = ['text', 'textarea', 'number', 'date', 'url', 'boolean', 'select']
    for (const type of types) {
      expect(normalizeFieldType(type)).toBe(type)
    }
  })

  it('normalizes legacy currency to number', () => {
    expect(normalizeFieldType('currency')).toBe('number')
  })

  it('returns null for unknown types', () => {
    expect(normalizeFieldType('money')).toBeNull()
    expect(normalizeFieldType(undefined)).toBeNull()
    expect(normalizeFieldType(3)).toBeNull()
  })
})

describe('validateFieldDefinition', () => {
  it('accepts a valid text field', () => {
    expect(validateFieldDefinition(makeField())).toEqual([])
  })

  it('rejects visual_evidence_ok on user fields', () => {
    const errors = validateFieldDefinition(makeField({ visual_evidence_ok: true }))
    expect(errors.some((error) => /visual_evidence_ok/i.test(error))).toBe(true)
  })

  it('rejects a select field without non-empty options', () => {
    expect(validateFieldDefinition(makeField({ type: 'select', options: [] })).length).toBeGreaterThan(0)
    expect(validateFieldDefinition(makeField({ type: 'select', options: ['', ' '] })).length).toBeGreaterThan(0)
    expect(validateFieldDefinition(makeField({ type: 'select', options: ['Small'] }))).toEqual([])
  })

  it('rejects labels longer than the limit', () => {
    const errors = validateFieldDefinition(makeField({ label: 'x'.repeat(MAX_LABEL_LENGTH + 1) }))
    expect(errors.some((error) => /too long/i.test(error))).toBe(true)
  })

  it('rejects an un-required title field', () => {
    const errors = validateFieldDefinition(makeField({ key: 'title', is_title: true, required: false }))
    expect(errors.some((error) => /must be required/i.test(error))).toBe(true)
  })
})

describe('validateCategoryDefinition', () => {
  it('accepts a valid definition', () => {
    expect(
      validateCategoryDefinition({
        name: 'Food Spots',
        description: 'Where to eat.',
        fields: [makeTitleField(), makeField({ key: 'dish', label: 'Dish' })],
      }),
    ).toEqual([])
  })

  it('requires a description', () => {
    const errors = validateCategoryDefinition({
      name: 'Food Spots',
      description: '',
      fields: [makeTitleField()],
    })
    expect(errors.some((error) => /description/i.test(error))).toBe(true)
  })

  it('requires a single-line description', () => {
    const errors = validateCategoryDefinition({
      name: 'Food Spots',
      description: 'line one\nline two',
      fields: [makeTitleField()],
    })
    expect(errors.some((error) => /single line/i.test(error))).toBe(true)
  })

  it('rejects zero active fields', () => {
    const errors = validateCategoryDefinition({
      name: 'Food Spots',
      description: 'x',
      fields: [],
    })
    expect(errors.some((error) => /at least one field/i.test(error))).toBe(true)
  })

  it('rejects more than the field limit', () => {
    const fields: FieldDefinition[] = [makeTitleField()]
    for (let i = 0; i < MAX_FIELDS_PER_CATEGORY; i++) {
      fields.push(makeField({ key: `field_${i}`, label: `Field ${i}` }))
    }
    const errors = validateCategoryDefinition({ name: 'x', description: 'x', fields })
    expect(errors.some((error) => /at most/.test(error))).toBe(true)
  })

  it('enforces key uniqueness including soft-deleted fields', () => {
    const fields = [
      makeTitleField(),
      makeField({ key: 'dish', label: 'Dish' }),
      makeField({ key: 'dish', label: 'Dish again', deleted_at: '2026-09-23T00:00:00.000Z' }),
    ]
    const errors = validateCategoryDefinition({ name: 'x', description: 'x', fields })
    expect(errors.some((error) => /duplicate/i.test(error))).toBe(true)
  })

  it('rejects zero or multiple title fields', () => {
    const none = validateCategoryDefinition({
      name: 'x',
      description: 'x',
      fields: [makeField({ key: 'dish', label: 'Dish' })],
    })
    expect(none.some((error) => /exactly one title/i.test(error))).toBe(true)

    const two = validateCategoryDefinition({
      name: 'x',
      description: 'x',
      fields: [
        makeTitleField(),
        makeField({ key: 'title2', label: 'Also title', required: true, is_title: true }),
      ],
    })
    expect(two.some((error) => /only one title/i.test(error))).toBe(true)
  })

  it('enforces the per-user category limit', () => {
    const errors = validateCategoryDefinition(
      { name: 'x', description: 'x', fields: [makeTitleField()] },
      { categoryCount: MAX_CATEGORIES_PER_USER },
    )
    expect(errors.some((error) => /at most 30/.test(error))).toBe(true)
  })
})

describe('field lifecycle helpers', () => {
  it('makeFieldDefinition derives a frozen key and forbids visual evidence', () => {
    const field = makeFieldDefinition({ label: 'Price Paid', existingKeys: ['price_paid'] })
    expect(field.key).toBe('price_paid_2')
    expect(field.visual_evidence_ok).toBe(false)
    expect(field.required).toBe(false)
    expect(typeof field.created_at).toBe('string')
  })

  it('makeFieldDefinition marks the reserved title field as required title', () => {
    const field = makeFieldDefinition({ label: 'Name', existingKeys: [], asTitle: true })
    expect(field.key).toBe('title')
    expect(field.is_title).toBe(true)
    expect(field.required).toBe(true)
  })

  it('rename keeps the immutable key', () => {
    const field = normalizeFieldForSave(makeField({ key: 'price', label: 'Price' }))
    const renamed = { ...field, label: 'Amount' }
    expect(renamed.key).toBe('price')
  })

  it('soft delete keeps values readable and restore reveals the key again', () => {
    const field = makeField({ key: 'price', label: 'Price' })
    const gone = softDeleteField(field)
    expect(isFieldSoftDeleted(gone)).toBe(true)
    expect(gone.deleted_at).toBeTruthy()
    expect(activeFields([field, gone])).toEqual([field])

    const back = restoreField(gone)
    expect(isFieldSoftDeleted(back)).toBe(false)
    expect(back.key).toBe('price')
  })

  it('normalizeFieldForSave forces the title invariant', () => {
    const field = normalizeFieldForSave(makeField({ key: 'title', label: 'Name', required: false }))
    expect(field.required).toBe(true)
    expect(field.is_title).toBe(true)
    expect(field.visual_evidence_ok).toBe(false)
  })
})

describe('schema versioning', () => {
  it('starts at the initial version and bumps by one per edit', () => {
    expect(nextCategorySchemaVersion(INITIAL_CATEGORY_SCHEMA_VERSION)).toBe(2)
    expect(nextCategorySchemaVersion('9')).toBe(10)
  })

  it('normalizes garbage to a sane next version', () => {
    expect(nextCategorySchemaVersion(undefined)).toBe(2)
    expect(nextCategorySchemaVersion(0)).toBe(2)
  })
})

describe('toAiCategoryDescriptor', () => {
  it('turns a valid category into a provider-independent descriptor', () => {
    const descriptor = toAiCategoryDescriptor(makeCategory())
    expect(descriptor).toMatchObject({ category_id: 'cat-1', name: 'Food Spots', description: 'Places to eat.' })
    expect(descriptor?.fields[0]).toMatchObject({ key: 'title', is_title: true, required: true, type: 'text' })
  })

  it('falls back to the category name when description is missing', () => {
    const descriptor = toAiCategoryDescriptor(makeCategory({ description: null }))
    expect(descriptor?.description).toBe('Food Spots')
    expect(descriptor).not.toBeNull()
  })

  it('normalizes legacy currency to number for the AI', () => {
    const category = makeCategory({
      field_schema: [
        makeTitleField(),
        makeField({ key: 'price', label: 'Price', type: 'currency' as unknown as FieldType }),
      ],
    })
    const descriptor = toAiCategoryDescriptor(category)
    expect(descriptor?.fields.find((field) => field.key === 'price')?.type).toBe('number')
  })

  it('excludes soft-deleted fields from the descriptor', () => {
    const category = makeCategory({
      field_schema: [
        makeTitleField(),
        makeField({ key: 'price', label: 'Price', deleted_at: '2026-09-23T00:00:00.000Z' }),
      ],
    })
    const descriptor = toAiCategoryDescriptor(category)
    expect(descriptor?.fields.map((field) => field.key)).toEqual(['title'])
  })

  it('returns null for malformed categories instead of throwing', () => {
    expect(toAiCategoryDescriptor({} as Category)).toBeNull()
    expect(toAiCategoryDescriptor(makeCategory({ name: '   ' }))).toBeNull()
    expect(
      toAiCategoryDescriptor(makeCategory({ field_schema: [{ key: 'title', label: 'Title', required: false }] as FieldDefinition[] })),
    ).toBeNull()
    expect(
      toAiCategoryDescriptor(makeCategory({ field_schema: [] })),
    ).toBeNull()
    expect(
      toAiCategoryDescriptor(
        makeCategory({
          field_schema: [makeTitleField(), makeField({ key: 'Title2', label: 'X' })] as FieldDefinition[],
        }),
      ),
    ).toBeNull()
  })
})

describe('sanitizeCatalog / buildCategoryCatalog', () => {
  it('skips malformed categories with a malformed_category warning and never throws', () => {
    const good = makeCategory({ id: 'good', name: 'Good' })
    const bad = makeCategory({ id: 'bad', name: 'Bad', field_schema: [] })
    const result = sanitizeCatalog([good, bad, null as unknown as Category, {} as Category])

    expect(result.catalog.map((entry) => entry.category_id)).toEqual(['good'])
    expect(result.warnings).toHaveLength(3)
    expect(result.warnings.every((warning) => warning.reason === 'malformed_category')).toBe(true)
    expect(result.warnings[0].category_id).toBe('bad')
  })

  it('buildCategoryCatalog returns only the valid descriptors', () => {
    const catalog = buildCategoryCatalog([makeCategory({ id: 'a', name: 'A' })])
    expect(catalog).toHaveLength(1)
    expect(catalog[0].category_id).toBe('a')
  })
})

describe('catalog lookup helpers', () => {
  const catalog = buildCategoryCatalog([
    makeCategory({
      id: 'cat-1',
      field_schema: [
        makeTitleField(),
        makeField({ key: 'dish', label: 'Dish', type: 'text' }),
        makeField({ key: 'hidden', label: 'Hidden', deleted_at: '2026-09-23T00:00:00.000Z' }),
      ],
    }),
  ])

  it('allowedFieldKeys only surfaces active fields', () => {
    expect(allowedFieldKeys(catalog, 'cat-1')).toEqual(['title', 'dish'])
    expect(allowedFieldKeys(catalog, 'missing')).toEqual([])
  })

  it('getFieldDefinition finds active fields only', () => {
    expect(getFieldDefinition(catalog, 'cat-1', 'dish')?.label).toBe('Dish')
    expect(getFieldDefinition(catalog, 'cat-1', 'hidden')).toBeUndefined()
  })

  it('titleFieldKey returns the active title key', () => {
    expect(titleFieldKey(catalog, 'cat-1')).toBe('title')
    expect(titleFieldKey(catalog, 'nope')).toBeNull()
  })
})