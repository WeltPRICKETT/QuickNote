import type { NoteMeta, SearchResult } from '../types'

export interface SearchableNote extends NoteMeta {
  body: string
}

export function rankNotes(notes: SearchableNote[], query: string): SearchResult[] {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean)

  if (terms.length === 0) {
    return notes
      .map((note, index) => ({ ...note, score: note.pinned ? 1000 - index : 100 - index }))
      .sort(compareSearchResults)
  }

  return notes
    .map((note) => {
      const title = note.title.toLowerCase()
      const excerpt = note.excerpt.toLowerCase()
      const body = note.body.toLowerCase()
      const tags = note.tags.join(' ').toLowerCase()
      const score = terms.reduce((sum, term) => {
        const titleHit = title.includes(term) ? 100 : 0
        const tagHit = tags.includes(term) ? 35 : 0
        const excerptHit = excerpt.includes(term) ? 15 : 0
        const bodyHit = body.includes(term) ? 5 : 0
        return sum + titleHit + tagHit + excerptHit + bodyHit
      }, note.pinned ? 8 : 0)

      return { ...note, score }
    })
    .filter((note) => note.score > 0)
    .sort(compareSearchResults)
}

function compareSearchResults(a: SearchResult, b: SearchResult) {
  if (b.score !== a.score) return b.score - a.score
  return new Date(b.updated).getTime() - new Date(a.updated).getTime()
}
