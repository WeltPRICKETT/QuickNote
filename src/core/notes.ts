import type { NoteMeta } from '../types'

export function createMarkdownFilename(iso: string, slug: string) {
  const date = new Date(iso)
  const stamp = date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace('T', '-')
    .slice(0, 14)
  return `${stamp}-${slugify(slug)}.md`
}

export function slugify(input: string) {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'note'
  )
}

export function defaultNoteBody() {
  return [
    '# Today Quick Note',
    '',
    '- [ ] Capture the thought while it is still warm',
    '- Use `Cmd/Ctrl+K` for commands',
    '',
    '> QuickNote keeps the file plain Markdown.',
  ].join('\n')
}

export function inferTitle(body: string) {
  const heading = body
    .split('\n')
    .map((line) => line.trim())
    .find((line) => /^#{1,6}\s+\S/.test(line))
  if (heading) return heading.replace(/^#{1,6}\s+/, '').trim()

  const firstText = body
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean)
  return firstText?.slice(0, 60) || 'Untitled'
}

export function frontmatterFor(meta: NoteMeta) {
  return [
    '---',
    `created: ${meta.created}`,
    `updated: ${meta.updated}`,
    `pinned: ${meta.pinned}`,
    `tags: [${meta.tags.map((tag) => `"${tag}"`).join(', ')}]`,
    '---',
  ].join('\n')
}

export function parseFrontmatter(raw: string) {
  const body = raw.replace(/^---[\s\S]*?---\s*/, '')
  const frontmatter = raw.match(/^---([\s\S]*?)---/)?.[1] ?? ''
  const pinned = /pinned:\s*true/.test(frontmatter)
  const tagsRaw = frontmatter.match(/tags:\s*\[(.*?)\]/)?.[1] ?? ''
  const tags = tagsRaw
    .split(',')
    .map((tag) => tag.replace(/["']/g, '').trim())
    .filter(Boolean)

  return {
    body,
    pinned,
    tags,
    title: inferTitle(body),
  }
}
