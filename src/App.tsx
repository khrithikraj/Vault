import { motion } from 'motion/react'
import { Sparkles } from 'lucide-react'
import { useVault } from './hooks/useVault'
import { useMockVault } from './hooks/useMockVault'
import { useDocuments } from './hooks/useDocuments'
import { consumeSharedPhoto } from './lib/shareTarget'
import { CategoryIcon } from './lib/icons'
import { Atmosphere } from './components/Atmosphere'
import { AuthScreen } from './components/AuthScreen'
import { LandingPage } from './components/LandingPage'
import { UpdatePasswordScreen } from './components/UpdatePasswordScreen'
import { AppDock } from './components/AppDock'
import { CategoryRail } from './components/CategoryRail'
import { ItemGrid } from './components/ItemGrid'
import { CaptureFab } from './components/CaptureFab'
import { ShimmerText } from './components/ShimmerText'
import { AnimatedNumber } from './components/AnimatedNumber'
import { ProgressiveBlur } from './components/ProgressiveBlur'
import { ScrollReveal } from './components/ScrollReveal'
import { ScrollProgress } from './components/ScrollProgress'
import { SharedItemView } from './components/SharedItemView'
import { SearchBar } from './components/SearchBar'
import { SearchResults } from './components/SearchResults'
import { ConfirmDialog } from './components/ConfirmDialog'
import { TrashPanel } from './components/TrashPanel'
import { buildTrashRows } from './lib/trashRows'
import type { TrashRow } from './lib/trashRows'
import { searchVault } from './lib/search'
import type { SearchScope } from './lib/search'
import type { TrashKind } from './lib/trash'
import type { VaultDocument, VaultItem } from './types/app'
import type { SharedSnapshot } from './lib/share'
import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react'

// Modals opened on demand only — lazy-loaded to keep the initial bundle lean.
const ItemDetailOverlay = lazy(() =>
  import('./components/ItemDetailOverlay').then((mod) => ({ default: mod.ItemDetailOverlay })),
)
const CategoryEditor = lazy(() =>
  import('./components/CategoryEditor').then((mod) => ({ default: mod.CategoryEditor })),
)
const NoteDetailOverlay = lazy(() =>
  import('./components/NoteDetailOverlay').then((mod) => ({ default: mod.NoteDetailOverlay })),
)
const NotesPanel = lazy(() =>
  import('./components/NotesPanel').then((mod) => ({ default: mod.NotesPanel })),
)
const DocumentsPanel = lazy(() =>
  import('./components/documents/DocumentsPanel').then((mod) => ({ default: mod.DocumentsPanel })),
)
const DocumentViewer = lazy(() =>
  import('./components/documents/DocumentViewer').then((mod) => ({ default: mod.DocumentViewer })),
)
const DocumentUploader = lazy(() =>
  import('./components/documents/DocumentUploader').then((mod) => ({ default: mod.DocumentUploader })),
)

export default function App() {
  const realVault = useVault()
  const mockVault = useMockVault()
  const [devPreview, setDevPreview] = useState(false)
  const vault = devPreview ? mockVault : realVault
  const docs = useDocuments()

  // Overlay state: item, note, document
  const [openItemId, setOpenItemId] = useState<string | null>(null)
  const openItem: VaultItem | null = openItemId
    ? vault.items.find((item) => item.id === openItemId) ?? null
    : null

  const [openNoteId, setOpenNoteId] = useState<string | null>(null)
  const openNote = openNoteId ? vault.notes.find((note) => note.id === openNoteId) ?? null : null

  const [openDocId, setOpenDocId] = useState<string | null>(null)
  const openDoc: VaultDocument | null = openDocId
    ? docs.documents.find((doc) => doc.id === openDocId) ?? null
    : null

  // Store only the ID of the category being edited — always resolve to the live category object
  // so CategoryEditor gets fresh field_schema even after a Supabase reload.
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const editingCategory = editingCategoryId
    ? (vault.categories.find((c) => c.id === editingCategoryId) ?? null)
    : null
  const [celebration, setCelebration] = useState<{ id: string; token: number } | null>(null)
  const [sharedPhoto, setSharedPhoto] = useState<File | null>(null)
  const [sharedPhotoToken, setSharedPhotoToken] = useState(0)
  const [mainView, setMainView] = useState<'vault' | 'notes' | 'documents' | 'trash'>('vault')
  const [showLanding, setShowLanding] = useState(true)
  // Track whether documents have been loaded for the current session
  const docsLoadedRef = useRef(false)

  // Doc uploader is lifted to App level so Quick Add (from any section) can open it.
  const [docUploadOpen, setDocUploadOpen] = useState(false)

  // Permanent-delete confirmation for anything in Recently Deleted.
  type PurgeTarget = { kind: TrashKind; id: string; name: string }
  const [purgeTarget, setPurgeTarget] = useState<PurgeTarget | null>(null)
  const [purgeBusy, setPurgeBusy] = useState(false)

  // ---------------------------------------------------------------------------
  // Search — client-side, in-memory, scoped automatically by the current section.
  // The query is cleared whenever the section/category changes so switching tabs
  // always lands on normal content (never a stale result set).
  // ---------------------------------------------------------------------------
  const [searchQuery, setSearchQuery] = useState('')
  const activeQuery = searchQuery.trim()

  const searchScope = useMemo<SearchScope>(() => {
    if (mainView === 'notes') return { kind: 'notes' }
    if (mainView === 'documents') return { kind: 'documents' }
    if (mainView === 'trash') return { kind: 'trash' }
    if (vault.selectedCategoryId) return { kind: 'category', categoryId: vault.selectedCategoryId }
    return { kind: 'everything' }
  }, [mainView, vault.selectedCategoryId])

  const searchResults = useMemo(
    () =>
      searchVault({
        query: activeQuery,
        scope: searchScope,
        items: vault.items,
        categories: vault.categories,
        notes: vault.notes,
        documents: docs.documents,
        trashedItems: vault.trashedItems,
        trashedNotes: vault.trashedNotes,
        trashedDocuments: docs.trashedDocuments,
      }),
    [
      activeQuery,
      searchScope,
      vault.items,
      vault.categories,
      vault.notes,
      docs.documents,
      vault.trashedItems,
      vault.trashedNotes,
      docs.trashedDocuments,
    ],
  )

  useEffect(() => {
    setSearchQuery('')
  }, [mainView, vault.selectedCategoryId])

  // ---------------------------------------------------------------------------
  // Share route: /s/:token — a read-only preview of a shared item snapshot.
  // Parsed directly from the URL so it coexists with the overlay/section history
  // (it's a distinct top-level view, not part of the vault's history stack).
  // ---------------------------------------------------------------------------
  const [dismissedShare, setDismissedShare] = useState(false)
  const shareToken = useMemo(() => {
    if (dismissedShare) return null
    const match = window.location.pathname.match(/\/s\/([A-Za-z0-9]+)\/?$/)
    return match ? match[1] : null
  }, [dismissedShare])

  const leaveShareView = useCallback(() => {
    setDismissedShare(true)
    window.history.replaceState(
      null,
      '',
      window.location.pathname.replace(/\/s\/.*$/, '') || '/',
    )
  }, [])

  // ---------------------------------------------------------------------------
  // Unified Overlay + Section History Architecture
  // Ensures hardware/browser Back closes open overlays first, then walks back
  // through the main section history (Vault ⇄ Notes ⇄ Documents), without
  // leaving stale/duplicate entries or closing the PWA while something is open.
  // ---------------------------------------------------------------------------
  const closeAllOverlays = useCallback(() => {
    setOpenItemId(null)
    setOpenNoteId(null)
    setOpenDocId(null)
  }, [])

  // Live mirror of whether any overlay is open, so the single popstate listener
  // always sees current state without stale closures.
  const overlayOpenRef = useRef(false)
  overlayOpenRef.current = !!(openItemId || openNoteId || openDocId)

  // Stack of the base (non-overlay) sections we've navigated into. The top entry
  // is the section currently visible underneath any open overlay. Only grows when
  // the user actually switches main section.
  const sectionStackRef = useRef<('vault' | 'notes' | 'documents' | 'trash')[]>(['vault'])

  const handleDismissOverlay = useCallback(() => {
    if (window.history.state?.vaultOverlay) {
      window.history.back()
    } else {
      closeAllOverlays()
    }
  }, [closeAllOverlays])

  const pushOverlay = useCallback(() => {
    if (!window.history.state?.vaultOverlay) {
      window.history.pushState({ vaultOverlay: true }, '')
    }
  }, [])

  const handleOpenItem = useCallback(
    (id: string) => {
      pushOverlay()
      setOpenItemId(id)
      setOpenNoteId(null)
      setOpenDocId(null)
    },
    [pushOverlay],
  )

  const handleOpenNote = useCallback(
    (id: string) => {
      pushOverlay()
      setOpenNoteId(id)
      setOpenItemId(null)
      setOpenDocId(null)
    },
    [pushOverlay],
  )

  const handleOpenDoc = useCallback(
    (doc: VaultDocument) => {
      pushOverlay()
      setOpenDocId(doc.id)
      setOpenItemId(null)
      setOpenNoteId(null)
    },
    [pushOverlay],
  )

  // Switch the base section and record a history entry so Back can return to it.
  const goToSection = useCallback(
    (next: 'vault' | 'notes' | 'documents' | 'trash') => {
      const top = sectionStackRef.current[sectionStackRef.current.length - 1]
      if (top === next) {
        return
      }
      window.history.pushState({ vaultSection: true }, '')
      sectionStackRef.current = [...sectionStackRef.current, next]
      setMainView(next)
    },
    [],
  )

  // ---------------------------------------------------------------------------
  // Smart Quick Add — the Floating Action Button adapts to the current section:
  //    vault + selected category → directly into that category's item wizard
  //    vault + Everything         → a chooser (Item / Note / Document)
  //    notes                      → a fresh note opened in the editor
  //    documents                  → the document uploader
  //    trash                      → hidden
  // ---------------------------------------------------------------------------
  const quickAdd = useMemo<'choose' | 'item' | 'note' | 'document'>(() => {
    if (mainView === 'notes') return 'note'
    if (mainView === 'documents') return 'document'
    if (vault.selectedCategoryId) return 'item'
    return 'choose'
  }, [mainView, vault.selectedCategoryId])

  const handleQuickAddNote = useCallback(() => {
    goToSection('notes')
    void vault.addNote().then((note) => {
      if (note) {
        handleOpenNote(note.id)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goToSection, vault])

  const handleQuickAddDocument = useCallback(() => {
    goToSection('documents')
    setDocUploadOpen(true)
  }, [goToSection])

  // Recently Deleted: merged rows for the trash tab + row-level restore/purge.
  const trashRows = useMemo(
    () =>
      buildTrashRows({
        items: vault.trashedItems,
        notes: vault.trashedNotes,
        documents: docs.trashedDocuments,
        categories: vault.categories,
      }),
    [vault.trashedItems, vault.trashedNotes, docs.trashedDocuments, vault.categories],
  )

  // When searching within the Trash tab, narrow the merged rows to the query hits —
  // searchVault already matched against the trashed arrays, so filter by result id.
  const filteredTrashRows = useMemo(() => {
    if (searchScope.kind !== 'trash') return []
    const hitIds = new Set([
      ...searchResults.items.map((hit) => hit.item.id),
      ...searchResults.notes.map((hit) => hit.note.id),
      ...searchResults.documents.map((doc) => doc.id),
    ])
    return trashRows.filter((row) => hitIds.has(row.id))
  }, [searchScope.kind, searchResults, trashRows])

  const handleRestoreTrashRow = useCallback(
    (row: TrashRow) => {
      if (row.kind === 'item') {
        const item = vault.trashedItems.find((i) => i.id === row.id)
        if (item) void vault.restoreItem(item)
      } else if (row.kind === 'note') {
        const note = vault.trashedNotes.find((n) => n.id === row.id)
        if (note) void vault.restoreNote(note)
      } else {
        const doc = docs.trashedDocuments.find((d) => d.id === row.id)
        if (doc) void docs.restoreDocument(doc)
      }
    },
    [vault, docs],
  )

  const handlePurgeTarget = useCallback(async (): Promise<boolean> => {
    const target = purgeTarget
    if (!target) return false
    if (target.kind === 'item') {
      const item = vault.trashedItems.find((i) => i.id === target.id)
      return item ? vault.purgeItem(item) : false
    }
    if (target.kind === 'note') {
      const note = vault.trashedNotes.find((n) => n.id === target.id)
      return note ? vault.purgeNote(note) : false
    }
    const doc = docs.trashedDocuments.find((d) => d.id === target.id)
    return doc ? docs.purgeDocument(doc) : false
  }, [purgeTarget, vault, docs])

  // "Add to My Vault" from a shared link: for a shared ITEM, resolve a target
  // category by name (falling back to the default), map the snapshot fields back by
  // label, then save a new item in the recipient's vault. For a shared NOTE, copy the
  // snapshot (title/body/checklist) into a NEW note owned by the recipient. Never
  // touches the owner's private rows.
  const handleAddSharedToVault = useCallback(
    async (shared: SharedSnapshot): Promise<boolean> => {
      if (!vault.session) {
        setShowLanding(false)
        setDismissedShare(true)
        window.history.replaceState(
          null,
          '',
          window.location.pathname.replace(/\/s\/.*$/, '') || '/',
        )
        return false
      }
      if (shared.kind === 'note') {
        const ok = await vault.importNote({
          title: shared.title,
          body: shared.notes ?? '',
          checklist: shared.checklist,
        })
        if (ok) {
          setMainView('notes')
        }
        return ok
      }
      let category = vault.categories.find(
        (c) => c.name.toLowerCase() === shared.category_name.toLowerCase(),
      )
      if (!category) {
        category =
          vault.categories.find((c) => c.is_default) ??
          vault.categories.find((c) => c.field_schema && c.field_schema.length > 0) ??
          vault.categories[0]
      }
      if (!category || !vault.addItem) return false

      const values: Record<string, string> = { title: shared.title, notes: shared.notes ?? '' }
      const schema = category.field_schema ?? []
      for (const field of shared.fields) {
        const def = schema.find((d) => d.label.toLowerCase() === field.label.toLowerCase())
        if (def && def.key !== 'title' && def.key !== 'notes') {
          values[def.key] = field.value.value
        }
      }
      await vault.addItem({ categoryId: category.id, values })
      setMainView('vault')
      vault.setSelectedCategoryId(category.id)
      return true
    },
    [vault],
  )

  useEffect(() => {
    const handlePopState = () => {
      // An overlay is open → this Back closed the overlay entry. Close it and stay
      // put in the current section.
      if (overlayOpenRef.current) {
        closeAllOverlays()
        return
      }
      // Otherwise this was a section Back: pop to the previous section. If we're
      // already at the base (nothing left to unwind), let the browser behave
      // normally (e.g. leave the PWA) rather than intercepting forever.
      if (sectionStackRef.current.length > 1) {
        const stack = sectionStackRef.current
        stack.pop()
        const prev = stack[stack.length - 1]
        setMainView(prev)
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [closeAllOverlays])

  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has('shared')) {
      return
    }
    window.history.replaceState(null, '', window.location.pathname)
    void consumeSharedPhoto().then((file) => {
      if (file) {
        setSharedPhoto(file)
        setSharedPhotoToken((token) => token + 1)
      }
    })
  }, [])

  // Load documents lazily — once per session — when the user opens the Documents tab,
  // the Trash tab (trashed documents can be restored there), or when a vault-wide search
  // is active so Everything results can include documents even if that tab hasn't been
  // visited yet. Already-loaded (docsLoadedRef) is skipped.
  useEffect(() => {
    if (docsLoadedRef.current) return
    if (!vault.session?.user?.id || devPreview) return
    const needsDocuments =
      mainView === 'documents' ||
      mainView === 'trash' ||
      (searchScope.kind === 'everything' && activeQuery.length > 0)
    if (!needsDocuments) return
    docsLoadedRef.current = true
    void docs.load()
  }, [mainView, activeQuery, searchScope, vault.session?.user?.id, devPreview, docs])

  // Reset docs state on sign-out so a new sign-in gets fresh data.
  useEffect(() => {
    if (!vault.session) {
      docsLoadedRef.current = false
    }
  }, [vault.session])

  const handleSignOut = () => {
    if (devPreview) {
      setDevPreview(false)
    }
    void vault.signOut()
  }

  // Shared link route — a self-contained read-only preview renderered ahead of the
  // normal session flow so unauthenticated visitors can view shared items.
  if (shareToken) {
    return (
      <SharedItemView
        token={shareToken}
        signedIn={!!vault.session}
        onAddToVault={handleAddSharedToVault}
        onBack={leaveShareView}
      />
    )
  }

  if (vault.checkingSession) {
    return (
      <main className="relative flex min-h-screen items-center justify-center">
        <Atmosphere variant="full" />
        <div className="term-panel flex items-center gap-3 rounded px-5 py-3">
          <span className="bg-ink/40 h-2 w-2 animate-pulse rounded-full" />
          <span
            className="bg-ink/40 h-2 w-2 animate-pulse rounded-full"
            style={{ animationDelay: '0.15s' }}
          />
          <span
            className="bg-ink/40 h-2 w-2 animate-pulse rounded-full"
            style={{ animationDelay: '0.3s' }}
          />
          <p className="text-sm uppercase tracking-widest text-ink-soft">Preparing Raj&apos;s...</p>
        </div>
      </main>
    )
  }

  if (vault.passwordRecovery) {
    return <UpdatePasswordScreen message={vault.message} onUpdatePassword={vault.updatePassword} />
  }

  if (!vault.session) {
    if (showLanding) {
      return <LandingPage onGetStarted={() => setShowLanding(false)} />
    }
    return (
      <AuthScreen
        message={vault.message}
        onSignIn={vault.signIn}
        onSignUp={vault.signUp}
        onForgotPassword={vault.resetPassword}
        onPreview={() => setDevPreview(true)}
      />
    )
  }

  const activeCategory = vault.categories.find(
    (category) => category.id === vault.selectedCategoryId,
  )

  const searchPlaceholder =
    mainView === 'notes'
      ? 'Search notes…'
      : mainView === 'documents'
        ? 'Search documents…'
        : mainView === 'trash'
          ? 'Search trash…'
          : activeCategory
            ? `Search ${activeCategory.name}…`
            : 'Search your vault…'

  const searchMode: 'everything' | 'category' | 'notes' | 'documents' | 'trash' =
    mainView === 'vault' ? (vault.selectedCategoryId ? 'category' : 'everything') : mainView

  return (
    <main className="relative min-h-screen pb-32">
      <Atmosphere activeCategory={activeCategory} />
      <ScrollProgress />
      <ProgressiveBlur side="bottom" height={120} />

      <div className="mx-auto max-w-5xl px-4 pt-12 sm:px-6">
        <motion.header
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="term-panel term-brackets rim-light relative flex flex-col gap-4 overflow-hidden rounded p-6 sm:flex-row sm:items-end sm:justify-between sm:p-8"
        >
          <div>
            <p className="text-micro text-ink-soft">Raj&apos;s — personal vault</p>
            <div style={{ '--text-display': 'clamp(1.5rem, 4.5vw, 2.75rem)' } as React.CSSProperties}>
              <ShimmerText
                as="h1"
                text="Capture it once. Find it when it matters."
                className="text-display mt-3 block"
              />
            </div>
            <p className="mt-4 text-sm text-ink-soft">
              <AnimatedNumber value={vault.items.length} className="font-semibold text-ink" />{' '}
              saved · <AnimatedNumber value={vault.doneCount} className="font-semibold text-ink" />{' '}
              done
            </p>
          </div>
          <div className="flex items-center gap-3 sm:pb-1">
            <span className="folio hidden text-xs text-ink-soft/60 sm:inline">Vol. I — RAJ&apos;S</span>
            <button
              type="button"
              onClick={handleSignOut}
              className="term-chip rounded-full px-4 py-2 text-sm font-medium uppercase tracking-wide"
            >
              {devPreview ? 'Exit preview' : 'Sign out'}
            </button>
          </div>
        </motion.header>

        {vault.message ? (
          <div className="border-ink/30 mt-4 flex items-start justify-between gap-3 rounded border border-dashed bg-transparent p-4 text-sm text-ink">
            <p>{vault.message}</p>
            <button
              type="button"
              onClick={() => vault.setMessage('')}
              className="term-chip shrink-0 rounded-full px-2 py-1 text-xs font-medium uppercase tracking-wide"
            >
              Dismiss
            </button>
          </div>
        ) : null}

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut', delay: 0.1 }}
        >
          <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder={searchPlaceholder} />
        </motion.div>

        {activeQuery ? (
          <SearchResults
            query={activeQuery}
            mode={searchMode}
            results={searchResults}
            categories={vault.categories}
            onOpenItem={(item) => handleOpenItem(item.id)}
            onToggleItem={(item) => void vault.toggleItem(item)}
            onDeleteItem={(item) => void vault.deleteItem(item.id)}
            onOpenNote={handleOpenNote}
            onDeleteNote={(id) => void vault.deleteNote(id)}
            onOpenDoc={handleOpenDoc}
            onDeleteDoc={docs.removeDocument}
            trashRows={filteredTrashRows}
            onRestoreTrashRow={handleRestoreTrashRow}
            onPurgeTrashRow={(row) =>
              setPurgeTarget({ kind: row.kind, id: row.id, name: row.name })
            }
          />
        ) : mainView === 'vault' ? (
          <>
            <ScrollReveal className="mt-10">
              <h2 className="font-display flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em]">
                <span className="folio text-xs text-ink-soft/50">01</span>
                {activeCategory ? (
                  <>
                    <CategoryIcon icon={activeCategory.icon} color={activeCategory.color} size={18} />
                    {activeCategory.name}
                  </>
                ) : (
                  <>
                    <Sparkles size={18} className="text-ink-soft" />
                    Everything
                  </>
                )}
              </h2>
              <ItemGrid
                items={vault.selectedItems}
                categories={vault.categories}
                onOpen={(item) => handleOpenItem(item.id)}
                onToggle={(item) => void vault.toggleItem(item)}
              onDelete={(item) => void vault.deleteItem(item.id)}
              />
            </ScrollReveal>

            <div className="divider-dash mt-12" />

            <ScrollReveal className="mt-12">
              <div className="mb-4 flex items-baseline justify-between">
                <h2 className="font-display flex items-baseline gap-2 text-sm font-semibold uppercase tracking-[0.2em]">
                  <span className="folio text-xs text-ink-soft/50">02</span> Categories
                </h2>
                {vault.loadingData && vault.categories.length > 0 ? (
                  <span className="text-xs uppercase tracking-widest text-ink-soft">Syncing…</span>
                ) : null}
              </div>
              {vault.loadingData && vault.categories.length === 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[0, 1, 2].map((key) => (
                    <div key={key} className="term-panel h-32 animate-pulse rounded" />
                  ))}
                </div>
              ) : (
                <CategoryRail
                  categories={vault.categories}
                  selectedCategoryId={vault.selectedCategoryId}
                  itemCountByCategory={vault.itemCountByCategory}
                  onSelect={vault.setSelectedCategoryId}
                  onDelete={(id) => void vault.deleteCategory(id)}
                  onAdd={(input) => void vault.addCategory(input)}
                  onEdit={(category) => setEditingCategoryId(category.id)}
                />
              )}
            </ScrollReveal>
          </>
        ) : mainView === 'trash' ? (
          <TrashPanel
            items={vault.trashedItems}
            notes={vault.trashedNotes}
            documents={docs.trashedDocuments}
            categories={vault.categories}
            onRestoreItem={(item) => void vault.restoreItem(item)}
            onPurgeItem={(item) =>
              setPurgeTarget({ kind: 'item', id: item.id, name: item.title })
            }
            onRestoreNote={(note) => void vault.restoreNote(note)}
            onPurgeNote={(note) =>
              setPurgeTarget({
                kind: 'note',
                id: note.id,
                name: note.title.trim() || 'Untitled note',
              })
            }
            onRestoreDoc={(doc) => void docs.restoreDocument(doc)}
            onPurgeDoc={(doc) =>
              setPurgeTarget({ kind: 'document', id: doc.id, name: doc.name })
            }
          />
        ) : mainView === 'notes' ? (
          <Suspense fallback={null}>
            <NotesPanel
              notes={vault.notes}
              onAddNote={vault.addNote}
              onOpenNote={handleOpenNote}
              onDeleteNote={(id) => void vault.deleteNote(id)}
            />
          </Suspense>
        ) : (
          <Suspense fallback={null}>
            <DocumentsPanel
              documents={docs.documents}
              loading={docs.loading}
              message={docs.message}
              onOpenDoc={handleOpenDoc}
              onOpenUploader={() => setDocUploadOpen(true)}
              onDelete={docs.removeDocument}
              onDismissMessage={() => docs.setMessage('')}
            />
          </Suspense>
        )}
      </div>

      <AppDock
        categories={vault.categories}
        selectedCategoryId={vault.selectedCategoryId}
        onSelect={(id) => {
          goToSection('vault')
          vault.setSelectedCategoryId(id)
        }}
        celebrateCategoryId={celebration?.id ?? null}
        celebrateToken={celebration?.token}
        notesActive={mainView === 'notes'}
        onSelectNotes={() => goToSection('notes')}
        docsActive={mainView === 'documents'}
        onSelectDocs={() => goToSection('documents')}
        trashActive={mainView === 'trash'}
        onSelectTrash={() => goToSection('trash')}
      />

      {mainView !== 'trash' ? (
        <CaptureFab
          categories={vault.categories}
          defaultCategoryId={vault.selectedCategoryId}
          quickAdd={quickAdd}
          onSubmit={(input) => void vault.addItem(input)}
          onSaved={(categoryId) => setCelebration({ id: categoryId, token: Date.now() })}
          initialPhotoFile={sharedPhoto}
          openToken={sharedPhotoToken}
          onQuickAddNote={handleQuickAddNote}
          onQuickAddDocument={handleQuickAddDocument}
          existingItems={vault.items}
          onViewExistingItem={(id) => handleOpenItem(id)}
        />
      ) : null}

      <Suspense fallback={null}>
        <DocumentUploader
          open={docUploadOpen}
          uploading={docs.uploading}
          onClose={() => setDocUploadOpen(false)}
          onUpload={async (file, name, category) => {
            const result = await docs.addDocument(file, name, category)
            if (result) {
              setDocUploadOpen(false)
            }
          }}
        />
      </Suspense>

      <ConfirmDialog
        open={!!purgeTarget}
        title="Delete forever?"
        message={
          purgeTarget ? (
            <>
              <span className="font-semibold text-ink">{purgeTarget.name}</span> will be
              permanently removed from Raj&apos;s Vault — its record and (if any) its private
              storage file. This cannot be undone.
            </>
          ) : (
            ''
          )
        }
        confirmLabel="Delete forever"
        busy={purgeBusy}
        busyLabel="Deleting…"
        onCancel={() => {
          if (!purgeBusy) {
            setPurgeTarget(null)
          }
        }}
        onConfirm={() =>
          void (async () => {
            setPurgeBusy(true)
            const ok = await handlePurgeTarget()
            setPurgeBusy(false)
            if (ok) {
              setPurgeTarget(null)
            }
          })()
        }
      />

      <Suspense fallback={null}>
        <ItemDetailOverlay
          item={openItem}
          categories={vault.categories}
          category={vault.categories.find((category) => category.id === openItem?.category_id)}
          onClose={handleDismissOverlay}
          onToggle={(item) => void vault.toggleItem(item)}
          onDelete={async (id) => {
            const ok = await vault.deleteItem(id)
            if (ok) {
              handleDismissOverlay()
            }
          }}
          onUpdate={(itemId, input) => void vault.updateItem(itemId, input)}
        />

        <CategoryEditor
          key={editingCategoryId ?? 'none'}
          category={editingCategory}
          onClose={() => setEditingCategoryId(null)}
          onSave={(id, name, icon, color, fields) =>
            void vault.updateCategory(id, name, icon, color, fields)
          }
        />

        <NoteDetailOverlay
          note={openNote}
          onClose={handleDismissOverlay}
          onDelete={async () => {
            if (openNote) {
              const ok = await vault.deleteNote(openNote.id)
              if (ok) {
                handleDismissOverlay()
              }
            }
          }}
          onUpdate={async (patch) => {
            if (openNote) {
              await vault.updateNote(openNote.id, patch)
            }
          }}
        />

        <DocumentViewer
          doc={openDoc}
          onClose={handleDismissOverlay}
          onDelete={docs.removeDocument}
          onUpdate={docs.updateDocument}
        />
      </Suspense>
    </main>
  );
}
