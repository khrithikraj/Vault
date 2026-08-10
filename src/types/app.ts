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
  created_at: string
  updated_at: string
}

export type ChecklistItem = {
  id: string
  text: string
  done: boolean
}

export type Note = {
  id: string
  user_id: string
  title: string
  body: string
  checklist: ChecklistItem[]
  created_at: string
  updated_at: string
}
