import { expect, it } from 'vitest'
import { DEFAULTS } from './presets'
import { defaultState, invalidFields, sanitize } from './model'

it('sanitize falls back to defaults on garbage', () => {
  expect(sanitize(null).inputs).toEqual(defaultState().inputs)
  const s = sanitize({ inputs: { freq: 'x', len: 12, cable: 'nope', lenUnit: 'yd' }, compare: ['rg58', 'zzz', 4] })
  expect(s.inputs.freq).toBe(DEFAULTS.freq)
  expect(s.inputs.len).toBe(12)
  expect(s.inputs.cable).toBe(DEFAULTS.cable)
  expect(s.inputs.lenUnit).toBe('m')
  expect(s.compare).toEqual(['rg58'])
})
it('flags invalid fields', () => {
  expect(invalidFields(DEFAULTS).size).toBe(0)
  const bad = invalidFields({ ...DEFAULTS, freq: 0, vswr: 0.5, cable: 'custom', cVf: 2 })
  expect([...bad].sort()).toEqual(['cVf', 'freq', 'vswr'])
})
