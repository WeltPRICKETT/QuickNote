import { eventBus } from '../core/events'
import { registerEditorExtension } from '../core/extensions'

let unsubscribe: (() => void) | undefined

registerEditorExtension({
  manifest: {
    id: 'quicknote.word-count',
    name: 'Word Count Status',
    description: 'Broadcast note save events for status-bar metrics.',
    enabledByDefault: true,
  },
  activate() {
    unsubscribe = eventBus.on('note:saved', () => undefined)
  },
  deactivate() {
    unsubscribe?.()
  },
})
