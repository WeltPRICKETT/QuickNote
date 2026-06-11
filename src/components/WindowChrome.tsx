import { Maximize2, PanelLeft, Pin, PinOff, Search, Settings, Sparkles } from 'lucide-react'
import { command } from '../lib/tauri'
import { useAppStore } from '../stores/appStore'
import { useGroupStore } from '../stores/groupStore'

export function WindowChrome() {
  const current = useAppStore((state) => state.currentNote)
  const pinned = useAppStore((state) => state.pinned)
  const toggleSidebar = useGroupStore((state) => state.toggleSidebar)
  const setCommandOpen = useAppStore((state) => state.setCommandOpen)
  const setSwitcherOpen = useAppStore((state) => state.setSwitcherOpen)
  const setSettingsOpen = useAppStore((state) => state.setSettingsOpen)
  const togglePinned = useAppStore((state) => state.togglePinned)
  const toggleFocusMode = useAppStore((state) => state.toggleFocusMode)

  return (
    <header className="window-chrome" data-tauri-drag-region>
      <div className="chrome-actions">
        <button className="brand-mark" title="命令面板 (Ctrl+K)" onClick={() => setCommandOpen(true)}>
          <Sparkles size={16} />
        </button>
        <button title="侧边栏 (Ctrl+\)" onClick={toggleSidebar}>
          <PanelLeft size={15} />
        </button>
      </div>
      <button className="note-title" title="Switch notes" onClick={() => setSwitcherOpen(true)}>
        <span>{current?.meta.title ?? 'QuickNote'}</span>
      </button>
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
      </div>
    </header>
  )
}
