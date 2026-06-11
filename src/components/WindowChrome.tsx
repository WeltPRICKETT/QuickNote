import { getCurrentWindow } from '@tauri-apps/api/window'
import { Maximize2, Minus, PanelLeft, Pin, PinOff, Search, Settings, Sparkles, X } from 'lucide-react'
import { command } from '../lib/tauri'
import { useAppStore } from '../stores/appStore'
import { useGroupStore } from '../stores/groupStore'

const isTauriRuntime = '__TAURI_INTERNALS__' in window

function currentWindow() {
  return isTauriRuntime ? getCurrentWindow() : undefined
}

export function WindowChrome() {
  const current = useAppStore((state) => state.currentNote)
  const pinned = useAppStore((state) => state.pinned)
  const toggleSidebar = useGroupStore((state) => state.toggleSidebar)
  const setCommandOpen = useAppStore((state) => state.setCommandOpen)
  const setSwitcherOpen = useAppStore((state) => state.setSwitcherOpen)
  const setSettingsOpen = useAppStore((state) => state.setSettingsOpen)
  const togglePinned = useAppStore((state) => state.togglePinned)
  const toggleFocusMode = useAppStore((state) => state.toggleFocusMode)
  const startDragging = (event: React.MouseEvent<HTMLElement>) => {
    if (!isTauriRuntime || event.button !== 0) return
    const target = event.target as HTMLElement
    if (target.closest('button')) return
    void currentWindow()?.startDragging()
  }

  return (
    <header className="window-chrome" data-tauri-drag-region onMouseDown={startDragging}>
      <div className="chrome-actions">
        <button className="brand-mark" title="命令面板 (Ctrl+K)" onClick={() => setCommandOpen(true)}>
          <Sparkles size={16} />
        </button>
        <button title="侧边栏 (Ctrl+\)" onClick={toggleSidebar}>
          <PanelLeft size={15} />
        </button>
      </div>
      <div className="note-title" title="拖动窗口" data-tauri-drag-region>
        <span>{current?.meta.title ?? 'QuickNote'}</span>
      </div>
      <div className="chrome-actions">
        <button title="Search notes" onClick={() => setSwitcherOpen(true)}>
          <Search size={16} />
        </button>
        <button title={pinned ? 'Unpin window' : 'Pin window'} onClick={() => void togglePinned()}>
          {pinned ? <PinOff size={16} /> : <Pin size={16} />}
        </button>
        <button title="Focus mode" onClick={toggleFocusMode}>
          <Maximize2 size={16} />
        </button>
        <button title="Settings" onClick={() => setSettingsOpen(true)}>
          <Settings size={16} />
        </button>
        <button className="chrome-esc" title="Hide window" onClick={() => void command<void>('toggle_window')}>
          Esc
        </button>
        <span className="chrome-divider" />
        <button className="window-control" title="最小化" onClick={() => void currentWindow()?.minimize()}>
          <Minus size={15} />
        </button>
        <button className="window-control window-close" title="关闭" onClick={() => void currentWindow()?.close()}>
          <X size={15} />
        </button>
      </div>
    </header>
  )
}
