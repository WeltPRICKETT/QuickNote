import { describe, expect, it } from 'vitest'
import { rankNotes } from './search'

const now = new Date('2026-06-11T09:00:00Z').toISOString()

describe('rankNotes', () => {
  it('prioritizes title and pinned matches', () => {
    const results = rankNotes(
      [
        {
          id: '1',
          path: '1.md',
          title: 'Project Plan',
          excerpt: 'release checklist',
          body: 'nothing',
          tags: [],
          pinned: false,
          created: now,
          updated: now,
        },
        {
          id: '2',
          path: '2.md',
          title: 'Inbox',
          excerpt: 'project note',
          body: 'project',
          tags: ['project'],
          pinned: true,
          created: now,
          updated: now,
        },
      ],
      'project',
    )

    expect(results.map((note) => note.id)).toEqual(['1', '2'])
  })
})
