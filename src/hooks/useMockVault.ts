import { useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { defaultCategorySeeds } from '../lib/defaults'
import { normalizeCategory } from '../lib/fields'
import type { Category, FieldDefinition, Note, VaultItem } from '../types/app'

const DEV_USER_ID = 'dev-preview-user'

function makeId() {
  return crypto.randomUUID()
}

function seedCategories(): Category[] {
  return defaultCategorySeeds.map((seed) =>
    normalizeCategory({
      id: makeId(),
      user_id: DEV_USER_ID,
      name: seed.name,
      color: seed.color,
      icon: seed.icon,
      is_default: seed.is_default,
      field_schema: seed.field_schema,
      created_at: new Date().toISOString(),
    }),
  )
}

/**
 * A local, in-memory stand-in for `useVault` with the exact same interface — used only for
 * the dev-only "preview without signing in" path so the authenticated screens can be built
 * and QAed without depending on a live, confirmed Supabase session. Never touches the network.
 */
export function useMockVault() {
  const [categories, setCategories] = useState<Category[]>(seedCategories)
  const [items, setItems] = useState<VaultItem[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  const itemCountByCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of items) {
      map.set(item.category_id, (map.get(item.category_id) ?? 0) + 1)
    }
    return map
  }, [items])

  const selectedItems = useMemo(
    () =>
      selectedCategoryId
        ? items.filter((item) => item.category_id === selectedCategoryId)
        : items,
    [items, selectedCategoryId],
  )

  const doneCount = useMemo(() => items.filter((item) => item.status === 'done').length, [items])

  const addCategory = async (input: {
    name: string
    icon: string
    color: string
    fieldSchema?: FieldDefinition[]
  }) => {
    if (!input.name.trim()) {
      return
    }
    const next = normalizeCategory({
      id: makeId(),
      user_id: DEV_USER_ID,
      name: input.name.trim(),
      icon: input.icon.trim() || '✨',
      color: input.color,
      is_default: false,
      field_schema: input.fieldSchema ?? [],
      created_at: new Date().toISOString(),
    })
    setCategories((current) => [...current, next])
    setSelectedCategoryId(next.id)
  }

  const deleteCategory = async (categoryId: string) => {
    setCategories((current) => current.filter((category) => category.id !== categoryId))
    setItems((current) => current.filter((item) => item.category_id !== categoryId))
    setSelectedCategoryId((current) => (current === categoryId ? null : current))
  }

  const updateCategoryFields = async (categoryId: string, fieldSchema: FieldDefinition[]) => {
    setCategories((current) =>
      current.map((category) =>
        category.id === categoryId ? { ...category, field_schema: fieldSchema } : category,
      ),
    )
  }

  const addItem = async (input: {
    categoryId: string
    values: Record<string, string>
    imageFile?: File | null
  }) => {
    if (!input.categoryId) {
      return
    }
    const { title, notes, ...rest } = input.values
    if (!title?.trim()) {
      return
    }
    const metadata = Object.fromEntries(
      Object.entries(rest).filter(([, value]) => value?.trim()),
    )
    // No real backend in dev-preview — an object URL stands in for a hosted image.
    const imageUrl = input.imageFile ? URL.createObjectURL(input.imageFile) : null
    const item: VaultItem = {
      id: makeId(),
      user_id: DEV_USER_ID,
      category_id: input.categoryId,
      title: title.trim(),
      notes: notes?.trim() || null,
      image_url: imageUrl,
      source_url: null,
      tags: [],
      status: 'saved',
      metadata,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    setItems((current) => [item, ...current])
  }

  const toggleItem = async (item: VaultItem) => {
    setItems((current) =>
      current.map((entry) =>
        entry.id === item.id
          ? { ...entry, status: entry.status === 'done' ? 'saved' : 'done' }
          : entry,
      ),
    )
  }

  const deleteItem = async (itemId: string) => {
    setItems((current) => {
      const removed = current.find((item) => item.id === itemId)
      if (removed?.image_url?.startsWith('blob:')) {
        URL.revokeObjectURL(removed.image_url)
      }
      return current.filter((item) => item.id !== itemId)
    })
  }

  const addNote = async () => {
    const note: Note = {
      id: makeId(),
      user_id: DEV_USER_ID,
      title: '',
      body: '',
      checklist: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    setNotes((current) => [note, ...current])
    return note
  }

  const updateNote = async (
    noteId: string,
    patch: Partial<Pick<Note, 'title' | 'body' | 'checklist'>>,
  ) => {
    setNotes((current) =>
      current.map((note) =>
        note.id === noteId
          ? { ...note, ...patch, updated_at: new Date().toISOString() }
          : note,
      ),
    )
  }

  const deleteNote = async (noteId: string) => {
    setNotes((current) => current.filter((note) => note.id !== noteId))
  }

  return {
    session: { user: { id: DEV_USER_ID } } as unknown as Session,
    checkingSession: false,
    loadingData: false,
    message,
    setMessage,
    categories,
    items,
    notes,
    selectedCategoryId,
    setSelectedCategoryId,
    itemCountByCategory,
    selectedItems,
    doneCount,
    signIn: async () => {},
    signUp: async () => {},
    resetPassword: async () => {
      setMessage('Preview mode has no real account — nothing to reset.')
    },
    updatePassword: async () => {},
    passwordRecovery: false,
    signOut: async () => {
      setCategories(seedCategories())
      setItems([])
      setNotes([])
      setSelectedCategoryId(null)
      setMessage('')
    },
    addCategory,
    deleteCategory,
    updateCategoryFields,
    addItem,
    toggleItem,
    deleteItem,
    addNote,
    updateNote,
    deleteNote,
  }
}
