import { describe, expect, it } from 'vitest'
import {
  CATALOG_SHORTLIST_THRESHOLD,
  CATEGORY_AMBIGUITY_DELTA,
  DAILY_EXTRACT_LIMIT,
  FUZZY_ACCEPT_THRESHOLD,
  LOW_CONFIDENCE_REVIEW,
  MATCH_ACCEPT_SCORE,
  MATCH_RUNNERUP_MARGIN,
  MAX_CATEGORIES_PER_USER,
  MAX_FIELDS_PER_CATEGORY,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_EDGE_PX,
  MAX_ITEMS_PER_IMAGE,
  MAX_LABEL_LENGTH,
  MIN_EVIDENCE_LENGTH,
  SHORTLIST_SIZE,
  VISUAL_MIN_CONFIDENCE,
} from '../../src/lib/vision/constants'

describe('vision pipeline master constants', () => {
  it('MIN_EVIDENCE_LENGTH is 3', () => {
    expect(MIN_EVIDENCE_LENGTH).toBe(3)
  })

  it('FUZZY_ACCEPT_THRESHOLD is 0.85', () => {
    expect(FUZZY_ACCEPT_THRESHOLD).toBe(0.85)
  })

  it('VISUAL_MIN_CONFIDENCE is 0.8', () => {
    expect(VISUAL_MIN_CONFIDENCE).toBe(0.8)
  })

  it('CATEGORY_AMBIGUITY_DELTA is 0.15', () => {
    expect(CATEGORY_AMBIGUITY_DELTA).toBe(0.15)
  })

  it('LOW_CONFIDENCE_REVIEW is 0.7', () => {
    expect(LOW_CONFIDENCE_REVIEW).toBe(0.7)
  })

  it('MAX_ITEMS_PER_IMAGE is 15', () => {
    expect(MAX_ITEMS_PER_IMAGE).toBe(15)
  })

  it('MAX_IMAGE_EDGE_PX is 1600', () => {
    expect(MAX_IMAGE_EDGE_PX).toBe(1600)
  })

  it('MAX_IMAGE_BYTES is 8_388_608', () => {
    expect(MAX_IMAGE_BYTES).toBe(8_388_608)
  })

  it('MAX_FIELDS_PER_CATEGORY is 12', () => {
    expect(MAX_FIELDS_PER_CATEGORY).toBe(12)
  })

  it('MAX_CATEGORIES_PER_USER is 30', () => {
    expect(MAX_CATEGORIES_PER_USER).toBe(30)
  })

  it('MAX_LABEL_LENGTH is 40', () => {
    expect(MAX_LABEL_LENGTH).toBe(40)
  })

  it('CATALOG_SHORTLIST_THRESHOLD is 12', () => {
    expect(CATALOG_SHORTLIST_THRESHOLD).toBe(12)
  })

  it('SHORTLIST_SIZE is 8', () => {
    expect(SHORTLIST_SIZE).toBe(8)
  })

  it('DAILY_EXTRACT_LIMIT is 100', () => {
    expect(DAILY_EXTRACT_LIMIT).toBe(100)
  })

  it('MATCH_ACCEPT_SCORE is 0.80', () => {
    expect(MATCH_ACCEPT_SCORE).toBe(0.8)
  })

  it('MATCH_RUNNERUP_MARGIN is 0.08', () => {
    expect(MATCH_RUNNERUP_MARGIN).toBe(0.08)
  })
})