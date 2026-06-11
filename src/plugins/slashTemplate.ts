import { Prec } from '@codemirror/state'
import { keymap } from '@codemirror/view'
import { registerEditorExtension } from '../core/extensions'

registerEditorExtension({
  manifest: {
    id: 'quicknote.slash-template',
    name: 'Slash Template',
    description: 'Insert a lightweight daily-note template from the editor.',
    enabledByDefault: true,
  },
  codeMirror: () => [
    Prec.highest(
      keymap.of([
        {
          key: 'Mod-/',
          run(view) {
            const template = '- [ ] \n- Context: \n- Next: '
            view.dispatch(view.state.replaceSelection(template))
            return true
          },
        },
      ]),
    ),
  ],
})
