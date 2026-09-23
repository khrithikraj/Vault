/**
 * Master constants for the Vault vision pipeline (Phase 1 canonical contract).
 * Single source of truth for every pipeline threshold and limit defined by the
 * definitive plan. Do not scatter these values elsewhere.
 */

export const MIN_EVIDENCE_LENGTH = 3

export const FUZZY_ACCEPT_THRESHOLD = 0.85

export const VISUAL_MIN_CONFIDENCE = 0.8

export const CATEGORY_AMBIGUITY_DELTA = 0.15

export const LOW_CONFIDENCE_REVIEW = 0.7

export const MAX_ITEMS_PER_IMAGE = 15

export const MAX_IMAGE_EDGE_PX = 1600

export const MAX_IMAGE_BYTES = 8_388_608

export const MAX_FIELDS_PER_CATEGORY = 12

export const MAX_CATEGORIES_PER_USER = 30

export const MAX_LABEL_LENGTH = 40

export const CATALOG_SHORTLIST_THRESHOLD = 12

export const SHORTLIST_SIZE = 8

export const DAILY_EXTRACT_LIMIT = 100

export const MATCH_ACCEPT_SCORE = 0.8

export const MATCH_RUNNERUP_MARGIN = 0.08