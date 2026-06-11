import { AnimatePresence, motion } from 'motion/react'
import { useEffect } from 'react'
import { CommandPalette } from './components/CommandPalette'
import { EditorPane } from './components/EditorPane'
import { NoteSwitcher } from './components/NoteSwitcher'
import { SettingsPanel } from './components/SettingsPanel'
import { Sidebar } from './components/Sidebar'
import { StatusBar } from './components/StatusBar'
import { WindowChrome } from './components/WindowChrome'
import { useAppStore } from './stores/appStore'
import { useGroupStore } from './stores/groupStore'
import { useSettingsStore } from './stores/settingsStore'

export function App() {
  const boot = useAppStore((state) => state.boot)
  const commandOpen = useAppStore((state) => state.commandOpen)
  const switcherOpen = useAppStore((state) => state.switcherOpen)
  const settingsOpen = useAppStore((state) => state.settingsOpen)
  const focusMode = useAppStore((state) => state.focusMode)
  const theme = useSettingsStore((state) => state.theme)
  const fontFamily = useSettingsStore((state) => state.fontFamily)
  const loadSettings = useSettingsStore((state) => state.load)
  const sidebarOpen = useGroupStore((state) => state.sidebarOpen)

  useEffect(() => {
    void loadSettings()
    void boot()
  }, [boot, loadSettings])

  // App-wide shortcuts: palette, switcher, new note, focus mode, sidebar, settings.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey
      if (!mod) return
      const state = useAppStore.getState()
      const key = event.key.toLowerCase()
      if (key === 'k') {
        event.preventDefault()
        state.setCommandOpen(!state.commandOpen)
      } else if (key === 'p' && !event.shiftKey) {
        event.preventDefault()
        state.setSwitcherOpen(!state.switcherOpen)
      } else if (key === 'p' && event.shiftKey) {
        event.preventDefault()
        void state.togglePinned()
      } else if (key === 'n') {
        event.preventDefault()
        void state.createNote()
      } else if (key === 'f' && event.shiftKey) {
        event.preventDefault()
        state.toggleFocusMode()
      } else if (key === ',') {
        event.preventDefault()
        state.setSettingsOpen(!state.settingsOpen)
      } else if (key === '\\') {
        event.preventDefault()
        useGroupStore.getState().toggleSidebar()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <main
      className="app-shell"
      data-theme={theme}
      data-font={fontFamily}
      data-focus={focusMode}
      data-sidebar={sidebarOpen && !focusMode}
    >
      <motion.section
        className="quick-window"
        initial={{ opacity: 0, scale: 0.96, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 430, damping: 34, mass: 0.7 }}
      >
        <WindowChrome />
        <div className="main-row">
          <div className="sidebar-slot">
            <Sidebar />
          </div>
          <EditorPane />
        </div>
        <StatusBar />
      </motion.section>

      <AnimatePresence>
        {commandOpen ? <CommandPalette key="commands" /> : null}
        {switcherOpen ? <NoteSwitcher key="switcher" /> : null}
        {settingsOpen ? <SettingsPanel key="settings" /> : null}
      </AnimatePresence>
    </main>
  )
}
