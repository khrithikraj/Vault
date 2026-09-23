/**
 * Canonical Vault extraction types — v1.
 *
 * These mirror `ai-lab/schemas/vault-extraction-v1.json` exactly so that the
 * JSON contract and its TypeScript view cannot drift apart. No provider- or
 * category-specific fields belong here. These types are deliberately plain
 * categories; runtime constraints such as `confidence <= 1`, candidate array
 * lengths or integer `category_schema_version` are enforced by AJV schema
 * validation, not by these types.
 */

export type ResultStatus = 'ok' | 'nothing_found' | 'unreadable'

export type FieldStatus = 'present' | 'missing' | 'unreadable' | 'not_applicable' | 'unverified'

export type FieldSource = 'image' | 'external' | 'user' | 'system' | null

export type EvidenceKind = 'ocr_text' | 'visual' | 'none'

export interface FieldEvidence {
  kind: EvidenceKind
  text: string | null
}

export type ValidationReason =
  | 'missing_evidence'
  | 'ocr_mismatch'
  | 'invalid_evidence'
  | 'unknown_field'
  | 'unknown_category'
  | 'illegal_source'
  | 'visual_not_allowed'
  | 'low_visual_confidence'
  | 'malformed_category'

export interface FieldVerification {
  method: 'exact' | 'fuzzy' | 'visual' | 'none'
  score: number | null
  outcome: 'accepted' | 'needs_review' | 'rejected'
  reason: ValidationReason | null
}

export interface FieldResult {
  key: string
  value: string | number | boolean | null
  status: FieldStatus
  confidence: number
  source: FieldSource
  evidence: FieldEvidence
  verification: FieldVerification | null
}

export interface CategoryCandidate {
  category_id: string
  confidence: number
}

export interface ExtractedItem {
  category_candidates: CategoryCandidate[]
  fields: FieldResult[]
}

export interface ExtractionEnvelope {
  schema_version: '1.0'
  prompt_version: string
  ocr_version: string
  model_id: string
  category_schema_version: number
  result_status: ResultStatus
  items: ExtractedItem[]
  warnings: string[]
}