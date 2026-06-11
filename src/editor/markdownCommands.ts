import { EditorSelection } from '@codemirror/state'
import { type Command, type KeyBinding, keymap } from '@codemirror/view'
import { Prec } from '@codemirror/state'
import type { Extension } from '@codemirror/state'

/**
 * Editing commands for Markdown: inline-mark toggles (bold, italic, inline
 * code, strikethrough, highlight), heading cycling and task toggling.
 */
export function markdownEditingKeymap(): Extension {
  return Prec.high(keymap.of(bindings))
}

const bindings: KeyBinding[] = [
  { key: 'Mod-b', run: toggleInlineMark('**') },
  { key: 'Mod-i', run: toggleInlineMark('*') },
  { key: 'Mod-e', run: toggleInlineMark('`') },
  { key: 'Mod-Shift-x', run: toggleInlineMark('~~') },
  { key: 'Mod-Shift-h', run: toggleInlineMark('==') },
  { key: 'Mod-Shift-c', run: toggleTaskLine },
  { key: 'Mod-Shift-1', run: setHeading(1) },
  { key: 'Mod-Shift-2', run: setHeading(2) },
  { key: 'Mod-Shift-3', run: setHeading(3) },
]

/** Wrap the selection in `marker`, or unwrap when already wrapped. */
function toggleInlineMark(marker: string): Command {
  return (view) => {
    const length = marker.length
    const transaction = view.state.changeByRange((range) => {
      const { from, to } = range
      const before = view.state.sliceDoc(Math.max(0, from - length), from)
      const after = view.state.sliceDoc(to, to + length)
      if (before === marker && after === marker) {
        return {
          changes: [
            { from: from - length, to: from },
            { from: to, to: to + length },
          ],
          range: EditorSelection.range(from - length, to - length),
        }
      }
      const selected = view.state.sliceDoc(from, to)
      if (selected.startsWith(marker) && selected.endsWith(marker) && selected.length >= length * 2) {
        return {
          changes: [
            { from, to: from + length },
            { from: to - length, to },
          ],
          range: EditorSelection.range(from, to - length * 2),
        }
      }
      return {
        changes: [
          { from, insert: marker },
          { from: to, insert: marker },
        ],
        range: EditorSelection.range(from + length, to + length),
      }
    })
    view.dispatch(transaction, { scrollIntoView: true, userEvent: 'input' })
    return true
  }
}

/** Cycle the current line through `- [ ]` → `- [x]` → plain text. */
function toggleTaskLine(view: Parameters<Command>[0]) {
  const transaction = view.state.changeByRange((range) => {
    const line = view.state.doc.lineAt(range.head)
    const text = line.text
    const taskMatch = /^(\s*)[-*+] \[([ xX])\] /.exec(text)
    if (taskMatch) {
      const indentLength = taskMatch[1]?.length ?? 0
      const checked = taskMatch[2] !== ' '
      if (!checked) {
        const markerPos = line.from + taskMatch[0].length - 3
        return {
          changes: { from: markerPos - 1, to: markerPos, insert: 'x' },
          range,
        }
      }
      const prefixEnd = line.from + taskMatch[0].length
      const removed = taskMatch[0].length - indentLength
      return {
        changes: { from: line.from + indentLength, to: prefixEnd },
        range: EditorSelection.cursor(Math.max(line.from, range.head - removed)),
      }
    }
    const listMatch = /^(\s*)([-*+] )/.exec(text)
    const indent = listMatch?.[1] ?? /^\s*/.exec(text)?.[0] ?? ''
    const insertAt = line.from + indent.length
    const insert = listMatch ? '[ ] ' : '- [ ] '
    const from = listMatch ? insertAt + (listMatch[2]?.length ?? 0) : insertAt
    return {
      changes: { from, insert },
      range: EditorSelection.cursor(range.head + insert.length),
    }
  })
  view.dispatch(transaction, { scrollIntoView: true, userEvent: 'input' })
  return true
}

/** Set the current line's heading level, or clear it when already at that level. */
function setHeading(level: number): Command {
  return (view) => {
    const transaction = view.state.changeByRange((range) => {
      const line = view.state.doc.lineAt(range.head)
      const match = /^(#{1,6}) /.exec(line.text)
      const prefix = '#'.repeat(level) + ' '
      if (match && match[1]?.length === level) {
        return {
          changes: { from: line.from, to: line.from + match[0].length },
          range: EditorSelection.cursor(Math.max(line.from, range.head - match[0].length)),
        }
      }
      const removed = match ? match[0].length : 0
      return {
        changes: { from: line.from, to: line.from + removed, insert: prefix },
        range: EditorSelection.cursor(range.head - removed + prefix.length),
      }
    })
    view.dispatch(transaction, { scrollIntoView: true, userEvent: 'input' })
    return true
  }
}
