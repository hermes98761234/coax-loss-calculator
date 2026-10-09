import { expect, it } from 'vitest'
import { fix, fmt, fmtPower } from './format'

it('formats numbers', () => {
  expect(fmt(1234.5678, 3)).toBe('1230')
  expect(fmt(-0.5)).toBe('−0.5')
  expect(fix(-1.234, 2)).toBe('−1.23')
  expect(fmt(Infinity)).toBe('∞')
})
it('formats power with prefixes', () => {
  expect(fmtPower(1500)).toBe('1.5 kW')
  expect(fmtPower(0.025)).toBe('25 mW')
  expect(fmtPower(1e-13)).toBe('0.1 pW')
})
