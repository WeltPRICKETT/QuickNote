# Extending QuickNote

QuickNote v1 supports internal editor extensions. A hello-world extension takes about five minutes.

## 1. Create a plugin file

```ts
import { keymap } from '@codemirror/view'
import { registerEditorExtension } from './core/extensions'

registerEditorExtension({
  manifest: {
    id: 'example.hello-world',
    name: 'Hello World',
    description: 'Inserts a greeting into the current note.',
    enabledByDefault: true,
  },
  codeMirror: () => [
    keymap.of([
      {
        key: 'Mod-Shift-H',
        run(view) {
          view.dispatch(view.state.replaceSelection('Hello, QuickNote.'))
          return true
        },
      },
    ]),
  ],
})
```

## 2. Import it once

Import the file from `src/components/EditorPane.tsx` or a plugin loader module:

```ts
import '../plugins/helloWorld'
```

## 3. Use lifecycle events

```ts
import { eventBus } from './core/events'

const unsubscribe = eventBus.on('note:saved', ({ id }) => {
  console.log('saved', id)
})
```

Call `unsubscribe()` in `deactivate` when the extension is disabled.

## Rules

- Keep extensions single-purpose.
- Add a manifest with a stable id, user-facing name, and description.
- Use CodeMirror APIs for editor behavior.
- Do not write files from UI code; call a typed Tauri command instead.
