import { HighlightStyle, syntaxHighlighting, syntaxTree } from '@codemirror/language'
import type { Extension, Range } from '@codemirror/state'
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from '@codemirror/view'
import { tags as t } from '@lezer/highlight'
import type { SyntaxNodeRef } from '@lezer/common'

/**
 * Obsidian-style live preview for Markdown.
 *
 * Lines the cursor is not on are rendered: syntax markers are hidden and
 * replaced with typographic styling, interactive widgets (task checkboxes,
 * horizontal rules, list bullets) or clickable links. The line under the
 * cursor reveals its raw Markdown source so editing stays plain-text.
 */
export function livePreview(): Extension {
  return [previewPlugin, previewEventHandlers, syntaxHighlighting(codeHighlight)]
}

const previewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view)
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = buildDecorations(update.view)
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
)

const previewEventHandlers = EditorView.domEventHandlers({
  mousedown(event, view) {
    const target = event.target as HTMLElement
    const checkbox = target.closest('.cm-task-toggle')
    if (checkbox instanceof HTMLElement) {
      event.preventDefault()
      return toggleTaskAt(view, view.posAtDOM(checkbox))
    }
    const link = target.closest('.cm-md-link')
    if (link instanceof HTMLElement && (event.ctrlKey || event.metaKey)) {
      const url = link.dataset.url
      if (url) {
        event.preventDefault()
        window.open(url, '_blank', 'noopener,noreferrer')
        return true
      }
    }
    return false
  },
})

function toggleTaskAt(view: EditorView, pos: number) {
  const token = view.state.sliceDoc(pos, pos + 3)
  if (!/^\[[ xX]\]$/.test(token)) return false
  const checked = token !== '[ ]'
  view.dispatch({
    changes: { from: pos, to: pos + 3, insert: checked ? '[ ]' : '[x]' },
    userEvent: 'input.toggle-task',
  })
  return true
}

// ── Widgets ─────────────────────────────────────────────────────────────────

class BulletWidget extends WidgetType {
  eq() {
    return true
  }

  toDOM() {
    const span = document.createElement('span')
    span.className = 'cm-bullet'
    span.textContent = '•'
    return span
  }

  ignoreEvent() {
    return true
  }
}

class CheckboxWidget extends WidgetType {
  readonly checked: boolean

  constructor(checked: boolean) {
    super()
    this.checked = checked
  }

  eq(other: CheckboxWidget) {
    return other.checked === this.checked
  }

  toDOM() {
    const span = document.createElement('span')
    span.className = this.checked ? 'cm-task-toggle is-checked' : 'cm-task-toggle'
    span.setAttribute('role', 'checkbox')
    span.setAttribute('aria-checked', String(this.checked))
    span.innerHTML =
      '<svg viewBox="0 0 16 16" aria-hidden="true">' +
      '<rect class="cm-task-box" x="1.5" y="1.5" width="13" height="13" rx="4"/>' +
      '<path class="cm-task-check" d="M4.5 8.5l2.4 2.4 4.6-5.4"/>' +
      '</svg>'
    return span
  }

  ignoreEvent() {
    return false
  }
}

class HorizontalRuleWidget extends WidgetType {
  eq() {
    return true
  }

  toDOM() {
    const span = document.createElement('span')
    span.className = 'cm-hr'
    return span
  }

  ignoreEvent() {
    return true
  }
}

const bulletWidget = new BulletWidget()
const hrWidget = new HorizontalRuleWidget()
const hide = Decoration.replace({})

// ── Decoration builder ──────────────────────────────────────────────────────

function buildDecorations(view: EditorView): DecorationSet {
  const { state } = view
  const decorations: Range<Decoration>[] = []
  const tree = syntaxTree(state)

  const touches = (from: number, to: number) =>
    state.selection.ranges.some((range) => range.from <= to && range.to >= from)

  const lineTouched = (pos: number) => {
    const line = state.doc.lineAt(pos)
    return touches(line.from, line.to)
  }

  const hideRange = (from: number, to: number) => {
    if (to > from) decorations.push(hide.range(from, to))
  }

  /** Hide a marker plus a single trailing space, when present. */
  const hideMarkAndSpace = (from: number, to: number) => {
    const next = state.sliceDoc(to, to + 1)
    hideRange(from, next === ' ' ? to + 1 : to)
  }

  for (const { from, to } of view.visibleRanges) {
    tree.iterate({
      from,
      to,
      enter: (node) => {
        const name = node.name

        if (name.startsWith('ATXHeading')) {
          const level = Number(name.slice('ATXHeading'.length)) || 1
          const line = state.doc.lineAt(node.from)
          decorations.push(
            Decoration.line({ class: `cm-heading cm-h${level}` }).range(line.from),
          )
          if (!touches(line.from, line.to)) {
            const mark = node.node.getChild('HeaderMark')
            if (mark) hideMarkAndSpace(mark.from, mark.to)
          }
          return
        }

        switch (name) {
          case 'SetextHeading1':
          case 'SetextHeading2': {
            const line = state.doc.lineAt(node.from)
            decorations.push(
              Decoration.line({ class: `cm-heading cm-h${name.endsWith('1') ? 1 : 2}` }).range(line.from),
            )
            return
          }

          case 'Emphasis':
          case 'StrongEmphasis': {
            decorations.push(
              Decoration.mark({ class: name === 'Emphasis' ? 'cm-em' : 'cm-strong' }).range(node.from, node.to),
            )
            if (!touches(node.from, node.to)) {
              for (const mark of node.node.getChildren('EmphasisMark')) hideRange(mark.from, mark.to)
            }
            return
          }

          case 'InlineCode': {
            decorations.push(Decoration.mark({ class: 'cm-inline-code' }).range(node.from, node.to))
            if (!touches(node.from, node.to)) {
              for (const mark of node.node.getChildren('CodeMark')) hideRange(mark.from, mark.to)
            }
            return
          }

          case 'Strikethrough': {
            decorations.push(Decoration.mark({ class: 'cm-strike' }).range(node.from, node.to))
            if (!touches(node.from, node.to)) {
              for (const mark of node.node.getChildren('StrikethroughMark')) hideRange(mark.from, mark.to)
            }
            return
          }

          case 'Link':
          case 'Image': {
            decorateLink(node)
            return
          }

          case 'URL': {
            // Bare autolinks keep their own muted styling.
            if (node.node.parent?.name !== 'Link' && node.node.parent?.name !== 'Image') {
              decorations.push(Decoration.mark({ class: 'cm-md-autolink' }).range(node.from, node.to))
            }
            return
          }

          case 'Blockquote': {
            const first = state.doc.lineAt(node.from).number
            const last = state.doc.lineAt(node.to).number
            for (let lineNumber = first; lineNumber <= last; lineNumber++) {
              decorations.push(Decoration.line({ class: 'cm-quote' }).range(state.doc.line(lineNumber).from))
            }
            for (const mark of node.node.getChildren('QuoteMark')) {
              if (!lineTouched(mark.from)) hideMarkAndSpace(mark.from, mark.to)
            }
            return
          }

          case 'ListMark': {
            const markText = state.sliceDoc(node.from, node.to)
            const isTaskItem = node.node.nextSibling?.name === 'Task'
            if (lineTouched(node.from)) return
            if (isTaskItem) {
              // The checkbox widget replaces the marker; hide the bullet.
              hideMarkAndSpace(node.from, node.to)
            } else if (/^[-*+]$/.test(markText)) {
              decorations.push(
                Decoration.replace({ widget: bulletWidget }).range(node.from, node.to),
              )
            } else {
              decorations.push(Decoration.mark({ class: 'cm-list-number' }).range(node.from, node.to))
            }
            return
          }

          case 'TaskMarker': {
            const checked = state.sliceDoc(node.from, node.to).toLowerCase() !== '[ ]'
            const line = state.doc.lineAt(node.from)
            if (checked) {
              decorations.push(Decoration.line({ class: 'cm-task-done' }).range(line.from))
              if (node.to + 1 <= line.to) {
                decorations.push(Decoration.mark({ class: 'cm-task-done-text' }).range(node.to + 1, line.to))
              }
            }
            if (!touches(line.from, line.to)) {
              decorations.push(
                Decoration.replace({ widget: new CheckboxWidget(checked) }).range(node.from, node.to),
              )
            }
            return
          }

          case 'FencedCode': {
            const first = state.doc.lineAt(node.from).number
            const last = state.doc.lineAt(node.to).number
            for (let lineNumber = first; lineNumber <= last; lineNumber++) {
              const classes = ['cm-codeblock']
              if (lineNumber === first) classes.push('cm-codeblock-begin')
              if (lineNumber === last) classes.push('cm-codeblock-end')
              decorations.push(
                Decoration.line({ class: classes.join(' ') }).range(state.doc.line(lineNumber).from),
              )
            }
            const info = node.node.getChild('CodeInfo')
            if (info) decorations.push(Decoration.mark({ class: 'cm-code-info' }).range(info.from, info.to))
            for (const mark of node.node.getChildren('CodeMark')) {
              decorations.push(Decoration.mark({ class: 'cm-code-fence' }).range(mark.from, mark.to))
            }
            return
          }

          case 'HorizontalRule': {
            const line = state.doc.lineAt(node.from)
            decorations.push(Decoration.line({ class: 'cm-hr-line' }).range(line.from))
            if (!touches(line.from, line.to)) {
              decorations.push(Decoration.replace({ widget: hrWidget }).range(line.from, line.to))
            }
            return
          }

          case 'Paragraph': {
            decorateHighlights(node)
            return
          }
        }
      },
    })
  }

  return Decoration.set(decorations, true)

  function decorateLink(node: SyntaxNodeRef) {
    const url = node.node.getChild('URL')
    const marks = node.node.getChildren('LinkMark')
    const href = url ? state.sliceDoc(url.from, url.to) : ''
    decorations.push(
      Decoration.mark({
        class: node.name === 'Image' ? 'cm-md-link cm-md-image' : 'cm-md-link',
        attributes: { 'data-url': href, title: href ? `${href} (Ctrl+Click)` : '' },
      }).range(node.from, node.to),
    )
    if (touches(node.from, node.to)) return
    // Hide `[`/`]` plus everything from `(` to `)` — keeps only the label.
    for (const mark of marks) hideRange(mark.from, mark.to)
    if (url) hideRange(url.from, url.to)
    const title = node.node.getChild('LinkTitle')
    if (title) hideRange(title.from, title.to)
  }

  /** `==highlight==` is not part of GFM; render it with a lightweight scan. */
  function decorateHighlights(node: SyntaxNodeRef) {
    const text = state.sliceDoc(node.from, node.to)
    const pattern = /==([^=\n]+)==/g
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) {
      const from = node.from + match.index
      const to = from + match[0].length
      decorations.push(Decoration.mark({ class: 'cm-mark-highlight' }).range(from, to))
      if (!touches(from, to)) {
        hideRange(from, from + 2)
        hideRange(to - 2, to)
      }
    }
  }
}

// ── Code syntax highlighting (fenced blocks) ────────────────────────────────

const codeHighlight = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.moduleKeyword, t.operatorKeyword], color: 'var(--code-keyword)' },
  { tag: [t.string, t.special(t.string), t.regexp], color: 'var(--code-string)' },
  { tag: [t.comment, t.blockComment, t.lineComment], color: 'var(--code-comment)', fontStyle: 'italic' },
  { tag: [t.number, t.bool, t.atom, t.null], color: 'var(--code-number)' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: 'var(--code-function)' },
  { tag: [t.className, t.typeName, t.namespace], color: 'var(--code-type)' },
  { tag: [t.propertyName, t.attributeName, t.definition(t.variableName)], color: 'var(--code-property)' },
  { tag: [t.operator, t.punctuation, t.bracket], color: 'var(--code-punctuation)' },
  { tag: [t.meta, t.processingInstruction], color: 'var(--text-faint)' },
  { tag: t.monospace, fontFamily: 'var(--font-mono)' },
])
