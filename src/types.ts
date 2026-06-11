export type ThemeMode = 'system' | 'paper' | 'midnight' | 'classical' | 'cyber' | 'sakura' | 'forest'

export type FontFamily = 'sans' | 'serif' | 'kai' | 'mono'

export interface NoteMeta {
  id: string
  title: string
  path: string
  created: string
  updated: string
  pinned: boolean
  tags: string[]
  excerpt: string
}

export interface NoteDocument {
  meta: NoteMeta
  body: string
}

export interface SearchResult extends NoteMeta {
  score: number
}

export interface AppSettings {
  theme: ThemeMode
  fontSize: number
  fontFamily: FontFamily
  monoFontFamily: 'jetbrains' | 'system'
  noteDirectory: string
  globalShortcut: string
  hideOnBlur: boolean
  smoothCaret: boolean
  typewriterScroll: boolean
}

export interface ExtensionManifest {
  id: string
  name: string
  description: string
  enabledByDefault: boolean
}
