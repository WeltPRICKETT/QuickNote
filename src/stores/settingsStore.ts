import { create } from 'zustand'
import { command } from '../lib/tauri'
import type { AppSettings, ThemeMode } from '../types'

interface SettingsState extends AppSettings {
  load: () => Promise<void>
  update: (settings: Partial<AppSettings>) => Promise<void>
  chooseNotesDirectory: () => Promise<string | null>
}

const defaults: AppSettings = {
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

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...defaults,

  async load() {
    const settings = await command<AppSettings>('get_settings')
    set(settings)
  },

  async update(settings) {
    const next = await command<AppSettings>('update_settings', {
      settings: { ...getSnapshot(get()), ...settings },
    })
    set(next)
  },

  async chooseNotesDirectory() {
    const directory = await command<string | null>('choose_notes_dir')
    if (!directory) return null
    await get().update({ noteDirectory: directory })
    return directory
  },
}))

export function resolvedTheme(theme: ThemeMode) {
  if (theme !== 'system') return theme
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'midnight' : 'paper'
}

function getSnapshot(state: SettingsState): AppSettings {
  const {
    theme,
    fontSize,
    fontFamily,
    monoFontFamily,
    noteDirectory,
    globalShortcut,
    hideOnBlur,
    smoothCaret,
    typewriterScroll,
  } = state

  return {
    theme,
    fontSize,
    fontFamily,
    monoFontFamily,
    noteDirectory,
    globalShortcut,
    hideOnBlur,
    smoothCaret,
    typewriterScroll,
  }
}
