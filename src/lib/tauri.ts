import { invoke as tauriInvoke } from '@tauri-apps/api/core'
import type { AppSettings, NoteDocument, NoteMeta, SearchResult } from '../types'
import { createMarkdownFilename, defaultNoteBody, frontmatterFor, parseFrontmatter } from '../core/notes'
import { rankNotes } from '../core/search'

const isNative = '__TAURI_INTERNALS__' in window
const NOTES_KEY = 'quicknote.mock.notes'
const SETTINGS_KEY = 'quicknote.mock.settings'

export async function command<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  if (isNative) {
    return tauriInvoke<T>(name, args)
  }

  return mockCommand<T>(name, args)
}

function readMockNotes(): NoteDocument[] {
  const raw = localStorage.getItem(NOTES_KEY)
  if (raw) return JSON.parse(raw) as NoteDocument[]

  const now = new Date().toISOString()
  const filename = createMarkdownFilename(now, 'today')
  const starter: NoteDocument = {
    meta: {
      id: filename,
      title: 'Today Quick Note',
      path: filename,
      created: now,
      updated: now,
      pinned: true,
      tags: ['daily'],
      excerpt: 'Start typing. QuickNote saves after a short pause.',
    },
    body: defaultNoteBody(),
  }
  writeMockNotes([starter])
  return [starter]
}

function writeMockNotes(notes: NoteDocument[]) {
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes))
}

function readMockSettings(): AppSettings {
  const raw = localStorage.getItem(SETTINGS_KEY)
  if (raw) return JSON.parse(raw) as AppSettings
  return {
    theme: 'system',
    fontSize: 16,
    fontFamily: 'sans',
    monoFontFamily: 'jetbrains',
    noteDirectory: '~/QuickNotes',
    globalShortcut: 'Alt+Space',
    hideOnBlur: true,
    smoothCaret: true,
    typewriterScroll: true,
  }
}

async function mockCommand<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const notes = readMockNotes()

  switch (name) {
    case 'list_notes':
      return notes.map((note) => note.meta) as T
    case 'read_note': {
      const id = String(args?.id)
      return (notes.find((note) => note.meta.id === id) ?? notes[0]) as T
    }
    case 'create_note': {
      const now = new Date().toISOString()
      const filename = createMarkdownFilename(now, 'quick-note')
      const note: NoteDocument = {
        meta: {
          id: filename,
          title: 'Untitled',
          path: filename,
          created: now,
          updated: now,
          pinned: false,
          tags: [],
          excerpt: '',
        },
        body: '',
      }
      writeMockNotes([note, ...notes])
      return note as T
    }
    case 'save_note': {
      const id = String(args?.id)
      const body = String(args?.body ?? '')
      const index = notes.findIndex((note) => note.meta.id === id)
      if (index < 0) throw new Error(`Unknown note ${id}`)
      const parsed = parseFrontmatter(`${frontmatterFor(notes[index]!.meta)}\n${body}`)
      const updated: NoteDocument = {
        meta: {
          ...notes[index]!.meta,
          title: parsed.title,
          pinned: parsed.pinned,
          tags: parsed.tags,
          updated: new Date().toISOString(),
          excerpt: body.replace(/\s+/g, ' ').trim().slice(0, 140),
        },
        body,
      }
      const copy = notes.slice()
      copy[index] = updated
      writeMockNotes(copy)
      return updated.meta as T
    }
    case 'search_notes':
      return rankNotes(notes.map((note) => ({ ...note.meta, body: note.body })), String(args?.query ?? '')) as T
    case 'get_settings':
      return readMockSettings() as T
    case 'update_settings': {
      const next = { ...readMockSettings(), ...(args?.settings as Partial<AppSettings>) }
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
      return next as T
    }
    case 'toggle_window':
    case 'set_window_pinned':
    case 'choose_notes_dir':
      return undefined as T
    default:
      throw new Error(`Mock command not implemented: ${name}`)
  }
}

export type { NoteDocument, NoteMeta, SearchResult }
