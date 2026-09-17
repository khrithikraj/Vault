export type FieldType = 'text' | 'textarea' | 'url' | 'number' | 'currency'

export type FieldDefinition = {
  /** 'title' and 'notes' are reserved keys mapped to the item's own columns; anything else lives in metadata. */
  key: string
  label: string
  type: FieldType
  required: boolean
  placeholder?: string
}

export type Category = {
  id: string
  user_id: string
  name: string
  color: string
  icon: string
  is_default: boolean
  field_schema: FieldDefinition[]
  created_at: string
}

export type VaultItem = {
  id: string
  user_id: string
  category_id: string
  title: string
  notes: string | null
  image_url: string | null
  source_url: string | null
  tags: string[]
  status: 'saved' | 'done'
  metadata: Record<string, unknown>
  is_favorite: boolean
  created_at: string
  updated_at: string
  /** Set to an ISO timestamp when the item is in Recently Deleted; null otherwise. */
  deleted_at: string | null
}

export type FoodSpotBranch = {
  id: string
  name: string
  address: string
  mapUrl: string
}

export type ChecklistItem = {
  id: string
  text: string
  done: boolean
}

export type Weekday = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'

export type ChecklistReminder = {
  id: string
  user_id: string
  note_id: string
  /** NULL = whole-note reminder; a real checklist item UUID = item-level reminder. */
  checklist_item_id: string | null
  enabled: boolean
  recurrence: 'once' | 'daily' | 'weekdays' | 'weekly'
  day_of_week?: Weekday | null
  local_time: string
  timezone: string
  next_fire_at: string | null
  last_fired_at: string | null
  created_at: string
  updated_at: string
}

export type DailyChecklistCompletion = {
  reminder_id: string
  local_date: string
  completed_at: string
}

export type Note = {
  id: string
  user_id: string
  title: string
  body: string
  checklist: ChecklistItem[]
  is_favorite: boolean
  created_at: string
  updated_at: string
  /** Set to an ISO timestamp when the note is in Recently Deleted; null otherwise. */
  deleted_at: string | null
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export const DOCUMENT_CATEGORIES = [
  'Identity',
  'Vehicle',
  'Finance',
  'Education',
  'Medical',
  'Travel',
  'Other',
] as const

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number]

export type VaultDocument = {
  id: string
  user_id: string
  category: DocumentCategory
  name: string
  mime_type: string
  file_size: number
  storage_path: string
  is_favorite: boolean
  created_at: string
  /** Set to an ISO timestamp when the document is in Recently Deleted; null otherwise. */
  deleted_at: string | null
}
