import {
  ChevronRight,
  FilePlus,
  FileText,
  FolderPlus,
  MoreHorizontal,
  Pin,
  Search,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore } from '../stores/appStore'
import { type NoteGroup, useGroupStore } from '../stores/groupStore'
import type { NoteMeta } from '../types'

export function Sidebar() {
  const notes = useAppStore((state) => state.notes)
  const currentId = useAppStore((state) => state.currentNote?.meta.id)
  const openNote = useAppStore((state) => state.openNote)
  const createNote = useAppStore((state) => state.createNote)
  const groups = useGroupStore((state) => state.groups)
  const assignment = useGroupStore((state) => state.assignment)
  const addGroup = useGroupStore((state) => state.addGroup)
  const [filter, setFilter] = useState('')
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)

  const filtered = useMemo(() => {
    const lowered = filter.trim().toLowerCase()
    if (!lowered) return notes
    return notes.filter(
      (note) =>
        note.title.toLowerCase().includes(lowered) || note.excerpt.toLowerCase().includes(lowered),
    )
  }, [filter, notes])

  const sections = useMemo(() => {
    const byGroup = new Map<string, NoteMeta[]>()
    const ungrouped: NoteMeta[] = []
    for (const note of filtered) {
      const groupId = assignment[note.id]
      if (groupId && groups.some((group) => group.id === groupId)) {
        const bucket = byGroup.get(groupId) ?? []
        bucket.push(note)
        byGroup.set(groupId, bucket)
      } else {
        ungrouped.push(note)
      }
    }
    const sortNotes = (list: NoteMeta[]) =>
      list.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updated.localeCompare(a.updated))
    byGroup.forEach(sortNotes)
    sortNotes(ungrouped)
    return { byGroup, ungrouped }
  }, [assignment, filtered, groups])

  // Keep the active note visible when switching from elsewhere (palette, shortcut).
  useEffect(() => {
    listRef.current
      ?.querySelector('.sidebar-note.is-active')
      ?.scrollIntoView({ block: 'nearest' })
  }, [currentId])

  // Close the move-to-group menu on any outside click.
  useEffect(() => {
    if (!menuFor) return
    const close = () => setMenuFor(null)
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', close)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', close)
    }
  }, [menuFor])

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <span className="sidebar-title">便签 · {notes.length}</span>
        <div className="sidebar-head-actions">
          <button title="新建分组" onClick={() => addGroup(`分组 ${groups.length + 1}`)}>
            <FolderPlus size={14} />
          </button>
          <button title="新建便签 (Ctrl+N)" onClick={() => void createNote()}>
            <FilePlus size={14} />
          </button>
        </div>
      </div>

      <div className="sidebar-filter">
        <Search size={12} />
        <input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="过滤…"
          spellCheck={false}
        />
      </div>

      <div className="sidebar-list" ref={listRef}>
        {groups.map((group) => (
          <GroupSection
            key={group.id}
            group={group}
            notes={sections.byGroup.get(group.id) ?? []}
            currentId={currentId}
            menuFor={menuFor}
            setMenuFor={setMenuFor}
            openNote={(id) => void openNote(id)}
          />
        ))}

        {groups.length > 0 && sections.ungrouped.length > 0 ? (
          <div className="sidebar-section-label">未分组</div>
        ) : null}
        {sections.ungrouped.map((note) => (
          <NoteRow
            key={note.id}
            note={note}
            active={note.id === currentId}
            menuOpen={menuFor === note.id}
            setMenuFor={setMenuFor}
            onOpen={() => void openNote(note.id)}
          />
        ))}

        {filtered.length === 0 ? <div className="sidebar-empty">没有匹配的便签</div> : null}
      </div>
    </aside>
  )
}

function GroupSection({
  group,
  notes,
  currentId,
  menuFor,
  setMenuFor,
  openNote,
}: {
  group: NoteGroup
  notes: NoteMeta[]
  currentId: string | undefined
  menuFor: string | null
  setMenuFor: (id: string | null) => void
  openNote: (id: string) => void
}) {
  const renameGroup = useGroupStore((state) => state.renameGroup)
  const removeGroup = useGroupStore((state) => state.removeGroup)
  const toggleCollapsed = useGroupStore((state) => state.toggleGroupCollapsed)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(group.name)

  const commit = () => {
    renameGroup(group.id, draft)
    setEditing(false)
  }

  return (
    <div className="sidebar-group">
      <div className="sidebar-group-head">
        <button
          className={`group-toggle${group.collapsed ? '' : ' is-open'}`}
          onClick={() => toggleCollapsed(group.id)}
          title={group.collapsed ? '展开' : '收起'}
        >
          <ChevronRight size={12} />
        </button>
        {editing ? (
          <input
            className="group-rename"
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commit()
              if (event.key === 'Escape') setEditing(false)
            }}
          />
        ) : (
          <button
            className="group-name"
            onDoubleClick={() => {
              setDraft(group.name)
              setEditing(true)
            }}
            onClick={() => toggleCollapsed(group.id)}
            title="双击重命名"
          >
            {group.name}
            <span className="group-count">{notes.length}</span>
          </button>
        )}
        <button className="group-delete" title="删除分组（便签回到未分组）" onClick={() => removeGroup(group.id)}>
          <Trash2 size={12} />
        </button>
      </div>
      {!group.collapsed
        ? notes.map((note) => (
            <NoteRow
              key={note.id}
              note={note}
              active={note.id === currentId}
              menuOpen={menuFor === note.id}
              setMenuFor={setMenuFor}
              onOpen={() => openNote(note.id)}
            />
          ))
        : null}
    </div>
  )
}

function NoteRow({
  note,
  active,
  menuOpen,
  setMenuFor,
  onOpen,
}: {
  note: NoteMeta
  active: boolean
  menuOpen: boolean
  setMenuFor: (id: string | null) => void
  onOpen: () => void
}) {
  const groups = useGroupStore((state) => state.groups)
  const assignment = useGroupStore((state) => state.assignment)
  const assignNote = useGroupStore((state) => state.assignNote)
  const currentGroup = assignment[note.id]

  return (
    <div className={`sidebar-note${active ? ' is-active' : ''}`}>
      <button className="sidebar-note-main" onClick={onOpen}>
        <span className="sidebar-note-title">
          {note.pinned ? <Pin size={11} /> : <FileText size={11} />}
          <span>{note.title}</span>
        </span>
        <span className="sidebar-note-time">{compactTime(note.updated)}</span>
      </button>
      {groups.length > 0 ? (
        <button
          className="sidebar-note-menu"
          title="移动到分组"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={() => setMenuFor(menuOpen ? null : note.id)}
        >
          <MoreHorizontal size={13} />
        </button>
      ) : null}
      {menuOpen ? (
        <div className="note-menu" onMouseDown={(event) => event.stopPropagation()}>
          <div className="note-menu-label">移动到</div>
          {groups.map((group) => (
            <button
              key={group.id}
              className={currentGroup === group.id ? 'is-current' : ''}
              onClick={() => {
                assignNote(note.id, group.id)
                setMenuFor(null)
              }}
            >
              {group.name}
            </button>
          ))}
          <button
            className={!currentGroup ? 'is-current' : ''}
            onClick={() => {
              assignNote(note.id, null)
              setMenuFor(null)
            }}
          >
            未分组
          </button>
        </div>
      ) : null}
    </div>
  )
}

function compactTime(iso: string) {
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return ''
  const minutes = Math.round((Date.now() - then.getTime()) / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d`
  return `${then.getMonth() + 1}/${then.getDate()}`
}
