export function isMacPlatform() {
  if (typeof navigator === 'undefined') return false
  return /mac/i.test(navigator.platform) || /macintosh|mac os x/i.test(navigator.userAgent)
}

export function shortcutKeyLabel(key: string) {
  if (!isMacPlatform()) {
    if (key === 'Mod') return 'Ctrl'
    return key === 'Super' ? 'Win' : key
  }

  const labels: Record<string, string> = {
    Mod: '⌘',
    Ctrl: '⌃',
    Alt: '⌥',
    Shift: '⇧',
    Super: '⌘',
    Cmd: '⌘',
    Enter: '↵',
    Escape: 'Esc',
  }
  return labels[key] ?? key
}
