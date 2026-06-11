import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { bracketMatching, indentOnInput } from '@codemirror/language'
import { languages } from '@codemirror/language-data'
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search'
import { Compartment, EditorState, type Extension } from '@codemirror/state'
import {
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  drawSelection,
  dropCursor,
  keymap,
  placeholder,
} from '@codemirror/view'
import { useEffect, useRef } from 'react'
import { livePreview } from '../editor/livePreview'
import { markdownEditingKeymap } from '../editor/markdownCommands'
import { getEnabledEditorExtensions } from '../core/extensions'
import '../plugins/slashTemplate'
import '../plugins/wordCount'
import { useAppStore } from '../stores/appStore'
import { useSettingsStore } from '../stores/settingsStore'

const fontCompartment = new Compartment()
const caretCompartment = new Compartment()
const typewriterCompartment = new Compartment()

export function EditorPane() {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const note = useAppStore((state) => state.currentNote)
  const noteId = note?.meta.id
  const saveCurrent = useAppStore((state) => state.saveCurrent)
  const fontSize = useSettingsStore((state) => state.fontSize)
  const typewriterScroll = useSettingsStore((state) => state.typewriterScroll)
  const smoothCaret = useSettingsStore((state) => state.smoothCaret)

  useEffect(() => {
    if (!hostRef.current || !noteId) return

    viewRef.current?.destroy()
    viewRef.current = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: useAppStore.getState().currentNote?.body ?? '',
        extensions: buildExtensions({
          save: saveCurrent,
          fontSize: useSettingsStore.getState().fontSize,
          smoothCaret: useSettingsStore.getState().smoothCaret,
          typewriterScroll: useSettingsStore.getState().typewriterScroll,
        }),
      }),
    })
    viewRef.current.focus()

    return () => {
      viewRef.current?.destroy()
      viewRef.current = null
    }
  }, [noteId, saveCurrent])

  // Reconfigure live settings without recreating the editor (keeps cursor + undo history).
  useEffect(() => {
    viewRef.current?.dispatch({
      effects: [
        fontCompartment.reconfigure(fontTheme(fontSize)),
        caretCompartment.reconfigure(caretTheme(smoothCaret)),
        typewriterCompartment.reconfigure(typewriterScroll ? typewriterScrollExtension() : []),
      ],
    })
  }, [fontSize, smoothCaret, typewriterScroll])

  useEffect(() => {
    if (!note || !viewRef.current) return
    const current = viewRef.current.state.doc.toString()
    if (current !== note.body) {
      viewRef.current.dispatch({
        changes: { from: 0, to: current.length, insert: note.body },
      })
    }
  }, [note])

  return <div className="editor-pane" ref={hostRef} />
}

interface EditorOptions {
  save: (body: string) => Promise<void>
  fontSize: number
  smoothCaret: boolean
  typewriterScroll: boolean
}

function buildExtensions(options: EditorOptions): Extension[] {
  const pluginExtensions = getEnabledEditorExtensions([]).flatMap(
    (extension) => extension.codeMirror?.() ?? [],
  )

  return [
    history(),
    drawSelection(),
    dropCursor(),
    indentOnInput(),
    bracketMatching(),
    highlightSelectionMatches(),
    placeholder('记录此刻 — Markdown 即写即渲染'),
    markdown({ base: markdownLanguage, codeLanguages: languages }),
    livePreview(),
    markdownEditingKeymap(),
    EditorView.lineWrapping,
    baseTheme,
    fontCompartment.of(fontTheme(options.fontSize)),
    caretCompartment.of(caretTheme(options.smoothCaret)),
    typewriterCompartment.of(options.typewriterScroll ? typewriterScrollExtension() : []),
    keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
    autosaveExtension(options.save),
    ...pluginExtensions,
  ]
}

const baseTheme = EditorView.theme({
  '&': { height: '100%' },
  '.cm-content': {
    caretColor: 'var(--accent)',
    fontFamily: 'var(--font-body)',
    lineHeight: '1.72',
    padding: '24px 36px 72px',
    maxWidth: 'var(--editor-measure, none)',
    margin: '0 auto',
  },
  '.cm-focused': { outline: 'none' },
  '.cm-line': { padding: '1.5px 0' },
  '.cm-scroller': { fontFamily: 'var(--font-body)' },
  '.cm-selectionBackground': { backgroundColor: 'var(--selection) !important' },
  '.cm-cursor': { borderLeftWidth: '2px', borderLeftColor: 'var(--accent)' },
  '.cm-placeholder': { color: 'var(--text-faint)' },
  '.cm-selectionMatch': { backgroundColor: 'var(--selection-match)' },
  '.cm-matchingBracket': {
    backgroundColor: 'transparent',
    outline: '1px solid var(--line-strong)',
    borderRadius: '2px',
  },
})

function fontTheme(fontSize: number) {
  return EditorView.theme({ '&': { fontSize: `${fontSize}px` } })
}

function caretTheme(smooth: boolean) {
  if (!smooth) return []
  return EditorView.theme({
    '.cm-cursor': { transition: 'left 70ms ease-out, top 70ms ease-out' },
  })
}

function autosaveExtension(save: (body: string) => Promise<void>) {
  return ViewPlugin.fromClass(
    class {
      timer: number | undefined

      update(update: ViewUpdate) {
        if (!update.docChanged) return
        window.clearTimeout(this.timer)
        this.timer = window.setTimeout(() => {
          void save(update.state.doc.toString())
        }, 500)
      }

      destroy() {
        window.clearTimeout(this.timer)
      }
    },
  )
}

function typewriterScrollExtension() {
  return EditorView.updateListener.of((update) => {
    if (!update.selectionSet || !update.docChanged) return
    const view = update.view
    requestAnimationFrame(() => {
      const line = view.lineBlockAt(view.state.selection.main.head)
      const target = line.top - view.scrollDOM.clientHeight / 2 + line.height
      view.scrollDOM.scrollTo({ top: Math.max(target, 0), behavior: 'smooth' })
    })
  })
}
