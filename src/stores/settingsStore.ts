import { create } from 'zustand'
import { command } from '../lib/tauri'
import type { AppSettings, ThemeMode } from '../types'

interface SettingsState extends AppSettings {
  load: () => Promise<void>
  update: (settings: Partial<AppSettings>) => Promise<void>
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
