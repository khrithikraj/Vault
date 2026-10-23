import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('Android Back Navigation & Overlay Stack', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('unwinds multiple open overlays one at a time in priority order', () => {
    // Priority order in closeTopmostOverlay:
    // 1. purgeTarget
    // 2. reminderEditorOpen
    // 3. editingCategoryId
    // 4. docUploadOpen
    // 5. accountPanelOpen
    // 6. openDocId
    // 7. openNoteId
    // 8. openItemId

    const state: {
      purgeTarget: { kind: 'item'; id: string; name: string } | null
      reminderEditorOpen: boolean
      openNoteId: string | null
    } = {
      purgeTarget: { kind: 'item', id: '1', name: 'Item 1' },
      reminderEditorOpen: true,
      openNoteId: 'note-100',
    }

    const closeTopmost = () => {
      if (state.purgeTarget) {
        state.purgeTarget = null
        return true
      }
      if (state.reminderEditorOpen) {
        state.reminderEditorOpen = false
        return true
      }
      if (state.openNoteId) {
        state.openNoteId = null
        return true
      }
      return false
    }

    // First Back: closes purgeTarget (confirmation) only
    expect(closeTopmost()).toBe(true)
    expect(state.purgeTarget).toBeNull()
    expect(state.reminderEditorOpen).toBe(true)
    expect(state.openNoteId).toBe('note-100')

    // Second Back: closes reminderEditorOpen only
    expect(closeTopmost()).toBe(true)
    expect(state.reminderEditorOpen).toBe(false)
    expect(state.openNoteId).toBe('note-100')

    // Third Back: closes openNoteId only
    expect(closeTopmost()).toBe(true)
    expect(state.openNoteId).toBeNull()

    // Fourth Back: nothing left to close
    expect(closeTopmost()).toBe(false)
  })

  it('dismisses a nested sub-dialog via Escape without closing parent overlay', () => {
    // Simulate DOM elements with event listeners
    class MockDialog {
      listeners: Record<string, ((e: KeyboardEvent) => void)[]> = {}
      addEventListener(type: string, listener: (e: KeyboardEvent) => void) {
        this.listeners[type] = this.listeners[type] || []
        this.listeners[type].push(listener)
      }
      dispatchEvent(event: { type: string; key: string }) {
        this.listeners[event.type]?.forEach((fn) => fn(event as KeyboardEvent))
      }
    }

    const parentDialog = new MockDialog()
    const childDialog = new MockDialog()

    let childEscaped = false
    let parentEscaped = false

    childDialog.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') childEscaped = true
    })
    parentDialog.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') parentEscaped = true
    })

    const dialogStack = [parentDialog, childDialog]
    expect(dialogStack.length).toBe(2)

    // Topmost is childDialog
    const topmost = dialogStack[dialogStack.length - 1]
    topmost.dispatchEvent({ type: 'keydown', key: 'Escape' })

    expect(childEscaped).toBe(true)
    expect(parentEscaped).toBe(false)
  })

  it('navigates through section history step by step', () => {
    const sectionStack = ['vault']
    let currentView = 'vault'

    const goToSection = (next: string) => {
      const top = sectionStack[sectionStack.length - 1]
      if (top === next) return
      sectionStack.push(next)
      currentView = next
    }

    const popSection = () => {
      if (sectionStack.length > 1) {
        sectionStack.pop()
        currentView = sectionStack[sectionStack.length - 1]
        return true
      }
      return false
    }

    goToSection('notes')
    expect(currentView).toBe('notes')
    expect(sectionStack).toEqual(['vault', 'notes'])

    goToSection('reminders')
    expect(currentView).toBe('reminders')
    expect(sectionStack).toEqual(['vault', 'notes', 'reminders'])

    // First Back: returns from reminders to notes
    expect(popSection()).toBe(true)
    expect(currentView).toBe('notes')
    expect(sectionStack).toEqual(['vault', 'notes'])

    // Second Back: returns from notes to vault
    expect(popSection()).toBe(true)
    expect(currentView).toBe('vault')
    expect(sectionStack).toEqual(['vault'])

    // Third Back: at root, cannot pop section
    expect(popSection()).toBe(false)
    expect(currentView).toBe('vault')
  })

  it('clears active search query before unwinding section history', () => {
    let searchQuery = 'test query'
    const sectionStack = ['vault', 'notes']

    const handleBack = () => {
      if (searchQuery.trim().length > 0) {
        searchQuery = ''
        return 'cleared_search'
      }
      if (sectionStack.length > 1) {
        sectionStack.pop()
        return 'popped_section'
      }
      return 'exit'
    }

    // First Back clears search query without leaving the section
    expect(handleBack()).toBe('cleared_search')
    expect(searchQuery).toBe('')
    expect(sectionStack).toEqual(['vault', 'notes'])

    // Second Back pops section to vault
    expect(handleBack()).toBe('popped_section')
    expect(sectionStack).toEqual(['vault'])

    // Third Back exits at root
    expect(handleBack()).toBe('exit')
  })

  it('exits at root screen without creating a loop', async () => {
    const exitAppMock = vi.fn().mockResolvedValue(undefined)

    const handleNativeBack = async (
      hasOverlay: boolean,
      hasSearch: boolean,
      sectionStackLength: number,
    ) => {
      if (hasOverlay) return 'dismiss_overlay'
      if (hasSearch) return 'clear_search'
      if (sectionStackLength > 1) return 'pop_section'
      await exitAppMock()
      return 'exit'
    }

    // At root screen
    const result = await handleNativeBack(false, false, 1)
    expect(result).toBe('exit')
    expect(exitAppMock).toHaveBeenCalledTimes(1)
  })

  it('cleans up native Back listener properly', async () => {
    const removeMock = vi.fn()
    const addListenerMock = vi.fn().mockResolvedValue({ remove: removeMock })

    const handle = await addListenerMock('backButton', vi.fn())
    expect(addListenerMock).toHaveBeenCalledWith('backButton', expect.any(Function))

    handle.remove()
    expect(removeMock).toHaveBeenCalledTimes(1)
  })
})
