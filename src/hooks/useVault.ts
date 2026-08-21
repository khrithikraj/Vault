import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { defaultCategorySeeds } from '../lib/defaults'
import { describeSupabaseError, fallbackFieldSchema, getErrorMessage, normalizeCategory } from '../lib/fields'
import { SUPABASE_CONFIG_MESSAGE, supabase, supabaseConfigured, vaultBucket } from '../lib/supabase'
import type { Category, FieldDefinition, Note, VaultItem } from '../types/app'

export function useVault() {
  const [session, setSession] = useState<Session | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [loadingData, setLoadingData] = useState(false)
  const [message, setMessage] = useState('')
  const [passwordRecovery, setPasswordRecovery] = useState(false)

  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<VaultItem[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)

  useEffect(() => {
    // Supabase redirects auth errors (e.g. an expired/already-used reset link) back as
    // #error=...&error_description=... instead of throwing, so surface it ourselves.
    if (!window.location.hash.includes('error=')) {
      return
    }
    const params = new URLSearchParams(window.location.hash.slice(1))
    const description = params.get('error_description')
    setMessage(description || 'That link is invalid or has expired.')
    window.history.replaceState(null, '', window.location.pathname)
  }, [])

  useEffect(() => {
    // An unconfigured deploy (missing env vars) must not crash — show the auth UI with a
    // helpful message and bail out of every Supabase call. No session can exist anyway.
    if (!supabaseConfigured) {
      setCheckingSession(false)
      setMessage(SUPABASE_CONFIG_MESSAGE)
      return
    }

    let mounted = true

    const init = async () => {
      const { data, error } = await supabase.auth.getSession()
      if (!mounted) {
        return
      }

      if (error) {
        setMessage(error.message)
      }

      setSession(data.session ?? null)
      if (data.session?.user?.id) {
        void loadVault(data.session.user.id)
      }
      setCheckingSession(false)
    }

    void init()

    const { data: authSubscription } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        if (event === 'PASSWORD_RECOVERY') {
          setPasswordRecovery(true)
        }
        setSession(nextSession)
        if (nextSession?.user?.id) {
          void loadVault(nextSession.user.id)
        } else {
          setCategories([])
          setItems([])
          setSelectedCategoryId(null)
        }
      },
    )

    return () => {
      mounted = false
      authSubscription.subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const itemCountByCategory = useMemo(() => {
    const countMap = new Map<string, number>()
    for (const item of items) {
      countMap.set(item.category_id, (countMap.get(item.category_id) ?? 0) + 1)
    }
    return countMap
  }, [items])

  const selectedItems = useMemo(
    () =>
      selectedCategoryId
        ? items.filter((item) => item.category_id === selectedCategoryId)
        : items,
    [items, selectedCategoryId],
  )

  const doneCount = useMemo(
    () => items.filter((item) => item.status === 'done').length,
    [items],
  )

  const loadVault = async (userId: string) => {
    setLoadingData(true)
    setMessage('')

    // Seeding failure (e.g. DB migration not applied yet) must not block loading
    // whatever categories/items already exist.
    await ensureDefaultCategories(userId).catch((seedError) => {
      setMessage(describeSupabaseError({ message: getErrorMessage(seedError) }))
    })

    try {
      const [
        { data: categoryData, error: categoryError },
        { data: itemData, error: itemError },
        { data: noteData, error: noteError },
      ] = await Promise.all([
        supabase
          .from('categories')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: true }),
        supabase
          .from('items')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),
        supabase
          .from('notes')
          .select('*')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false }),
      ])

      if (categoryError) {
        throw categoryError
      }
      if (itemError) {
        throw itemError
      }
      // Notes table may not exist yet on databases that haven't re-run schema.sql —
      // don't let that block categories/items from loading.
      if (noteError) {
        setMessage(describeSupabaseError(noteError))
      }

      const nextCategories = ((categoryData as Category[]) ?? []).map(normalizeCategory)
      setCategories(nextCategories)
      setItems((itemData as VaultItem[]) ?? [])
      setNotes((noteData as Note[]) ?? [])

      if (nextCategories.length > 0) {
        setSelectedCategoryId((current) => current ?? nextCategories[0].id)
      }
    } catch (error) {
      setMessage(describeSupabaseError({ message: getErrorMessage(error) }))
    } finally {
      setLoadingData(false)
    }
  }

  const ensureDefaultCategories = async (userId: string) => {
    // Upsert + ignoreDuplicates makes this safe to call concurrently
    // (getSession and onAuthStateChange can both trigger it on first load).
    const { error: seedError } = await supabase.from('categories').upsert(
      defaultCategorySeeds.map((category) => ({
        ...category,
        user_id: userId,
      })),
      { onConflict: 'user_id,name', ignoreDuplicates: true },
    )

    if (seedError) {
      throw seedError
    }
  }

  const MAX_PHOTO_BYTES = 8 * 1024 * 1024

  const uploadItemImage = async (userId: string, file: File) => {
    // Defense in depth — the capture UI already validates this, but addItem is a public
    // surface of this hook, so re-check before ever touching the network/storage.
    if (!file.type.startsWith('image/')) {
      throw new Error("That file isn't an image.")
    }
    if (file.size > MAX_PHOTO_BYTES) {
      throw new Error('That photo is too large (max 8MB).')
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${userId}/${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from(vaultBucket).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    })
    if (error) {
      throw error
    }
    return supabase.storage.from(vaultBucket).getPublicUrl(path).data.publicUrl
  }

  /** Reverses getPublicUrl so deleteItem can clean up the matching storage object. */
  const storagePathFromUrl = (url: string) => {
    const marker = `/object/public/${vaultBucket}/`
    const index = url.indexOf(marker)
    return index === -1 ? null : url.slice(index + marker.length)
  }

  const signIn = async (email: string, password: string) => {
    if (!supabaseConfigured) {
      setMessage(SUPABASE_CONFIG_MESSAGE)
      return
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setMessage(error.message)
      throw error
    }
  }

  const signUp = async (email: string, password: string) => {
    if (!supabaseConfigured) {
      setMessage(SUPABASE_CONFIG_MESSAGE)
      return
    }
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setMessage(error.message)
      throw error
    }
    setMessage('Sign-up successful. Verify your email and sign in.')
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      setMessage(error.message)
    }
  }

  const resetPassword = async (email: string) => {
    if (!supabaseConfigured) {
      setMessage(SUPABASE_CONFIG_MESSAGE)
      return
    }
    if (!email.trim()) {
      setMessage('Enter your email above first, then tap "Forgot password?" again.')
      return
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    })
    if (error) {
      setMessage(error.message)
      return
    }
    setMessage('Password reset email sent — check your inbox.')
  }

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setMessage(error.message)
      throw error
    }
    setPasswordRecovery(false)
    setMessage('Password updated — you\'re all set.')
  }

  const addCategory = async (input: {
    name: string
    icon: string
    color: string
    fieldSchema?: FieldDefinition[]
  }) => {
    if (!session?.user?.id || !input.name.trim()) {
      return
    }

    const payload = {
      user_id: session.user.id,
      name: input.name.trim(),
      icon: input.icon.trim() || '✨',
      color: input.color,
      is_default: false,
      field_schema: input.fieldSchema ?? fallbackFieldSchema,
    }

    const { data, error } = await supabase
      .from('categories')
      .insert(payload)
      .select('*')
      .single()

    if (error) {
      setMessage(describeSupabaseError(error))
      return
    }

    const next = normalizeCategory(data as Category)
    setCategories((current) => [...current, next])
    setSelectedCategoryId(next.id)
  }

  /** Edit a category's metadata and/or field schema in one call. */
  const updateCategory = async (
    categoryId: string,
    name: string,
    icon: string,
    color: string,
    fieldSchema?: FieldDefinition[],
  ) => {
    if (!session?.user?.id) {
      return
    }
    const trimmedName = name.trim()
    if (!trimmedName) {
      return
    }

    const payload: { name: string; icon: string; color: string; field_schema?: FieldDefinition[] } = {
      name: trimmedName,
      icon: icon.trim() || '✨',
      color,
    }
    if (fieldSchema !== undefined) {
      payload.field_schema = fieldSchema
    }

    const { data, error } = await supabase
      .from('categories')
      .update(payload)
      .eq('id', categoryId)
      .select('*')
      .single()

    if (error) {
      setMessage(describeSupabaseError(error))
      return
    }

    const updated = normalizeCategory(data as Category)
    setCategories((current) => current.map((category) => (category.id === updated.id ? updated : category)))
  }

  const updateCategoryFields = async (categoryId: string, fieldSchema: FieldDefinition[]) => {
    const { data, error } = await supabase
      .from('categories')
      .update({ field_schema: fieldSchema })
      .eq('id', categoryId)
      .select('*')
      .single()

    if (error) {
      setMessage(describeSupabaseError(error))
      return
    }

    const updated = normalizeCategory(data as Category)
    setCategories((current) =>
      current.map((category) => (category.id === updated.id ? updated : category)),
    )
  }

  const deleteCategory = async (categoryId: string) => {
    const { error } = await supabase.from('categories').delete().eq('id', categoryId)
    if (error) {
      setMessage(error.message)
      return
    }

    setCategories((current) => current.filter((category) => category.id !== categoryId))
    setItems((current) => current.filter((item) => item.category_id !== categoryId))
    setSelectedCategoryId((current) => {
      if (current !== categoryId) {
        return current
      }

      const nextCategory = categories.find((category) => category.id !== categoryId)
      return nextCategory?.id ?? null
    })
  }

  /** values keys map to field_schema keys: 'title'/'notes' hit their own columns, the rest land in metadata. */
  const addItem = async (input: {
    categoryId: string
    values: Record<string, string>
    imageFile?: File | null
  }) => {
    if (!session?.user?.id || !input.categoryId) {
      return
    }

    const { title, notes, ...rest } = input.values
    if (!title?.trim()) {
      return
    }

    const metadata = Object.fromEntries(
      Object.entries(rest).filter(([, value]) => value?.trim()),
    )

    let imageUrl: string | null = null
    if (input.imageFile) {
      try {
        imageUrl = await uploadItemImage(session.user.id, input.imageFile)
      } catch (error) {
        setMessage(`Couldn't upload photo: ${getErrorMessage(error)}`)
        return
      }
    }

    const payload = {
      user_id: session.user.id,
      category_id: input.categoryId,
      title: title.trim(),
      notes: notes?.trim() || null,
      image_url: imageUrl,
      status: 'saved' as const,
      metadata,
      tags: [],
    }

    const { data, error } = await supabase.from('items').insert(payload).select('*').single()

    if (error) {
      setMessage(error.message)
      return
    }

    setItems((current) => [data as VaultItem, ...current])
  }

  const updateItem = async (
    itemId: string,
    input: {
      title?: string
      notes?: string | null
      categoryId?: string
      metadata?: Record<string, unknown>
      status?: 'saved' | 'done'
      imageFile?: File | null
      removeImage?: boolean
    },
  ) => {
    if (!session?.user?.id) {
      return
    }

    let imageUrl: string | null | undefined = undefined
    if (input.removeImage) {
      imageUrl = null
    } else if (input.imageFile) {
      try {
        imageUrl = await uploadItemImage(session.user.id, input.imageFile)
      } catch (error) {
        setMessage(`Couldn't upload photo: ${getErrorMessage(error)}`)
        return
      }
    }

    const patch: Record<string, unknown> = {}
    if (input.title !== undefined) patch.title = input.title.trim()
    if (input.notes !== undefined) patch.notes = input.notes?.trim() || null
    if (input.categoryId !== undefined) patch.category_id = input.categoryId
    if (input.metadata !== undefined) patch.metadata = input.metadata
    if (input.status !== undefined) patch.status = input.status
    if (imageUrl !== undefined) patch.image_url = imageUrl

    const { data, error } = await supabase
      .from('items')
      .update(patch)
      .eq('id', itemId)
      .select('*')
      .single()

    if (error) {
      setMessage(error.message)
      return
    }

    const updated = data as VaultItem
    setItems((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)))
  }

  const toggleItem = async (item: VaultItem) => {
    const nextStatus: VaultItem['status'] = item.status === 'done' ? 'saved' : 'done'

    const { data, error } = await supabase
      .from('items')
      .update({ status: nextStatus })
      .eq('id', item.id)
      .select('*')
      .single()

    if (error) {
      setMessage(error.message)
      return
    }

    const updated = data as VaultItem
    setItems((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)))
  }

  const deleteItem = async (itemId: string) => {
    const { error } = await supabase.from('items').delete().eq('id', itemId)
    if (error) {
      setMessage(error.message)
      return
    }

    setItems((current) => {
      const removed = current.find((item) => item.id === itemId)
      if (removed?.image_url) {
        const path = storagePathFromUrl(removed.image_url)
        if (path) {
          // Best-effort cleanup — a failed storage removal shouldn't block the item delete.
          void supabase.storage.from(vaultBucket).remove([path])
        }
      }
      return current.filter((item) => item.id !== itemId)
    })
  }

  const addNote = async () => {
    if (!session?.user?.id) {
      return
    }

    const { data, error } = await supabase
      .from('notes')
      .insert({ user_id: session.user.id, title: '', body: '', checklist: [] })
      .select('*')
      .single()

    if (error) {
      setMessage(describeSupabaseError(error))
      return null
    }

    const note = data as Note
    setNotes((current) => [note, ...current])
    return note
  }

  const updateNote = async (
    noteId: string,
    patch: Partial<Pick<Note, 'title' | 'body' | 'checklist'>>,
  ) => {
    const { data, error } = await supabase
      .from('notes')
      .update(patch)
      .eq('id', noteId)
      .select('*')
      .single()

    if (error) {
      setMessage(describeSupabaseError(error))
      return
    }

    const updated = data as Note
    setNotes((current) => current.map((note) => (note.id === updated.id ? updated : note)))
  }

  const deleteNote = async (noteId: string) => {
    const { error } = await supabase.from('notes').delete().eq('id', noteId)
    if (error) {
      setMessage(error.message)
      return
    }
    setNotes((current) => current.filter((note) => note.id !== noteId))
  }

  return {
    session,
    checkingSession,
    loadingData,
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
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
    passwordRecovery,
    addCategory,
    updateCategory,
    deleteCategory,
    updateCategoryFields,
    addItem,
    updateItem,
    toggleItem,
    deleteItem,
    addNote,
    updateNote,
    deleteNote,
  }
}
