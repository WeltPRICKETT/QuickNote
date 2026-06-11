import { CaseSensitive, FolderOpen, Keyboard, MousePointerClick, Scroll, Zap } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useAppStore } from '../stores/appStore'
import { useSettingsStore } from '../stores/settingsStore'
import { FONT_PRESETS, THEME_PRESETS } from '../themes'

export function SettingsPanel() {
  const setSettingsOpen = useAppStore((state) => state.setSettingsOpen)
  const settings = useSettingsStore()
  const update = useSettingsStore((state) => state.update)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSettingsOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setSettingsOpen])

  return (
    <motion.div
      className="overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.12 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setSettingsOpen(false)
      }}
    >
      <motion.aside
        className="settings-panel"
        initial={{ opacity: 0, x: 18, scale: 0.99 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: 18, scale: 0.99 }}
        transition={{ type: 'spring', stiffness: 420, damping: 36, mass: 0.7 }}
      >
        <header>
          <h2>设置</h2>
          <button className="settings-close" onClick={() => setSettingsOpen(false)}>
            Esc
          </button>
        </header>

        <div className="settings-section">主题</div>

        <div className="theme-grid" role="radiogroup" aria-label="主题">
          {THEME_PRESETS.map((preset) => (
            <button
              key={preset.id}
              className={`theme-card${settings.theme === preset.id ? ' is-active' : ''}`}
              title={preset.description}
              onClick={() => void update({ theme: preset.id })}
            >
              <span className="theme-swatch">
                {preset.swatch.map((color, index) => (
                  <span key={index} style={{ background: color }} />
                ))}
              </span>
              <span className="theme-name">{preset.name}</span>
            </button>
          ))}
        </div>

        <div className="settings-section">字体</div>

        <div className="setting-row">
          <span>正文字体</span>
          <div className="segmented" role="radiogroup" aria-label="正文字体">
            {FONT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                className={settings.fontFamily === preset.id ? 'is-active' : ''}
                title={preset.sample}
                onClick={() => void update({ fontFamily: preset.id })}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>

        <label className="setting-row">
          <span>
            <CaseSensitive size={15} /> 正文字号
          </span>
          <span className="slider-row">
            <input
              type="range"
              min={14}
              max={22}
              value={settings.fontSize}
              onChange={(event) => void update({ fontSize: Number(event.target.value) })}
            />
            <output>{settings.fontSize}</output>
          </span>
        </label>

        <div className="settings-section">行为</div>

        <label className="setting-row">
          <span>
            <MousePointerClick size={15} /> 失焦自动隐藏
          </span>
          <span className="switch">
            <input
              type="checkbox"
              checked={settings.hideOnBlur}
              onChange={(event) => void update({ hideOnBlur: event.target.checked })}
            />
            <span className="track" />
          </span>
        </label>

        <label className="setting-row">
          <span>
            <Keyboard size={15} /> 平滑光标
          </span>
          <span className="switch">
            <input
              type="checkbox"
              checked={settings.smoothCaret}
              onChange={(event) => void update({ smoothCaret: event.target.checked })}
            />
            <span className="track" />
          </span>
        </label>

        <label className="setting-row">
          <span>
            <Scroll size={15} /> 打字机滚动
          </span>
          <span className="switch">
            <input
              type="checkbox"
              checked={settings.typewriterScroll}
              onChange={(event) => void update({ typewriterScroll: event.target.checked })}
            />
            <span className="track" />
          </span>
        </label>

        <div className="settings-section">快捷键</div>

        <ShortcutSetting />


        <div className="settings-section">存储</div>

        <div className="directory-row">
          <FolderOpen size={15} />
          <span>{settings.noteDirectory}</span>
        </div>
      </motion.aside>
    </motion.div>
  )
}

function ShortcutSetting() {
  const globalShortcut = useSettingsStore((state) => state.globalShortcut)
  const update = useSettingsStore((state) => state.update)
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!recording) return
    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault()
      event.stopImmediatePropagation()
      if (event.key === 'Escape') {
        setRecording(false)
        return
      }
      const combo = comboFromEvent(event)
      if (!combo) return // still holding modifiers only
      setRecording(false)
      update({ globalShortcut: combo })
        .then(() => setError(null))
        .catch((reason: unknown) => setError(String(reason)))
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [recording, update])

  return (
    <>
      <div className="setting-row">
        <span>
          <Zap size={15} /> 全局唤醒
        </span>
        <button
          className={`shortcut-recorder${recording ? ' is-recording' : ''}`}
          onClick={() => {
            setError(null)
            setRecording((value) => !value)
          }}
          title="点击后按下新的组合键"
        >
          {recording ? (
            <span className="recorder-hint">按下组合键… Esc 取消</span>
          ) : (
            globalShortcut.split('+').map((part) => <kbd key={part}>{prettyKey(part)}</kbd>)
          )}
        </button>
      </div>
      {error ? <div className="shortcut-error">{error}</div> : null}
    </>
  )
}

/**
 * Builds a shortcut string from a key event: modifier names plus the W3C
 * `code` value, both of which the Tauri global-shortcut plugin can parse.
 */
function comboFromEvent(event: KeyboardEvent): string | null {
  if (/^(Control|Shift|Alt|Meta)/.test(event.code)) return null
  const mods: string[] = []
  if (event.ctrlKey) mods.push('Ctrl')
  if (event.altKey) mods.push('Alt')
  if (event.shiftKey) mods.push('Shift')
  if (event.metaKey) mods.push('Super')
  if (mods.length === 0) return null // bare keys would hijack normal typing
  return [...mods, event.code].join('+')
}

function prettyKey(part: string) {
  if (part.startsWith('Key') && part.length === 4) return part.slice(3)
  if (part.startsWith('Digit') && part.length === 6) return part.slice(5)
  const names: Record<string, string> = {
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    Backquote: '`',
    Minus: '-',
    Equal: '=',
    Backslash: '\\',
    Slash: '/',
    Period: '.',
    Comma: ',',
    Semicolon: ';',
    Quote: "'",
    BracketLeft: '[',
    BracketRight: ']',
    Super: 'Win',
  }
  return names[part] ?? part
}
