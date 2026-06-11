import {
  ClipboardCopy,
  EyeOff,
  FilePlus,
  Focus,
  type LucideIcon,
  PanelLeft,
  Pin,
  Search,
  Settings,
  SunMoon,
  Terminal,
  Trash2,
  Type,
} from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { command as tauriCommand } from '../lib/tauri'
import { useAppStore } from '../stores/appStore'
import { useGroupStore } from '../stores/groupStore'
import { useSettingsStore } from '../stores/settingsStore'
import { FONT_PRESETS, THEME_PRESETS, fontName, themeName } from '../themes'

interface PaletteCommand {
  id: string
  label: string
  section: string
  icon: LucideIcon
  keys?: string[]
  run: () => void | Promise<void>
}

export function CommandPalette() {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const listRef = useRef<HTMLDivElement | null>(null)
  const createNote = useAppStore((state) => state.createNote)
  const setCommandOpen = useAppStore((state) => state.setCommandOpen)
  const setSwitcherOpen = useAppStore((state) => state.setSwitcherOpen)
  const setSettingsOpen = useAppStore((state) => state.setSettingsOpen)
  const toggleFocusMode = useAppStore((state) => state.toggleFocusMode)
  const togglePinned = useAppStore((state) => state.togglePinned)
  const theme = useSettingsStore((state) => state.theme)
  const fontFamily = useSettingsStore((state) => state.fontFamily)
  const updateSettings = useSettingsStore((state) => state.update)
  const toggleSidebar = useGroupStore((state) => state.toggleSidebar)

  const commands = useMemo<PaletteCommand[]>(
    () => [
      {
        id: 'new',
        label: '新建便签',
        section: '便签',
        icon: FilePlus,
        keys: ['Ctrl', 'N'],
        run: async () => {
          await createNote()
          setCommandOpen(false)
        },
      },
      {
        id: 'switch',
        label: '切换便签…',
        section: '便签',
        icon: Search,
        keys: ['Ctrl', 'P'],
        run: () => setSwitcherOpen(true),
      },
      {
        id: 'delete',
        label: confirmDelete ? '确认删除当前便签？（再次执行确认）' : '删除当前便签…',
        section: '便签',
        icon: Trash2,
        run: async () => {
          if (!confirmDelete) {
            setConfirmDelete(true)
            return
          }
          const id = useAppStore.getState().currentNote?.meta.id
          setConfirmDelete(false)
          if (id) await useAppStore.getState().deleteNote(id)
          setCommandOpen(false)
        },
      },
      {
        id: 'copy',
        label: '复制为 Markdown',
        section: '便签',
        icon: ClipboardCopy,
        run: async () => {
          const body = useAppStore.getState().currentNote?.body ?? ''
          await navigator.clipboard.writeText(body)
          setCommandOpen(false)
        },
      },
      {
        id: 'focus',
        label: '专注写作模式',
        section: '视图',
        icon: Focus,
        keys: ['Ctrl', 'Shift', 'F'],
        run: () => {
          toggleFocusMode()
          setCommandOpen(false)
        },
      },
      {
        id: 'pin',
        label: '钉住窗口',
        section: '视图',
        icon: Pin,
        keys: ['Ctrl', 'Shift', 'P'],
        run: async () => {
          await togglePinned()
          setCommandOpen(false)
        },
      },
      {
        id: 'sidebar',
        label: '切换侧边栏',
        section: '视图',
        icon: PanelLeft,
        keys: ['Ctrl', '\\'],
        run: () => {
          toggleSidebar()
          setCommandOpen(false)
        },
      },
      {
        id: 'theme',
        label: `主题：${themeName(theme)}`,
        section: '视图',
        icon: SunMoon,
        run: async () => {
          const index = THEME_PRESETS.findIndex((preset) => preset.id === theme)
          const next = THEME_PRESETS[(index + 1) % THEME_PRESETS.length]!
          await updateSettings({ theme: next.id })
        },
      },
      {
        id: 'font',
        label: `字体：${fontName(fontFamily)}`,
        section: '视图',
        icon: Type,
        run: async () => {
          const index = FONT_PRESETS.findIndex((preset) => preset.id === fontFamily)
          const next = FONT_PRESETS[(index + 1) % FONT_PRESETS.length]!
          await updateSettings({ fontFamily: next.id })
        },
      },
      {
        id: 'settings',
        label: '设置',
        section: '应用',
        icon: Settings,
        keys: ['Ctrl', ','],
        run: () => setSettingsOpen(true),
      },
      {
        id: 'hide',
        label: '隐藏窗口',
        section: '应用',
        icon: EyeOff,
        keys: ['Esc'],
        run: () => void tauriCommand<void>('toggle_window'),
      },
    ],
    [confirmDelete, createNote, fontFamily, setCommandOpen, setSettingsOpen, setSwitcherOpen, theme, toggleFocusMode, togglePinned, toggleSidebar, updateSettings],
  )

  const visible = useMemo(() => {
    const lowered = query.trim().toLowerCase()
    if (!lowered) return commands
    return commands.filter((item) => item.label.toLowerCase().includes(lowered) || item.id.includes(lowered))
  }, [commands, query])

  useEffect(() => {
    const onWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCommandOpen(false)
    }
    window.addEventListener('keydown', onWindowKeyDown)
    return () => window.removeEventListener('keydown', onWindowKeyDown)
  }, [setCommandOpen])

  useEffect(() => {
    listRef.current
      ?.querySelector('.palette-item.is-selected')
      ?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setCommandOpen(false)
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      setSelected((index) => Math.min(index + 1, visible.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setSelected((index) => Math.max(index - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      void visible[selected]?.run()
    }
  }

  let lastSection = ''

  return (
    <motion.div
      className="overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.12 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setCommandOpen(false)
      }}
    >
      <motion.div
        className="palette"
        initial={{ opacity: 0, y: -8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 480, damping: 36, mass: 0.6 }}
      >
        <div className="palette-search">
          <Terminal size={15} />
          <input
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setSelected(0)
              setConfirmDelete(false)
            }}
            onKeyDown={onKeyDown}
            placeholder="输入命令…"
            spellCheck={false}
          />
          <kbd>Esc</kbd>
        </div>
        <div className="palette-list" ref={listRef}>
          {visible.length === 0 ? <div className="palette-empty">没有匹配的命令</div> : null}
          {visible.map((item, index) => {
            const showSection = item.section !== lastSection
            lastSection = item.section
            return (
              <div key={item.id}>
                {showSection ? <div className="palette-section">{item.section}</div> : null}
                <motion.button
                  className={`palette-item${index === selected ? ' is-selected' : ''}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.015, duration: 0.15 }}
                  onMouseEnter={() => setSelected(index)}
                  onClick={() => void item.run()}
                >
                  <span className="item-icon">
                    <item.icon size={14} />
                  </span>
                  <span className="item-label">{item.label}</span>
                  {item.keys ? (
                    <span className="item-keys">
                      {item.keys.map((key) => (
                        <kbd key={key}>{key}</kbd>
                      ))}
                    </span>
                  ) : null}
                </motion.button>
              </div>
            )
          })}
        </div>
      </motion.div>
    </motion.div>
  )
}
