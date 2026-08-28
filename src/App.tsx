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
import { VerticalSerial } from './components/VerticalSerial'
import type { VaultDocument, VaultItem } from './types/app'
import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react'

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
  const [mainView, setMainView] = useState<'vault' | 'notes' | 'documents'>('vault')
  const [showLanding, setShowLanding] = useState(true)
  // Track whether documents have been loaded for the current session
  const docsLoadedRef = useRef(false)

  // ---------------------------------------------------------------------------
  // Unified Overlay History Architecture
  // Ensures hardware/browser Back button closes open overlays first without
  // leaving stale history entries or closing the PWA unexpectedly.
  // ---------------------------------------------------------------------------
  const closeAllOverlays = useCallback(() => {
    setOpenItemId(null)
    setOpenNoteId(null)
    setOpenDocId(null)
  }, [])

  const handleDismissOverlay = useCallback(() => {
    if (window.history.state?.vaultOverlay) {
      window.history.back()
    } else {
      closeAllOverlays()
    }
  }, [closeAllOverlays])

  const handleOpenItem = useCallback((id: string) => {
    if (!window.history.state?.vaultOverlay) {
      window.history.pushState({ vaultOverlay: true }, '')
    }
    setOpenItemId(id)
    setOpenNoteId(null)
    setOpenDocId(null)
  }, [])

  const handleOpenNote = useCallback((id: string) => {
    if (!window.history.state?.vaultOverlay) {
      window.history.pushState({ vaultOverlay: true }, '')
    }
    setOpenNoteId(id)
    setOpenItemId(null)
    setOpenDocId(null)
  }, [])

  const handleOpenDoc = useCallback((doc: VaultDocument) => {
    if (!window.history.state?.vaultOverlay) {
      window.history.pushState({ vaultOverlay: true }, '')
    }
    setOpenDocId(doc.id)
    setOpenItemId(null)
    setOpenNoteId(null)
  }, [])

  useEffect(() => {
    const handlePopState = () => {
      closeAllOverlays()
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

  // Load documents when the user navigates to the Documents tab (lazy — only once per session).
  // If already loaded (docsLoadedRef.current), skip to avoid redundant fetches.
  useEffect(() => {
    if (mainView !== 'documents') return
    if (docsLoadedRef.current) return
    if (!vault.session?.user?.id || devPreview) return
    docsLoadedRef.current = true
    void docs.load()
  }, [mainView, vault.session?.user?.id, devPreview, docs])

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

  return (
    <main className="relative min-h-screen pb-32">
      <Atmosphere activeCategory={activeCategory} />
      <ScrollProgress />
      <VerticalSerial label="RAJ'S — VAULT 01" />
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

        {mainView === 'vault' ? (
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
              uploading={docs.uploading}
              message={docs.message}
              onOpenDoc={handleOpenDoc}
              onUpload={async (file, name, category) => docs.addDocument(file, name, category)}
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
          setMainView('vault');
          vault.setSelectedCategoryId(id);
        }}
        celebrateCategoryId={celebration?.id ?? null}
        celebrateToken={celebration?.token}
        notesActive={mainView === 'notes'}
        onSelectNotes={() => setMainView('notes')}
        docsActive={mainView === 'documents'}
        onSelectDocs={() => setMainView('documents')}
      />

      {mainView === 'vault' ? (
        <CaptureFab
          categories={vault.categories}
          defaultCategoryId={vault.selectedCategoryId}
          onSubmit={(input) => void vault.addItem(input)}
          onSaved={(categoryId) => setCelebration({ id: categoryId, token: Date.now() })}
          initialPhotoFile={sharedPhoto}
          openToken={sharedPhotoToken}
        />
      ) : null}

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
        />
      </Suspense>
    </main>
  );
}
