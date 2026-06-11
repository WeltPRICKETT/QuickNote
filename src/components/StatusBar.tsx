import { useAppStore } from '../stores/appStore'

export function StatusBar() {
  const note = useAppStore((state) => state.currentNote)
  const saving = useAppStore((state) => state.saving)
  const lastSavedAt = useAppStore((state) => state.lastSavedAt)
  const body = note?.body ?? ''

  const chars = Array.from(body.replace(/\s/g, '')).length
  const words = countWords(body)
  const readMinutes = Math.max(1, Math.round(chars / 400))

  return (
    <footer className="status-bar">
      <span className="status-metrics">
        <span>{words} 词</span>
        <span className="dot-sep">·</span>
        <span>{chars} 字</span>
        {chars > 0 ? (
          <>
            <span className="dot-sep">·</span>
            <span>约 {readMinutes} 分钟</span>
          </>
        ) : null}
      </span>
      <span className="save-state">
        <span className={`save-dot${saving ? ' is-saving' : ''}`} />
        {saving ? '保存中' : lastSavedAt ? '已保存' : '就绪'}
      </span>
    </footer>
  )
}

/** Counts CJK characters individually and other scripts by whitespace-separated words. */
function countWords(text: string) {
  const cjk = text.match(/[一-鿿぀-ヿ가-힯]/g)?.length ?? 0
  const latinWords = text
    .replace(/[一-鿿぀-ヿ가-힯]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length
  return cjk + latinWords
}
