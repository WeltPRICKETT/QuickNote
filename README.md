# QuickNote

QuickNote is a cross-platform, global-hotkey Markdown capture app built with Tauri 2, React 18, TypeScript, Tailwind CSS 4, Zustand, and CodeMirror 6.

## Scripts

- `npm run dev` starts the Vite web shell.
- `npm run tauri:dev` starts the native Tauri app.
- `npm run typecheck` runs strict TypeScript checks.
- `npm run test` runs Vitest.
- `npm run build` builds the web assets.
- `npm run tauri:build` builds native bundles.

## Development Notes

The repository follows the phase plan in `QuickNote-Agent开发工作流指南.md`.

Rust is required for `tauri:dev` and `tauri:build`. The frontend can be developed and tested with Node alone, but native commands, global shortcuts, tray behavior, and packaging need a Rust toolchain plus platform bundling dependencies.

## License

QuickNote is open source under the MIT License.

## Portable Mode

Set `QUICKNOTE_PORTABLE=1` before launch to keep notes and settings under the executable resource `data` directory. The Windows release workflow still needs a final product decision on whether to ship a separate true single-file portable target or an NSIS installer with user-local data.
