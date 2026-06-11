import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface NoteGroup {
  id: string
  name: string
  collapsed: boolean
}

interface GroupState {
  sidebarOpen: boolean
  groups: NoteGroup[]
  /** noteId -> groupId. Notes without an entry live in the "ungrouped" section. */
  assignment: Record<string, string>
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  addGroup: (name: string) => string
  renameGroup: (id: string, name: string) => void
  removeGroup: (id: string) => void
  toggleGroupCollapsed: (id: string) => void
  assignNote: (noteId: string, groupId: string | null) => void
}

export const useGroupStore = create<GroupState>()(
  persist(
    (set, get) => ({
      sidebarOpen: false,
      groups: [],
      assignment: {},

      toggleSidebar() {
        set((state) => ({ sidebarOpen: !state.sidebarOpen }))
      },

      setSidebarOpen(open) {
        set({ sidebarOpen: open })
      },

      addGroup(name) {
        const id = `group-${Date.now().toString(36)}`
        set((state) => ({
          groups: [...state.groups, { id, name: name.trim() || '未命名分组', collapsed: false }],
        }))
        return id
      },

      renameGroup(id, name) {
        const trimmed = name.trim()
        if (!trimmed) return
        set((state) => ({
          groups: state.groups.map((group) => (group.id === id ? { ...group, name: trimmed } : group)),
        }))
      },

      removeGroup(id) {
        const assignment = { ...get().assignment }
        for (const noteId of Object.keys(assignment)) {
          if (assignment[noteId] === id) delete assignment[noteId]
        }
        set((state) => ({
          groups: state.groups.filter((group) => group.id !== id),
          assignment,
        }))
      },

      toggleGroupCollapsed(id) {
        set((state) => ({
          groups: state.groups.map((group) =>
            group.id === id ? { ...group, collapsed: !group.collapsed } : group,
          ),
        }))
      },

      assignNote(noteId, groupId) {
        set((state) => {
          const assignment = { ...state.assignment }
          if (groupId === null) {
            delete assignment[noteId]
          } else {
            assignment[noteId] = groupId
          }
          return { assignment }
        })
      },
    }),
    { name: 'quicknote.groups' },
  ),
)
