import type { FontFamily, ThemeMode } from './types'

export interface ThemePreset {
  id: ThemeMode
  name: string
  description: string
  /** Swatch colors for the settings picker: [bg, surface, accent, text]. */
  swatch: [string, string, string, string]
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'system',
    name: '跟随系统',
    description: '浅色用纸笺，深色用子夜',
    swatch: ['#f2eee4', '#0e1016', '#bc4d27', '#e8956d'],
  },
  {
    id: 'paper',
    name: '纸笺',
    description: '暖象牙底、墨色文字、柿红点缀',
    swatch: ['#f2eee4', '#fffdf7', '#bc4d27', '#2b261e'],
  },
  {
    id: 'midnight',
    name: '子夜',
    description: '深空蓝灰、暖珊瑚强调',
    swatch: ['#0e1016', '#191c25', '#e8956d', '#ddd8cc'],
  },
  {
    id: 'classical',
    name: '古卷',
    description: '陈年宣纸、朱砂批注、衬线标题',
    swatch: ['#eee4cd', '#f7efdc', '#9d2f23', '#3a2f22'],
  },
  {
    id: 'cyber',
    name: '数据流',
    description: '霓虹青与品红、终端质感',
    swatch: ['#080b14', '#10141f', '#2dd4cb', '#cdd6e8'],
  },
  {
    id: 'sakura',
    name: '落樱',
    description: '樱粉浅色、梅紫文字',
    swatch: ['#f8eef0', '#fffafa', '#c94f6d', '#43323a'],
  },
  {
    id: 'forest',
    name: '松涛',
    description: '苔绿深色、晨雾青强调',
    swatch: ['#0e1411', '#16201a', '#8fc7a2', '#d9e2d6'],
  },
]

export interface FontPreset {
  id: FontFamily
  name: string
  sample: string
}

export const FONT_PRESETS: FontPreset[] = [
  { id: 'sans', name: '现代黑', sample: 'Inter · 思源黑体' },
  { id: 'serif', name: '人文宋', sample: 'Lora · 宋体' },
  { id: 'kai', name: '手写楷', sample: '霞鹜文楷' },
  { id: 'mono', name: '等宽', sample: 'JetBrains Mono' },
]

export function themeName(id: ThemeMode) {
  return THEME_PRESETS.find((preset) => preset.id === id)?.name ?? id
}

export function fontName(id: FontFamily) {
  return FONT_PRESETS.find((preset) => preset.id === id)?.name ?? id
}
