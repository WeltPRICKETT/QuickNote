import { FilePlus, FileText, Pin, Search } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../stores/appStore'
import type { SearchResult } from '../types'

export function NoteSwitcher() {
  const notes = useAppStore((state) => state.notes)
  const search = useAppStore((state) => state.search)
  const openNote = useAppStore((state) => state.openNote)
  const createNote = useAppStore((state) => state.createNote)
  const setSwitcherOpen = useAppStore((state) => state.setSwitcherOpen)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const [results, setResults] = useState<SearchResult[]>([])
  const listRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    void search(query).then((found) => {
      setResults(found)
      setSelected(0)
    })
  }, [query, notes, search])

  useEffect(() => {
    listRef.current
      ?.querySelector('.note-result.is-selected')
      ?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  useEffect(() => {
    const onWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSwitcherOpen(false)
    }
    window.addEventListener('keydown', onWindowKeyDown)
    return () => window.removeEventListener('keydown', onWindowKeyDown)
  }, [setSwitcherOpen])

  const createAndClose = async () => {
    await createNote()
    setSwitcherOpen(false)
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setSwitcherOpen(false)
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      setSelected((index) => Math.min(index + 1, Math.max(results.length - 1, 0)))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setSelected((index) => Math.max(index - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const target = results[selected]
      if (target) {
        void openNote(target.id)
      } else {
        void createAndClose()
      }
    }
  }

  return (
    <motion.div
      className="overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.12 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setSwitcherOpen(false)
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
          <Search size={15} />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="搜索便签…"
            spellCheck={false}
          />
          <kbd>↵</kbd>
        </div>
        <div className="palette-list" ref={listRef}>
          {results.map((note, index) => (
            <motion.button
              key={note.id}
              className={`note-result${index === selected ? ' is-selected' : ''}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.012, duration: 0.15 }}
              onMouseEnter={() => setSelected(index)}
              onClick={() => void openNote(note.id)}
            >
              <span className="result-title">
                {note.pinned ? <Pin size={13} /> : <FileText size={13} />}
                <span className="title-text">{note.title}</span>
              </span>
              <span className="result-time">{relativeTime(note.updated)}</span>
              <span className="result-excerpt">{note.excerpt || note.path}</span>
            </motion.button>
          ))}
          {results.length === 0 ? (
            <button className="note-result is-selected" onClick={() => void createAndClose()}>
              <span className="result-title">
                <FilePlus size={13} />
                <span className="title-text">{query ? `没有结果 — 新建便签` : '新建便签'}</span>
              </span>
              <span className="result-time">↵</span>
            </button>
          ) : null}
        </div>
      </motion.div>
    </motion.div>
  )
}

function relativeTime(iso: string) {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const minutes = Math.round((Date.now() - then) / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days} 天前`
  return new Date(iso).toLocaleDateString()
}
