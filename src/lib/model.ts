import { CABLES } from './cables'
import type { Inputs } from './coax'
import { DEFAULTS, PRESETS } from './presets'

export type Lang = 'en' | 'uk'
export type Theme = 'auto' | 'light' | 'dark'
export interface Settings {
  lang: Lang
  theme: Theme
}
export interface AppState {
  inputs: Inputs
  settings: Settings
  preset: string
  /** Cable ids drawn on the chart next to the selected one. */
  compare: string[]
}

const KEY = 'coax-loss-calculator:v1'

export function defaultLang(): Lang {
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('uk') ? 'uk' : 'en'
}

export const defaultState = (): AppState => ({
  inputs: { ...DEFAULTS },
  settings: { lang: defaultLang(), theme: 'auto' },
  preset: 'uhf',
  compare: [...PRESETS[0].compare],
})

/** Keeps only stored values whose type matches the default, so stale data cannot break the app. */
export function sanitize(raw: unknown): AppState {
  const base = defaultState()
  if (!raw || typeof raw !== 'object') return base
  const r = raw as Partial<AppState>
  const inputs: Record<string, unknown> = { ...base.inputs }
  const stored = (r.inputs ?? {}) as Record<string, unknown>
  for (const k of Object.keys(base.inputs)) {
    const d = (base.inputs as unknown as Record<string, unknown>)[k]
    const v = stored[k]
    if (typeof d === 'number' ? typeof v === 'number' && Number.isFinite(v) : typeof v === 'string') inputs[k] = v
  }
  const i = inputs as unknown as Inputs
  if (i.cable !== 'custom' && !CABLES.some((c) => c.id === i.cable)) i.cable = DEFAULTS.cable
  if (!['m', 'ft'].includes(i.lenUnit)) i.lenUnit = DEFAULTS.lenUnit
  if (!['MHz', 'GHz'].includes(i.freqUnit)) i.freqUnit = DEFAULTS.freqUnit
  if (!['mW', 'W', 'kW', 'dBm'].includes(i.powerUnit)) i.powerUnit = DEFAULTS.powerUnit
  const s = (r.settings ?? {}) as Partial<Settings>
  return {
    inputs: i,
    settings: {
      lang: s.lang === 'uk' || s.lang === 'en' ? s.lang : base.settings.lang,
      theme: s.theme === 'light' || s.theme === 'dark' || s.theme === 'auto' ? s.theme : 'auto',
    },
    preset: typeof r.preset === 'string' ? r.preset : base.preset,
    compare: Array.isArray(r.compare) ? r.compare.filter((id): id is string => typeof id === 'string' && CABLES.some((c) => c.id === id)) : base.compare,
  }
}

export function loadState(): AppState {
  try {
    return sanitize(JSON.parse(localStorage.getItem(KEY) ?? 'null'))
  } catch {
    return defaultState()
  }
}

export function saveState(s: AppState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* storage unavailable */
  }
}

/** Fields that must be positive finite numbers. */
export function invalidFields(i: Inputs): Set<keyof Inputs> {
  const bad = new Set<keyof Inputs>()
  for (const k of ['freq', 'len'] as const) if (!(i[k] > 0)) bad.add(k)
  if (i.powerUnit !== 'dBm' && !(i.power > 0)) bad.add('power')
  if (!(i.vswr >= 1)) bad.add('vswr')
  if (!(i.conn >= 0)) bad.add('conn')
  if (!(i.targetDb > 0)) bad.add('targetDb')
  if (i.cable === 'custom') {
    if (!(i.cK1 >= 0) || !(i.cK1 + i.cK2 > 0)) bad.add('cK1')
    if (!(i.cK2 >= 0)) bad.add('cK2')
    if (!(i.cVf > 0 && i.cVf <= 1)) bad.add('cVf')
    if (!(i.cZ0 > 0)) bad.add('cZ0')
    if (!(i.cP100 > 0)) bad.add('cP100')
    if (!(i.cTmax > 40)) bad.add('cTmax')
  }
  return bad
}
