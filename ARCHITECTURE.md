# QuickNote Architecture

QuickNote keeps UI, bridge, and native core responsibilities separated.

## Layers

- `src-tauri/src`: native core for file IO, window lifecycle, tray, global shortcuts, settings, and search.
- `src/lib/tauri.ts`: typed bridge wrapper. In native mode it calls Tauri commands; in browser mode it provides a localStorage mock so frontend work stays fast.
- `src/stores`: Zustand app and settings stores.
- `src/core`: shared TypeScript domain helpers, event bus, search ranking, note parsing, and editor extension registry.
- `src/components`: React UI.
- `src/plugins`: internal v1 plugins implemented against the extension registry.

## Data Model

Each note is a visible Markdown file named `YYYYMMDDHHmm-quick-note.md`. Metadata lives in YAML-like frontmatter:

```md
---
created: 2026-06-11T09:00:00.000Z
updated: 2026-06-11T09:00:00.000Z
pinned: false
tags: ["daily"]
---
```

The default directory is `~/QuickNotes`. In portable mode, native code uses `./data/notes` next to the executable resource directory.

## Extension Points

Internal extensions register through `registerEditorExtension`. They may contribute CodeMirror extensions plus lifecycle hooks. The event bus exposes `note:created`, `note:saved`, `app:shown`, `app:hidden`, and `settings:changed`.

External sandboxed JavaScript plugins are intentionally out of v1 scope, but the API boundary avoids putting app logic directly inside React components.
