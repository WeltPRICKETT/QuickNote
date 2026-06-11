import { create } from 'zustand'
import { eventBus } from '../core/events'
import { command } from '../lib/tauri'
import type { NoteDocument, NoteMeta, SearchResult } from '../types'

interface AppState {
  notes: NoteMeta[]
  currentNote?: NoteDocument
  commandOpen: boolean
  switcherOpen: boolean
  settingsOpen: boolean
  focusMode: boolean
  pinned: boolean
  saving: boolean
  lastSavedAt?: string
  boot: () => Promise<void>
  createNote: () => Promise<void>
  openNote: (id: string) => Promise<void>
  saveCurrent: (body: string) => Promise<void>
  search: (query: string) => Promise<SearchResult[]>
  setCommandOpen: (open: boolean) => void
  setSwitcherOpen: (open: boolean) => void
  setSettingsOpen: (open: boolean) => void
  toggleFocusMode: () => void
  togglePinned: () => Promise<void>
}

export const useAppStore = create<AppState>((set, get) => ({
  notes: [],
  commandOpen: false,
  switcherOpen: false,
  settingsOpen: false,
  focusMode: false,
  pinned: false,
  saving: false,

  async boot() {
    const notes = await command<NoteMeta[]>('list_notes')
    set({ notes })
    if (notes[0]) {
      await get().openNote(notes[0].id)
    } else {
      await get().createNote()
    }
  },

  async createNote() {
    const note = await command<NoteDocument>('create_note')
    const notes = await command<NoteMeta[]>('list_notes')
    set({ currentNote: note, notes })
    eventBus.emit('note:created', { id: note.meta.id })
  },

  async openNote(id) {
    const note = await command<NoteDocument>('read_note', { id })
    set({ currentNote: note, switcherOpen: false, commandOpen: false })
  },

  async saveCurrent(body) {
    const current = get().currentNote
    if (!current) return
    set({ saving: true, currentNote: { ...current, body } })
    const meta = await command<NoteMeta>('save_note', { id: current.meta.id, body })
    const notes = get().notes.map((note) => (note.id === meta.id ? meta : note))
    set({
      notes,
      currentNote: { meta, body },
      saving: false,
      lastSavedAt: new Date().toISOString(),
    })
    eventBus.emit('note:saved', { id: meta.id })
  },

  search(query) {
    return command<SearchResult[]>('search_notes', { query })
  },

  setCommandOpen(open) {
    set({ commandOpen: open, switcherOpen: false, settingsOpen: false })
  },

  setSwitcherOpen(open) {
    set({ switcherOpen: open, commandOpen: false, settingsOpen: false })
  },

  setSettingsOpen(open) {
    set({ settingsOpen: open, commandOpen: false, switcherOpen: false })
  },

  toggleFocusMode() {
    set((state) => ({ focusMode: !state.focusMode }))
  },

  async togglePinned() {
    const pinned = !get().pinned
    await command<void>('set_window_pinned', { pinned })
    set({ pinned })
  },
}))
