import { Suspense, lazy, useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Sparkles } from 'lucide-react'
import { useVault } from './hooks/useVault'
import { useMockVault } from './hooks/useMockVault'
import { consumeSharedPhoto } from './lib/shareTarget'
import { CategoryIcon } from './lib/icons'
import { AmbientBackground } from './components/AmbientBackground'
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
import type { Category } from './types/app'

// Modals opened on demand only — lazy-loaded to keep the initial bundle lean.
const ItemDetailOverlay = lazy(() =>
  import('./components/ItemDetailOverlay').then((mod) => ({ default: mod.ItemDetailOverlay })),
)
const CategoryFieldEditor = lazy(() =>
  import('./components/CategoryFieldEditor').then((mod) => ({ default: mod.CategoryFieldEditor })),
)
const NotesPanel = lazy(() =>
  import('./components/NotesPanel').then((mod) => ({ default: mod.NotesPanel })),
)

export default function App() {
  const realVault = useVault()
  const mockVault = useMockVault()
  const [devPreview, setDevPreview] = useState(false)
  const vault = devPreview ? mockVault : realVault
  const [openItemId, setOpenItemId] = useState<string | null>(null)
  const openItem = openItemId ? vault.items.find((item) => item.id === openItemId) ?? null : null
  const [editingFieldsFor, setEditingFieldsFor] = useState<Category | null>(null)
  const [celebration, setCelebration] = useState<{ id: string; token: number } | null>(null)
  const [sharedPhoto, setSharedPhoto] = useState<File | null>(null)
  const [sharedPhotoToken, setSharedPhotoToken] = useState(0)
  const [mainView, setMainView] = useState<'vault' | 'notes'>('vault')
  const [showLanding, setShowLanding] = useState(true)

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

  const handleSignOut = () => {
    if (devPreview) {
      setDevPreview(false)
    }
    void vault.signOut()
  }

  if (vault.checkingSession) {
    return (
      <main className="relative flex min-h-screen items-center justify-center">
        <AmbientBackground />
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
      <AmbientBackground activeCategory={activeCategory} />
      <ProgressiveBlur side="bottom" height={120} />

      <div className="mx-auto max-w-5xl px-4 pt-10 sm:px-6">
        <motion.header
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="term-panel term-brackets flex flex-col gap-4 rounded p-6 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-ink-soft">
              Raj&apos;s Vault
            </p>
            <ShimmerText
              as="h1"
              text="Capture it once. Find it when it matters."
              className="mt-1 block text-2xl font-bold uppercase leading-tight tracking-tight sm:text-3xl"
            />
            <p className="mt-2 text-sm text-ink-soft">
              <AnimatedNumber value={vault.items.length} className="font-semibold text-ink" />{' '}
              saved · <AnimatedNumber value={vault.doneCount} className="font-semibold text-ink" />{' '}
              done
            </p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="term-chip self-start rounded-full px-4 py-2 text-sm font-medium uppercase tracking-wide"
          >
            {devPreview ? 'Exit preview' : 'Sign out'}
          </button>
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
            <ScrollReveal className="mt-8">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold uppercase tracking-wide">Categories</h2>
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
                  onManageFields={setEditingFieldsFor}
                />
              )}
            </ScrollReveal>

            <div className="divider-dash mt-10" />

            <ScrollReveal className="mt-10">
              <h2 className="flex items-center gap-2 text-lg font-semibold uppercase tracking-wide">
                {activeCategory ? (
                  <>
                    <CategoryIcon icon={activeCategory.icon} color={activeCategory.color} size={20} />
                    {activeCategory.name}
                  </>
                ) : (
                  <>
                    <Sparkles size={20} className="text-ink-soft" />
                    Everything
                  </>
                )}
              </h2>
              <ItemGrid
                items={vault.selectedItems}
                categories={vault.categories}
                onOpen={(item) => setOpenItemId(item.id)}
                onToggle={(item) => void vault.toggleItem(item)}
              />
            </ScrollReveal>
          </>
        ) : (
          <Suspense fallback={null}>
            <NotesPanel
              notes={vault.notes}
              onAddNote={vault.addNote}
              onUpdateNote={vault.updateNote}
              onDeleteNote={vault.deleteNote}
            />
          </Suspense>
        )}
      </div>

      <AppDock
        categories={vault.categories}
        selectedCategoryId={vault.selectedCategoryId}
        onSelect={(id) => {
          setMainView('vault')
          vault.setSelectedCategoryId(id)
        }}
        celebrateCategoryId={celebration?.id ?? null}
        celebrateToken={celebration?.token}
        notesActive={mainView === 'notes'}
        onSelectNotes={() => setMainView('notes')}
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
          category={vault.categories.find((category) => category.id === openItem?.category_id)}
          onClose={() => setOpenItemId(null)}
          onToggle={(item) => void vault.toggleItem(item)}
          onDelete={(id) => void vault.deleteItem(id)}
        />

        <CategoryFieldEditor
          category={editingFieldsFor}
          onClose={() => setEditingFieldsFor(null)}
          onSave={(id, fields) => void vault.updateCategoryFields(id, fields)}
        />
      </Suspense>
    </main>
  )
}

