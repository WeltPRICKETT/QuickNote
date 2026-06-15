import { getCurrentWindow } from '@tauri-apps/api/window'
import { Maximize2, Minus, PanelLeft, Pin, PinOff, Search, Settings, Sparkles, X } from 'lucide-react'
import { command } from '../lib/tauri'
import { isMacPlatform, shortcutKeyLabel } from '../lib/platform'
import { useAppStore } from '../stores/appStore'
import { useGroupStore } from '../stores/groupStore'

const isTauriRuntime = '__TAURI_INTERNALS__' in window

function currentWindow() {
  return isTauriRuntime ? getCurrentWindow() : undefined
}

export function WindowChrome() {
  const isMac = isMacPlatform()
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
    <header className="window-chrome" data-platform={isMac ? 'mac' : 'default'} data-tauri-drag-region onMouseDown={startDragging}>
      {isMac ? <WindowControls variant="mac" /> : null}
      <div className="chrome-actions">
        <button className="brand-mark" title={`命令面板 (${shortcutKeyLabel('Mod')}+K)`} onClick={() => setCommandOpen(true)}>
          <Sparkles size={16} />
        </button>
        <button title={`侧边栏 (${shortcutKeyLabel('Mod')}+\\)`} onClick={toggleSidebar}>
          <PanelLeft size={15} />
        </button>
      </div>
      <div className="note-title" title="拖动窗口" data-tauri-drag-region>
        <span>{current?.meta.title ?? 'QuickNote'}</span>
      </div>
      <div className="chrome-actions">
        <button title="搜索便签" onClick={() => setSwitcherOpen(true)}>
          <Search size={16} />
        </button>
        <button title={pinned ? '取消置顶' : '置顶窗口'} onClick={() => void togglePinned()}>
          {pinned ? <PinOff size={16} /> : <Pin size={16} />}
        </button>
        <button title="专注模式" onClick={toggleFocusMode}>
          <Maximize2 size={16} />
        </button>
        <button title="设置" onClick={() => setSettingsOpen(true)}>
          <Settings size={16} />
        </button>
        <button className="chrome-esc" title="隐藏窗口" onClick={() => void command<void>('toggle_window')}>
          隐藏
        </button>
        {!isMac ? <WindowControls variant="default" /> : null}
      </div>
    </header>
  )
}

function WindowControls({ variant }: { variant: 'mac' | 'default' }) {
  if (variant === 'mac') {
    return (
      <div className="window-controls window-controls-mac">
        <button className="mac-control mac-close" title="关闭到托盘" onClick={() => void currentWindow()?.close()}>
          <X size={9} />
        </button>
        <button className="mac-control mac-minimize" title="最小化" onClick={() => void currentWindow()?.minimize()}>
          <Minus size={9} />
        </button>
        <button className="mac-control mac-zoom" title="缩放窗口" onClick={() => void currentWindow()?.toggleMaximize()}>
          <Maximize2 size={8} />
        </button>
      </div>
    )
  }

  return (
    <>
      <span className="chrome-divider" />
      <button className="window-control" title="最小化" onClick={() => void currentWindow()?.minimize()}>
        <Minus size={15} />
      </button>
      <button className="window-control window-close" title="关闭到托盘" onClick={() => void currentWindow()?.close()}>
        <X size={15} />
      </button>
    </>
  )
}
