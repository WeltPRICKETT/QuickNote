import type { Extension } from '@codemirror/state'
import type { ExtensionManifest } from '../types'

export interface EditorExtension {
  manifest: ExtensionManifest
  codeMirror?: () => Extension[]
  activate?: () => void
  deactivate?: () => void
}

const registry = new Map<string, EditorExtension>()

export function registerEditorExtension(extension: EditorExtension) {
  registry.set(extension.manifest.id, extension)
}

export function getEnabledEditorExtensions(enabledIds: string[]) {
  return Array.from(registry.values()).filter(
    (extension) => extension.manifest.enabledByDefault || enabledIds.includes(extension.manifest.id),
  )
}

export function listEditorExtensions() {
  return Array.from(registry.values()).map((extension) => extension.manifest)
}
